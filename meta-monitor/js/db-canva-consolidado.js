/* Camada de dados da CONSOLIDAÇÃO do canvas das oficinas (item 4 do plano "canvas
 * preenchido direto no site") — window.DB_CANVA_CONSOLIDADO. Consumida por
 * canva-consolidado.html.
 *
 * Difere de js/db-canva.js (a camada do canva.html, item 2) porque o lado que ela cobre é
 * o outro: aqui é a EQUIPE lendo e moderando, não o gestor preenchendo. Consequência
 * direta da §6.5 do plano — a leitura desta tabela agora é igual à de qualquer outra
 * tabela do site:
 *
 *   - LEITURA por SELECT direto (`GRANT SELECT` + policy `cc_select_publico`,
 *     tools/sql/2026-08_canva_leitura_aberta.sql, já em produção). Sem função
 *     intermediária, sem filtro de deleted_at aqui — a tabela devolve tudo, inclusive
 *     descartada; QUEM filtra é a tela (§6.5: "USING (true) sem filtrar deleted_at é de
 *     propósito: a consolidação precisa enxergar o descartado").
 *   - ESCRITA só por `cc_canva_moderar(p jsonb)`, SECURITY DEFINER, EXECUTE pro anon, sem
 *     credencial nenhuma (§8) — é ela que garante status e deleted_at andarem juntos e
 *     que só transições de status válidas aconteçam, o que um UPDATE solto não garante.
 *
 * Nenhuma das duas pede login: nem sessão do Supabase Auth (revertida na v0.30.0, o antigo
 * js/auth.js foi apagado — item D2.3), nada de OTP, nada de chave — regra do projeto (§6.6).
 * O contrato de e-mail/OTP mencionado nos comentários de
 * tools/sql/2026-08_canva_demandas.sql é de uma versão anterior do plano (v3–v7) e foi
 * revertido pela v8 antes deste arquivo existir; tools/sql/2026-08_canva_leitura_aberta.sql
 * é o script que vale.
 */
(function (root) {
  "use strict";

  const TABELA = "meta_inovacao_canva_demandas";
  const RPC_MODERAR = "cc_canva_moderar";

  // mesmo mecanismo de teste dos outros js/db-*.js: ?semrede=1 (ou window.CC_FORCAR_FALLBACK)
  // evita tocar o Supabase de verdade durante um ensaio ou um teste automatizado.
  function forcarFallback() {
    if (root.CC_FORCAR_FALLBACK) return true;
    try { return new URLSearchParams(root.location.search).get("semrede") === "1"; } catch (e) { return false; }
  }

  // Todas as linhas, sem filtro nenhum (nem status, nem deleted_at) — a tela decide o
  // que mostrar (§6.5). Ordena por criado_em desc: mais recente primeiro, é o que
  // interessa pra quem está conferindo o que acabou de sair de uma oficina.
  async function carregar() {
    if (forcarFallback()) return [];
    if (!root.CC_SUPABASE) throw new Error("js/supabase.js não carregado.");
    const supa = await root.CC_SUPABASE.obterClienteEsm();
    const { data, error } = await supa.from(TABELA).select("*").order("criado_em", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  // Única porta de escrita desta tela — validar, descartar, reabrir, editar,
  // vincular_projeto, validar_lote (ver tools/sql/2026-08_canva_leitura_aberta.sql, seção
  // 2, pro contrato completo de cada ação). Nunca lança por erro de CONTEÚDO — a função
  // SQL devolve sempre {ok, ...}; só lança por erro de infraestrutura (rede, RLS, cache de
  // schema do PostgREST), que é quando `error` vem preenchido no retorno do client.
  async function moderar(payload) {
    if (forcarFallback()) return { ok: true, simulado: true };
    if (!root.CC_SUPABASE) throw new Error("js/supabase.js não carregado.");
    const supa = await root.CC_SUPABASE.obterClienteEsm();
    const { data, error } = await supa.rpc(RPC_MODERAR, { p: payload });
    if (error) throw error;
    return data || {};
  }

  const DB_CANVA_CONSOLIDADO = {
    TABELA: TABELA,
    RPC_MODERAR: RPC_MODERAR,
    carregar: carregar,
    moderar: moderar,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = DB_CANVA_CONSOLIDADO;
  else root.DB_CANVA_CONSOLIDADO = DB_CANVA_CONSOLIDADO;
})(typeof globalThis !== "undefined" ? globalThis : this);
