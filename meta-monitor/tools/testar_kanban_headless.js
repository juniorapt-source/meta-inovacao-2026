/* Teste F11: kanban_contagem_por_coluna — trava a visão Kanban de plano.html (item 3.3
 * do plano de melhorias). Abre a página com o plano (via DB_PLANO.carregar(), P10),
 * clica no botão KANBAN e confere que a contagem de cards por coluna bate exatamente com
 * a contagem por status que os outros pontos do site (KPIs de index.html, F2) já usam
 * como fonte de verdade — sem perder nem duplicar nenhuma das 47 ações.
 *
 * Escopo deliberado: este teste cobre só a RENDERIZAÇÃO (colunas/contagens/faixa de
 * janela) — não simula o drag-and-drop de verdade. Simular um drop dispararia
 * DB_PLANO.salvar(), que faria uma escrita REAL no Supabase de produção mesmo com
 * ?semrede=1 (a trava de teste em js/db-plano.js bloqueia justamente isso — ver
 * "bloquearEscritaEmTeste" — então tentar mesmo assim faria o teste falhar de propósito,
 * não passar). O mecanismo de gravação em si (DB_PLANO.salvar com um patch de status) já
 * é o mesmo caminho usado por editor.html (P10), testado e funcionando em produção — não
 * há necessidade de reprovar essa parte aqui de novo.
 *
 * Mesmo padrão de CDP cru (sem Playwright) dos outros testes headless do repo.
 */
"use strict";
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");

const REPO = path.join(__dirname, "..");

const CAMINHOS_CHROME = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser",
];

function acharChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  for (const p of CAMINHOS_CHROME) if (fs.existsSync(p)) return p;
  throw new Error("Não achei um Chrome/Chromium instalado. Defina CHROME_PATH=/caminho/pro/chrome.");
}

function iniciarServidor() {
  const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".json": "application/json" };
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent((req.url || "/").split("?")[0]);
    if (p === "/") p = "/index.html";
    const full = path.join(REPO, p);
    if (!full.startsWith(REPO)) { res.writeHead(403); res.end(); return; }
    fs.readFile(full, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { "Content-Type": MIME[path.extname(full)] || "application/octet-stream" });
      res.end(data);
    });
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port })));
}

function iniciarChrome(chromePath) {
  const perfilTmp = fs.mkdtempSync(path.join(os.tmpdir(), "meta-inovacao-teste-chrome-"));
  return new Promise((resolve, reject) => {
    const proc = spawn(chromePath, [
      "--headless=new", "--disable-gpu", "--no-sandbox",
      "--remote-debugging-port=0", "--user-data-dir=" + perfilTmp,
    ], { stdio: ["ignore", "ignore", "pipe"] });
    let buf = "";
    const tempo = setTimeout(() => reject(new Error("timeout esperando o Chrome subir")), 15000);
    proc.stderr.on("data", (chunk) => {
      buf += chunk.toString();
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(tempo); resolve({ proc, wsUrl: m[1], perfilTmp }); }
    });
    proc.on("error", reject);
    proc.on("exit", (code) => { if (code !== null && code !== 0) reject(new Error("Chrome saiu com código " + code)); });
  });
}

function encerrarChrome(proc) {
  if (!proc || proc.exitCode !== null) return Promise.resolve();
  return new Promise((resolve) => {
    proc.once("exit", resolve);
    proc.kill();
    setTimeout(() => { proc.kill("SIGKILL"); resolve(); }, 3000);
  });
}

async function limparPerfil(perfilTmp) {
  if (!perfilTmp) return;
  try { await fs.promises.rm(perfilTmp, { recursive: true, force: true, maxRetries: 3 }); }
  catch (e) { console.error("aviso: não consegui limpar o perfil temporário do Chrome:", e.message); }
}

