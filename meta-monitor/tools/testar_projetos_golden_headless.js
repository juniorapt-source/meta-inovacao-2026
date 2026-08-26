/* Teste da leitura golden de núcleo/representantes em projetos.html — Camada 5, item
 * 5.9 (parte 2 da quebra em docs/PLANO_EXECUCAO_GOLDEN_RECORD.md).
 *
 * O item 5.5 já grava `nucleo_id` (meta_inovacao_projetos → meta_inovacao_nucleos) e o
 * item 4.1 já grava a junção projeto×pessoa (meta_inovacao_projeto_representantes) —
 * este item só faz projetos.html LER pelas duas FKs em vez do texto legado
 * `p.nucleo`/`p.representantes`, reaproveitando o mesmo padrão de "cai pro texto
 * quando a FK não resolve" que editor.html/js/drawer.js já usam desde 4.1/4.4/5.5.
 *
 * Cenários:
 *   1) offline (?semrede=1 + CC_FORCAR_FALLBACK): sem tabela golden pra ler (seed local
 *      não tem nucleo_id/db_id), a tela cai pro texto puro de sempre — coberto por
 *      tools/testar_projetos_headless.js, não repetido aqui.
 *   2) online (Supabase trocado por um dublê genérico de tabela — mesma técnica de
 *      tools/testar_projetos_editor_representantes_headless.js):
 *      - projeto com nucleo_id resolvido mostra o nome do núcleo golden (idêntico ao
 *        texto legado neste cenário, valida que a FK foi de fato consultada trocando o
 *        nome golden por um texto diferente do legado);
 *      - projeto com vínculo golden mostra o(s) representante(s) pela junção (nome
 *        golden, não o texto legado `representantes[]`, que aqui é propositalmente
 *        diferente pra provar que veio da FK);
 *      - projeto sem `nucleo_id`/vínculo (placeholder "Núcleo de X") continua no texto
 *        legado, sem quebrar.
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

/* ---------------------------------------------------------------- o dublê ---- */
// Tabela in-memory genérica, mesmo dublê de tools/testar_projetos_editor_representantes_headless.js.
const INTERCEPTOR = `
(function(){
  "use strict";
  function copia(o){ return JSON.parse(JSON.stringify(o)); }
  function tabelaMock(nome){ return (window.__MOCK.tabelas && window.__MOCK.tabelas[nome]) || []; }

  function executar(q){
    if (q.op === "select") {
      const linhas = tabelaMock(q.tabela).filter(function(r){ return !r.deleted_at; });
      return Promise.resolve({ data: copia(linhas), error: null });
    }
    return Promise.resolve({ data: [], error: null });
  }

  function query(tabela){
    const q = { tabela: tabela, op: "select" };
    const api = {
      select: function(){ q.op = "select"; return api; },
      is: function(){ return api; }, eq: function(){ return api; },
      order: function(){ return api; }, limit: function(){ return api; }, in: function(){ return api; },
      then: function(ok, erro){ return executar(q).then(ok, erro); }
    };
    return api;
  }

  const cliente = {
    from: query,
    channel: function(){ const ch = { on: function(){ return ch; }, subscribe: function(){ return ch; } }; return ch; }
  };

  let real = null;
  Object.defineProperty(window, "CC_SUPABASE", {
    configurable: true,
    get: function(){ return real; },
    set: function(v){
      real = v;
      real.obterClienteClassico = function(){ return cliente; };
      real.obterClienteEsm = function(){ return Promise.resolve(cliente); };
      real.clientePrincipal = function(){ return Promise.resolve(cliente); };
    }
  });
})();
`;

function cenario() {
  return {
    tabelas: {
      meta_inovacao_projetos: [
        // texto legado propositalmente DIFERENTE do golden, pra provar que a tela leu
        // pela FK e não caiu no texto por coincidência.
        { id: 101, nucleo: "Texto Legado A", nucleo_id: 701, iniciativa: "Alfa", representantes: ["Texto Legado Carol"], ordem: 1 },
        { id: 102, nucleo: "Núcleo de X", nucleo_id: null, iniciativa: "Beta", representantes: ["Núcleo de X"], ordem: 2 },
      ],
      meta_inovacao_nucleos: [
        { id: 701, nome: "Núcleo Golden A", ordem: 1 },
      ],
      meta_inovacao_pessoas: [
        { id: 501, nome: "Carol", nome_completo: "Carolina Souza", nome_exibicao: "Carol Golden", papel: null, grupo: "Projetos", nucleo: null, pendente: false, ordem: 1, email: null, ativo: true },
      ],
      meta_inovacao_projeto_representantes: [
        { id: 9001, projeto_id: 101, pessoa_id: 501, ordem: 1 },
      ],
    },
  };
}

async function principal() {
  const chromePath = acharChrome();
  const { server, port } = await iniciarServidor();
  const { proc, wsUrl, perfilTmp } = await iniciarChrome(chromePath);
  const cdp = await conectarCDP(wsUrl);
  const erros = [];
  const notas = [];

  function conferir(condicao, mensagem) { if (!condicao) erros.push(mensagem); }

  try {
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Runtime.enable", {}, sessionId);

    async function evaluate(expression) {
      const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId);
      if (r.exceptionDetails) throw new Error("erro avaliando no browser: " + JSON.stringify(r.exceptionDetails));
      return r.result.value;
    }

    const fonte = "window.__MOCK = " + JSON.stringify(cenario()) + ";\n" + INTERCEPTOR;
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: fonte }, sessionId);

    const carregou = cdp.once("Page.loadEventFired");
    await cdp.send("Page.navigate", { url: "http://127.0.0.1:" + port + "/projetos.html" }, sessionId);
    await carregou;
    await esperar(500);

    const html = await evaluate("document.getElementById('secoes').innerHTML");

    conferir(html.includes("Núcleo Golden A"), 'projeto com nucleo_id deveria mostrar o núcleo golden "Núcleo Golden A" — não achei no HTML');
    conferir(!html.includes("Texto Legado A"), 'projeto com nucleo_id NÃO deveria mostrar o texto legado "Texto Legado A" (prova que leu pela FK)');
    conferir(html.includes("Carol Golden"), 'projeto com vínculo deveria mostrar o representante golden "Carol Golden" (nome_exibicao) — não achei no HTML');
    conferir(!html.includes("Texto Legado Carol"), 'projeto com vínculo NÃO deveria mostrar o texto legado "Texto Legado Carol" (prova que leu pela junção)');
    conferir(html.includes("Núcleo de X"), 'projeto SEM nucleo_id/vínculo deveria continuar no texto legado "Núcleo de X" — não achei no HTML');
    notas.push('núcleo/representantes com FK/vínculo mostram o golden record; sem FK/vínculo continuam no texto legado');

    if (erros.length) {
      console.error("FALHOU projetos_golden_headless:");
      erros.forEach((e) => console.error(" -", e));
      process.exitCode = 1;
    } else {
      console.log("projetos_golden_headless OK — " + notas.join(" · ") + ".");
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
