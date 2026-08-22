/* Teste da GRADE DINÂMICA da Matriz de demandas — Camada 3 do golden record
 * (docs/PLANO_EXECUCAO_GOLDEN_RECORD.md, itens 3.2/3.4).
 *
 * O que está sendo travado aqui é o teste de aceite da camada, nas duas metades:
 *   1) a grade nova mostra os mesmos estados que a tabela antiga, célula a célula
 *      (a própria página faz essa conferência e a exibe — cenário "conferencia");
 *   2) cadastrar um canal novo em meta_inovacao_canais faz a coluna aparecer SEM DEPLOY
 *      e SEM ALTER TABLE (cenário "canal novo": mesmíssimo HTML/JS servidos, só o
 *      catálogo mudou).
 * Mais os caminhos que, se quebrarem em silêncio, apagam trabalho de gente:
 *   - offline (?semrede=1): 27 iniciativas × 10 canais do seed, somente leitura;
 *   - gravação: UPSERT no par (projeto_id, canal_id), nunca update por id de linha;
 *   - órfãos: célula de projeto fora do portfólio / de canal fora do catálogo continua
 *     visível e marcada, em vez de sumir;
 *   - junção indisponível: a grade se monta pelos ids mesmo assim;
 *   - o <select> só oferece os 7 estados que o CHECK da tabela aceita.
 *
 * COMO O SUPABASE É SUBSTITUÍDO: um script injetado antes de qualquer script da página
 * (Page.addScriptToEvaluateOnNewDocument) intercepta a ATRIBUIÇÃO de window.CC_SUPABASE
 * (js/supabase.js faz `root.CC_SUPABASE = ...`) e troca só os três obtentores de client
 * por um client de mentira que responde a partir de window.__MOCK. Tudo o mais do
 * módulo real continua valendo (mensagemEscritaAmigavel, detalheErro etc.), e nenhuma
 * linha de código de produção precisou de gancho de teste. Nada sai pra rede.
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

const INTERCEPTOR = `
(function(){
  "use strict";
  window.__ESCRITAS = [];
  function copia(o){ return JSON.parse(JSON.stringify(o)); }
  function tabelaMock(nome){ return (window.__MOCK.tabelas && window.__MOCK.tabelas[nome]) || []; }
  function semJuncao(linhas){
    return linhas.map(function(r){ var c = copia(r); delete c.projeto; delete c.canal; return c; });
  }

  function executar(q){
    var linhas = tabelaMock(q.tabela);
    if (q.op === "select") {
      var pedeJuncao = /projeto:|canal:/.test(q.sel || "");
      // simula PostgREST sem conseguir resolver a junção (cache de schema, FK renomeada)
      if (pedeJuncao && window.__MOCK.juncaoFalha) {
        return Promise.resolve({ data: null, error: { code: "PGRST200", message: "could not find a relationship" } });
      }
      return Promise.resolve({ data: pedeJuncao ? copia(linhas) : semJuncao(linhas), error: null });
    }
    if (q.op === "upsert") {
      window.__ESCRITAS.push({ tabela: q.tabela, payload: copia(q.payload), opcoes: copia(q.opcoes || {}) });
      if (window.__MOCK.escritaFalha) {
        return Promise.resolve({ data: null, error: { code: "42501", message: "new row violates row-level security policy" } });
      }
      var alvo = window.__MOCK.tabelas[q.tabela] || (window.__MOCK.tabelas[q.tabela] = []);
      var i = -1;
      for (var k = 0; k < alvo.length; k++) {
        if (alvo[k].projeto_id === q.payload.projeto_id && alvo[k].canal_id === q.payload.canal_id) { i = k; break; }
      }
      var linha;
      if (i > -1) linha = Object.assign(alvo[i], q.payload, { updated_at: "2026-08-22T12:00:00Z" });
      else { linha = Object.assign({ id: 9000 + alvo.length }, q.payload, { updated_at: "2026-08-22T12:00:00Z" }); alvo.push(linha); }
      var devolvido = copia(linha);
      delete devolvido.projeto; delete devolvido.canal; // upsert real também volta sem junção
      return Promise.resolve({ data: q.single ? devolvido : [devolvido], error: null });
    }
    return Promise.resolve({ data: [], error: null });
  }

  function query(tabela){
    var q = { tabela: tabela, op: "select", sel: "*", payload: null, opcoes: null, single: false };
    var api = {
      select: function(s){ if (q.op !== "upsert") { q.op = "select"; q.sel = s || "*"; } return api; },
      is: function(){ return api; }, eq: function(){ return api; }, in: function(){ return api; },
      order: function(){ return api; }, limit: function(){ return api; },
      upsert: function(p, o){ q.op = "upsert"; q.payload = p; q.opcoes = o || {}; return api; },
      insert: function(p){ q.op = "upsert"; q.payload = p; q.opcoes = {}; return api; },
      update: function(p){ q.op = "upsert"; q.payload = p; q.opcoes = {}; return api; },
      single: function(){ q.single = true; return api; },
      then: function(ok, erro){ return executar(q).then(ok, erro); }
    };
    return api;
  }

  var cliente = {
    from: query,
    channel: function(){ var ch = { on: function(){ return ch; }, subscribe: function(){ return ch; } }; return ch; }
  };

  var real = null;
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
  return {
    tabelas: {
      meta_inovacao_projetos: [
        { id: 11, nucleo: "Núcleo A", iniciativa: "Alfa", representantes: [], ordem: 1 },
        { id: 12, nucleo: "Núcleo A", iniciativa: "Beta", representantes: [], ordem: 2 },
        { id: 13, nucleo: "Núcleo B", iniciativa: "Gama", representantes: [], ordem: 3 },
      ],
      // fora de ordem de propósito: a grade tem que ordenar por `ordem`, não pela ordem
      // em que o catálogo veio.
      meta_inovacao_canais: [
        { id: 23, slug: "portal", nome: "Portal", nome_completo: "Portal Sebrae", pauta: [], ordem: 3, ativo: true },
        { id: 21, slug: "foco", nome: "Foco+", nome_completo: "CRM · Foco+", pauta: [], ordem: 1, ativo: true },
        { id: 24, slug: "mkt", nome: "Marketing Cloud", nome_completo: "CRM · Marketing Cloud", pauta: [], ordem: 4, ativo: true },
        { id: 22, slug: "cnr", nome: "CNR", nome_completo: "CNR", pauta: [], ordem: 2, ativo: true },
      ],
      meta_inovacao_matriz_celulas: [
        { id: 101, projeto_id: 11, canal_id: 21, estado: "oficina", updated_at: "2026-08-20T10:00:00Z", updated_by: "JR.", projeto: { iniciativa: "Alfa" }, canal: { slug: "foco" } },
        { id: 102, projeto_id: 11, canal_id: 23, estado: "formulario", updated_at: "2026-08-21T10:00:00Z", updated_by: "Sandra", projeto: { iniciativa: "Alfa" }, canal: { slug: "portal" } },
        { id: 103, projeto_id: 13, canal_id: 22, estado: "priorizado", updated_at: "2026-08-19T10:00:00Z", updated_by: "JR.", projeto: { iniciativa: "Gama" }, canal: { slug: "cnr" } },
      ],
      // tabela antiga: 1 linha por iniciativa, 1 coluna por canal — o mesmo conteúdo
      meta_inovacao_matriz_demandas: [
        { id: "u1", iniciativa: "Alfa", foco: "oficina", cnr: "", portal: "formulario", mkt: "", atualizado_em: "2026-08-21T10:00:00Z", atualizado_por: "Sandra" },
        { id: "u2", iniciativa: "Beta", foco: "", cnr: "", portal: "", mkt: "", atualizado_em: null, atualizado_por: null },
        { id: "u3", iniciativa: "Gama", foco: "", cnr: "priorizado", portal: "", mkt: "", atualizado_em: "2026-08-19T10:00:00Z", atualizado_por: "JR." },
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

    async function evaluate(expression) {
      const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId);
      if (r.exceptionDetails) throw new Error("erro avaliando no browser: " + JSON.stringify(r.exceptionDetails));
      return r.result.value;
    }
    const ler = async (expr) => JSON.parse(await evaluate("JSON.stringify(" + expr + ")"));

    let scriptId = null;
    async function abrir(mock, querystring) {
      if (scriptId) { await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: scriptId }, sessionId); scriptId = null; }
      const fonte = mock
        ? "window.__MOCK = " + JSON.stringify(mock) + ";\n" + INTERCEPTOR
        : "window.CC_FORCAR_FALLBACK = true;";
      const r = await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: fonte }, sessionId);
      scriptId = r.identifier;
      const carregou = cdp.once("Page.loadEventFired");
      await cdp.send("Page.navigate", { url: "http://127.0.0.1:" + port + "/demandas.html" + (querystring || "") }, sessionId);
      await carregou;
      await esperar(600); // catálogos + células + conferência com a tabela antiga
    }

    // leitura padrão da grade renderizada
    const LEITURA = `(function(){
      const cab = [...document.querySelectorAll('#cab th')].map(th => th.textContent.trim());
      const linhas = [...document.querySelectorAll('#matriz tr')].map(tr => {
        const tds = [...tr.children];
        return {
          iniciativa: tds[0].textContent.trim(),
          celulas: tds.slice(1).map(td => {
            const sel = td.querySelector('select');
            return sel ? { editavel: true, valor: sel.value, opcoes: [...sel.options].map(o => o.value) }
                       : { editavel: false, valor: (td.textContent || '').trim() };
          })
        };
      });
      return {
        cab, linhas,
        badges: document.querySelectorAll('#matriz .cel').length,
        selects: document.querySelectorAll('#matriz select.cel-editar').length,
        status: document.getElementById('mz-status').textContent.trim(),
        resumo: document.getElementById('resumo').textContent.trim(),
        dimensao: document.getElementById('mz-dimensao').textContent.trim(),
        conferenciaVisivel: !document.getElementById('mz-conferencia').hidden,
        conferencia: (function(){
          const el = document.getElementById('mz-conferencia');
          const resumo = (el.querySelector('summary') || {}).textContent || '';
          const m = resumo.match(/(\\d+) c\\u00e9lula\\(s\\) conferem \\u00b7 (\\d+) divergem/);
          return {
            resumo: resumo.trim(),
            iguais: m ? Number(m[1]) : null,
            divergem: m ? Number(m[2]) : null,
            linhas: [...el.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => td.textContent.trim()))
          };
        })(),
        avisoMobile: !!document.getElementById('mz-aviso-mobile'),
      };
    })()`;

    /* ---- 1) offline (?semrede=1): seed local, 27 × 10, somente leitura ---- */
    await abrir(null, "?semrede=1");
    const off = await ler(LEITURA);
    const esperadoOff = await ler(`(function(){
      return { projetos: window.DB.projetos.length, canais: window.DB.canais.length };
    })()`);
    conferir(off.linhas.length === esperadoOff.projetos,
      `offline: ${off.linhas.length} linha(s) na grade, esperava ${esperadoOff.projetos} (data/projetos.js)`);
    conferir(off.cab.length === esperadoOff.canais + 1,
      `offline: ${off.cab.length - 1} coluna(s) de canal, esperava ${esperadoOff.canais} (data/canais.js)`);
    conferir(off.badges === esperadoOff.projetos * esperadoOff.canais,
      `offline: ${off.badges} badge(s) .cel, esperava ${esperadoOff.projetos * esperadoOff.canais} (grade cheia, somente leitura)`);
    conferir(off.selects === 0, "offline: a grade não pode ficar editável sem Supabase (achei " + off.selects + " select)");
    conferir(/somente leitura/i.test(off.status), 'offline: status deveria dizer "somente leitura", veio "' + off.status + '"');
    conferir(!off.conferenciaVisivel, "offline: conferência com a tabela antiga não deveria aparecer (não há como conferir sem rede)");
    notas.push("offline " + off.linhas.length + "×" + (off.cab.length - 1) + " somente leitura");

    /* ---- 2) online: grade montada a partir dos dois catálogos ---- */
    await abrir(cenarioBase());
    const on = await ler(LEITURA);
    conferir(JSON.stringify(on.cab) === JSON.stringify(["Iniciativa", "Foco+", "CNR", "Portal", "Marketing Cloud"]),
      "online: cabeçalho deveria seguir a coluna `ordem` do catálogo — veio " + JSON.stringify(on.cab));
    conferir(on.linhas.map((l) => l.iniciativa).join("|") === "Alfa|Beta|Gama",
      "online: linhas deveriam vir do portfólio, na ordem dele — veio " + on.linhas.map((l) => l.iniciativa).join("|"));
    conferir(on.selects === 12, "online: 3 iniciativas × 4 canais = 12 células editáveis, veio " + on.selects);
    const valores = on.linhas.map((l) => l.celulas.map((c) => c.valor).join(","));
    conferir(valores[0] === "oficina,,formulario,", "online: célula de Alfa não bate — " + valores[0]);
    conferir(valores[1] === ",,,", "online: Beta não tem célula nenhuma gravada, deveria vir tudo vazio — " + valores[1]);
    conferir(valores[2] === ",priorizado,,", "online: célula de Gama não bate — " + valores[2]);
    conferir(/Última atualização/.test(on.status) && /Sandra/.test(on.status),
      'online: status deveria trazer a edição mais recente (Sandra, 21/08) — veio "' + on.status + '"');

    /* ---- 3) o <select> só oferece o que o CHECK da tabela aceita ---- */
    const opcoes = on.linhas[0].celulas[0].opcoes;
    conferir(JSON.stringify(opcoes) === JSON.stringify(["", "previsto", "oficina", "formulario", "justificado", "priorizado", "encaminhado"]),
      "online: opções do select deveriam ser os 7 estados do CHECK — veio " + JSON.stringify(opcoes));

    /* ---- 4) conferência célula a célula com a tabela antiga: tudo confere ---- */
    conferir(on.conferenciaVisivel, "online: painel de conferência com a tabela antiga não apareceu");
    // 3 iniciativas × 4 canais na tabela antiga = 12 comparações, todas iguais
    conferir(on.conferencia.iguais === 12 && on.conferencia.divergem === 0 && on.conferencia.linhas.length === 0,
      'online: conferência deveria acusar 12 conferindo / 0 divergindo — veio "' + on.conferencia.resumo + '" com ' + on.conferencia.linhas.length + ' linha(s)');

    /* ---- 5) divergência real aparece na conferência ---- */
    const divergente = cenarioBase();
    divergente.tabelas.meta_inovacao_matriz_demandas[0].cnr = "encaminhado"; // só na tabela antiga
    await abrir(divergente);
    const div = await ler(LEITURA);
    conferir(div.conferencia.iguais === 11 && div.conferencia.divergem === 1,
      'divergência: esperava 11 conferindo / 1 divergindo — veio "' + div.conferencia.resumo + '"');
    conferir(div.conferencia.linhas.length === 1 &&
             JSON.stringify(div.conferencia.linhas[0]) === JSON.stringify(["Alfa", "CNR", "encaminhado", "—"]),
      "divergência: a linha listada deveria ser Alfa × CNR (antiga \"encaminhado\", nova vazia) — veio " + JSON.stringify(div.conferencia.linhas));

    /* ---- 6) canal novo no catálogo => coluna nova, sem deploy e sem ALTER TABLE ---- */
    const comCanalNovo = cenarioBase();
    comCanalNovo.tabelas.meta_inovacao_canais.push({ id: 25, slug: "empresa", nome: "Sebrae na sua empresa", nome_completo: "Sebrae na sua empresa", pauta: [], ordem: 5, ativo: true });
    await abrir(comCanalNovo);
    const novo = await ler(LEITURA);
    conferir(novo.cab.length === 6 && novo.cab[5] === "Sebrae na sua empresa",
      "canal novo: a coluna deveria aparecer sozinha ao fim da grade — cabeçalho veio " + JSON.stringify(novo.cab));
    conferir(novo.selects === 15, "canal novo: 3 × 5 = 15 células editáveis, veio " + novo.selects);
    conferir(novo.linhas.every((l) => l.celulas[4].editavel && l.celulas[4].valor === ""),
      "canal novo: a coluna nova deveria nascer vazia e editável em todas as linhas");
    notas.push("canal novo apareceu sem tocar em HTML/SQL");

    /* ---- 7) gravação: UPSERT no par (projeto_id, canal_id) ---- */
    await abrir(cenarioBase());
    await evaluate(`(function(){
      const sel = document.querySelector('#matriz tr:nth-child(2) td:nth-child(3) select');
      sel.value = 'previsto';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await esperar(400);
    const escritas = await ler("window.__ESCRITAS");
    conferir(escritas.length === 1, "gravação: esperava exatamente 1 escrita, veio " + escritas.length);
    if (escritas.length) {
      const e = escritas[0];
      conferir(e.tabela === "meta_inovacao_matriz_celulas", "gravação: foi pra tabela " + e.tabela);
      conferir(e.payload.projeto_id === 12 && e.payload.canal_id === 22 && e.payload.estado === "previsto",
        "gravação: payload errado — " + JSON.stringify(e.payload));
      conferir(e.opcoes.onConflict === "projeto_id,canal_id",
        "gravação: precisa ser upsert no par único (onConflict), veio " + JSON.stringify(e.opcoes));
      conferir(Object.prototype.hasOwnProperty.call(e.payload, "updated_by"),
        "gravação: payload deveria carregar updated_by (quem editou)");
    }
    const marcaSalvo = await ler(`document.querySelector('#matriz tr:nth-child(2) td:nth-child(3)').className`);
    conferir(/cel-salvo/.test(marcaSalvo), 'gravação: a célula deveria ficar marcada como salva, className="' + marcaSalvo + '"');
    // e a conferência com a tabela antiga tem que se mexer NA HORA: Beta × CNR era vazia
    // nas duas e agora é "previsto" só na nova — 12/0 vira 11/1 sem recarregar a página.
    const posSalvar = await ler(LEITURA);
    conferir(posSalvar.conferencia.iguais === 11 && posSalvar.conferencia.divergem === 1,
      'gravação: a conferência deveria virar 11/1 logo após salvar — veio "' + posSalvar.conferencia.resumo + '"');

    /* ---- 8) escrita recusada pela RLS: célula marcada, nada de erro mudo ---- */
    const recusa = cenarioBase();
    recusa.escritaFalha = true;
    await abrir(recusa);
    await evaluate(`(function(){
      const sel = document.querySelector('#matriz tr:nth-child(1) td:nth-child(2) select');
      sel.value = 'justificado';
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    })()`);
    await esperar(400);
    const falha = await ler(`(function(){
      const td = document.querySelector('#matriz tr:nth-child(1) td:nth-child(2)');
      return { classe: td.className, dica: td.querySelector('select').title };
    })()`);
    conferir(/cel-falhou/.test(falha.classe), "escrita recusada: a célula deveria ficar marcada como falha, veio " + falha.classe);
    conferir(!!falha.dica, "escrita recusada: a célula deveria explicar o motivo no title, veio vazio");

    /* ---- 9) órfãos: nada some em silêncio ---- */
    const orfaos = cenarioBase();
    orfaos.tabelas.meta_inovacao_matriz_celulas.push(
      { id: 104, projeto_id: 99, canal_id: 21, estado: "previsto", updated_at: "2026-08-18T10:00:00Z", updated_by: "JR.", projeto: { iniciativa: "Projeto Fantasma" }, canal: { slug: "foco" } },
      { id: 105, projeto_id: 11, canal_id: 88, estado: "encaminhado", updated_at: "2026-08-18T10:00:00Z", updated_by: "JR.", projeto: { iniciativa: "Alfa" }, canal: { slug: "canal-sumido" } }
    );
    await abrir(orfaos);
    const orf = await ler(LEITURA);
    conferir(orf.linhas.length === 4 && orf.linhas[3].iniciativa.indexOf("Projeto Fantasma") === 0,
      "órfãos: iniciativa fora do portfólio deveria virar linha extra marcada — veio " + JSON.stringify(orf.linhas.map((l) => l.iniciativa)));
    conferir(/fora do portfólio/.test(orf.linhas[3].iniciativa),
      'órfãos: a linha extra deveria estar marcada "fora do portfólio"');
    conferir(orf.cab.length === 6 && /canal-sumido/.test(orf.cab[5]) && /fora do catálogo/.test(orf.cab[5]),
      'órfãos: canal fora do catálogo deveria virar coluna extra marcada — veio ' + JSON.stringify(orf.cab));
    conferir(orf.linhas[0].celulas[4].valor === "encaminhado",
      "órfãos: o estado da célula de canal desconhecido tem que continuar visível");
    notas.push("órfãos de projeto e de canal continuam visíveis e marcados");

    /* ---- 10) canal inativo só some quando não tem mais nada gravado ---- */
    const inativo = cenarioBase();
    inativo.tabelas.meta_inovacao_canais.forEach((c) => { if (c.slug === "mkt") c.ativo = false; }); // sem célula: some
    inativo.tabelas.meta_inovacao_canais.forEach((c) => { if (c.slug === "cnr") c.ativo = false; }); // com célula: fica
    await abrir(inativo);
    const ina = await ler(LEITURA);
    conferir(ina.cab.indexOf("Marketing Cloud") === -1,
      "canal inativo e sem célula deveria sair da grade — cabeçalho " + JSON.stringify(ina.cab));
    conferir(ina.cab.some((t) => /^CNR/.test(t) && /inativo/.test(t)),
      'canal inativo COM célula gravada deveria ficar, marcado "inativo" — cabeçalho ' + JSON.stringify(ina.cab));

    /* ---- 11) junção indisponível: a grade se monta pelos ids mesmo assim ---- */
    const semJuncao = cenarioBase();
    semJuncao.juncaoFalha = true;
    await abrir(semJuncao);
    const sj = await ler(LEITURA);
    conferir(sj.linhas.length === 3 && sj.selects === 12,
      "sem junção: a grade deveria se montar igual pelos ids — " + sj.linhas.length + " linha(s), " + sj.selects + " célula(s)");
    const valoresSJ = sj.linhas.map((l) => l.celulas.map((c) => c.valor).join(","));
    conferir(valoresSJ[0] === "oficina,,formulario," && valoresSJ[2] === ",priorizado,,",
      "sem junção: os estados deveriam ser os mesmos — " + JSON.stringify(valoresSJ));

    if (erros.length) {
      console.error("FALHOU matriz_grade_dinamica:");
      erros.forEach((e) => console.error(" -", e));
      process.exitCode = 1;
    } else {
      console.log("matriz_grade_dinamica OK — " + notas.join(" · ") + ".");
    }
  } finally {
    cdp.close();
    await encerrarChrome(proc);
    server.close();
    await limparPerfil(perfilTmp);
  }
}

principal().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
