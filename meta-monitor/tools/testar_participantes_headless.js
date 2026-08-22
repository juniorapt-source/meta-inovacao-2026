/* Teste F15: participantes_fallback — cobre o novo caminho de leitura de
 * participantes.html ("Correções v0.18.x": pessoas e URC saíram de data/pessoas.js/
 * data/urc.js direto pra Supabase, com fallback pros mesmos arquivos). Sem teste
 * nenhum até esta rodada (0% de cobertura antes) — este é o primeiro.
 *
 * Abre com ?semrede=1 (mesmo mecanismo de sempre — window.CC_FORCAR_FALLBACK também
 * injetado por segurança) pra exercitar o caminho de FALLBACK de forma determinística,
 * sem depender de as tabelas meta_inovacao_pessoas/meta_inovacao_urc_lideranca/
 * meta_inovacao_urc_canais_responsaveis já existirem em produção (podem não existir
 * ainda — o SQL desta rodada não foi executado por mim). Confere: aviso de dados
 * locais aparece, contagem de cards de grupo bate com os grupos reais de
 * window.DB.pessoas + 1 (URC), pendências e o card da URC (liderança + canais)
 * renderizam com as contagens certas.
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
    await cdp.send("Page.navigate", { url: "http://127.0.0.1:" + port + "/participantes.html?semrede=1" }, sessionId);
    await carregou;
    await esperar(400);

    const erros = [];

    // fonte de verdade: os mesmos seeds locais (data/pessoas.js/data/urc.js) que o
    // fallback usa — em modo de teste é exatamente isso que a página está mostrando.
    const esperado = JSON.parse(await evaluate(`JSON.stringify((function(){
      // mesmo filtro de participantes.html: a Camada 1 do golden record de pessoas
      // acrescentou grupos "Projetos"/"URC" a window.DB.pessoas que não ganham card
      // próprio nesta página (ver comentário em participantes.html).
      const GRUPOS_NESTA_PAGINA = new Set(["UI", "Comitê", "Núcleos"]);
      const grupos = [...new Set(window.DB.pessoas.map(p => p.grupo))].filter(g => GRUPOS_NESTA_PAGINA.has(g));
      return {
        totalCards: grupos.length + 1, // +1 = card fixo da URC
        pendentes: window.DB.pessoas.filter(p => p.pendente).length,
        liderancaCount: (window.DB.urc_lideranca || []).length,
        canaisCount: (window.DB.urc_canais || []).length,
        responsaveisCount: (window.DB.urc_canais || []).reduce((n, c) => n + (c.responsaveis || []).length, 0),
      };
    })())`));

    const estado = JSON.parse(await evaluate(`JSON.stringify({
      avisoVisivel: !document.getElementById('aviso-fallback').hidden,
      cards: document.querySelectorAll('#pessoas > section.card').length,
      pendenciasTexto: (document.querySelector('#pendencias .aviso') || {}).textContent || null,
      responsaveisChips: (function(){
        const urcCard = [...document.querySelectorAll('#pessoas section.card')].find(el => (el.querySelector('h3')||{}).textContent === 'URC');
        return urcCard ? urcCard.querySelectorAll('.chip.pessoa').length : -1;
      })(),
    })`));

    if (!estado.avisoVisivel) erros.push('aviso de "dados locais" não apareceu com ?semrede=1');
    if (estado.cards !== esperado.totalCards) {
      erros.push(`nº de cards de grupo (${estado.cards}) não bate com grupos de DB.pessoas + URC (${esperado.totalCards})`);
    }
    if (esperado.pendentes > 0 && !estado.pendenciasTexto) {
      erros.push(`DB.pessoas tem ${esperado.pendentes} pendente(s), mas o aviso de pendências não apareceu`);
    }
    if (esperado.pendentes > 0 && estado.pendenciasTexto && !estado.pendenciasTexto.includes(String(esperado.pendentes))) {
      erros.push(`aviso de pendências não menciona o número certo (${esperado.pendentes}): "${estado.pendenciasTexto}"`);
    }
    if (estado.responsaveisChips !== esperado.responsaveisCount) {
      erros.push(`chips de responsável por canal na URC (${estado.responsaveisChips}) não bate com DB.urc_canais (${esperado.responsaveisCount})`);
    }

    if (erros.length) {
      console.error("FALHOU participantes_fallback:");
      erros.forEach((e) => console.error(" -", e));
      process.exitCode = 1;
    } else {
      console.log(`participantes_fallback OK — ${estado.cards} cards de grupo (inclui URC), ${esperado.pendentes} pendência(s), ${estado.responsaveisChips} responsáveis de canal renderizados.`);
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
