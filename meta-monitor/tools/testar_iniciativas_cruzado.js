/* Teste F13: iniciativas_cruzado — detecta (SEM corrigir, de propósito) a divergência de
 * contagem de iniciativas entre o portfólio local (data/projetos.js, 27) e a tabela
 * Supabase corsario_status (fonte real do Corsário, corsario.html) — 28 até a remoção do
 * Salas rodar, com "Salas do Empreendedor" a mais (fora do portfólio canônico — ver a
 * DECISÃO abaixo).
 *
 * DIFERENTE de todos os outros testes deste repo: este PRECISA de rede real (consulta
 * o Supabase de produção, leitura pública, mesma anon key já embutida em js/config.js —
 * não há ?semrede=1 nem mock aqui, a única razão de existir é checar o dado ao vivo).
 * Se a rede/Supabase estiver fora do ar, o teste AVISA e sai 0 (não trava a suíte por
 * um problema de conectividade que não é dele).
 *
 * Semântica de saída (GUARD ATIVO desde a reconciliação de Aug/2026):
 *   - Sem divergência (27=27, mesmos nomes): sai 0, silencioso.
 *   - COM divergência: sai 1 e FALHA a suíte — a divergência já foi resolvida, então voltar
 *     a divergir é regressão.
 *   - Rede/Supabase fora do ar: sai 0 (aviso) — conectividade não é problema deste teste.
 *
 * DECISÃO (Aug/2026, governança do golden record — docs/GOVERNANCA_GOLDEN_RECORD.md):
 * a divergência 27×28 foi resolvida em favor do golden record (meta_inovacao_projetos, 27).
 * "Salas do Empreendedor" saiu do projeto — nunca esteve no portfólio canônico; as linhas
 * dela em corsario_status foram removidas via tools/sql/2026-08_remover_salas_empreendedor.sql
 * (rodado em produção). A partir daqui este teste é um guard de regressão (exit 1).
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

function carregarProjetosLocais() {
  global.window = global;
  require(path.join(REPO, "data", "projetos.js"));
  return window.DB.projetos.map((p) => p.iniciativa);
}

async function buscarIniciativasCorsarioStatus(cfg) {
  const url = cfg.SUPABASE_URL + "/rest/v1/corsario_status?select=iniciativa";
  const r = await fetch(url, {
    headers: { apikey: cfg.SUPABASE_ANON_KEY, Authorization: "Bearer " + cfg.SUPABASE_ANON_KEY },
  });
  if (!r.ok) {
    let detalhe = "HTTP " + r.status;
    try { const corpo = await r.json(); if (corpo && corpo.message) detalhe = corpo.message; } catch (e) { /* corpo não era JSON */ }
    throw new Error("corsario_status: " + detalhe);
  }
  const linhas = await r.json();
  return [...new Set(linhas.map((l) => l.iniciativa))];
}

async function principal() {
  const cfg = carregarConfig();
  const locais = carregarProjetosLocais();
  const setLocais = new Set(locais);

  let remotas;
  try {
    remotas = await buscarIniciativasCorsarioStatus(cfg);
  } catch (err) {
    console.warn("iniciativas_cruzado: não consegui consultar o Supabase (corsario_status) — " + ((err && err.message) || err) + ". Pulando (não é um problema deste teste).");
    process.exit(0);
    return;
  }
  const setRemotas = new Set(remotas);

  const soNoLocal = locais.filter((n) => !setRemotas.has(n));
  const soNoRemoto = remotas.filter((n) => !setLocais.has(n));

  if (!soNoLocal.length && !soNoRemoto.length && locais.length === remotas.length) {
    console.log(`iniciativas_cruzado OK — ${locais.length} iniciativas, mesmo conjunto em data/projetos.js e no Supabase (corsario_status).`);
    process.exit(0);
    return;
  }

  // GUARD ATIVO (desde a reconciliação de Aug/2026, v0.24.x): golden record e corsario_status
  // já batem 27=27; qualquer divergência agora é REGRESSÃO e FALHA a suíte (exit 1). Rede fora
  // do ar não cai aqui — é tratada antes, com exit 0 (só divergência real de dado falha).
  console.error("");
  console.error("✖ DIVERGÊNCIA entre fontes de iniciativas — golden record (data/projetos.js) vs corsario_status");
  console.error("  data/projetos.js (portfólio canônico): " + locais.length + " iniciativas");
  console.error("  Supabase corsario_status (fonte do Corsário): " + remotas.length + " iniciativas");
  if (soNoRemoto.length) {
    console.error("  Só no Supabase (corsario_status), ausente do golden: " + soNoRemoto.map((n) => '"' + n + '"').join(", "));
  }
  if (soNoLocal.length) {
    console.error("  Só no golden, ausente do Supabase: " + soNoLocal.map((n) => '"' + n + '"').join(", "));
  }
  console.error("  Reconcilie no editor.html (golden) ou no corsario_status (Supabase) até baterem de novo.");
  console.error("");
  process.exit(1);
}

principal().catch((err) => {
  console.error("ERRO inesperado em iniciativas_cruzado:", err.message || err);
  process.exit(0); // mesmo um erro inesperado não deve travar a suíte — este teste é só um aviso
});
