/* Teste F8: minhas_acoes_lista_contagem_correta — trava a página "Minhas ações"
 * (BACKLOG #003, prompt "Minhas ações por responsável").
 *
 * Escolhe um responsável com ações conhecidas nos dados ("sandra": guardiã dos nós 2/5/6
 * de data/nos.js e responsável, sozinha ou em dupla, por 14 ações de data/plano.js — contas
 * refeitas aqui em Node a partir dos MESMOS dados que o site lê, não hardcoded às cegas) e
 * confere que a página, aberta com ?pessoa=sandra (o link direto do item 2.4), lista
 * exatamente essa contagem nas seções de nós e de ações, e que o resumo do cabeçalho bate.
 *
 * Mesmo padrão de CDP cru (sem Playwright) de tools/testar_dashboard_headless.js — ver
 * comentário de topo lá pra detalhes de como o cliente CDP funciona.
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

/* cliente CDP mínimo sobre o WebSocket nativo do Node — idêntico ao de
   testar_dashboard_headless.js (ver comentário lá pra detalhes). */
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

// ---- expectativa calculada a partir dos MESMOS dados que o site lê (não hardcoded às
// cegas) — mesma lógica de minhas-acoes.html, reimplementada aqui em Node contra
// data/plano.js + data/nos.js + js/responsaveis.js.
function calcularExpectativa(pessoaId) {
  global.window = global;
  delete require.cache[require.resolve(path.join(REPO, "data", "pessoas.js"))];
  delete require.cache[require.resolve(path.join(REPO, "data", "plano.js"))];
  delete require.cache[require.resolve(path.join(REPO, "data", "nos.js"))];
  window.DB = {};
  require(path.join(REPO, "data", "pessoas.js"));
  require(path.join(REPO, "data", "plano.js"));
  require(path.join(REPO, "data", "nos.js"));
  const RESP = require(path.join(REPO, "js", "responsaveis.js"));
  const CALC = require(path.join(REPO, "js", "calc.js"));
  const hoje = (window.DB.config && window.DB.config.hoje_referencia) || new Date().toISOString().slice(0, 10);
  const nos = window.DB.nos.nos.filter((n) => RESP.mapearTexto(window.DB.responsaveis, n.guardiao).ids.includes(pessoaId));
  const acoes = window.DB.plano.filter((a) => Array.isArray(a.responsavel_id) && a.responsavel_id.includes(pessoaId));
  const atrasadosNos = nos.filter((n) => CALC.estadoNo(n, window.DB.plano, hoje) === "risco").length;
  const atrasadosAcoes = acoes.filter((a) => CALC.ehAtrasada(a, hoje)).length;
  const lim7 = CALC.somaDias(hoje, 7);
  const vence7 = acoes.filter((a) => a.prazo_iso && a.status !== "Concluído" && a.prazo_iso >= hoje && a.prazo_iso <= lim7).length;
  return { nos: nos.length, acoes: acoes.length, atrasados: atrasadosNos + atrasadosAcoes, vence7 };
}

async function principal() {
  const PESSOA = "sandra";
  const esperado = calcularExpectativa(PESSOA);

  const chromePath = acharChrome();
  const { server, port } = await iniciarServidor();
  const { proc, wsUrl, perfilTmp } = await iniciarChrome(chromePath);
  const cdp = await conectarCDP(wsUrl);

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

    const carregou = cdp.once("Page.loadEventFired");
    await cdp.send("Page.navigate", { url: "http://127.0.0.1:" + port + "/minhas-acoes.html?pessoa=" + PESSOA }, sessionId);
    await carregou;

    // o resumo só fica visível depois que a seção de atividades (fetch ao Supabase, com
    // import() do supabase-js via CDN) termina de carregar — espera em polling em vez de um
    // sleep fixo, pra não ficar refém da latência de rede numa execução mais lenta.
    let resumoVisivelAgora = false;
    for (let tentativa = 0; tentativa < 20 && !resumoVisivelAgora; tentativa++) {
      await esperar(300);
      resumoVisivelAgora = await evaluate("!document.getElementById('resumo-cabecalho').hidden");
    }

    const erros = [];

    const estado = JSON.parse(await evaluate(`JSON.stringify({
      selecionado: document.getElementById('ver-como').value,
      nosCount: document.querySelectorAll('#secao-nos > .ma-linha').length,
      acoesCount: document.querySelectorAll('#secao-acoes > .ma-linha').length,
      resumoTexto: document.getElementById('resumo-cabecalho').textContent,
      resumoVisivel: !document.getElementById('resumo-cabecalho').hidden,
      url: location.pathname + location.search
    })`));

    if (estado.selecionado !== PESSOA) erros.push(`select "ver-como" não ficou em "${PESSOA}": veio "${estado.selecionado}"`);
    if (estado.url !== "/minhas-acoes.html?pessoa=" + PESSOA) erros.push(`URL não preservou o querystring: veio "${estado.url}"`);
    if (estado.nosCount !== esperado.nos) erros.push(`seção de nós: esperava ${esperado.nos}, veio ${estado.nosCount}`);
    if (estado.acoesCount !== esperado.acoes) erros.push(`seção de ações: esperava ${esperado.acoes}, veio ${estado.acoesCount}`);
    if (!estado.resumoVisivel) erros.push("resumo do cabeçalho não ficou visível");
    const totalEsperadoSemSupabase = esperado.nos + esperado.acoes;
    if (!estado.resumoTexto.includes(totalEsperadoSemSupabase + " ite")) {
      // tolera itens extras vindos do Supabase (atividades por iniciativa), mas nunca menos
      // do que nós+ações — se vier menos, alguma das duas seções não está sendo somada
      const m = estado.resumoTexto.match(/^(\d+) ite/);
      const totalVeio = m ? Number(m[1]) : NaN;
      if (!(totalVeio >= totalEsperadoSemSupabase)) {
        erros.push(`resumo "${estado.resumoTexto}" não bate com o mínimo esperado de ${totalEsperadoSemSupabase} itens (nós+ações)`);
      }
    }
    if (!estado.resumoTexto.includes(esperado.vence7 + (esperado.vence7 === 1 ? " vence em 7 dias" : " vencem em 7 dias"))) {
      erros.push(`resumo "${estado.resumoTexto}" não cita "${esperado.vence7} vencem em 7 dias" como esperado`);
    }

    if (erros.length) {
      console.error("FALHOU minhas_acoes_lista_contagem_correta:");
      erros.forEach((e) => console.error(" -", e));
      process.exitCode = 1;
    } else {
      console.log(`minhas_acoes_lista_contagem_correta OK — pessoa "${PESSOA}": ${estado.nosCount} nós, ${estado.acoesCount} ações, resumo "${estado.resumoTexto}"`);
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
