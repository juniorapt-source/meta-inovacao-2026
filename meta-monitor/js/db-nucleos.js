/* Camada de dados do catálogo NÚCLEOS (golden record de cadastros de referência,
 * Camada 0, item 0.5) — window.DB_NUCLEOS.
 *
 * Lê de meta_inovacao_nucleos no Supabase; cai pra window.DB.nucleos (data/nucleos.js,
 * SEED + fallback) se a rede falhar. O mecanismo (fallback, memoização, modo de teste
 * ?semrede=1/CC_FORCAR_FALLBACK, bloqueio de escrita em teste) vive em js/db-base.js
 * desde o item D4.1 — este arquivo só descreve o que é próprio deste catálogo. A API
 * pública é a mesma de sempre: nada mudou pras telas (item D4.2).
 *
 * PRECISA de js/db-base.js carregado antes (todas as páginas carregam logo depois de
 * js/supabase.js).
 */
(function (root) {
  "use strict";

  const BASE = root.DB_BASE || (typeof globalThis !== "undefined" && globalThis.DB_BASE);
  if (!BASE) throw new Error("js/db-nucleos.js: js/db-base.js precisa ser carregado antes deste arquivo.");

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

  const api = BASE.criarWrapper({
    nome: "db-nucleos",
    raiz: root,
    tabela: TABELA,
    ordem: "ordem",
    linhaPara: linhaParaNucleo,
    paraLinha: nucleoParaLinha,
    seed: function () { return ((root.DB && root.DB.nucleos) || []).slice(); },
    avisoFalha: "db-nucleos: falha ao carregar do Supabase, caindo pro seed local (data/nucleos.js)",
  });

  root.DB_NUCLEOS = {
    TABELA: TABELA,
    carregar: api.carregar,
    salvar: api.salvar,
    criar: api.criar,
    removerSoft: api.removerSoft,
    nucleoParaLinha: nucleoParaLinha,
  };
})(this);
