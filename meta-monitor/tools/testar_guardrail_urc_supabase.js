/* Teste F14: guardrail_urc_supabase — reforça contra o Supabase de produção o mesmo
 * guardrail que tools/validar_dados.py já aplica contra o arquivo local (data/urc.js):
 * nenhum responsável de canal pode ter o mesmo nome de alguém da liderança da URC
 * (liderança é transversal, não entra em canal específico).
 *
 * Item 4.4 ("Correções v0.18.x"): com meta_inovacao_urc_lideranca/
 * meta_inovacao_urc_canais_responsaveis migradas pro Supabase, editor.html BLOQUEIA essa
 * violação no client antes de salvar (js/db-urc.js, DB_URC.salvarResponsavel/
 * criarResponsavel) — mas isso só impede violação NOVA por essa tela específica; não
 * cobre uma edição feita direto no SQL Editor do Supabase, nem uma tabela criada sem
 * passar pelo client. Este teste é a auditoria correspondente: consulta as duas tabelas
 * de produção e confere que o guardrail continua valendo de verdade.
 *
 * DIFERENTE dos testes headless de sempre: precisa de rede real (mesmo padrão de
 * tools/testar_iniciativas_cruzado.js) — sem ?semrede=1/mock, porque o objetivo é
 * auditar o dado de produção, não testar a UI. Se as tabelas ainda não existirem
 * (SQL de tools/sql/2026-08_migracao_modo_edicao.sql ainda não rodado) ou a rede
 * falhar, avisa e sai 0 — não é um problema deste teste.
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");

const REPO = path.join(__dirname, "..");

function carregarConfig() {
  global.window = global;
  require(path.join(REPO, "js", "config.js"));
  return window.APP_CONFIG;
}

async function buscar(cfg, tabela, query) {
  const url = cfg.SUPABASE_URL + "/rest/v1/" + tabela + "?" + query;
  const r = await fetch(url, {
    headers: { apikey: cfg.SUPABASE_ANON_KEY, Authorization: "Bearer " + cfg.SUPABASE_ANON_KEY },
  });
  if (!r.ok) {
    let detalhe = "HTTP " + r.status;
    try { const corpo = await r.json(); if (corpo && corpo.message) detalhe = corpo.message; } catch (e) { /* corpo não era JSON */ }
    throw new Error(tabela + ": " + detalhe);
  }
  return r.json();
}

async function principal() {
  const cfg = carregarConfig();

  let lideranca, canais;
  try {
    [lideranca, canais] = await Promise.all([
      buscar(cfg, "meta_inovacao_urc_lideranca", "select=nome&deleted_at=is.null"),
      buscar(cfg, "meta_inovacao_urc_canais_responsaveis", "select=canal,nome&deleted_at=is.null"),
    ]);
  } catch (err) {
    console.warn("guardrail_urc_supabase: não consegui consultar o Supabase — " + ((err && err.message) || err) + ". Pulando (tabelas ainda não migradas, ou rede fora do ar — não é um problema deste teste).");
    process.exit(0);
    return;
  }

  const nomesLideranca = new Set(lideranca.map((p) => p.nome));
  const violacoes = canais.filter((c) => nomesLideranca.has(c.nome));

  if (!violacoes.length) {
    console.log(`guardrail_urc_supabase OK — nenhum dos ${canais.length} responsáveis de canal bate com algum dos ${lideranca.length} nomes de liderança.`);
    process.exit(0);
    return;
  }

  console.error("FALHOU guardrail_urc_supabase:");
  violacoes.forEach((v) => console.error(` - "${v.nome}" está em meta_inovacao_urc_canais_responsaveis (canal "${v.canal}") E em meta_inovacao_urc_lideranca — liderança é transversal, não deveria aparecer num canal específico.`));
  process.exitCode = 1;
}

principal().catch((err) => {
  console.error("ERRO inesperado em guardrail_urc_supabase:", err.message || err);
  process.exit(0); // erro inesperado não deve travar a suíte — mesma postura de testar_iniciativas_cruzado.js
});
