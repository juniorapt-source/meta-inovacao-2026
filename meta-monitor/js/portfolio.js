/* Bootstrap do PORTFÓLIO (golden record) — window.PORTFOLIO. Camada 2 da governança
 * (ver docs/GOVERNANCA_GOLDEN_RECORD.md).
 *
 * Hidrata window.DB.projetos NO LUGAR a partir de meta_inovacao_projetos (via DB_PROJETOS,
 * js/db-projetos.js), pra que TODO leitor síncrono do portfólio — js/drawer.js, os KPIs do
 * index, o nav do plano-acao — passe a enxergar o dado vivo sem precisar ser reescrito.
 *
 * data/projetos.js continua carregado ANTES deste script: é o seed que aparece de imediato
 * e o fallback offline. A hidratação só troca o conteúdo do MESMO array (mantém as
 * referências que qualquer tela já tenha capturado) e dispara o evento "portfolio:pronto".
 *
 * Uso nas telas que renderizam o portfólio no load (index, plano-acao):
 *     if (window.PORTFOLIO) await window.PORTFOLIO.pronto;   // antes de renderizar
 * Telas que só abrem o drawer sob demanda não precisam de nada: quando o usuário clicar,
 * window.DB.projetos já terá sido hidratado.
 */
(function (root) {
  "use strict";
  root.DB = root.DB || {};
  root.DB.projetos = root.DB.projetos || [];

  // muta o MESMO array (não reatribui) pra preservar referências já capturadas por closures
  function aplicar(lista) {
    const arr = root.DB.projetos;
    arr.length = 0;
    (lista || []).forEach((p) => arr.push(p));
  }

  let estado = { pronto: false, usandoFallback: null, motivoFallback: null };

  async function carregar(forcar) {
    if (!root.DB_PROJETOS) {
      // js/db-projetos.js não foi incluído nesta página — segue só com o seed local.
      estado = { pronto: true, usandoFallback: true, motivoFallback: "js/db-projetos.js ausente nesta página" };
      return estado;
    }
    try {
      const r = await root.DB_PROJETOS.carregar(forcar ? { recarregar: true } : undefined);
      // só substitui se veio lista de verdade — nunca zera o portfólio por um retorno vazio.
      if (r && Array.isArray(r.lista) && r.lista.length) aplicar(r.lista);
      estado = { pronto: true, usandoFallback: !!(r && r.usandoFallback), motivoFallback: (r && r.motivoFallback) || null };
    } catch (err) {
      // DB_PROJETOS.carregar já cai pro seed por dentro; se ainda assim lançar, mantém o seed.
      console.error("portfolio: falha ao hidratar do golden record, mantendo seed local (data/projetos.js)", err);
      estado = { pronto: true, usandoFallback: true, motivoFallback: (err && err.message) || String(err) };
    }
    try {
      root.dispatchEvent(new CustomEvent("portfolio:pronto", { detail: estado }));
    } catch (e) { /* ambiente sem CustomEvent — segue sem evento, o await já resolve */ }
    return estado;
  }

  // dispara a hidratação já no carregamento do script (em paralelo com o resto da página).
  const pronto = carregar(false);

  root.PORTFOLIO = {
    pronto: pronto,                        // Promise<estado> — resolve quando DB.projetos está hidratado
    estado: function () { return estado; },
    recarregar: function () { return carregar(true); },
  };
})(this);
