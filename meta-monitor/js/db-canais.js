/* Camada de dados do catálogo CANAIS (golden record de cadastros de referência,
 * Camada 0, item 0.5) — window.DB_CANAIS.
 *
 * Lê de meta_inovacao_canais no Supabase; cai pra window.DB.canais (data/canais.js,
 * SEED + fallback) se a rede falhar. Mesmo mecanismo de sempre — ver js/db-projetos.js.
 *
 * Formato canônico devolvido por carregar() (bate com as colunas da tabela nova, não
 * com o formato antigo de data/canais.js — ver seedLocal()):
 *   { slug, nome, nome_completo, formato, pauta, ordem, ativo, db_id }
 */
(function (root) {
  "use strict";

  const TABELA = "meta_inovacao_canais";

  function linhaParaCanal(r) {
    return {
      slug: r.slug,
      nome: r.nome,
      nome_completo: r.nome_completo,
      formato: r.formato,
      pauta: r.pauta || [],
      ordem: r.ordem,
      ativo: r.ativo,
      db_id: r.id,
    };
  }

  function canalParaLinha(c) {
    return {
      slug: c.slug,
      nome: c.nome,
      nome_completo: c.nome_completo,
      formato: c.formato,
      pauta: c.pauta || [],
      ordem: c.ordem,
      ativo: c.ativo,
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
    return (data || []).map(linhaParaCanal);
  }

  // data/canais.js usa o formato antigo (id/completo, sem ordem/ativo) — traduzido
  // aqui pro formato canônico da tabela nova, pra quem consome carregar() nunca
  // precisar saber qual das duas fontes respondeu.
  function seedLocal() {
    const brutos = (root.DB && root.DB.canais) || [];
    return brutos.map((c, i) => ({
      slug: c.id,
      nome: c.nome,
      nome_completo: c.completo,
      formato: c.formato,
      pauta: c.pauta || [],
      ordem: i + 1,
      ativo: true,
      db_id: null,
    }));
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
        console.error("db-canais: falha ao carregar do Supabase, caindo pro seed local (data/canais.js)", err);
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
    return linhaParaCanal(data);
  }

  async function criar(canalParcial, usuario) {
    bloquearEscritaEmTeste();
    const supa = await root.CC_SUPABASE.obterClienteEsm();
    const payload = Object.assign({}, canalParaLinha(canalParcial), { updated_by: usuario || null });
    const { data, error } = await supa.from(TABELA).insert(payload).select().single();
    if (error) throw error;
    return linhaParaCanal(data);
  }

  async function removerSoft(id, usuario) {
    bloquearEscritaEmTeste();
    const supa = await root.CC_SUPABASE.obterClienteEsm();
    const agora = new Date().toISOString();
    const { error } = await supa.from(TABELA).update({ deleted_at: agora, updated_by: usuario || null }).eq("id", id);
    if (error) throw error;
  }

  root.DB_CANAIS = {
    TABELA: TABELA,
    carregar: carregar,
    salvar: salvar,
    criar: criar,
    removerSoft: removerSoft,
    canalParaLinha: canalParaLinha,
  };
})(this);
