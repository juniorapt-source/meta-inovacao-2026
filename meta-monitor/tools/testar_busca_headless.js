/* Teste F12: busca_global — trava a busca global client-side (item 2.6 do plano de
 * melhorias, js/busca.js). Abre index.html e confere:
 *   1) atalho "/" foca o campo de busca do sidebar.
 *   2) buscar um ID de ação conhecido ("CMT-01") retorna exatamente esse resultado, no
 *      grupo "Ações", com o link certo (plano.html?q=CMT-01#CMT-01); ArrowDown + Enter
 *      navega de verdade pra lá.
 *   3) buscar uma iniciativa conhecida ("Sebraetec") retorna resultado no grupo
 *      "Iniciativas" linkando pra corsario.html?q=Sebraetec#cards (visão CARDS, pedido
 *      explícito) — e corsario.html realmente abre nessa visão com a busca preenchida.
 *   4) buscar uma pessoa conhecida ("Sandra") retorna resultado no grupo "Pessoas"
 *      linkando pra minhas-acoes.html?pessoa=sandra.
 *   5) no viewport mobile (390×844), o botão de busca do header abre o painel e a busca
 *      funciona por ali também (entrada alternativa pedida "no header mobile").
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

    async function evaluate(expression) {
      const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId);
      if (r.exceptionDetails) throw new Error("erro avaliando no browser: " + JSON.stringify(r.exceptionDetails));
      return r.result.value;
    }
    async function abrir(url) {
      const carregou = cdp.once("Page.loadEventFired");
      await cdp.send("Page.navigate", { url }, sessionId);
      await carregou;
      await esperar(400);
    }
    async function digitar(seletor, texto) {
      await evaluate(`(function(){ const el = document.querySelector(${JSON.stringify(seletor)}); el.value = ${JSON.stringify(texto)}; el.dispatchEvent(new Event("input")); })()`);
      await esperar(150);
    }

    // ---- 1) atalho "/" foca a busca ----
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
    await abrir("http://127.0.0.1:" + port + "/index.html");
    await evaluate("document.body.focus()");
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "/", text: "/" }, sessionId);
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "/" }, sessionId);
    await esperar(150);
    const focoAposBarra = await evaluate("document.activeElement.id");
    if (focoAposBarra !== "busca-input-nav") erros.push('atalho "/" não focou #busca-input-nav (focou "' + focoAposBarra + '")');

    // ---- 2) ID de ação conhecido: CMT-01 ----
    await digitar("#busca-input-nav", "CMT-01");
    const resultadoAcao = JSON.parse(await evaluate(`JSON.stringify({
      grupos: [...document.querySelectorAll('#busca-resultados-nav .busca-grupo-titulo')].map(e=>e.textContent),
      itens: [...document.querySelectorAll('#busca-resultados-nav a.busca-item')].map(a=>({tipo:a.dataset.tipo, href:a.getAttribute('href'), texto:a.textContent}))
    })`));
    if (resultadoAcao.itens.length !== 1) erros.push('busca "CMT-01" deveria achar exatamente 1 resultado, achou ' + resultadoAcao.itens.length);
    else {
      const item = resultadoAcao.itens[0];
      if (item.tipo !== "acao") erros.push('resultado de "CMT-01" deveria ser do tipo "acao", veio "' + item.tipo + '"');
      if (item.href !== "plano.html?q=CMT-01#CMT-01") erros.push('link de "CMT-01" errado: veio "' + item.href + '", esperava "plano.html?q=CMT-01#CMT-01"');
    }
    if (!resultadoAcao.grupos.includes("Ações")) erros.push('busca "CMT-01" não mostrou o grupo "Ações"');

    // navega de verdade via ArrowDown + Enter
    await evaluate("document.getElementById('busca-input-nav').dispatchEvent(new KeyboardEvent('keydown', {key:'ArrowDown', bubbles:true}))");
    await esperar(80);
    const carregouPlano = cdp.once("Page.loadEventFired");
    await evaluate("document.getElementById('busca-input-nav').dispatchEvent(new KeyboardEvent('keydown', {key:'Enter', bubbles:true, cancelable:true}))");
    await carregouPlano;
    await esperar(300);
    const urlDepoisAcao = await evaluate("location.pathname + location.search + location.hash");
    if (urlDepoisAcao !== "/plano.html?q=CMT-01#CMT-01") erros.push('Enter no resultado de "CMT-01" não navegou certo: veio "' + urlDepoisAcao + '"');
    const filtroAplicado = await evaluate("document.getElementById('f-busca') ? document.getElementById('f-busca').value : null");
    if (filtroAplicado !== "CMT-01") erros.push('plano.html não aplicou o ?q=CMT-01 no campo de busca da página (veio "' + filtroAplicado + '")');

    // ---- 3) iniciativa conhecida: Sebraetec → corsario.html visão CARDS ----
    await abrir("http://127.0.0.1:" + port + "/index.html");
    await digitar("#busca-input-nav", "Sebraetec");
    const resultadoIniciativa = JSON.parse(await evaluate(`JSON.stringify({
      grupos: [...document.querySelectorAll('#busca-resultados-nav .busca-grupo-titulo')].map(e=>e.textContent),
      href: (document.querySelector('#busca-resultados-nav a[data-tipo="iniciativa"]') || {}).getAttribute
        ? document.querySelector('#busca-resultados-nav a[data-tipo="iniciativa"]').getAttribute('href') : null
    })`));
    if (!resultadoIniciativa.grupos.includes("Iniciativas")) erros.push('busca "Sebraetec" não mostrou o grupo "Iniciativas"');
    if (resultadoIniciativa.href !== "corsario.html?q=Sebraetec#cards") {
      erros.push('link de "Sebraetec" errado: veio "' + resultadoIniciativa.href + '", esperava "corsario.html?q=Sebraetec#cards"');
    }
    if (resultadoIniciativa.href) {
      await abrir("http://127.0.0.1:" + port + "/" + resultadoIniciativa.href);
      await esperar(600); // fetch ao Supabase (frota) — dá tempo do primeiro render acontecer
      const estadoCorsario = JSON.parse(await evaluate(`JSON.stringify({
        buscaValor: document.getElementById('crs-busca').value,
        visaoAtiva: document.querySelector('#crs-segmento button.ativo').dataset.visao,
        gridDisplay: getComputedStyle(document.getElementById('crs-grid')).display
      })`));
      if (estadoCorsario.buscaValor !== "Sebraetec") erros.push('corsario.html não preencheu a busca com "Sebraetec" (veio "' + estadoCorsario.buscaValor + '")');
      if (estadoCorsario.visaoAtiva !== "cards") erros.push('corsario.html#cards não abriu na visão Cards (veio "' + estadoCorsario.visaoAtiva + '")');
    }

    // ---- 4) pessoa conhecida: Sandra → minhas-acoes.html?pessoa=sandra ----
    await abrir("http://127.0.0.1:" + port + "/index.html");
    await digitar("#busca-input-nav", "Sandra");
    const hrefPessoa = await evaluate(`(document.querySelector('#busca-resultados-nav a[href="minhas-acoes.html?pessoa=sandra"]') ? "achou" : "NAO ACHOU")`);
    if (hrefPessoa !== "achou") erros.push('busca "Sandra" não retornou um resultado linkando pra "minhas-acoes.html?pessoa=sandra"');

    // ---- 5) mobile: botão do header abre o painel e busca funciona por ali ----
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }, sessionId);
    await abrir("http://127.0.0.1:" + port + "/index.html");
    await evaluate("document.querySelector('.mob-busca-btn').click()");
    await esperar(200);
    const painelAberto = await evaluate("!document.querySelector('.mob-busca-painel').hidden");
    if (!painelAberto) erros.push("mobile: botão de busca do header não abriu o painel");
    await digitar("#busca-input-mobile", "CMT-01");
    const itemMobile = await evaluate(`(document.querySelector('#busca-resultados-mobile a[href="plano.html?q=CMT-01#CMT-01"]') ? "achou" : "NAO ACHOU")`);
    if (itemMobile !== "achou") erros.push('mobile: busca "CMT-01" no painel do header não retornou o link certo');

    if (erros.length) {
      console.error("FALHOU busca_global:");
      erros.forEach((e) => console.error(" -", e));
      process.exitCode = 1;
    } else {
      console.log('busca_global OK — "/" foca o campo, "CMT-01" acha a ação certa e navega (com ?q= aplicado em plano.html), ' +
        '"Sebraetec" acha a iniciativa e abre corsario.html na visão Cards com a busca preenchida, "Sandra" acha a pessoa ' +
        "certa, e o painel de busca do header mobile funciona igual.");
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
