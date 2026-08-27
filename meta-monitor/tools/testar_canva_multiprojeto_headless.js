/* Teste do checklist multiprojeto do canva.html (item 3 do plano de melhorias de
 * navegação, redesenho de 27/08/2026): marcar N projetos monta N blocos de matriz
 * independentes, "Selecionar Todos" marca o grupo inteiro, desmarcar não apaga dado
 * (remarcar devolve), F5 restaura a seleção e ?projeto= pré-marca em cima do que já
 * estava marcado.
 *
 * Roteiro transcrito de "Roteiro já validado pro 3.8" em
 * meta-monitor/docs/PLANO_EXECUCAO_MELHORIAS_NAVEGACAO.md — já rodou em Chrome headless
 * durante o 3.3/3.4 e passou inteiro; aqui vira teste permanente.
 *
 * Mesmo padrão de CDP cru (sem Playwright) dos outros testes headless do repo. Roda em
 * ?semrede=1, então nada sai pro Supabase: o que se confere é o que o navegador guardou.
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
    let sessionId;
    const esperarCarregar = async () => {
      for (let i = 0; i < 75 && !eventos.load; i++) await new Promise((r) => setTimeout(r, 200));
      eventos.load = false;
      await new Promise((r) => setTimeout(r, 1200));
    };
    const avaliar = async (expr) => {
      const r = await cdp.enviar("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true }, sessionId);
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + " " + (r.exceptionDetails.exception || {}).description);
      return r.result.value;
    };

    const url = `http://127.0.0.1:${port}/canva.html?semrede=1&canal=empresa`;
    // alvo já criado NA url (e não about:blank + Page.navigate): com navigate depois do
    // attach, o evaluate pega o documento no meio do parse e vê window.DB vazio.
    const { targetId } = await cdp.enviar("Target.createTarget", { url });
    ({ sessionId } = await cdp.enviar("Target.attachToTarget", { targetId, flatten: true }));
    await cdp.enviar("Page.enable", {}, sessionId);
    await cdp.enviar("Runtime.enable", {}, sessionId);
    await esperarCarregar();

    console.log("1) checklist montado (seed atual: 4 núcleos, 27 projetos)");
    ok(await avaliar('document.querySelectorAll("#cv-projeto .cv-projeto-grupo[data-nucleo]").length === 4'),
      "4 fieldsets de núcleo");
    ok(await avaliar('document.querySelectorAll("#cv-projeto .cv-chk-projeto").length === 27'),
      "27 checkboxes de projeto");
    ok(await avaliar('document.querySelectorAll("#cv-projeto .cv-chk-todos-grupo").length === 4'),
      "1 checkbox \"selecionar todos\" por grupo");
    ok(await avaliar('document.querySelectorAll(".cv-bloco").length === 0'),
      "nenhum bloco antes de marcar qualquer coisa");
    ok(await avaliar('document.getElementById("cv-passo2").hidden === true'),
      "#cv-passo2 escondido antes de marcar qualquer coisa");

    console.log("2) marcar o 1º projeto de dois núcleos diferentes");
    await avaliar(`(function(){
      const grupos = document.querySelectorAll("#cv-projeto .cv-projeto-grupo[data-nucleo]");
      [grupos[0], grupos[1]].forEach((g) => {
        const c = g.querySelector(".cv-chk-projeto");
        c.checked = true; c.dispatchEvent(new Event("change", { bubbles: true }));
      });
      return true;
    })()`);
    await new Promise((r) => setTimeout(r, 300));
    ok(await avaliar('document.querySelectorAll(".cv-bloco").length === 2'), "2 blocos na tela");
    ok(await avaliar(`(function(){
      const nomes = Array.from(document.querySelectorAll(".cv-bloco")).map((b) => b.dataset.projeto);
      const grupos = document.querySelectorAll("#cv-projeto .cv-projeto-grupo[data-nucleo]");
      const esperado = [grupos[0], grupos[1]].map((g) => g.querySelector(".cv-chk-projeto").value);
      return JSON.stringify(nomes) === JSON.stringify(esperado);
    })()`), "blocos na ordem do checklist");
    ok(await avaliar('Array.from(document.querySelectorAll(".cv-bloco")).every((b) => b.querySelectorAll(".cv-linha-canal").length === 10)'),
      "10 linhas de canal em cada bloco");

    console.log("3) ?canal=empresa abre o cartão nos DOIS blocos (item 3.5)");
    ok(await avaliar('Array.from(document.querySelectorAll(".cv-bloco")).every((b) => !!b.querySelector(\'.cv-cartao[data-canal="empresa"]\'))'),
      "cartão do canal do QR aberto em todos os blocos");

    console.log("4) preencher a demanda só no bloco A não vaza pro bloco B");
    await avaliar(`(function(){
      const blocoA = document.querySelectorAll(".cv-bloco")[0];
      const c = blocoA.querySelector('.cv-cartao[data-canal="empresa"]');
      const set = (sel, v) => { const el = c.querySelector(sel); el.value = v; el.dispatchEvent(new Event("input", {bubbles:true})); };
      set(".cv-f-servico", "Consumo da base filtrada");
      set(".cv-f-responsavel", "Cristiano");
      return true;
    })()`);
    await new Promise((r) => setTimeout(r, 2600));
    // ⚠️ com ?canal=, todo bloco nasce com um cartão vazio daquele canal — "B tem 1
    // demanda em empresa" É O ESPERADO; o que prova que não vazou é o cartão de B
    // continuar vazio, não a contagem estar zerada.
    ok(await avaliar(`(function(){
      const blocoB = document.querySelectorAll(".cv-bloco")[1];
      const c = blocoB.querySelector('.cv-cartao[data-canal="empresa"]');
      return c.querySelector(".cv-f-servico").value === "" && c.querySelector(".cv-f-responsavel").value === "";
    })()`), "cartão de \"empresa\" no bloco B continua vazio");
    ok(await avaliar(`(function(){
      const blocoB = document.querySelectorAll(".cv-bloco")[1];
      const c = blocoB.querySelector('.cv-cartao[data-canal="empresa"]');
      return c.querySelector(".cv-badge-incompleta") ? true : c.textContent.indexOf("incompleta") !== -1;
    })()`), "cartão de \"empresa\" no bloco B com selo \"incompleta\"");
    ok(await avaliar(`(function(){
      const blocoA = document.querySelectorAll(".cv-bloco")[0];
      const c = blocoA.querySelector('.cv-cartao[data-canal="empresa"]');
      return c.querySelector(".cv-f-servico").value === "Consumo da base filtrada";
    })()`), "cartão de \"empresa\" no bloco A com o texto preenchido");

    // As três checagens acima olham só o DOM, e isso NÃO basta pra provar isolamento:
    // patchCartaoEl() nunca reescreve o value de um input depois de criar o cartão (é de
    // propósito — é o que impede um render() no meio da digitação de roubar o cursor).
    // Consequência: se os dois blocos passassem a compartilhar UM caderno, o cartão do
    // bloco B continuaria mostrando os campos vazios com que nasceu e as checagens de
    // cima passariam iguais, com o dado dos dois projetos indo pro caderno de um só.
    // Conferido na prática: com essa regressão injetada, o localStorage guarda UM caderno
    // ("ALI Academy") em vez de dois, e o DOM não denuncia nada.
    // Por isso a checagem que vale é no ARMAZENAMENTO, não na tela — é ele que vira linha
    // no banco, e "dado do projeto errado no lugar errado" é o bug que o plano nomeia
    // como o mais provável deste item.
    const cadernosGravados = await avaliar(`(function(){
      return Object.keys(localStorage)
        .filter((k) => k.indexOf("cc_canva_") === 0 && k !== "cc_canva_sessoes" && k !== "cc_canva_selecao")
        .map((k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } })
        .filter((v) => v && v.projeto)
        .map((v) => ({ projeto: v.projeto, servicos: (v.demandas || []).map((d) => d.servico || "") }));
    })()`);
    const nomesBlocos = await avaliar('JSON.stringify(Array.from(document.querySelectorAll(".cv-bloco")).map((b) => b.dataset.projeto))');
    const [nomeA, nomeB] = JSON.parse(nomesBlocos);
    ok(cadernosGravados.length === 2, "dois cadernos gravados, um por projeto marcado (não um só compartilhado)",
      "gravados=" + JSON.stringify(cadernosGravados.map((c) => c.projeto)));
    const gravadoA = cadernosGravados.find((c) => c.projeto === nomeA);
    const gravadoB = cadernosGravados.find((c) => c.projeto === nomeB);
    ok(!!gravadoA && gravadoA.servicos.indexOf("Consumo da base filtrada") !== -1,
      "o caderno gravado do projeto A tem a demanda que foi digitada nele");
    ok(!!gravadoB && gravadoB.servicos.every((sv) => sv === ""),
      "o caderno gravado do projeto B não recebeu nada do A",
      gravadoB ? JSON.stringify(gravadoB.servicos) : "sem caderno pro projeto B");

    console.log("5) \"Selecionar Todos\" do 1º núcleo marca o grupo inteiro");
    const nDoPrimeiroGrupo = await avaliar(`document.querySelectorAll("#cv-projeto .cv-projeto-grupo[data-nucleo]")[0].querySelectorAll(".cv-chk-projeto").length`);
    await avaliar(`(function(){
      const grupo = document.querySelectorAll("#cv-projeto .cv-projeto-grupo[data-nucleo]")[0];
      const todos = grupo.querySelector(".cv-chk-todos-grupo");
      todos.checked = true; todos.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);
    await new Promise((r) => setTimeout(r, 300));
    ok(await avaliar(`document.querySelectorAll("#cv-projeto .cv-projeto-grupo[data-nucleo]")[0].querySelectorAll(".cv-chk-projeto:checked").length === ${nDoPrimeiroGrupo}`),
      `todos os ${nDoPrimeiroGrupo} projetos do 1º núcleo marcados`);
    // blocos = todos do 1º núcleo + o 1º do 2º núcleo (já marcado no passo 2), sem duplicar.
    ok(await avaliar(`document.querySelectorAll(".cv-bloco").length === ${nDoPrimeiroGrupo} + 1`),
      `${nDoPrimeiroGrupo}+1 blocos na tela`);
    ok(await avaliar('document.querySelectorAll("#cv-projeto .cv-projeto-grupo[data-nucleo]")[0].querySelector(".cv-chk-todos-grupo").checked === true'),
      "cabeçalho do grupo marcado (checked)");
    ok(await avaliar('document.querySelectorAll("#cv-projeto .cv-projeto-grupo[data-nucleo]")[0].querySelector(".cv-chk-todos-grupo").indeterminate === false'),
      "cabeçalho do grupo sem indeterminate");

    console.log("6) desmarcar 1 do grupo deixa o cabeçalho indeterminate e some o bloco");
    await avaliar(`(function(){
      const grupo = document.querySelectorAll("#cv-projeto .cv-projeto-grupo[data-nucleo]")[0];
      const c = grupo.querySelectorAll(".cv-chk-projeto")[0];
      c.checked = false; c.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);
    await new Promise((r) => setTimeout(r, 300));
    ok(await avaliar('document.querySelectorAll("#cv-projeto .cv-projeto-grupo[data-nucleo]")[0].querySelector(".cv-chk-todos-grupo").indeterminate === true'),
      "cabeçalho do grupo vira indeterminate");
    ok(await avaliar(`document.querySelectorAll(".cv-bloco").length === ${nDoPrimeiroGrupo}`),
      "bloco do projeto desmarcado sumiu da tela");

    console.log("7) remarcar o mesmo projeto devolve o dado preenchido antes (não apaga)");
    // o 1º checkbox do 1º grupo é exatamente o "bloco A" do passo 4 (onde a demanda foi
    // preenchida) — desmarcar e remarcar ele é o teste de aceite "desmarcar não apaga
    // dado, remarcar mostra os dados de volta".
    await avaliar(`(function(){
      const grupo = document.querySelectorAll("#cv-projeto .cv-projeto-grupo[data-nucleo]")[0];
      const c = grupo.querySelectorAll(".cv-chk-projeto")[0];
      c.checked = true; c.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`);
    await new Promise((r) => setTimeout(r, 300));
    ok(await avaliar(`document.querySelectorAll(".cv-bloco").length === ${nDoPrimeiroGrupo} + 1`),
      "bloco volta a aparecer");
    ok(await avaliar(`(function(){
      const grupo = document.querySelectorAll("#cv-projeto .cv-projeto-grupo[data-nucleo]")[0];
      const nome = grupo.querySelectorAll(".cv-chk-projeto")[0].value;
      const bloco = Array.from(document.querySelectorAll(".cv-bloco")).find((b) => b.dataset.projeto === nome);
      const c = bloco.querySelector('.cv-cartao[data-canal="empresa"]');
      return c.querySelector(".cv-f-servico").value === "Consumo da base filtrada" &&
        c.querySelector(".cv-f-responsavel").value === "Cristiano";
    })()`), "o .cv-f-servico/.cv-f-responsavel voltam com o texto preenchido antes de desmarcar");

    console.log("8) escape \"não encontrei meu projeto\"");
    await avaliar(`(function(){
      document.getElementById("cv-escape-btn").click();
      document.getElementById("cv-projeto-livre").value = "Projeto de Teste Livre";
      document.getElementById("cv-escape-adicionar").click();
      return true;
    })()`);
    await new Promise((r) => setTimeout(r, 300));
    ok(await avaliar('!!document.getElementById("cv-projeto-livres")'), "grupo de projetos livres criado");
    ok(await avaliar(`(function(){
      const grupo = document.getElementById("cv-projeto-livres");
      const c = grupo.querySelector(".cv-chk-projeto");
      return !!c && c.checked === true && c.value === "Projeto de Teste Livre";
    })()`), "checkbox do projeto livre criado e marcado");
    ok(await avaliar('!!Array.from(document.querySelectorAll(".cv-bloco")).find((b) => b.dataset.projeto === "Projeto de Teste Livre")'),
      "bloco do projeto livre criado");
    ok(await avaliar('document.getElementById("cv-projeto-livre").value === ""'), "campo de texto livre limpo depois de adicionar");

    console.log("9) F5 restaura a mesma seleção");
    const antesQtdBlocos = await avaliar('document.querySelectorAll(".cv-bloco").length');
    const antesQtdMarcados = await avaliar('document.querySelectorAll("#cv-projeto .cv-chk-projeto:checked").length');
    await cdp.enviar("Page.navigate", { url }, sessionId);
    await esperarCarregar();
    ok(await avaliar(`document.querySelectorAll(".cv-bloco").length === ${antesQtdBlocos}`),
      "mesma quantidade de blocos depois do F5", "antes=" + antesQtdBlocos);
    ok(await avaliar(`document.querySelectorAll("#cv-projeto .cv-chk-projeto:checked").length === ${antesQtdMarcados}`),
      "mesma quantidade de checkboxes marcados depois do F5", "antes=" + antesQtdMarcados);

    console.log("10) ?projeto=<nome> chega marcado, em união com a seleção guardada");
    // precisa ser um projeto AINDA NÃO marcado, senão o teste não distingue "união" de
    // "já estava marcado" — depois do passo 5, o 1º núcleo inteiro está marcado.
    const nomeQualquerProjeto = await avaliar(`(function(){
      const c = Array.from(document.querySelectorAll("#cv-projeto .cv-chk-projeto")).find((x) => !x.checked);
      return c.value;
    })()`);
    await cdp.enviar("Page.navigate", { url: url + "&projeto=" + encodeURIComponent(nomeQualquerProjeto) }, sessionId);
    await esperarCarregar();
    ok(await avaliar(`document.querySelectorAll(".cv-bloco").length === ${antesQtdBlocos} + 1`),
      "bloco do ?projeto= somado aos que já estavam marcados (união, não substituição)");
    ok(await avaliar(`(function(){
      const c = Array.from(document.querySelectorAll("#cv-projeto .cv-chk-projeto")).find((x) => x.value === ${JSON.stringify(nomeQualquerProjeto)});
      return !!c && c.checked === true;
    })()`), "checkbox do ?projeto= chega marcado");
    ok(await avaliar(`document.querySelectorAll("#cv-projeto .cv-chk-projeto:checked").length === ${antesQtdMarcados} + 1`),
      "os projetos marcados antes continuam marcados");
  } finally {
    cdp.fechar();
    server.close();
    proc.kill();
    setTimeout(() => proc.kill("SIGKILL"), 2000);
    try { fs.rmSync(perfilTmp, { recursive: true, force: true }); } catch (e) { /* ignora */ }
  }

  console.log("");
  if (falhas.length) { console.log("FALHOU — " + falhas.length + " checagem(ns)"); process.exit(1); }
  console.log("CANVA/MULTIPROJETO OK — checklist multi-seleção, blocos independentes e persistência");
  process.exit(0);
})().catch((e) => { console.error("erro:", e.message); process.exit(1); });
