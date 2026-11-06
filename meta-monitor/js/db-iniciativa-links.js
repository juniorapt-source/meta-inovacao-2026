/* Camada de dados das páginas "Painéis" e "Sites" (menu Execução, v0.33.0) —
 * window.DB_INICIATIVA_LINKS.
 *
 * Tabela meta_inovacao_iniciativa_links (tools/sql/2026-11_iniciativa_links.sql): os dois
 * tipos podem ter várias linhas por iniciativa — painel desde v0.34.0
 * (tools/sql/2026-11_iniciativa_links_paineis_multiplos.sql, que também cria `descricao`),
 * site desde v0.39.0 (tools/sql/2026-11_iniciativa_links_sites_multiplos.sql).
 * A linha só nasce quando alguém preenche algo pela primeira vez — gravar() decide entre
 * INSERT e UPDATE. remover() é soft delete (deleted_at).
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
      descricao: r.descricao || "",
      captura_lead: !!r.captura_lead,
      responsavel_pessoa_id: r.responsavel_pessoa_id || null,
      responsavel: r.responsavel || null,
      updated_at: r.updated_at || null,
      updated_by: r.updated_by || null,
    };
  }

  function paraLinha(o) {
    const linha = {
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
    // só manda a coluna quando há valor: assim o 1º painel continua gravando mesmo
    // antes de rodar o script que cria `descricao`
    if (o.descricao) linha.descricao = o.descricao;
    return linha;
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
      // v0.36.0 — linha antiga (sem projeto_id, ou com o nome de antes de um rename) sai
      // gravada com o projeto e o nome atuais da iniciativa
      if (iniciativa && iniciativa.projeto_id != null && String(existente.projeto_id) !== String(iniciativa.projeto_id)) patch.projeto_id = iniciativa.projeto_id;
      if (iniciativa && iniciativa.iniciativa && existente.iniciativa !== iniciativa.iniciativa) patch.iniciativa = iniciativa.iniciativa;
      return api.salvar(existente.db_id, patch, usuario);
    }
    return api.criar(Object.assign({ tipo: tipo }, iniciativa, campos), usuario);
  }

  async function remover(existente, usuario) {
    if (!existente || !existente.db_id) return;
    return api.removerSoft(existente.db_id, usuario);
  }

  const SCRIPT_PAINEIS = "tools/sql/2026-11_iniciativa_links_paineis_multiplos.sql";
  const SCRIPT_SITES = "tools/sql/2026-11_iniciativa_links_sites_multiplos.sql";

  // erro de banco que indica que o script dos painéis múltiplos ainda não rodou
  function faltaScriptPaineis(err) {
    const msg = String((err && (err.message || err.details)) || "");
    return (err && err.code === "23505") || /descricao/i.test(msg) || /tipo_iniciativa_uq/i.test(msg);
  }

  // erro de banco que indica que ainda falta rodar o script de múltiplos links/painéis
  // deste `tipo` (sites: 2026-11_iniciativa_links_sites_multiplos.sql).
  function faltaScriptMultiplos(tipo, err) {
    if (!err) return false;
    if (tipo === "painel") return faltaScriptPaineis(err);
    if (tipo === "site") {
      const msg = String((err && (err.message || err.details)) || "");
      return err.code === "23505" || /site_uq/i.test(msg);
    }
    return false;
  }

  function scriptMultiplos(tipo) { return tipo === "painel" ? SCRIPT_PAINEIS : SCRIPT_SITES; }

  root.DB_INICIATIVA_LINKS = {
    TABELA: TABELA,
    TIPOS: TIPOS,
    carregar: api.carregar,
    gravar: gravar,
    remover: remover,
    faltaScriptPaineis: faltaScriptPaineis,
    faltaScriptMultiplos: faltaScriptMultiplos,
    scriptMultiplos: scriptMultiplos,
    SCRIPT_PAINEIS: SCRIPT_PAINEIS,
    SCRIPT_SITES: SCRIPT_SITES,
    linkValido: linkValido,
  };
})(this);
