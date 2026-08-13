/* Teste F13: drawer_entidade — trava o drawer lateral de Iniciativa/Pessoa (item 3.2 do
 * plano de melhorias, js/drawer.js). Confere:
 *   1) abrir plano.html#iniciativa=sebraetec renderiza o painel com os 5 blocos
 *      esperados (Núcleo e representante(s) · Posição na régua · Atividades da
 *      iniciativa · Matriz de demandas · Próximos encontros), com a régua batendo
 *      com o valor já conhecido/validado do Corsário (Sebraetec ~49,5% · Marujo).
 *   2) abrir plano.html#pessoa=sandra renderiza o painel de pessoa com os 4 blocos
 *      esperados e as contagens de nós/ações batendo com os dados (mesma pessoa já
 *      usada nos testes de minhas-acoes.html).
 *   3) fechar (botão X) limpa o hash; Esc e clique fora também fecham.
 *   4) um nome clicável real (responsável de uma linha do plano) abre o drawer com o
 *      hash certo.
 *   5) nomes de iniciativa ficam clicáveis em demandas.html e na visão Cards do
 *      Corsário (pontos de ativação da TAREFA 4).
 *
 * Cada navegação de teste passa por "about:blank" antes do URL real — troca só de
 * hash (mesmo path) não dispara Page.loadEventFired de novo, e o teste precisa de um
 * load "de verdade" a cada cenário pra sincronizar certo via CDP.
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
    // navega sempre por "about:blank" primeiro — troca só de #hash no mesmo path não
    // dispara Page.loadEventFired de novo, e cada cenário aqui precisa de um load real.
    async function abrir(url) {
      await cdp.send("Page.navigate", { url: "about:blank" }, sessionId);
      const carregou = cdp.once("Page.loadEventFired");
      await cdp.send("Page.navigate", { url }, sessionId);
      await carregou;
      await esperar(600);
    }
    async function esperarBlocoAsync(id) {
      for (let i = 0; i < 20; i++) {
        const pronto = await evaluate(`!document.querySelector('#${id} .drawer-carregando')`);
        if (pronto) return;
        await esperar(300);
      }
    }

    // ---- 1) #iniciativa=sebraetec ----
    await abrir("http://127.0.0.1:" + port + "/plano.html#iniciativa=sebraetec");
    await esperarBlocoAsync("drawer-regua");
    await esperarBlocoAsync("drawer-ativ-ini");
    await esperarBlocoAsync("drawer-matriz-ini");
    const iniciativa = JSON.parse(await evaluate(`JSON.stringify({
      aberto: document.querySelector('.drawer-painel').classList.contains('aberto'),
      titulo: document.getElementById('drawer-titulo').textContent,
      blocos: [...document.querySelectorAll('.drawer-bloco h3')].map(h=>h.textContent),
      reguaTexto: document.getElementById('drawer-regua').textContent
    })`));
    if (!iniciativa.aberto) erros.push("#iniciativa=sebraetec não abriu o drawer");
    if (iniciativa.titulo !== "Sebraetec") erros.push('título do drawer errado: veio "' + iniciativa.titulo + '", esperava "Sebraetec"');
    const blocosEsperadosIniciativa = ["Núcleo e representante(s)", "Posição na régua do Corsário", "Atividades da iniciativa", "Matriz de demandas", "Próximos encontros"];
    blocosEsperadosIniciativa.forEach((b) => { if (!iniciativa.blocos.includes(b)) erros.push('painel de iniciativa sem o bloco "' + b + '"'); });
    if (!/49,[45]%/.test(iniciativa.reguaTexto) || !iniciativa.reguaTexto.includes("Marujo")) {
      erros.push('régua da Sebraetec não bateu com o valor conhecido (~49,5% · Marujo): veio "' + iniciativa.reguaTexto.slice(0, 60) + '..."');
    }

    // fechar (X) limpa o hash
    await evaluate("document.querySelector('.drawer-fechar').click()");
    await esperar(350);
    const depoisFechar = JSON.parse(await evaluate(`JSON.stringify({
      aberto: document.querySelector('.drawer-painel').classList.contains('aberto'),
      hash: location.hash
    })`));
    if (depoisFechar.aberto) erros.push("botão de fechar (X) não fechou o drawer");
    if (depoisFechar.hash) erros.push('fechar não limpou o hash: ficou "' + depoisFechar.hash + '"');

    // ---- 2) #pessoa=sandra ----
    await abrir("http://127.0.0.1:" + port + "/plano.html#pessoa=sandra");
    await esperarBlocoAsync("drawer-ativ-pessoa");
    const pessoa = JSON.parse(await evaluate(`JSON.stringify({
      aberto: document.querySelector('.drawer-painel').classList.contains('aberto'),
      titulo: document.getElementById('drawer-titulo').textContent,
      blocos: [...document.querySelectorAll('.drawer-bloco h3')].map(h=>h.textContent),
      nosCount: document.querySelectorAll('.drawer-bloco')[1].querySelectorAll('.drawer-linha').length,
      acoesCount: document.querySelectorAll('.drawer-bloco')[2].querySelectorAll('a.drawer-linha').length,
      temLinkMinhasAcoes: !!document.querySelector('a[href="minhas-acoes.html?pessoa=sandra"]')
    })`));
    if (!pessoa.aberto) erros.push("#pessoa=sandra não abriu o drawer");
    if (pessoa.titulo !== "Sandra") erros.push('título do drawer errado: veio "' + pessoa.titulo + '", esperava "Sandra"');
    const blocosEsperadosPessoa = ["Papéis", "Nós do caminho crítico onde é guardiã", "Ações do plano sob responsabilidade", "Atividades por iniciativa"];
    blocosEsperadosPessoa.forEach((b) => { if (!pessoa.blocos.includes(b)) erros.push('painel de pessoa sem o bloco "' + b + '"'); });
    if (pessoa.nosCount !== 3) erros.push("nós da Sandra: esperava 3, veio " + pessoa.nosCount);
    if (pessoa.acoesCount < 1) erros.push("nenhuma ação listada pra Sandra (esperava pelo menos 1)");
    if (!pessoa.temLinkMinhasAcoes) erros.push('painel de pessoa sem o link "ver tudo em Minhas ações"');

    // Esc fecha
    await esperar(150);
    await cdp.send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape" }, sessionId);
    await cdp.send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape" }, sessionId);
    await esperar(300);
    if (await evaluate("document.querySelector('.drawer-painel').classList.contains('aberto')")) erros.push("Esc não fechou o drawer");

    // clique fora (overlay) fecha
    await abrir("http://127.0.0.1:" + port + "/plano.html#pessoa=sandra");
    await esperar(400);
    await evaluate("document.querySelector('.drawer-overlay').click()");
    await esperar(350);
    if (await evaluate("document.querySelector('.drawer-painel').classList.contains('aberto')")) erros.push("clique fora (overlay) não fechou o drawer");

    // ---- 4) nome clicável real ativa o drawer ----
    await abrir("http://127.0.0.1:" + port + "/plano.html");
    const existeClicavel = await evaluate("!!document.querySelector('[data-drawer-pessoa]')");
    if (!existeClicavel) erros.push("plano.html: nenhum responsável ficou clicável (data-drawer-pessoa ausente)");
    else {
      await evaluate("document.querySelector('[data-drawer-pessoa]').click()");
      await esperar(500);
      const hashAposClique = await evaluate("location.hash");
      const painelAposClique = await evaluate("document.querySelector('.drawer-painel').classList.contains('aberto')");
      if (!/^#pessoa=/.test(hashAposClique)) erros.push('clique num responsável não setou o hash certo: veio "' + hashAposClique + '"');
      if (!painelAposClique) erros.push("clique num responsável não abriu o drawer");
    }

    // ---- 5) iniciativa clicável em demandas.html e na visão Cards do Corsário ----
    await abrir("http://127.0.0.1:" + port + "/demandas.html");
    await esperar(1000);
    if (!(await evaluate("!!document.querySelector('#matriz [data-drawer-iniciativa]')"))) {
      erros.push("demandas.html: nenhuma iniciativa da Matriz ficou clicável");
    }
    await abrir("http://127.0.0.1:" + port + "/corsario.html#cards");
    await esperar(1200);
    if (!(await evaluate("!!document.querySelector('.crs-card-nome [data-drawer-iniciativa]')"))) {
      erros.push("corsario.html (Cards): nenhum card de iniciativa ficou clicável");
    }

    if (erros.length) {
      console.error("FALHOU drawer_entidade:");
      erros.forEach((e) => console.error(" -", e));
      process.exitCode = 1;
    } else {
      console.log("drawer_entidade OK — #iniciativa=sebraetec (régua ~49,5%·Marujo) e #pessoa=sandra (3 nós, " + pessoa.acoesCount +
        " ações) renderizam os blocos esperados; fechar (X/Esc/clique fora) limpa o hash; nome clicável em plano.html abre o drawer certo; " +
        "iniciativas clicáveis em demandas.html e no Corsário (Cards).");
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
