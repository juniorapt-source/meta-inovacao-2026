/* Gera os blocos de INSERT (seed) pros scripts SQL de tools/sql/2026-08_plano.sql e
 * tools/sql/2026-08_agenda.sql, a partir dos dados atuais de data/plano.js e
 * data/agenda.js (+ data/canais.js pra pauta_resumo). Não escreve nada sozinho — só
 * imprime os dois blocos no stdout, pra colar dentro dos arquivos .sql (mantém o SQL
 * revisável por humano em vez de 100% gerado às cegas). Reroda quando os dados de
 * origem mudarem antes da migração de verdade acontecer.
 *
 * Uso: node tools/gerar_seed_supabase.js
 */
"use strict";
global.window = global;
require("../data/plano.js");
require("../data/agenda.js");
require("../data/canais.js");
const CC_STATUS = require("../js/status.js");

function sqlStr(v) {
  if (v == null) return "NULL";
  return "'" + String(v).replace(/'/g, "''") + "'";
}
function sqlArr(arr) {
  if (!arr || !arr.length) return "'{}'";
  return "ARRAY[" + arr.map((v) => sqlStr(v)).join(",") + "]::text[]";
}
function sqlInt(v) {
  return v == null ? "NULL" : String(v);
}
function sqlDate(v) {
  return v == null ? "NULL" : sqlStr(v);
}

// ---- PLANO ----
const planoRows = window.DB.plano.map((a, i) => {
  const status = CC_STATUS.chaveDeEntrada("acao", a.status); // "Não iniciado" -> nao_iniciado etc.
  return "  (" + [
    sqlStr(a.id), sqlStr(a.frente), sqlStr(a.sub), sqlStr(a.atividade),
    sqlStr(a.resp), sqlArr(a.responsavel_id),
    sqlDate(a.prazo_iso), sqlStr(a.prazo),
    sqlStr(status), sqlArr(a.dep),
    sqlStr(a.cc && a.cc.tipo), sqlInt(a.cc && a.cc.no),
    sqlStr(a.como), sqlStr(a.monitor), sqlStr(a.ferramenta),
    sqlInt(i + 1),
  ].join(", ") + ")";
});
console.log("-- ===== SEED: meta_inovacao_plano_acoes (" + planoRows.length + " linhas) =====");
console.log("INSERT INTO public.meta_inovacao_plano_acoes");
console.log("  (id, frente, subfrente, atividade, responsavel, responsavel_id, prazo_iso, prazo_texto, status, dependencias, cc_tipo, no_critico, como, monitor, ferramenta, ordem)");
console.log("VALUES");
console.log(planoRows.join(",\n") + ";");
console.log();

// ---- AGENDA ----
const porCanal = Object.fromEntries(window.DB.canais.map((c) => [c.id, c]));
function pautaResumo(canalId) {
  const c = porCanal[canalId];
  if (!c || !c.pauta || !c.pauta.length) return "";
  const resumo = c.pauta.slice(0, 2).join(" · ");
  return c.pauta.length > 2 ? resumo + " · +" + (c.pauta.length - 2) : resumo;
}
function localModo(e) {
  if (e.local && e.modo) return e.local + " · " + e.modo;
  return e.local || e.modo || "";
}
function confirmacoesTexto(e) {
  return e.convidados ? e.confirmados + "/" + e.convidados : "";
}
function turnoCombinado(e) {
  // hora nunca esteve preenchida em nenhum encontro até hoje (conferido nos dados) — funde
  // com turno num único campo livre pra não abrir uma coluna nova só pra um campo sempre
  // vazio; se um dia precisar de hora, "turno" aceita texto livre tipo "tarde · 14h"
  if (e.turno && e.hora) return e.turno + " · " + e.hora;
  return e.turno || e.hora || "";
}
const agendaRows = window.DB.agenda.encontros.map((e) => {
  const ciclo = e.ciclo === "c2" ? 2 : 1;
  const status = CC_STATUS.chaveDeEntrada("encontro", e.status); // "agendado" -> encontro_agendado etc.
  return "  (" + [
    sqlInt(ciclo), sqlStr(e.canal), sqlInt(1),
    sqlStr(pautaResumo(e.canal)), sqlDate(e.data), sqlStr(turnoCombinado(e)),
    sqlStr(localModo(e)), sqlStr(confirmacoesTexto(e)),
    sqlStr(status), sqlStr(e.nota),
  ].join(", ") + ")";
});
console.log("-- ===== SEED: meta_inovacao_agenda_encontros (" + agendaRows.length + " linhas) =====");
console.log("INSERT INTO public.meta_inovacao_agenda_encontros");
console.log("  (ciclo, canal, sessao, pauta_resumo, data_iso, turno, local_modo, confirmacoes, status, observacao)");
console.log("VALUES");
console.log(agendaRows.join(",\n") + ";");
