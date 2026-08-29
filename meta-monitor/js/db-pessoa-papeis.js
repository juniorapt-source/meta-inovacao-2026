/* Camada de dados da junção PESSOA × PAPEL (golden record de pessoas, Camada 1,
 * tools/sql/2026-08_pessoas_golden.sql) — window.DB_PESSOA_PAPEIS.
 *
 * Uma pessoa pode acumular mais de um papel (ex.: Sandra Chaves Silva Paraíso é
 * assistente do plano NA UI, membro do Comitê E representante do núcleo Gestão do
 * Conhecimento e Processos — 3 linhas aqui, 1 pessoa em meta_inovacao_pessoas).
 * `contexto` é sempre 'UI' | 'Comite' | 'Nucleo'; `nucleo_id` só é preenchido quando
 * contexto='Nucleo' (constraint no banco já garante isso).
 *
 * Sem fallback local pra arquivo próprio: esta tabela nasceu só na Camada 1, não tem
 * equivalente em data/*.js — se a rede falhar, carregar() devolve lista vazia (não
 * quebra, mas telas que dependem disso pra exibir papéis mostram "sem dados" nesse
 * cenário). É o que a fábrica js/db-base.js faz quando não recebe `seed` (item D4.1);
 * o resto do mecanismo (memoização, ?semrede=1/CC_FORCAR_FALLBACK, bloqueio de escrita
 * em teste) também vem de lá. API pública inalterada (item D4.3).
 *
 * PRECISA de js/db-base.js carregado antes.
 */
(function (root) {
  "use strict";

  const BASE = root.DB_BASE || (typeof globalThis !== "undefined" && globalThis.DB_BASE);
  if (!BASE) throw new Error("js/db-pessoa-papeis.js: js/db-base.js precisa ser carregado antes deste arquivo.");

  const TABELA = "meta_inovacao_pessoa_papeis";

  function linhaParaPapel(r) {
    return {
      pessoa_id: r.pessoa_id,
      contexto: r.contexto,
      nucleo_id: r.nucleo_id || null,
      papel: r.papel || null,
      db_id: r.id,
    };
  }

  function papelParaLinha(p) {
    return {
      pessoa_id: p.pessoa_id,
      contexto: p.contexto,
      nucleo_id: p.nucleo_id || null,
      papel: p.papel || null,
    };
  }

  // agrupa a lista achatada por pessoa_id — conveniência pra tela que mostra
  // "papéis desta pessoa" sem cada consumidor reimplementar o group-by.
  function porPessoa(lista) {
    const idx = {};
    (lista || []).forEach((p) => {
      if (!idx[p.pessoa_id]) idx[p.pessoa_id] = [];
      idx[p.pessoa_id].push(p);
    });
    return idx;
  }

  const api = BASE.criarWrapper({
    nome: "db-pessoa-papeis",
    raiz: root,
    tabela: TABELA,
    ordem: null, // esta tabela nunca foi lida ordenada — o agrupamento é por pessoa
    linhaPara: linhaParaPapel,
    paraLinha: papelParaLinha,
    avisoFalha: "db-pessoa-papeis: falha ao carregar do Supabase, sem seed local pra esta tabela",
  });

  root.DB_PESSOA_PAPEIS = {
    TABELA: TABELA,
    carregar: api.carregar,
    criar: api.criar,
    removerSoft: api.removerSoft,
    porPessoa: porPessoa,
    papelParaLinha: papelParaLinha,
  };
})(this);
