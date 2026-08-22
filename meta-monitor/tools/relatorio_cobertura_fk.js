/* Camada 2, item 2.9 — relatório de cobertura de FK.
 *
 * Rodar DEPOIS das migrações da Camada 2 estarem aplicadas em produção (itens
 * 2.1/2.2/2.3/2.4/2.6/2.7 — tools/sql/2026-08_{projetos_nucleo_id,
 * projeto_representantes,urc_lideranca_pessoa_id,urc_canais_fk,
 * plano_responsaveis,corsario_status_fk}.sql). Lê o Supabase (só leitura, anon
 * key de js/config.js — mesmo padrão de tools/publicar_seed_projetos.js) e
 * imprime, por tabela, quantas linhas/instâncias ficaram sem a FK nova — não
 * precisa bater 100%: o objetivo é DEIXAR VISÍVEL o que sobrou pra José decidir
 * o que resolver na mão (mesmo espírito de "sinalizar discrepância, não
 * esconder" do golden record de projetos).
 *
 * Uso:
 *   node tools/relatorio_cobertura_fk.js
 *
 * Sem --check/--json de propósito: este relatório é pra leitura humana, não pra
 * CI (diferente de publicar_seed_projetos.js) — a Camada 2 não tem um "estado
 * certo" único pra comparar contra, só um retrato do que casou ou não.
 */
"use strict";
const path = require("node:path");

const REPO = path.dirname(__dirname);
global.window = global;
require(path.join(REPO, "js", "config.js"));
const CFG = global.APP_CONFIG;
if (!CFG || !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY) {
  console.error("relatorio_cobertura_fk: não achei APP_CONFIG em js/config.js.");
  process.exit(2);
}

async function buscar(tabela, query) {
  const url = CFG.SUPABASE_URL + "/rest/v1/" + tabela + "?" + query;
  const r = await fetch(url, {
    headers: { apikey: CFG.SUPABASE_ANON_KEY, Authorization: "Bearer " + CFG.SUPABASE_ANON_KEY },
  });
  if (!r.ok) {
    let detalhe = "HTTP " + r.status;
    try { const b = await r.json(); if (b && b.message) detalhe = b.message; } catch (e) { /* corpo não-JSON */ }
    throw new Error(tabela + ": " + detalhe);
  }
  return r.json();
}

function pct(feitas, total) {
  if (!total) return "—";
  return ((feitas / total) * 100).toFixed(0) + "%";
}

function linha(rotulo, feitas, total, exemplos) {
  const barra = pct(feitas, total);
  let s = "  " + rotulo.padEnd(46) + feitas + "/" + total + " (" + barra + ")";
  if (feitas < total && exemplos && exemplos.length) {
    s += "\n      faltando: " + exemplos.slice(0, 8).join(", ") + (exemplos.length > 8 ? ", …" : "");
  }
  return s;
}

