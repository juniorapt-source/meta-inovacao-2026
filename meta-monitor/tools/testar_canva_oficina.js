/* Teste do contexto de oficina do canva.html: confere que ciclo e encontro_id saem de
 * data/agenda.js (canal do QR + data de hoje) e chegam na demanda gravada, em vez de
 * nascerem nulos — que era o estado antes, e deixava o "filtro por ciclo" da tela de
 * consolidação (§8 do plano) sem nada pra filtrar.
 *
 * Mesmo padrão de CDP cru (sem Playwright) dos outros testes headless do repo. Roda em
 * ?semrede=1, então nada sai pro Supabase: o que se confere é o que o navegador guardou.
 *
 * Uso:  node tools/testar_canva_oficina.js
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
  const perfilTmp = fs.mkdtempSync(path.join(os.tmpdir(), "canva-oficina-"));
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
    const url = `http://127.0.0.1:${port}/canva.html?semrede=1&canal=empresa`;
    // alvo já criado NA url (e não about:blank + Page.navigate): com navigate depois do
    // attach, o evaluate pega o documento no meio do parse e vê window.DB vazio.
    const { targetId } = await cdp.enviar("Target.createTarget", { url });
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
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " " + (r.exceptionDetails.exception || {}).description);
      return r.result.value;
    };


    console.log("1) a agenda chegou na página");
    ok(await avaliar("!!(window.DB && DB.agenda && DB.agenda.encontros && DB.agenda.encontros.length)"),
      "data/agenda.js carregado (sem ele, ciclo volta a ser nulo)");

    console.log("2) preenche uma demanda no canal da oficina");
    await avaliar(`(function(){
      // 27/08/2026 (item 3 do plano de melhorias de navegação): a escolha do projeto
      // deixou de ser um <select> e virou checklist — marcar o primeiro checkbox é o
      // equivalente ao antigo "escolher a primeira <option> do primeiro <optgroup>".
      const c = document.querySelector("#cv-projeto .cv-chk-projeto");
      c.checked = true; c.dispatchEvent(new Event("change", { bubbles: true }));
      const n = document.getElementById("cv-nome");
      n.value = "Teste Oficina"; n.dispatchEvent(new Event("change"));
      return c.value;
    })()`);
    await new Promise((r) => setTimeout(r, 300));
    ok(await avaliar('!!document.querySelector(\'.cv-cartao[data-canal="empresa"]\')'),
      "o cartão do canal do QR já abriu sozinho");

    await avaliar(`(function(){
      const c = document.querySelector('.cv-cartao[data-canal="empresa"]');
      const set = (sel, v) => { const el = c.querySelector(sel); el.value = v; el.dispatchEvent(new Event("input", {bubbles:true})); };
      set(".cv-f-servico", "Consumo da base filtrada");
      set(".cv-f-problema", "Não sabemos quais empresas já foram atendidas");
      set(".cv-f-responsavel", "Cristiano");
      const r = c.querySelector('.cv-f-cproprio[value="nao"]');
      r.checked = true; r.dispatchEvent(new Event("change", {bubbles:true}));
      const p = c.querySelector(".cv-f-prazo");
      p.value = p.max.slice(0,4) === "" ? "" : new Date(Date.now()+30*864e5).toISOString().slice(0,10);
      p.dispatchEvent(new Event("change", {bubbles:true}));
      return true;
    })()`);
    await new Promise((r) => setTimeout(r, 2600));

    console.log("3) o que ficou guardado carrega o contexto da oficina");
    const d = await avaliar(`(function(){
      const k = Object.keys(localStorage).filter(x => x.indexOf("cc_canva_") === 0);
      for (const chave of k) {
        let v; try { v = JSON.parse(localStorage.getItem(chave)); } catch (e) { continue; }
        if (v && v.demandas && v.demandas.length) return v.demandas[0];
      }
      return null;
    })()`);
    ok(!!d, "achou a demanda no localStorage");
    if (d) {
      ok(d.ciclo === "c1", "ciclo veio da janela da agenda (c1, 18–31/08)", "ciclo=" + JSON.stringify(d.ciclo));
      ok(d.encontro_id === "c1-empresa", "encontro_id casou canal do QR + ciclo", "encontro_id=" + JSON.stringify(d.encontro_id));
      ok(d.canal === "empresa", "canal preservado", "canal=" + d.canal);
    }

    console.log("4) demanda pra OUTRO canal na mesma oficina herda o mesmo ciclo");
    await avaliar(`(function(){
      // ancorado no bloco do projeto (existe uma linha "portal" por projeto marcado)
      document.querySelector('.cv-bloco .cv-linha-canal[data-canal="portal"] .cv-btn-mais').click();
      return true;
    })()`);
    await new Promise((r) => setTimeout(r, 300));
    await avaliar(`(function(){
      const c = document.querySelector('.cv-cartao[data-canal="portal"]');
      const set = (sel, v) => { const el = c.querySelector(sel); el.value = v; el.dispatchEvent(new Event("input", {bubbles:true})); };
      set(".cv-f-servico", "Divulgação do produto");
      set(".cv-f-problema", "Ninguém acha a página");
      set(".cv-f-responsavel", "Ana");
      return true;
    })()`);
    await new Promise((r) => setTimeout(r, 2600));
    const dp = await avaliar(`(function(){
      const k = Object.keys(localStorage).filter(x => x.indexOf("cc_canva_") === 0);
      for (const chave of k) {
        let v; try { v = JSON.parse(localStorage.getItem(chave)); } catch (e) { continue; }
        if (!v || !v.demandas) continue;
        const achada = v.demandas.filter(x => x.canal === "portal")[0];
        if (achada) return achada;
      }
      return null;
    })()`);
    ok(!!dp, "achou a demanda do outro canal");
    if (dp) {
      ok(dp.ciclo === "c1", "mesmo ciclo da oficina, mesmo sendo de outro canal", "ciclo=" + JSON.stringify(dp.ciclo));
      ok(dp.encontro_id === "c1-empresa", "encontro_id é o da OFICINA, não o do canal da demanda", "encontro_id=" + JSON.stringify(dp.encontro_id));
    }

    console.log("5) sem ?canal= (link nu), ainda assim grava o ciclo do dia");
    await cdp.enviar("Page.navigate", { url: `http://127.0.0.1:${port}/canva.html?semrede=1&nada=1` }, sessionId);
    await esperarCarregar();
    // a seleção de projetos agora é persistida (item 3.1): sem cuidado aqui, o
    // checkbox marcado no passo 2 já chega marcado de novo (persistência de F5), e o
    // scan por "a 1ª demanda que achar" acaba relendo o MESMO caderno/demanda já
    // conferido no passo 3, em vez de provar algo novo sobre este passo. Pra isolar,
    // marca um projeto NOVO (ainda não usado nesta sessão) e cria a demanda ali, num
    // canal escolhido manualmente (não há canalDestaque nesta URL, sem ?canal=).
    const d2 = await avaliar(`(function(){
      const c = Array.from(document.querySelectorAll("#cv-projeto .cv-chk-projeto")).find((x) => !x.checked);
      const nomeProjetoNovo = c.value;
      c.checked = true; c.dispatchEvent(new Event("change", { bubbles: true }));
      return nomeProjetoNovo;
    })()`);
    await new Promise((r) => setTimeout(r, 300));
    await avaliar(`(function(){
      const bloco = Array.from(document.querySelectorAll(".cv-bloco")).find((b) => b.dataset.projeto === ${JSON.stringify(d2)});
      bloco.querySelector('.cv-linha-canal[data-canal="portal"] .cv-btn-mais').click();
      return true;
    })()`);
    await new Promise((r) => setTimeout(r, 300));
    await avaliar(`(function(){
      const bloco = Array.from(document.querySelectorAll(".cv-bloco")).find((b) => b.dataset.projeto === ${JSON.stringify(d2)});
      const c = bloco.querySelector('.cv-cartao[data-canal="portal"]');
      const set = (sel, v) => { const el = c.querySelector(sel); el.value = v; el.dispatchEvent(new Event("input", {bubbles:true})); };
      set(".cv-f-servico", "Teste sem canal de QR");
      set(".cv-f-responsavel", "Bia");
      return true;
    })()`);
    await new Promise((r) => setTimeout(r, 2600));
    const demandaProjetoNovo = await avaliar(`(function(){
      const k = Object.keys(localStorage).filter(x => x.indexOf("cc_canva_") === 0);
      for (const chave of k) {
        let v; try { v = JSON.parse(localStorage.getItem(chave)); } catch (e) { continue; }
        if (!v || v.projeto !== ${JSON.stringify(d2)} || !v.demandas) continue;
        const achada = v.demandas.filter(x => x.canal === "portal")[0];
        if (achada) return achada;
      }
      return null;
    })()`);
    ok(!!demandaProjetoNovo, "achou a demanda do projeto marcado neste passo (não a de um passo anterior)");
    if (demandaProjetoNovo) {
      ok(demandaProjetoNovo.ciclo === "c1", "ciclo do dia continua vindo, sem encontro_id", "ciclo=" + JSON.stringify(demandaProjetoNovo.ciclo));
      ok(demandaProjetoNovo.encontro_id === null, "sem canalDestaque nesta URL, encontro_id fica nulo (não herda o de outro passo)", "encontro_id=" + JSON.stringify(demandaProjetoNovo.encontro_id));
    }
  } finally {
    cdp.fechar();
    server.close();
    proc.kill();
    setTimeout(() => proc.kill("SIGKILL"), 2000);
    try { fs.rmSync(perfilTmp, { recursive: true, force: true }); } catch (e) { /* ignora */ }
  }

  console.log("");
  if (falhas.length) { console.log("FALHOU — " + falhas.length + " checagem(ns)"); process.exit(1); }
  console.log("CANVA/OFICINA OK — ciclo e encontro_id chegam na demanda");
  process.exit(0);
})().catch((e) => { console.error("erro:", e.message); process.exit(1); });
