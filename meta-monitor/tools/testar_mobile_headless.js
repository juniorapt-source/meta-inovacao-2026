/* Teste F11: mobile_390x844 — trava a responsividade mobile (item 2.5 do plano de
 * melhorias). Abre um viewport de 390×844 (iPhone 12/13 mini, o "celular estreito" de
 * referência do prompt) via Emulation.setDeviceMetricsOverride e confere:
 *   1) index.html: menu hambúrguer fechado por padrão, abre ao clicar (nav desliza pra
 *      dentro da tela + backdrop aparece), fecha ao clicar no backdrop; KPIs em 2 colunas.
 *   2) plano.html: a tabela vira uma pilha de cards (thead escondido, uma tr = um card
 *      em coluna) — as 47 ações continuam todas lá, só a apresentação muda.
 *   3) agenda.html: mesma conversão tabela→card na lista de encontros.
 *   4) demandas.html: a Matriz em si fica escondida e o aviso "grande demais pro bolso"
 *      aparece no lugar, com link pras demais páginas.
 *   5) corsario.html: a visão Matriz (default) mostra o aviso equivalente; trocando pra
 *      Cards (#cards) o aviso some e os cards aparecem — mobile não é desktop-only ali.
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
const VIEWPORT = { width: 390, height: 844, deviceScaleFactor: 2, mobile: true };

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

async function principal() {
  const chromePath = acharChrome();
  const { server, port } = await iniciarServidor();
  const { proc, wsUrl, perfilTmp } = await iniciarChrome(chromePath);
  const cdp = await conectarCDP(wsUrl);
  const erros = [];

  try {
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Runtime.enable", {}, sessionId);
    // força fallback local (DB_PLANO/DB_AGENDA) em toda navegação desta sessão — inclusive
    // as que acontecem por clique dentro da própria página (kpi-card, Enter na busca, drawer),
    // não só na URL inicial; ?semrede=1 nas URLs de abrir() cobre o caso "URL direta", isto
    // cobre o caso "navegação via JS" (item 3.1 — testes headless não podem depender de rede).
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: "window.CC_FORCAR_FALLBACK = true;" }, sessionId);
    await cdp.send("Emulation.setDeviceMetricsOverride", VIEWPORT, sessionId);

    async function evaluate(expression) {
      const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId);
      if (r.exceptionDetails) throw new Error("erro avaliando no browser: " + JSON.stringify(r.exceptionDetails));
      return r.result.value;
    }
    async function abrir(url) {
      const carregou = cdp.once("Page.loadEventFired");
      await cdp.send("Page.navigate", { url }, sessionId);
      await carregou;
      await esperar(500);
    }

    // ---- 1) index.html: hambúrguer + KPIs em 2 colunas ----
    await abrir("http://127.0.0.1:" + port + "/index.html?semrede=1");
    const navFechadoTransform = await evaluate("getComputedStyle(document.querySelector('.nav')).transform");
    if (navFechadoTransform === "none" || navFechadoTransform === "matrix(1, 0, 0, 1, 0, 0)") {
      erros.push("index.html: menu deveria começar fechado (nav fora da tela), mas transform veio " + navFechadoTransform);
    }
    const kpisCols = await evaluate("getComputedStyle(document.getElementById('kpis')).gridTemplateColumns.split(' ').length");
    if (kpisCols !== 2) erros.push("index.html: #kpis deveria ter 2 colunas no mobile, veio " + kpisCols);

    await evaluate("document.querySelector('.mob-menu-btn').click()");
    await esperar(300);
    const abriu = await evaluate(`JSON.stringify({
      navAberto: document.querySelector('.nav').classList.contains('aberto'),
      navTransform: getComputedStyle(document.querySelector('.nav')).transform,
      backdropDisplay: getComputedStyle(document.querySelector('.mob-backdrop')).display,
      ariaExpanded: document.querySelector('.mob-menu-btn').getAttribute('aria-expanded')
    })`);
    const estadoAberto = JSON.parse(abriu);
    if (!estadoAberto.navAberto) erros.push("index.html: clicar no hambúrguer não abriu o menu (.nav sem .aberto)");
    if (estadoAberto.navTransform !== "matrix(1, 0, 0, 1, 0, 0)" && estadoAberto.navTransform !== "none") {
      erros.push("index.html: nav aberto deveria estar em transform identidade, veio " + estadoAberto.navTransform);
    }
    if (estadoAberto.backdropDisplay !== "block") erros.push("index.html: backdrop deveria estar visível (display:block) com o menu aberto");
    if (estadoAberto.ariaExpanded !== "true") erros.push('index.html: botão do menu deveria ter aria-expanded="true" quando aberto');

    await evaluate("document.querySelector('.mob-backdrop').click()");
    await esperar(300);
    const fechouComBackdrop = await evaluate("!document.querySelector('.nav').classList.contains('aberto')");
    if (!fechouComBackdrop) erros.push("index.html: clicar no backdrop não fechou o menu");

    // reabre e fecha clicando num link — mesmo comportamento pedido ("fechar ao navegar")
    await evaluate("document.querySelector('.mob-menu-btn').click()");
    await esperar(200);
    await evaluate("document.querySelector('.nav a[href=\"caminho.html\"]').click()");
    await esperar(150);
    const fechouComLink = await evaluate("!document.querySelector('.nav').classList.contains('aberto')");
    if (!fechouComLink) erros.push('index.html: clicar num link do menu não fechou ele (antes da navegação completar)');

    // ---- 2) plano.html: tabela vira cards ----
    await abrir("http://127.0.0.1:" + port + "/plano.html?semrede=1");
    const plano = JSON.parse(await evaluate(`JSON.stringify({
      theadDisplay: getComputedStyle(document.querySelector('table.tabela-ordenavel thead')).display,
      cards: document.querySelectorAll('table.tabela-ordenavel tr.clicavel').length,
      primeiraLinhaFlexDirection: getComputedStyle(document.querySelector('table.tabela-ordenavel tr.clicavel')).flexDirection,
      filtrosDirection: getComputedStyle(document.querySelector('.filtros')).flexDirection
    })`));
    if (plano.theadDisplay !== "none") erros.push("plano.html: cabeçalho da tabela deveria sumir no mobile (thead display:none)");
    if (plano.cards !== 47) erros.push("plano.html: esperava 47 cards (uma ação cada), veio " + plano.cards);
    if (plano.primeiraLinhaFlexDirection !== "column") erros.push("plano.html: linha da tabela deveria virar card em coluna (flex-direction:column)");
    if (plano.filtrosDirection !== "column") erros.push("plano.html: filtros deveriam empilhar em coluna no mobile");

    // ---- 3) agenda.html: mesma conversão na lista de encontros ----
    await abrir("http://127.0.0.1:" + port + "/agenda.html?semrede=1");
    const agenda = JSON.parse(await evaluate(`JSON.stringify({
      theadDisplay: getComputedStyle(document.querySelector('#encontros table thead')).display,
      primeiraLinhaFlexDirection: getComputedStyle(document.querySelector('#encontros table tbody tr')).flexDirection
    })`));
    if (agenda.theadDisplay !== "none") erros.push("agenda.html: cabeçalho da tabela de encontros deveria sumir no mobile");
    if (agenda.primeiraLinhaFlexDirection !== "column") erros.push("agenda.html: linha de encontro deveria virar card em coluna");

    // ---- 4) demandas.html: Matriz escondida + aviso ----
    await abrir("http://127.0.0.1:" + port + "/demandas.html");
    const demandas = JSON.parse(await evaluate(`JSON.stringify({
      avisoDisplay: getComputedStyle(document.getElementById('mz-aviso-mobile')).display,
      avisoTexto: document.getElementById('mz-aviso-mobile').textContent,
      topoDisplay: getComputedStyle(document.querySelector('.mz-topo')).display,
      linksNoAviso: document.querySelectorAll('#mz-aviso-mobile a').length
    })`));
    if (demandas.avisoDisplay !== "block") erros.push("demandas.html: aviso mobile deveria estar visível");
    if (!demandas.avisoTexto.includes("grande demais para o bolso")) erros.push('demandas.html: aviso não cita "grande demais para o bolso"');
    if (demandas.topoDisplay !== "none") erros.push("demandas.html: controles da Matriz (.mz-topo) deveriam ficar escondidos no mobile");
    if (demandas.linksNoAviso < 1) erros.push("demandas.html: aviso deveria linkar pra outras páginas");

    // ---- 5) corsario.html: visão Matriz mostra aviso; Cards não ----
    await abrir("http://127.0.0.1:" + port + "/corsario.html");
    await esperar(400); // fetch ao Supabase (frota/matriz) — dá tempo de renderTudo() rodar pelo menos 1x
    const corsarioMatriz = JSON.parse(await evaluate(`JSON.stringify({
      avisoDisplay: getComputedStyle(document.getElementById('crs-aviso-mobile')).display,
      matrizWrapDisplay: getComputedStyle(document.getElementById('crs-matriz-wrap')).display
    })`));
    if (corsarioMatriz.avisoDisplay !== "block") erros.push("corsario.html (Matriz): aviso mobile deveria estar visível na visão default (Matriz)");
    if (corsarioMatriz.matrizWrapDisplay !== "none") erros.push("corsario.html (Matriz): tabela da Matriz deveria ficar escondida no mobile");

    await evaluate('location.hash = "cards"');
    await esperar(400);
    const corsarioCards = JSON.parse(await evaluate(`JSON.stringify({
      avisoDisplay: getComputedStyle(document.getElementById('crs-aviso-mobile')).display,
      gridDisplay: getComputedStyle(document.getElementById('crs-grid')).display
    })`));
    if (corsarioCards.avisoDisplay !== "none") erros.push("corsario.html (Cards): aviso mobile não deveria aparecer na visão Cards");
    if (corsarioCards.gridDisplay === "none") erros.push("corsario.html (Cards): grid de cards deveria estar visível no mobile");

    if (erros.length) {
      console.error("FALHOU mobile_390x844:");
      erros.forEach((e) => console.error(" -", e));
      process.exitCode = 1;
    } else {
      console.log("mobile_390x844 OK — hambúrguer abre/fecha (clique + backdrop + link) e KPIs em 2 colunas em index.html; " +
        "plano.html com 47 cards; agenda.html com cards; demandas.html e a visão Matriz do Corsário mostrando o aviso desktop-only " +
        "(e a visão Cards do Corsário continuando normal no mobile).");
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
