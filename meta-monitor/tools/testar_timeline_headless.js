/* Teste F10: timeline_marcadores_bate_com_encontros — trava a visão Timeline de
 * agenda.html (item 2.7 do plano de melhorias). Abre a página, clica no botão TIMELINE e
 * confere que o número de marcadores (.tl-marcador) renderizados é exatamente igual ao
 * número de encontros em data/agenda.js — nenhum perdido (ex.: canal desconhecido) nem
 * duplicado (ex.: encontro caindo em dois dias). Confere também que todo canal de
 * data/canais.js ganhou sua própria linha (uma pra cada, sem juntar nem faltar).
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
    // força fallback local (DB_PLANO/DB_AGENDA) em toda navegação desta sessão — inclusive
    // as que acontecem por clique dentro da própria página (kpi-card, Enter na busca, drawer),
    // não só na URL inicial; ?semrede=1 nas URLs de abrir() cobre o caso "URL direta", isto
    // cobre o caso "navegação via JS" (item 3.1 — testes headless não podem depender de rede).
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: "window.CC_FORCAR_FALLBACK = true;" }, sessionId);

    async function evaluate(expression) {
      const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId);
      if (r.exceptionDetails) throw new Error("erro avaliando no browser: " + JSON.stringify(r.exceptionDetails));
      return r.result.value;
    }

    const carregou = cdp.once("Page.loadEventFired");
    await cdp.send("Page.navigate", { url: "http://127.0.0.1:" + port + "/agenda.html?semrede=1" }, sessionId);
    await carregou;
    await esperar(300);

    const erros = [];

    const totalEncontrosNosDados = await evaluate("DB.agenda.encontros.length");
    const totalCanaisNosDados = await evaluate("DB.canais.length");

    await evaluate("document.getElementById('btn-vista-timeline').click()");
    await esperar(400);

    const estado = JSON.parse(await evaluate(`JSON.stringify({
      timelineVisivel: document.getElementById('vista-timeline').style.display !== 'none',
      btnAtivo: document.getElementById('btn-vista-timeline').classList.contains('ativo'),
      marcadores: document.querySelectorAll('#vista-timeline .tl-marcador').length,
      linhasCanal: document.querySelectorAll('#vista-timeline .tl-canal').length,
      diaCols: document.querySelectorAll('#vista-timeline .tl-dia-cab').length,
      temColunaAdefinir: !!document.querySelector('#vista-timeline .tl-adefinir-cab'),
      primeiroTitle: document.querySelector('#vista-timeline .tl-marcador') ? document.querySelector('#vista-timeline .tl-marcador').getAttribute('title') : null
    })`));

    if (!estado.timelineVisivel) erros.push("clicar em TIMELINE não exibiu #vista-timeline");
    if (!estado.btnAtivo) erros.push('botão "Timeline" não ficou marcado como ativo');
    if (estado.marcadores !== totalEncontrosNosDados) {
      erros.push(`nº de marcadores (${estado.marcadores}) não bate com nº de encontros em data/agenda.js (${totalEncontrosNosDados})`);
    }
    if (estado.linhasCanal !== totalCanaisNosDados) {
      erros.push(`nº de linhas de canal (${estado.linhasCanal}) não bate com nº de canais em data/canais.js (${totalCanaisNosDados})`);
    }
    if (estado.diaCols < 1) erros.push("nenhuma coluna de dia renderizada");
    if (!estado.temColunaAdefinir) erros.push('coluna "A definir" não renderizada');
    if (!estado.primeiroTitle || estado.primeiroTitle.length < 5) erros.push("marcador sem tooltip (atributo title) preenchido");

    // troca de visão: Lista continua acessível e volta a ficar visível/ativa
    await evaluate("document.getElementById('btn-vista-lista').click()");
    await esperar(150);
    const voltouLista = await evaluate("document.getElementById('vista-lista').style.display !== 'none' && document.getElementById('btn-vista-lista').classList.contains('ativo')");
    if (!voltouLista) erros.push("voltar pro botão Lista não reativou a visão Lista");

    if (erros.length) {
      console.error("FALHOU timeline_marcadores_bate_com_encontros:");
      erros.forEach((e) => console.error(" -", e));
      process.exitCode = 1;
    } else {
      console.log(`timeline_marcadores_bate_com_encontros OK — ${estado.marcadores} marcadores (= ${totalEncontrosNosDados} encontros), ${estado.linhasCanal} linhas de canal (= ${totalCanaisNosDados} canais), ${estado.diaCols} colunas de dia + coluna "A definir".`);
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
