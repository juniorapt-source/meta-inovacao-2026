/* Teste do combobox de "pessoas do projeto" em canva.html — "Meu nome" e "Responsável"
 * de cada cartão.
 *
 * Contexto: os dois campos eram texto livre. A primeira tentativa trocou por
 * <input list="..."> (datalist nativo) pra sugerir nomes do golden record de pessoas
 * sem travar quem não está cadastrado. José testou em produção no Safari (28/08/2026)
 * e a lista nunca aparecia — Safari não desenha indicador nenhum de datalist, e em
 * navegação privada muitas vezes nem abre a lista nativa. Foi substituído por um
 * combobox construído na mão (mesmo texto livre, sugestões visíveis em qualquer
 * navegador) — este teste protege o comportamento novo.
 *
 * Mesmo padrão de CDP cru (sem Playwright) dos outros testes headless do repo. Roda em
 * ?semrede=1, então nada sai pro Supabase — DB_PESSOAS cai pro seed local
 * (data/pessoas.js), que tem "JR."/"Sandra"/"Cris"/... entre os nome_exibicao.
 *
 * Uso:  node tools/testar_canva_combo_pessoas_headless.js
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
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser",
];
function acharChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  for (const p of CAMINHOS_CHROME) if (fs.existsSync(p)) return p;
  throw new Error("Não achei um Chrome/Chromium. Defina CHROME_PATH=/caminho/pro/chrome.");
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
  return new Promise((r) => server.listen(0, "127.0.0.1", () => r({ server, port: server.address().port })));
}

function iniciarChrome(chromePath) {
  const perfilTmp = fs.mkdtempSync(path.join(os.tmpdir(), "canva-combo-pessoas-"));
  return new Promise((resolve, reject) => {
    const proc = spawn(chromePath, ["--headless=new", "--disable-gpu", "--no-sandbox",
      "--remote-debugging-port=0", "--user-data-dir=" + perfilTmp], { stdio: ["ignore", "ignore", "pipe"] });
    let buf = "";
    const t = setTimeout(() => reject(new Error("timeout esperando o Chrome subir")), 20000);
    proc.stderr.on("data", (c) => {
      buf += c.toString();
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(t); resolve({ proc, wsUrl: m[1], perfilTmp }); }
    });
    proc.on("error", reject);
  });
}

const eventos = { load: false };
function conectarCDP(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0; const pend = new Map();
    ws.addEventListener("open", () => resolve({
      enviar: (metodo, params, sessionId) => new Promise((res, rej) => {
        const meu = ++id; pend.set(meu, { res, rej });
        const payload = { id: meu, method: metodo, params: params || {} };
        if (sessionId) payload.sessionId = sessionId;
        ws.send(JSON.stringify(payload));
      }),
      fechar: () => ws.close(),
    }));
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.method === "Page.loadEventFired") eventos.load = true;
      if (msg.id && pend.has(msg.id)) {
        const { res, rej } = pend.get(msg.id); pend.delete(msg.id);
        msg.error ? rej(new Error(msg.error.message)) : res(msg.result);
      }
    });
    ws.addEventListener("error", reject);
  });
}

const falhas = [];
function ok(cond, msg, extra) {
  if (cond) console.log("  ok: " + msg);
  else { console.log("  FALHOU: " + msg + (extra ? " → " + extra : "")); falhas.push(msg); }
}

(async () => {
  const { server, port } = await iniciarServidor();
  const { proc, wsUrl, perfilTmp } = await iniciarChrome(acharChrome());
  const cdp = await conectarCDP(wsUrl);
  try {
    const base = `http://127.0.0.1:${port}/canva.html?semrede=1`;
    const { targetId } = await cdp.enviar("Target.createTarget", { url: base });
    const { sessionId } = await cdp.enviar("Target.attachToTarget", { targetId, flatten: true });
    await cdp.enviar("Page.enable", {}, sessionId);
    await cdp.enviar("Runtime.enable", {}, sessionId);
    const esperarCarregar = async () => {
      for (let i = 0; i < 75 && !eventos.load; i++) await new Promise((r) => setTimeout(r, 200));
      eventos.load = false;
      await new Promise((r) => setTimeout(r, 1200));
    };
    await esperarCarregar();
    const avaliar = async (expr) => {
      const r = await cdp.enviar("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }, sessionId);
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " " + ((r.exceptionDetails.exception || {}).description || ""));
      return r.result.value;
    };

    console.log("1) \"Meu nome\": foco abre a lista, com nomes do golden record (seed local)");
    ok(await avaliar('document.getElementById("cv-nome-combo-lista").hidden === true'),
      "lista começa escondida");
    await avaliar('document.getElementById("cv-nome").dispatchEvent(new Event("focus"))');
    await new Promise((r) => setTimeout(r, 100));
    ok(await avaliar('document.getElementById("cv-nome-combo-lista").hidden === false'),
      "foco abre a lista");
    const opcoesIniciais = await avaliar(
      '[...document.querySelectorAll("#cv-nome-combo-lista .cv-combo-opcao")].map((b) => b.textContent)');
    ok(opcoesIniciais.length > 0, "lista veio com opções", "veio " + JSON.stringify(opcoesIniciais).slice(0, 200));
    ok(opcoesIniciais.includes("JR.") || opcoesIniciais.includes("Sandra"),
      "reconhece nome do seed local (data/pessoas.js)", "veio " + JSON.stringify(opcoesIniciais).slice(0, 200));
    ok(await avaliar('document.getElementById("cv-nome").getAttribute("aria-expanded") === "true"'),
      "aria-expanded fica true com a lista aberta");

    console.log("2) digitar filtra (não é <select>: digitar sem escolher continua valendo)");
    await avaliar(`(function(){
      const n = document.getElementById("cv-nome");
      n.value = "cris"; n.dispatchEvent(new Event("input", {bubbles:true}));
    })()`);
    await new Promise((r) => setTimeout(r, 100));
    const filtradas = await avaliar(
      '[...document.querySelectorAll("#cv-nome-combo-lista .cv-combo-opcao")].map((b) => b.textContent)');
    ok(filtradas.length > 0 && filtradas.every((n) => n.toLowerCase().includes("cris")),
      'filtro por "cris" só devolve nomes com "cris"', "veio " + JSON.stringify(filtradas));
    ok(filtradas.includes("Cris"), 'achou "Cris" (nome_exibicao do seed)', "veio " + JSON.stringify(filtradas));

    console.log("3) sem casar com nada, a lista avisa e não trava a digitação");
    await avaliar(`(function(){
      const n = document.getElementById("cv-nome");
      n.value = "Zzzznome que ninguém tem"; n.dispatchEvent(new Event("input", {bubbles:true}));
    })()`);
    await new Promise((r) => setTimeout(r, 100));
    ok(await avaliar('document.querySelectorAll("#cv-nome-combo-lista .cv-combo-opcao").length === 0'),
      "nenhuma opção quando não casa com ninguém");
    ok(await avaliar('!!document.querySelector("#cv-nome-combo-lista .cv-combo-vazia")'),
      'mostra aviso "nenhum nome encontrado" em vez de lista vazia muda');
    ok(await avaliar('document.getElementById("cv-nome").value === "Zzzznome que ninguém tem"'),
      "o texto digitado continua no campo — não é <select>, é sugestão");

    console.log("4) clicar numa opção preenche o campo e fecha a lista");
    await avaliar(`(function(){
      const n = document.getElementById("cv-nome");
      n.value = "cris"; n.dispatchEvent(new Event("input", {bubbles:true}));
    })()`);
    await new Promise((r) => setTimeout(r, 100));
    const escolhido = await avaliar(`(function(){
      const btn = [...document.querySelectorAll("#cv-nome-combo-lista .cv-combo-opcao")][0];
      const texto = btn.textContent;
      btn.dispatchEvent(new MouseEvent("mousedown", {bubbles:true}));
      return texto;
    })()`);
    ok(await avaliar('document.getElementById("cv-nome").value') === escolhido,
      "o valor escolhido foi pro campo", "escolhido=" + escolhido);
    ok(await avaliar('document.getElementById("cv-nome-combo-lista").hidden === true'),
      "a lista fecha depois de escolher");

    console.log("5) o cartão de uma demanda também tem o combo (Responsável)");
    await avaliar(`(function(){
      const c = document.querySelector("#cv-projeto .cv-chk-projeto");
      c.checked = true; c.dispatchEvent(new Event("change", {bubbles:true}));
    })()`);
    await new Promise((r) => setTimeout(r, 300));
    await avaliar('document.querySelector(".cv-btn-mais").click()');
    await new Promise((r) => setTimeout(r, 300));
    const temCartao = await avaliar('document.querySelectorAll(".cv-cartao").length > 0');
    ok(temCartao, "existe pelo menos um cartão de demanda na tela");
    if (temCartao) {
      ok(await avaliar('!!document.querySelector(".cv-cartao .cv-f-responsavel")'),
        "o cartão tem o campo Responsável");
      ok(await avaliar('!!document.querySelector(".cv-cartao [data-combo-lista]")'),
        "o cartão tem a lista de sugestões do Responsável");
      await avaliar('document.querySelector(".cv-cartao .cv-f-responsavel").dispatchEvent(new Event("focus"))');
      await new Promise((r) => setTimeout(r, 100));
      const opcoesResp = await avaliar(
        '[...document.querySelectorAll(".cv-cartao [data-combo-lista] .cv-combo-opcao")].map((b) => b.textContent)');
      ok(opcoesResp.length > 0, "o combo do Responsável também sugere nomes", "veio " + JSON.stringify(opcoesResp).slice(0, 200));
      const escolhidoResp = await avaliar(`(function(){
        const btn = document.querySelector(".cv-cartao [data-combo-lista] .cv-combo-opcao");
        const texto = btn.textContent;
        btn.dispatchEvent(new MouseEvent("mousedown", {bubbles:true}));
        return texto;
      })()`);
      ok(await avaliar('document.querySelector(".cv-cartao .cv-f-responsavel").value') === escolhidoResp,
        "clicar numa opção preenche o Responsável do cartão", "escolhido=" + escolhidoResp);
    }

    console.log("6) blur fecha a lista (clicar fora não deixa sugestão pairando na tela)");
    await avaliar('document.getElementById("cv-nome").dispatchEvent(new Event("focus"))');
    await new Promise((r) => setTimeout(r, 100));
    ok(await avaliar('document.getElementById("cv-nome-combo-lista").hidden === false'), "abriu de novo com o foco");
    await avaliar('document.getElementById("cv-nome").dispatchEvent(new Event("blur"))');
    await new Promise((r) => setTimeout(r, 250));
    ok(await avaliar('document.getElementById("cv-nome-combo-lista").hidden === true'), "blur fechou a lista");

  } finally {
    cdp.fechar();
    server.close();
    proc.kill();
    setTimeout(() => proc.kill("SIGKILL"), 2000);
    try { fs.rmSync(perfilTmp, { recursive: true, force: true }); } catch (e) { /* ignora */ }
  }

  console.log("");
  if (falhas.length) { console.log("FALHOU — " + falhas.length + " checagem(ns)"); process.exit(1); }
  console.log("CANVA/COMBO-PESSOAS OK — sugestão de nomes funciona sem travar texto livre");
  process.exit(0);
})().catch((e) => { console.error("erro:", e.message); process.exit(1); });
