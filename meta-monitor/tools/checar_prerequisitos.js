/* Checagem de pré-requisitos — "o que eu preciso ter pra rodar este projeto?"
 *
 * Feito pra quem está REPLICANDO este repositório em outra conta/organização (ver
 * REPLICAR.md na raiz). Roda sem instalar nada, sem rede (a menos que você peça) e
 * responde três perguntas:
 *
 *   1. As ferramentas locais que a suíte de testes usa estão aqui? (node, python3, Chrome)
 *   2. A configuração ainda aponta pro Supabase do projeto ORIGINAL, ou já é o seu?
 *   3. Quais tabelas o site consulta em tempo de execução, qual script SQL cria cada uma,
 *      e em que ordem rodar — a ordem é CALCULADA a partir dos cabeçalhos
 *      "ORDEM DE EXECUÇÃO: depois de <arquivo>.sql" dos próprios scripts, não de uma
 *      lista escrita à mão que envelhece.
 *
 * Uso:
 *   node tools/checar_prerequisitos.js            # diagnóstico local, sem rede
 *   node tools/checar_prerequisitos.js --rede     # + bate no Supabase configurado em
 *                                                 #   js/config.js e diz, tabela a tabela,
 *                                                 #   se ela responde, não existe, ou
 *                                                 #   existe sem GRANT (permission denied)
 *
 * Saída: relatório legível + código de saída 0 (tudo o que é obrigatório está de pé) ou
 * 1 (falta algo obrigatório). Avisos (⚠) não derrubam o código de saída.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("node:child_process");

const RAIZ = path.resolve(__dirname, "..");
const COM_REDE = process.argv.includes("--rede");

// Supabase do projeto ORIGINAL (Sebrae Nacional). Se a config ainda tiver estes valores,
// a cópia está lendo o banco de outra pessoa — funciona, mas não é uma réplica.
const SUPABASE_ORIGINAL = "wdygbfrmewlaffjsfyoi";

let erros = 0;
const linhas = [];
function titulo(t) { linhas.push("", "── " + t + " " + "─".repeat(Math.max(0, 66 - t.length))); }
function ok(m) { linhas.push("  ✓ " + m); }
function aviso(m) { linhas.push("  ⚠ " + m); }
function falha(m) { linhas.push("  ✗ " + m); erros++; }
function nota(m) { linhas.push("    " + m); }

function ler(rel) {
  try { return fs.readFileSync(path.join(RAIZ, rel), "utf8"); } catch (_) { return null; }
}

// ---------------------------------------------------------------------------
// 1) Ferramentas locais
// ---------------------------------------------------------------------------
function checarFerramentas() {
  titulo("1. Ferramentas locais");

  const maior = Number(process.versions.node.split(".")[0]);
  if (maior >= 18) ok("Node " + process.versions.node + " (a suíte usa fetch/CDP nativos, precisa de 18+)");
  else falha("Node " + process.versions.node + " — os testes headless precisam de Node 18 ou mais novo.");

  let py = null;
  for (const cmd of ["python3", "python"]) {
    try { py = execFileSync(cmd, ["-V"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim() + " (" + cmd + ")"; break; } catch (_) { /* tenta o próximo */ }
  }
  if (py) ok(py + " — usado por tools/validar_dados.py, validar_site.py, testar_kpis_cruzado.py");
  else falha("python3 não encontrado — 3 dos testes da suíte são Python (só biblioteca padrão, nada de pip).");

  const CAMINHOS_CHROME = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome", "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium", "/usr/bin/chromium-browser",
  ];
  const chrome = (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH))
    ? process.env.CHROME_PATH
    : CAMINHOS_CHROME.find((p) => fs.existsSync(p));
  if (chrome) ok("Chrome/Chromium em " + chrome + " — os testes headless (tools/testar_*_headless.js) usam ele");
  else aviso("Chrome/Chromium não encontrado. Os testes headless não rodam; o resto sim. "
    + "Instale o Chrome ou aponte CHROME_PATH=/caminho/pro/chrome.");

  nota("Não há package.json nem requirements.txt de propósito: o projeto não tem dependência");
  nota("externa nenhuma — nada de npm install, nada de pip install, nada de build.");
}

