/* Teste headless do "onde o projeto aparece" (v0.35.0): o cadastro de projetos é a fonte
 * única e cada tela lista os projetos com a sua marca (colunas exibir_* de
 * meta_inovacao_projetos, tools/sql/2026-11_projetos_visibilidade.sql).
 *
 * Dublê de Supabase in-memory (cliente JS e fetch REST, que corsario.js usa direto).
 * Cadastro: Alfa (tudo ligado), Beta (sem Corsário, Sites e Atividades), Gama (sem Painéis,
 * Canva e Fluxo). corsario_status tem Alfa, Beta e "Livre" (iniciativa fora do cadastro).
 *
 *   1) COM as colunas: Corsário = Alfa, Gama; Sites = Alfa, Gama; Painéis = Alfa, Beta;
 *      Atividades = Alfa, Gama; Canva = Alfa, Beta; Fluxo (matriz) = Alfa, Beta.
 *      Editor › Projetos: 7 caixas por linha, refletindo o banco; desmarcar grava UPDATE.
 *      Editor › Corsário: lista Alfa, Gama e não tem mais "+ Nova iniciativa".
 *   2) SEM as colunas (script SQL não rodado): tudo como antes — Corsário lê de
 *      corsario_status (Alfa, Beta, Livre), editor sem caixas e com aviso do script.
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
const INTERCEPTOR = `
(function(){
  "use strict";
  window.__ESCRITAS = [];
  function copia(o){ return JSON.parse(JSON.stringify(o)); }
  function tab(nome){ return window.__MOCK.tabelas[nome] || (window.__MOCK.tabelas[nome] = []); }
  function casa(r, f){ return f.every(function(e){ return e[2] === "is" ? r[e[0]] == null : String(r[e[0]]) === String(e[1]); }); }

  function executar(q){
    const alvo = tab(q.tabela);
    if (q.op === "select") return Promise.resolve({ data: copia(alvo.filter(function(r){ return casa(r, q.f); })), error: null });
    if (q.op === "update") {
      const linhas = alvo.filter(function(r){ return casa(r, q.f); });
      linhas.forEach(function(l){ Object.assign(l, q.payload); });
      window.__ESCRITAS.push({ tabela: q.tabela, op: "update", f: q.f, payload: copia(q.payload) });
      return Promise.resolve({ data: q.single ? copia(linhas[0] || null) : copia(linhas), error: linhas.length ? null : { message: "not found" } });
    }
    window.__ESCRITAS.push({ tabela: q.tabela, op: q.op, payload: copia(q.payload) });
    return Promise.resolve({ data: q.single ? {} : [], error: null });
  }
  function query(tabela){
    const q = { tabela: tabela, op: "select", payload: null, f: [], single: false };
    const api = {
      select: function(){ return api; }, order: function(){ return api; }, limit: function(){ return api; }, in: function(){ return api; },
      eq: function(c, v){ q.f.push([c, v, "eq"]); return api; }, is: function(c){ q.f.push([c, null, "is"]); return api; },
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
  // corsario.js lê por fetch REST direto
  const fetchReal = window.fetch;
  window.fetch = function(url, opts){
    const m = String(url).match(new RegExp("/rest/v1/([a-z_]+)"));
    if (!m) return fetchReal.apply(this, arguments);
    return Promise.resolve(new Response(JSON.stringify(copia(tab(m[1]))), { status: 200, headers: { "Content-Type": "application/json" } }));
  };
})();
`;

function cenario(comColunas) {
  const proj = (id, nucleo, iniciativa, marcas) => Object.assign(
    { id, nucleo, nucleo_id: null, iniciativa, representantes: ["Fulano"], ordem: id, deleted_at: null },
    comColunas ? Object.assign({ exibir_corsario: true, exibir_sites: true, exibir_paineis: true, exibir_fluxo_dados: true,
      exibir_atividades: true, exibir_matriz: true, exibir_canva: true }, marcas) : {});
  const st = (iniciativa, projeto_id, status) => ({ id: Math.floor(Math.random() * 1e9), iniciativa, nucleo: "N1", projeto_id, nucleo_id: null, criterio: "c1", status, observacao: null, atualizado_em: "2026-11-01T00:00:00Z" });
  return { tabelas: {
    meta_inovacao_projetos: [
      proj(1, "N1", "Alfa", {}),
      proj(2, "N1", "Beta", { exibir_corsario: false, exibir_sites: false, exibir_atividades: false }),
      proj(3, "N2", "Gama", { exibir_paineis: false, exibir_canva: false, exibir_fluxo_dados: false }),
    ],
    corsario_criterios: [{ id: 1, chave: "c1", grupo: "Grupo", rotulo: "Critério 1", ordem: 1 }],
    corsario_status: [st("Alfa", 1, "ok"), st("Beta", 2, "a iniciar"), st("Livre", null, "ok")],
  } };
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
    async function aba(valor) {
      await evaluate(`(function(){ const s = document.getElementById('ed-conjunto'); s.value = '${valor}'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
      await esperar(700);
    }
    const nomesCorsario = () => ler(`[...document.querySelectorAll('.crs-card .crs-card-nome')].map(e => e.textContent.trim()).sort()`);

    /* ---- 1) com as colunas ---- */
    await abrir("corsario.html#cards", cenario(true));
    let n = await nomesCorsario();
    conferir(igual(n, ["Alfa", "Gama"]), "Corsário (cadastro): esperava Alfa, Gama — veio " + JSON.stringify(n));

    await abrir("sites.html", cenario(true));
    n = await ler(`[...document.querySelectorAll('tr[data-iniciativa]')].map(t => t.dataset.iniciativa).sort()`);
    conferir(igual(n, ["Alfa", "Gama"]), "Sites: esperava Alfa, Gama — veio " + JSON.stringify(n));
    await abrir("paineis.html", cenario(true));
    n = await ler(`[...document.querySelectorAll('tr[data-iniciativa]')].map(t => t.dataset.iniciativa).sort()`);
    conferir(igual(n, ["Alfa", "Beta"]), "Painéis: esperava Alfa, Beta — veio " + JSON.stringify(n));

    await abrir("plano-acao.html", cenario(true));
    n = await ler(`[...document.querySelectorAll('button[data-iniciativa]')].map(b => b.dataset.iniciativa).sort()`);
    conferir(igual(n, ["Alfa", "Gama"]), "Atividades: esperava Alfa, Gama — veio " + JSON.stringify(n));

    await abrir("canva.html", cenario(true));
    n = await ler(`[...document.querySelectorAll('.cv-chk-projeto')].map(c => c.value).sort()`);
    conferir(igual(n, ["Alfa", "Beta"]), "Canva: esperava Alfa, Beta — veio " + JSON.stringify(n));

    await abrir("fluxo-dados.html", cenario(true));
    n = await ler(`[...document.querySelectorAll('#fd-matriz tbody tr td:first-child')].map(t => t.textContent.trim()).sort()`);
    conferir(igual(n, ["Alfa", "Beta"]), "Fluxo de dados: esperava Alfa, Beta — veio " + JSON.stringify(n));
    notas.push("6 telas filtram pelo cadastro");

    await abrir("editor.html", cenario(true));
    await aba("projetos");
    const caixas = await ler(`[...document.querySelectorAll('#ed-area tbody tr')].map(tr => [...tr.querySelectorAll('input[data-vis]')].map(c => c.checked ? 1 : 0).join(''))`);
    conferir(igual(caixas, ["1111111", "0011011", "1100110"]), "Editor › Projetos: caixas não refletem o banco — veio " + JSON.stringify(caixas));
    await evaluate(`(function(){ const c = document.querySelector('#ed-area tbody tr[data-id="3"] input[data-vis="exibir_sites"]'); c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); })()`);
    await esperar(500);
    const esc = await ler(`window.__ESCRITAS.filter(e => e.tabela === 'meta_inovacao_projetos')`);
    conferir(esc.length === 1 && esc[0].op === "update" && igual(esc[0].f, [["id", 3, "eq"]]) && esc[0].payload.exibir_sites === false,
      "Editor › Projetos: desmarcar Sites de Gama deveria gravar 1 UPDATE — veio " + JSON.stringify(esc));
    const formTemCaixas = await ler(`document.querySelectorAll('#ed-form-novo-proj input[id^="nvp-exibir_"]').length`);
    conferir(formTemCaixas === 7, "Editor › Novo projeto: deveria ter 7 caixas 'Aparece em' — veio " + formTemCaixas);
    await aba("corsario");
    n = await ler(`[...document.querySelectorAll('#ed-area tbody td.col-ini')].map(t => t.textContent.trim()).sort()`);
    conferir(igual(n, ["Alfa", "Gama"]), "Editor › Corsário: esperava Alfa, Gama — veio " + JSON.stringify(n));
    conferir(!(await ler(`!!document.getElementById('ed-abrir-nova-ini')`)), "Editor › Corsário: '+ Nova iniciativa' deveria ter saído");
    notas.push("editor: caixas refletem e gravam; Corsário do editor segue o cadastro, sem '+ Nova iniciativa'");

    /* ---- 2) sem as colunas (modo antigo) ---- */
    await abrir("corsario.html#cards", cenario(false));
    n = await nomesCorsario();
    conferir(igual(n, ["Alfa", "Beta", "Livre"]), "Corsário (modo antigo): esperava Alfa, Beta, Livre — veio " + JSON.stringify(n));
    await abrir("editor.html", cenario(false));
    await aba("projetos");
    const semCaixas = await ler(`({ caixas: document.querySelectorAll('#ed-area input[data-vis]').length, aviso: document.getElementById('ed-area').textContent.includes('2026-11_projetos_visibilidade.sql') })`);
    conferir(semCaixas.caixas === 0 && semCaixas.aviso, "Editor (modo antigo): sem caixas e com aviso do script — veio " + JSON.stringify(semCaixas));
    await abrir("plano-acao.html", cenario(false));
    n = await ler(`[...document.querySelectorAll('button[data-iniciativa]')].map(b => b.dataset.iniciativa).sort()`);
    conferir(igual(n, ["Alfa", "Beta", "Gama"]), "Atividades (modo antigo): esperava todos — veio " + JSON.stringify(n));
    notas.push("sem o script SQL tudo segue como antes");

    if (erros.length) {
      console.error("FALHOU projetos_visibilidade_headless:");
      erros.forEach((e) => console.error(" -", e));
      process.exitCode = 1;
    } else {
      console.log("projetos_visibilidade_headless OK — " + notas.join(" · ") + ".");
    }
  } finally {
    cdp.close();
    await encerrarChrome(proc);
    server.close();
    await limparPerfil(perfilTmp);
  }
}

principal().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
