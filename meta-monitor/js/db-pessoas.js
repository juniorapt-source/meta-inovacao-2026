/* Camada de dados do conjunto PESSOAS ("Correções v0.18.x", migração do restante do
 * Modo edição pro Supabase) — window.DB_PESSOAS.
 *
 * Lê de meta_inovacao_pessoas no Supabase; cai pra window.DB.pessoas (data/pessoas.js,
 * SEED + fallback) se a rede falhar. O mecanismo comum (fallback, memoização, modo de
 * teste ?semrede=1/CC_FORCAR_FALLBACK, bloqueio de escrita em teste) vive em
 * js/db-base.js desde o item D4.1 — API pública inalterada (item D4.3).
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
 *
 * PRECISA de js/db-base.js carregado antes.
 */
(function (root) {
  "use strict";

  const BASE = root.DB_BASE || (typeof globalThis !== "undefined" && globalThis.DB_BASE);
  if (!BASE) throw new Error("js/db-pessoas.js: js/db-base.js precisa ser carregado antes deste arquivo.");

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

  const api = BASE.criarWrapper({
    nome: "db-pessoas",
    raiz: root,
    tabela: TABELA,
    ordem: "ordem",
    linhaPara: linhaParaPessoa,
    paraLinha: pessoaParaLinha,
    seed: function () { return ((root.DB && root.DB.pessoas) || []).slice(); },
    avisoFalha: "db-pessoas: falha ao carregar do Supabase, caindo pro seed local (data/pessoas.js)",
  });

  root.DB_PESSOAS = {
    TABELA: TABELA,
    carregar: api.carregar,
    salvar: api.salvar,
    criar: api.criar,
    removerSoft: api.removerSoft,
    pessoaParaLinha: pessoaParaLinha,
  };
})(this);