// ---------------------------------------------------------------------------
// 2) Configuração (para onde esta cópia está apontando)
// ---------------------------------------------------------------------------
function checarConfig() {
  titulo("2. Configuração — de quem é o banco que esta cópia usa");

  const cfg = ler("js/config.js");
  if (!cfg) { falha("js/config.js não existe — é onde ficam SUPABASE_URL e SUPABASE_ANON_KEY."); return; }

  const url = (cfg.match(/SUPABASE_URL:\s*"([^"]*)"/) || [])[1] || "";
  const key = (cfg.match(/SUPABASE_ANON_KEY:\s*"([^"]*)"/) || [])[1] || "";

  if (!url || !key) {
    falha("js/config.js sem SUPABASE_URL e/ou SUPABASE_ANON_KEY preenchidos.");
  } else if (url.includes(SUPABASE_ORIGINAL)) {
    aviso("js/config.js ainda aponta pro Supabase do projeto ORIGINAL (" + url + ").");
    nota("Enquanto estiver assim, sua cópia lê e ESCREVE no banco de outra pessoa.");
    nota("Crie seu próprio projeto em supabase.com e troque URL + anon key aqui.");
  } else {
    ok("js/config.js aponta pra um Supabase próprio: " + url);
  }
  nota("A anon key fica versionada de propósito: ela não é segredo, quem protege é a RLS.");

  const dataCfg = ler("data/config.js");
  if (dataCfg && /"tokenEscrita":\s*"a7c11b08-5a62-453c-ba8d-6bd0680e2f90"/.test(dataCfg)) {
    aviso("data/config.js ainda usa o tokenEscrita do projeto original.");
    nota("Gere um UUID novo, troque aqui E em tools/sql/2026-08_reverte_para_token_compartilhado.sql");
    nota("(os dois precisam bater 1:1 — é o que a RLS de escrita compara).");
  } else if (dataCfg) {
    ok("data/config.js com tokenEscrita próprio.");
  }
}

// ---------------------------------------------------------------------------
// 3) Banco — tabelas usadas em runtime × scripts que as criam × ordem
// ---------------------------------------------------------------------------
function tabelasUsadasPeloSite() {
  const alvos = [];
  for (const dir of ["js", "."]) {
    const abs = path.join(RAIZ, dir);
    for (const f of fs.readdirSync(abs)) {
      if (f.endsWith(".js") || f.endsWith(".html")) {
        const p = path.join(abs, f);
        if (fs.statSync(p).isFile()) alvos.push(p);
      }
    }
  }
  const achadas = new Set();
  const PADROES = [
    /\.from\("([a-z_]+)"\)/g,
    /supaBuscar\("([a-z_]+)"/g,
    /TABELA[A-Z_]*\s*=\s*"([a-z_]+)"/g,
    /\/rest\/v1\/([a-z_]+)/g,
  ];
  for (const p of alvos) {
    const txt = fs.readFileSync(p, "utf8");
    for (const re of PADROES) {
      let m;
      while ((m = re.exec(txt))) if (m[1].includes("_")) achadas.add(m[1]);
    }
  }
  return [...achadas].sort();
}

function scriptsSql() {
  const arquivos = [];
  for (const dir of ["tools/sql", "supabase"]) {
    const abs = path.join(RAIZ, dir);
    if (!fs.existsSync(abs)) continue;
    for (const f of fs.readdirSync(abs).sort()) {
      if (!f.endsWith(".sql")) continue;
      const rel = dir + "/" + f;
      const txt = fs.readFileSync(path.join(abs, f), "utf8");
      const cria = new Set();
      let m;
      // tira as linhas de comentário antes de procurar CREATE TABLE: vários cabeçalhos
      // explicam o script citando "create table ..." em prosa, e isso viraria tabela falsa.
      const sqlPuro = txt.split("\n").filter((l) => !/^\s*--/.test(l)).join("\n");
      const re = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z_]+)/gi;
      while ((m = re.exec(sqlPuro))) cria.add(m[1].toLowerCase());
      // "depois de <arquivo>.sql" nos cabeçalhos ORDEM DE EXECUÇÃO / ORDEM:
      const depois = new Set();
      for (const linha of txt.split("\n").slice(0, 120)) {
        if (!/ORDEM|depois de/i.test(linha)) continue;
        let d;
        const reDep = /([0-9a-z_\-]+\.sql)/gi;
        while ((d = reDep.exec(linha))) if (d[1] !== f) depois.add(d[1]);
      }
      const perigoso = /PARCIALMENTE REVERTIDO|REINTRODUZ|COMO REVERTER/i.test(txt.slice(0, 3000));
      arquivos.push({ nome: f, rel, cria: [...cria], depois: [...depois], perigoso });
    }
  }
  return arquivos;
}

function ordenar(arquivos) {
  // topológica estável: mantém a ordem alfabética entre arquivos sem dependência entre si
  const porNome = new Map(arquivos.map((a) => [a.nome, a]));
  const visto = new Set(), saida = [], caminho = new Set();
  function visitar(a) {
    if (visto.has(a.nome) || caminho.has(a.nome)) return; // ciclo: ignora a aresta
    caminho.add(a.nome);
    for (const d of a.depois) if (porNome.has(d)) visitar(porNome.get(d));
    caminho.delete(a.nome);
    visto.add(a.nome);
    saida.push(a);
  }
  for (const a of arquivos) visitar(a);
  return saida;
}

