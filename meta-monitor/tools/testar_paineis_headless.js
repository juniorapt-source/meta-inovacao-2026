/* Teste da página Painéis (paineis.html, v0.34.0): vários painéis por iniciativa e a
 * coluna "Detalhes do painel".
 *
 * Abre com ?semrede=1 (iniciativas e pessoas vêm dos seeds locais). Como em modo de teste
 * a escrita no Supabase fica bloqueada, o servidor deste teste acrescenta ao fim de
 * js/db-iniciativa-links.js um banco FALSO em memória (carregar/gravar/remover), que nunca
 * toca rede. Confere: 5 colunas, "+ painel" abre uma 2ª linha na mesma iniciativa,
 * link + detalhes gravam em linhas separadas, a contagem conta os painéis, a busca acha
 * pelo texto de detalhes e o "×" remove (soft delete).
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
const STUB = "\n// --- banco falso do teste (tools/testar_paineis_headless.js) ---\n;(function () {\n  const api = window.DB_INICIATIVA_LINKS;\n  let seq = 100;\n  window.__FAKE_LINKS = [];\n  api.carregar = async function () { return { lista: window.__FAKE_LINKS.filter(function (l) { return !l.deleted; }).slice(), usandoFallback: false }; };\n  api.gravar = async function (tipo, ini, existente, campos) {\n    await new Promise(function (r) { setTimeout(r, 30); });\n    if (existente) { const l = window.__FAKE_LINKS.find(function (x) { return x.db_id === existente.db_id; }); Object.assign(l, campos); return Object.assign({}, l); }\n    const novo = Object.assign({ db_id: ++seq, tipo: tipo, iniciativa: ini.iniciativa, link: \"\", descricao: \"\" }, campos);\n    window.__FAKE_LINKS.push(novo);\n    return Object.assign({}, novo);\n  };\n  api.remover = async function (existente) { window.__FAKE_LINKS.find(function (x) { return x.db_id === existente.db_id; }).deleted = true; };\n})();\n";

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
      if (p === "/js/db-iniciativa-links.js") data = Buffer.concat([data, Buffer.from(STUB)]);
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
    await cdp.send("Page.addScriptToEvaluateOnNewDocument", { source: "window.CC_FORCAR_FALLBACK = true; window.confirm = function () { return true; };" }, sessionId);

    async function evaluate(expression) {
      const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId);
      if (r.exceptionDetails) throw new Error("erro avaliando no browser: " + JSON.stringify(r.exceptionDetails));
      return r.result.value;
    }

    const carregou = cdp.once("Page.loadEventFired");
    await cdp.send("Page.navigate", { url: "http://127.0.0.1:" + port + "/paineis.html?semrede=1" }, sessionId);
    await carregou;
    await esperar(600);

    const erros = [];
    const r = JSON.parse(await evaluate(`(async function(){
      const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
      const tab = document.getElementById('il-tabela');
      const linhasDe = (nome) => Array.from(tab.querySelectorAll('tr[data-iniciativa]')).filter((t) => t.dataset.iniciativa === nome);
      const out = {};
      out.colunas = tab.querySelectorAll('thead th').length;
      out.temDetalhes = !!tab.querySelector('thead th.il-col-desc');
      const tr1 = tab.querySelector('tr[data-iniciativa]');
      const nome = tr1.dataset.iniciativa;
      out.nome = nome;
      out.linhasAntes = linhasDe(nome).length;

      function preencher(tr, campo, v) {
        const el = tr.querySelector('[data-campo="' + campo + '"]');
        el.value = v;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
      // 1º painel
      preencher(linhasDe(nome)[0], 'link', 'https://exemplo.com/a');
      preencher(linhasDe(nome)[0], 'descricao', 'Painel de vendas');
      await dormir(200);
      // + painel
      linhasDe(nome)[0].querySelector('[data-acao="adicionar"]').click();
      await dormir(100);
      out.linhasDepoisAdd = linhasDe(nome).length;
      out.rowspan = linhasDe(nome)[0].querySelector('td.il-col-iniciativa').getAttribute('rowspan');
      preencher(linhasDe(nome)[1], 'link', 'https://exemplo.com/b');
      await dormir(200);
      out.fake = window.__FAKE_LINKS.filter((l) => !l.deleted).map((l) => ({ link: l.link, descricao: l.descricao || '' }));
      out.contagem = document.getElementById('il-contagem').textContent;
      // busca pelo texto de detalhes
      const busca = document.getElementById('il-busca');
      busca.value = 'vendas'; busca.dispatchEvent(new Event('input'));
      await dormir(100);
      out.buscaIniciativas = new Set(Array.from(tab.querySelectorAll('tr[data-iniciativa]')).map((t) => t.dataset.iniciativa)).size;
      busca.value = ''; busca.dispatchEvent(new Event('input'));
      await dormir(100);
      // remove o 2º
      linhasDe(nome)[1].querySelector('[data-acao="remover"]').click();
      await dormir(200);
      out.linhasDepoisRemover = linhasDe(nome).length;
      out.ativosDepoisRemover = window.__FAKE_LINKS.filter((l) => !l.deleted).length;
      out.detalheNaTela = linhasDe(nome)[0].querySelector('[data-campo="descricao"]').value;
      return JSON.stringify(out);
    })()`));

    if (r.colunas !== 5 || !r.temDetalhes) erros.push("cabeçalho deveria ter 5 colunas com 'Detalhes do painel' (veio " + r.colunas + ")");
    if (r.linhasAntes !== 1) erros.push("iniciativa sem painel deveria mostrar 1 linha em branco (veio " + r.linhasAntes + ")");
    if (r.linhasDepoisAdd !== 2 || r.rowspan !== "2") erros.push("'+ painel' deveria abrir a 2ª linha com rowspan=2 (veio " + r.linhasDepoisAdd + ", rowspan " + r.rowspan + ")");
    const esperado = JSON.stringify([{ link: "https://exemplo.com/a", descricao: "Painel de vendas" }, { link: "https://exemplo.com/b", descricao: "" }]);
    if (JSON.stringify(r.fake) !== esperado) erros.push("gravação: esperava " + esperado + ", veio " + JSON.stringify(r.fake));
    if (!/2 painéis/.test(r.contagem)) erros.push("contagem deveria citar 2 painéis: " + r.contagem);
    if (r.buscaIniciativas !== 1) erros.push("busca por texto de detalhes deveria achar 1 iniciativa (veio " + r.buscaIniciativas + ")");
    if (r.linhasDepoisRemover !== 1 || r.ativosDepoisRemover !== 1) erros.push("'×' deveria remover o 2º painel (linhas " + r.linhasDepoisRemover + ", ativos " + r.ativosDepoisRemover + ")");
    if (r.detalheNaTela !== "Painel de vendas") erros.push("detalhes do 1º painel sumiram da tela após remover o 2º");

    if (erros.length) {
      console.error("FALHOU paineis_multiplos:");
      erros.forEach((e) => console.error(" -", e));
      process.exitCode = 1;
    } else {
      console.log("paineis_multiplos OK — '" + r.nome + "': adicionar, detalhes, busca e remover funcionando (" + r.contagem + ")");
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
