/* Teste F16: projetos_fallback — cobre o novo caminho de leitura de projetos.html
 * ("Correções v0.18.x": projetos saiu de data/projetos.js direto pra Supabase, com
 * fallback pro mesmo arquivo). Sem teste nenhum até esta rodada — este é o primeiro.
 *
 * Abre com ?semrede=1 (+ CC_FORCAR_FALLBACK) pra exercitar o fallback de forma
 * determinística, sem depender de meta_inovacao_projetos já existir em produção.
 * Confere: aviso de dados locais, contagem geral, filtro por núcleo e busca por texto.
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

  try {
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    await cdp.send("Page.enable", {}, sessionId);
    await cdp.send("Runtime.enable", {}, sessionId);
    // força fallback local (DB_PLANO) — mesmo mecanismo dos outros testes headless desde
    // o P10 (item 3.1): sem isso este teste dependeria de rede real pra ler o plano.
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: "window.CC_FORCAR_FALLBACK = true;" }, sessionId);

    async function evaluate(expression) {
      const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId);
      if (r.exceptionDetails) throw new Error("erro avaliando no browser: " + JSON.stringify(r.exceptionDetails));
      return r.result.value;
    }

    const carregou = cdp.once("Page.loadEventFired");
    await cdp.send("Page.navigate", { url: "http://127.0.0.1:" + port + "/projetos.html?semrede=1" }, sessionId);
    await carregou;
    await esperar(300);

    const erros = [];

    const esperado = JSON.parse(await evaluate(`JSON.stringify((function(){
      const projetos = window.DB.projetos;
      const nucleos = [...new Set(projetos.map(p => p.nucleo))];
      const primeiroNucleo = nucleos[0];
      const naPrimeiroNucleo = projetos.filter(p => p.nucleo === primeiroNucleo).length;
      return { total: projetos.length, nucleos: nucleos.length, primeiroNucleo, naPrimeiroNucleo };
    })())`));

    const estado = JSON.parse(await evaluate(`JSON.stringify({
      avisoVisivel: !document.getElementById('aviso-fallback').hidden,
      contagemTexto: document.getElementById('contagem').textContent,
      opcoesNucleo: document.querySelectorAll('#f-nucleo option').length - 1, // -1 = "Todos os núcleos"
      secoes: document.querySelectorAll('#secoes details').length,
    })`));

    if (!estado.avisoVisivel) erros.push('aviso de "dados locais" não apareceu com ?semrede=1');
    if (!estado.contagemTexto.includes(esperado.total + " de " + esperado.total)) {
      erros.push(`contagem inicial não bate: "${estado.contagemTexto}" (esperava conter "${esperado.total} de ${esperado.total}")`);
    }
    if (estado.opcoesNucleo !== esperado.nucleos) {
      erros.push(`opções do select de núcleo (${estado.opcoesNucleo}) não bate com núcleos distintos em DB.projetos (${esperado.nucleos})`);
    }
    if (estado.secoes !== esperado.nucleos) {
      erros.push(`seções <details> renderizadas (${estado.secoes}) não bate com núcleos distintos (${esperado.nucleos})`);
    }

    // filtro por núcleo
    await evaluate(`(function(){
      const sel = document.getElementById('f-nucleo');
      sel.value = ${JSON.stringify(esperado.primeiroNucleo)};
      sel.dispatchEvent(new Event('change'));
    })()`);
    await esperar(150);
    const contagemFiltrada = await evaluate("document.getElementById('contagem').textContent");
    if (!contagemFiltrada.includes(esperado.naPrimeiroNucleo + " de " + esperado.total)) {
      erros.push(`filtro por núcleo "${esperado.primeiroNucleo}": "${contagemFiltrada}" (esperava conter "${esperado.naPrimeiroNucleo} de ${esperado.total}")`);
    }
    const secoesAposFiltro = await evaluate("document.querySelectorAll('#secoes details').length");
    if (secoesAposFiltro !== 1) erros.push(`filtro por núcleo devia deixar 1 seção visível, veio ${secoesAposFiltro}`);

    // volta o filtro e testa busca por texto (usa o próprio nome do núcleo filtrado como termo)
    await evaluate(`(function(){
      document.getElementById('f-nucleo').value = '';
      document.getElementById('f-nucleo').dispatchEvent(new Event('change'));
      const busca = document.getElementById('f-busca');
      busca.value = 'zzz-termo-que-nao-existe-em-nenhuma-iniciativa';
      busca.dispatchEvent(new Event('input'));
    })()`);
    await esperar(150);
    const contagemSemResultado = await evaluate("document.getElementById('contagem').textContent");
    if (!contagemSemResultado.startsWith("0 de " + esperado.total)) {
      erros.push(`busca por termo inexistente devia zerar a contagem: "${contagemSemResultado}"`);
    }

    if (erros.length) {
      console.error("FALHOU projetos_fallback:");
      erros.forEach((e) => console.error(" -", e));
      process.exitCode = 1;
    } else {
      console.log(`projetos_fallback OK — ${esperado.total} iniciativas em ${esperado.nucleos} núcleos, filtro por núcleo e busca por texto bateram.`);
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
