/* Camada de dados do conjunto AGENDA (item 3.1 do plano de melhorias) — window.DB_AGENDA.
 *
 * Lê de meta_inovacao_agenda_encontros no Supabase; cai pra window.DB.agenda.encontros
 * (data/agenda.js, SEED + fallback) se a rede falhar. O mecanismo comum (fallback,
 * memoização, modo de teste ?semrede=1/CC_FORCAR_FALLBACK, bloqueio de escrita em teste)
 * vive em js/db-base.js desde o item D4.1 — API pública inalterada (item D4.3). Este
 * conjunto não tem criar(): encontro novo não nasce pela UI.
 *
 * O "id" visível de sempre ("c1-foco", usado em âncoras — agenda.html, js/busca.js,
 * js/drawer.js) é recalculado aqui como "c"+ciclo+"-"+canal a partir das colunas
 * (ciclo, canal) — a tabela usa um bigint identity como chave interna (db_id), mas o
 * id de exibição continua idêntico ao de antes, sem precisar mudar link nenhum.
 *
 * "hora" sempre foi null em todo encontro até esta migração — fundida em "turno" no
 * banco (ver tools/sql/2026-08_agenda.sql); "local" e "modo" viraram um campo só
 * (localModo). Consumida por agenda.html e js/timeline.js.
 *
 * PRECISA de js/db-base.js carregado antes.
 */
(function (root) {
  "use strict";

  const BASE = root.DB_BASE || (typeof globalThis !== "undefined" && globalThis.DB_BASE);
  if (!BASE) throw new Error("js/db-agenda.js: js/db-base.js precisa ser carregado antes deste arquivo.");

  const TABELA = "meta_inovacao_agenda_encontros";

  function idLegado(r) {
    return "c" + r.ciclo + "-" + r.canal + (r.sessao && r.sessao !== 1 ? "-s" + r.sessao : "");
  }

  function linhaParaEncontro(r) {
    return {
      id: idLegado(r),
      db_id: r.id,
      ciclo: "c" + r.ciclo,
      canal: r.canal,
      data: r.data_iso,
      hora: null,
      turno: r.turno || null,
      localModo: r.local_modo || null,
      confirmacoes: r.confirmacoes || null,
      status: r.status, // já é a chave canônica (encontro_agendado etc.) — CC_STATUS.chaveDeEntrada
                         // é idempotente pra chave que já é canônica (cai no próprio fallback,
                         // devolve sem alterar), então o resto do código não precisa saber disso
      nota: r.observacao || "",
      pautaResumo: r.pauta_resumo || "",
    };
  }

  function encontroParaLinha(e) {
    const ciclo = String(e.ciclo || "").replace(/^c/, "");
    return {
      ciclo: parseInt(ciclo, 10) || 1,
      canal: e.canal,
      sessao: 1,
      pauta_resumo: e.pautaResumo || null,
      data_iso: e.data || null,
      turno: e.turno || null,
      local_modo: e.localModo || null,
      confirmacoes: e.confirmacoes || null,
      status: e.status,
      observacao: e.nota || null,
    };
  }

  const api = BASE.criarWrapper({
    nome: "db-agenda",
    raiz: root,
    tabela: TABELA,
    ordem: ["ciclo", "canal"],
    linhaPara: linhaParaEncontro,
    paraLinha: encontroParaLinha,
    seed: function () { return ((root.DB && root.DB.agenda && root.DB.agenda.encontros) || []).slice(); },
    avisoFalha: "db-agenda: falha ao carregar do Supabase, caindo pro seed local (data/agenda.js)",
  });

  root.DB_AGENDA = {
    TABELA: TABELA,
    carregar: api.carregar,
    salvar: api.salvar,
    removerSoft: api.removerSoft,
    encontroParaLinha: encontroParaLinha,
  };
})(this);
