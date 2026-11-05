/* Teste do "+ Nova pessoa" da aba "Pessoas" do editor.html (05/11/2026).
 *
 * Até aqui a aba só editava linhas existentes — não havia como cadastrar pessoa nova
 * pelo site. Cenários:
 *   1) offline (?semrede=1 + CC_FORCAR_FALLBACK): botão desabilitado, nenhuma escrita.
 *   2) online (dublê de Supabase in-memory, mesma técnica de
 *      tools/testar_projetos_editor_representantes_headless.js):
 *      - "Adicionar" sem nome/grupo marca os campos e não grava nada;
 *      - nome+grupo já existentes é recusado (alert) sem gravar;
 *      - criação válida grava em meta_inovacao_pessoas e a linha aparece na tabela.
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

// Tabela in-memory genérica: select devolve tudo que não está com deleted_at
// preenchido; insert dá um id sequencial; update casa por `eq("id", ...)`. Não tem
// a particularidade de upsert-por-par da matriz (tools/testar_matriz_headless.js)
// porque nenhuma das duas tabelas deste item precisa disso — DB_PROJETOS.salvar/
// DB_PROJETO_REPRESENTANTES.criar/removerSoft usam só select/insert/update simples.
const INTERCEPTOR = `
(function(){
  "use strict";
  window.__ESCRITAS = [];
  function copia(o){ return JSON.parse(JSON.stringify(o)); }
  function tabelaMock(nome){ return (window.__MOCK.tabelas && window.__MOCK.tabelas[nome]) || []; }

  function executar(q){
    if (q.op === "select") {
      const linhas = tabelaMock(q.tabela).filter(function(r){ return !r.deleted_at; });
      return Promise.resolve({ data: copia(linhas), error: null });
    }
    if (q.op === "insert") {
      const alvo = window.__MOCK.tabelas[q.tabela] || (window.__MOCK.tabelas[q.tabela] = []);
      window.__MOCK.proximoId = (window.__MOCK.proximoId || 9000) + 1;
      const nova = Object.assign({ id: window.__MOCK.proximoId }, q.payload);
      alvo.push(nova);
      window.__ESCRITAS.push({ tabela: q.tabela, op: "insert", payload: copia(q.payload) });
      const devolvido = copia(nova);
      return Promise.resolve({ data: q.single ? devolvido : [devolvido], error: null });
    }
    if (q.op === "update") {
      const alvo = window.__MOCK.tabelas[q.tabela] || [];
      const linha = alvo.find(function(r){ return String(r.id) === String(q.eqId); });
      if (!linha) return Promise.resolve({ data: null, error: { message: "not found: " + q.tabela + "#" + q.eqId } });
      Object.assign(linha, q.payload);
      window.__ESCRITAS.push({ tabela: q.tabela, op: "update", eqId: q.eqId, payload: copia(q.payload) });
      const devolvido = copia(linha);
      return Promise.resolve({ data: q.single ? devolvido : [devolvido], error: null });
    }
    return Promise.resolve({ data: [], error: null });
  }

  function query(tabela){
    const q = { tabela: tabela, op: "select", payload: null, eqId: null, single: false };
    const api = {
      select: function(){ if (q.op !== "insert" && q.op !== "update") q.op = "select"; return api; },
      is: function(){ return api; }, eq: function(campo, val){ if (campo === "id") q.eqId = val; return api; },
      order: function(){ return api; }, limit: function(){ return api; }, in: function(){ return api; },
      insert: function(p){ q.op = "insert"; q.payload = p; return api; },
      update: function(p){ q.op = "update"; q.payload = p; return api; },
      single: function(){ q.single = true; return api; },
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

// só de teste: window.confirm sempre "sim" — sem isso, o clique em "remover
// representante" ficaria pendurado esperando um diálogo nativo que o Chrome
// headless nunca resolve sozinho. Nenhum código de produção lê essa variável.
const AUTO_CONFIRMAR = `window.confirm = function(){ return true; };`;

function cenarioBase() {
  return {
    proximoId: 20000,
    tabelas: {
      meta_inovacao_pessoas: [
        { id: 501, nome: "Carol", nome_completo: null, nome_exibicao: null, papel: null, grupo: "Projetos", nucleo: null, pendente: false, ordem: 1, email: null, ativo: true },
        { id: 502, nome: "Matheus", nome_completo: "Matheus Souza", nome_exibicao: null, papel: null, grupo: "Comitê", nucleo: null, pendente: false, ordem: 7, email: null, ativo: true },
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
    const ler = async (expr) => JSON.parse(await evaluate("JSON.stringify(" + expr + ")"));

    let scriptId = null;
    async function abrir(mock, querystring) {
      if (scriptId) { await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: scriptId }, sessionId); scriptId = null; }
      const fonte = (mock ? "window.__MOCK = " + JSON.stringify(mock) + ";\n" + INTERCEPTOR : "window.CC_FORCAR_FALLBACK = true;") +
        "\nwindow.__ALERTAS = []; window.alert = function(m){ window.__ALERTAS.push(String(m)); };";
      const r = await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: fonte }, sessionId);
      scriptId = r.identifier;
      const carregou = cdp.once("Page.loadEventFired");
      await cdp.send("Page.navigate", { url: "http://127.0.0.1:" + port + "/editor.html" + (querystring || "") }, sessionId);
      await carregou;
      await esperar(400);
    }
    async function selecionarPessoas() {
      await evaluate(`(function(){
        const sel = document.getElementById('ed-conjunto');
        sel.value = 'pessoas';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      })()`);
      await esperar(500);
    }
    const clicar = (id) => evaluate(`document.getElementById('${id}').click()`).then(() => esperar(400));
    const preencher = (campos) => evaluate(`(function(c){ Object.keys(c).forEach(function(id){ document.getElementById(id).value = c[id]; }); })(${JSON.stringify(campos)})`);
    const nomesNaTabela = () => ler(`[...document.querySelectorAll('#ed-area tbody tr [data-f="nome"]')].map(i => i.value)`);
    const insertsPessoas = () => ler(`window.__ESCRITAS.filter(e => e.tabela === 'meta_inovacao_pessoas' && e.op === 'insert')`);

    /* ---- 1) offline ---- */
    await abrir(null, "?semrede=1");
    await selecionarPessoas();
    const btnOff = await ler(`(function(){ const b = document.getElementById('ed-abrir-nova-pessoa'); return b ? { existe: true, desabilitado: b.disabled } : { existe: false }; })()`);
    conferir(btnOff.existe && btnOff.desabilitado, "offline: o botão \"+ Nova pessoa\" deveria existir e estar desabilitado — veio " + JSON.stringify(btnOff));
    notas.push("offline: botão desabilitado");

    /* ---- 2) online ---- */
    await abrir(cenarioBase());
    await selecionarPessoas();
    await clicar("ed-abrir-nova-pessoa");
    const formVisivel = await ler(`getComputedStyle(document.getElementById('ed-form-nova-pessoa')).display !== 'none'`);
    conferir(formVisivel, "online: o formulário de nova pessoa deveria abrir ao clicar no botão");

    // vazio: marca erro, não grava
    await clicar("ed-confirmar-nova-pessoa");
    const errosCampos = await ler(`[...document.querySelectorAll('#ed-form-nova-pessoa .ed-campo-erro')].map(e => e.dataset.campo)`);
    conferir(JSON.stringify(errosCampos.sort()) === JSON.stringify(["grupo", "nome"]), "vazio: deveria marcar nome e grupo como erro — veio " + JSON.stringify(errosCampos));
    conferir((await insertsPessoas()).length === 0, "vazio: não deveria gravar nada");

    // duplicata nome+grupo
    await preencher({ "nvpe-nome": "carol", "nvpe-grupo": "Projetos" });
    await clicar("ed-confirmar-nova-pessoa");
    const alertas = await ler("window.__ALERTAS");
    conferir(alertas.length === 1 && alertas[0].indexOf("Já existe") >= 0, "duplicata: deveria avisar que já existe — veio " + JSON.stringify(alertas));
    conferir((await insertsPessoas()).length === 0, "duplicata: não deveria gravar nada");
    notas.push("validação: campos obrigatórios e duplicata nome+grupo");

    // mesmo nome em outro grupo é permitido; criação válida
    await preencher({ "nvpe-nome": "Carol", "nvpe-grupo": "Núcleos", "nvpe-nome-completo": "Carolina Teste", "nvpe-email": "carol@exemplo.org" });
    await clicar("ed-confirmar-nova-pessoa");
    await esperar(300);
    const ins = await insertsPessoas();
    conferir(ins.length === 1, "criar: deveria gravar 1 linha em meta_inovacao_pessoas — veio " + JSON.stringify(ins));
    const p = (ins[0] || {}).payload || {};
    conferir(p.nome === "Carol" && p.grupo === "Núcleos" && p.nome_completo === "Carolina Teste" && p.email === "carol@exemplo.org" && p.ativo === true && p.pendente === false && p.ordem === 8 && p.nome_exibicao === null,
      "criar: payload inesperado — veio " + JSON.stringify(p));
    const nomes = await nomesNaTabela();
    conferir(nomes.filter(n => n === "Carol").length === 2, "criar: a linha nova deveria aparecer na tabela — nomes: " + JSON.stringify(nomes));
    const formFechado = await ler(`getComputedStyle(document.getElementById('ed-form-nova-pessoa')).display === 'none'`);
    conferir(formFechado, "criar: o formulário deveria fechar depois de adicionar");
    notas.push("criação grava em meta_inovacao_pessoas e a linha aparece na tabela");

    if (erros.length) {
      console.error("FALHOU pessoas_editor_nova_headless:");
      erros.forEach((e) => console.error(" -", e));
      process.exitCode = 1;
    } else {
      console.log("pessoas_editor_nova_headless OK — " + notas.join(" · ") + ".");
    }
  } finally {
    cdp.close();
    await encerrarChrome(proc);
    server.close();
    await limparPerfil(perfilTmp);
  }
}

principal().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
