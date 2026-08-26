/* Teste da leitura golden de núcleo/canal/facilitador/responsável em
 * canva-consolidado.html — Camada 5, item 5.9 (parte 5 da quebra em
 * docs/PLANO_EXECUCAO_GOLDEN_RECORD.md).
 *
 * O item 2.5 já grava as 4 FKs (nucleo_id, canal_id, facilitador_pessoa_id,
 * responsavel_pessoa_id em meta_inovacao_canva_demandas) desde a Camada 2 — este item só
 * faz a ÚNICA tela que lê essa tabela por SELECT direto (canva.html só grava, via RPC, sem
 * leitura nenhuma) passar a consultar as 4 FKs em vez do texto legado
 * nucleo/canal/facilitador/responsavel, reaproveitando o mesmo padrão de "cai pro texto
 * quando a FK não resolve" que projetos.html/index.html já usam desde a parte 2/3 deste
 * mesmo item, e que js/drawer.js usa desde o item 4.4 (spanPessoaGolden(), exportada em
 * DRAWER especificamente pra esta tela reusar).
 *
 * Cenários, tudo num único carregamento (2 demandas do MESMO projeto, pra exercitar as
 * duas metades — FK resolvida e FK ausente — lado a lado):
 *   - demanda 1 (canal "foco"): nucleo_id, canal_id, facilitador_pessoa_id e
 *     responsavel_pessoa_id TODOS resolvidos — a tela deve mostrar os 4 nomes golden, e
 *     NENHUM dos 4 textos legados correspondentes (prova que leu pela FK, não por
 *     coincidência: os textos legados do cenário são propositalmente diferentes).
 *   - demanda 2 (canal "cnr"): nucleo_id ainda presente (mesmo projeto), mas canal_id nulo
 *     (linha antiga, migração ainda não alcançou), facilitador vazio (campo opcional nunca
 *     preenchido) e responsavel_pessoa_id nulo (nome digitado fora do golden record) — a
 *     tela deve cair pro texto legado nos 3 casos, sem quebrar, e o bloco "Facilitador"
 *     (opcional) deve ficar oculto.
 *   - o catálogo golden de canais só semeia "foco" (rótulo propositalmente diferente do
 *     estático data/canais.js, pra provar a leitura pela FK); "cnr" fica de fora do
 *     catálogo golden de propósito, forçando a tela a cair pro rótulo estático de
 *     data/canais.js pra esse canal — outra prova do "convivendo, não substituindo".
 *
 * Mesmo padrão de CDP cru (sem Playwright) e do mesmo dublê genérico de tabela dos outros
 * testes headless do repo (ver tools/testar_projetos_golden_headless.js).
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
// Tabela in-memory genérica, mesmo dublê de tools/testar_projetos_golden_headless.js.
const INTERCEPTOR = `
(function(){
  "use strict";
  function copia(o){ return JSON.parse(JSON.stringify(o)); }
  function tabelaMock(nome){ return (window.__MOCK.tabelas && window.__MOCK.tabelas[nome]) || []; }

  function executar(q){
    if (q.op === "select") {
      const linhas = tabelaMock(q.tabela).filter(function(r){ return !r.deleted_at; });
      return Promise.resolve({ data: copia(linhas), error: null });
    }
    return Promise.resolve({ data: [], error: null });
  }

  function query(tabela){
    const q = { tabela: tabela, op: "select" };
    const api = {
      select: function(){ q.op = "select"; return api; },
      is: function(){ return api; }, eq: function(){ return api; },
      order: function(){ return api; }, limit: function(){ return api; }, in: function(){ return api; },
      then: function(ok, erro){ return executar(q).then(ok, erro); }
    };
    return api;
  }

  const cliente = {
    from: query,
    rpc: function(){ return Promise.resolve({ data: { ok: false, erro: "RPC não usada neste teste (só leitura)." }, error: null }); },
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
      meta_inovacao_canva_demandas: [
        {
          id: 1, projeto: "Projeto Alfa", projeto_digitado: "Projeto Alfa", projeto_id: 301, projeto_novo: false,
          nucleo: "Texto Legado Núcleo", nucleo_id: 701,
          canal: "foco", canal_id: 9001,
          facilitador: "Texto Legado Facilitador", facilitador_pessoa_id: 501,
          ciclo: null, encontro_id: null,
          servico: "Serviço A", problema: "Problema A", bloqueio: null,
          canal_proprio: "nao", canal_proprio_qual: null,
          responsavel: "Texto Legado Responsável", responsavel_pessoa_id: 502,
          prazo: "2026-12-01", status: "rascunho", autor_nome: "Autor 1",
          sessao_id: "11111111-1111-4111-8111-111111111111", updated_by: null,
          criado_em: "2026-08-20T10:00:00Z", deleted_at: null,
        },
        {
          // mesmo projeto (mesmo grupo na tela), sem FK de canal/facilitador/responsável —
          // linha "antiga", de antes do item 2.5 ou com nome fora do golden record.
          id: 2, projeto: "Projeto Alfa", projeto_digitado: "Projeto Alfa", projeto_id: 301, projeto_novo: false,
          nucleo: "Texto Legado Núcleo", nucleo_id: 701,
          canal: "cnr", canal_id: null,
          facilitador: null, facilitador_pessoa_id: null,
          ciclo: null, encontro_id: null,
          servico: "Serviço B", problema: "Problema B", bloqueio: null,
          canal_proprio: "nao", canal_proprio_qual: null,
          responsavel: "Texto Puro Responsável", responsavel_pessoa_id: null,
          prazo: "2026-12-02", status: "rascunho", autor_nome: "Autor 2",
          sessao_id: "22222222-2222-4222-8222-222222222222", updated_by: null,
          criado_em: "2026-08-21T10:00:00Z", deleted_at: null,
        },
      ],
      meta_inovacao_projetos: [
        { id: 301, nucleo: "Texto Legado Núcleo", nucleo_id: 701, iniciativa: "Projeto Alfa", representantes: [], ordem: 1 },
      ],
      meta_inovacao_nucleos: [
        { id: 701, nome: "Núcleo Golden A", ordem: 1 },
      ],
      // só "foco" semeado, de propósito — "cnr" precisa cair pro rótulo estático de
      // data/canais.js ("CNR: operação ativa e receptiva") pra provar o fallback.
      meta_inovacao_canais: [
        { id: 9001, slug: "foco", nome: "Foco+", nome_completo: "Foco Golden (canal renomeado)", formato: "x", pauta: [], ordem: 1, ativo: true },
      ],
      meta_inovacao_pessoas: [
        { id: 501, nome: "Fac", nome_completo: "Facilitador Completo", nome_exibicao: "Facilitador Golden", papel: null, grupo: "Projetos", nucleo: null, pendente: false, ordem: 1, email: null, ativo: true },
        { id: 502, nome: "Resp", nome_completo: "Responsável Completo", nome_exibicao: "Responsável Golden", papel: null, grupo: "Projetos", nucleo: null, pendente: false, ordem: 2, email: null, ativo: true },
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

    const fonte = "window.__MOCK = " + JSON.stringify(cenario()) + ";\n" + INTERCEPTOR;
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: fonte }, sessionId);

    const carregou = cdp.once("Page.loadEventFired");
    await cdp.send("Page.navigate", { url: "http://127.0.0.1:" + port + "/canva-consolidado.html" }, sessionId);
    await carregou;
    await esperar(600);

    const html = await evaluate("document.getElementById('cvc-lista').innerHTML");

    // núcleo (nucleo_id) — as duas demandas são do mesmo projeto, o badge sai da 1ª
    conferir(html.includes("Núcleo Golden A"), 'demanda com nucleo_id deveria mostrar o núcleo golden "Núcleo Golden A" — não achei no HTML');
    conferir(!html.includes("Texto Legado Núcleo"), 'com nucleo_id resolvido, NÃO deveria sobrar o texto legado "Texto Legado Núcleo" (prova que leu pela FK)');

    // canal (canal_id) — "foco" resolve pro golden, "cnr" cai pro estático
    conferir(html.includes("Foco Golden (canal renomeado)"), 'canal "foco" com canal_id deveria mostrar o rótulo golden — não achei no HTML');
    conferir(!html.includes("CRM · Foco+"), 'canal "foco" com canal_id NÃO deveria mostrar o rótulo estático de data/canais.js (prova que leu pela FK)');
    conferir(html.includes("CNR: operação ativa e receptiva"), 'canal "cnr" SEM canal_id (golden não semeou este canal) deveria cair pro rótulo estático de data/canais.js — não achei no HTML');

    // facilitador/responsável (facilitador_pessoa_id/responsavel_pessoa_id) — lidos só do
    // SPAN de leitura (data-facilitador/data-responsavel), não do HTML da página inteira:
    // o <input> do formulário "Editar / corrigir" continua mostrando o texto legado de
    // propósito (é o que o gestor corrige, e a RPC re-resolve a FK ao salvar) — não é uma
    // regressão, é o campo de edição fazendo o que sempre fez.
    const linha1 = await ler(`(function(){
      const el = document.querySelector('.cvc-linha[data-id="1"]');
      return { facilitador: el.querySelector('[data-facilitador]').textContent, responsavel: el.querySelector('[data-responsavel]').textContent };
    })()`);
    conferir(linha1.facilitador === "Facilitador Golden", 'demanda #1 com facilitador_pessoa_id deveria mostrar o facilitador golden "Facilitador Golden" no span de leitura — veio ' + JSON.stringify(linha1.facilitador));
    conferir(linha1.responsavel === "Responsável Golden", 'demanda #1 com responsavel_pessoa_id deveria mostrar o responsável golden "Responsável Golden" no span de leitura — veio ' + JSON.stringify(linha1.responsavel));

    // demanda 2: sem nenhuma das 3 FKs de pessoa/canal — cai pro texto legado, sem quebrar
    const linha2Resp = await ler(`document.querySelector('.cvc-linha[data-id="2"] [data-responsavel]').textContent`);
    conferir(linha2Resp === "Texto Puro Responsável", 'demanda #2 SEM responsavel_pessoa_id deveria continuar mostrando o texto livre "Texto Puro Responsável" no span de leitura — veio ' + JSON.stringify(linha2Resp));

    // bloco "Facilitador" (opcional) some quando não há nem FK nem texto — checagem
    // estrutural (não só de texto), pela linha #2
    const linha2 = await ler(`(function(){
      const el = document.querySelector('.cvc-linha[data-id="2"]');
      if (!el) return null;
      const wrap = el.querySelector('[data-facilitador-wrap]');
      return { facilitadorOculto: !!(wrap && wrap.hidden) };
    })()`);
    conferir(!!(linha2 && linha2.facilitadorOculto), 'demanda #2 (sem facilitador nenhum) deveria ter o bloco "Facilitador" oculto — veio ' + JSON.stringify(linha2));

    notas.push("núcleo/canal/facilitador/responsável com FK resolvida mostram o golden record; sem FK caem pro texto legado, sem quebrar");

    if (erros.length) {
      console.error("FALHOU canva_consolidado_golden_headless:");
      erros.forEach((e) => console.error(" -", e));
      process.exitCode = 1;
    } else {
      console.log("canva_consolidado_golden_headless OK — " + notas.join(" · ") + ".");
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
