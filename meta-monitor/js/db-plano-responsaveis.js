/* Camada de dados da junção AÇÃO DO PLANO × (PESSOA OU COLETIVO) (golden record de
 * cadastros de referência, Camada 2, item 2.6 —
 * tools/sql/2026-08_plano_responsaveis.sql) — window.DB_PLANO_RESPONSAVEIS.
 *
 * Uma ação pode ter mais de um responsável (`responsavel_id` já é `text[]` desde o P4).
 * `ordem` é a posição em `responsavel_id[]` — mesmo papel de `ordem` em
 * js/db-projeto-representantes.js/js/db-pessoa-papeis.js, junções irmãs que seguem o
 * mesmo padrão (sem seed local pra esta tabela — nasceu na Camada 2, não tem
 * equivalente em data/*.js).
 *
 * pessoa_id XOR coletivo_id (nunca os dois, nunca nenhum) — mesmo CHECK do banco
 * (`cc_plano_resp_exatamente_um`); quem decide qual é a tradução de cada id de
 * `responsavel_id[]` é js/db-responsaveis.js (item 4.3), não este módulo.
 */
(function (root) {
  "use strict";

  const TABELA = "meta_inovacao_plano_responsaveis";

  function linhaParaVinculo(r) {
    return {
      plano_acao_id: r.plano_acao_id,
      pessoa_id: r.pessoa_id || null,
      coletivo_id: r.coletivo_id || null,
      ordem: r.ordem || null,
      db_id: r.id,
    };
  }

  function vinculoParaLinha(v) {
    return {
      plano_acao_id: v.plano_acao_id,
      pessoa_id: v.pessoa_id || null,
      coletivo_id: v.coletivo_id || null,
      ordem: v.ordem || null,
    };
  }

  function forcarFallback() {
    if (root.CC_FORCAR_FALLBACK) return true;
    try { return new URLSearchParams(root.location.search).get("semrede") === "1"; } catch (e) { return false; }
  }

  async function buscarDoSupabase() {
    if (!root.CC_SUPABASE) throw new Error("js/supabase.js não carregado.");
    const supa = await root.CC_SUPABASE.obterClienteEsm();
    const { data, error } = await supa.from(TABELA).select("*").is("deleted_at", null);
    if (error) throw error;
    return (data || []).map(linhaParaVinculo);
  }

  let promessa = null;
  async function carregar(opts) {
    const forcar = (opts && opts.forcar) || forcarFallback();
    if (promessa && !(opts && opts.recarregar)) return promessa;
    promessa = (async () => {
      if (forcar) {
        return { lista: [], usandoFallback: true, motivoFallback: "modo de teste (semrede) — sem tentar rede" };
      }
      try {
        const lista = await buscarDoSupabase();
        return { lista: lista, usandoFallback: false, motivoFallback: null };
      } catch (err) {
        console.error("db-plano-responsaveis: falha ao carregar do Supabase, sem seed local pra esta tabela", err);
        return { lista: [], usandoFallback: true, motivoFallback: (err && err.message) || String(err) };
      }
    })();
    return promessa;
  }

  // agrupa a lista achatada por plano_acao_id, ordenada por `ordem` — mesma conveniência
  // de DB_PROJETO_REPRESENTANTES.porProjeto()/DB_PESSOA_PAPEIS.porPessoa().
  function porPlanoAcao(lista) {
    const idx = {};
    (lista || []).forEach((v) => {
      if (!idx[v.plano_acao_id]) idx[v.plano_acao_id] = [];
      idx[v.plano_acao_id].push(v);
    });
    Object.keys(idx).forEach((k) => idx[k].sort((a, b) => (a.ordem || 0) - (b.ordem || 0)));
    return idx;
  }

  function bloquearEscritaEmTeste() {
    if (forcarFallback()) throw new Error("modo de teste (semrede) — escrita bloqueada de propósito, pra nunca gravar de verdade durante testes automatizados.");
  }

  async function criar(vinculoParcial, usuario) {
    bloquearEscritaEmTeste();
    const supa = await root.CC_SUPABASE.obterClienteEsm();
    const payload = Object.assign({}, vinculoParaLinha(vinculoParcial), { updated_by: usuario || null });
    const { data, error } = await supa.from(TABELA).insert(payload).select().single();
    if (error) throw error;
    return linhaParaVinculo(data);
  }

  async function removerSoft(id, usuario) {
    bloquearEscritaEmTeste();
    const supa = await root.CC_SUPABASE.obterClienteEsm();
    const agora = new Date().toISOString();
    const { error } = await supa.from(TABELA).update({ deleted_at: agora, updated_by: usuario || null }).eq("id", id);
    if (error) throw error;
  }

  root.DB_PLANO_RESPONSAVEIS = {
    TABELA: TABELA,
    carregar: carregar,
    criar: criar,
    removerSoft: removerSoft,
    porPlanoAcao: porPlanoAcao,
    vinculoParaLinha: vinculoParaLinha,
  };
})(this);
