/* Teste da leitura golden de responsável em minhas-acoes.html — Camada 5, item 5.9
 * (parte 7 da quebra em docs/PLANO_EXECUCAO_GOLDEN_RECORD.md).
 *
 * O item 2.6 já grava vínculos em meta_inovacao_plano_responsaveis (ação × pessoa OU
 * coletivo) desde o item 5.6, mas nenhuma tela lia essa junção ainda — a seção "Ações do
 * plano" desta tela decidia só pelo texto legado responsavel_id[] (item 4.3). Este item faz
 * js/db-plano.js anexar o vínculo cru em a.responsaveis_golden e minhas-acoes.html casar
 * por ele quando a pessoa/coletivo selecionada em "Ver como" tem dbId resolvido.
 *
 * Cenário (Supabase trocado por um dublê genérico de tabela — mesma técnica de
 * tools/testar_dashboard_golden_headless.js/tools/testar_projetos_golden_headless.js):
 *   - "JR." (pessoa golden com id do LEGADO "jr") tem uma ação ligada só pelo texto legado
 *     (responsavel_id: ["jr"], SEM vínculo em meta_inovacao_plano_responsaveis) — prova que
 *     o caminho de sempre continua funcionando, sem regressão.
 *   - "Fulano Golden" (pessoa golden SEM id do LEGADO, golden puro) tem uma ação ligada só
 *     pelo vínculo golden (responsavel_id: [], COM vínculo em
 *     meta_inovacao_plano_responsaveis) — só aparece pra essa pessoa se a tela realmente
 *     leu a junção; é o que "convivendo" quer dizer aqui: um caminho não substitui o outro.
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
// Tabela in-memory genérica só de leitura (select), mesmo dublê de
// tools/testar_dashboard_golden_headless.js — minhas-acoes.html não escreve nada nas
// tabelas cobertas por este cenário (a edição inline de status/prazo não entra no teste).
const INTERCEPTOR = `
(function(){
  "use strict";
  function copia(o){ return JSON.parse(JSON.stringify(o)); }
  function tabelaMock(nome){ return (window.__MOCK.tabelas && window.__MOCK.tabelas[nome]) || []; }

  function executar(q){
    let linhas = tabelaMock(q.tabela).filter(function(r){ return !r.deleted_at; });
    if (q.in) linhas = linhas.filter(function(r){ return (q.in.valores || []).includes(r[q.in.coluna]); });
    return Promise.resolve({ data: copia(linhas), error: null });
  }

  function query(tabela){
    const q = { tabela: tabela };
    const api = {
      select: function(){ return api; }, is: function(){ return api; }, eq: function(){ return api; },
      order: function(){ return api; }, limit: function(){ return api; },
      in: function(coluna, valores){ q.in = { coluna: coluna, valores: valores }; return api; },
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
      meta_inovacao_plano_acoes: [
        // "jr" — ligada só pelo texto legado (responsavel_id), SEM vínculo golden: prova
        // que o caminho de sempre não regrediu.
        { id: "L1", frente: "F", subfrente: "", atividade: "Ação só legado (jr)", responsavel: "JR.",
          responsavel_id: ["jr"], prazo_texto: "", prazo_iso: null, status: "nao_iniciado",
          dependencias: [], cc_tipo: null, no_critico: null, ordem: 1, updated_at: null },
        // "Fulano Golden" — ligada só pelo vínculo golden (meta_inovacao_plano_responsaveis),
        // responsavel_id vazio: só aparece se a tela leu a junção de verdade.
        { id: "G1", frente: "F", subfrente: "", atividade: "Ação só golden (Fulano)", responsavel: "",
          responsavel_id: [], prazo_texto: "", prazo_iso: null, status: "nao_iniciado",
          dependencias: [], cc_tipo: null, no_critico: null, ordem: 2 },
      ],
      meta_inovacao_plano_responsaveis: [
        { id: 1, plano_acao_id: "G1", pessoa_id: 501, coletivo_id: null, ordem: 1 },
      ],
      meta_inovacao_pessoas: [
        // id do LEGADO "jr" (js/db-responsaveis.js) resolve por nome_exibicao "JR.".
        { id: 9, nome_exibicao: "JR.", nome_completo: "José Mendes Junior", grupo: "Coordenação", ativo: true, ordem: 1 },
        // golden puro — nunca esteve em window.DB.responsaveis, sem id do LEGADO.
        { id: 501, nome_exibicao: "Fulano Golden", nome_completo: "Fulano Golden da Silva", grupo: "Projetos", ativo: true, ordem: 2 },
      ],
      meta_inovacao_coletivos: [],
      plano_acao_atividades: [],
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

    async function acoesDaPagina(pessoaId) {
      const carregou = cdp.once("Page.loadEventFired");
      await cdp.send("Page.navigate", { url: "http://127.0.0.1:" + port + "/minhas-acoes.html?pessoa=" + encodeURIComponent(pessoaId) }, sessionId);
      await carregou;
      let selecionado = null;
      for (let tentativa = 0; tentativa < 20; tentativa++) {
        await esperar(300);
        selecionado = await evaluate("document.getElementById('ver-como').value");
        if (selecionado === pessoaId) break;
      }
      return {
        selecionado: selecionado,
        titulos: await evaluate("Array.from(document.querySelectorAll('#secao-acoes .ma-linha .ma-titulo-link')).map(function(a){ return a.textContent; })"),
      };
    }

    // "jr" — só o legado; NÃO deveria ver a ação golden de "Fulano Golden" (pessoa_id 501,
    // sem relação nenhuma com pessoa_id 9 do "jr").
    const jr = await acoesDaPagina("jr");
    conferir(jr.selecionado === "jr", 'select "ver-como" não ficou em "jr": veio "' + jr.selecionado + '"');
    conferir(jr.titulos.includes("Ação só legado (jr)"), '"jr": deveria ver "Ação só legado (jr)" (texto legado) — títulos vistos: ' + JSON.stringify(jr.titulos));
    conferir(!jr.titulos.includes("Ação só golden (Fulano)"), '"jr": NÃO deveria ver "Ação só golden (Fulano)" (vínculo golden é de outra pessoa) — títulos vistos: ' + JSON.stringify(jr.titulos));
    notas.push('"jr" (legado): vê só a ação ligada por texto, sem regressão');

    // "Fulano Golden" — pessoa golden pura (sem id do LEGADO), id de exibição vira
    // "pessoa:501" (js/db-responsaveis.js, chaveNova/dbId). Só aparece a ação golden se a
    // tela de fato leu meta_inovacao_plano_responsaveis.
    const golden = await acoesDaPagina("pessoa:501");
    conferir(golden.selecionado === "pessoa:501", 'select "ver-como" não ficou em "pessoa:501": veio "' + golden.selecionado + '"');
    conferir(golden.titulos.includes("Ação só golden (Fulano)"), '"Fulano Golden": deveria ver "Ação só golden (Fulano)" (vínculo golden) — títulos vistos: ' + JSON.stringify(golden.titulos));
    conferir(!golden.titulos.includes("Ação só legado (jr)"), '"Fulano Golden": NÃO deveria ver "Ação só legado (jr)" (texto legado é de outra pessoa) — títulos vistos: ' + JSON.stringify(golden.titulos));
    notas.push('"Fulano Golden" (golden puro): vê a ação ligada só pelo vínculo de meta_inovacao_plano_responsaveis, prova que a junção foi lida');

    if (erros.length) {
      console.error("FALHOU minhas_acoes_golden_headless:");
      erros.forEach((e) => console.error(" -", e));
      process.exitCode = 1;
    } else {
      console.log("minhas_acoes_golden_headless OK — " + notas.join(" · ") + ".");
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
