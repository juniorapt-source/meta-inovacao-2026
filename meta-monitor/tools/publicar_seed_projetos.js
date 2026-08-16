/* CAMADA 3 da governança do golden record (ver docs/GOVERNANCA_GOLDEN_RECORD.md).
 *
 * Reexporta data/projetos.js A PARTIR DO golden record (tabela meta_inovacao_projetos no
 * Supabase). É o SENTIDO INVERSO do tools/gerar_seed_supabase.js (que gera INSERTs a partir
 * dos arquivos): aqui o Supabase é a fonte da verdade e o arquivo é só o fallback offline —
 * este tool garante que o fallback nunca defase do golden.
 *
 * Uso:
 *   node tools/publicar_seed_projetos.js           # regenera data/projetos.js do Supabase
 *   node tools/publicar_seed_projetos.js --check    # NÃO escreve; sai 1 se o arquivo estiver
 *                                                    # defasado do golden (pra CI/testes)
 *
 * Leitura é pública (RLS deixa SELECT no anon) — usa só a anon key de js/config.js.
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");

const REPO = path.dirname(__dirname);
const DESTINO = path.join(REPO, "data", "projetos.js");

// carrega APP_CONFIG (js/config.js é escrito pro browser: window.APP_CONFIG = {...})
global.window = global;
require(path.join(REPO, "js", "config.js"));
const CFG = global.APP_CONFIG;
if (!CFG || !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY) {
  console.error("publicar_seed_projetos: não achei APP_CONFIG em js/config.js.");
  process.exit(2);
}

const TABELA = "meta_inovacao_projetos";

async function buscarGolden() {
  const url = CFG.SUPABASE_URL + "/rest/v1/" + TABELA +
    "?select=nucleo,iniciativa,representantes,ordem&deleted_at=is.null&order=ordem.asc";
  const r = await fetch(url, {
    headers: { apikey: CFG.SUPABASE_ANON_KEY, Authorization: "Bearer " + CFG.SUPABASE_ANON_KEY },
  });
  if (!r.ok) {
    let detalhe = "HTTP " + r.status;
    try { const b = await r.json(); if (b && b.message) detalhe = b.message; } catch (e) { /* corpo não-JSON */ }
    throw new Error(TABELA + ": " + detalhe);
  }
  return r.json();
}

// gera o conteúdo do arquivo no MESMO formato de data/projetos.js: agrupado por núcleo
// (linha em branco quando o núcleo muda), uma iniciativa por linha, só os campos que o
// seed/fallback usa (nucleo, iniciativa, representantes) — sem ordem/id, que são internos
// do golden e não fazem parte do contrato do arquivo.
function gerarConteudo(linhas) {
  const partes = ["window.DB = window.DB || {};", "window.DB.projetos = ["];
  let nucleoAnterior = null;
  linhas.forEach((p) => {
    if (nucleoAnterior !== null && p.nucleo !== nucleoAnterior) partes.push("");
    const obj = {
      nucleo: p.nucleo,
      iniciativa: p.iniciativa,
      representantes: Array.isArray(p.representantes) ? p.representantes : [],
    };
    // JSON.stringify de cada campo garante escape correto de aspas/acentos; o array de
    // representantes é montado com ", " entre itens pra bater com o estilo da casa.
    const repsTxt = "[" + obj.representantes.map((r) => JSON.stringify(r)).join(", ") + "]";
    partes.push("  { " +
      '"nucleo": ' + JSON.stringify(obj.nucleo) + ', ' +
      '"iniciativa": ' + JSON.stringify(obj.iniciativa) + ', ' +
      '"representantes": ' + repsTxt + " }" +
      (p === linhas[linhas.length - 1] ? "" : ","));
    nucleoAnterior = p.nucleo;
  });
  partes.push("];");
  return partes.join("\n") + "\n";
}

(async function () {
  const modoCheck = process.argv.includes("--check");
  let linhas;
  try {
    linhas = await buscarGolden();
  } catch (err) {
    console.error("publicar_seed_projetos: falha ao ler o golden record —", (err && err.message) || err);
    process.exit(modoCheck ? 0 : 2); // no --check, rede fora não é falha de drift; sai 0 (avisa e ignora)
    return;
  }
  if (!Array.isArray(linhas) || !linhas.length) {
    console.error("publicar_seed_projetos: golden record voltou vazio — não vou sobrescrever o seed.");
    process.exit(2);
    return;
  }
  const conteudo = gerarConteudo(linhas);
  const atual = fs.existsSync(DESTINO) ? fs.readFileSync(DESTINO, "utf8") : null;

  if (modoCheck) {
    if (atual === conteudo) {
      console.log("publicar_seed_projetos --check OK — data/projetos.js em dia com o golden (" + linhas.length + " iniciativas).");
      process.exit(0);
    }
    console.error("publicar_seed_projetos --check: data/projetos.js DEFASADO do golden record.");
    console.error("  Rode `node tools/publicar_seed_projetos.js` pra regenerar o fallback.");
    process.exit(1);
    return;
  }

  if (atual === conteudo) {
    console.log("publicar_seed_projetos: data/projetos.js já estava em dia (" + linhas.length + " iniciativas) — nada a fazer.");
    return;
  }
  fs.writeFileSync(DESTINO, conteudo, "utf8");
  console.log("publicar_seed_projetos: data/projetos.js regenerado do golden record (" + linhas.length + " iniciativas).");
})();
