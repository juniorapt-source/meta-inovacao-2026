/* Núcleo compartilhado: navegação, rodapé versionado, helpers de status. */
(function () {
  "use strict";
  const DB = window.DB || {};
  // menu agrupado por domínio — URLs, rótulos e a ordem DENTRO de cada grupo são os
  // mesmos de antes (só o agrupamento visual é novo); pra mudar uma URL ou um rótulo,
  // mexe aqui, não precisa caçar duplicata em nenhuma outra página.
  const GRUPOS = [
    { titulo: "Visão", paginas: [
      ["index.html", "Dashboard"],
      ["caminho.html", "Caminho crítico"],
    ] },
    { titulo: "Execução", paginas: [
      ["plano.html", "Plano de ação"],
      ["minhas-acoes.html", "Minhas ações"],
      ["agenda.html", "Agenda dos ciclos"],
      ["demandas.html", "Matriz de demandas"],
      ["plano-acao.html", "Atividades por iniciativa"],
    ] },
    { titulo: "Pessoas", paginas: [
      ["participantes.html", "Participantes"],
      ["projetos.html", "Projetos"],
    ] },
    { titulo: "Jornada", paginas: [
      ["corsario.html", "O Caminho para o Corsário"],
    ] },
    { titulo: "Admin", paginas: [
      ["editor.html", "Modo edição"],
    ] },
  ];

  window.hojeISO = function () {
    if (DB.config && DB.config.hoje_referencia) return DB.config.hoje_referencia;
    return new Date().toISOString().slice(0, 10);
  };

  // resolve a chave canônica de status de uma ação (window.CC_STATUS, js/status.js) —
  // mesma precedência de sempre: atrasada vence tudo (mesmo uma ação "Em andamento" com
  // prazo vencido conta como atrasada, decisão preservada de antes deste módulo existir),
  // depois o status bruto traduzido pela chave canônica, depois "janela" (sem prazo_iso
  // mas com prazo em texto), com "não iniciado" de fallback.
  window.chaveStatusAcao = function (acao, hojeISO) {
    if (window.CALC && CALC.ehAtrasada(acao, hojeISO)) return "atrasada";
    const chaveDoStatusBruto = window.CC_STATUS ? CC_STATUS.chaveDeEntrada("acao", acao.status) : acao.status;
    if (chaveDoStatusBruto === "concluida" || chaveDoStatusBruto === "em_andamento") return chaveDoStatusBruto;
    if (!acao.prazo_iso && acao.prazo) return "janela";
    return "nao_iniciado";
  };

  // [classe, rótulo] pro chip — mesmo formato de retorno de sempre; migrado pra taxonomia
  // única (item 2.4 do plano de melhorias): a fonte do texto/cor agora é window.CC_STATUS
  // (js/status.js), não mais um if/else duplicado aqui.
  window.stClass = function (acao, hojeISO) {
    const chave = chaveStatusAcao(acao, hojeISO);
    if (window.CC_STATUS) return CC_STATUS.par(chave);
    // fallback se por algum motivo js/status.js não carregou nesta página — mesmo texto
    // de antes, só pra nunca deixar a UI sem badge.
    const FALLBACK = { atrasada: ["st-atrasada", "Atrasada"], concluida: ["st-concluido", "Concluído"], em_andamento: ["st-andamento", "Em andamento"], janela: ["st-janela", "Não iniciado · janela"], nao_iniciado: ["st-nao", "Não iniciado"] };
    return FALLBACK[chave] || FALLBACK.nao_iniciado;
  };

  window.esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  };

  window.montarShell = function (paginaAtual) {
    const nav = document.querySelector(".nav");
    if (!nav) return;
    const cfg = DB.config || { projeto: "Carta de Corso", versao: "dev", atualizado_em: "" };
    let html = '<div class="marca">' + esc(cfg.projeto || "Carta de Corso") + "<small>" + esc(cfg.subtitulo || "") + "</small></div>";
    for (const grupo of GRUPOS) {
      html += '<div class="grupo-titulo">' + esc(grupo.titulo) + "</div>";
      for (const [href, rotulo] of grupo.paginas) {
        const ativo = href === paginaAtual ? ' class="ativo" aria-current="page"' : "";
        html += '<a href="' + href + '"' + ativo + ">" + rotulo + "</a>";
      }
    }
    html += '<div class="rodape">v' + esc(cfg.versao) + " · atualizado em " + esc(CALC.fmtBR(cfg.atualizado_em)) + "/2026<br>Repositório Git · deploy Vercel</div>";
    nav.innerHTML = html;
  };
})();
