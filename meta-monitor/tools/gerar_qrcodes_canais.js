/* Item 7 do plano do canvas das oficinas (docs/PLANO_CANVA_OFICINAS.md, §12): gera um QR code
 * por canal, um arquivo .png por canal, pronto pra colar no último slide da apresentação
 * daquele canal — QR grande + a URL escrita por extenso junto, pra quem não conseguir ler o QR
 * digitar (§10). Roda uma vez (ou de novo se um canal for renomeado/entrar algum dia); a saída
 * fica versionada em qrcodes/, não precisa gerar de novo em toda sessão de trabalho.
 *
 * Fonte da lista de canais: data/canais.js, a mesma que canva.html e a matriz usam — não é um
 * 6º lugar com a whitelist duplicada (validar_dados.py já cobra os outros cinco).
 *
 * O parâmetro da URL é só `?canal=<id>`. Sem ciclo, sem facilitador: canva.html deriva os dois
 * de data/agenda.js cruzando o canal com a data de hoje (§5) — o QR é impresso, uma vez, e não
 * dá pra corrigir depois se um encontro for remarcado.
 *
 * Como funciona: monta um cartão HTML autocontido por canal (QR embutido como SVG, sem carregar
 * lib nenhuma no navegador — a matriz já vem calculada daqui), e tira um screenshot dele com o
 * Chrome/Chromium já instalado na máquina via CDP (Chrome DevTools Protocol) cru — o mesmo
 * mecanismo dos tools/testar_*_headless.js, sem instalar Playwright nem nenhuma dependência
 * nova (ver o comentário de testar_dashboard_headless.js). A única exceção de dependência deste
 * repositório é o encoder de QR em tools/vendor/ — ver tools/vendor/README.md.
 *
 * Uso: node tools/gerar_qrcodes_canais.js
 * Saída: qrcodes/<id-do-canal>.png (10 arquivos), um por linha de data/canais.js.
 */
"use strict";
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const REPO = path.join(__dirname, "..");
const SAIDA = path.join(REPO, "qrcodes");
const BASE_URL = "https://www.cartacorso.com.br/canva.html?canal=";

global.window = global;
require(path.join(REPO, "data", "canais.js"));
const qrcode = require(path.join(__dirname, "vendor", "qrcode-generator.js"));

const canais = window.DB.canais;
if (!Array.isArray(canais) || canais.length !== 10) {
  throw new Error("data/canais.js: esperava 10 canais, veio " + (canais && canais.length));
}

// --- 1. matriz do QR (biblioteca vendorizada) -----------------------------------------------
function matrizQr(texto) {
  const qr = qrcode(0, "H"); // typeNumber 0 = a lib escolhe a menor versão; H = correção máxima
  qr.addData(texto);
  qr.make();
  const n = qr.getModuleCount();
  const modulos = [];
  for (let r = 0; r < n; r++) {
    const linha = [];
    for (let c = 0; c < n; c++) linha.push(qr.isDark(r, c));
    modulos.push(linha);
  }
  return modulos;
}

// --- 2. SVG do QR a partir da matriz (com quiet zone de 4 módulos, mínimo da especificação) -
function svgQr(modulos, ladoPx) {
  const n = modulos.length;
  const quietZone = 4;
  const tam = n + quietZone * 2;
  const modulo = ladoPx / tam;
  let rects = "";
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!modulos[r][c]) continue;
      const x = (c + quietZone) * modulo;
      const y = (r + quietZone) * modulo;
      rects += `<rect x="${x.toFixed(3)}" y="${y.toFixed(3)}" width="${modulo.toFixed(3)}" height="${modulo.toFixed(3)}"/>`;
    }
  }
  return `<svg width="${ladoPx}" height="${ladoPx}" viewBox="0 0 ${ladoPx} ${ladoPx}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">` +
    `<rect width="${ladoPx}" height="${ladoPx}" fill="#fff"/><g fill="#2b2620">${rects}</g></svg>`;
}

