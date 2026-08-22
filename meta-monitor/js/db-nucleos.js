/* Camada de dados do catálogo NÚCLEOS (golden record de cadastros de referência,
 * Camada 0, item 0.5) — window.DB_NUCLEOS.
 *
 * Lê de meta_inovacao_nucleos no Supabase; cai pra window.DB.nucleos (data/nucleos.js,
 * SEED + fallback) se a rede falhar. Mesmo mecanismo de sempre — ver js/db-projetos.js.
 */
(function (root) {
  "use strict";

  const TABELA = "meta_inovacao_nucleos";

  function linhaParaNucleo(r) {
    return {
      nome: r.nome,
      ordem: r.ordem,
      db_id: r.id,
    };
  }

  function nucleoParaLinha(n) {
    return {
      nome: n.nome,
      ordem: n.ordem,
    };
  }

  function forcarFallback() {
    if (root.CC_FORCAR_FALLBACK) return true;
    try { return new URLSearchParams(root.location.search).get("semrede") === "1"; } catch (e) { return false; }
  }

  async function buscarDoSupabase() {
    if (!root.CC_SUPABASE) throw new Error("js/supabase.js não carregado.");
    const supa = await root.CC_SUPABASE.obterClienteEsm();
    const { data, error } = await supa.from(TABELA).select("*").is("deleted_at", null).order("ordem", { ascending: true });
    if (error) throw error;
    return (data || []).map(linhaParaNucleo);
  }

  function seedLocal() {
    return ((root.DB && root.DB.nucleos) || []).slice();
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
        console.error("db-nucleos: falha ao carregar do Supabase, caindo pro seed local (data/nucleos.js)", err);
        return { lista: seedLocal(), usandoFallback: true, motivoFallback: (err && err.message) || String(err) };
      }
    })();
    return promessa;
  }

  function bloquearEscritaEmTeste() {
    if (forcarFallback()) throw new Error("modo de teste (semrede) — escrita bloqueada de propósito, pra nunca gravar de verdade durante testes automatizados.");
  }

  async function salvar(id, campos, usuario) {
    bloquearEscritaEmTeste();
    const supa = await root.CC_SUPABASE.obterClienteEsm();
    const patch = Object.assign({}, campos, { updated_by: usuario || null });
    const { data, error } = await supa.from(TABELA).update(patch).eq("id", id).select().single();
    if (error) throw error;
    return linhaParaNucleo(data);
  }

  async function criar(nucleoParcial, usuario) {
    bloquearEscritaEmTeste();
    const supa = await root.CC_SUPABASE.obterClienteEsm();
    const payload = Object.assign({}, nucleoParaLinha(nucleoParcial), { updated_by: usuario || null });
    const { data, error } = await supa.from(TABELA).insert(payload).select().single();
    if (error) throw error;
    return linhaParaNucleo(data);
  }

  async function removerSoft(id, usuario) {
    bloquearEscritaEmTeste();
    const supa = await root.CC_SUPABASE.obterClienteEsm();
    const agora = new Date().toISOString();
    const { error } = await supa.from(TABELA).update({ deleted_at: agora, updated_by: usuario || null }).eq("id", id);
    if (error) throw error;
  }

  root.DB_NUCLEOS = {
    TABELA: TABELA,
    carregar: carregar,
    salvar: salvar,
    criar: criar,
    removerSoft: removerSoft,
    nucleoParaLinha: nucleoParaLinha,
  };
})(this);
