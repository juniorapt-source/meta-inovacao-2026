/* Camada de dados do catálogo CANAIS (golden record de cadastros de referência,
 * Camada 0, item 0.5) — window.DB_CANAIS.
 *
 * Lê de meta_inovacao_canais no Supabase; cai pra window.DB.canais (data/canais.js,
 * SEED + fallback) se a rede falhar. O mecanismo (fallback, memoização, modo de teste
 * ?semrede=1/CC_FORCAR_FALLBACK, bloqueio de escrita em teste) vive em js/db-base.js
 * desde o item D4.1 — aqui fica só o que é próprio deste catálogo. API pública
 * inalterada (item D4.3).
 *
 * Formato canônico devolvido por carregar() (bate com as colunas da tabela nova, não
 * com o formato antigo de data/canais.js — ver o seed abaixo):
 *   { slug, nome, nome_completo, formato, pauta, ordem, ativo, db_id }
 *
 * PRECISA de js/db-base.js carregado antes.
 */
(function (root) {
  "use strict";

  const BASE = root.DB_BASE || (typeof globalThis !== "undefined" && globalThis.DB_BASE);
  if (!BASE) throw new Error("js/db-canais.js: js/db-base.js precisa ser carregado antes deste arquivo.");

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

  const api = BASE.criarWrapper({
    nome: "db-canais",
    raiz: root,
    tabela: TABELA,
    ordem: "ordem",
    linhaPara: linhaParaCanal,
    paraLinha: canalParaLinha,
    seed: seedLocal,
    avisoFalha: "db-canais: falha ao carregar do Supabase, caindo pro seed local (data/canais.js)",
  });

  root.DB_CANAIS = {
    TABELA: TABELA,
    carregar: api.carregar,
    salvar: api.salvar,
    criar: api.criar,
    removerSoft: api.removerSoft,
    canalParaLinha: canalParaLinha,
  };
})(this);
