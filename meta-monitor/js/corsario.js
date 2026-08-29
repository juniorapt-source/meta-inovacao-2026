/* corsario.html — "O Caminho para o Corsário": visão Cards + Matriz da aderência de cada
 * iniciativa ao ecossistema oficial (régua de pesos por critério, calculada aqui mesmo).
 *
 * D6.3 de docs/PLANO_EXECUCAO_DEBITOS_TECNICOS.md (29/08/2026) — extração do JS inline de
 * corsario.html pra este arquivo, mesmo padrão de editor.html/js/editor-*.js (BACKLOG.md,
 * "editor.html grande demais"): uma tela grande com <script> inline vira um arquivo
 * próprio, código idêntico, sem mudar comportamento nenhum. Diferente de editor.html
 * (8 abas, cada uma virou módulo), corsario.html é uma tela só — já era um único IIFE
 * autocontido, sem helper compartilhado com outra página — então move de uma vez, numa
 * etapa só, como o plano previa.
 *
 * Só leitura — diferente da aba "O Caminho para o Corsário" de editor.html
 * (js/editor-corsario.js, que EDITA status ao vivo), esta página só busca
 * corsario_criterios/corsario_status direto do PostgREST (fetch cru, sem
 * js/db-corsario.js) e calcula a régua no cliente.
 *
 * Depende de globais já carregados por corsario.html antes deste <script> (esc/montarShell
 * de js/core.js, DRAWER de js/drawer.js, window.APP_CONFIG de js/config.js,
 * window.CC_SUPABASE de js/supabase.js) — nenhum helper próprio é exposto em window,
 * porque nenhuma outra tela consome nada daqui.
 */
