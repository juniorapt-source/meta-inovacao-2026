/* Camada de dados das páginas "Painéis" e "Sites" (menu Execução, v0.33.0) —
 * window.DB_INICIATIVA_LINKS.
 *
 * Tabela meta_inovacao_iniciativa_links (tools/sql/2026-11_iniciativa_links.sql): uma
 * linha por iniciativa e por tipo ('site' | 'painel'). A linha só nasce quando alguém
 * preenche algo pela primeira vez — gravar() decide entre INSERT e UPDATE.
 *
 * Sem seed local: sem rede, a lista volta vazia e as páginas mostram as iniciativas sem
 * nada preenchido (e a escrita fica desligada).
 *
 * PRECISA de js/db-base.js carregado antes.
 */
(function (root) {
  "use strict";

  const BASE = root.DB_BASE || (typeof globalThis !== "undefined" && globalThis.DB_BASE);
  if (!BASE) throw new Error("js/db-iniciativa-links.js: js/db-base.js precisa ser carregado antes deste arquivo.");

  const TABELA = "meta_inovacao_iniciativa_links";
  const TIPOS = ["site", "painel"];

  function linhaPara(r) {
    return {
      db_id: r.id,
      tipo: r.tipo,
      iniciativa: r.iniciativa,
      nucleo: r.nucleo || null,
      projeto_id: r.projeto_id || null,
      nucleo_id: r.nucleo_id || null,
      link: r.link || "",
      captura_lead: !!r.captura_lead,
      responsavel_pessoa_id: r.responsavel_pessoa_id || null,
      responsavel: r.responsavel || null,
      updated_at: r.updated_at || null,
      updated_by: r.updated_by || null,
    };
  }

  function paraLinha(o) {
    return {
      tipo: o.tipo,
      iniciativa: o.iniciativa,
      nucleo: o.nucleo || null,
      projeto_id: o.projeto_id || null,
      nucleo_id: o.nucleo_id || null,
      link: o.link || null,
      captura_lead: !!o.captura_lead,
      responsavel_pessoa_id: o.responsavel_pessoa_id || null,
      responsavel: o.responsavel || null,
    };
  }

  const api = BASE.criarWrapper({
    nome: "db-iniciativa-links",
    raiz: root,
    tabela: TABELA,
    ordem: "iniciativa",
    linhaPara: linhaPara,
    paraLinha: paraLinha,
    avisoFalha: "db-iniciativa-links: falha ao carregar do Supabase (sem seed local)",
  });

  // aceita vazio; com conteúdo, só http(s) — o banco tem o mesmo CHECK
  function linkValido(txt) {
    const t = String(txt || "").trim();
    return t === "" || /^https?:\/\/\S+$/i.test(t);
  }

  // existente = linha já carregada (ou null). campos = só o que mudou.
  async function gravar(tipo, iniciativa, existente, campos, usuario) {
    if (TIPOS.indexOf(tipo) === -1) throw new Error("db-iniciativa-links: tipo inválido: " + tipo);
    if (existente && existente.db_id) {
      const patch = {};
      Object.keys(campos).forEach((k) => { const v = campos[k]; patch[k] = (v === "" || v === undefined) ? null : v; });
      return api.salvar(existente.db_id, patch, usuario);
    }
    return api.criar(Object.assign({ tipo: tipo }, iniciativa, campos), usuario);
  }

  root.DB_INICIATIVA_LINKS = {
    TABELA: TABELA,
    TIPOS: TIPOS,
    carregar: api.carregar,
    gravar: gravar,
    linkValido: linkValido,
  };
})(this);
