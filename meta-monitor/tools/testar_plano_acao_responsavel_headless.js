/* Teste da tela "Atividades por iniciativa" (plano-acao.html) — Camada 4 do golden
 * record (docs/PLANO_EXECUCAO_GOLDEN_RECORD.md, item 4.3).
 *
 * O item 4.3 trocou o <select> de "Responsável", que lia a lista estática
 * window.DB.responsaveis (data/pessoas.js), por uma lista montada em tempo real a
 * partir do golden record (DB_PESSOAS + DB_COLETIVOS, js/db-responsaveis.js) —
 * "cadastra e aparece sozinho" (uma pessoa nova no golden record aparece aqui sem
 * editar este arquivo) — preservando EXATAMENTE os ~32 ids antigos já gravados em
 * plano_acao_atividades.responsavel antes deste item (js/db-responsaveis.js.LEGADO).
 *
 * Cenários (Supabase trocado por um dublê in-memory — mesma técnica de
 * tools/testar_projetos_editor_representantes_headless.js; plano-acao.html usa
 * supa.from() diretamente, não tem rota de fallback offline pra esta tabela, então
 * só o cenário "online com dublê" faz sentido aqui):
 *   - atividade gravada com o id antigo "jr" pré-seleciona a opção "JR." (grupo
 *     Coordenação), sem exibir aviso de "legado";
 *   - atividade gravada com "jose_mendes_junior" (o apelido do MESMO físico, unificado
 *     nesta camada) pré-seleciona a MESMA opção "JR." — só uma vez na lista, não duas;
 *   - atividade gravada com um texto que não bate com nada mostra a opção "legado"
 *     (⚠), sem apagar o valor;
 *   - uma pessoa do golden record fora dos 32 ids antigos (grupo URC, nunca esteve na
 *     lista estática) aparece como opção, agrupada em "URC";
 *   - trocar o <select> pra uma opção golden nova grava o id canônico no Supabase
 *     (dublê) — próxima leitura já sai convertida, sem "legado".
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
// Tabela in-memory genérica — select filtra por eq/is(null); update casa por eq("id",...)
// e aplica o patch na linha; insert dá um id sequencial. Mais completa que a de
// tools/testar_projetos_editor_representantes_headless.js só no que plano-acao.html
// precisa a mais: eq() por um campo QUALQUER (não só "id") na leitura de atividades
// (.eq("iniciativa", nome)) e in()/order() como no-ops (não afetam o resultado).
const INTERCEPTOR = `
(function(){
  "use strict";
  window.__ESCRITAS = [];
  function copia(o){ return JSON.parse(JSON.stringify(o)); }
  function tabelaMock(nome){ return (window.__MOCK.tabelas && window.__MOCK.tabelas[nome]) || []; }

  function bate(linha, q){
    if (q.isNullCampos.some(function(c){ return linha[c] != null; })) return false;
    return q.eqs.every(function(par){ return String(linha[par[0]]) === String(par[1]); });
  }

  function executar(q){
    if (q.op === "select") {
      const linhas = tabelaMock(q.tabela).filter(function(r){ return bate(r, q); });
      return Promise.resolve({ data: copia(linhas), error: null });
    }
    if (q.op === "insert") {
      const alvo = window.__MOCK.tabelas[q.tabela] || (window.__MOCK.tabelas[q.tabela] = []);
      window.__MOCK.proximoId = (window.__MOCK.proximoId || 9000) + 1;
      const nova = Object.assign({ id: q.payload && q.payload.id != null ? q.payload.id : window.__MOCK.proximoId }, q.payload);
      alvo.push(nova);
      window.__ESCRITAS.push({ tabela: q.tabela, op: "insert", payload: copia(q.payload) });
      const devolvido = copia(nova);
      return Promise.resolve({ data: q.single ? devolvido : [devolvido], error: null });
    }
    if (q.op === "update") {
      const alvo = window.__MOCK.tabelas[q.tabela] || [];
      const alvos = alvo.filter(function(r){ return bate(r, q); });
      if (!alvos.length) return Promise.resolve({ data: null, error: { message: "not found: " + q.tabela } });
      alvos.forEach(function(linha){ Object.assign(linha, q.payload); });
      window.__ESCRITAS.push({ tabela: q.tabela, op: "update", eqs: q.eqs.slice(), payload: copia(q.payload) });
      const devolvido = copia(alvos[0]);
      return Promise.resolve({ data: q.single ? devolvido : alvos.map(copia), error: null });
    }
    return Promise.resolve({ data: [], error: null });
  }

  function query(tabela){
    const q = { tabela: tabela, op: "select", payload: null, eqs: [], isNullCampos: [], single: false };
    const api = {
      select: function(){ if (q.op !== "insert" && q.op !== "update") q.op = "select"; return api; },
      is: function(campo, val){ if (val === null) q.isNullCampos.push(campo); return api; },
      eq: function(campo, val){ q.eqs.push([campo, val]); return api; },
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

const INICIATIVA = "ALI Academy"; // iniciativa real de data/projetos.js — deixa PORTFOLIO.pronto
                                    // hidratar com o seed local (meta_inovacao_projetos vazio no
                                    // mock não zera o portfólio, ver js/portfolio.js).

function cenarioBase() {
  return {
    proximoId: 20000,
    tabelas: {
      plano_acao_atividades: [
        { id: "AT-1", iniciativa: INICIATIVA, descricao: "Tarefa do JR.", responsavel: "jr", status: "nao_iniciado", ordem: 1 },
        { id: "AT-2", iniciativa: INICIATIVA, descricao: "Tarefa do apelido antigo", responsavel: "jose_mendes_junior", status: "em_execucao", ordem: 2 },
        { id: "AT-3", iniciativa: INICIATIVA, descricao: "Tarefa com texto legado de verdade", responsavel: "um-texto-que-nao-bate-com-nada", status: "nao_iniciado", ordem: 3 },
      ],
      meta_inovacao_pessoas: [
        { id: 501, nome: "JR. (José Júnior)", nome_completo: "José Mendes de Oliveira Júnior", nome_exibicao: "JR.", grupo: "UI", ativo: true, ordem: 1 },
        { id: 502, nome: "Iuri Barbosa de Andrade", nome_completo: "Iuri Barbosa de Andrade", nome_exibicao: "Iuri", grupo: "URC", ativo: true, ordem: 2 },
      ],
      meta_inovacao_coletivos: [
        { id: 601, nome: "Comitê", ordem: 1 },
      ],
    },
  };
}

/* ------------------------------------------------------------------ teste ---- */

