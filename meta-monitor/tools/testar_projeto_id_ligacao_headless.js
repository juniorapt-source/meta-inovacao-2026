/* Teste headless da ligação por projeto_id (v0.36.0, tools/sql/2026-11_projeto_id_ligacao.sql).
 *
 * Cenário: o projeto 1 foi renomeado de "Alfa" para "Alfa Nova" no editor; as linhas das
 * outras tabelas ficaram com o nome velho, mas com projeto_id = 1. Uma atividade antiga não
 * tem projeto_id e já está com o nome novo (casa pelo nome).
 *
 *   1) COM a coluna projeto_id no banco:
 *      - Atividades (plano-acao.html): "Alfa Nova" mostra as 2 atividades (id + nome);
 *        "+ Nova atividade" grava projeto_id.
 *      - Drawer da iniciativa: as mesmas 2 atividades.
 *      - Painéis: o link gravado como "Alfa" aparece na linha de "Alfa Nova"; editar a
 *        linha grava o nome atual.
 *      - Canva consolidado: demanda gravada como "Alfa" aparece no grupo "Alfa Nova" e o
 *        projeto não entra em "não preencheram".
 *      - Editor › Projetos: renomear "Beta" leva o nome novo para as 4 tabelas por nome.
 *   2) SEM a coluna (script SQL não rodado; filtro por projeto_id dá 42703): Atividades e
 *      drawer caem pro nome (1 atividade) e o insert não manda projeto_id.
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
// Entende .eq/.is/.or (só o formato de DB_PROJETOS.filtroDoProjeto) no cliente JS e na
// query string REST (fetch direto do drawer). Com __MOCK.semColuna, qualquer filtro ou
// gravação com projeto_id responde 42703, como o Postgres antes do script.
const INTERCEPTOR = `
(function(){
  "use strict";
  window.__ESCRITAS = [];
  function copia(o){ return JSON.parse(JSON.stringify(o)); }
  function tab(nome){ return window.__MOCK.tabelas[nome] || (window.__MOCK.tabelas[nome] = []); }
  const ERRO_COLUNA = { code: "42703", message: "column projeto_id does not exist" };
  function filtroOr(txt){
    let m = txt.match(/^projeto_id\\.eq\\.(\\d+),and\\(projeto_id\\.is\\.null,(\\w+)\\.eq\\."((?:[^"\\\\]|\\\\.)*)"\\)$/);
    if (m) { const id = m[1], campo = m[2], nome = m[3].replace(/\\\\(.)/g, "$1");
      return { usaProjetoId: true, fn: function(r){ return String(r.projeto_id) === id || (r.projeto_id == null && r[campo] === nome); } }; }
    m = txt.match(/^(\\w+)\\.eq\\."((?:[^"\\\\]|\\\\.)*)"$/);
    if (m) { const campo = m[1], nome = m[2].replace(/\\\\(.)/g, "$1"); return { usaProjetoId: false, fn: function(r){ return r[campo] === nome; } }; }
    throw new Error("or() fora do formato esperado: " + txt);
  }
  function filtrar(linhas, fs){ return linhas.filter(function(r){ return fs.every(function(f){ return f.fn(r); }); }); }
  function usaColuna(fs, payload){
    return fs.some(function(f){ return f.usaProjetoId; }) || (payload && Object.prototype.hasOwnProperty.call(payload, "projeto_id"));
  }
  let seq = 1000;
  function executar(q){
    const alvo = tab(q.tabela);
    if (window.__MOCK.semColuna && window.__MOCK.comProjetoId.indexOf(q.tabela) !== -1 && usaColuna(q.fs, q.payload))
      return Promise.resolve({ data: null, error: ERRO_COLUNA });
    if (q.op === "select") return Promise.resolve({ data: copia(filtrar(alvo, q.fs)), error: null });
    if (q.op === "update") {
      const linhas = filtrar(alvo, q.fs);
      linhas.forEach(function(l){ Object.assign(l, q.payload); });
      window.__ESCRITAS.push({ tabela: q.tabela, op: "update", f: q.desc, payload: copia(q.payload) });
      return Promise.resolve({ data: q.single ? copia(linhas[0] || null) : copia(linhas), error: null });
    }
    if (q.op === "insert") {
      const nova = Object.assign({ id: "N" + (seq++), deleted_at: null }, copia(q.payload));
      alvo.push(nova);
      window.__ESCRITAS.push({ tabela: q.tabela, op: "insert", payload: copia(q.payload) });
      return Promise.resolve({ data: q.single ? copia(nova) : [copia(nova)], error: null });
    }
    return Promise.resolve({ data: q.single ? {} : [], error: null });
  }
  function query(tabela){
    const q = { tabela: tabela, op: "select", payload: null, fs: [], desc: [], single: false };
    const api = {
      select: function(){ return api; }, order: function(){ return api; }, limit: function(){ return api; }, in: function(){ return api; },
      eq: function(c, v){ q.desc.push([c, v, "eq"]); q.fs.push({ usaProjetoId: c === "projeto_id", fn: function(r){ return String(r[c]) === String(v); } }); return api; },
      is: function(c){ q.desc.push([c, null, "is"]); q.fs.push({ usaProjetoId: c === "projeto_id", fn: function(r){ return r[c] == null; } }); return api; },
      or: function(txt){ q.desc.push(["or", txt]); q.fs.push(filtroOr(txt)); return api; },
      insert: function(p){ q.op = "insert"; q.payload = p; return api; }, update: function(p){ q.op = "update"; q.payload = p; return api; },
      delete: function(){ q.op = "delete"; return api; }, upsert: function(p){ q.op = "upsert"; q.payload = p; return api; },
      single: function(){ q.single = true; return api; }, maybeSingle: function(){ q.single = true; return api; },
      then: function(ok, erro){ return executar(q).then(ok, erro); }
    };
    return api;
  }
  const cliente = { from: query, rpc: function(){ return Promise.resolve({ data: null, error: null }); },
    channel: function(){ const ch = { on: function(){ return ch; }, subscribe: function(){ return ch; } }; return ch; },
    removeChannel: function(){} };
  let real = null;
  Object.defineProperty(window, "CC_SUPABASE", { configurable: true, get: function(){ return real; }, set: function(v){
    real = v;
    real.obterClienteClassico = function(){ return cliente; };
    real.obterClienteEsm = function(){ return Promise.resolve(cliente); };
    real.clientePrincipal = function(){ return Promise.resolve(cliente); };
  }});
  // drawer.js e corsario.js leem por fetch REST direto
  const fetchReal = window.fetch;
  window.fetch = function(url){
    const u = new URL(String(url), location.href);
    const m = u.pathname.match(/\\/rest\\/v1\\/([a-z_]+)/);
    if (!m) return fetchReal.apply(this, arguments);
    const fs = [];
    u.searchParams.forEach(function(v, k){
      if (k === "select" || k === "order" || k === "limit") return;
      if (k === "or") { fs.push(filtroOr(v.replace(/^\\(|\\)$/g, ""))); return; }
      if (v === "is.null") { fs.push({ usaProjetoId: k === "projeto_id", fn: function(r){ return r[k] == null; } }); return; }
      if (v.indexOf("eq.") === 0) { const val = v.slice(3); fs.push({ usaProjetoId: k === "projeto_id", fn: function(r){ return String(r[k]) === val; } }); }
    });
    if (window.__MOCK.semColuna && window.__MOCK.comProjetoId.indexOf(m[1]) !== -1 && usaColuna(fs))
      return Promise.resolve(new Response(JSON.stringify(ERRO_COLUNA), { status: 400, headers: { "Content-Type": "application/json" } }));
    return Promise.resolve(new Response(JSON.stringify(copia(filtrar(tab(m[1]), fs))), { status: 200, headers: { "Content-Type": "application/json" } }));
  };
})();
`;

function cenario(semColuna) {
  const proj = (id, nucleo, iniciativa) => ({ id, nucleo, nucleo_id: null, iniciativa, representantes: ["Fulano"], ordem: id, deleted_at: null,
    exibir_corsario: true, exibir_sites: true, exibir_paineis: true, exibir_fluxo_dados: true, exibir_atividades: true, exibir_matriz: true, exibir_canva: true });
  const ativ = (id, iniciativa, projeto_id, descricao) => Object.assign({ id, iniciativa, descricao, responsavel: "", status: "nao_iniciado", ordem: 1,
    created_at: "2026-11-01T00:00:00Z", deleted_at: null }, semColuna ? {} : { projeto_id });
  const demanda = (id, projeto, projeto_id) => ({ id, projeto, projeto_digitado: projeto, projeto_id, projeto_novo: false, nucleo: "N1", nucleo_id: null,
    canal: "foco", canal_id: null, facilitador: null, facilitador_pessoa_id: null, ciclo: null, encontro_id: null, servico: "Serviço " + id,
    problema: "Problema", bloqueio: null, canal_proprio: "nao", canal_proprio_qual: null, responsavel: "R", responsavel_pessoa_id: null,
    prazo: "2026-12-01", status: "rascunho", autor_nome: "A", sessao_id: "11111111-1111-4111-8111-11111111111" + id, updated_by: null,
    criado_em: "2026-11-01T10:00:00Z", deleted_at: null });
  return {
    semColuna: !!semColuna,
    comProjetoId: ["plano_acao_atividades", "fluxo_dados_rotas", "fluxo_dados_paineis"],
    tabelas: {
      meta_inovacao_projetos: [proj(1, "N1", "Alfa Nova"), proj(2, "N1", "Beta")],
      corsario_criterios: [{ id: 1, chave: "c1", grupo: "Grupo", rotulo: "Critério 1", ordem: 1 }],
      corsario_status: [{ id: 1, iniciativa: "Alfa", nucleo: "N1", projeto_id: 1, nucleo_id: null, criterio: "c1", status: "ok", observacao: null }],
      plano_acao_atividades: [
        ativ("A1", "Alfa", 1, "gravada antes do rename"),
        ativ("A2", "Alfa Nova", null, "antiga sem projeto_id"),
        ativ("B1", "Beta", 2, "do Beta"),
      ],
      meta_inovacao_iniciativa_links: [
        { id: 7, tipo: "painel", iniciativa: "Alfa", nucleo: "N1", projeto_id: 1, nucleo_id: null, link: "https://painel.alfa", descricao: "", captura_lead: false,
          responsavel_pessoa_id: null, responsavel: null, deleted_at: null },
      ],
      meta_inovacao_canva_demandas: [demanda(1, "Alfa", 1)],
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
  const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

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
    async function abrir(pagina, mock) {
      if (scriptId) { await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: scriptId }, sessionId); scriptId = null; }
      const fonte = "window.__MOCK = " + JSON.stringify(mock) + ";\n" + INTERCEPTOR + "\nwindow.alert = function(){}; window.confirm = function(){ return true; };";
      scriptId = (await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: fonte }, sessionId)).identifier;
      const carregou = cdp.once("Page.loadEventFired");
      await cdp.send("Page.navigate", { url: "http://127.0.0.1:" + port + "/" + pagina }, sessionId);
      await carregou;
      await esperar(900);
    }
    async function clicarIniciativa(nome) {
      await evaluate(`document.querySelector('#pa-nav button[data-iniciativa="${nome}"]').click()`);
      await esperar(500);
    }
    const descricoesAtividades = () => ler(`[...document.querySelectorAll('#pa-linhas .pa-row .pa-desc')].map(i => i.value).sort()`);
    async function drawerAtividades(nome) {
      await evaluate(`DRAWER.abrirIniciativa(${JSON.stringify(nome)})`);
      await esperar(600);
      return ler(`[...document.querySelectorAll('#drawer-ativ-ini .drawer-linha span:first-child')].map(s => s.textContent).sort()`);
    }

    /* ---- 1) com a coluna projeto_id ---- */
    await abrir("plano-acao.html", cenario(false));
    await clicarIniciativa("Alfa Nova");
    let n = await descricoesAtividades();
    conferir(igual(n, ["antiga sem projeto_id", "gravada antes do rename"]), "Atividades (com coluna): esperava as 2 de Alfa Nova — veio " + JSON.stringify(n));
    await evaluate(`document.getElementById('pa-nova').click()`);
    await esperar(400);
    let ins = await ler(`window.__ESCRITAS.filter(e => e.op === 'insert' && e.tabela === 'plano_acao_atividades').map(e => e.payload)`);
    conferir(ins.length === 1 && ins[0].projeto_id === 1 && ins[0].iniciativa === "Alfa Nova", "Atividades: nova atividade deveria levar projeto_id 1 — veio " + JSON.stringify(ins));
    n = await drawerAtividades("Alfa Nova");
    conferir(n.length === 3 && n.includes("gravada antes do rename") && n.includes("antiga sem projeto_id"),
      "Drawer (com coluna): esperava as atividades de Alfa Nova (2 + a nova) — veio " + JSON.stringify(n));
    notas.push("Atividades e drawer casam por projeto_id + nome; atividade nova grava projeto_id");

    await abrir("paineis.html", cenario(false));
    const linkAlfa = await ler(`(document.querySelector('tr[data-iniciativa="Alfa Nova"] input[data-campo="link"]') || {}).value || null`);
    conferir(linkAlfa === "https://painel.alfa", "Painéis: o link gravado como 'Alfa' (projeto_id 1) deveria aparecer em 'Alfa Nova' — veio " + JSON.stringify(linkAlfa));
    await evaluate(`(function(){ const i = document.querySelector('tr[data-iniciativa="Alfa Nova"] input[data-campo="descricao"]'); i.value = 'Painel do Alfa'; i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await esperar(500);
    const upd = await ler(`window.__ESCRITAS.filter(e => e.tabela === 'meta_inovacao_iniciativa_links').map(e => e.payload)`);
    conferir(upd.length === 1 && upd[0].iniciativa === "Alfa Nova" && upd[0].descricao === "Painel do Alfa",
      "Painéis: editar a linha antiga deveria gravar o nome atual — veio " + JSON.stringify(upd));
    notas.push("Painéis acham o link pelo projeto_id e corrigem o nome ao editar");

    await abrir("canva-consolidado.html", cenario(false));
    await esperar(500);
    const canva = await ler(`({ grupos: [...document.querySelectorAll('.cvc-projeto-titulo')].map(e => e.textContent.trim()),
      falta: (document.querySelector('.cvc-nao-preencheram') || { textContent: '' }).textContent })`);
    conferir(canva.grupos.length === 1 && canva.grupos[0].indexOf("Alfa Nova") === 0, "Canva: demanda de 'Alfa' deveria estar no grupo 'Alfa Nova' — veio " + JSON.stringify(canva.grupos));
    conferir(canva.falta.indexOf("Alfa Nova") === -1 && canva.falta.indexOf("Beta") !== -1, "Canva: 'Alfa Nova' não deveria estar em 'quem falta' — veio " + JSON.stringify(canva.falta));
    notas.push("Canva agrupa pelo nome atual do projeto");

    await abrir("editor.html", cenario(false));
    await evaluate(`(function(){ const s = document.getElementById('ed-conjunto'); s.value = 'projetos'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await esperar(700);
    await evaluate(`(function(){ const i = document.querySelector('#ed-area tbody tr[data-id="2"] input[data-f="iniciativa"]'); i.value = 'Beta 2'; i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await esperar(800);
    const prop = await ler(`window.__ESCRITAS.filter(e => e.op === 'update' && e.payload.iniciativa === 'Beta 2' && e.tabela !== 'meta_inovacao_projetos' && e.tabela !== 'corsario_status')
      .map(e => [e.tabela, e.f]).sort()`);
    const esperado = ["fluxo_dados_paineis", "fluxo_dados_rotas", "meta_inovacao_iniciativa_links", "plano_acao_atividades"].map((t) => [t, [["iniciativa", "Beta", "eq"]]]);
    conferir(igual(prop, esperado), "Editor: renomear Beta deveria levar o nome às 4 tabelas — veio " + JSON.stringify(prop));
    const beta = await ler(`window.__MOCK.tabelas.plano_acao_atividades.find(a => a.id === 'B1').iniciativa`);
    conferir(beta === "Beta 2", "Editor: atividade do Beta deveria estar como 'Beta 2' — veio " + JSON.stringify(beta));
    const status = await ler(`(document.querySelector('#ed-area tbody tr[data-id="2"] .ed-row-status') || {}).textContent`);
    conferir(status === "salvo", "Editor: status da linha deveria ser 'salvo' — veio " + JSON.stringify(status));
    notas.push("rename no editor propaga para atividades, Sites/Painéis e Fluxo");

    /* ---- 2) sem a coluna (script não rodado) ---- */
    await abrir("plano-acao.html", cenario(true));
    await clicarIniciativa("Alfa Nova");
    n = await descricoesAtividades();
    conferir(igual(n, ["antiga sem projeto_id"]), "Atividades (sem coluna): esperava só a que casa pelo nome — veio " + JSON.stringify(n));
    await evaluate(`document.getElementById('pa-nova').click()`);
    await esperar(400);
    ins = await ler(`window.__ESCRITAS.filter(e => e.op === 'insert' && e.tabela === 'plano_acao_atividades').map(e => e.payload)`);
    conferir(ins.length === 1 && !("projeto_id" in ins[0]), "Atividades (sem coluna): o insert não deveria mandar projeto_id — veio " + JSON.stringify(ins));
    n = await drawerAtividades("Alfa Nova");
    conferir(n.length === 2 && n.includes("antiga sem projeto_id"), "Drawer (sem coluna): esperava casar pelo nome — veio " + JSON.stringify(n));
    notas.push("sem o script SQL, Atividades e drawer seguem pelo nome");

    if (erros.length) {
      console.error("FALHOU projeto_id_ligacao_headless:");
      erros.forEach((e) => console.error(" -", e));
      process.exitCode = 1;
    } else {
      console.log("projeto_id_ligacao_headless OK — " + notas.join(" · ") + ".");
    }
  } finally {
    cdp.close();
    await encerrarChrome(proc);
    server.close();
    await limparPerfil(perfilTmp);
  }
}

principal().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