function conectarCDP(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let proximoId = 1;
    const pendentes = new Map();
    const ouvintes = new Map();
    ws.addEventListener("error", (e) => reject(new Error("WebSocket CDP falhou: " + e.message)));
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id !== undefined && pendentes.has(msg.id)) {
        const { resolve: res, reject: rej } = pendentes.get(msg.id);
        pendentes.delete(msg.id);
        if (msg.error) rej(new Error("CDP " + JSON.stringify(msg.error)));
        else res(msg.result);
      } else if (msg.method) {
        (ouvintes.get(msg.method) || []).forEach((cb) => cb(msg.params));
      }
    });
    ws.addEventListener("open", () => resolve(cdp));
    const cdp = {
      send(method, params, sessionId) {
        return new Promise((res, rej) => {
          const id = proximoId++;
          pendentes.set(id, { resolve: res, reject: rej });
          const payload = { id, method, params: params || {} };
          if (sessionId) payload.sessionId = sessionId;
          ws.send(JSON.stringify(payload));
        });
      },
      once(method) {
        return new Promise((res) => {
          const lista = ouvintes.get(method) || [];
          lista.push(res);
          ouvintes.set(method, lista);
        });
      },
      close() { ws.close(); },
    };
  });
}

function esperar(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function principal() {
  const chromePath = acharChrome();
  const { server, port } = await iniciarServidor();
  const { proc, wsUrl, perfilTmp } = await iniciarChrome(chromePath);
  const cdp = await conectarCDP(wsUrl);

  try {
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Runtime.enable", {}, sessionId);
    // força fallback local (DB_PLANO) — mesmo mecanismo dos outros testes headless desde
    // o P10 (item 3.1): sem isso este teste dependeria de rede real pra ler o plano.
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: "window.CC_FORCAR_FALLBACK = true;" }, sessionId);

    async function evaluate(expression) {
      const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId);
      if (r.exceptionDetails) throw new Error("erro avaliando no browser: " + JSON.stringify(r.exceptionDetails));
      return r.result.value;
    }

    const carregou = cdp.once("Page.loadEventFired");
    await cdp.send("Page.navigate", { url: "http://127.0.0.1:" + port + "/plano.html?semrede=1" }, sessionId);
    await carregou;
    await esperar(300);

    const erros = [];

    // "fonte de verdade" pra comparar: a mesma lista window.DB.plano (seed local, já
    // carregada nesta página) que o resto do site usa pra contar KPIs (js/calc.js F2).
    const esperado = JSON.parse(await evaluate(`JSON.stringify((function(){
      const plano = window.DB.plano;
      const naoIniciado = plano.filter(a => a.status === "Não iniciado").length;
      const emAndamento = plano.filter(a => a.status === "Em andamento").length;
      const concluido = plano.filter(a => a.status === "Concluído").length;
      const janelaNaoIniciado = plano.filter(a => a.status === "Não iniciado" && !a.prazo_iso && a.prazo).length;
      return { total: plano.length, naoIniciado, emAndamento, concluido, janelaNaoIniciado };
    })())`));

    await evaluate("document.getElementById('btn-vista-kanban').click()");
    await esperar(300);

    const estado = JSON.parse(await evaluate(`JSON.stringify({
      kanbanVisivel: document.getElementById('vista-kanban').style.display !== 'none',
      btnAtivo: document.getElementById('btn-vista-kanban').classList.contains('ativo'),
      colunas: [...document.querySelectorAll('#vista-kanban .kb-coluna')].map(c => ({
        alvo: c.dataset.statusAlvo,
        contagemCabecalho: parseInt(c.querySelector('.kb-cont').textContent, 10),
        cards: c.querySelectorAll('.kb-card').length,
        cardsNaFaixaJanela: c.querySelectorAll('.kb-faixa-janela .kb-card').length,
      })),
      totalCards: document.querySelectorAll('#vista-kanban .kb-card').length,
      atrasadasComBorda: document.querySelectorAll('#vista-kanban .kb-card.kb-atrasada').length,
    })`));

    if (!estado.kanbanVisivel) erros.push("clicar em KANBAN não exibiu #vista-kanban");
    if (!estado.btnAtivo) erros.push('botão "Kanban" não ficou marcado como ativo');
    if (estado.colunas.length !== 3) erros.push(`esperava 3 colunas, veio ${estado.colunas.length}`);
    if (estado.totalCards !== esperado.total) {
      erros.push(`total de cards no board (${estado.totalCards}) não bate com o total de ações (${esperado.total})`);
    }

    const colNaoIniciado = estado.colunas.find((c) => c.alvo === "Não iniciado");
    const colEmAndamento = estado.colunas.find((c) => c.alvo === "Em andamento");
    const colConcluido = estado.colunas.find((c) => c.alvo === "Concluído");

    if (!colNaoIniciado || colNaoIniciado.cards !== esperado.naoIniciado) {
      erros.push(`coluna Não iniciado: ${colNaoIniciado ? colNaoIniciado.cards : "ausente"} cards, esperava ${esperado.naoIniciado}`);
    }
    if (!colNaoIniciado || colNaoIniciado.contagemCabecalho !== esperado.naoIniciado) {
      erros.push(`cabeçalho da coluna Não iniciado mostra ${colNaoIniciado ? colNaoIniciado.contagemCabecalho : "?"}, esperava ${esperado.naoIniciado}`);
    }
    if (!colEmAndamento || colEmAndamento.cards !== esperado.emAndamento) {
      erros.push(`coluna Em andamento: ${colEmAndamento ? colEmAndamento.cards : "ausente"} cards, esperava ${esperado.emAndamento}`);
    }
    if (!colConcluido || colConcluido.cards !== esperado.concluido) {
      erros.push(`coluna Concluído: ${colConcluido ? colConcluido.cards : "ausente"} cards, esperava ${esperado.concluido}`);
    }
    if (!colNaoIniciado || colNaoIniciado.cardsNaFaixaJanela !== esperado.janelaNaoIniciado) {
      erros.push(`faixa "em janela" da coluna Não iniciado: ${colNaoIniciado ? colNaoIniciado.cardsNaFaixaJanela : "?"} cards, esperava ${esperado.janelaNaoIniciado}`);
    }
    if (estado.atrasadasComBorda < 1) erros.push("nenhum card com a classe kb-atrasada (destaque de atrasada) apareceu — esperava pelo menos 1");

    // filtro existente (1.4): "Só atrasadas" também vale na visão Kanban
    await evaluate(`(function(){
      const sel = document.getElementById('f-status');
      sel.value = '__atrasadas';
      sel.dispatchEvent(new Event('change'));
    })()`);
    await esperar(150);
    const totalComFiltroAtrasadas = await evaluate("document.querySelectorAll('#vista-kanban .kb-card').length");
    const esperadoAtrasadas = JSON.parse(await evaluate(`JSON.stringify(window.DB.plano.filter(a => CALC.ehAtrasada(a, hojeISO())).length)`));
    if (totalComFiltroAtrasadas !== esperadoAtrasadas) {
      erros.push(`filtro "Só atrasadas" na visão Kanban: ${totalComFiltroAtrasadas} cards, esperava ${esperadoAtrasadas}`);
    }
    // volta o filtro pro estado neutro pra não vazar pro próximo assert (nenhum aqui, mas
    // por hábito de teste limpo)
    await evaluate(`(function(){ document.getElementById('f-status').value = ''; document.getElementById('f-status').dispatchEvent(new Event('change')); })()`);

    // troca de visão: Lista continua acessível e volta a ficar visível/ativa
    await evaluate("document.getElementById('btn-vista-lista').click()");
    await esperar(150);
    const voltouLista = await evaluate("document.getElementById('vista-lista').style.display !== 'none' && document.getElementById('btn-vista-lista').classList.contains('ativo')");
    if (!voltouLista) erros.push("voltar pro botão Lista não reativou a visão Lista");

    if (erros.length) {
      console.error("FALHOU kanban_contagem_por_coluna:");
      erros.forEach((e) => console.error(" -", e));
      process.exitCode = 1;
    } else {
      console.log(`kanban_contagem_por_coluna OK — Não iniciado: ${colNaoIniciado.cards} (${colNaoIniciado.cardsNaFaixaJanela} em janela) · Em andamento: ${colEmAndamento.cards} · Concluído: ${colConcluido.cards} · total ${estado.totalCards} · ${estado.atrasadasComBorda} atrasadas destacadas · filtro "Só atrasadas" bateu (${totalComFiltroAtrasadas}).`);
    }
  } finally {
    cdp.close();
    await encerrarChrome(proc);
    server.close();
    await limparPerfil(perfilTmp);
  }
}

principal().catch((err) => {
  console.error("ERRO:", err.message || err);
  process.exitCode = 1;
});
