/* sites.html e paineis.html (menu Execução, v0.33.0; vários painéis em v0.34.0) — uma tabela por iniciativa,
 * agrupada por núcleo, com a mesma lista e a mesma ordem do "O Caminho para o Corsário".
 *
 *   <body data-tipo="site">   → Link da página + "Tem formulário de captura de lead?"
 *   <body data-tipo="painel"> → Link do painel + Detalhes (texto livre) + Responsável pela
 *                               manutenção (pessoas). Vários painéis por iniciativa (v0.34.0):
 *                               "+ painel" abre uma linha nova, "×" remove (soft delete).
 *
 * Fontes:
 *   - iniciativas: cadastro de projetos (meta_inovacao_projetos, DB_PROJETOS) somado às
 *     iniciativas de corsario_status (DB_CORSARIO) — as do Corsário que não são projeto
 *     (criadas pelo "+ Nova iniciativa" de lá) continuam aparecendo. Projeto novo entra
 *     aqui mesmo que a inclusão automática dele no Corsário tenha falhado. Sem rede,
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
  let LINKS = new Map();         // iniciativa -> [linhas de meta_inovacao_iniciativa_links deste TIPO], por id
  let RASCUNHOS = new Map();     // iniciativa -> nº de linhas em branco na tela (só painel)
  const pendentes = new Set();   // gravações em andamento (render espera por elas)
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

  // junta o cadastro de projetos (fonte oficial) com as do Corsário, sem repetir:
  // casa por projeto_id e, pras linhas sem FK, pelo nome (sem caixa/acento).
  function juntarComProjetos(doCorsario, projetos) {
    const out = doCorsario.slice();
    const porId = new Set(out.filter((x) => x.projeto_id != null).map((x) => String(x.projeto_id)));
    const porNome = new Set(out.map((x) => semAcento(x.iniciativa)));
    (projetos || []).forEach((p) => {
      if (!p || !p.iniciativa) return;
      if (p.db_id != null && porId.has(String(p.db_id))) return;
      if (porNome.has(semAcento(p.iniciativa))) return;
      porNome.add(semAcento(p.iniciativa));
      out.push({ iniciativa: p.iniciativa, nucleo: p.nucleo || null, projeto_id: p.db_id != null ? p.db_id : null, nucleo_id: p.nucleo_id || null });
    });
    return out;
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
    const [crs, projs, links, pessoas] = await Promise.all([
      window.DB_CORSARIO ? DB_CORSARIO.carregar() : Promise.resolve({ statusRows: [], usandoFallback: true }),
      window.DB_PROJETOS ? DB_PROJETOS.carregar().catch(() => ({ lista: [], usandoFallback: true })) : Promise.resolve({ lista: [], usandoFallback: true }),
      DB_INICIATIVA_LINKS.carregar(),
      TIPO === "painel" && window.DB_PESSOAS ? DB_PESSOAS.carregar() : Promise.resolve({ lista: [] }),
    ]);
    INICIATIVAS = iniciativasDoCorsario(crs.statusRows || []);
    // só soma o cadastro quando ele veio do banco — o seed local pode estar atrás
    if (!projs.usandoFallback) INICIATIVAS = juntarComProjetos(INICIATIVAS, projs.lista);
    const usouSeed = !INICIATIVAS.length;
    if (usouSeed) INICIATIVAS = iniciativasDoSeed();

    LINKS = new Map();
    (links.lista || []).filter((l) => l.tipo === TIPO).forEach((l) => {
      if (!LINKS.has(l.iniciativa)) LINKS.set(l.iniciativa, []);
      LINKS.get(l.iniciativa).push(l);
    });
    LINKS.forEach((arr) => arr.sort((a, b) => (a.db_id || 0) - (b.db_id || 0)));
    RASCUNHOS = new Map();
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

  function nColunas() { return TIPO === "painel" ? 5 : 4; }

  function thead() {
    const terceira = TIPO === "painel"
      ? '<th class="il-col-desc">Detalhes do painel</th><th class="il-col-resp">Responsável pela manutenção</th>'
      : '<th class="il-col-check">Formulário de captura de lead</th>';
    return "<thead><tr>" +
      '<th class="il-col-iniciativa">Iniciativa</th>' +
      '<th class="il-col-link">' + (TIPO === "painel" ? "Link do painel" : "Link da página") + "</th>" +
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
    const desc = '<td class="il-col-desc"><input type="text" data-campo="descricao" value="' + esc((l && l.descricao) || "") +
      '" placeholder="O que é este painel (opcional)" maxlength="500"' + dis + ' aria-label="Detalhes do painel"></td>';
    return desc + '<td class="il-col-resp"><select data-campo="responsavel_pessoa_id" aria-label="Responsável pela manutenção"' + dis + ">" + opts + "</select></td>";
  }

  function salvos(nome) { return LINKS.get(nome) || []; }

  // linhas em branco na tela: as pedidas pelo "+ painel", ou 1 se a iniciativa não tem nada
  function nBrancos(nome) {
    if (TIPO !== "painel") return salvos(nome).length ? 0 : 1;
    return Math.max(RASCUNHOS.get(nome) || 0, salvos(nome).length ? 0 : 1);
  }

  function linhaUnica(x, l, primeira, total) {
    const nomeCel = primeira
      ? '<td class="il-col-iniciativa"' + (total > 1 ? ' rowspan="' + total + '"' : "") + '>' +
          '<div class="il-ini-nome">' + esc(x.iniciativa) + "</div>" +
          (TIPO === "painel" && podeEditar
            ? '<button type="button" class="il-add" data-acao="adicionar" title="Adicionar outro painel a esta iniciativa">+ painel</button>' : "") +
        "</td>"
      : "";
    const remover = TIPO === "painel" && podeEditar && (l || total > 1)
      ? '<button type="button" class="il-remover" data-acao="remover" title="Remover este painel" aria-label="Remover este painel">×</button>' : "";
    return '<tr data-iniciativa="' + esc(x.iniciativa) + '"' + (l ? ' data-id="' + esc(String(l.db_id)) + '"' : "") +
      (primeira ? "" : ' class="il-sub-linha"') + ">" +
      nomeCel + linkCelula(l) + terceiraCelula(l) +
      '<td class="il-col-status"><div class="il-status-cel"><span data-status></span>' + remover + "</div></td>" +
    "</tr>";
  }

  function linha(x) {
    const ls = salvos(x.iniciativa);
    const itens = ls.concat(new Array(nBrancos(x.iniciativa)).fill(null));
    return itens.map((l, i) => linhaUnica(x, l, i === 0, itens.length)).join("");
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
    return salvos(x.iniciativa).some((l) => l.link);
  }

  let ultimaContagem = 0;
  function atualizarContagem() {
    const comLink = INICIATIVAS.filter(preenchido).length;
    let txt = "Mostrando " + ultimaContagem + " de " + INICIATIVAS.length + " iniciativas · " + comLink + " com link";
    if (TIPO === "painel") {
      const nPaineis = INICIATIVAS.reduce((n, x) => n + salvos(x.iniciativa).filter((l) => l.link).length, 0);
      txt += " · " + nPaineis + (nPaineis === 1 ? " painel" : " painéis");
    }
    elContagem.textContent = txt + ".";
  }

  function casaBusca(x, q) {
    if (!q) return true;
    if (semAcento(x.iniciativa).includes(q) || semAcento(x.nucleo).includes(q)) return true;
    return salvos(x.iniciativa).some((l) => semAcento(l.descricao).includes(q));
  }

  // re-render só depois das gravações em curso (senão a linha recém-gravada some da tela)
  async function renderAposSalvar() {
    if (pendentes.size) await Promise.allSettled(Array.from(pendentes));
    render();
  }

  function render() {
    const q = semAcento(elBusca.value);
    const lista = INICIATIVAS.filter((x) => casaBusca(x, q));
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
    el.className = "il-st-" + estado;
    el.textContent = txt;
    el.title = detalhe || "";
    if (estado === "salvo") setTimeout(() => { if (el.textContent === "salvo ✓") el.textContent = ""; }, 1800);
  }

  function registroDaLinha(tr) {
    const id = tr.dataset.id;
    return id ? salvos(tr.dataset.iniciativa).find((l) => String(l.db_id) === id) || null : null;
  }

  function mensagemErro(err) {
    let msg = (window.CC_SUPABASE && CC_SUPABASE.mensagemEscritaAmigavel && CC_SUPABASE.mensagemEscritaAmigavel(err)) || "falhou";
    if (TIPO === "painel" && DB_INICIATIVA_LINKS.faltaScriptPaineis(err)) {
      msg = "O banco ainda não aceita vários painéis por iniciativa nem a coluna de detalhes — rode " + DB_INICIATIVA_LINKS.SCRIPT_PAINEIS + " no Supabase.";
    }
    return msg + ((err && err.message) ? " — " + err.message : "");
  }

  // uma gravação por linha por vez: a 2ª espera a 1ª (que pode estar criando a linha)
  const filaPorLinha = new WeakMap();
  function gravar(tr, campos) {
    const anterior = filaPorLinha.get(tr) || Promise.resolve();
    const p = anterior.then(() => gravarAgora(tr, campos));
    filaPorLinha.set(tr, p.catch(() => {}));
    pendentes.add(p);
    p.finally(() => pendentes.delete(p));
    return p;
  }

  async function gravarAgora(tr, campos) {
    const nome = tr.dataset.iniciativa;
    const ini = INICIATIVAS.find((x) => x.iniciativa === nome);
    if (!ini) return false;
    const existente = registroDaLinha(tr);
    marcar(tr, "salvando");
    try {
      const salvo = await DB_INICIATIVA_LINKS.gravar(TIPO, ini, existente, campos, usuario());
      const arr = salvos(nome).slice();
      if (existente) {
        arr[arr.indexOf(existente)] = salvo;
      } else {
        const brancos = nBrancos(nome);
        arr.push(salvo);
        RASCUNHOS.set(nome, Math.max(0, brancos - 1));
        tr.dataset.id = String(salvo.db_id);
      }
      LINKS.set(nome, arr);
      marcar(tr, "salvo");
      return true;
    } catch (err) {
      console.error("iniciativa-links: falha ao gravar", err);
      const msg = mensagemErro(err);
      marcar(tr, "falhou", msg);
      if (TIPO === "painel" && DB_INICIATIVA_LINKS.faltaScriptPaineis(err)) mostrarAvisoScript();
      return false;
    }
  }

  function mostrarAvisoScript() {
    if (elEstado.querySelector("[data-aviso-script]")) return;
    const p = document.createElement("p");
    p.className = "aviso";
    p.dataset.avisoScript = "1";
    p.innerHTML = "<b>Falta um passo no banco</b> — pra ter mais de um painel por iniciativa e a coluna de detalhes, rode <code>" +
      esc(DB_INICIATIVA_LINKS.SCRIPT_PAINEIS) + "</code> no Supabase.";
    elEstado.appendChild(p);
  }

  async function removerLinha(tr) {
    const nome = tr.dataset.iniciativa;
    const existente = registroDaLinha(tr);
    if (!existente) {
      // linha em branco: só some da tela
      RASCUNHOS.set(nome, Math.max(0, nBrancos(nome) - 1));
      return renderAposSalvar();
    }
    const rotulo = existente.descricao || existente.link || "este painel";
    if (!window.confirm("Remover o painel \"" + rotulo + "\" de " + nome + "?")) return;
    marcar(tr, "salvando");
    try {
      await DB_INICIATIVA_LINKS.remover(existente, usuario());
      LINKS.set(nome, salvos(nome).filter((l) => l !== existente));
      await renderAposSalvar();
    } catch (err) {
      console.error("iniciativa-links: falha ao remover", err);
      marcar(tr, "falhou", mensagemErro(err));
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
    const atual = registroDaLinha(tr);
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
    } else if (campo === "descricao") {
      const v = alvo.value.trim();
      alvo.value = v;
      if (v === ((atual && atual.descricao) || "")) return;
      const ok = await gravar(tr, { descricao: v });
      if (!ok) alvo.value = (atual && atual.descricao) || "";
    } else if (campo === "captura_lead") {
      const ok = await gravar(tr, { captura_lead: alvo.checked });
      if (!ok) alvo.checked = !alvo.checked;
    } else if (campo === "responsavel_pessoa_id") {
      const id = alvo.value;
      const p = PESSOAS.find((x) => String(x.db_id) === id);
      const ok = await gravar(tr, { responsavel_pessoa_id: id ? Number(id) : null, responsavel: p ? p.nome : null });
      if (!ok) { const a = registroDaLinha(tr); alvo.value = a && a.responsavel_pessoa_id ? String(a.responsavel_pessoa_id) : ""; }
    }
  });

  // Enter no campo de link/detalhes grava (dispara o change ao tirar o foco)
  elTabela.addEventListener("keydown", (e) => {
    const c = e.target.dataset && e.target.dataset.campo;
    if (e.key === "Enter" && (c === "link" || c === "descricao")) e.target.blur();
  });

  elTabela.addEventListener("click", async (e) => {
    const acao = e.target.closest("[data-acao]");
    if (acao && podeEditar) {
      const tr = acao.closest("tr[data-iniciativa]");
      if (!tr) return;
      const nome = tr.dataset.iniciativa;
      if (acao.dataset.acao === "adicionar") {
        await Promise.allSettled(Array.from(pendentes));
        RASCUNHOS.set(nome, nBrancos(nome) + 1);
        render();
        // foco no link da linha nova (a última desta iniciativa)
        const linhas = Array.from(elTabela.querySelectorAll("tr[data-iniciativa]")).filter((r) => r.dataset.iniciativa === nome);
        const ultima = linhas[linhas.length - 1];
        const inp = ultima && ultima.querySelector('[data-campo="link"]');
        if (inp) inp.focus();
      } else if (acao.dataset.acao === "remover") {
        await removerLinha(tr);
      }
      return;
    }
    const btn = e.target.closest("[data-grupo]");
    if (!btn) return;
    const c = btn.dataset.grupo;
    if (colapsados.has(c)) colapsados.delete(c); else colapsados.add(c);
    salvarColapsados();
    renderAposSalvar();
  });

  elBusca.addEventListener("input", renderAposSalvar);

  if (window.EDITOR_ATUAL) EDITOR_ATUAL.montar($("cc-editor-rodape-wrap"));
  carregar();
})();
