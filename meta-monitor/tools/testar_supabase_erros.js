/* Teste da classificação de erros de escrita de js/supabase.js (CC_SUPABASE).
   Garante que os sintomas que caíam no "falhou" cru do editor.html — bloqueio de RLS por
   token (UPDATE que afeta 0 linhas → PGRST116) e cache de schema desatualizado (PGRST204)
   — viram mensagem acionável, e que o detalhe técnico continua disponível pro tooltip. */
const path = require("path");
const CC = require(path.join(__dirname, "..", "js", "supabase.js"));

let erros = 0;
function checa(nome, cond) {
  if (cond) { console.log("  ok:", nome); }
  else { console.error("  FALHA:", nome); erros++; }
}

// --- PGRST116: UPDATE/DELETE que não afetou nenhuma linha (RLS filtrou por token) ---
const semLinha = { code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned", details: "Results contain 0 rows" };
checa("PGRST116 é tratado como bloqueio de escrita", CC.ehZeroLinhasEmEscrita(semLinha));
checa("PGRST116 vira MENSAGEM_SEM_PERMISSAO", CC.mensagemEscritaAmigavel(semLinha) === CC.MENSAGEM_SEM_PERMISSAO);

// --- PGRST204/205: cache de schema do PostgREST desatualizado após ALTER TABLE ---
const cacheCol = { code: "PGRST204", message: "Could not find the 'updated_by' column of 'meta_inovacao_plano_acoes' in the schema cache" };
const cacheTab = { code: "PGRST205", message: "Could not find the table in the schema cache" };
const cacheMsg = { message: "something about schema cache being stale" };
checa("PGRST204 é erro de cache de schema", CC.ehErroDeCacheSchema(cacheCol));
checa("PGRST205 é erro de cache de schema", CC.ehErroDeCacheSchema(cacheTab));
checa("mensagem com 'schema cache' é reconhecida", CC.ehErroDeCacheSchema(cacheMsg));
checa("PGRST204 vira MENSAGEM_SCHEMA", CC.mensagemEscritaAmigavel(cacheCol) === CC.MENSAGEM_SCHEMA);
checa("cache de schema não é confundido com permissão", !CC.ehErroDePermissao(cacheCol));

// --- permissão clássica continua reconhecida ---
checa("42501 é permissão", CC.ehErroDePermissao({ code: "42501", message: "permission denied" }));
checa("row-level security é permissão", CC.ehErroDePermissao({ message: "new row violates row-level security policy" }));
checa("status 403 é permissão", CC.ehErroDePermissao({ status: 403 }));
checa("erro embrulhado (originalError.code) é lido", CC.ehErroDePermissao({ originalError: { code: "42501" } }));

// --- erro desconhecido (rede etc.) continua sem mensagem pronta, mas com detalhe ---
const rede = { message: "Failed to fetch" };
checa("erro de rede não vira mensagem pronta", CC.mensagemEscritaAmigavel(rede) === null);
checa("detalheErro traz código + mensagem", CC.detalheErro(cacheCol).indexOf("PGRST204:") === 0);
checa("detalheErro sem código traz só a mensagem", CC.detalheErro(rede) === "Failed to fetch");
checa("detalheErro tolera null", CC.detalheErro(null) === "");

if (erros) { console.error("testar_supabase_erros: " + erros + " erro(s)"); process.exit(1); }
console.log("testar_supabase_erros OK: classificação de erros de escrita íntegra");
