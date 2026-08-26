/* Teste da aba "Projetos & Representantes" do editor.html — Camada 4 do golden
 * record (docs/PLANO_EXECUCAO_GOLDEN_RECORD.md, item 4.1).
 *
 * O item 4.1 trocou o campo de texto livre "Representantes (vírgula)" por um
 * seletor de pessoa: chip removível (js/db-projeto-representantes.js, junção
 * meta_inovacao_projeto_representantes — Camada 2, item 2.2) + <select> de
 * "+ adicionar…" (pessoas ativas de meta_inovacao_pessoas). representantes[]
 * (texto legado) continua sendo gravado em paralelo, porque projetos.html/
 * index.html/js/drawer.js/js/busca.js ainda leem só o array — a Camada 5 decide
 * se algum dia ele é aposentado.
 *
 * Cenários:
 *   1) offline (?semrede=1 + CC_FORCAR_FALLBACK): sem tabela de vínculo pra ler,
 *      a célula cai pro texto puro de representantes[] (mesmo texto de sempre) e
 *      os controles do seletor saem desabilitados — nunca uma escrita de verdade
 *      em modo de teste.
 *   2) online (Supabase trocado por um dublê genérico de tabela — insert/update/
 *      select in-memory, mesma técnica de interceptar a ATRIBUIÇÃO de
 *      window.CC_SUPABASE que tools/testar_matriz_headless.js já usa, só que sem
 *      a lógica de upsert por par projeto/canal, que é específica da matriz):
 *      - projeto já vinculado mostra chip com o nome da pessoa, não com o vínculo
 *        recém-criado disponível de novo no <select>;
 *      - projeto sem vínculo (o placeholder "Núcleo de X") mostra o texto puro,
 *        sem quebrar;
 *      - adicionar uma pessoa grava o vínculo (meta_inovacao_projeto_representantes)
 *        E sincroniza representantes[] (a mesma escrita que projetos.html lê);
 *      - remover o vínculo novo desfaz as duas coisas.
 *
 * COMO O SUPABASE É SUBSTITUÍDO: mesma técnica de tools/testar_matriz_headless.js —
 * um script injetado antes de qualquer script da página intercepta a ATRIBUIÇÃO de
 * window.CC_SUPABASE. Diferente daquele teste, aqui o dublê é uma tabela in-memory
 * genérica (select/insert/update por id), porque as duas tabelas deste item
 * (meta_inovacao_projeto_representantes e meta_inovacao_pessoas) não têm a
 * particularidade de upsert-por-par que a matriz tem.
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
    // ids novos começam bem longe dos ids semeados (9001 aqui embaixo) — sem isso o
    // primeiro insert do teste colidiria com uma linha já existente no mock.
    proximoId: 20000,
    tabelas: {
      meta_inovacao_projetos: [
        { id: 101, nucleo: "Núcleo A", iniciativa: "Alfa", representantes: ["Carol"], ordem: 1 },
        { id: 102, nucleo: "Núcleo B", iniciativa: "Beta", representantes: ["Núcleo de X"], ordem: 2 },
      ],
      meta_inovacao_pessoas: [
        { id: 501, nome: "Carol", nome_completo: null, nome_exibicao: null, papel: null, grupo: "Projetos", nucleo: null, pendente: false, ordem: 1, email: null, ativo: true },
        { id: 502, nome: "Matheus", nome_completo: "Matheus Souza", nome_exibicao: null, papel: null, grupo: "Projetos", nucleo: null, pendente: false, ordem: 2, email: null, ativo: true },
        { id: 503, nome: "Inativa", nome_completo: null, nome_exibicao: null, papel: null, grupo: "Projetos", nucleo: null, pendente: false, ordem: 3, email: null, ativo: false },
      ],
      meta_inovacao_projeto_representantes: [
        { id: 9001, projeto_id: 101, pessoa_id: 501, ordem: 1 },
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

    async function selecionarProjetos() {
      await evaluate(`(function(){
        const sel = document.getElementById('ed-conjunto');
        sel.value = 'projetos';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      })()`);
      await esperar(500);
    }

    const LEITURA = `(function(){
      const linhas = [...document.querySelectorAll('#ed-area tbody tr')].map(tr => ({
        iniciativa: tr.querySelector('[data-f="iniciativa"]').value,
        chips: [...tr.querySelectorAll('.chip.pessoa')].map(c => c.textContent.replace('×','').trim()),
        textoLivre: (tr.querySelector('.ed-repr-vazio')||{}).textContent || null,
        opcoesAdd: [...tr.querySelectorAll('.ed-add-repr option')].map(o => o.textContent).filter(t => t !== '+ adicionar…'),
        addDesabilitado: !!(tr.querySelector('.ed-add-repr')||{}).disabled,
      }));
      return { linhas };
    })()`;

    /* ---- 1) offline: sem vínculo pra ler, cai pro texto puro; controles desabilitados ---- */
    await abrir(null, "?semrede=1");
    await selecionarProjetos();
    const off = await ler(LEITURA);
    conferir(off.linhas.length > 0, "offline: nenhuma linha de projeto apareceu na aba");
    conferir(off.linhas.every(l => l.chips.length === 0), "offline: não deveria haver chip nenhum (sem vínculo pra ler) — veio " + JSON.stringify(off.linhas.map(l => l.chips)));
    conferir(off.linhas.every(l => l.addDesabilitado), "offline: o <select> de adicionar representante deveria estar desabilitado");
    const linhaAliOff = off.linhas.find(l => l.iniciativa === "ALI Academy");
    conferir(!!linhaAliOff && linhaAliOff.textoLivre === "Carol", 'offline: "ALI Academy" deveria mostrar o texto puro "Carol" (data/projetos.js) — veio ' + JSON.stringify(linhaAliOff));
    notas.push("offline: texto puro + seletor desabilitado (sem rede)");

    /* ---- 2) online: chip pro vínculo existente, texto puro pro placeholder sem pessoa ---- */
    await abrir(cenarioBase());
    await selecionarProjetos();
    const on1 = await ler(LEITURA);
    const alfa1 = on1.linhas.find(l => l.iniciativa === "Alfa");
    const beta1 = on1.linhas.find(l => l.iniciativa === "Beta");
    conferir(!!alfa1 && JSON.stringify(alfa1.chips) === JSON.stringify(["Carol"]), 'online: "Alfa" deveria mostrar 1 chip "Carol" — veio ' + JSON.stringify(alfa1 && alfa1.chips));
    conferir(!!alfa1 && !alfa1.opcoesAdd.includes("Carol"), 'online: "Carol" já vinculada não pode aparecer de novo no <select> de "Alfa" — opções: ' + JSON.stringify(alfa1 && alfa1.opcoesAdd));
    conferir(!!alfa1 && !alfa1.opcoesAdd.some(o => o.indexOf("Inativa") >= 0), "online: pessoa inativa não pode aparecer no <select> de adicionar — opções: " + JSON.stringify(alfa1 && alfa1.opcoesAdd));
    conferir(!!beta1 && beta1.chips.length === 0 && beta1.textoLivre === "Núcleo de X", 'online: "Beta" (placeholder sem pessoa) deveria mostrar o texto puro "Núcleo de X" — veio ' + JSON.stringify(beta1));
    notas.push('online: vínculo existente vira chip ("Alfa"→Carol), placeholder sem pessoa continua texto puro ("Beta")');

    /* ---- 3) adicionar: grava o vínculo E sincroniza representantes[] ---- */
    await evaluate(`(function(){
      const tr = [...document.querySelectorAll('#ed-area tbody tr')].find(t => t.querySelector('[data-f="iniciativa"]').value === 'Beta');
      const sel = tr.querySelector('.ed-add-repr');
      const opt = [...sel.options].find(o => o.textContent === 'Matheus Souza');
      sel.value = opt.value;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await esperar(500);
    const on2 = await ler(LEITURA);
    const beta2 = on2.linhas.find(l => l.iniciativa === "Beta");
    conferir(!!beta2 && JSON.stringify(beta2.chips) === JSON.stringify(["Matheus Souza"]), 'adicionar: "Beta" deveria mostrar o chip "Matheus Souza" depois de escolhido — veio ' + JSON.stringify(beta2 && beta2.chips));
    const mockDepoisAdd = await ler("window.__MOCK.tabelas");
    const vinculoNovo = mockDepoisAdd.meta_inovacao_projeto_representantes.find(v => v.projeto_id === 102);
    conferir(!!vinculoNovo && vinculoNovo.pessoa_id === 502, "adicionar: não gravou o vínculo em meta_inovacao_projeto_representantes — veio " + JSON.stringify(mockDepoisAdd.meta_inovacao_projeto_representantes));
    const projetoBetaMock = mockDepoisAdd.meta_inovacao_projetos.find(p => p.id === 102);
    conferir(!!projetoBetaMock && JSON.stringify(projetoBetaMock.representantes) === JSON.stringify(["Núcleo de X", "Matheus"]),
      'adicionar: representantes[] (texto legado) deveria ganhar "Matheus" (nome curto, não nome_completo) mantendo o que já tinha — veio ' + JSON.stringify(projetoBetaMock && projetoBetaMock.representantes));
    notas.push('adicionar representante grava o vínculo E sincroniza representantes[] (texto legado)');

    /* ---- 4) remover: desfaz as duas coisas ---- */
    await evaluate(`(function(){
      const tr = [...document.querySelectorAll('#ed-area tbody tr')].find(t => t.querySelector('[data-f="iniciativa"]').value === 'Beta');
      const chip = [...tr.querySelectorAll('.chip.pessoa')].find(c => c.textContent.indexOf('Matheus') >= 0);
      chip.querySelector('[data-remover-repr]').click();
    })()`);
    await esperar(500);
    const on3 = await ler(LEITURA);
    const beta3 = on3.linhas.find(l => l.iniciativa === "Beta");
    conferir(!!beta3 && beta3.chips.length === 0 && beta3.textoLivre === "Núcleo de X", 'remover: "Beta" deveria voltar a mostrar só o texto puro "Núcleo de X" — veio ' + JSON.stringify(beta3));
    const mockDepoisDel = await ler("window.__MOCK.tabelas");
    const vinculoAindaVivo = mockDepoisDel.meta_inovacao_projeto_representantes.find(v => v.id === vinculoNovo.id && !v.deleted_at);
    conferir(!vinculoAindaVivo, "remover: o vínculo deveria ter deleted_at preenchido (soft-delete) — veio " + JSON.stringify(mockDepoisDel.meta_inovacao_projeto_representantes.find(v => v.id === vinculoNovo.id)));
    const projetoBetaMock2 = mockDepoisDel.meta_inovacao_projetos.find(p => p.id === 102);
    conferir(!!projetoBetaMock2 && JSON.stringify(projetoBetaMock2.representantes) === JSON.stringify(["Núcleo de X"]),
      'remover: representantes[] deveria voltar a ser só ["Núcleo de X"] — veio ' + JSON.stringify(projetoBetaMock2 && projetoBetaMock2.representantes));
    notas.push("remover representante desfaz o vínculo E a sincronização de representantes[]");

    if (erros.length) {
      console.error("FALHOU projetos_editor_representantes_headless:");
      erros.forEach((e) => console.error(" -", e));
      process.exitCode = 1;
    } else {
      console.log("projetos_editor_representantes_headless OK — " + notas.join(" · ") + ".");
    }
  } finally {
    cdp.close();
    await encerrarChrome(proc);
    server.close();
    await limparPerfil(perfilTmp);
  }
}

principal().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
