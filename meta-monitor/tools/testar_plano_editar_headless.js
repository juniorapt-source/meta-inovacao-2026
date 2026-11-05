/* Teste: edição de uma ação no detalhe da linha de plano.html (visão Lista).
 *
 * Garante que: (1) com dados locais (fallback) o botão "Editar" aparece desabilitado;
 * (2) com dados "do banco", Editar abre o formulário com os valores da ação; (3) Salvar
 * manda pro DB_PLANO.salvar só as colunas alteradas, com o status traduzido pra chave do
 * banco (em_andamento) e o prazo em texto acompanhando a data nova; (4) a linha passa a
 * mostrar o status novo e o detalhe continua aberto; (5) uma falha na gravação mantém o
 * formulário aberto com a mensagem e não altera a ação.
 *
 * Nada é gravado de verdade: DB_PLANO.carregar/salvar são trocados, antes do script da
 * página rodar, por dublês que devolvem o seed local e só registram o patch recebido.
 * Mesmo CDP cru (sem Playwright) dos outros testes headless do repo.
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

// troca DB_PLANO assim que js/db-plano.js o define: carregar devolve o seed como se viesse
// do banco (usandoFallback:false) e salvar só anota a chamada.
const DUBLE = `
  window.__salvos = []; window.__falharSalvar = false;
  let _db;
  Object.defineProperty(window, "DB_PLANO", {
    configurable: true,
    get() { return _db; },
    set(v) {
      _db = Object.assign({}, v, {
        carregar: async () => ({ lista: (window.DB.plano || []).map(a => Object.assign({}, a, { db_id: a.id })), usandoFallback: !!window.__fallback }),
        salvar: async (id, patch, usuario) => {
          if (window.__falharSalvar) throw new Error("falha simulada");
          window.__salvos.push({ id, patch, usuario });
          return {};
        },
      });
    },
  });
`;

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
    async function abrirPagina(fallback) {
      const s = await cdp.send("Page.addScriptToEvaluateOnNewDocument",
        { source: "window.__fallback = " + (fallback ? "true" : "false") + ";" + DUBLE }, sessionId);
      const carregou = cdp.once("Page.loadEventFired");
      await cdp.send("Page.navigate", { url: "http://127.0.0.1:" + port + "/plano.html?semrede=1&f=" + (fallback ? 1 : 0) + "#CAN-05" }, sessionId);
      await carregou;
      await esperar(400);
      await cdp.send("Page.removeScriptToEvaluateOnNewDocument", { identifier: s.identifier }, sessionId);
    }

    // (1) dados locais: Editar desabilitado
    await abrirPagina(true);
    const fb = JSON.parse(await evaluate(`JSON.stringify((function(){
      const b = document.querySelector('[data-det="CAN-05"] [data-editar]');
      return { existe: !!b, desabilitado: !!(b && b.disabled), detalheAberto: !document.querySelector('[data-det="CAN-05"]').hidden };
    })())`));
    if (!fb.detalheAberto) erros.push("link #CAN-05 não abriu o detalhe da ação");
    if (!fb.existe) erros.push('detalhe sem botão "Editar"');
    else if (!fb.desabilitado) erros.push('com dados locais, "Editar" deveria vir desabilitado');

    // (2) dados do banco: abre o formulário com os valores da ação
    await abrirPagina(false);
    const original = JSON.parse(await evaluate(`JSON.stringify(window.DB.plano.find(a => a.id === "CAN-05"))`));
    await evaluate(`document.querySelector('[data-det="CAN-05"] [data-editar]').click()`);
    await esperar(100);
    const form = JSON.parse(await evaluate(`JSON.stringify((function(){
      const f = document.querySelector('form[data-form="CAN-05"]');
      if (!f) return null;
      return { status: f.elements.status.value, prazo_iso: f.elements.prazo_iso.value, prazo: f.elements.prazo.value, atividade: f.elements.atividade.value, como: f.elements.como.value };
    })())`));
    if (!form) erros.push('clicar em "Editar" não abriu o formulário');
    else {
      if (form.status !== original.status) erros.push("status no formulário (" + form.status + ") ≠ ação (" + original.status + ")");
      if (form.prazo_iso !== (original.prazo_iso || "")) erros.push("prazo (data) no formulário não bate com a ação");
      if (form.atividade !== original.atividade) erros.push("atividade no formulário não bate com a ação");
      if (form.como !== original.como) erros.push("'como executar' no formulário não bate com a ação");
    }

    // (5) falha na gravação: formulário continua, ação não muda
    await evaluate(`(function(){
      window.__falharSalvar = true;
      const f = document.querySelector('form[data-form="CAN-05"]');
      f.elements.status.value = "Em andamento";
      f.querySelector('button[type=submit]').click();
    })()`);
    await esperar(150);
    const aposFalha = JSON.parse(await evaluate(`JSON.stringify({
      form: !!document.querySelector('form[data-form="CAN-05"]'),
      msg: (document.querySelector('form[data-form="CAN-05"] .det-msg') || {}).textContent || "",
      salvos: window.__salvos.length,
    })`));
    if (!aposFalha.form) erros.push("falha na gravação fechou o formulário");
    if (!/falha simulada|Não consegui|salvar/i.test(aposFalha.msg)) erros.push("falha na gravação sem mensagem de erro (veio: " + JSON.stringify(aposFalha.msg) + ")");

    // (3)+(4) gravação ok: status + data nova
    await evaluate(`(function(){
      window.__falharSalvar = false;
      const f = document.querySelector('form[data-form="CAN-05"]');
      f.elements.status.value = "Em andamento";
      f.elements.prazo_iso.value = "2026-11-20";
      f.elements.prazo_iso.dispatchEvent(new Event("change", { bubbles: true }));
      f.querySelector('button[type=submit]').click();
    })()`);
    await esperar(200);
    const salvos = JSON.parse(await evaluate("JSON.stringify(window.__salvos)"));
    const esperadoPatch = { status: "em_andamento", prazo_iso: "2026-11-20", prazo_texto: "20/11" };
    if (salvos.length !== 1) erros.push("esperava 1 gravação, vieram " + salvos.length);
    else {
      const { id, patch } = salvos[0];
      if (id !== "CAN-05") erros.push("gravou no id errado: " + id);
      if (JSON.stringify(patch) !== JSON.stringify(esperadoPatch)) erros.push("patch gravado " + JSON.stringify(patch) + " ≠ esperado " + JSON.stringify(esperadoPatch));
    }
    const depois = JSON.parse(await evaluate(`JSON.stringify((function(){
      const tr = document.querySelector('tr.clicavel[data-id="CAN-05"]');
      return {
        formAberto: !!document.querySelector('form[data-form="CAN-05"]'),
        detalheAberto: !document.querySelector('[data-det="CAN-05"]').hidden,
        status: tr.querySelector('td:last-child').textContent.trim(),
        prazo: tr.querySelector('td[data-label="Prazo"]').textContent.trim(),
      };
    })())`));
    if (depois.formAberto) erros.push("formulário continuou aberto depois de salvar");
    if (!depois.detalheAberto) erros.push("detalhe fechou depois de salvar (deveria continuar aberto)");
    if (!/andamento/i.test(depois.status)) erros.push("linha não mostra o status novo (veio: " + depois.status + ")");
    if (depois.prazo !== "20/11") erros.push("linha não mostra o prazo novo (veio: " + depois.prazo + ")");

    // Salvar sem mudar nada não grava
    await evaluate(`document.querySelector('[data-det="CAN-05"] [data-editar]').click()`);
    await esperar(50);
    await evaluate(`document.querySelector('form[data-form="CAN-05"] button[type=submit]').click()`);
    await esperar(100);
    const totalFinal = await evaluate("window.__salvos.length");
    if (totalFinal !== 1) erros.push("salvar sem alterações gravou mesmo assim");
  } finally {
    cdp.close();
    await encerrarChrome(proc);
    server.close();
    await limparPerfil(perfilTmp);
  }

  if (erros.length) {
    console.error("FALHOU plano_editar_detalhe:");
    erros.forEach((e) => console.error(" -", e));
    process.exitCode = 1;
  } else {
    console.log("plano_editar_detalhe OK — Editar desabilitado com dados locais; formulário abre com os valores; patch só com o que mudou (status → em_andamento, prazo 20/11); erro mantém o formulário; salvar sem mudança não grava.");
  }
}

principal().catch((err) => {
  console.error("ERRO:", err.message || err);
  process.exitCode = 1;
});
