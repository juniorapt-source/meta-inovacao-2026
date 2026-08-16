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
 * Semântica de saída combinada com o pedido explícito de quem mandou este teste:
 *   - Sem divergência (28 virou 27, ou vice-versa e os nomes batem 1:1): sai 0, silencioso.
 *   - COM divergência: sai 0 (warning, não falha a suíte) e imprime destacado a
 *     iniciativa sobrando e a fonte. NÃO corrigir o dado agora — quando alguém corrigir
 *     manualmente (rename/merge no Supabase ou adicionar no portfólio local), promover
 *     este teste pra exit 1 (mudar a linha `process.exit(0)` pra `process.exit(1)` no
 *     bloco de divergência), virando um guard real contra a divergência VOLTAR.
 *
 * DECISÃO (Aug/2026, governança do golden record — docs/GOVERNANCA_GOLDEN_RECORD.md):
 * a divergência foi resolvida em favor do golden record (meta_inovacao_projetos, 27).
 * "Salas do Empreendedor" SAI do projeto — nunca esteve no portfólio canônico. A remoção
 * das linhas em corsario_status está em tools/sql/2026-08_remover_salas_empreendedor.sql
 * (rodar no SQL editor do Supabase; é write, feito à mão). Enquanto esse SQL não roda,
 * corsario_status ainda tem 28 e este teste AVISA (exit 0). DEPOIS que rodar (28→27),
 * promover o guard pra exit 1 (trocar `process.exit(0)` pra `process.exit(1)` no bloco de
 * divergência) pra travar a suíte se a divergência VOLTAR.
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

  console.warn("");
  console.warn("⚠ DIVERGÊNCIA DETECTADA entre fontes de iniciativas (não corrigida — teste em modo aviso, exit 0)");
  console.warn("  data/projetos.js (portfólio local): " + locais.length + " iniciativas");
  console.warn("  Supabase corsario_status (fonte do Corsário): " + remotas.length + " iniciativas");
  if (soNoRemoto.length) {
    console.warn("  Só no Supabase (corsario_status), ausente do portfólio local: " + soNoRemoto.map((n) => '"' + n + '"').join(", "));
  }
  if (soNoLocal.length) {
    console.warn("  Só no portfólio local, ausente do Supabase: " + soNoLocal.map((n) => '"' + n + '"').join(", "));
  }
  console.warn("  Hipótese registrada: é iniciativa real do portfólio da UI (consta no diagnóstico),");
  console.warn("  ausente dos dados locais — não é rename/merge, o Corsário está mais completo aqui.");
  console.warn("  Correção futura provável: incluir no portfólio local (27→28) — decisão pendente com o JR.");
  console.warn("  Quando corrigido, promover este teste pra exit 1 (ver comentário no topo do arquivo).");
  console.warn("");
  process.exit(0);
}

principal().catch((err) => {
  console.error("ERRO inesperado em iniciativas_cruzado:", err.message || err);
  process.exit(0); // mesmo um erro inesperado não deve travar a suíte — este teste é só um aviso
});
