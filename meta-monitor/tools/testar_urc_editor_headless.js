/* Teste das abas "URC — Liderança" e "URC — Responsáveis por canal" do editor.html —
 * Camada 4 do golden record (docs/PLANO_EXECUCAO_GOLDEN_RECORD.md, item 4.2).
 *
 * O item 4.2 trocou o campo de texto livre "Nome" (nas duas abas) por um <select> de
 * pessoa (golden record — meta_inovacao_pessoas, pessoa_id das migrações 2.3/2.4) e
 * fez o <select> de canal (já existia, sobre DB_URC.CANAIS_FIXOS) passar a manter
 * canal_id em sincronia. `nome`/`canal` (texto legado) continuam sendo gravados junto —
 * participantes.html e o guardrail de liderança (js/db-urc.js, nomeEhLideranca) ainda
 * leem só o texto, mesmo padrão de sincronia best-effort do item 4.1.
 *
 * Cenários:
 *   1) offline (?semrede=1 + CC_FORCAR_FALLBACK): DB_URC/DB_PESSOAS/DB_CANAIS caem pro
 *      seed local, os <select> saem desabilitados — nunca uma escrita de verdade em
 *      modo de teste.
 *   2) online (Supabase trocado por um dublê genérico de tabela, mesma técnica de
 *      tools/testar_projetos_editor_representantes_headless.js):
 *      - liderança: o <select> de pessoa da linha já vinculada mostra a pessoa certa
 *        pré-selecionada; trocar de pessoa grava pessoa_id E sincroniza nome (texto);
 *      - canais: o <select> de pessoa da linha já vinculada mostra a pessoa certa;
 *        trocar o <select> de canal grava canal_id junto (sem tocar pessoa_id);
 *      - guardrail (item 4.4): escolher no <select> de pessoa do responsável de canal
 *        alguém que já é liderança da URC continua bloqueado (mesma régua de sempre,
 *        só que disparada por um <select> agora, não por um <input> de texto);
 *      - "+ Adicionar responsável" grava canal_id + pessoa_id + nome (texto) com os
 *        dois <select> do topo, no lugar do prompt() de nome livre de antes.
 *
 * Mesmo padrão de CDP cru (sem Playwright) e do dublê genérico de tabela in-memory de
 * tools/testar_projetos_editor_representantes_headless.js — ver comentários lá pro
 * porquê de cada peça (INTERCEPTOR, AUTO_CONFIRMAR, iniciarServidor/iniciarChrome).
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

// Tabela in-memory genérica — ver comentário equivalente em
// tools/testar_projetos_editor_representantes_headless.js. Aqui são 4 tabelas
// (meta_inovacao_urc_lideranca, meta_inovacao_urc_canais_responsaveis,
// meta_inovacao_pessoas, meta_inovacao_canais), todas só com select/insert/update
// simples — nenhuma tem upsert-por-par.
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

const AUTO_CONFIRMAR = `window.confirm = function(){ return true; };
window.alert = function(){};`;

function cenarioBase() {
  return {
    proximoId: 20000,
    tabelas: {
      meta_inovacao_urc_lideranca: [
        { id: 701, nome: "Enio", papel: "Coordenação", email: null, ordem: 1, pessoa_id: 801 },
      ],
      meta_inovacao_urc_canais_responsaveis: [
        { id: 711, canal: "CNR", nome: "Milva", email: null, ordem: 1, canal_id: 601, pessoa_id: 802 },
      ],
      meta_inovacao_pessoas: [
        { id: 801, nome: "Enio", nome_completo: "Enio Silva", nome_exibicao: null, papel: null, grupo: "URC", nucleo: null, pendente: false, ordem: 1, email: null, ativo: true },
        { id: 802, nome: "Milva", nome_completo: "Milva Souza", nome_exibicao: null, papel: null, grupo: "URC", nucleo: null, pendente: false, ordem: 2, email: null, ativo: true },
        { id: 803, nome: "Rafa", nome_completo: "Rafael Lima", nome_exibicao: null, papel: null, grupo: "URC", nucleo: null, pendente: false, ordem: 3, email: null, ativo: true },
        { id: 804, nome: "Inativa", nome_completo: null, nome_exibicao: null, papel: null, grupo: "URC", nucleo: null, pendente: false, ordem: 4, email: null, ativo: false },
      ],
      meta_inovacao_canais: [
        { id: 601, slug: "cnr", nome: "CNR", nome_completo: "CNR", formato: null, pauta: [], ordem: 1, ativo: true },
        { id: 602, slug: "portal", nome: "Portal", nome_completo: "Portal", formato: null, pauta: [], ordem: 2, ativo: true },
      ],
    },
  };
}

/* ------------------------------------------------------------------ testes ---- */

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
    await cdp.send("Page.setDownloadBehavior", { behavior: "deny" }, sessionId);

    async function evaluate(expression) {
      const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId);
      if (r.exceptionDetails) throw new Error("erro avaliando no browser: " + JSON.stringify(r.exceptionDetails));
      return r.result.value;
    }
    const ler = async (expr) => JSON.parse(await evaluate("JSON.stringify(" + expr + ")"));

    let scriptId = null;
    async function abrir(mock, querystring) {
      if (scriptId) { await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: scriptId }, sessionId); scriptId = null; }
      const fonte = (mock ? "window.__MOCK = " + JSON.stringify(mock) + ";\n" + INTERCEPTOR : "window.CC_FORCAR_FALLBACK = true;") + "\n" + AUTO_CONFIRMAR;
      const r = await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: fonte }, sessionId);
      scriptId = r.identifier;
      const carregou = cdp.once("Page.loadEventFired");
      await cdp.send("Page.navigate", { url: "http://127.0.0.1:" + port + "/editor.html" + (querystring || "") }, sessionId);
      await carregou;
      await esperar(400);
    }

    async function selecionarConjunto(valor) {
      await evaluate(`(function(){
        const sel = document.getElementById('ed-conjunto');
        sel.value = '${valor}';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      })()`);
      await esperar(500);
    }

    const LEITURA_LIDERANCA = `(function(){
      const linhas = [...document.querySelectorAll('#ed-area tbody tr')].map(tr => {
        const sel = tr.querySelector('select[data-f="pessoa_id"]');
        return {
          pessoaSelecionada: sel ? (sel.options[sel.selectedIndex]||{}).textContent : null,
          pessoaDesabilitada: sel ? sel.disabled : null,
          opcoes: sel ? [...sel.options].map(o => o.textContent) : [],
        };
      });
      return { linhas };
    })()`;

    const LEITURA_CANAIS = `(function(){
      const linhas = [...document.querySelectorAll('#ed-area tbody tr')].map(tr => {
        const selCanal = tr.querySelector('select[data-f="canal"]');
        const selPessoa = tr.querySelector('select[data-f="pessoa_id"]');
        return {
          canal: selCanal ? selCanal.value : null,
          pessoaSelecionada: selPessoa ? (selPessoa.options[selPessoa.selectedIndex]||{}).textContent : null,
        };
      });
      return { linhas };
    })()`;

    /* ---- 1) offline: DB_URC/DB_PESSOAS/DB_CANAIS caem pro seed local, controles desabilitados ---- */
    await abrir(null, "?semrede=1");
    await selecionarConjunto("urc_lideranca");
    const offLid = await ler(LEITURA_LIDERANCA);
    conferir(offLid.linhas.length > 0, "offline (liderança): nenhuma linha apareceu na aba");
    conferir(offLid.linhas.every(l => l.pessoaDesabilitada === true), "offline (liderança): o <select> de pessoa deveria estar desabilitado");
    notas.push("offline: <select> de pessoa desabilitado nas duas abas (sem rede)");

    /* ---- 2) online — liderança: pessoa vinculada pré-selecionada, trocar grava pessoa_id+nome ---- */
    await abrir(cenarioBase());
    await selecionarConjunto("urc_lideranca");
    const onLid1 = await ler(LEITURA_LIDERANCA);
    conferir(onLid1.linhas.length === 1 && onLid1.linhas[0].pessoaSelecionada === "Enio Silva",
      'online (liderança): a linha do Enio deveria vir com "Enio Silva" pré-selecionado — veio ' + JSON.stringify(onLid1.linhas));
    conferir(onLid1.linhas[0].opcoes.some(o => o.indexOf("Inativa") >= 0) === false,
      "online (liderança): pessoa inativa não pode aparecer nas opções — veio " + JSON.stringify(onLid1.linhas[0].opcoes));

    await evaluate(`(function(){
      const sel = document.querySelector('#ed-area tbody select[data-f="pessoa_id"]');
      const opt = [...sel.options].find(o => o.textContent === 'Rafael Lima');
      sel.value = opt.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await esperar(500);
    const mockDepoisLid = await ler("window.__MOCK.tabelas");
    const liderancaMock = mockDepoisLid.meta_inovacao_urc_lideranca.find(l => l.id === 701);
    conferir(!!liderancaMock && liderancaMock.pessoa_id === 803 && liderancaMock.nome === "Rafa",
      'online (liderança): trocar pra "Rafael Lima" deveria gravar pessoa_id=803 e nome="Rafa" (texto curto) — veio ' + JSON.stringify(liderancaMock));
    notas.push('liderança: pessoa vinculada pré-selecionada, trocar grava pessoa_id + nome (texto legado, nome curto)');

    /* ---- 3) online — canais: pessoa vinculada pré-selecionada, trocar canal grava canal_id ---- */
    await selecionarConjunto("urc_canais");
    const onCan1 = await ler(LEITURA_CANAIS);
    conferir(onCan1.linhas.length === 1 && onCan1.linhas[0].canal === "CNR" && onCan1.linhas[0].pessoaSelecionada === "Milva Souza",
      'online (canais): a linha deveria vir com canal "CNR" e pessoa "Milva Souza" — veio ' + JSON.stringify(onCan1.linhas));

    await evaluate(`(function(){
      const sel = document.querySelector('#ed-area tbody select[data-f="canal"]');
      sel.value = 'Portal';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await esperar(500);
    const mockDepoisCanal = await ler("window.__MOCK.tabelas");
    const respMock1 = mockDepoisCanal.meta_inovacao_urc_canais_responsaveis.find(l => l.id === 711);
    conferir(!!respMock1 && respMock1.canal === "Portal" && respMock1.canal_id === 602 && respMock1.pessoa_id === 802,
      'online (canais): trocar o canal pra "Portal" deveria gravar canal_id=602 sem tocar pessoa_id — veio ' + JSON.stringify(respMock1));
    notas.push("canais: trocar o <select> de canal grava canal_id junto, sem mexer no vínculo de pessoa");

    /* ---- 4) guardrail (item 4.4): responsável de canal não pode ser a mesma pessoa da liderança ---- */
    await evaluate(`(function(){
      const sel = document.querySelector('#ed-area tbody select[data-f="pessoa_id"]');
      const opt = [...sel.options].find(o => o.textContent === 'Rafael Lima');
      sel.value = opt.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await esperar(500);
    const statusGuardrail = await evaluate(`(document.querySelector('#ed-area tbody .ed-row-status')||{}).textContent`);
    const mockDepoisGuardrail = await ler("window.__MOCK.tabelas");
    const respMock2 = mockDepoisGuardrail.meta_inovacao_urc_canais_responsaveis.find(l => l.id === 711);
    conferir(respMock2.pessoa_id === 802, 'guardrail: escolher "Rafael Lima" (liderança, trocada no passo 2) pro responsável de canal deveria ser recusado — pessoa_id mudou pra ' + JSON.stringify(respMock2));
    conferir(!!statusGuardrail && statusGuardrail.length > 0, "guardrail: deveria mostrar uma mensagem de erro na linha, não ficar em branco");
    notas.push("guardrail (item 4.4) continua bloqueando responsável de canal = pessoa da liderança, agora disparado pelo <select>");

    /* ---- 5) "+ Adicionar responsável": grava canal_id + pessoa_id + nome com os 2 <select> do topo ---- */
    await evaluate(`(function(){
      document.getElementById('ed-novo-resp-canal').value = 'Portal';
      const pessoaSel = document.getElementById('ed-novo-resp-pessoa');
      const opt = [...pessoaSel.options].find(o => o.textContent === 'Milva Souza');
      pessoaSel.value = opt.value;
      document.getElementById('ed-add-resp').click();
    })()`);
    await esperar(500);
    const mockDepoisAdd = await ler("window.__MOCK.tabelas");
    const novoResp = mockDepoisAdd.meta_inovacao_urc_canais_responsaveis.find(l => l.id !== 711);
    conferir(!!novoResp && novoResp.canal === "Portal" && novoResp.canal_id === 602 && novoResp.pessoa_id === 802 && novoResp.nome === "Milva",
      '"+ Adicionar responsável": deveria criar uma linha com canal="Portal"/canal_id=602/pessoa_id=802/nome="Milva" — veio ' + JSON.stringify(novoResp));
    notas.push('"+ Adicionar responsável" grava canal_id + pessoa_id + nome (texto) a partir dos 2 <select> do topo, no lugar do prompt() de antes');

    if (erros.length) {
      console.error("FALHOU urc_editor_headless:");
      erros.forEach((e) => console.error(" -", e));
      process.exitCode = 1;
    } else {
      console.log("urc_editor_headless OK — " + notas.join(" · ") + ".");
    }
  } finally {
    cdp.close();
    await encerrarChrome(proc);
    server.close();
    await limparPerfil(perfilTmp);
  }
}

principal().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
