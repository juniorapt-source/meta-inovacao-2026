/* Teste da aba "matriz" do editor.html — Camada 3 do golden record
 * (docs/PLANO_EXECUCAO_GOLDEN_RECORD.md, item 3.3).
 *
 * O item 3.3 fez a aba parar de ler o seed estático (data/matriz.js) e passar a ler ao
 * vivo, com o MESMO modelo que demandas.html usa: matrizStore.montarModelo() sobre
 * matrizStore.carregar() + DB_PROJETOS.carregar() + DB_CANAIS.carregar(). A LÓGICA desse
 * casamento célula→linha/coluna já está travada em tools/testar_matriz_headless.js (que
 * exercita demandas.html) — o que este arquivo cobre é só a FIAÇÃO que falta: o editor
 * carrega as três fontes, monta a mesma grade e continua somente leitura (a edição de
 * verdade é em demandas.html).
 *
 * Cenários:
 *   1) offline (?semrede=1 + CC_FORCAR_FALLBACK): grade com as dimensões do seed local
 *      (data/projetos.js × data/canais.js), zero <select> editável.
 *   2) online (Supabase trocado por dublê, mesma técnica de testar_matriz_headless.js):
 *      colunas na ordem de `ordem` do catálogo mockado, canal novo no mock vira coluna
 *      nova sem tocar em código, e a grade continua somente leitura mesmo com dado ao
 *      vivo.
 *   3) a asserção mais importante: o snapshot que o botão "Exportar cópia de segurança"
 *      do editor gera (matrizStore.paraSnapshot, escrito em #ed-saida) é IGUAL, byte a
 *      byte e chave a chave, ao que o botão "Exportar matriz" de demandas.html gera —
 *      nos dois modos (offline e online mockado). É a garantia que a sessão do 3.3
 *      verificou manualmente e não commitou.
 *
 * O QUE FICOU DE FORA E POR QUÊ: gravação de célula, órfãos, canal inativo, junção
 * indisponível e o vocabulário de estados — tudo isso já é exercitado em
 * testar_matriz_headless.js sobre demandas.html, que compartilha montarModelo()/
 * paraSnapshot() com o editor (js/matriz-store.js). Repetir aqui só duplicaria o teste
 * sem cobrir fiação nova; o editor não tem caminho de escrita pra exercitar.
 *
 * COMO O SUPABASE É SUBSTITUÍDO: mesma técnica de tools/testar_matriz_headless.js — um
 * script injetado antes de qualquer script da página intercepta a ATRIBUIÇÃO de
 * window.CC_SUPABASE e troca só os três obtentores de client. Pra capturar o que os
 * botões de exportar geram sem clicar "salvar arquivo" de verdade, o mesmo script
 * intercepta URL.createObjectURL (só nesta suíte de teste) e guarda o texto do Blob —
 * nenhuma linha de código de produção precisou de gancho de teste.
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

// idêntico ao interceptor de tools/testar_matriz_headless.js — mesma técnica de
// interceptar a ATRIBUIÇÃO de window.CC_SUPABASE, reaproveitada aqui.
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
      delete devolvido.projeto; delete devolvido.canal;
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

// só de teste: intercepta URL.createObjectURL pra guardar o texto do Blob que os botões
// "Exportar cópia de segurança" (editor.html) e "Exportar matriz" (demandas.html) geram,
// sem precisar de fato clicar "salvar arquivo" num Chrome headless. Nenhum código de
// produção lê window.__ULTIMO_BLOB_TEXTO.
const CAPTURA_DOWNLOAD = `
(function(){
  "use strict";
  var criar = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function(blob){
    try { window.__ULTIMO_BLOB_TEXTO = blob.text(); }
    catch(e){ window.__ULTIMO_BLOB_TEXTO = Promise.reject(e); }
    return criar(blob);
  };
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
      meta_inovacao_matriz_demandas: [
        { id: "u1", iniciativa: "Alfa", foco: "oficina", cnr: "", portal: "formulario", mkt: "", atualizado_em: "2026-08-21T10:00:00Z", atualizado_por: "Sandra" },
        { id: "u2", iniciativa: "Beta", foco: "", cnr: "", portal: "", mkt: "", atualizado_em: null, atualizado_por: null },
        { id: "u3", iniciativa: "Gama", foco: "", cnr: "priorizado", portal: "", mkt: "", atualizado_em: "2026-08-19T10:00:00Z", atualizado_por: "JR." },
      ],
    },
  };
}

/* ------------------------------------------------------------------ testes ---- */