(function () {
  "use strict";
  montarShell("corsario.html");

  /* Reaproveita window.APP_CONFIG (js/config.js) — já usado por demandas.html e
     plano-acao.html pra falar com o mesmo projeto Supabase compartilhado. Os
     placeholders só entram em jogo se, por algum motivo, js/config.js não tiver
     carregado; troque em Supabase → Project Settings → API se um dia for preciso
     apontar pra outro projeto. */
  const SUPABASE_URL = (window.APP_CONFIG && window.APP_CONFIG.SUPABASE_URL) || "COLE_AQUI_A_URL";
  const SUPABASE_ANON_KEY = (window.APP_CONFIG && window.APP_CONFIG.SUPABASE_ANON_KEY) || "COLE_AQUI_A_ANON_KEY";

  async function buscar(tabela, params) {
    const url = SUPABASE_URL + "/rest/v1/" + tabela + "?select=*" + (params || "");
    // header x-cc-token (item 2.1) — esta página só lê (corsario_criterios/corsario_status
    // continuam SELECT público na RLS nova), então funciona igual com ou sem; manda
    // quando window.CC_SUPABASE carregou, por consistência com o resto do site.
    const headers = Object.assign({ apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY },
      window.CC_SUPABASE ? window.CC_SUPABASE.headersComToken() : {});
    const r = await fetch(url, { headers: headers });
    if (!r.ok) {
      // PostgREST devolve {message, hint} no corpo (ex.: GRANT faltando pro role anon) —
      // repassa isso no erro em vez de só "HTTP 401", que é o de fato acionável pra quem for corrigir.
      let detalhe = "HTTP " + r.status;
      try {
        const corpo = await r.json();
        if (corpo && corpo.message) detalhe = corpo.message + (corpo.hint ? " — " + corpo.hint : "");
      } catch (e) { /* corpo não era JSON — mantém o HTTP status como detalhe */ }
      throw new Error(tabela + ": " + detalhe);
    }
    return r.json();
  }

  function normalizar(s) {
    return String(s == null ? "" : s).trim().toLowerCase();
  }

  /* ---- a régua (não mexer sem revalidar contra o card da ALI Ecossistema) ---- */
  const PESOS = { "ok": 1, "ajuste em andamento": 0.7, "a iniciar": 0.4, "em entendimento": 0.2 };
  const REGRA_OURO_TEXTO = "Como calculamos? \"Não se aplica\" não reduz a adequação — a média considera apenas os itens aplicáveis à iniciativa. 100% significa ok em tudo que se aplica.";

  function calcular(listaDeStatus) {
    const aplicaveis = listaDeStatus.filter((s) => s !== "não se aplica");
    if (aplicaveis.length === 0) return { pct: null, patente: "Fora da régua", aplicaveis: 0 };
    const pct = aplicaveis.reduce((soma, s) => soma + (PESOS[s] || 0), 0) / aplicaveis.length;
    const patente = pct >= 0.995 ? "Corsário"
      : pct >= 0.75 ? "Capitão"
      : pct >= 0.5 ? "Timoneiro"
      : pct >= 0.25 ? "Marujo" : "Grumete";
    return { pct: pct, patente: patente, aplicaveis: aplicaveis.length };
  }

  const ORDEM_PATENTES = ["Grumete", "Marujo", "Timoneiro", "Capitão", "Corsário"];
  // faixa/descrição de cada patente — alimenta o tooltip de cada chip de patente na faixa
  // de gamificação (antes era texto fixo na Legenda do rodapé)
  const INFO_PATENTES = {
    "Grumete": { faixa: "0–24%", desc: "embarcou; ainda mapeando o próprio navio" },
    "Marujo": { faixa: "25–49%", desc: "primeiras entregas dentro do ecossistema" },
    "Timoneiro": { faixa: "50–74%", desc: "mais da metade da rota navegada" },
    "Capitão": { faixa: "75–99%", desc: "reta final; faltam poucos itens" },
    "Corsário": { faixa: "100%", desc: "carta de corso emitida: iniciativa integralmente no ecossistema oficial" },
  };
  const CLASSE_STATUS = {
    "ok": "crs-st-ok",
    "ajuste em andamento": "crs-st-andamento",
    "a iniciar": "crs-st-iniciar",
    "em entendimento": "crs-st-entendimento",
  };
  // rótulo do chip de status na Matriz/detalhe do card — por extenso e consistente
  // (elimina a abreviação "entend." que convivia com "em entendimento" na versão anterior)
  const ROTULO_CHIP_STATUS = {
    "ok": "ok",
    "ajuste em andamento": "em andamento",
    "a iniciar": "a iniciar",
    "em entendimento": "entendimento",
  };
  // cores por núcleo: em vez dos tons vivos da planilha-fonte (usados só pra status de
  // critério, que precisa bater com a origem), reaproveita a família "carta náutica" já
  // definida em css/base.css — mesma lógica de matiz (azul/verde/roxo/laranja), só que
  // lavada pra tinta de papel antigo, coerente com o resto do site.
  const NUCLEO_CORES = {
    "inovação para competitividade": { cor: "var(--prog)", fundo: "var(--prog-w)" },   // azul
    "inovação territorial": { cor: "var(--ok)", fundo: "var(--ok-w)" },                // verde
    "startups": { cor: "var(--sla)", fundo: "var(--sla-w)" },                          // roxo/malva
    "tecnologias portadoras de futuro": { cor: "var(--cc)", fundo: "var(--cc-w)" },    // laranja/terracota
  };
  const ORDEM_NUCLEOS = Object.keys(NUCLEO_CORES);

  // cabeçalhos curtos da Matriz (refactor v0.21) — nomenclatura definida junto com o JR.;
  // a definição completa (usada no tooltip de cada coluna, data-tip) fica em
  // DESCRICOES_MATRIZ logo abaixo. Ordem batendo com o_caminho_para_o_corsario_v3.xlsx
  // (aba "Jornada", linha 2); a régua e os cards de detalhe continuam lendo `rotulo` cru
  // do banco normalmente — só o cabeçalho da Matriz usa este mapa.
  const ROTULOS_MATRIZ = {
    base_foco: "Clientes no Foco",
    instrumentos: "Instrumentos",
    solucao: "Solução",
    atend_foco: "Atendimentos no Foco",
    painel_dw: "Acompanhamento no DW/Foco",
    campanha_foco: "Campanha no Foco",
    portal: "Site no Portal",
    lp_mc: "LP no Mkt Cloud",
    captura_mc: "Captura de lead Mkt Cloud",
    transbordo_mc: "Transbordo Mkt/Foco",
    transbordo_ufs: "Transbordo para as UFs",
    email_mc: "E-mail Mkt Cloud",
    whats_mc: "WhatsApp Mkt Cloud",
    jornadas_mc: "Jornadas",
    loja: "Loja",
    cnr_receptiva: "CNR Receptiva",
    cnr_ativa: "CNR Ativa",
    assessoria: "Assessoria",
    rede: "Rede de atendimento",
  };
  const DESCRICOES_MATRIZ = {
    base_foco: "Base de clientes centralizada/integrada ao Foco.",
    instrumentos: "Adequação dos instrumentos necessários à iniciativa.",
    solucao: "Solução prevista criada/registrada no sistema.",
    atend_foco: "Atendimentos registrados/integrados ao Foco.",
    painel_dw: "Painel de acompanhamento dos atendimentos no Foco/DW.",
    campanha_foco: "Campanha da iniciativa criada no Foco.",
    portal: "Site da iniciativa publicado no portal Sebrae.",
    lp_mc: "Formulários em LP do Mkt Cloud.",
    captura_mc: "Captura de lead/clientes pelo Mkt Cloud.",
    transbordo_mc: "Transbordo do Mkt Cloud para o Foco.",
    transbordo_ufs: "Transbordo de leads/clientes para as UFs.",
    email_mc: "Disparo de e-mail via Mkt Cloud.",
    whats_mc: "Disparo de WhatsApp via Mkt Cloud.",
    jornadas_mc: "Jornadas via Mkt Cloud.",
    loja: "Uso da Loja.",
    cnr_receptiva: "CNR Receptiva.",
    cnr_ativa: "CNR Ativa.",
    assessoria: "Parceria com Assessoria de Negócios.",
    rede: "Parceria com a rede própria e parceira.",
  };

  function rotuloColunaMatriz(c) {
    if (ROTULOS_MATRIZ[c.chave]) return ROTULOS_MATRIZ[c.chave];
    const r = c.rotulo || c.chave || ""; // critério novo, sem mapeamento — cai pro rótulo cru do banco, truncado, nunca quebra
    return r.length > 40 ? r.slice(0, 39) + "…" : r;
  }

  function descricaoColunaMatriz(c) {
    return DESCRICOES_MATRIZ[c.chave] || c.rotulo || c.chave || "";
  }

  function corNucleo(nome) {
    return NUCLEO_CORES[normalizar(nome)] || { cor: "var(--grafite)", fundo: "var(--neutro-w)" };
  }

  function fmtPct(p) {
    if (p === null || p === undefined) return "—";
    return (p * 100).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "%";
  }

  const elEstado = document.getElementById("crs-estado");
  const elFrota = document.getElementById("crs-frota-wrap");
  const elToolbar = document.getElementById("crs-toolbar");
  const elSegmento = document.getElementById("crs-segmento");
  const elDdNucleosBtn = document.getElementById("crs-dd-nucleos-btn");
  const elDdNucleosPainel = document.getElementById("crs-dd-nucleos-painel");
  const elDdPatentesBtn = document.getElementById("crs-dd-patentes-btn");
  const elDdPatentesPainel = document.getElementById("crs-dd-patentes-painel");
  const elLimpar = document.getElementById("crs-limpar");
  const elBusca = document.getElementById("crs-busca");
  const elOrdenar = document.getElementById("crs-ordenar");
  const elLegendaBtn = document.getElementById("crs-legenda-btn");
  const elLegendaPop = document.getElementById("crs-legenda-pop");
  const elGrid = document.getElementById("crs-grid");
  const elMatrizWrap = document.getElementById("crs-matriz-wrap");
  const elMatriz = document.getElementById("crs-matriz");
  const elAvisoMobile = document.getElementById("crs-aviso-mobile");
  const elContagem = document.getElementById("crs-contagem");

  let TODAS = [];      // uma entrada por iniciativa, com os status já carregados e a régua já calculada
  let GRUPOS = [];     // critérios agrupados por `grupo`, na ordem de `ordem` — usado pelo detalhe dos cards
  let CRITERIOS = [];  // os mesmos critérios, em lista plana e na ordem de `ordem` — usado pelas colunas da matriz
  let filtroNucleos = new Set();  // vazio = todos; valores normalizados (normalizar(x.nucleo))
  let filtroPatentes = new Set(); // vazio = todas; valores = ORDEM_PATENTES
  let gruposColapsados = new Set(); // núcleos (normalizados) com a linha de grupo recolhida na Matriz
  let visao = "cards";   // "cards" | "matriz" — espelhado em location.hash

  // ---- persistência leve (P1-4/P1-3) — chaves namespaced, mesma convenção do resto do
  // site; busca NÃO persiste (de propósito — é um filtro de sessão, não de preferência) ----
  const LS_FILTROS = "cc_corsario_filtros";
  const LS_GRUPOS = "cc_corsario_grupos";

  function carregarFiltrosPersistidos() {
    try {
      const raw = localStorage.getItem(LS_FILTROS);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; } // localStorage indisponível (modo privado etc.) — segue sem persistir
  }
  function salvarFiltrosPersistidos() {
    try {
      localStorage.setItem(LS_FILTROS, JSON.stringify({
        nucleos: Array.from(filtroNucleos),
        patentes: Array.from(filtroPatentes),
        ordenar: elOrdenar.value,
      }));
    } catch (e) { /* idem — falha ao salvar não quebra o filtro em uso, só não persiste */ }
  }
  function carregarGruposColapsados() {
    try {
      const raw = localStorage.getItem(LS_GRUPOS);
      if (raw) gruposColapsados = new Set(JSON.parse(raw));
    } catch (e) { /* segue com todos expandidos (estado default) */ }
  }
  function salvarGruposColapsados() {
    try { localStorage.setItem(LS_GRUPOS, JSON.stringify(Array.from(gruposColapsados))); } catch (e) { /* ver acima */ }
  }

  (function aplicarPersistidoInicial() {
    carregarGruposColapsados();
    const salvo = carregarFiltrosPersistidos();
    if (!salvo) return;
    (salvo.nucleos || []).forEach((n) => filtroNucleos.add(n));
    (salvo.patentes || []).forEach((p) => filtroPatentes.add(p));
    if (salvo.ordenar) elOrdenar.value = salvo.ordenar;
  })();

  // ---- tooltip acessível único (P1-1) — delegado em [data-tip], funciona por hover E
  // por foco de teclado; aria-describedby aponta pro nó flutuante compartilhado ----
  function initTooltip() {
    const tip = document.createElement("div");
    tip.className = "crs-tip";
    tip.id = "crs-tip";
    tip.setAttribute("role", "tooltip");
    tip.hidden = true;
    document.body.appendChild(tip);
    let alvo = null;

    function posicionar(el) {
      const r = el.getBoundingClientRect();
      tip.style.left = "0px";
      tip.style.top = "0px";
      const tr = tip.getBoundingClientRect();
      let left = r.left + r.width / 2 - tr.width / 2;
      left = Math.max(8, Math.min(left, window.innerWidth - tr.width - 8));
      let top = r.top - tr.height - 8;
      if (top < 8) top = r.bottom + 8; // sem espaço em cima (ex.: cabeçalho da Matriz) — mostra embaixo
      tip.style.left = left + "px";
      tip.style.top = top + "px";
    }
    function mostrar(el) {
      const texto = el.getAttribute("data-tip");
      if (!texto) return;
      tip.textContent = texto;
      tip.hidden = false;
      el.setAttribute("aria-describedby", "crs-tip");
      alvo = el;
      posicionar(el);
    }
    function esconder() {
      tip.hidden = true;
      if (alvo) alvo.removeAttribute("aria-describedby");
      alvo = null;
    }
    document.addEventListener("mouseover", (e) => { const el = e.target.closest("[data-tip]"); if (el) mostrar(el); });
    document.addEventListener("mouseout", (e) => {
      const el = e.target.closest("[data-tip]");
      if (el && !el.contains(e.relatedTarget)) esconder();
    });
    document.addEventListener("focusin", (e) => { const el = e.target.closest("[data-tip]"); if (el) mostrar(el); });
    document.addEventListener("focusout", (e) => { const el = e.target.closest("[data-tip]"); if (el) esconder(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") esconder(); });
    window.addEventListener("scroll", () => { if (alvo) posicionar(alvo); }, true);
  }

  // ---- popover genérico (P1-2) — Legenda e os 2 dropdowns de filtro reaproveitam o
  // mesmo padrão: clique no botão abre/fecha; Esc e clique fora fecham ----
  function initPopover(btn, painel) {
    function abrir() {
      document.querySelectorAll(".crs-popover[data-aberto]").forEach((p) => { if (p !== painel) fecharPainel(p); });
      painel.hidden = false;
      painel.setAttribute("data-aberto", "");
      btn.setAttribute("aria-expanded", "true");
    }
    function fechar() { fecharPainel(painel); btn.setAttribute("aria-expanded", "false"); }
    function fecharPainel(p) { p.hidden = true; p.removeAttribute("data-aberto"); }
    btn.addEventListener("click", (e) => { e.stopPropagation(); painel.hidden ? abrir() : fechar(); });
    document.addEventListener("click", (e) => {
      if (!painel.hidden && !painel.contains(e.target) && e.target !== btn) fechar();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !painel.hidden) { fechar(); btn.focus(); }
    });
  }

  function mostrarSkeleton() {
    elToolbar.style.visibility = "hidden";
    elFrota.innerHTML = "";
    elGrid.innerHTML = "";
    elMatriz.innerHTML = "";
    elContagem.textContent = "";
    elEstado.innerHTML = '<div class="card" style="color:var(--grafite)">Carregando dados…</div>';
  }

  function mostrarErro(err) {
    elEstado.innerHTML =
      '<div class="crs-erro"><span><b>Não consegui falar com a base agora.</b> ' +
      esc((err && err.message) || String(err)) + '</span>' +
      '<button type="button" class="btn sec" id="crs-retry">Tentar de novo</button></div>';
    document.getElementById("crs-retry").addEventListener("click", carregar);
  }

  function processar(criterios, statusRows) {
    CRITERIOS = criterios; // já vem ordenado por `ordem` (fetch com &order=ordem) — fonte única pra cards e matriz
    GRUPOS = [];
    const idxGrupo = new Map();
    criterios.forEach((c) => {
      if (!idxGrupo.has(c.grupo)) {
        idxGrupo.set(c.grupo, GRUPOS.length);
        GRUPOS.push({ grupo: c.grupo, criterios: [] });
      }
      GRUPOS[idxGrupo.get(c.grupo)].criterios.push(c);
    });

    const porIniciativa = new Map();
    statusRows.forEach((r) => {
      const nome = r.iniciativa;
      if (!porIniciativa.has(nome)) porIniciativa.set(nome, { nome: nome, nucleo: r.nucleo, itens: [], ultimaAtualizacao: null });
      const ent = porIniciativa.get(nome);
      if (!ent.nucleo && r.nucleo) ent.nucleo = r.nucleo;
      const status = normalizar(r.status);
      ent.itens.push({ criterio: r.criterio, status: status, observacao: r.observacao, atualizado_em: r.atualizado_em });
      if (r.atualizado_em && (!ent.ultimaAtualizacao || r.atualizado_em > ent.ultimaAtualizacao)) ent.ultimaAtualizacao = r.atualizado_em;
    });

    TODAS = Array.from(porIniciativa.values()).map((ent) => {
      ent.calc = calcular(ent.itens.map((i) => i.status));
      return ent;
    });
    TODAS.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }

  function frotaHtml() {
    const comRegua = TODAS.filter((x) => x.calc.pct !== null);
    const media = comRegua.length ? comRegua.reduce((s, x) => s + x.calc.pct, 0) / comRegua.length : null;
    const foraDaRegua = TODAS.length - comRegua.length;

    const patentesHtml = ORDEM_PATENTES.map((p) => {
      const n = TODAS.filter((x) => x.calc.patente === p).length;
      const info = INFO_PATENTES[p];
      const tip = p + " · " + info.faixa + ": " + info.desc;
      return '<button type="button" class="crs-patente-chip' + (p === "Corsário" ? " crs-pat-corsario" : "") + '" data-patente="' + esc(p) + '" data-tip="' + esc(tip) + '" aria-pressed="' + (filtroPatentes.has(p) ? "true" : "false") + '">' +
        '<span class="nome">' + esc(p) + '</span><span class="n">' + n + '</span><span class="faixa">' + esc(info.faixa) + '</span>' +
      '</button>';
    }).join("");

    return '<div class="crs-frota-linha">' +
      '<div class="crs-frota-media"><div class="valor"><span class="n">' + fmtPct(media) + '</span>' +
        '<button type="button" class="crs-info-icone" aria-label="Como calculamos a adequação" data-tip="' + esc(REGRA_OURO_TEXTO) + '">ⓘ</button></div>' +
        '<div class="l">Adequação média da frota</div></div>' +
      '<div class="crs-frota-patentes" role="group" aria-label="Patentes — clique para filtrar">' + patentesHtml + '</div>' +
      (foraDaRegua ? '<div class="crs-frota-nota">' + foraDaRegua + (foraDaRegua === 1 ? " iniciativa fora" : " iniciativas fora") + ' da régua (nenhum critério aplicável).</div>' : "") +
    '</div>';
  }

  function atualizarPatentesAtivas() {
    elFrota.querySelectorAll(".crs-patente-chip[data-patente]").forEach((btn) => {
      const ativo = filtroPatentes.has(btn.dataset.patente);
      btn.classList.toggle("ativo", ativo);
      btn.setAttribute("aria-pressed", ativo ? "true" : "false");
    });
  }

  function montarDropdownPatentes() {
    elDdPatentesPainel.innerHTML =
      '<button type="button" class="crs-dd-todos" data-limpar-patentes>Todas as patentes</button>' +
      ORDEM_PATENTES.map((p) => '<label class="crs-dd-item"><input type="checkbox" value="' + esc(p) + '">' + esc(p) + '</label>').join("");
  }

  function montarDropdownNucleos() {
    const nucleos = Array.from(new Set(TODAS.map((x) => x.nucleo).filter(Boolean)));
    nucleos.sort((a, b) => {
      const ia = ORDEM_NUCLEOS.indexOf(normalizar(a));
      const ib = ORDEM_NUCLEOS.indexOf(normalizar(b));
      if (ia === -1 && ib === -1) return a.localeCompare(b, "pt-BR");
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    elDdNucleosPainel.innerHTML =
      '<button type="button" class="crs-dd-todos" data-limpar-nucleos>Todos os núcleos</button>' +
      nucleos.map((n) => '<label class="crs-dd-item"><input type="checkbox" value="' + esc(normalizar(n)) + '">' +
        '<span class="crs-dd-marcador" style="background:' + corNucleo(n).cor + '"></span>' + esc(n) + '</label>').join("");
  }

  function sincronizarCheckboxes(painel, selecionados) {
    painel.querySelectorAll("input[type=checkbox]").forEach((chk) => { chk.checked = selecionados.has(chk.value); });
  }

  function atualizarBadgesFiltro() {
    elDdNucleosBtn.textContent = "Núcleos" + (filtroNucleos.size ? " · " + filtroNucleos.size : "");
    elDdPatentesBtn.textContent = "Patentes" + (filtroPatentes.size ? " · " + filtroPatentes.size : "");
  }

  function algumFiltroAtivo() {
    return filtroNucleos.size > 0 || filtroPatentes.size > 0 || elBusca.value.trim() !== "";
  }

  function limparFiltros() {
    filtroNucleos.clear();
    filtroPatentes.clear();
    elBusca.value = "";
    sincronizarCheckboxes(elDdNucleosPainel, filtroNucleos);
    sincronizarCheckboxes(elDdPatentesPainel, filtroPatentes);
    salvarFiltrosPersistidos();
    renderTudo();
  }

  // clicar numa patente da faixa de gamificação equivale a marcar só ela no dropdown
  // "Patentes" (D3) — clique de novo na mesma desfaz o filtro
  function alternarFiltroPatente(p) {
    if (filtroPatentes.size === 1 && filtroPatentes.has(p)) filtroPatentes.clear();
    else { filtroPatentes.clear(); filtroPatentes.add(p); }
    sincronizarCheckboxes(elDdPatentesPainel, filtroPatentes);
    salvarFiltrosPersistidos();
    renderTudo();
  }

  function chipCriterioHtml(l) {
    const rotulo = l.crit.rotulo;
    if (!l.item || l.item.status === "não se aplica") {
      return '<span class="crs-chip-crit crs-crit-na">' + esc(rotulo) + ' — fora da régua</span>';
    }
    const cls = CLASSE_STATUS[l.item.status] || "";
    const titulo = l.item.observacao ? ' title="' + esc(l.item.observacao) + '"' : "";
    return '<span class="crs-chip-crit ' + cls + '"' + titulo + '>' + esc(rotulo) + '</span>';
  }

  function detalheHtml(x) {
    const porChave = new Map(x.itens.map((i) => [i.criterio, i]));
    return GRUPOS.map((g) => {
      const linhas = g.criterios.map((c) => ({ crit: c, item: porChave.get(c.chave) }));
      const aplicaveis = linhas.filter((l) => l.item && l.item.status !== "não se aplica");
      const naoAplicaveis = linhas.filter((l) => !l.item || l.item.status === "não se aplica");
      const chips = aplicaveis.concat(naoAplicaveis).map(chipCriterioHtml).join("");
      return '<div class="crs-grupo"><div class="crs-grupo-titulo">' + esc(g.grupo) + '</div><div class="crs-grupo-chips">' + chips + '</div></div>';
    }).join("");
  }

  function cardHtml(x) {
    const calc = x.calc, pct = calc.pct;
    const nc = corNucleo(x.nucleo);
    const okCount = x.itens.filter((i) => i.status === "ok").length;
    const movimentoCount = x.itens.filter((i) => i.status === "ajuste em andamento" || i.status === "a iniciar").length;
    const barraOuAviso = pct === null
      ? '<div class="crs-fora-regua">Fora da régua — nenhum critério aplicável a esta iniciativa.</div>'
      : '<div class="crs-barra" role="img" aria-label="' + Math.round(pct * 100) + '% de adequação"><div class="crs-barra-fill" style="width:' + (Math.round(pct * 1000) / 10) + '%"></div></div>' +
        '<div class="crs-card-meta"><span class="crs-patente-badge' + (calc.patente === "Corsário" ? " crs-pat-corsario" : "") + '">' + esc(calc.patente) + '</span><span class="crs-pct">' + fmtPct(pct) + '</span></div>';

    return '<details class="card crs-card">' +
      '<summary>' +
        '<div class="crs-card-topo">' +
          '<div class="crs-card-nome">' + DRAWER.spanIniciativa(x.nome) + '</div>' +
          '<span class="crs-chip-nucleo" style="background:' + nc.fundo + ';color:' + nc.cor + '">' + esc(x.nucleo || "sem núcleo") + '</span>' +
        '</div>' +
        barraOuAviso +
        '<div class="crs-card-linha">' + okCount + ' de ' + calc.aplicaveis + ' aplicáveis em ok · ' + movimentoCount + ' em movimento</div>' +
      '</summary>' +
      '<div class="crs-detalhe">' + detalheHtml(x) + '</div>' +
    '</details>';
  }

  function comparador(a, b) {
    const modo = elOrdenar.value;
    if (modo === "nome_asc") return a.nome.localeCompare(b.nome, "pt-BR");
    if (modo === "nucleo") return (a.nucleo || "").localeCompare(b.nucleo || "", "pt-BR") || a.nome.localeCompare(b.nome, "pt-BR");
    // pct_desc (padrão) — "fora da régua" (pct null) vai pro fim
    return (b.calc.pct === null ? -1 : b.calc.pct) - (a.calc.pct === null ? -1 : a.calc.pct) || a.nome.localeCompare(b.nome, "pt-BR");
  }

  // fonte única do que aparece na tela — filtro de núcleo, filtro de patente, busca e
  // ordenação valem igual pras duas visões; cards e matriz só decidem COMO desenhar esta lista
  function listaFiltrada() {
    let lista = TODAS.slice();
    if (filtroNucleos.size) lista = lista.filter((x) => filtroNucleos.has(normalizar(x.nucleo)));
    if (filtroPatentes.size) lista = lista.filter((x) => filtroPatentes.has(x.calc.patente));
    const q = elBusca.value.trim().toLowerCase();
    if (q) lista = lista.filter((x) => x.nome.toLowerCase().includes(q));
    lista.sort(comparador);
    return lista;
  }

  function vazioHtml() {
    return '<div class="crs-vazio">Nenhuma iniciativa corresponde aos filtros. <button type="button" class="crs-limpar-inline" data-limpar-tudo>Limpar filtros</button></div>';
  }

  function renderGrid(lista) {
    elGrid.innerHTML = lista.length
      ? lista.map(cardHtml).join("")
      : '<div class="card">' + vazioHtml() + '</div>';
  }

  function celulaMatrizHtml(item, crit) {
    if (!item || item.status === "não se aplica") {
      return '<td class="crs-mz-td-crit crs-mz-na" title="' + esc(descricaoColunaMatriz(crit)) + ': não se aplica">n/a</td>';
    }
    const cls = CLASSE_STATUS[item.status] || "";
    const texto = ROTULO_CHIP_STATUS[item.status] || item.status;
    const tituloObs = item.observacao ? " — " + item.observacao : "";
    return '<td class="crs-mz-td-crit ' + cls + '" title="' + esc(descricaoColunaMatriz(crit) + ": " + item.status + tituloObs) + '">' + esc(texto) + '</td>';
  }

  function linhaMatrizHtml(x) {
    const porChave = new Map(x.itens.map((i) => [i.criterio, i]));
    const celulas = CRITERIOS.map((c) => celulaMatrizHtml(porChave.get(c.chave), c)).join("");
    const patCls = x.calc.patente === "Corsário" ? " crs-mz-pat-corsario" : "";
    return '<tr>' +
      '<td class="crs-mz-col-iniciativa">' + DRAWER.spanIniciativa(x.nome) + '</td>' +
      '<td class="crs-mz-td-pat crs-mz-patente-valor' + patCls + '">' + esc(x.calc.patente) + '</td>' +
      celulas +
      '<td class="crs-mz-td-pct">' + fmtPct(x.calc.pct) + '</td>' +
    '</tr>';
  }

  function colspanMatriz() {
    return 1 + CRITERIOS.length + 2; // Iniciativa + critérios + % + Patente
  }

  // agrupamento por núcleo (D2) — a ordem de cada grupo já vem correta porque `lista` já
  // está ordenada por listaFiltrada()/comparador(); só balda por chave normalizada
  function agruparPorNucleo(lista) {
    const grupos = new Map();
    lista.forEach((x) => {
      const nome = x.nucleo || "Sem núcleo";
      const chave = normalizar(nome);
      if (!grupos.has(chave)) grupos.set(chave, { nome: nome, chave: chave, itens: [] });
      grupos.get(chave).itens.push(x);
    });
    const chaves = Array.from(grupos.keys());
    chaves.sort((a, b) => {
      const ia = ORDEM_NUCLEOS.indexOf(a), ib = ORDEM_NUCLEOS.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b, "pt-BR");
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    return chaves.map((chave) => grupos.get(chave));
  }

  function grupoLinhaHtml(grupo) {
    const nc = corNucleo(grupo.nome);
    const colapsado = gruposColapsados.has(grupo.chave);
    return '<tr class="crs-mz-grupo">' +
      '<td class="crs-mz-grupo-td" colspan="' + colspanMatriz() + '">' +
        '<button type="button" class="crs-mz-grupo-btn" data-toggle-grupo="' + esc(grupo.chave) + '" aria-expanded="' + (!colapsado) + '" style="--cor-grupo:' + nc.cor + '">' +
          '<span class="crs-mz-grupo-seta" aria-hidden="true">' + (colapsado ? "▶" : "▼") + '</span>' +
          '<span class="crs-mz-grupo-nome">' + esc(grupo.nome) + '</span>' +
          '<span class="crs-mz-grupo-count">· ' + grupo.itens.length + '</span>' +
        '</button>' +
      '</td>' +
    '</tr>';
  }

  // ordem e textos batendo com o_caminho_para_o_corsario_v3.xlsx (aba "Jornada", linha 2);
  // rótulos abreviados (dicionário do refactor v0.21) com a definição completa em
  // data-tip — cada th é focável (tabindex=0) pra funcionar por teclado também (P1-1)
  function theadMatrizHtml() {
    return '<tr>' +
      '<th class="crs-mz-col-iniciativa">Iniciativa</th>' +
      '<th class="crs-mz-td-pat" tabindex="0" data-tip="Patente calculada a partir do % de adequação (ver ⓘ Legenda).">Patente</th>' +
      CRITERIOS.map((c) => '<th class="crs-mz-th-crit" tabindex="0" data-tip="' + esc(descricaoColunaMatriz(c)) + '">' + esc(rotuloColunaMatriz(c)) + '</th>').join("") +
      '<th class="crs-mz-td-pct" tabindex="0" data-tip="Percentual de itens aplicáveis em ok, ponderado pelo peso de cada status (ver ⓘ Legenda).">% de adequação</th>' +
    '</tr>';
  }

  function ajustarStickyGrupo() {
    const thead = elMatriz.querySelector("thead");
    if (thead) elMatriz.style.setProperty("--crs-thead-h", thead.offsetHeight + "px");
  }

  function renderMatriz(lista) {
    if (!lista.length) {
      elMatriz.innerHTML = '<thead>' + theadMatrizHtml() + '</thead><tbody><tr><td class="crs-mz-vazia" colspan="' + colspanMatriz() + '">' + vazioHtml() + '</td></tr></tbody>';
      ajustarStickyGrupo();
      return;
    }
    const grupos = agruparPorNucleo(lista);
    const corpo = grupos.map((g) => {
      const linhaGrupo = grupoLinhaHtml(g);
      if (gruposColapsados.has(g.chave)) return linhaGrupo;
      return linhaGrupo + g.itens.map(linhaMatrizHtml).join("");
    }).join("");
    elMatriz.innerHTML = '<thead>' + theadMatrizHtml() + '</thead><tbody>' + corpo + '</tbody>';
    ajustarStickyGrupo();
  }

  // dispatcher único: filtra/ordena uma vez, decide qual visão está ativa e delega o
  // desenho — filtro/busca/ordenação e o contador de cima valem pras duas por igual
  function renderTudo() {
    const lista = listaFiltrada();
    elContagem.textContent = "Mostrando " + lista.length + " de " + TODAS.length + " iniciativas.";
    elLimpar.hidden = !algumFiltroAtivo();
    atualizarBadgesFiltro();
    atualizarPatentesAtivas();
    elAvisoMobile.classList.toggle("mostrar", visao === "matriz");
    if (visao === "matriz") {
      elGrid.style.display = "none";
      elMatrizWrap.style.display = "";
      renderMatriz(lista);
    } else {
      elMatrizWrap.style.display = "none";
      elGrid.style.display = "";
      renderGrid(lista);
    }
  }

  // visão em location.hash (#cards/#matriz) — link compartilhável, sem localStorage;
  // hashchange cobre tanto o clique no alternador quanto voltar/avançar no navegador
  function aplicarHash() {
    // Matriz é o default — só #cards explícito abre em Cards
    visao = location.hash === "#cards" ? "cards" : "matriz";
    elSegmento.querySelectorAll("button[data-visao]").forEach((b) => b.classList.toggle("ativo", b.dataset.visao === visao));
    renderTudo();
  }

  async function carregar() {
    mostrarSkeleton();
    try {
      const criterios = await buscar("corsario_criterios", "&order=ordem&limit=1000");
      const statusRows = await buscar("corsario_status", "&limit=1000");
      processar(criterios, statusRows);
      elEstado.innerHTML = "";
      elFrota.innerHTML = frotaHtml();
      montarDropdownNucleos();
      sincronizarCheckboxes(elDdNucleosPainel, filtroNucleos);
      sincronizarCheckboxes(elDdPatentesPainel, filtroPatentes);
      elToolbar.style.visibility = "";
      renderTudo();
    } catch (err) {
      console.error("corsario: falha ao carregar", err);
      mostrarErro(err);
    }
  }

  initTooltip();
  initPopover(elLegendaBtn, elLegendaPop);
  initPopover(elDdNucleosBtn, elDdNucleosPainel);
  initPopover(elDdPatentesBtn, elDdPatentesPainel);
  montarDropdownPatentes();
  sincronizarCheckboxes(elDdPatentesPainel, filtroPatentes);

  elSegmento.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-visao]");
    if (!btn || btn.classList.contains("ativo")) return;
    location.hash = btn.dataset.visao;
  });
  window.addEventListener("hashchange", aplicarHash);

  elFrota.addEventListener("click", (e) => {
    const btn = e.target.closest(".crs-patente-chip[data-patente]");
    if (btn) alternarFiltroPatente(btn.dataset.patente);
  });

  elDdNucleosPainel.addEventListener("click", (e) => { if (e.target.closest("[data-limpar-nucleos]")) { filtroNucleos.clear(); sincronizarCheckboxes(elDdNucleosPainel, filtroNucleos); salvarFiltrosPersistidos(); renderTudo(); } });
  elDdNucleosPainel.addEventListener("change", (e) => {
    const chk = e.target.closest("input[type=checkbox]");
    if (!chk) return;
    if (chk.checked) filtroNucleos.add(chk.value); else filtroNucleos.delete(chk.value);
    salvarFiltrosPersistidos();
    renderTudo();
  });
  elDdPatentesPainel.addEventListener("click", (e) => { if (e.target.closest("[data-limpar-patentes]")) { filtroPatentes.clear(); sincronizarCheckboxes(elDdPatentesPainel, filtroPatentes); salvarFiltrosPersistidos(); renderTudo(); } });
  elDdPatentesPainel.addEventListener("change", (e) => {
    const chk = e.target.closest("input[type=checkbox]");
    if (!chk) return;
    if (chk.checked) filtroPatentes.add(chk.value); else filtroPatentes.delete(chk.value);
    salvarFiltrosPersistidos();
    renderTudo();
  });

  elLimpar.addEventListener("click", limparFiltros);
  document.addEventListener("click", (e) => { if (e.target.closest("[data-limpar-tudo]")) limparFiltros(); });

  elMatrizWrap.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-toggle-grupo]");
    if (!btn) return;
    const chave = btn.dataset.toggleGrupo;
    if (gruposColapsados.has(chave)) gruposColapsados.delete(chave); else gruposColapsados.add(chave);
    salvarGruposColapsados();
    renderTudo();
  });

  elBusca.addEventListener("input", renderTudo);
  elOrdenar.addEventListener("change", () => { salvarFiltrosPersistidos(); renderTudo(); });

  // ?q=<nome> pré-preenche a busca (link direto da busca global, js/busca.js) — mesmo
  // padrão de plano.html; a lista só é montada depois que carregar() trouxer os dados
  // (renderTudo já lê elBusca.value.trim() a cada render), então só precisa preencher
  // o campo aqui — nada de renderizar de novo antes da hora.
  const qParam = new URLSearchParams(location.search).get("q");
  if (qParam) elBusca.value = qParam;

  aplicarHash(); // respeita um #matriz vindo de link compartilhado antes mesmo do fetch terminar
  carregar();
})();