// --- 3. cartão HTML por canal — paleta e papéis de fonte de docs/IDENTIDADE_VISUAL.md,
// hardcoded (não linkando css/base.css) porque este é um arquivo impresso/exportado, não uma
// página do site: precisa ficar estável mesmo que o CSS do painel mude depois. Cantos sempre
// retos (a identidade não usa border-radius em nada — "cartas náuticas não têm cantos
// arredondados").
const LARGURA = 900, LADO_QR = 560;
function cartaoHtml(canal, url) {
  const svg = svgQr(matrizQr(url), LADO_QR);
  const linha1 = "https://www.cartacorso.com.br/canva.html";
  const linha2 = "?canal=" + canal.id;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@500;700&family=IBM+Plex+Mono:wght@500&family=Spectral:wght@600&display=swap" rel="stylesheet">
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:${LARGURA}px}
  body{background:#f4efe4}
  .cartao{width:${LARGURA}px;background:#fbf8f0;border:1px solid rgba(43,38,32,.22);
    border-top:6px solid #8f2d2d;padding:44px 56px 40px;display:flex;flex-direction:column;
    align-items:center;text-align:center;font-family:'DM Sans',Arial,sans-serif}
  .eyebrow{font-weight:700;font-size:14px;letter-spacing:.14em;text-transform:uppercase;color:#8f2d2d}
  .instrucao{margin-top:10px;font-size:14px;color:rgba(43,38,32,.72)}
  h1{margin-top:16px;font-family:'Spectral',Georgia,serif;font-weight:600;font-size:40px;
    line-height:1.18;color:#2b2620;max-width:${LARGURA - 100}px}
  .qr{margin-top:26px;background:#fff;padding:20px;border:1px solid rgba(43,38,32,.22)}
  .qr svg{display:block}
  .rodape-label{margin-top:22px;font-size:13px;color:rgba(43,38,32,.72)}
  .url{margin-top:6px;font-family:'IBM Plex Mono',ui-monospace,monospace;font-weight:500;
    font-size:22px;color:#2b2620;line-height:1.5}
  .aviso{margin-top:20px;font-family:'Spectral',Georgia,serif;font-style:italic;font-size:14.5px;
    color:rgba(43,38,32,.68);max-width:${LARGURA - 140}px}
</style></head><body>
  <div class="cartao">
    <div class="eyebrow">Canvas de demandas</div>
    <div class="instrucao">Aponte a câmera do celular para abrir</div>
    <h1>${canal.nome}</h1>
    <div class="qr">${svg}</div>
    <div class="rodape-label">ou digite no navegador do celular:</div>
    <div class="url">${linha1}<br>${linha2}</div>
    <div class="aviso">Não conseguiu ler o QR? Digite o endereço acima.</div>
  </div>
</body></html>`;
}

// --- 4. Chrome headless via CDP cru (mesmo mecanismo de tools/testar_dashboard_headless.js) --
const CAMINHOS_CHROME = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable", "/usr/bin/chromium", "/usr/bin/chromium-browser",
];
function acharChromePlaywright() {
  // ambientes de execução remota deste projeto trazem só o Chromium do Playwright
  // (PLAYWRIGHT_BROWSERS_PATH), sem Chrome/Chromium nos caminhos padrão do SO — mesmo sem usar
  // o pacote Playwright, o binário já baixado serve pro CDP cru igual a qualquer outro Chromium.
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!base || !fs.existsSync(base)) return null;
  const candidatos = fs.readdirSync(base).filter((n) => n.startsWith("chromium-")).sort().reverse();
  for (const c of candidatos) {
    const p = path.join(base, c, "chrome-linux", "chrome");
    if (fs.existsSync(p)) return p;
  }
  return null;
}
function acharChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  for (const p of CAMINHOS_CHROME) if (fs.existsSync(p)) return p;
  const viaPlaywright = acharChromePlaywright();
  if (viaPlaywright) return viaPlaywright;
  throw new Error(
    "Não achei um Chrome/Chromium instalado (procurei em: " + CAMINHOS_CHROME.join(", ") +
    "; e em $PLAYWRIGHT_BROWSERS_PATH). Defina CHROME_PATH=/caminho/pro/chrome se estiver em outro lugar."
  );
}
function iniciarChrome(chromePath) {
  const perfilTmp = fs.mkdtempSync(path.join(os.tmpdir(), "meta-inovacao-qrcodes-chrome-"));
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
    setTimeout(() => { proc.kill("SIGKILL"); resolve(); }, 3000);
  });
}
async function limparPerfil(perfilTmp) {
  if (!perfilTmp) return;
  try { await fs.promises.rm(perfilTmp, { recursive: true, force: true, maxRetries: 3 }); }
  catch (e) { console.error("aviso: não consegui limpar o perfil temporário do Chrome (" + perfilTmp + "):", e.message); }
}
function conectarCDP(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let proximoId = 1;
    const pendentes = new Map();
    ws.addEventListener("error", (e) => reject(new Error("WebSocket CDP falhou: " + e.message)));
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id !== undefined && pendentes.has(msg.id)) {
        const { resolve: res, reject: rej } = pendentes.get(msg.id);
        pendentes.delete(msg.id);
        if (msg.error) rej(new Error("CDP " + JSON.stringify(msg.error)));
        else res(msg.result);
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
      close() { ws.close(); },
    };
  });
}
function esperar(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function evaluate(cdp, sessionId, expression) {
  const r = await cdp.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }, sessionId);
  if (r.exceptionDetails) throw new Error("erro avaliando no browser: " + JSON.stringify(r.exceptionDetails));
  return r.result.value;
}

// altura do cartão é medida, não chutada: o título tem entre 1 e 3 linhas conforme o nome do
// canal ("CNR" vs. "Contabilizações e instrumentos"), então uma altura fixa ou sobra espaço
// em branco ou corta conteúdo — melhor medir o .cartao já renderizado e recortar exatamente nele.
async function screenshotHtml(cdp, sessionId, html, deviceScaleFactor) {
  const url = "data:text/html;charset=utf-8;base64," + Buffer.from(html, "utf-8").toString("base64");
  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: LARGURA, height: 1600, deviceScaleFactor, mobile: false,
  }, sessionId);
  await cdp.send("Page.navigate", { url }, sessionId);
  await esperar(400); // fontes do Google Fonts carregando via rede
  const altura = await evaluate(cdp, sessionId, "Math.ceil(document.querySelector('.cartao').getBoundingClientRect().height)");
  const { data } = await cdp.send("Page.captureScreenshot", {
    format: "png", clip: { x: 0, y: 0, width: LARGURA, height: altura, scale: 1 },
  }, sessionId);
  return Buffer.from(data, "base64");
}

async function principal() {
  fs.mkdirSync(SAIDA, { recursive: true });
  const chromePath = acharChrome();
  const { proc, wsUrl, perfilTmp } = await iniciarChrome(chromePath);
  const cdp = await conectarCDP(wsUrl);
  try {
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    await cdp.send("Page.enable", {}, sessionId);

    for (const canal of canais) {
      const url = BASE_URL + canal.id;
      const html = cartaoHtml(canal, url);
      const png = await screenshotHtml(cdp, sessionId, html, 2); // 2x = ~1800×2300px, qualidade de impressão
      const destino = path.join(SAIDA, canal.id + ".png");
      fs.writeFileSync(destino, png);
      console.log("gerado:", path.relative(REPO, destino), "→", url);
    }
  } finally {
    cdp.close();
    await encerrarChrome(proc);
    await limparPerfil(perfilTmp);
  }
  console.log(canais.length + " QR codes gerados em " + path.relative(REPO, SAIDA) + "/");
}

principal().catch((e) => { console.error("FALHOU:", e.message); process.exit(1); });
