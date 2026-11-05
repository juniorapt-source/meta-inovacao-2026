/* sites.html e paineis.html (menu Execução, v0.33.0) — uma tabela por iniciativa,
 * agrupada por núcleo, com a mesma lista e a mesma ordem do "O Caminho para o Corsário".
 *
 *   <body data-tipo="site">   → Link da página + "Tem formulário de captura de lead?"
 *   <body data-tipo="painel"> → Link do painel + Responsável pela manutenção (pessoas)
 *
 * Fontes:
 *   - iniciativas: corsario_status (DB_CORSARIO), núcleo + iniciativa distintos. Sem rede,
 *     cai pra data/projetos.js (window.DB.projetos), que tem os mesmos pares.
 *   - valores: meta_inovacao_iniciativa_links (DB_INICIATIVA_LINKS).
 *   - pessoas (só painel): meta_inovacao_pessoas (DB_PESSOAS), a lista do menu Pessoas.
 *
 * Grava sozinho ao editar (link: ao sair do campo ou Enter; caixa e select: na hora).
 * Sem a tabela de links carregada (offline, ou script SQL ainda não rodado), a página
 * mostra a lista e desliga a edição.
 */
(function () {
  "use strict";

  const TIPO = document.body.dataset.tipo === "painel" ? "painel" : "site";
  montarShell(TIPO === "painel" ? "paineis.html" : "sites.html");

  // mesmas cores e ordem de núcleos de js/corsario.js
  const NUCLEO_CORES = {
    "inovação para competitividade": "var(--prog)",
    "inovação territorial": "var(--ok)",
    "startups": "var(--sla)",
    "tecnologias portadoras de futuro": "var(--cc)",
  };
  const ORDEM_NUCLEOS = Object.keys(NUCLEO_CORES);
  const LS_GRUPOS = "cc_" + TIPO + "s_grupos";

  const $ = (id) => document.getElementById(id);
  const elTabela = $("il-tabela");
  const elBusca = $("il-busca");
  const elContagem = $("il-contagem");
  const elEstado = $("il-estado");

  let INICIATIVAS = [];          // {iniciativa, nucleo, projeto_id, nucleo_id}
  let LINKS = new Map();         // iniciativa -> linha de meta_inovacao_iniciativa_links (deste TIPO)
  let PESSOAS = [];              // {db_id, nome}
  let podeEditar = false;
  let colapsados = new Set();

  function normalizar(s) { return String(s == null ? "" : s).trim().toLowerCase(); }
  function semAcento(s) { return normalizar(s).normalize("NFD").replace(/[̀-ͯ]/g, ""); }
  function corNucleo(n) { return NUCLEO_CORES[normalizar(n)] || "var(--grafite)"; }
  function nomePessoa(p) { return (p && (p.nome_completo || p.nome_exibicao || p.nome)) || ""; }
  function usuario() { return window.EDITOR_ATUAL ? EDITOR_ATUAL.nomeAtual() : null; }

  try { colapsados = new Set(JSON.parse(localStorage.getItem(LS_GRUPOS) || "[]")); } catch (e) { /* segue expandido */ }
  function salvarColapsados() { try { localStorage.setItem(LS_GRUPOS, JSON.stringify(Array.from(colapsados))); } catch (e) { /* idem */ } }

  // ---- carga ----
  function iniciativasDoCorsario(statusRows) {
    const m = new Map();
    statusRows.forEach((r) => {
      if (!r.iniciativa) return;
      if (!m.has(r.iniciativa)) m.set(r.iniciativa, { iniciativa: r.iniciativa, nucleo: r.nucleo || null, projeto_id: r.projeto_id || null, nucleo_id: r.nucleo_id || null });
      const e = m.get(r.iniciativa);
      if (!e.nucleo && r.nucleo) e.nucleo = r.nucleo;
      if (!e.projeto_id && r.projeto_id) e.projeto_id = r.projeto_id;
      if (!e.nucleo_id && r.nucleo_id) e.nucleo_id = r.nucleo_id;
    });
    return Array.from(m.values());
  }

  function iniciativasDoSeed() {
    return ((window.DB && window.DB.projetos) || []).map((p) => ({ iniciativa: p.iniciativa, nucleo: p.nucleo || null, projeto_id: null, nucleo_id: null }));
  }

  function pessoasUnicas(lista) {
    const vistos = new Set();
    const out = [];
    (lista || []).filter((p) => p.ativo !== false && p.db_id).forEach((p) => {
      const nome = nomePessoa(p);
      const chave = semAcento(nome);
      if (!nome || vistos.has(chave)) return;
      vistos.add(chave);
      out.push({ db_id: p.db_id, nome: nome });
    });
    return out.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  }

  async function carregar() {
    elTabela.innerHTML = '<tbody><tr><td class="il-vazia">Carregando…</td></tr></tbody>';
    const [crs, links, pessoas] = await Promise.all([
      window.DB_CORSARIO ? DB_CORSARIO.carregar() : Promise.resolve({ statusRows: [], usandoFallback: true }),
      DB_INICIATIVA_LINKS.carregar(),
      TIPO === "painel" && window.DB_PESSOAS ? DB_PESSOAS.carregar() : Promise.resolve({ lista: [] }),
    ]);
    INICIATIVAS = iniciativasDoCorsario(crs.statusRows || []);
    const usouSeed = !INICIATIVAS.length;
    if (usouSeed) INICIATIVAS = iniciativasDoSeed();

    LINKS = new Map();
    (links.lista || []).filter((l) => l.tipo === TIPO).forEach((l) => LINKS.set(l.iniciativa, l));
    PESSOAS = pessoasUnicas(pessoas.lista);
    podeEditar = !links.usandoFallback;

    const avisos = [];
    if (usouSeed) avisos.push("<b>Lista local de iniciativas</b> — não foi possível ler o Corsário agora; mostrando data/projetos.js.");
    if (links.usandoFallback) avisos.push("<b>Edição desligada</b> — não foi possível ler os links salvos (" + esc(links.motivoFallback || "sem rede") + "). Se a tabela ainda não existe, rode tools/sql/2026-11_iniciativa_links.sql no Supabase.");
    elEstado.innerHTML = avisos.map((a) => '<p class="aviso">' + a + "</p>").join("");
    render();
  }

  // ---- render ----
  function agrupar(lista) {
    const grupos = new Map();
    lista.forEach((x) => {
      const nome = x.nucleo || "Sem núcleo";
      const chave = normalizar(nome);
      if (!grupos.has(chave)) grupos.set(chave, { nome: nome, chave: chave, itens: [] });
      grupos.get(chave).itens.push(x);
    });
    const chaves = Array.from(grupos.keys()).sort((a, b) => {
      const ia = ORDEM_NUCLEOS.indexOf(a), ib = ORDEM_NUCLEOS.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b, "pt-BR");
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    chaves.forEach((c) => grupos.get(c).itens.sort((a, b) => a.iniciativa.localeCompare(b.iniciativa, "pt-BR")));
    return chaves.map((c) => grupos.get(c));
  }

  function nColunas() { return 4; }

  function thead() {
    const terceira = TIPO === "painel"
      ? '<th class="il-col-resp">Responsável pela manutenção</th>'
      : '<th class="il-col-check">Formulário de captura de lead</th>';
    return "<thead><tr>" +
      '<th class="il-col-iniciativa">Iniciativa</th>' +
      "<th>" + (TIPO === "painel" ? "Link do painel" : "Link da página") + "</th>" +
      terceira +
      '<th class="il-col-status"></th>' +
    "</tr></thead>";
  }

  function linkCelula(l) {
    const v = (l && l.link) || "";
    const abrir = v && DB_INICIATIVA_LINKS.linkValido(v)
      ? '<a class="il-abrir" href="' + esc(v) + '" target="_blank" rel="noopener noreferrer">abrir ↗</a>' : "";
    return '<td><div class="il-link-cel">' +
      '<input type="url" data-campo="link" value="' + esc(v) + '" placeholder="https://…"' + (podeEditar ? "" : " disabled") + ' aria-label="Link">' +
      abrir + "</div></td>";
  }

  function terceiraCelula(l) {
    const dis = podeEditar ? "" : " disabled";
    if (TIPO === "site") {
      return '<td class="il-col-check"><input type="checkbox" data-campo="captura_lead" aria-label="Tem formulário de captura de lead"' +
        (l && l.captura_lead ? " checked" : "") + dis + "></td>";
    }
    const atual = l && l.responsavel_pessoa_id ? String(l.responsavel_pessoa_id) : "";
    let opts = '<option value="">— escolher —</option>';
    if (atual && !PESSOAS.some((p) => String(p.db_id) === atual)) {
      opts += '<option value="' + esc(atual) + '" selected>' + esc((l && l.responsavel) || "pessoa #" + atual) + "</option>";
    }
    opts += PESSOAS.map((p) => '<option value="' + esc(String(p.db_id)) + '"' + (String(p.db_id) === atual ? " selected" : "") + ">" + esc(p.nome) + "</option>").join("");
    return '<td class="il-col-resp"><select data-campo="responsavel_pessoa_id" aria-label="Responsável pela manutenção"' + dis + ">" + opts + "</select></td>";
  }

  function linha(x) {
    const l = LINKS.get(x.iniciativa);
    return '<tr data-iniciativa="' + esc(x.iniciativa) + '">' +
      '<td class="il-col-iniciativa">' + esc(x.iniciativa) + "</td>" +
      linkCelula(l) + terceiraCelula(l) +
      '<td class="il-col-status" data-status></td>' +
    "</tr>";
  }

  function linhaGrupo(g) {
    const fechado = colapsados.has(g.chave);
    return '<tr><td class="il-grupo-td" colspan="' + nColunas() + '">' +
      '<button type="button" class="il-grupo-btn" data-grupo="' + esc(g.chave) + '" aria-expanded="' + !fechado + '" style="--cor-grupo:' + corNucleo(g.nome) + '">' +
        '<span class="il-grupo-seta" aria-hidden="true">' + (fechado ? "▶" : "▼") + "</span>" +
        "<span>" + esc(g.nome) + "</span>" +
        '<span class="il-grupo-count">· ' + g.itens.length + "</span>" +
      "</button></td></tr>";
  }

  function preenchido(x) {
    const l = LINKS.get(x.iniciativa);
    return !!(l && l.link);
  }

  let ultimaContagem = 0;
  function atualizarContagem() {
    const comLink = INICIATIVAS.filter(preenchido).length;
    elContagem.textContent = "Mostrando " + ultimaContagem + " de " + INICIATIVAS.length + " iniciativas · " + comLink + " com link.";
  }

  function render() {
    const q = semAcento(elBusca.value);
    const lista = INICIATIVAS.filter((x) => !q || semAcento(x.iniciativa).includes(q) || semAcento(x.nucleo).includes(q));
    ultimaContagem = lista.length;
    atualizarContagem();
    let corpo;
    if (!lista.length) {
      corpo = '<tr><td class="il-vazia" colspan="' + nColunas() + '">Nenhuma iniciativa encontrada.</td></tr>';
    } else {
      corpo = agrupar(lista).map((g) => linhaGrupo(g) + (colapsados.has(g.chave) && !q ? "" : g.itens.map(linha).join(""))).join("");
    }
    elTabela.innerHTML = thead() + "<tbody>" + corpo + "</tbody>";
    const th = elTabela.querySelector("thead");
    if (th) elTabela.style.setProperty("--il-thead-h", th.offsetHeight + "px");
  }

  // ---- gravação ----
  function marcar(tr, estado, detalhe) {
    const el = tr.querySelector("[data-status]");
    if (!el) return;
    const txt = { salvando: "salvando…", salvo: "salvo ✓", falhou: "falhou ⓘ" }[estado] || estado;
    el.className = "il-col-status il-st-" + estado;
    el.textContent = txt;
    el.title = detalhe || "";
    if (estado === "salvo") setTimeout(() => { if (el.textContent === "salvo ✓") el.textContent = ""; }, 1800);
  }

  async function gravar(tr, campos) {
    const nome = tr.dataset.iniciativa;
    const ini = INICIATIVAS.find((x) => x.iniciativa === nome);
    if (!ini) return;
    marcar(tr, "salvando");
    try {
      const salvo = await DB_INICIATIVA_LINKS.gravar(TIPO, ini, LINKS.get(nome) || null, campos, usuario());
      LINKS.set(nome, salvo);
      marcar(tr, "salvo");
      return true;
    } catch (err) {
      console.error("iniciativa-links: falha ao gravar", err);
      const msg = (window.CC_SUPABASE && CC_SUPABASE.mensagemEscritaAmigavel && CC_SUPABASE.mensagemEscritaAmigavel(err)) || "falhou";
      marcar(tr, "falhou", msg + ((err && err.message) ? " — " + err.message : ""));
      return false;
    }
  }

  function atualizarAbrir(tr, valor) {
    const cel = tr.querySelector(".il-link-cel");
    const velho = cel.querySelector(".il-abrir");
    if (velho) velho.remove();
    if (valor && DB_INICIATIVA_LINKS.linkValido(valor)) {
      const a = document.createElement("a");
      a.className = "il-abrir";
      a.href = valor;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = "abrir ↗";
      cel.appendChild(a);
    }
  }

  elTabela.addEventListener("change", async (e) => {
    const alvo = e.target;
    const tr = alvo.closest("tr[data-iniciativa]");
    if (!tr || !podeEditar) return;
    const campo = alvo.dataset.campo;
    const atual = LINKS.get(tr.dataset.iniciativa);
    if (campo === "link") {
      const v = alvo.value.trim();
      alvo.value = v;
      if (!DB_INICIATIVA_LINKS.linkValido(v)) {
        alvo.classList.add("invalido");
        alvo.title = "O link precisa começar com http:// ou https://";
        marcar(tr, "falhou", alvo.title);
        return;
      }
      alvo.classList.remove("invalido");
      alvo.title = "";
      if (v === ((atual && atual.link) || "")) return;
      if (await gravar(tr, { link: v })) { atualizarAbrir(tr, v); atualizarContagem(); }
    } else if (campo === "captura_lead") {
      const ok = await gravar(tr, { captura_lead: alvo.checked });
      if (!ok) alvo.checked = !alvo.checked;
    } else if (campo === "responsavel_pessoa_id") {
      const id = alvo.value;
      const p = PESSOAS.find((x) => String(x.db_id) === id);
      const ok = await gravar(tr, { responsavel_pessoa_id: id ? Number(id) : null, responsavel: p ? p.nome : null });
      if (!ok) alvo.value = atual && atual.responsavel_pessoa_id ? String(atual.responsavel_pessoa_id) : "";
    }
  });

  // Enter no campo de link grava (dispara o change ao tirar o foco)
  elTabela.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.dataset && e.target.dataset.campo === "link") e.target.blur();
  });

  elTabela.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-grupo]");
    if (!btn) return;
    const c = btn.dataset.grupo;
    if (colapsados.has(c)) colapsados.delete(c); else colapsados.add(c);
    salvarColapsados();
    render();
  });

  elBusca.addEventListener("input", render);

  if (window.EDITOR_ATUAL) EDITOR_ATUAL.montar($("cc-editor-rodape-wrap"));
  carregar();
})();
