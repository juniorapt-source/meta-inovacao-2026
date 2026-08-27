/* Teste do canvas multiprojeto de canva.html — item 3 do plano de melhorias de
 * navegação, RODADA 3 (28/08/2026). O modelo é: o checklist define o ESCOPO da demanda,
 * a tela tem UMA matriz, e cada demanda digitada vira UM REGISTRO POR PROJETO marcado.
 *
 * O que este teste protege, em ordem de importância:
 *   1. uma digitação vira N registros, um por projeto, com o MESMO conteúdo — é a razão
 *      de existir desta rodada (o gestor pede a mesma coisa pro Foco+ em dois projetos
 *      e não quer digitar duas vezes);
 *   2. a tela mostra UMA matriz, não uma por projeto (a regressão da rodada anterior);
 *   3. o botão "Enviar demanda" existe, e quando falta campo ele DIZ o que falta em vez
 *      de deixar o cartão "incompleta" mudo;
 *   4. checklist: "selecionar todos" por núcleo, indeterminate parcial, F5 restaura a
 *      seleção, ?projeto= chega marcado, escape de projeto livre.
 *
 * A checagem que vale de verdade é sempre no ARMAZENAMENTO, não no DOM: os cartões não
 * reescrevem o value de um input depois de criados (é o que impede um render() de
 * roubar o cursor no meio da digitação), então uma regressão de escopo pode ficar
 * invisível na tela e visível no localStorage. Foi assim que um furo passou na rodada
 * anterior.
 *
 * Mesmo padrão de CDP cru (sem Playwright) dos outros testes headless do repo. Roda em
 * ?semrede=1, então nada sai pro Supabase.
 *
 * Uso:  node tools/testar_canva_multiprojeto_headless.js
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
  const perfilTmp = fs.mkdtempSync(path.join(os.tmpdir(), "canva-multiprojeto-"));
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
    const base = `http://127.0.0.1:${port}/canva.html?semrede=1&canal=empresa`;
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
    // o que ficou GRAVADO por projeto — a fonte de verdade destas checagens
    const gravados = () => avaliar(`(function(){
      return Object.keys(localStorage)
        .filter((k) => k.indexOf("cc_canva_") === 0 && k !== "cc_canva_sessoes" && k !== "cc_canva_selecao")
        .map((k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } })
        .filter((v) => v && v.projeto)
        .map((v) => ({ projeto: v.projeto, demandas: (v.demandas || []).map((d) => ({
          canal: d.canal, servico: d.servico || "", responsavel: d.responsavel || "", estado: d.estado })) }));
    })()`);

    console.log("1) checklist montado, e NENHUMA matriz antes de marcar projeto");
    ok(await avaliar('document.querySelectorAll("#cv-projeto .cv-projeto-grupo[data-nucleo]").length >= 2'),
      "grupos por núcleo no checklist");
    ok(await avaliar('document.querySelectorAll("#cv-projeto .cv-chk-todos-grupo").length === document.querySelectorAll("#cv-projeto .cv-projeto-grupo[data-nucleo]").length'),
      'um "selecionar todos" por núcleo');
    ok(await avaliar('document.getElementById("cv-passo2").hidden === true'),
      "matriz escondida antes de marcar qualquer projeto");

    console.log("2) marcar 2 projetos de núcleos diferentes mostra UMA matriz só");
    const nomes = await avaliar(`(function(){
      const gs = document.querySelectorAll("#cv-projeto .cv-projeto-grupo[data-nucleo]");
      const marcados = [];
      [gs[0], gs[1]].forEach((g) => {
        const c = g.querySelector(".cv-chk-projeto");
        c.checked = true; c.dispatchEvent(new Event("change", { bubbles: true }));
        marcados.push(c.value);
      });
      const n = document.getElementById("cv-nome");
      n.value = "Zé Testador"; n.dispatchEvent(new Event("change", { bubbles: true }));
      return marcados;
    })()`);
    await new Promise((r) => setTimeout(r, 400));
    ok(await avaliar('document.querySelectorAll(".cv-mini-matriz").length === 1'),
      "UMA matriz na tela, não uma por projeto (regressão da rodada anterior)");
    ok(await avaliar('document.querySelectorAll(".cv-mini-matriz .cv-linha-canal").length === 10'),
      "os 10 canais, uma vez só");
    ok(await avaliar('document.getElementById("cv-escopo").textContent.indexOf("um registro para cada") !== -1'),
      "a tela avisa que a demanda vira um registro por projeto");

    console.log("3) ?canal=empresa abriu UM cartão, não um por projeto");
    ok(await avaliar('document.querySelectorAll(\'.cv-cartao[data-canal="empresa"]\').length === 1'),
      "um cartão só para o canal do QR");
    ok(await avaliar(`document.querySelector('.cv-cartao[data-canal="empresa"] [data-vale-para]').textContent.indexOf("2 registros") !== -1`),
      'o cartão avisa "Vira 2 registros"');

    console.log("4) botão de enviar existe e DIZ o que falta");
    ok(await avaliar('!!document.querySelector(\'.cv-cartao[data-canal="empresa"] [data-enviar]\')'),
      'o botão "Enviar demanda" existe no cartão');
    await avaliar(`document.querySelector('.cv-cartao[data-canal="empresa"] [data-enviar]').click()`);
    await new Promise((r) => setTimeout(r, 300));
    const falta = await avaliar(`document.querySelector('.cv-cartao[data-canal="empresa"] [data-falta]').textContent`);
    ok(/responsável/i.test(falta) && /prazo/i.test(falta),
      "clicar em enviar vazio diz que falta responsável e prazo", "texto=" + JSON.stringify(falta));

    console.log("5) UMA digitação -> DOIS registros idênticos, um por projeto");
    await avaliar(`(function(){
      const c = document.querySelector('.cv-cartao[data-canal="empresa"]');
      const set = (sel, v) => { const el = c.querySelector(sel); el.value = v; el.dispatchEvent(new Event("input", {bubbles:true})); };
      set(".cv-f-servico", "Criar grupo de clientes com importação em CSV");
      set(".cv-f-problema", "Hoje é um a um, na mão");
      set(".cv-f-responsavel", "Cristiano");
      const r = c.querySelector('.cv-f-cproprio[value="nao"]');
      r.checked = true; r.dispatchEvent(new Event("change", {bubbles:true}));
      const p = c.querySelector(".cv-f-prazo");
      p.value = new Date(Date.now()+30*864e5).toISOString().slice(0,10);
      p.dispatchEvent(new Event("change", {bubbles:true}));
      c.querySelector("[data-enviar]").click();
      return true;
    })()`);
    await new Promise((r) => setTimeout(r, 1200));
    const g5 = await gravados();
    ok(g5.length === 2, "dois cadernos gravados, um por projeto marcado",
      "gravados=" + JSON.stringify(g5.map((x) => x.projeto)));
    const doProjeto = (nome) => g5.filter((x) => x.projeto === nome)[0];
    const a = doProjeto(nomes[0]), b = doProjeto(nomes[1]);
    ok(!!a && !!b, "os dois projetos marcados têm caderno próprio");
    if (a && b) {
      const linhaA = (a.demandas || []).filter((d) => d.canal === "empresa")[0];
      const linhaB = (b.demandas || []).filter((d) => d.canal === "empresa")[0];
      ok(!!linhaA && !!linhaB, "cada projeto tem a sua linha do canal empresa");
      if (linhaA && linhaB) {
        ok(linhaA.servico === "Criar grupo de clientes com importação em CSV" &&
           linhaB.servico === linhaA.servico,
          "o MESMO serviço foi gravado nos dois — uma digitação, dois registros",
          "A=" + JSON.stringify(linhaA.servico) + " B=" + JSON.stringify(linhaB.servico));
        ok(linhaA.responsavel === "Cristiano" && linhaB.responsavel === "Cristiano",
          "o responsável foi para os dois registros");
        ok(linhaA.estado === "salva" && linhaB.estado === "salva",
          "o botão enviou os dois na hora, sem esperar o debounce",
          "A=" + linhaA.estado + " B=" + linhaB.estado);
      }
      ok((a.demandas || []).length === 1 && (b.demandas || []).length === 1,
        "nenhum projeto ganhou linha duplicada",
        "A=" + (a.demandas || []).length + " B=" + (b.demandas || []).length);
    }
    ok(await avaliar('document.querySelectorAll(\'.cv-cartao[data-canal="empresa"]\').length === 1'),
      "continua UM cartão na tela, mesmo tendo virado dois registros");
    ok(await avaliar('document.getElementById("cv-resumo").textContent.indexOf("2 registros") !== -1'),
      "o resumo separa demanda digitada de registro gerado");

    console.log("6) demanda nova depois de mudar a marcação só vale pros marcados agora");
    await avaliar(`(function(){
      const gs = document.querySelectorAll("#cv-projeto .cv-projeto-grupo[data-nucleo]");
      const c = gs[1].querySelector(".cv-chk-projeto");
      c.checked = false; c.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);
    await new Promise((r) => setTimeout(r, 300));
    await avaliar(`document.querySelector('.cv-linha-canal[data-canal="portal"] .cv-btn-mais').click()`);
    await new Promise((r) => setTimeout(r, 300));
    ok(await avaliar(`document.querySelector('.cv-cartao[data-canal="portal"] [data-vale-para]').textContent.indexOf("1 registro") !== -1`),
      "a demanda nova vale só para o projeto que continua marcado");
    const g6 = await gravados();
    const b6 = g6.filter((x) => x.projeto === nomes[1])[0];
    ok(!!b6 && (b6.demandas || []).every((d) => d.canal !== "portal"),
      "o projeto desmarcado NÃO recebeu a demanda nova");
    ok(!!b6 && (b6.demandas || []).some((d) => d.canal === "empresa" && d.servico.indexOf("importação em CSV") !== -1),
      "e continua com a demanda anterior — desmarcar não apaga o que já foi enviado");

    console.log("7) \"Selecionar Todos\" do núcleo e o indeterminate");
    const tot = await avaliar(`(function(){
      const g = document.querySelectorAll("#cv-projeto .cv-projeto-grupo[data-nucleo]")[0];
      const t = g.querySelector(".cv-chk-todos-grupo");
      t.checked = true; t.dispatchEvent(new Event("change", {bubbles:true}));
      return { total: g.querySelectorAll(".cv-chk-projeto").length,
               marcados: g.querySelectorAll(".cv-chk-projeto:checked").length,
               chk: t.checked, indet: t.indeterminate };
    })()`);
    ok(tot.marcados === tot.total && tot.chk && !tot.indet,
      "marca o núcleo inteiro de uma vez", JSON.stringify(tot));
    const parcial = await avaliar(`(function(){
      const g = document.querySelectorAll("#cv-projeto .cv-projeto-grupo[data-nucleo]")[0];
      const c = g.querySelectorAll(".cv-chk-projeto")[1];
      c.checked = false; c.dispatchEvent(new Event("change", {bubbles:true}));
      return g.querySelector(".cv-chk-todos-grupo").indeterminate;
    })()`);
    ok(parcial === true, "desmarcar um deixa o cabeçalho indeterminate");
    ok(await avaliar('document.querySelectorAll(".cv-mini-matriz").length === 1'),
      "mesmo com o núcleo inteiro marcado, a matriz continua sendo UMA");

    console.log("8) escape \"não encontrei meu projeto\"");
    const livre = await avaliar(`(function(){
      document.getElementById("cv-escape-btn").click();
      const i = document.getElementById("cv-projeto-livre");
      i.value = "Projeto Fantasma";
      document.getElementById("cv-escape-adicionar").click();
      return { grupo: !!document.getElementById("cv-projeto-livres"),
               marcado: !!Array.from(document.querySelectorAll(".cv-chk-projeto")).find((c) => c.value === "Projeto Fantasma" && c.checked),
               limpo: i.value === "" };
    })()`);
    ok(livre.grupo && livre.marcado && livre.limpo,
      "projeto livre entra na lista já marcado e limpa o campo", JSON.stringify(livre));

    console.log("9) F5 restaura a seleção e NÃO duplica a demanda na tela");
    const marcadosAntes = await avaliar('document.querySelectorAll(".cv-chk-projeto:checked").length');
    await cdp.enviar("Page.navigate", { url: base }, sessionId);
    await esperarCarregar();
    ok(await avaliar('document.querySelectorAll(".cv-chk-projeto:checked").length') === marcadosAntes,
      "mesma quantidade de checkboxes marcados depois do F5");
    ok(await avaliar('document.querySelectorAll(".cv-mini-matriz").length === 1'),
      "uma matriz depois do F5");
    ok(await avaliar(`document.querySelectorAll('.cv-cartao[data-canal="empresa"]').length === 1`),
      "a demanda dos dois projetos volta como UM cartão, não dois");

    console.log("10) ?projeto=<nome> chega marcado, somando à seleção guardada");
    const alvo = nomes[1];
    await cdp.enviar("Page.navigate", { url: `http://127.0.0.1:${port}/canva.html?semrede=1&projeto=` + encodeURIComponent(alvo) }, sessionId);
    await esperarCarregar();
    ok(await avaliar(`!!Array.from(document.querySelectorAll(".cv-chk-projeto")).find((c) => c.value === ${JSON.stringify(alvo)} && c.checked)`),
      "o projeto do ?projeto= chega marcado");
    ok(await avaliar('document.querySelectorAll(".cv-chk-projeto:checked").length > 1'),
      "e a seleção guardada antes continua marcada (união, não substituição)");

  } finally {
    cdp.fechar();
    server.close();
    proc.kill();
    setTimeout(() => proc.kill("SIGKILL"), 2000);
    try { fs.rmSync(perfilTmp, { recursive: true, force: true }); } catch (e) { /* ignora */ }
  }

  console.log("");
  if (falhas.length) { console.log("FALHOU — " + falhas.length + " checagem(ns)"); process.exit(1); }
  console.log("CANVA/MULTIPROJETO OK — uma matriz, uma digitação, um registro por projeto");
  process.exit(0);
})().catch((e) => { console.error("erro:", e.message); process.exit(1); });
