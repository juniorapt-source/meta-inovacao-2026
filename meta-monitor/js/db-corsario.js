/* Camada de dados do conjunto CORSARIO (O Caminho para o Corsário) — window.DB_CORSARIO.
 *
 * Lê/escreve corsario_status (status por iniciativa×critério) no Supabase. Diferente dos
 * outros módulos db-*.js: NÃO tem fallback local (não existe um data/corsario.js — a
 * página corsario.html sempre leu direto do Supabase, sem seed no repo), então sem rede
 * não tem o que mostrar aqui — só um aviso, igual ao resto do editor quando a rede falha.
 *
 * corsario_criterios (a lista dos 19 critérios) é lida aqui também, mas continua
 * somente leitura — este módulo não escreve nela (ver tools/sql/2026-08_corsario_edicao.sql).
 */
(function (root) {
  "use strict";

  const TABELA_STATUS = "corsario_status";
  const TABELA_CRITERIOS = "corsario_criterios";

  function linhaParaStatus(r) {
    return {
      db_id: r.id,
      iniciativa: r.iniciativa,
      nucleo: r.nucleo,
      criterio: r.criterio,
      status: r.status,
      observacao: r.observacao,
      atualizado_em: r.atualizado_em,
    };
  }

  function forcarFallback() {
    if (root.CC_FORCAR_FALLBACK) return true;
    try { return new URLSearchParams(root.location.search).get("semrede") === "1"; } catch (e) { return false; }
  }

  async function buscarCriteriosDoSupabase() {
    if (!root.CC_SUPABASE) throw new Error("js/supabase.js não carregado.");
    const supa = await root.CC_SUPABASE.obterClienteEsm();
    const { data, error } = await supa.from(TABELA_CRITERIOS).select("*").order("ordem", { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function buscarStatusDoSupabase() {
    if (!root.CC_SUPABASE) throw new Error("js/supabase.js não carregado.");
    const supa = await root.CC_SUPABASE.obterClienteEsm();
    const { data, error } = await supa.from(TABELA_STATUS).select("*");
    if (error) throw error;
    return (data || []).map(linhaParaStatus);
  }

  let promessa = null;
  async function carregar(opts) {
    const forcar = (opts && opts.forcar) || forcarFallback();
    if (promessa && !(opts && opts.recarregar)) return promessa;
    promessa = (async () => {
      if (forcar) {
        // modo de teste (?semrede=1/CC_FORCAR_FALLBACK) — sem seed local pra este
        // conjunto (ver comentário no topo do arquivo); devolve vazio de propósito,
        // só pra nunca gravar de verdade durante os testes headless.
        return { criterios: [], statusRows: [], usandoFallback: true, motivoFallback: "modo de teste (semrede) — sem tentar rede" };
      }
      try {
        const [criterios, statusRows] = await Promise.all([buscarCriteriosDoSupabase(), buscarStatusDoSupabase()]);
        return { criterios: criterios, statusRows: statusRows, usandoFallback: false, motivoFallback: null };
      } catch (err) {
        console.error("db-corsario: falha ao carregar do Supabase", err);
        return { criterios: [], statusRows: [], usandoFallback: true, motivoFallback: (err && err.message) || String(err) };
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
    const patch = Object.assign({}, campos, { updated_by: usuario || null, atualizado_em: new Date().toISOString() });
    const { data, error } = await supa.from(TABELA_STATUS).update(patch).eq("id", id).select().single();
    if (error) throw error;
    return linhaParaStatus(data);
  }

  async function criar(linhaParcial, usuario) {
    bloquearEscritaEmTeste();
    const supa = await root.CC_SUPABASE.obterClienteEsm();
    const payload = {
      iniciativa: linhaParcial.iniciativa,
      nucleo: linhaParcial.nucleo || null,
      criterio: linhaParcial.criterio,
      status: linhaParcial.status,
      observacao: linhaParcial.observacao || null,
      updated_by: usuario || null,
      atualizado_em: new Date().toISOString(),
    };
    const { data, error } = await supa.from(TABELA_STATUS).insert(payload).select().single();
    if (error) throw error;
    return linhaParaStatus(data);
  }

  // cria uma iniciativa nova: 1 linha por critério informado, todas como "não se aplica"
  // (default honesto pra algo ainda não avaliado — ver corsario.html: todo "não se
  // aplica" fica fora da régua, então a iniciativa nasce "não avaliada", não "reprovada
  // em tudo") — usado pelo botão "+ Nova iniciativa" do editor.
  async function criarIniciativa(nome, nucleo, criterios, usuario) {
    bloquearEscritaEmTeste();
    const supa = await root.CC_SUPABASE.obterClienteEsm();
    const agora = new Date().toISOString();
    const payload = criterios.map((c) => ({
      iniciativa: nome, nucleo: nucleo || null, criterio: c.chave,
      status: "não se aplica", observacao: null, updated_by: usuario || null, atualizado_em: agora,
    }));
    const { data, error } = await supa.from(TABELA_STATUS).insert(payload).select();
    if (error) throw error;
    return (data || []).map(linhaParaStatus);
  }

  root.DB_CORSARIO = {
    TABELA_STATUS: TABELA_STATUS,
    TABELA_CRITERIOS: TABELA_CRITERIOS,
    carregar: carregar,
    salvar: salvar,
    criar: criar,
    criarIniciativa: criarIniciativa,
  };
})(this);