function checarBanco() {
  titulo("3. Banco de dados — o que precisa existir no SEU Supabase");

  const usadas = tabelasUsadasPeloSite();
  const arquivos = scriptsSql();
  const criadaPor = new Map();
  for (const a of arquivos) for (const t of a.cria) if (!criadaPor.has(t)) criadaPor.set(t, a.rel);

  const semDdl = usadas.filter((t) => !criadaPor.has(t));
  ok(usadas.length + " tabelas são consultadas pelo site em tempo de execução.");
  ok((usadas.length - semDdl.length) + " delas têm CREATE TABLE versionado neste repositório.");

  if (semDdl.length) {
    aviso(semDdl.length + " tabela(s) NÃO têm CREATE TABLE em lugar nenhum do repositório:");
    for (const t of semDdl) nota("• " + t);
    nota("Elas foram criadas à mão no Table Editor do Supabase original, antes deste padrão.");
    nota("Numa réplica você precisa criá-las você mesma (os scripts que as ALTERAM mostram");
    nota("as colunas esperadas — grep pelo nome da tabela em tools/sql/), ou aceitar que as");
    nota("telas que dependem delas fiquem vazias (Corsário e Atividades por iniciativa).");
  }

  linhas.push("", "  Ordem de execução no SQL Editor do Supabase (calculada dos cabeçalhos dos scripts):");
  ordenar(arquivos).forEach((a, i) => {
    const cria = a.cria.length ? "  → cria " + a.cria.join(", ") : "";
    linhas.push("   " + String(i + 1).padStart(2) + ". " + a.rel + cria);
    if (a.perigoso) linhas.push("       ⚠ tem seção de reversão / estado parcial — leia o cabeçalho ANTES de rodar inteiro.");
  });
  nota("");
  nota("A ordem acima é derivada, não curada: scripts sem cabeçalho de ordem caem na");
  nota("posição alfabética. Leia o cabeçalho de cada um — todos explicam o que fazem.");
}

// ---------------------------------------------------------------------------
// 4) Rede (opcional) — conversa com o Supabase configurado
// ---------------------------------------------------------------------------
async function checarRede() {
  titulo("4. Rede — o que o Supabase configurado responde de verdade");

  const cfg = ler("js/config.js") || "";
  const url = (cfg.match(/SUPABASE_URL:\s*"([^"]*)"/) || [])[1];
  const key = (cfg.match(/SUPABASE_ANON_KEY:\s*"([^"]*)"/) || [])[1];
  if (!url || !key) { falha("sem URL/anon key em js/config.js — não dá pra testar a rede."); return; }

  linhas.push("  Consultando " + url + " (só leitura, 1 linha por tabela)…");
  for (const t of tabelasUsadasPeloSite()) {
    let r;
    try {
      r = await fetch(url + "/rest/v1/" + t + "?select=*&limit=1", {
        headers: { apikey: key, Authorization: "Bearer " + key },
      });
    } catch (e) {
      falha(t + " — erro de rede: " + e.message);
      continue;
    }
    if (r.ok) { ok(t + " — responde"); continue; }
    let corpo = {};
    try { corpo = await r.json(); } catch (_) { /* resposta sem json */ }
    const cod = corpo.code || r.status;
    if (cod === "42P01" || cod === "PGRST205") falha(t + " — NÃO EXISTE (rode o script que a cria)");
    else if (cod === "42501") falha(t + " — existe, mas falta GRANT SELECT pra anon (ver tools/sql/PADRAO_TABELA.md)");
    else falha(t + " — " + cod + " " + (corpo.message || r.statusText));
  }
}

// ---------------------------------------------------------------------------
async function main() {
  linhas.push("", "PRÉ-REQUISITOS — Carta de Corso / Meta Inovação 2026",
    "Guia completo da réplica: REPLICAR.md (na raiz do repositório)");
  checarFerramentas();
  checarConfig();
  checarBanco();
  if (COM_REDE) await checarRede();
  else { titulo("4. Rede"); nota("pulado. Rode com --rede pra conferir tabela a tabela no Supabase configurado."); }

  linhas.push("", "─".repeat(70));
  linhas.push(erros === 0
    ? "Nada obrigatório faltando. Avisos (⚠) acima são decisões suas, não erros."
    : erros + " item(ns) obrigatório(s) faltando — veja os ✗ acima.");
  linhas.push("");
  console.log(linhas.join("\n"));
  process.exit(erros === 0 ? 0 : 1);
}

main();
