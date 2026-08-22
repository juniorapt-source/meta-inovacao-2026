/* Camada de dados da junção PESSOA × PAPEL (golden record de pessoas, Camada 1,
 * tools/sql/2026-08_pessoas_golden.sql) — window.DB_PESSOA_PAPEIS.
 *
 * Uma pessoa pode acumular mais de um papel (ex.: Sandra Chaves Silva Paraíso é
 * assistente do plano NA UI, membro do Comitê E representante do núcleo Gestão do
 * Conhecimento e Processos — 3 linhas aqui, 1 pessoa em meta_inovacao_pessoas).
 * `contexto` é sempre 'UI' | 'Comite' | 'Nucleo'; `nucleo_id` só é preenchido quando
 * contexto='Nucleo' (constraint no banco já garante isso).
 *
 * Sem fallback local pra arquivo próprio: esta tabela nasceu só na Camada 1, não tem
 * equivalente em data/*.js — se a rede falhar, carregar() devolve lista vazia (não
 * quebra, mas telas que dependem disso pra exibir papéis mostram "sem dados" nesse
 * cenário). Mesmo mecanismo de ?semrede=1/CC_FORCAR_FALLBACK dos outros módulos.
 */
(function (root) {
  "use strict";

  const TABELA = "meta_inovacao_pessoa_papeis";

  function linhaParaPapel(r) {
    return {
      pessoa_id: r.pessoa_id,
      contexto: r.contexto,
      nucleo_id: r.nucleo_id || null,
      papel: r.papel || null,
      db_id: r.id,
    };
  }

  function papelParaLinha(p) {
    return {
      pessoa_id: p.pessoa_id,
      contexto: p.contexto,
      nucleo_id: p.nucleo_id || null,
      papel: p.papel || null,
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
    return (data || []).map(linhaParaPapel);
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
        console.error("db-pessoa-papeis: falha ao carregar do Supabase, sem seed local pra esta tabela", err);
        return { lista: [], usandoFallback: true, motivoFallback: (err && err.message) || String(err) };
      }
    })();
    return promessa;
  }

  // agrupa a lista achatada por pessoa_id — conveniência pra tela que mostra
  // "papéis desta pessoa" sem cada consumidor reimplementar o group-by.
  function porPessoa(lista) {
    const idx = {};
    (lista || []).forEach((p) => {
      if (!idx[p.pessoa_id]) idx[p.pessoa_id] = [];
      idx[p.pessoa_id].push(p);
    });
    return idx;
  }

  function bloquearEscritaEmTeste() {
    if (forcarFallback()) throw new Error("modo de teste (semrede) — escrita bloqueada de propósito, pra nunca gravar de verdade durante testes automatizados.");
  }

  async function criar(papelParcial, usuario) {
    bloquearEscritaEmTeste();
    const supa = await root.CC_SUPABASE.obterClienteEsm();
    const payload = Object.assign({}, papelParaLinha(papelParcial), { updated_by: usuario || null });
    const { data, error } = await supa.from(TABELA).insert(payload).select().single();
    if (error) throw error;
    return linhaParaPapel(data);
  }

  async function removerSoft(id, usuario) {
    bloquearEscritaEmTeste();
    const supa = await root.CC_SUPABASE.obterClienteEsm();
    const agora = new Date().toISOString();
    const { error } = await supa.from(TABELA).update({ deleted_at: agora, updated_by: usuario || null }).eq("id", id);
    if (error) throw error;
  }

  root.DB_PESSOA_PAPEIS = {
    TABELA: TABELA,
    carregar: carregar,
    criar: criar,
    removerSoft: removerSoft,
    porPessoa: porPessoa,
    papelParaLinha: papelParaLinha,
  };
})(this);
