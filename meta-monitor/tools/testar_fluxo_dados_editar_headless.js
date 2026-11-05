/* Teste do botão "Editar" nos cartões de fluxo-dados.html (05/11/2026).
 *
 * Até aqui a página só criava (Nova rota / Novo painel / Novo encaminhamento); editar um
 * registro existente exigia ir à aba "Fluxo de dados" do editor.html. Cenários:
 *   1) offline (CC_FORCAR_FALLBACK): sem "Ativar edição" não há botão "Editar"; com ele, os
 *      botões aparecem desabilitados e nada é gravado.
 *   2) online (dublê de Supabase in-memory semeado com data/fluxo_dados.js):
 *      - um "Editar" por rota, painel e encaminhamento;
 *      - "Editar" de uma rota abre "Editar rota" já preenchido; Salvar faz UPDATE (não INSERT)
 *        naquela rota, com o campo alterado, e o cartão mostra o valor novo;
 *      - o mesmo para um encaminhamento;
 *      - "Sair da edição" some com os botões.
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

// Tabela in-memory: select com filtros eq; insert dá id; update/delete casam pelos eq.
// As views (matriz, rotas_lacunas, paineis_prontidao) são devolvidas como estão no snapshot
// — o dublê não as recalcula; o cartão de rota mostra "quem envia" vindo da view, então o
// teste atualiza a view junto no update da rota (ver ESPELHO_VIEW).
const INTERCEPTOR = `
(function(){
  "use strict";
  window.__ESCRITAS = [];
  function copia(o){ return JSON.parse(JSON.stringify(o)); }
  function tab(nome){ return window.__MOCK.tabelas[nome] || (window.__MOCK.tabelas[nome] = []); }
  function casa(r, eqs){ return eqs.every(function(e){ return String(r[e[0]]) === String(e[1]); }); }

  function executar(q){
    const alvo = tab(q.tabela);
    if (q.op === "select") return Promise.resolve({ data: copia(alvo.filter(function(r){ return casa(r, q.eqs); })), error: null });
    if (q.op === "insert") {
      const linhas = Array.isArray(q.payload) ? q.payload : [q.payload];
      const novas = linhas.map(function(p){ window.__MOCK.proximoId++; const n = Object.assign({ id: "mock-" + window.__MOCK.proximoId, ativo: true }, p); alvo.push(n); return n; });
      window.__ESCRITAS.push({ tabela: q.tabela, op: "insert", payload: copia(q.payload) });
      return Promise.resolve({ data: q.single ? copia(novas[0]) : copia(novas), error: null });
    }
    if (q.op === "update") {
      const linhas = alvo.filter(function(r){ return casa(r, q.eqs); });
      if (!linhas.length) return Promise.resolve({ data: null, error: { message: "not found: " + q.tabela } });
      linhas.forEach(function(l){ Object.assign(l, q.payload); });
      const espelho = window.__MOCK.espelho[q.tabela];
      if (espelho) linhas.forEach(function(l){ tab(espelho).filter(function(v){ return v.id === l.id; }).forEach(function(v){ Object.keys(q.payload).forEach(function(k){ if (k in v) v[k] = q.payload[k]; }); }); });
      window.__ESCRITAS.push({ tabela: q.tabela, op: "update", eqs: q.eqs, payload: copia(q.payload) });
      return Promise.resolve({ data: q.single ? copia(linhas[0]) : copia(linhas), error: null });
    }
    if (q.op === "delete") {
      window.__MOCK.tabelas[q.tabela] = alvo.filter(function(r){ return !casa(r, q.eqs); });
      window.__ESCRITAS.push({ tabela: q.tabela, op: "delete", eqs: q.eqs });
      return Promise.resolve({ data: null, error: null });
    }
    return Promise.resolve({ data: [], error: null });
  }

  function query(tabela){
    const q = { tabela: tabela, op: "select", payload: null, eqs: [], single: false };
    const api = {
      select: function(){ return api; },
      is: function(){ return api; }, eq: function(c, v){ q.eqs.push([c, v]); return api; },
      order: function(){ return api; }, limit: function(){ return api; }, in: function(){ return api; },
      insert: function(p){ q.op = "insert"; q.payload = p; return api; },
      update: function(p){ q.op = "update"; q.payload = p; return api; },
      delete: function(){ q.op = "delete"; return api; },
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

function cenarioBase() {
  global.window = global; global.window.DB = global.window.DB || {};
  require(path.join(REPO, "data", "fluxo_dados.js"));
  const S = JSON.parse(JSON.stringify(global.window.DB.fluxo_dados));
  const T = { sistemas: "fluxo_dados_sistemas", rotas: "fluxo_dados_rotas", paineis: "fluxo_dados_paineis", painel_rotas: "fluxo_dados_painel_rotas",
    encaminhamentos: "fluxo_dados_encaminhamentos", rota_destinos: "fluxo_dados_rota_destinos", matriz: "fluxo_dados_matriz",
    rotas_lacunas: "fluxo_dados_rotas_lacunas", paineis_prontidao: "fluxo_dados_paineis_prontidao" };
  const tabelas = {};
  Object.keys(T).forEach((k) => { tabelas[T[k]] = S[k] || []; });
  return { proximoId: 100, tabelas, espelho: { fluxo_dados_rotas: "fluxo_dados_rotas_lacunas" }, S };
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
    async function abrir(mock) {
      if (scriptId) { await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: scriptId }, sessionId); scriptId = null; }
      const fonte = "try { sessionStorage.removeItem('cc_fluxo_edicao'); } catch (e) {}\n"
        + (mock ? "window.__MOCK = " + JSON.stringify(mock) + ";\n" + INTERCEPTOR : "window.CC_FORCAR_FALLBACK = true;");
      const r = await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: fonte }, sessionId);
      scriptId = r.identifier;
      const carregou = cdp.once("Page.loadEventFired");
      await cdp.send("Page.navigate", { url: "http://127.0.0.1:" + port + "/fluxo-dados.html" }, sessionId);
      await carregou;
      await esperar(600);
    }
    const clicar = (sel) => evaluate(`document.querySelector(${JSON.stringify(sel)}).click()`).then(() => esperar(500));
    const botoes = () => ler(`[...document.querySelectorAll('.fd-editar')].map(b => ({ secao: b.dataset.fdSecao, id: b.dataset.fdId, desab: b.disabled }))`);
    const escritas = (tabela) => ler(`window.__ESCRITAS.filter(e => e.tabela === ${JSON.stringify(tabela)})`);

    /* ---- 1) offline ---- */
    await abrir(null);
    conferir((await botoes()).length === 0, "offline: sem 'Ativar edição' não deveria haver botão Editar");
    await clicar("#fd-ed-ligar");
    const bOff = await botoes();
    conferir(bOff.length > 0 && bOff.every((b) => b.desab), "offline: com edição ligada os botões Editar deveriam aparecer desabilitados — veio " + JSON.stringify(bOff));
    notas.push("offline: Editar só com edição ligada, e desabilitado");

    /* ---- 2) online ---- */
    const mock = cenarioBase();
    const S = mock.S; delete mock.S;
    await abrir(mock);
    conferir((await botoes()).length === 0, "online: sem 'Ativar edição' não deveria haver botão Editar");
    await clicar("#fd-ed-ligar");
    const bOn = await botoes();
    const conta = (s) => bOn.filter((b) => b.secao === s && !b.desab).length;
    conferir(conta("rotas") === S.rotas_lacunas.length && conta("paineis") === S.paineis_prontidao.length && conta("encaminhamentos") === S.encaminhamentos.filter((e) => e.ativo !== false).length,
      "online: deveria haver um Editar habilitado por cartão — veio " + JSON.stringify(bOn));

    // editar rota
    const rota = S.rotas.find((r) => r.id === "42d89ce1-6779-4f3d-822e-4ed8a048ee2f");
    await clicar(`.fd-editar[data-fd-secao="rotas"][data-fd-id="${rota.id}"]`);
    const form = await ler(`({ titulo: (document.querySelector('#fd-form h2') || {}).textContent, envia: (document.getElementById('fx-quem_envia_hoje') || {}).value, desc: (document.getElementById('fx-descricao') || {}).value })`);
    conferir(form.titulo === "Editar rota", "rota: título deveria ser 'Editar rota' — veio " + JSON.stringify(form.titulo));
    conferir(form.envia === rota.quem_envia_hoje && form.desc === rota.descricao, "rota: formulário deveria vir preenchido — veio " + JSON.stringify(form));
    await evaluate(`document.getElementById('fx-quem_deveria_enviar').value = 'Equipe do Prêmio (teste)'`);
    await clicar("#fx-form button[type=submit]");
    await esperar(300);
    const wr = await escritas("fluxo_dados_rotas");
    conferir(wr.length === 1 && wr[0].op === "update" && JSON.stringify(wr[0].eqs) === JSON.stringify([["id", rota.id]]) && wr[0].payload.quem_deveria_enviar === "Equipe do Prêmio (teste)"
      && wr[0].payload.descricao === rota.descricao,
      "rota: deveria haver 1 UPDATE na rota editada com o campo novo — veio " + JSON.stringify(wr));
    const msg = await ler(`(document.querySelector('#fd-msg .fx-msg') || {}).textContent`);
    conferir(msg === "Salvo.", "rota: mensagem deveria ser 'Salvo.' — veio " + JSON.stringify(msg));
    const cartao = await ler(`document.getElementById('fd-rotas').textContent.includes('Equipe do Prêmio (teste)')`);
    conferir(cartao, "rota: o cartão deveria mostrar o valor novo depois de salvar");
    conferir(await ler(`document.getElementById('fd-form').innerHTML === ''`), "rota: o formulário deveria fechar depois de salvar");
    notas.push("rota: Editar abre preenchido e Salvar faz UPDATE");

    // editar encaminhamento
    const enc = S.encaminhamentos.find((e) => e.ativo !== false);
    await clicar(`.fd-editar[data-fd-secao="encaminhamentos"][data-fd-id="${enc.id}"]`);
    const tEnc = await ler(`(document.querySelector('#fd-form h2') || {}).textContent`);
    conferir(tEnc === "Editar encaminhamento", "encaminhamento: título inesperado — " + JSON.stringify(tEnc));
    conferir(await ler(`document.getElementById('fx-acao').value`) === enc.acao, "encaminhamento: ação deveria vir preenchida");
    await evaluate(`document.getElementById('fx-responsavel').value = 'Fulana (teste)'`);
    await clicar("#fx-form button[type=submit]");
    await esperar(300);
    const we = await escritas("fluxo_dados_encaminhamentos");
    conferir(we.length === 1 && we[0].op === "update" && JSON.stringify(we[0].eqs) === JSON.stringify([["id", enc.id]]) && we[0].payload.responsavel === "Fulana (teste)",
      "encaminhamento: deveria haver 1 UPDATE — veio " + JSON.stringify(we));
    conferir(await ler(`document.getElementById('fd-enc').textContent.includes('Fulana (teste)')`), "encaminhamento: cartão deveria mostrar o responsável novo");
    notas.push("encaminhamento: idem");

    // painel: só confere que abre preenchido
    const pai = S.paineis.find((p) => p.ativo !== false);
    await clicar(`.fd-editar[data-fd-secao="paineis"][data-fd-id="${pai.id}"]`);
    const fp = await ler(`({ t: (document.querySelector('#fd-form h2') || {}).textContent, nome: (document.getElementById('fx-nome') || {}).value })`);
    conferir(fp.t === "Editar painel" && fp.nome === pai.nome, "painel: deveria abrir 'Editar painel' preenchido — veio " + JSON.stringify(fp));
    await clicar("#fx-cancelar");
    conferir((await ler(`window.__ESCRITAS.filter(e => e.op === 'insert').length`)) === 0, "nenhum INSERT deveria acontecer ao editar");

    await clicar("#fd-ed-desligar");
    conferir((await botoes()).length === 0, "'Sair da edição' deveria esconder os botões Editar");
    notas.push("painel abre preenchido · sem INSERT · Sair da edição esconde os botões");

    if (erros.length) {
      console.error("FALHOU fluxo_dados_editar_headless:");
      erros.forEach((e) => console.error(" -", e));
      process.exitCode = 1;
    } else {
      console.log("fluxo_dados_editar_headless OK — " + notas.join(" · ") + ".");
    }
  } finally {
    cdp.close();
    await encerrarChrome(proc);
    server.close();
    await limparPerfil(perfilTmp);
  }
}

principal().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