async function principal() {
  const chromePath = acharChrome();
  const { server, port } = await iniciarServidor();
  const { proc, wsUrl, perfilTmp } = await iniciarChrome(chromePath);
  const cdp = await conectarCDP(wsUrl);
  const erros = [];
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

    const mock = cenarioBase();
    const fonte = "window.__MOCK = " + JSON.stringify(mock) + ";\n" + INTERCEPTOR;
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: fonte }, sessionId);
    const carregou = cdp.once("Page.loadEventFired");
    await cdp.send("Page.navigate", { url: "http://127.0.0.1:" + port + "/plano-acao.html" }, sessionId);
    await carregou;

    // espera a iniciativa aparecer no nav e clica nela (mesma navegação de um humano)
    let navPronto = false;
    for (let t = 0; t < 20 && !navPronto; t++) {
      await esperar(300);
      navPronto = await evaluate("!!document.querySelector('#pa-nav button[data-iniciativa]')");
    }
    conferir(navPronto, "nav de iniciativas não apareceu a tempo");
    await evaluate(`document.querySelector('#pa-nav button[data-iniciativa="${INICIATIVA}"]').click()`);
    let linhasProntas = false;
    for (let t = 0; t < 20 && !linhasProntas; t++) {
      await esperar(200);
      linhasProntas = await evaluate("document.querySelectorAll('.pa-row').length === 3");
    }
    conferir(linhasProntas, "as 3 linhas de atividade da iniciativa não apareceram a tempo");

    const LEITURA = `(function(){
      return [...document.querySelectorAll('.pa-row')].map(function(row){
        const sel = row.querySelector('select.pa-resp');
        const selecionada = sel.options[sel.selectedIndex];
        return {
          id: row.dataset.id,
          valorSelecionado: sel.value,
          textoSelecionado: selecionada ? selecionada.textContent : null,
          ehLegado: selecionada ? selecionada.classList.contains('pa-legado') : false,
          opcoes: [...sel.querySelectorAll('option')].map(function(o){ return o.value + '::' + o.textContent; }),
          grupos: [...sel.querySelectorAll('optgroup')].map(function(g){ return g.label; }),
        };
      });
    })()`;
    const linhas = await ler(LEITURA);
    const at1 = linhas.find((l) => l.id === "AT-1");
    const at2 = linhas.find((l) => l.id === "AT-2");
    const at3 = linhas.find((l) => l.id === "AT-3");

    conferir(!!at1 && at1.valorSelecionado === "jr" && at1.textoSelecionado === "JR." && !at1.ehLegado,
      'AT-1 ("jr"): esperava valor "jr"/texto "JR." sem legado — veio ' + JSON.stringify(at1));
    // não existe <option value="jose_mendes_junior"> (colapsado na mesma opção de "jr") —
    // o próprio <select> já normaliza sozinho pro valor "jr" ao marcar essa opção como
    // selected, então valorSelecionado sai "jr" mesmo a atividade tendo sido gravada com
    // o apelido antigo (é o comportamento certo: a próxima gravação já sai canônica).
    conferir(!!at2 && at2.valorSelecionado === "jr" && at2.textoSelecionado === "JR." && !at2.ehLegado,
      'AT-2 ("jose_mendes_junior", apelido do mesmo físico de "jr"): esperava pré-selecionar a opção "JR." (valor "jr") sem legado — veio ' + JSON.stringify(at2));
    conferir(!!at3 && at3.ehLegado && at3.textoSelecionado.includes("um-texto-que-nao-bate-com-nada"),
      'AT-3 (texto sem tradução): esperava opção "legado" com o texto original — veio ' + JSON.stringify(at3));

    // "JR." só uma vez nas opções (jr e jose_mendes_junior colapsados numa única opção)
    if (at1) {
      const ocorrenciasJR = at1.opcoes.filter((o) => o.endsWith("::JR.")).length;
      conferir(ocorrenciasJR === 1, '"JR." deveria aparecer 1x nas opções do select (ids "jr"/"jose_mendes_junior" unificados) — apareceu ' + ocorrenciasJR + "x: " + JSON.stringify(at1.opcoes));
      conferir(at1.grupos.includes("URC"), 'pessoa golden fora do LEGADO (Iuri, grupo URC) deveria aparecer num grupo "URC" — grupos vieram ' + JSON.stringify(at1.grupos));
      conferir(at1.opcoes.some((o) => o.endsWith("::Iuri")), '"Iuri" (pessoa golden nova, fora da lista estática de 32 ids) deveria aparecer como opção — veio ' + JSON.stringify(at1.opcoes));
    }

    // trocar o select de AT-3 (legado) pra "Iuri" grava o id golden novo ("pessoa:502")
    // no Supabase (dublê) — confirma que a escrita usa o id novo, não o antigo formato.
    await evaluate(`(function(){
      const row = [...document.querySelectorAll('.pa-row')].find(r => r.dataset.id === "AT-3");
      const sel = row.querySelector('select.pa-resp');
      sel.value = 'pessoa:502';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await esperar(400);
    const gravado = await ler(`(window.__MOCK.tabelas.plano_acao_atividades.find(a => a.id === "AT-3") || {}).responsavel`);
    conferir(gravado === "pessoa:502", 'depois de trocar pra "Iuri", plano_acao_atividades.responsavel deveria ser "pessoa:502" — veio ' + JSON.stringify(gravado));

    if (erros.length) {
      console.error("FALHOU testar_plano_acao_responsavel_headless:");
      erros.forEach((e) => console.error(" -", e));
      process.exitCode = 1;
    } else {
      console.log("testar_plano_acao_responsavel_headless OK — select de Responsável lê pessoas+coletivos do golden record, ids antigos colapsam certo, legado preservado, escrita nova usa id golden.");
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
