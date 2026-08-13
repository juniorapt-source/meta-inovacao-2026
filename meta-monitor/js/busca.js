/* Busca global client-side (item 2.6 do plano de melhorias) — window.BUSCA.
 *
 * Duas partes bem separadas, de propósito:
 *   - índice + filtro (construirIndice/buscar): funções puras sobre window.DB, sem DOM,
 *     testáveis em node (mesmo padrão de js/calc.js / js/responsaveis.js).
 *   - UI (montarCampo/montarNaPagina): DOM, só roda no navegador.
 *
 * Entidades indexadas: ações do plano (id/atividade/responsável), iniciativas
 * (data/projetos.js), pessoas (a lista canônica de data/pessoas.js.responsaveis — não a
 * window.DB.pessoas "crua", que repete nome em papéis diferentes sem id estável pra
 * linkar), nós do caminho crítico, encontros da agenda.
 */
(function (root) {
  "use strict";

  // mesma normalização de js/responsaveis.js (acento fora, minúsculo, sem pontuação) —
  // duplicada aqui de propósito: os dois módulos são pequenos e independentes, não vale
  // a pena criar uma dependência cruzada só por causa de uma função de 3 linhas.
  function normalizar(s) {
    return String(s == null ? "" : s)
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
  }

  function fmtBR(iso) {
    if (!iso) return "";
    if (root.CALC && root.CALC.fmtBR) return root.CALC.fmtBR(iso);
    const [, m, d] = String(iso).split("-");
    return d + "/" + m;
  }

  // constrói o índice em memória a partir de window.DB — chamar de novo sempre que
  // precisar de dados atualizados (não há cache: o site inteiro já não cacheia window.DB,
  // ver o comentário equivalente em index.html sobre os cards de KPI).
  function construirIndice(DB) {
    DB = DB || {};
    const itens = [];

    (DB.plano || []).forEach((a) => {
      itens.push({
        tipo: "acao",
        rotulo: a.id + " — " + a.atividade,
        sub: a.frente || "",
        href: "plano.html?q=" + encodeURIComponent(a.id) + "#" + a.id,
        chave: normalizar(a.id + " " + a.atividade + " " + (a.resp || "")),
      });
    });

    (DB.projetos || []).forEach((p) => {
      itens.push({
        tipo: "iniciativa",
        rotulo: p.iniciativa,
        sub: p.nucleo || "",
        // visão CARDS do Corsário (pedido explícito) com a busca preenchida — corsario.html
        // lê ?q= e prefixa elBusca.value antes do primeiro render (ver aplicarHash lá)
        href: "corsario.html?q=" + encodeURIComponent(p.iniciativa) + "#cards",
        chave: normalizar(p.iniciativa + " " + (p.nucleo || "") + " " + (p.representantes || []).join(" ")),
      });
    });

    // fonte canônica de pessoa pra busca é data/pessoas.js.responsaveis (id estável) —
    // não window.DB.pessoas, que tem o mesmo nome repetido em registros de papel
    // diferente (Comitê/Núcleos) sem id pra linkar de forma inequívoca.
    (DB.responsaveis || []).forEach((p) => {
      itens.push({
        tipo: "pessoa",
        rotulo: p.nome,
        sub: p.grupo || "",
        href: "minhas-acoes.html?pessoa=" + encodeURIComponent(p.id),
        chave: normalizar(p.nome),
      });
    });

    ((DB.nos && DB.nos.nos) || []).forEach((n) => {
      itens.push({
        tipo: "no",
        rotulo: "Nó " + n.no + " — " + n.titulo,
        sub: n.data || "",
        href: "caminho.html#no" + n.no,
        chave: normalizar("no " + n.no + " " + n.titulo + " " + (n.guardiao || "")),
      });
    });

    const porCanal = Object.fromEntries((DB.canais || []).map((c) => [c.id, c]));
    const porCiclo = Object.fromEntries(((DB.agenda && DB.agenda.ciclos) || []).map((c) => [c.id, c]));
    ((DB.agenda && DB.agenda.encontros) || []).forEach((e) => {
      const canal = porCanal[e.canal];
      const ciclo = porCiclo[e.ciclo];
      const nomeCanal = canal ? canal.nome : e.canal;
      const nomeCiclo = ciclo ? ciclo.nome : e.ciclo;
      itens.push({
        tipo: "encontro",
        rotulo: nomeCanal + " · " + nomeCiclo,
        sub: e.data ? fmtBR(e.data) + "/2026" : "a agendar",
        href: "agenda.html#" + e.id,
        chave: normalizar(nomeCanal + " " + nomeCiclo + " " + (e.data || "") + " " + e.status),
      });
    });

    return itens;
  }

  // agrupa por tipo, no máximo `porGrupo` itens cada (default 5) — grupos vazios não
  // entram no objeto de retorno (mais fácil pra UI saber o que renderizar).
  function buscar(indice, termo, porGrupo) {
    const alvo = normalizar(termo);
    const limite = porGrupo || 5;
    if (!alvo) return {};
    const grupos = {};
    (indice || []).forEach((item) => {
      if (item.chave.indexOf(alvo) === -1) return;
      const lista = grupos[item.tipo] || (grupos[item.tipo] = []);
      if (lista.length < limite) lista.push(item);
    });
    return grupos;
  }

  const BUSCA = { normalizar: normalizar, construirIndice: construirIndice, buscar: buscar };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = BUSCA;
  } else {
    root.BUSCA = BUSCA;
    montarQuandoPronto();
  }

  // ---- UI (só roda no navegador — o bloco acima já expôs tudo que é testável em node) ----

  const ORDEM_GRUPOS = ["acao", "iniciativa", "pessoa", "no", "encontro"];
  const ROTULO_GRUPO = { acao: "Ações", iniciativa: "Iniciativas", pessoa: "Pessoas", no: "Nós", encontro: "Encontros" };

  function escLocal(s) {
    return root.esc ? root.esc(s) : String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function montarQuandoPronto() {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", montarNaPagina);
    else montarNaPagina();
  }

  // monta os DOIS pontos de entrada pedidos (sidebar desktop + header mobile) — o do
  // sidebar mora dentro de <nav> (window.montarShell, js/core.js, já a monta antes deste
  // script no DOM); o do header mobile é injetado aqui do zero (mesmo raciocínio de
  // "zero mudança de HTML por página" do menu hambúrguer da v0.13.0).
  function montarNaPagina() {
    let indice = [];
    function reconstruirIndice() { indice = construirIndice(root.DB || {}); }
    reconstruirIndice();

    const nav = document.querySelector(".nav");
    let controladorNav = null;
    if (nav) controladorNav = montarCampoNoNav(nav, () => indice);

    const mobHeader = document.querySelector(".mob-header");
    let controladorMobile = null;
    if (mobHeader) controladorMobile = montarCampoMobile(mobHeader, () => indice, nav);

    // atalho global "/" — foca a busca certa pro viewport atual, sem roubar o "/" de
    // dentro de um campo de texto (input/textarea/select/contenteditable) já focado
    document.addEventListener("keydown", (e) => {
      if (e.key !== "/" || e.defaultPrevented) return;
      const alvo = e.target;
      const emCampo = alvo && (alvo.tagName === "INPUT" || alvo.tagName === "TEXTAREA" || alvo.tagName === "SELECT" || alvo.isContentEditable);
      if (emCampo) return;
      e.preventDefault();
      const mobileAtivo = root.matchMedia && root.matchMedia("(max-width:767px)").matches;
      if (mobileAtivo && controladorMobile) controladorMobile.abrirEFocar();
      else if (controladorNav) controladorNav.focar();
    });

    // window.DB pode ganhar dados novos depois do carregamento (ex.: plano-acao.html
    // carrega Supabase à parte) — nada aqui depende disso ficar 100% em dia em tempo
    // real; reconstrói só quando o campo é focado, custo desprezível pro tamanho do índice
    if (controladorNav) controladorNav.aoFocar(reconstruirIndice);
    if (controladorMobile) controladorMobile.aoFocar(reconstruirIndice);
  }

  function htmlResultados(grupos) {
    const gruposComItens = ORDEM_GRUPOS.filter((t) => grupos[t] && grupos[t].length);
    if (!gruposComItens.length) return '<div class="busca-vazio">Nada encontrado.</div>';
    return gruposComItens.map((tipo) =>
      '<div class="busca-grupo-titulo">' + ROTULO_GRUPO[tipo] + "</div>" +
      grupos[tipo].map((item) =>
        '<a class="busca-item" href="' + item.href + '" data-tipo="' + tipo + '">' +
          '<span class="busca-item-rotulo">' + escLocal(item.rotulo) + "</span>" +
          (item.sub ? '<span class="busca-item-sub">' + escLocal(item.sub) + "</span>" : "") +
        "</a>"
      ).join("")
    ).join("");
  }

  // controlador genérico: liga um <input> a um container de resultados — usado duas
  // vezes (nav e mobile) com o mesmo comportamento de navegação por teclado.
  function ligarControlador(input, resultadosEl, obterIndice) {
    let selecionado = -1;

    function itensVisiveis() { return Array.from(resultadosEl.querySelectorAll("a.busca-item")); }

    function atualizarSelecao() {
      itensVisiveis().forEach((a, i) => a.classList.toggle("selecionado", i === selecionado));
    }

    function render() {
      const termo = input.value.trim();
      selecionado = -1;
      if (!termo) { resultadosEl.hidden = true; resultadosEl.innerHTML = ""; return; }
      const grupos = buscar(obterIndice(), termo);
      resultadosEl.innerHTML = htmlResultados(grupos);
      resultadosEl.hidden = false;
    }

    function fechar() { resultadosEl.hidden = true; selecionado = -1; }

    input.addEventListener("input", render);
    input.addEventListener("focus", () => { if (input.value.trim()) render(); });
    input.addEventListener("keydown", (e) => {
      const itens = itensVisiveis();
      if (e.key === "ArrowDown") {
        if (!itens.length) return;
        e.preventDefault();
        selecionado = (selecionado + 1) % itens.length;
        atualizarSelecao();
        itens[selecionado].scrollIntoView({ block: "nearest" });
      } else if (e.key === "ArrowUp") {
        if (!itens.length) return;
        e.preventDefault();
        selecionado = (selecionado - 1 + itens.length) % itens.length;
        atualizarSelecao();
        itens[selecionado].scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") {
        const alvo = selecionado >= 0 ? itens[selecionado] : itens[0];
        if (alvo) { e.preventDefault(); root.location.href = alvo.getAttribute("href"); }
      } else if (e.key === "Escape") {
        fechar();
        input.blur();
      }
    });
    document.addEventListener("click", (e) => {
      if (!resultadosEl.contains(e.target) && e.target !== input) fechar();
    });

    return { render: render, fechar: fechar, input: input };
  }

  function montarCampoNoNav(nav, obterIndice) {
    const wrap = document.createElement("div");
    wrap.className = "busca-nav";
    wrap.innerHTML =
      '<input type="search" class="busca-input" id="busca-input-nav" placeholder="Buscar… ( / )" aria-label="Busca global" autocomplete="off">' +
      '<div class="busca-resultados" id="busca-resultados-nav" hidden></div>';
    const marca = nav.querySelector(".marca");
    if (marca && marca.nextSibling) nav.insertBefore(wrap, marca.nextSibling);
    else nav.insertBefore(wrap, nav.firstChild);

    const input = wrap.querySelector(".busca-input");
    const resultadosEl = wrap.querySelector(".busca-resultados");
    const ctrl = ligarControlador(input, resultadosEl, obterIndice);

    return {
      focar() { input.focus(); },
      aoFocar(cb) { input.addEventListener("focus", cb, { once: false }); },
    };
  }

  function montarCampoMobile(mobHeader, obterIndice, nav) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "mob-busca-btn";
    btn.setAttribute("aria-label", "Buscar");
    btn.textContent = "🔍";

    const menuBtn = mobHeader.querySelector(".mob-menu-btn");
    mobHeader.insertBefore(btn, menuBtn);

    const painel = document.createElement("div");
    painel.className = "mob-busca-painel";
    painel.hidden = true;
    painel.innerHTML =
      '<input type="search" class="busca-input" id="busca-input-mobile" placeholder="Buscar…" aria-label="Busca global" autocomplete="off">' +
      '<button type="button" class="mob-busca-fechar" aria-label="Fechar busca">✕</button>' +
      '<div class="busca-resultados" id="busca-resultados-mobile" hidden></div>';
    mobHeader.parentNode.insertBefore(painel, mobHeader.nextSibling);

    const input = painel.querySelector(".busca-input");
    const resultadosEl = painel.querySelector(".busca-resultados");
    const fecharBtn = painel.querySelector(".mob-busca-fechar");
    const ctrl = ligarControlador(input, resultadosEl, obterIndice);

    function abrir() {
      // fecha o menu hambúrguer se estiver aberto — os dois painéis não fazem sentido
      // abertos ao mesmo tempo na mesma tela estreita
      if (nav) nav.classList.remove("aberto");
      const backdrop = document.querySelector(".mob-backdrop");
      if (backdrop) backdrop.classList.remove("show");
      painel.hidden = false;
    }
    function fechar() {
      painel.hidden = true;
      ctrl.fechar();
      input.value = "";
      resultadosEl.hidden = true;
    }

    btn.addEventListener("click", () => { abrir(); input.focus(); });
    fecharBtn.addEventListener("click", fechar);

    return {
      abrirEFocar() { abrir(); input.focus(); },
      aoFocar(cb) { input.addEventListener("focus", cb, { once: false }); },
    };
  }
})(this);
