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
      ["canva-consolidado.html", "Consolidação do canvas"],
      ["plano-acao.html", "Atividades por iniciativa"],
    ] },
    // Grupo criado em 22/08/2026, a pedido do José. As três páginas existiam e eram
    // alcançáveis só por URL direta — o QR levava à primeira, e as outras duas ninguém
    // achava sem saber o endereço.
    //
    // canva.html no menu CONTRARIA a decisão original do §4 do plano do canvas
    // ("fora do menu lateral: é página de destino de QR, não de navegação"). A decisão
    // foi revista: o motivo de mantê-la fora era não distrair quem chega pelo QR na
    // sala, e isso continua valendo pra ELE — mas a equipe também precisa abrir o canvas
    // sem ter um QR na frente (testar, preencher no lugar de quem não conseguiu, mostrar
    // pra alguém). O §4 e o §13 do plano foram atualizados junto, pra documento e site
    // não passarem a dizer coisas diferentes.
    { titulo: "Oficinas", paginas: [
      ["apresentacao_canais.html", "Apresentação dos canais"],
      ["qrcodes.html", "QR das oficinas"],
      ["canva.html", "Preencher canvas"],
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

  // chip do caminho crítico (★ Nó N / cadeia N / ◆ SLA) — antes só existia em plano.html
  // (Lista + Kanban); centralizado aqui pra index.html ("Atrasadas agora") reusar o mesmo
  // componente, não uma cópia ("Dashboard orientado à decisão", item 2 do drill-down).
  // "no" vira link pra caminho.html#no<N> (mesmo id de âncora que os cards de nó de
  // caminho.html já têm, e que o trilho do Dashboard já usa) — discreto (css/base.css:
  // a.chip.cc só ganha cursor+underline no hover, sem mudar o visual do badge).
  // semLink=true devolve span em vez de <a>: usado só onde o chip já fica DENTRO de outro
  // <a> (ex.: a linha inteira de "Atrasadas agora" já é um link pra plano.html) — <a>
  // aninhado dentro de <a> é HTML inválido e o navegador reordena a árvore de forma
  // imprevisível, então não é opcional nesses casos.
  window.ccChip = function (a, semLink) {
    if (!a.cc || !a.cc.tipo) return "";
    if (a.cc.tipo === "no") {
      // título do nó (data/nos.js) como tooltip — item 4 do plano de melhorias de
      // navegação (26/08): o nome que aparece no Dashboard/Caminho crítico (ex.
      // "Devolutiva da URC sobre a grade") costuma ser diferente do título da própria
      // ação, então o badge sozinho ("★ Nó 1") não deixava essa ligação visível.
      const no = ((DB.nos && DB.nos.nos) || []).find((n) => n.no === a.cc.no);
      const tituloAttr = no ? ' title="Nó ' + a.cc.no + ' — ' + esc(no.titulo) + '"' : "";
      return semLink
        ? ' <span class="chip cc"' + tituloAttr + ">★ Nó " + a.cc.no + "</span>"
        : ' <a class="chip cc" href="caminho.html#no' + a.cc.no + '"' + tituloAttr + ">★ Nó " + a.cc.no + "</a>";
    }
    if (a.cc.tipo === "cadeia") return ' <span class="chip cc">cadeia ' + a.cc.no + "</span>";
    if (a.cc.tipo === "sla") return ' <span class="chip sla">◆ SLA</span>';
    return "";
  };

  window.montarShell = function (paginaAtual) {
    const nav = document.querySelector(".nav");
    if (!nav) return;
    const cfg = DB.config || { projeto: "Carta de Corso", versao: "dev", atualizado_em: "" };
    let html = '<div class="marca">' + esc(cfg.projeto || "Carta de Corso") + "<small>" + esc(cfg.subtitulo || "") + "</small></div>";
    html += '<button type="button" class="nav-toggle" id="nav-toggle" aria-expanded="true">« Ocultar menu</button>';
    for (const grupo of GRUPOS) {
      html += '<div class="grupo-titulo">' + esc(grupo.titulo) + "</div>";
      for (const [href, rotulo] of grupo.paginas) {
        const ativo = href === paginaAtual ? ' class="ativo" aria-current="page"' : "";
        html += '<a href="' + href + '"' + ativo + ">" + rotulo + "</a>";
      }
    }
    nav.innerHTML = html;
    if (!nav.id) nav.id = "menu-principal";

    montarMenuMobile(nav, cfg);
    montarColapsavel(nav);
  };

  // sidebar colapsável (desktop) — sugestão registrada em BACKLOG.md ("Sidebar
  // compacta/colapsável"): mais espaço horizontal útil pra páginas com tabela larga
  // (Matriz do Corsário — 19 colunas de critério — e Matriz de demandas), que hoje
  // dependem de scroll horizontal por disputarem espaço com o menu lateral fixo.
  // Estado por NAVEGADOR via localStorage (uma chave só, não por página) — colapsar
  // numa tela vale em todas as outras ao navegar, já que aqui cada página é um
  // carregamento novo, não uma SPA. Só desktop: abaixo de 768px o mecanismo já é
  // outro (menu hambúrguer, montarMenuMobile acima) e não deve competir com este —
  // ver a media query min-width:768px em css/base.css.
  const CHAVE_NAV_COLAPSADA = "cc_nav_colapsada";
  function montarColapsavel(nav) {
    const shell = nav.closest(".shell");
    if (!shell) return;
    const toggle = nav.querySelector("#nav-toggle");
    let reabrir = document.querySelector(".nav-reabrir");
    if (!reabrir) {
      // sempre reconstruído no <nav> (que é limpo/reescrito a cada montarShell), mas o
      // botão de reabrir fica FORA dele de propósito — precisa continuar clicável mesmo
      // com a coluna do menu em largura 0 (ver .shell.nav-colapsada em css/base.css).
      reabrir = document.createElement("button");
      reabrir.type = "button";
      reabrir.className = "nav-reabrir";
      reabrir.setAttribute("aria-label", "Mostrar menu lateral");
      reabrir.textContent = "» Menu";
      document.body.appendChild(reabrir);
    }
    function aplicar(colapsada) {
      shell.classList.toggle("nav-colapsada", colapsada);
      if (toggle) toggle.setAttribute("aria-expanded", String(!colapsada));
    }
    let colapsada = false;
    try {
      colapsada = localStorage.getItem(CHAVE_NAV_COLAPSADA) === "1";
    } catch (e) {
      // localStorage indisponível (file://, modo privado) — sem persistência entre
      // páginas, mas o toggle continua funcionando dentro da mesma página.
    }
    aplicar(colapsada);
    function alternar(novoEstado) {
      aplicar(novoEstado);
      try { localStorage.setItem(CHAVE_NAV_COLAPSADA, novoEstado ? "1" : "0"); } catch (e) { /* ver acima */ }
    }
    if (toggle) toggle.addEventListener("click", () => alternar(true));
    reabrir.addEventListener("click", () => alternar(false));
  }

  // item 2.5 do plano de melhorias — abaixo de 768px o sidebar vira menu hambúrguer.
  // Header + backdrop são injetados aqui (uma vez por página, dentro do .shell que já
  // existe em toda página do painel) — zero mudança de HTML por página só pra isso; o
  // conteúdo do <nav> continua o mesmo de sempre (marca/grupos/links/rodapé), só a
  // POSIÇÃO dele muda em telas estreitas (position:fixed + transform, ver css/base.css).
  function montarMenuMobile(nav, cfg) {
    const shell = nav.closest(".shell");
    if (!shell || shell.querySelector(".mob-header")) return; // já montado (ex.: 2ª chamada na mesma página)

    const header = document.createElement("div");
    header.className = "mob-header";
    header.innerHTML =
      '<span>' + esc(cfg.projeto || "Carta de Corso") + "</span>" +
      '<button type="button" class="mob-menu-btn" aria-label="Abrir menu" aria-expanded="false" aria-controls="' + nav.id + '">☰ Menu</button>';

    const backdrop = document.createElement("div");
    backdrop.className = "mob-backdrop";

    shell.insertBefore(header, nav);
    shell.insertBefore(backdrop, nav);

    const btn = header.querySelector(".mob-menu-btn");

    function abrir() {
      nav.classList.add("aberto");
      backdrop.classList.add("show");
      btn.setAttribute("aria-expanded", "true");
      btn.textContent = "✕ Fechar";
      document.body.style.overflow = "hidden"; // trava o scroll do fundo com o menu aberto
    }
    function fechar() {
      nav.classList.remove("aberto");
      backdrop.classList.remove("show");
      btn.setAttribute("aria-expanded", "false");
      btn.textContent = "☰ Menu";
      document.body.style.overflow = "";
    }
    function alternar() {
      if (nav.classList.contains("aberto")) fechar(); else abrir();
    }

    btn.addEventListener("click", alternar);
    backdrop.addEventListener("click", fechar);
    // fecha ao navegar (o clique num link de outra página já dispara o carregamento da
    // página nova — isso só evita o "flash" do menu ainda aberto durante a transição)
    nav.addEventListener("click", (e) => { if (e.target.closest("a")) fechar(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") fechar(); });
  }
})();
