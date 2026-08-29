/* Camada de dados da junção AÇÃO DO PLANO × (PESSOA OU COLETIVO) (golden record de
 * cadastros de referência, Camada 2, item 2.6 —
 * tools/sql/2026-08_plano_responsaveis.sql) — window.DB_PLANO_RESPONSAVEIS.
 *
 * Uma ação pode ter mais de um responsável (`responsavel_id` já é `text[]` desde o P4).
 * `ordem` é a posição em `responsavel_id[]` — mesmo papel de `ordem` em
 * js/db-projeto-representantes.js/js/db-pessoa-papeis.js, junções irmãs que seguem o
 * mesmo padrão (sem seed local pra esta tabela — nasceu na Camada 2, não tem
 * equivalente em data/*.js, então o fallback é lista vazia).
 *
 * pessoa_id XOR coletivo_id (nunca os dois, nunca nenhum) — mesmo CHECK do banco
 * (`cc_plano_resp_exatamente_um`); quem decide qual é a tradução de cada id de
 * `responsavel_id[]` é js/db-responsaveis.js (item 4.3), não este módulo.
 *
 * O mecanismo comum vem da fábrica js/db-base.js (item D4.1); API pública inalterada
 * (item D4.3). PRECISA de js/db-base.js carregado antes.
 */
(function (root) {
  "use strict";

  const BASE = root.DB_BASE || (typeof globalThis !== "undefined" && globalThis.DB_BASE);
  if (!BASE) throw new Error("js/db-plano-responsaveis.js: js/db-base.js precisa ser carregado antes deste arquivo.");

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

  const api = BASE.criarWrapper({
    nome: "db-plano-responsaveis",
    raiz: root,
    tabela: TABELA,
    ordem: null, // a ordenação por `ordem` acontece no agrupamento (porPlanoAcao), não na consulta
    linhaPara: linhaParaVinculo,
    paraLinha: vinculoParaLinha,
    avisoFalha: "db-plano-responsaveis: falha ao carregar do Supabase, sem seed local pra esta tabela",
  });

  root.DB_PLANO_RESPONSAVEIS = {
    TABELA: TABELA,
    carregar: api.carregar,
    criar: api.criar,
    removerSoft: api.removerSoft,
    porPlanoAcao: porPlanoAcao,
    vinculoParaLinha: vinculoParaLinha,
  };
})(this);