function extrairMatriz(texto) {
  const m = /window\.DB\.matriz = ([\s\S]*);\s*$/.exec(texto || "");
  if (!m) throw new Error("não achei \"window.DB.matriz = ...\" no texto exportado: " + String(texto).slice(0, 300));
  return JSON.parse(m[1]);
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
    await cdp.send("Page.setDownloadBehavior", { behavior: "deny" }, sessionId);

    async function evaluate(expression) {
      const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId);
      if (r.exceptionDetails) throw new Error("erro avaliando no browser: " + JSON.stringify(r.exceptionDetails));
      return r.result.value;
    }
    const ler = async (expr) => JSON.parse(await evaluate("JSON.stringify(" + expr + ")"));

    let scriptId = null;
    async function abrir(pagina, mock, querystring) {
      if (scriptId) { await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: scriptId }, sessionId); scriptId = null; }
      const fonte = (mock
        ? "window.__MOCK = " + JSON.stringify(mock) + ";\n" + INTERCEPTOR
        : "window.CC_FORCAR_FALLBACK = true;") + "\n" + CAPTURA_DOWNLOAD;
      const r = await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: fonte }, sessionId);
      scriptId = r.identifier;
      const carregou = cdp.once("Page.loadEventFired");
      await cdp.send("Page.navigate", { url: "http://127.0.0.1:" + port + "/" + pagina + (querystring || "") }, sessionId);
      await carregou;
      await esperar(600); // catálogos + células
    }

    async function selecionarMatriz() {
      await evaluate(`(function(){
        const sel = document.getElementById('ed-conjunto');
        sel.value = 'matriz';
        sel.dispatchEvent(new Event('change', { bubbles: true }));
      })()`);
      await esperar(600);
    }

    const LEITURA_EDITOR = `(function(){
      const tab = document.querySelector('#ed-area table.ed-matriz');
      if(!tab) return { presente: false };
      const cab = [...tab.querySelectorAll('thead th')].map(th => th.textContent.trim());
      const linhas = [...tab.querySelectorAll('tbody tr')].map(tr => {
        const tds = [...tr.children];
        return { iniciativa: tds[0].textContent.trim(), celulas: tds.slice(1).map(td => td.textContent.trim()) };
      });
      return {
        presente: true, cab, linhas,
        selects: tab.querySelectorAll('select').length,
        avisoLeitura: (document.querySelector('#ed-area .aviso') || {}).textContent || '',
      };
    })()`;

    /* ---- 1) offline (?semrede=1): seed local, somente leitura ---- */
    await abrir("editor.html", null, "?semrede=1");
    await selecionarMatriz();
    const off = await ler(LEITURA_EDITOR);
    const esperadoOff = await ler("({ projetos: window.DB.projetos.length, canais: window.DB.canais.length })");
    conferir(off.presente, "offline: a tabela da matriz não apareceu na aba do editor");
    conferir(off.linhas.length === esperadoOff.projetos,
      `offline: ${off.linhas.length} linha(s) na grade do editor, esperava ${esperadoOff.projetos} (data/projetos.js)`);
    conferir(off.cab.length === esperadoOff.canais + 1,
      `offline: ${off.cab.length - 1} coluna(s) de canal no editor, esperava ${esperadoOff.canais} (data/canais.js)`);
    conferir(off.selects === 0, "offline: a aba matriz do editor não pode oferecer <select> — achei " + off.selects);
    conferir(/só(mente)? leitura/i.test(off.avisoLeitura),
      'offline: o aviso da aba deveria dizer que é só leitura — veio "' + off.avisoLeitura + '"');
    notas.push("offline " + off.linhas.length + "×" + (off.cab.length - 1) + " somente leitura no editor");

    /* ---- 2) online: colunas na ordem de `ordem`, valores batendo com o mock ---- */
    await abrir("editor.html", cenarioBase());
    await selecionarMatriz();
    const on = await ler(LEITURA_EDITOR);
    conferir(JSON.stringify(on.cab) === JSON.stringify(["Iniciativa", "Foco+", "CNR", "Portal", "Marketing Cloud"]),
      "online: cabeçalho do editor deveria seguir a coluna `ordem` do catálogo — veio " + JSON.stringify(on.cab));
    conferir(on.linhas.map((l) => l.iniciativa).join("|") === "Alfa|Beta|Gama",
      "online: linhas do editor deveriam vir do portfólio, na ordem dele — veio " + on.linhas.map((l) => l.iniciativa).join("|"));
    conferir(on.selects === 0, "online: a aba matriz do editor continua somente leitura mesmo com dado ao vivo — achei " + on.selects + " select");
    // badges vêm traduzidos por CC_STATUS (rótulo, não a chave crua) — célula vazia é
    // sempre "—"; as três gravadas no mock têm rótulo próprio (ver js/status.js).
    conferir(on.linhas[0].celulas.join(",") === "oficina feita,—,formulário ok,—",
      "online: célula de Alfa não bate com o mock — " + JSON.stringify(on.linhas[0].celulas));
    conferir(on.linhas[1].celulas.every((v) => v === "—"),
      "online: Beta não tem nada gravado no mock, deveria vir tudo vazio no editor — " + JSON.stringify(on.linhas[1].celulas));
    conferir(on.linhas[2].celulas.join(",") === "—,priorizado,—,—",
      "online: célula de Gama não bate com o mock — " + JSON.stringify(on.linhas[2].celulas));
    notas.push("online " + on.cab.slice(1).join(",") + " lido ao vivo no editor");

    /* ---- 3) canal novo no catálogo => coluna nova, sem deploy e sem ALTER TABLE ---- */
    const comCanalNovo = cenarioBase();
    comCanalNovo.tabelas.meta_inovacao_canais.push({ id: 25, slug: "empresa", nome: "Sebrae na sua empresa", nome_completo: "Sebrae na sua empresa", pauta: [], ordem: 5, ativo: true });
    await abrir("editor.html", comCanalNovo);
    await selecionarMatriz();
    const novo = await ler(LEITURA_EDITOR);
    conferir(novo.cab.length === 6 && novo.cab[5] === "Sebrae na sua empresa",
      "canal novo: a coluna deveria aparecer sozinha ao fim da grade do editor — cabeçalho veio " + JSON.stringify(novo.cab));
    conferir(novo.linhas.every((l) => l.celulas[4] === "—"),
      "canal novo: a coluna nova deveria nascer vazia no editor em todas as linhas — " + JSON.stringify(novo.linhas.map((l) => l.celulas[4])));
    notas.push("canal novo apareceu no editor sem tocar em HTML/SQL");

    /* ---- 4) snapshot: editor.html e demandas.html exportam a MESMA coisa, chave a
     *        chave, nos dois modos (offline e online mockado). É a garantia do 3.3. ---- */
    async function exportarEditor(mock, querystring) {
      await abrir("editor.html", mock, querystring);
      await selecionarMatriz();
      await evaluate(`document.getElementById('ed-baixar').click()`);
      return evaluate(`document.getElementById('ed-saida').value`);
    }
    async function exportarDemandas(mock, querystring) {
      await abrir("demandas.html", mock, querystring);
      await evaluate(`document.getElementById('mz-exportar').click()`);
      return evaluate(`window.__ULTIMO_BLOB_TEXTO`);
    }

    const textoEditorOff = await exportarEditor(null, "?semrede=1");
    const textoDemandasOff = await exportarDemandas(null, "?semrede=1");
    conferir(textoEditorOff === textoDemandasOff,
      "snapshot offline: editor.html e demandas.html exportaram textos diferentes — editor:\n" + textoEditorOff + "\n---\ndemandas:\n" + textoDemandasOff);
    const matrizEditorOff = extrairMatriz(textoEditorOff);
    const matrizDemandasOff = extrairMatriz(textoDemandasOff);
    conferir(JSON.stringify(matrizEditorOff) === JSON.stringify(matrizDemandasOff),
      "snapshot offline: os objetos exportados divergem — editor:\n" + JSON.stringify(matrizEditorOff) + "\n---\ndemandas:\n" + JSON.stringify(matrizDemandasOff));

    const mockSnapshot = cenarioBase();
    const textoEditorOn = await exportarEditor(mockSnapshot);
    const textoDemandasOn = await exportarDemandas(mockSnapshot);
    conferir(textoEditorOn === textoDemandasOn,
      "snapshot online: editor.html e demandas.html exportaram textos diferentes — editor:\n" + textoEditorOn + "\n---\ndemandas:\n" + textoDemandasOn);
    const matrizEditorOn = extrairMatriz(textoEditorOn);
    const matrizDemandasOn = extrairMatriz(textoDemandasOn);
    conferir(JSON.stringify(matrizEditorOn) === JSON.stringify(matrizDemandasOn),
      "snapshot online: os objetos exportados divergem — editor:\n" + JSON.stringify(matrizEditorOn) + "\n---\ndemandas:\n" + JSON.stringify(matrizDemandasOn));
    // conteúdo real, não só igualdade vazia — confere que Alfa/foco realmente veio "oficina"
    conferir(matrizEditorOn.Alfa && matrizEditorOn.Alfa.foco === "oficina" && matrizEditorOn.Alfa.portal === "formulario",
      "snapshot online: o snapshot do editor deveria trazer Alfa.foco=oficina e Alfa.portal=formulario — veio " + JSON.stringify(matrizEditorOn.Alfa));
    notas.push("snapshot do editor == snapshot de demandas.html (offline e online)");

    if (erros.length) {
      console.error("FALHOU matriz_editor_headless:");
      erros.forEach((e) => console.error(" -", e));
      process.exitCode = 1;
    } else {
      console.log("matriz_editor_headless OK — " + notas.join(" · ") + ".");
    }
  } finally {
    cdp.close();
    await encerrarChrome(proc);
    server.close();
    await limparPerfil(perfilTmp);
  }
}

principal().catch((e) => { console.error("ERRO:", e.message); process.exit(1); });
