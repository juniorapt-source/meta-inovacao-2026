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
 * Sem fallback local pra arquivo próprio (esta tabela nasceu na Camada 2, não tem
 * equivalente em data/*.js): o fallback é lista vazia, como nas junções irmãs
 * js/db-pessoa-papeis.js e js/db-plano-responsaveis.js. O mecanismo comum vem da
 * fábrica js/db-base.js (item D4.1); API pública inalterada (item D4.3).
 *
 * PRECISA de js/db-base.js carregado antes.
 */
(function (root) {
  "use strict";

  const BASE = root.DB_BASE || (typeof globalThis !== "undefined" && globalThis.DB_BASE);
  if (!BASE) throw new Error("js/db-projeto-representantes.js: js/db-base.js precisa ser carregado antes deste arquivo.");

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

  const api = BASE.criarWrapper({
    nome: "db-projeto-representantes",
    raiz: root,
    tabela: TABELA,
    ordem: null, // a ordenação por `ordem` acontece no agrupamento (porProjeto), não na consulta
    linhaPara: linhaParaVinculo,
    paraLinha: vinculoParaLinha,
    avisoFalha: "db-projeto-representantes: falha ao carregar do Supabase, sem seed local pra esta tabela",
  });

  root.DB_PROJETO_REPRESENTANTES = {
    TABELA: TABELA,
    carregar: api.carregar,
    criar: api.criar,
    removerSoft: api.removerSoft,
    porProjeto: porProjeto,
    vinculoParaLinha: vinculoParaLinha,
  };
})(this);
