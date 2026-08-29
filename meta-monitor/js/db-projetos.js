/* Camada de dados do conjunto PROJETOS ("Correções v0.18.x") — window.DB_PROJETOS.
 *
 * Lê de meta_inovacao_projetos no Supabase; cai pra window.DB.projetos (data/projetos.js,
 * SEED + fallback) se a rede falhar. O mecanismo comum (fallback, memoização, modo de
 * teste ?semrede=1/CC_FORCAR_FALLBACK, bloqueio de escrita em teste) vive em
 * js/db-base.js desde o item D4.1 — API pública inalterada (item D4.3).
 *
 * PRECISA de js/db-base.js carregado antes.
 */
(function (root) {
  "use strict";

  const BASE = root.DB_BASE || (typeof globalThis !== "undefined" && globalThis.DB_BASE);
  if (!BASE) throw new Error("js/db-projetos.js: js/db-base.js precisa ser carregado antes deste arquivo.");

  const TABELA = "meta_inovacao_projetos";

  function linhaParaProjeto(r) {
    return {
      nucleo: r.nucleo,
      // nucleo_id (Camada 2, item 2.1) — lido desde sempre (a migração já populava),
      // mas só passou a ser GRAVADO por este módulo no item 5.5; até lá só
      // sobrevivia por causa do UPDATE original, e uma troca de núcleo feita pelo
      // <select> de editor.html derivava (texto mudava, FK ficava presa no valor
      // antigo) — é o que o 5.1 achou.
      nucleo_id: r.nucleo_id || null,
      iniciativa: r.iniciativa,
      representantes: r.representantes || [],
      ordem: r.ordem,
      db_id: r.id,
    };
  }

  function projetoParaLinha(p) {
    return {
      nucleo: p.nucleo,
      nucleo_id: p.nucleo_id || null,
      iniciativa: p.iniciativa,
      representantes: p.representantes || [],
      ordem: p.ordem,
    };
  }

  const api = BASE.criarWrapper({
    nome: "db-projetos",
    raiz: root,
    tabela: TABELA,
    ordem: "ordem",
    linhaPara: linhaParaProjeto,
    paraLinha: projetoParaLinha,
    seed: function () { return ((root.DB && root.DB.projetos) || []).slice(); },
    avisoFalha: "db-projetos: falha ao carregar do Supabase, caindo pro seed local (data/projetos.js)",
  });

  root.DB_PROJETOS = {
    TABELA: TABELA,
    carregar: api.carregar,
    salvar: api.salvar,
    criar: api.criar,
    removerSoft: api.removerSoft,
    projetoParaLinha: projetoParaLinha,
  };
})(this);
