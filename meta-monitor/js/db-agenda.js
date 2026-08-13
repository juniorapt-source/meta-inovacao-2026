/* Camada de dados do conjunto AGENDA (item 3.1 do plano de melhorias) — window.DB_AGENDA.
 *
 * Lê de meta_inovacao_agenda_encontros no Supabase; cai pra window.DB.agenda.encontros
 * (data/agenda.js, SEED + fallback) se a rede falhar. Mesmo mecanismo de ?semrede=1 /
 * window.CC_FORCAR_FALLBACK de js/db-plano.js — ver comentário lá.
 *
 * O "id" visível de sempre ("c1-foco", usado em âncoras — agenda.html, js/busca.js,
 * js/drawer.js) é recalculado aqui como "c"+ciclo+"-"+canal a partir das colunas
 * (ciclo, canal) — a tabela usa um bigint identity como chave interna (db_id), mas o
 * id de exibição continua idêntico ao de antes, sem precisar mudar link nenhum.
 *
 * "hora" sempre foi null em todo encontro até esta migração — fundida em "turno" no
 * banco (ver tools/sql/2026-08_agenda.sql); "local" e "modo" viraram um campo só
 * (localModo). Consumida por agenda.html e js/timeline.js.
 */
(function (root) {
  "use strict";

  const TABELA = "meta_inovacao_agenda_encontros";

  function idLegado(r) {
    return "c" + r.ciclo + "-" + r.canal + (r.sessao && r.sessao !== 1 ? "-s" + r.sessao : "");
  }

  function linhaParaEncontro(r) {
    return {
      id: idLegado(r),
      db_id: r.id,
      ciclo: "c" + r.ciclo,
      canal: r.canal,
      data: r.data_iso,
      hora: null,
      turno: r.turno || null,
      localModo: r.local_modo || null,
      confirmacoes: r.confirmacoes || null,
      status: r.status, // já é a chave canônica (encontro_agendado etc.) — CC_STATUS.chaveDeEntrada
                         // é idempotente pra chave que já é canônica (cai no próprio fallback,
                         // devolve sem alterar), então o resto do código não precisa saber disso
      nota: r.observacao || "",
      pautaResumo: r.pauta_resumo || "",
    };
  }

  function encontroParaLinha(e) {
    const ciclo = String(e.ciclo || "").replace(/^c/, "");
    return {
      ciclo: parseInt(ciclo, 10) || 1,
      canal: e.canal,
      sessao: 1,
      pauta_resumo: e.pautaResumo || null,
      data_iso: e.data || null,
      turno: e.turno || null,
      local_modo: e.localModo || null,
      confirmacoes: e.confirmacoes || null,
      status: e.status,
      observacao: e.nota || null,
    };
  }

  function forcarFallback() {
    if (root.CC_FORCAR_FALLBACK) return true;
    try { return new URLSearchParams(root.location.search).get("semrede") === "1"; } catch (e) { return false; }
  }

  async function buscarDoSupabase() {
    if (!root.CC_SUPABASE) throw new Error("js/supabase.js não carregado.");
    const supa = await root.CC_SUPABASE.obterClienteEsm();
    const { data, error } = await supa.from(TABELA).select("*").is("deleted_at", null)
      .order("ciclo", { ascending: true }).order("canal", { ascending: true });
    if (error) throw error;
    return (data || []).map(linhaParaEncontro);
  }

  function seedLocal() {
    return ((root.DB && root.DB.agenda && root.DB.agenda.encontros) || []).slice();
  }

  let promessa = null;
  async function carregar(opts) {
    const forcar = (opts && opts.forcar) || forcarFallback();
    if (promessa && !(opts && opts.recarregar)) return promessa;
    promessa = (async () => {
      if (forcar) {
        return { lista: seedLocal(), usandoFallback: true, motivoFallback: "modo de teste (semrede) — sem tentar rede" };
      }
      try {
        const lista = await buscarDoSupabase();
        return { lista: lista, usandoFallback: false, motivoFallback: null };
      } catch (err) {
        console.error("db-agenda: falha ao carregar do Supabase, caindo pro seed local (data/agenda.js)", err);
        return { lista: seedLocal(), usandoFallback: true, motivoFallback: (err && err.message) || String(err) };
      }
    })();
    return promessa;
  }

  // Trava de segurança (item 3.3, replicada aqui de js/db-plano.js): bloqueia escrita em
  // modo de teste (?semrede=1 / CC_FORCAR_FALLBACK) pra nenhum teste headless gravar de
  // verdade no Supabase de produção.
  function bloquearEscritaEmTeste() {
    if (forcarFallback()) throw new Error("modo de teste (semrede) — escrita bloqueada de propósito, pra nunca gravar de verdade durante testes automatizados.");
  }

  async function salvar(dbId, campos, usuario) {
    bloquearEscritaEmTeste();
    const supa = await root.CC_SUPABASE.obterClienteEsm();
    const patch = Object.assign({}, campos, { updated_by: usuario || null });
    const { data, error } = await supa.from(TABELA).update(patch).eq("id", dbId).select().single();
    if (error) throw error;
    return linhaParaEncontro(data);
  }

  async function removerSoft(dbId, usuario) {
    bloquearEscritaEmTeste();
    const supa = await root.CC_SUPABASE.obterClienteEsm();
    const agora = new Date().toISOString();
    const { error } = await supa.from(TABELA).update({ deleted_at: agora, updated_by: usuario || null }).eq("id", dbId);
    if (error) throw error;
  }

  root.DB_AGENDA = {
    TABELA: TABELA,
    carregar: carregar,
    salvar: salvar,
    removerSoft: removerSoft,
    encontroParaLinha: encontroParaLinha,
  };
})(this);
