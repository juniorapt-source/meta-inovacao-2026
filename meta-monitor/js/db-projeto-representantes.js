/* Camada de dados da junção PROJETO × PESSOA (golden record de cadastros de
 * referência, Camada 2, item 2.2 — tools/sql/2026-08_projeto_representantes.sql) —
 * window.DB_PROJETO_REPRESENTANTES.
 *
 * Um projeto pode ter mais de um representante (ex.: "Catalisa Gov" tem Dario e
 * Rafa — 2 linhas aqui, 1 projeto em meta_inovacao_projetos). `ordem` é a posição
 * original em `meta_inovacao_projetos.representantes` (text[]), preservada pela
 * migração; novos vínculos criados por editor.html (Camada 4, item 4.1) recebem o
 * próximo número da sequência.
 *
 * Mesmo mecanismo de sempre (?semrede=1/CC_FORCAR_FALLBACK, sem fallback local
 * pra arquivo próprio — esta tabela nasceu na Camada 2, não tem equivalente em
 * data/*.js) — ver comentário de js/db-pessoa-papeis.js, que segue o mesmo padrão
 * pra uma junção irmã.
 */
(function (root) {
  "use strict";

  const TABELA = "meta_inovacao_projeto_representantes";

  function linhaParaVinculo(r) {
    return {
      projeto_id: r.projeto_id,
      pessoa_id: r.pessoa_id,
      ordem: r.ordem || null,
      db_id: r.id,
    };
  }

  function vinculoParaLinha(v) {
    return {
      projeto_id: v.projeto_id,
      pessoa_id: v.pessoa_id,
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
        console.error("db-projeto-representantes: falha ao carregar do Supabase, sem seed local pra esta tabela", err);
        return { lista: [], usandoFallback: true, motivoFallback: (err && err.message) || String(err) };
      }
    })();
    return promessa;
  }

  // agrupa a lista achatada por projeto_id, ordenada por `ordem` — conveniência
  // pra tela que mostra "representantes deste projeto" sem cada consumidor
  // reimplementar o group-by (mesmo papel de DB_PESSOA_PAPEIS.porPessoa).
  function porProjeto(lista) {
    const idx = {};
    (lista || []).forEach((v) => {
      if (!idx[v.projeto_id]) idx[v.projeto_id] = [];
      idx[v.projeto_id].push(v);
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

  root.DB_PROJETO_REPRESENTANTES = {
    TABELA: TABELA,
    carregar: carregar,
    criar: criar,
    removerSoft: removerSoft,
    porProjeto: porProjeto,
    vinculoParaLinha: vinculoParaLinha,
  };
})(this);
