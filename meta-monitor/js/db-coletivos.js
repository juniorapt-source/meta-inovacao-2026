/* Camada de dados do catálogo COLETIVOS (golden record de cadastros de referência,
 * Camada 0, item 0.5) — window.DB_COLETIVOS.
 *
 * Lê de meta_inovacao_coletivos no Supabase; cai pra window.DB.coletivos
 * (data/coletivos.js, SEED + fallback) se a rede falhar. O mecanismo (fallback,
 * memoização, modo de teste ?semrede=1/CC_FORCAR_FALLBACK, bloqueio de escrita em teste)
 * vive em js/db-base.js desde o item D4.1 — este arquivo só descreve o que é próprio
 * deste catálogo. A API pública é a mesma de sempre: nada mudou pras telas (item D4.2).
 *
 * PRECISA de js/db-base.js carregado antes (todas as páginas carregam logo depois de
 * js/supabase.js).
 */
(function (root) {
  "use strict";

  const BASE = root.DB_BASE || (typeof globalThis !== "undefined" && globalThis.DB_BASE);
  if (!BASE) throw new Error("js/db-coletivos.js: js/db-base.js precisa ser carregado antes deste arquivo.");

  const TABELA = "meta_inovacao_coletivos";

  function linhaParaColetivo(r) {
    return {
      nome: r.nome,
      ordem: r.ordem,
      db_id: r.id,
    };
  }

  function coletivoParaLinha(c) {
    return {
      nome: c.nome,
      ordem: c.ordem,
    };
  }

  const api = BASE.criarWrapper({
    nome: "db-coletivos",
    raiz: root,
    tabela: TABELA,
    ordem: "ordem",
    linhaPara: linhaParaColetivo,
    paraLinha: coletivoParaLinha,
    seed: function () { return ((root.DB && root.DB.coletivos) || []).slice(); },
    avisoFalha: "db-coletivos: falha ao carregar do Supabase, caindo pro seed local (data/coletivos.js)",
  });

  root.DB_COLETIVOS = {
    TABELA: TABELA,
    carregar: api.carregar,
    salvar: api.salvar,
    criar: api.criar,
    removerSoft: api.removerSoft,
    coletivoParaLinha: coletivoParaLinha,
  };
})(this);
