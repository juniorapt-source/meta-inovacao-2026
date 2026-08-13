/* Teste F7: kpi_card_navega_para_plano_filtrado — trava a decisão arquitetural do
 * Bloco 2 do plano de melhorias (drill-down de KPI).
 *
 * Os cards de KPI do dashboard (index.html) eram clicáveis pra expandir uma lista
 * inline (decisão da v0.3.6) — esse comportamento foi INTENCIONALMENTE substituído por
 * links reais pra plano.html, já filtrados via querystring (?status=atrasada etc.),
 * porque plano.html agora tem filtro completo + ordenação + busca, tornando a lista
 * inline redundante. Este teste trava a decisão NOVA: clicar no card "Atrasadas" tem
 * que navegar de verdade pra plano.html?status=atrasada, com o filtro de status já
 * aplicado (select em "__atrasadas") e a contagem batendo com o número que o card
 * mostrava antes do clique — sem esse teste, um recuo acidental pro <div>/toggle antigo
 * (ou uma querystring que pare de bater com o vocabulário do select) passaria despercebido
 * pelos outros 5 testes, que não abrem navegador.
 *
 * Sobe um Chrome/Chromium real em modo headless via CDP (Chrome DevTools Protocol) cru,
 * usando só WebSocket/fetch/child_process nativos do Node (>=22) — sem instalar Playwright
 * nem nenhuma outra dependência nova. Os outros 5 testes do repo não usam navegador; este
 * é o único que precisa, porque é o único comportamento que só existe no DOM (clique
 * disparando navegação real entre páginas), não em uma função pura testável isoladamente.
 */
"use strict";
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");

const REPO = path.join(__dirname, "..");

const CAMINHOS_CHROME = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", // macOS
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser", // Linux
];

function acharChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  for (const p of CAMINHOS_CHROME) if (fs.existsSync(p)) return p;
  throw new Error(
    "Não achei um Chrome/Chromium instalado (procurei em: " + CAMINHOS_CHROME.join(", ") +
    "). Defina CHROME_PATH=/caminho/pro/chrome se estiver em outro lugar. " +
    "Este teste usa o navegador já instalado na máquina via CDP cru — não instala Playwright nem nada novo."
  );
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
    const tempo = setTimeout(() => reject(new Error("timeout esperando o Chrome subir e expor o DevTools")), 15000);
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
    setTimeout(() => { proc.kill("SIGKILL"); resolve(); }, 3000); // rede de segurança
  });
}

async function limparPerfil(perfilTmp) {
  if (!perfilTmp) return;
  try {
    await fs.promises.rm(perfilTmp, { recursive: true, force: true, maxRetries: 3 });
  } catch (e) {
    console.error("aviso: não consegui limpar o perfil temporário do Chrome (" + perfilTmp + "):", e.message);
  }
}

/* cliente CDP mínimo sobre o WebSocket nativo do Node — id de mensagem, promessas
   pendentes por id, e um pub/sub simples pros eventos (Page.loadEventFired etc). */
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
    await cdp.send("Page.navigate", { url: "http://127.0.0.1:" + port + "/index.html" }, sessionId);
    await carregou;
    await esperar(300); // dá tempo do script inline terminar de montar os KPIs

    const erros = [];

    // --- cenário: card "Atrasadas" ---
    const antesTxt = await evaluate(`(function(){
      const a = document.querySelector('#kpis a.kpi-link[href="plano.html?status=atrasada"]');
      if (!a) return null;
      return a.querySelector('.n').textContent.trim();
    })()`);
    if (antesTxt === null) erros.push('não achei um <a class="kpi-link" href="plano.html?status=atrasada"> no dashboard');
    const antesNum = Number(antesTxt);

    const carregouPlano = cdp.once("Page.loadEventFired");
    await evaluate('document.querySelector(\'#kpis a.kpi-link[href="plano.html?status=atrasada"]\').click()');
    await carregouPlano;
    await esperar(300); // dá tempo do script inline de plano.html terminar de montar a tabela

    const depoisTxt = await evaluate(`JSON.stringify({
      url: location.pathname + location.search,
      statusSelect: document.getElementById('f-status') ? document.getElementById('f-status').value : null,
      contagem: document.getElementById('contagem') ? document.getElementById('contagem').textContent : null
    })`);
    const depois = JSON.parse(depoisTxt);

    if (depois.url !== "/plano.html?status=atrasada") erros.push(`clique não navegou pra URL esperada: veio "${depois.url}"`);
    if (depois.statusSelect !== "__atrasadas") erros.push(`select de status em plano.html não ficou em "__atrasadas": veio "${depois.statusSelect}"`);
    const depoisNum = depois.contagem ? Number((depois.contagem.match(/^(\d+)/) || [])[1]) : NaN;
    if (Number.isNaN(depoisNum) || depoisNum !== antesNum) {
      erros.push(`contagem não bateu entre o card (${antesNum}) e plano.html filtrado (${depois.contagem})`);
    }

    if (erros.length) {
      console.error("FALHOU kpi_card_navega_para_plano_filtrado:");
      erros.forEach((e) => console.error(" -", e));
      process.exitCode = 1;
    } else {
      console.log(`kpi_card_navega_para_plano_filtrado OK — card mostrava ${antesNum}, clique levou a ${depois.url} com select "${depois.statusSelect}" e a mesma contagem (${depoisNum})`);
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
