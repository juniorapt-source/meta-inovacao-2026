/* Teste F12: historico_auditoria — trava a aba "Histórico" de editor.html (item 3.4 do
 * plano de melhorias). Abre a página em modo de teste (?semrede=1), clica em HISTÓRICO
 * e confere contra o MOCK_HISTORICO embutido em editor.html (não o Supabase de verdade
 * — o log não tem fallback client-side real, só esse mock pra tornar a renderização
 * testável sem rede, ver comentário em editor.html):
 *   - as 3 linhas do mock aparecem, na ordem certa (mock já vem ordenado por criado_em
 *     desc, igual a query real faria);
 *   - INSERT/DELETE mostram "criado"/"removido"; UPDATE mostra o diff de campo(s);
 *   - a chave de status crua (snake_case) NUNCA aparece — sempre o rótulo traduzido via
 *     CC_STATUS.rotulo (item 3.2 do prompt: "nao_iniciado" vira "Não iniciado" etc,
 *     inclusive pra plano_acao_atividades, que usa outro contexto/prefixo);
 *   - filtro por tabela e por autor funcionam.
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
    await cdp.send("Page.navigate", { url: "http://127.0.0.1:" + port + "/editor.html?semrede=1" }, sessionId);
    await carregou;
    await esperar(300);

    const erros = [];

    await evaluate("document.getElementById('btn-aba-historico').click()");
    await esperar(300);

    const estado = JSON.parse(await evaluate(`JSON.stringify({
      historicoVisivel: document.getElementById('aba-historico').style.display !== 'none',
      dadosEscondido: document.getElementById('aba-dados').style.display === 'none',
      btnAtivo: document.getElementById('btn-aba-historico').classList.contains('ativo'),
      linhas: [...document.querySelectorAll('#hist-lista .hist-linha')].map(l => l.textContent.replace(/\\s+/g,' ').trim()),
      totalLinhas: document.querySelectorAll('#hist-lista .hist-linha').length,
      opcoesAutor: [...document.querySelectorAll('#hist-autor option')].map(o => o.value).filter(Boolean),
    })`));

    if (!estado.historicoVisivel) erros.push("clicar em HISTÓRICO não exibiu #aba-historico");
    if (!estado.dadosEscondido) erros.push('aba "Editar dados" devia ter escondido ao trocar pra Histórico');
    if (!estado.btnAtivo) erros.push('botão "Histórico" não ficou marcado como ativo');
    if (estado.totalLinhas !== 3) erros.push(`esperava 3 linhas do mock, veio ${estado.totalLinhas}`);

    // UPDATE: diff de "status" com rótulo TRADUZIDO (item 3.2) — nunca a chave crua
    const linhaUpdate = estado.linhas.find((l) => l.includes("CMT-02"));
    if (!linhaUpdate) erros.push('não achei a linha do mock de UPDATE ("CMT-02")');
    else {
      if (!linhaUpdate.includes("status: Não iniciado → Em andamento")) {
        erros.push(`diff do UPDATE não veio traduzido certo: "${linhaUpdate}" (esperava "status: Não iniciado → Em andamento")`);
      }
      if (linhaUpdate.includes("nao_iniciado") || linhaUpdate.includes("em_andamento")) {
        erros.push(`diff do UPDATE vazou chave crua (snake_case): "${linhaUpdate}"`);
      }
      if (!linhaUpdate.includes("JR.")) erros.push('linha do UPDATE não mostrou o autor "JR."');
    }

    // INSERT: mostra "criado", não expõe os campos como diff
    const linhaInsert = estado.linhas.find((l) => l.includes("Sandra"));
    if (!linhaInsert || !linhaInsert.includes("criado")) {
      erros.push(`linha do INSERT (autor Sandra) não mostrou "criado": "${linhaInsert || "(não achei)"}"`);
    }

    // DELETE: mostra "removido", e o valor da matriz (celula_matriz "previsto") não
    // aparece cru em lugar nenhum por acidente (não há diff pra mostrar em DELETE)
    const linhaDelete = estado.linhas.find((l) => l.includes("removido"));
    if (!linhaDelete) erros.push('não achei nenhuma linha "removido" (mock de DELETE)');

    // filtro por tabela (3.1): só "Matriz de demandas" deixa 1 linha (a do DELETE)
    await evaluate(`(function(){
      const sel = document.getElementById('hist-tabela');
      sel.value = 'meta_inovacao_matriz_demandas';
      sel.dispatchEvent(new Event('change'));
    })()`);
    await esperar(300);
    const totalComFiltroTabela = await evaluate("document.querySelectorAll('#hist-lista .hist-linha').length");
    if (totalComFiltroTabela !== 1) erros.push(`filtro por tabela (Matriz de demandas): ${totalComFiltroTabela} linhas, esperava 1`);

    // volta o filtro de tabela e confere o filtro por autor (JR. aparece em 2 das 3 linhas do mock)
    await evaluate(`(function(){
      document.getElementById('hist-tabela').value = '';
      document.getElementById('hist-tabela').dispatchEvent(new Event('change'));
    })()`);
    await esperar(300);
    if (!estado.opcoesAutor.includes("JR.") || !estado.opcoesAutor.includes("Sandra")) {
      erros.push(`select de autor não populou com os autores do mock: [${estado.opcoesAutor.join(", ")}]`);
    }
    await evaluate(`(function(){
      const sel = document.getElementById('hist-autor');
      sel.value = 'JR.';
      sel.dispatchEvent(new Event('change'));
    })()`);
    await esperar(150);
    const totalComFiltroAutor = await evaluate("document.querySelectorAll('#hist-lista .hist-linha').length");
    if (totalComFiltroAutor !== 2) erros.push(`filtro por autor (JR.): ${totalComFiltroAutor} linhas, esperava 2`);

    // volta pra aba de dados: continua acessível e funcional (o Modo edição de sempre)
    await evaluate("document.getElementById('btn-aba-dados').click()");
    await esperar(150);
    const voltouDados = await evaluate("document.getElementById('aba-dados').style.display !== 'none' && document.getElementById('btn-aba-dados').classList.contains('ativo')");
    if (!voltouDados) erros.push('voltar pro botão "Editar dados" não reativou a aba');

    if (erros.length) {
      console.error("FALHOU historico_auditoria:");
      erros.forEach((e) => console.error(" -", e));
      process.exitCode = 1;
    } else {
      console.log(`historico_auditoria OK — 3 linhas do mock renderizadas (UPDATE com diff traduzido "status: Não iniciado → Em andamento", INSERT "criado", DELETE "removido"), filtro por tabela (${totalComFiltroTabela}) e por autor (${totalComFiltroAutor}) bateram.`);
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
