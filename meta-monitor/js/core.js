/* Núcleo compartilhado: navegação, rodapé versionado, helpers de status. */
(function () {
  "use strict";
  const DB = window.DB || {};
  const PAGINAS = [
    ["index.html", "Dashboard"],
    ["plano.html", "Plano de ação"],
    ["caminho.html", "Caminho crítico"],
    ["agenda.html", "Agenda dos ciclos"],
    ["demandas.html", "Matriz de demandas"],
    ["participantes.html", "Participantes"],
    ["projetos.html", "Projetos"],
    ["plano-acao.html", "Plano de Ação x Projeto"],
    ["editor.html", "Modo edição"],
  ];

  window.hojeISO = function () {
    if (DB.config && DB.config.hoje_referencia) return DB.config.hoje_referencia;
    return new Date().toISOString().slice(0, 10);
  };

  window.stClass = function (acao, hojeISO) {
    if (window.CALC && CALC.ehAtrasada(acao, hojeISO)) return ["st-atrasada", "Atrasada"];
    if (acao.status === "Concluído") return ["st-concluido", "Concluído"];
    if (acao.status === "Em andamento") return ["st-andamento", "Em andamento"];
    if (!acao.prazo_iso && acao.prazo) return ["st-janela", "Não iniciado · janela"];
    return ["st-nao", "Não iniciado"];
  };

  window.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  };

  window.montarShell = function (paginaAtual) {
    const nav = document.querySelector(".nav");
    if (!nav) return;
    const cfg = DB.config || { projeto: "Carta de Corso", versao: "dev", atualizado_em: "" };
    let html = '<div class="marca">' + esc(cfg.projeto || "Carta de Corso") + "<small>" + esc(cfg.subtitulo || "") + "</small></div>";
    for (const [href, rotulo] of PAGINAS) {
      const ativo = href === paginaAtual ? ' class="ativo" aria-current="page"' : "";
      html += '<a href="' + href + '"' + ativo + ">" + rotulo + "</a>";
    }
    html += '<div class="rodape">v' + esc(cfg.versao) + " · atualizado em " + esc(CALC.fmtBR(cfg.atualizado_em)) + "/2026<br>Repositório Git · deploy Vercel</div>";
    nav.innerHTML = html;
  };
})();