(async function () {
  const relatorio = [];
  let algumaFalha = false;

  // 2.1 — meta_inovacao_projetos.nucleo_id
  try {
    const rows = await buscar("meta_inovacao_projetos", "select=iniciativa,nucleo_id&deleted_at=is.null");
    const semFk = rows.filter((r) => r.nucleo_id == null);
    relatorio.push(linha("2.1 projetos.nucleo_id", rows.length - semFk.length, rows.length, semFk.map((r) => r.iniciativa)));
  } catch (err) {
    algumaFalha = true;
    relatorio.push("  2.1 projetos.nucleo_id — ERRO: " + err.message + " (coluna existe? migração 2.1 já rodou?)");
  }

  // 2.3 — meta_inovacao_urc_lideranca.pessoa_id
  try {
    const rows = await buscar("meta_inovacao_urc_lideranca", "select=nome,pessoa_id&deleted_at=is.null");
    const semFk = rows.filter((r) => r.pessoa_id == null);
    relatorio.push(linha("2.3 urc_lideranca.pessoa_id", rows.length - semFk.length, rows.length, semFk.map((r) => r.nome)));
  } catch (err) {
    algumaFalha = true;
    relatorio.push("  2.3 urc_lideranca.pessoa_id — ERRO: " + err.message);
  }

  // 2.4 — meta_inovacao_urc_canais_responsaveis.canal_id + pessoa_id
  try {
    const rows = await buscar("meta_inovacao_urc_canais_responsaveis", "select=canal,nome,canal_id,pessoa_id&deleted_at=is.null");
    const semCanal = rows.filter((r) => r.canal_id == null);
    const semPessoa = rows.filter((r) => r.pessoa_id == null);
    relatorio.push(linha("2.4 urc_canais.canal_id", rows.length - semCanal.length, rows.length, semCanal.map((r) => r.canal + "/" + r.nome)));
    relatorio.push(linha("2.4 urc_canais.pessoa_id", rows.length - semPessoa.length, rows.length, semPessoa.map((r) => r.canal + "/" + r.nome)));
  } catch (err) {
    algumaFalha = true;
    relatorio.push("  2.4 urc_canais_responsaveis — ERRO: " + err.message);
  }

  // 2.7 — corsario_status.projeto_id + nucleo_id (por INICIATIVA/NÚCLEO distintos,
  // não por linha — cada iniciativa tem até 19 linhas, 1 por critério, e todas
  // compartilham a mesma FK)
  try {
    const rows = await buscar("corsario_status", "select=iniciativa,nucleo,projeto_id,nucleo_id");
    const porIniciativa = new Map();
    rows.forEach((r) => { if (!porIniciativa.has(r.iniciativa)) porIniciativa.set(r.iniciativa, r.projeto_id); });
    const iniciativasSemFk = [...porIniciativa.entries()].filter(([, v]) => v == null).map(([k]) => k);
    relatorio.push(linha("2.7 corsario_status.projeto_id (iniciativas)", porIniciativa.size - iniciativasSemFk.length, porIniciativa.size, iniciativasSemFk));

    const porNucleo = new Map();
    rows.forEach((r) => { if (!porNucleo.has(r.nucleo)) porNucleo.set(r.nucleo, r.nucleo_id); });
    const nucleosSemFk = [...porNucleo.entries()].filter(([, v]) => v == null).map(([k]) => k);
    relatorio.push(linha("2.7 corsario_status.nucleo_id (núcleos)", porNucleo.size - nucleosSemFk.length, porNucleo.size, nucleosSemFk));
  } catch (err) {
    algumaFalha = true;
    relatorio.push("  2.7 corsario_status — ERRO: " + err.message);
  }

  // 2.2 — meta_inovacao_projeto_representantes: cobertura = vínculos gravados vs.
  // instâncias em representantes[] (soma dos tamanhos dos arrays)
  try {
    const [projetos, vinculos] = await Promise.all([
      buscar("meta_inovacao_projetos", "select=id,iniciativa,representantes&deleted_at=is.null"),
      buscar("meta_inovacao_projeto_representantes", "select=projeto_id&deleted_at=is.null"),
    ]);
    const totalInstancias = projetos.reduce((n, p) => n + ((p.representantes && p.representantes.length) || 0), 0);
    relatorio.push(linha("2.2 projeto_representantes (vínculos)", vinculos.length, totalInstancias, []));
    if (vinculos.length < totalInstancias) {
      relatorio.push("      diferença esperada: 1 (placeholder \"Núcleo de Startups\", Sebrae Startups — não é órfão, ver CAMADA1_DEDUPE_PESSOAS.md/GOVERNANCA_GOLDEN_RECORD.md)");
    }
  } catch (err) {
    algumaFalha = true;
    relatorio.push("  2.2 projeto_representantes — ERRO: " + err.message);
  }

  // 2.6 — meta_inovacao_plano_responsaveis: cobertura = vínculos gravados vs.
  // instâncias em responsavel_id[]
  try {
    const [acoes, vinculos] = await Promise.all([
      buscar("meta_inovacao_plano_acoes", "select=id,responsavel_id&deleted_at=is.null"),
      buscar("meta_inovacao_plano_responsaveis", "select=plano_acao_id&deleted_at=is.null"),
    ]);
    const totalInstancias = acoes.reduce((n, a) => n + ((a.responsavel_id && a.responsavel_id.length) || 0), 0);
    relatorio.push(linha("2.6 plano_responsaveis (vínculos)", vinculos.length, totalInstancias, []));
  } catch (err) {
    algumaFalha = true;
    relatorio.push("  2.6 plano_responsaveis — ERRO: " + err.message);
  }

  console.log("Camada 2 — retrato de cobertura de FK\n" + "=".repeat(60));
  console.log(relatorio.join("\n"));
  console.log("=".repeat(60));
  if (algumaFalha) {
    console.log("\nAlguma tabela deu erro ao consultar — normalmente quer dizer que a\nmigração daquele item ainda não rodou em produção (coluna/tabela não existe\nainda). Não é uma falha deste script.");
  }
})();
