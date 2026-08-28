/* Teste MANUAL contra o Supabase de PRODUÇÃO de verdade — não entra no README, não faz
 * parte da suíte automática, não roda sozinho em lote com os outros `testar_*`.
 *
 * Por quê: a suíte inteira (todos os outros `tools/testar_*_headless.js`) força
 * ?semrede=1 / window.CC_FORCAR_FALLBACK, ou seja, nunca fala com o Supabase de
 * verdade — por desenho (item 3.1 do plano de melhorias: testes não podem depender de
 * rede pra não ficarem instáveis). O preço documentado em BACKLOG.md ("Cobertura de
 * teste com rede real"): bugs de integração real (o GRANT esquecido do P10, a ordem de
 * <script> de js/config.js num bug fix seguinte) só apareceram em produção DEPOIS do
 * push, porque nada na suíte conseguia pegá-los antes. Este arquivo é a resposta a essa
 * lacuna — sem substituir a suíte offline, soma a ela.
 *
 * O que faz (SÓ LEITURA — nunca escreve nada, seguro rodar contra produção quantas
 * vezes quiser, é a mesma leitura que qualquer visitante do site já faz): abre, sem
 * nenhum parâmetro de fallback, as páginas que hoje dependem do Supabase pra valer
 * (README, "Como os dados funcionam" — Plano de ação e Agenda; o resto de data/*.js
 * continua só local, fora do escopo deste teste) e confere, pra cada uma:
 *   1) o aviso "dados locais — pode haver defasagem" (#aviso-fallback) NÃO aparece —
 *      se aparecer, a leitura real caiu pro fallback (GRANT, RLS, tabela fora do ar,
 *      erro de rede — o teste não distingue o motivo, só que caiu);
 *   2) nenhum erro de console/exceção não tratada durante o carregamento — pega
 *      exatamente a classe de bug "ordem de <script> errada" (ex.: window.DB_PLANO
 *      usado antes de existir);
 *   3) a contagem de linhas voltou igual ou maior que o piso conhecido (47 ações, 20
 *      encontros — os mesmos números de data/plano.js e data/agenda.js, que continuam
 *      sendo o seed): cai pra checar contagem, não igualdade exata, porque dado novo
 *      cadastrado depois do seed é o esperado, não um erro.
 * index.html cobre só Plano (DB_PLANO); agenda.html cobre os dois (DB_PLANO +
 * DB_AGENDA) — 2 páginas bastam pra cobrir as 2 tabelas que hoje vivem no Supabase.
 *
 * Exige confirmação explícita — sem ela, sai sem tentar nenhuma rede:
 *   node tools/testar_rede_real_headless.js --confirmar
 *   CC_CONFIRMAR_REDE_REAL=1 node tools/testar_rede_real_headless.js
 *
 * Quando rodar: antes de um deploy grande que mexe em js/db-plano.js, js/db-agenda.js,
 * js/config.js, ou nas policies/GRANTs das tabelas meta_inovacao_plano_acoes/
 * meta_inovacao_agenda_encontros no Supabase.
 *
 * Onde rodar: PRECISA de rede de saída de verdade pra supabase.co. Não roda dentro de
 * uma sessão do Claude Code — a rede pra esse domínio é bloqueada de propósito nesse
 * ambiente (ver PLANO_EXECUCAO_GOLDEN_RECORD.md, item 8: "as sessões do Claude Code
 * também não conseguem LER o Supabase de produção"). Rode do seu computador, de onde o
 * `git push` normalmente sai.
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

const CONFIRMOU = process.argv.includes("--confirmar") || process.env.CC_CONFIRMAR_REDE_REAL === "1";
if (!CONFIRMOU) {
  console.log(
    "Pulado (nada de rede tentado): este teste fala com o Supabase de PRODUÇÃO de\n" +
    "verdade (só leitura). Rode com --confirmar (ou CC_CONFIRMAR_REDE_REAL=1) quando\n" +
    "tiver rede de saída de verdade pra supabase.co e quiser conferir antes de um\n" +
    "deploy grande — ver o comentário no topo de tools/testar_rede_real_headless.js."
  );
  process.exit(0);
}

// piso conhecido — mesmos números de F1 (tools/validar_dados.py) pros dois conjuntos
// que hoje vivem no Supabase; produção só cresce a partir daqui, nunca devia encolher.
const PISO = { plano: 47, agenda: 20 };

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
    const ouvintes = new Map(); // método -> [callback, ...] — persistentes, ao contrário de once()
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
      // persistente — usado pra juntar TODO console.error/exceção durante um
      // carregamento inteiro, não só o primeiro (once() serve mal aqui: resolve uma vez
      // só, o resto dos eventos cai num resolve já consumido, sem quebrar mas sem contar)
      on(method, cb) {
        const lista = ouvintes.get(method) || [];
        lista.push(cb);
        ouvintes.set(method, lista);
      },
      close() { ws.close(); },
    };
  });
}

function esperar(ms) { return new Promise((r) => setTimeout(r, ms)); }

// páginas críticas — cobrem os dois conjuntos que hoje vivem no Supabase (README,
// "Como os dados funcionam"). index.html só depende de DB_PLANO; agenda.html depende
// dos dois ao mesmo tempo — 2 páginas bastam pra cobrir as 2 tabelas, sem precisar
// varrer as 5 páginas que leem Plano (README lista index/plano/caminho/minhas-ações/
// agenda) uma por uma.
const PAGINAS = [
  { arquivo: "index.html", conjuntos: ["plano"] },
  { arquivo: "agenda.html", conjuntos: ["plano", "agenda"] },
];

async function principal() {
  const chromePath = acharChrome();
  const { server, port } = await iniciarServidor();
  const { proc, wsUrl, perfilTmp } = await iniciarChrome(chromePath);
  const cdp = await conectarCDP(wsUrl);
  const erros = [];
  const notas = [];

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

    for (const { arquivo, conjuntos } of PAGINAS) {
      const consoleErros = [];
      const excecoes = [];
      // registrados ANTES do Page.navigate — precisam pegar erro que acontece durante
      // o próprio carregamento, não só depois
      cdp.on("Runtime.consoleAPICalled", (p) => {
        if (p.type === "error") consoleErros.push((p.args || []).map((a) => a.value ?? a.description ?? "").join(" "));
      });
      cdp.on("Runtime.exceptionThrown", (p) => {
        excecoes.push((p.exceptionDetails && p.exceptionDetails.text) || "exceção sem descrição");
      });

      // SEM ?semrede=1 e SEM CC_FORCAR_FALLBACK — é exatamente isso que muda deste
      // teste pra todo o resto da suíte: aqui a página tenta o Supabase de verdade.
      const carregou = cdp.once("Page.loadEventFired");
      await cdp.send("Page.navigate", { url: "http://127.0.0.1:" + port + "/" + arquivo }, sessionId);
      await carregou;
      await esperar(1200); // tempo pro fetch real (rede de verdade, não localhost) responder

      const avisoFallback = await evaluate(
        "(function(){ var el = document.getElementById('aviso-fallback'); return el ? el.hidden : null; })()"
      );
      if (avisoFallback === null) {
        erros.push(arquivo + ": não achei #aviso-fallback na página (id renomeado? checar js/core.js e a página)");
      } else if (avisoFallback === false) {
        erros.push(arquivo + ": caiu pro fallback local — #aviso-fallback está visível (Supabase não respondeu, GRANT/RLS bloqueou, ou a tabela não existe)");
      }

      if (consoleErros.length) {
        erros.push(arquivo + ": " + consoleErros.length + " erro(s) de console durante o carregamento — " + consoleErros.slice(0, 3).join(" | "));
      }
      if (excecoes.length) {
        erros.push(arquivo + ": " + excecoes.length + " exceção(ões) não tratada(s) — " + excecoes.slice(0, 3).join(" | "));
      }

      // contagem real — chama DB_PLANO/DB_AGENDA.carregar() de novo (mesma função que a
      // página já usou pra montar a tela; leitura extra, ainda só leitura) só pra ter o
      // número exato, sem depender de nenhuma variável interna da página
      for (const conjunto of conjuntos) {
        const global = conjunto === "plano" ? "DB_PLANO" : "DB_AGENDA";
        const r = await evaluate(
          "(async function(){ if (!window." + global + ") return { erro: '" + global + " não existe' }; " +
          "var r = await " + global + ".carregar(); return { total: (r.lista||[]).length, usandoFallback: !!r.usandoFallback }; })()"
        );
        if (r.erro) { erros.push(arquivo + ": " + r.erro); continue; }
        if (r.usandoFallback) { erros.push(arquivo + ": " + global + ".carregar() confirmou fallback (não é só a UI — o dado também caiu pro local)"); continue; }
        if (r.total < PISO[conjunto]) {
          erros.push(arquivo + ": " + conjunto + " voltou com " + r.total + " linha(s), menos que o piso conhecido (" + PISO[conjunto] + ") — produção não devia encolher");
        } else {
          notas.push(arquivo + ": " + conjunto + " OK, " + r.total + " linha(s)" + (r.total > PISO[conjunto] ? " (cresceu desde o seed, esperado)" : ""));
        }
      }
    }

    if (erros.length) {
      console.error("FALHOU testar_rede_real_headless:");
      erros.forEach((e) => console.error(" -", e));
      process.exitCode = 1;
    } else {
      console.log("rede_real OK — " + PAGINAS.map((p) => p.arquivo).join(" e ") + " leram o Supabase de PRODUÇÃO de verdade " +
        "(sem cair pro fallback, sem erro de console), com todas as contagens no piso ou acima:");
      notas.forEach((n) => console.log("  - " + n));
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
