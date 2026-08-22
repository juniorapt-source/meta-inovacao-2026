/* Camada de dados do conjunto PESSOAS ("Correções v0.18.x", migração do restante do
 * Modo edição pro Supabase) — window.DB_PESSOAS.
 *
 * Lê de meta_inovacao_pessoas no Supabase; cai pra window.DB.pessoas (data/pessoas.js,
 * SEED + fallback) se a rede falhar. Mesmo mecanismo de ?semrede=1/CC_FORCAR_FALLBACK e
 * a mesma trava de escrita em modo de teste de js/db-plano.js — ver comentários lá.
 *
 * NÃO confundir com window.DB.responsaveis (lista canônica do P4, usada por
 * plano-acao.html/minhas-acoes.html) — são dados diferentes, este módulo só cobre
 * window.DB.pessoas (nome/papel/grupo/nucleo/pendente + nome_completo/nome_exibicao/
 * email/ativo, golden record de pessoas — Camada 1, tools/sql/2026-08_pessoas_golden.sql
 * — editado em editor.html e exibido em participantes.html).
 *
 * nome/papel/grupo/nucleo/pendente/ordem são os campos ORIGINAIS (P·Correções v0.18.x) —
 * continuam existindo e sendo lidos por participantes.html sem mudança nenhuma.
 * nome_completo/nome_exibicao/email/ativo são as colunas novas da Camada 1: identidade
 * única por pessoa física, preenchida a partir do dedupe confirmado (ver
 * meta-monitor/docs/CAMADA1_DEDUPE_PESSOAS.md) — convivem com as antigas até a Camada 5
 * decidir aposentar o texto livre duplicado por grupo.
 */
(function (root) {
  "use strict";

  const TABELA = "meta_inovacao_pessoas";

  function linhaParaPessoa(r) {
    return {
      nome: r.nome,
      papel: r.papel || null,
      grupo: r.grupo,
      nucleo: r.nucleo || null,
      pendente: !!r.pendente,
      ordem: r.ordem,
      nome_completo: r.nome_completo || null,
      nome_exibicao: r.nome_exibicao || null,
      email: r.email || null,
      ativo: r.ativo == null ? true : !!r.ativo,
      db_id: r.id,
    };
  }

  function pessoaParaLinha(p) {
    return {
      nome: p.nome,
      papel: p.papel || null,
      grupo: p.grupo,
      nucleo: p.nucleo || null,
      pendente: !!p.pendente,
      ordem: p.ordem,
      nome_completo: p.nome_completo || null,
      nome_exibicao: p.nome_exibicao || null,
      email: p.email || null,
      ativo: p.ativo == null ? true : !!p.ativo,
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
    return (data || []).map(linhaParaPessoa);
  }

  function seedLocal() {
    return ((root.DB && root.DB.pessoas) || []).slice();
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
        console.error("db-pessoas: falha ao carregar do Supabase, caindo pro seed local (data/pessoas.js)", err);
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
    return linhaParaPessoa(data);
  }

  async function criar(pessoaParcial, usuario) {
    bloquearEscritaEmTeste();
    const supa = await root.CC_SUPABASE.obterClienteEsm();
    const payload = Object.assign({}, pessoaParaLinha(pessoaParcial), { updated_by: usuario || null });
    const { data, error } = await supa.from(TABELA).insert(payload).select().single();
    if (error) throw error;
    return linhaParaPessoa(data);
  }

  async function removerSoft(id, usuario) {
    bloquearEscritaEmTeste();
    const supa = await root.CC_SUPABASE.obterClienteEsm();
    const agora = new Date().toISOString();
    const { error } = await supa.from(TABELA).update({ deleted_at: agora, updated_by: usuario || null }).eq("id", id);
    if (error) throw error;
  }

  root.DB_PESSOAS = {
    TABELA: TABELA,
    carregar: carregar,
    salvar: salvar,
    criar: criar,
    removerSoft: removerSoft,
    pessoaParaLinha: pessoaParaLinha,
  };
})(this);
