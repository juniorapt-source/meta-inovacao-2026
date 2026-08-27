/* Drawer lateral único (item 3.2 do plano de melhorias) — window.DRAWER.
 *
 * Um painel só, aberto por clique em qualquer nome de INICIATIVA ou PESSOA em qualquer
 * tela: fecha o ciclo indicador → causa → responsável → ação sem criar página nova.
 * Roteamento leve por hash (#iniciativa=<slug> / #pessoa=<id>) — link direto
 * compartilhável; fechar limpa o hash.
 *
 * Fonte dos dados: window.DB (local) pras partes síncronas (nome/núcleo/ações/nós), REST
 * puro no Supabase (fetch cru, mesmo padrão de corsario.html — sem SDK) pras partes
 * assíncronas (régua do Corsário, atividades por iniciativa/pessoa, células da Matriz de
 * demandas). Cada bloco assíncrono renderiza seu próprio "carregando…" e depois se
 * preenche sozinho — o resto do painel não espera por ele.
 *
 * "Núcleo e representante(s)" (painel de INICIATIVA) também virou bloco assíncrono no
 * item 4.4 (Camada 4 do golden record): quando a página carrega js/db-projeto-
 * representantes.js + js/db-pessoas.js (hoje: participantes.html), lê a junção
 * meta_inovacao_projeto_representantes (item 2.2) em vez do texto livre
 * `proj.representantes` (text[]) — sem os dois módulos carregados (plano.html,
 * demandas.html, corsario.html, projetos.html...) ou sem vínculo ainda pra este projeto,
 * cai pro texto livre de sempre, sem quebrar. Ver representantesHtml()/
 * carregarJuncaoRepresentantes() abaixo.
 *
 * "Matriz de demandas" (painel de INICIATIVA) passou a ler meta_inovacao_matriz_celulas
 * (tabela nova do item 3.1) em vez de meta_inovacao_matriz_demandas (a antiga, CONGELADA
 * desde a virada do item 3.2 — não recebe mais escrita) — aposentadoria da tabela antiga,
 * frente própria aberta 27/08/2026 (ver docs/PLANO_EXECUCAO_GOLDEN_RECORD.md). Ver
 * matrizHtml()/QUERY_MATRIZ_CELULAS abaixo.
 */
(function (root) {
  "use strict";

  // ---- utilidades compartilhadas (com fallback caso os módulos não tenham carregado —
  // nunca quebra o drawer por falta de um script opcional) ----
  function esc(s) { return root.esc ? root.esc(s) : String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function fmtBR(iso) { if (!iso) return ""; if (root.CALC && root.CALC.fmtBR) return root.CALC.fmtBR(iso); const [, m, d] = String(iso).split("-"); return d + "/" + m; }
  function normalizarTexto(s) {
    if (root.RESP && root.RESP.normalizar) return root.RESP.normalizar(s);
    return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  }
  function slugify(s) {
    return normalizarTexto(s).replace(/[^a-z0-9]+/g, "-").replace(/(^-+|-+$)/g, "");
  }
  function hoje() { return root.hojeISO ? root.hojeISO() : new Date().toISOString().slice(0, 10); }

  // ids de responsável que um texto livre (ex.: "Sandra/Gerência") resolve — [] se
  // js/responsaveis.js não carregou nesta página ou nada bateu.
  function idsDeTexto(texto) {
    const lista = (root.DB && root.DB.responsaveis) || [];
    if (!root.RESP || !lista.length) return [];
    return root.RESP.mapearTexto(lista, texto).ids;
  }
  function nomeResponsavel(id) {
    const lista = (root.DB && root.DB.responsaveis) || [];
    const p = lista.find((x) => x.id === id);
    return p ? p.nome : id;
  }

  /* ---- REST puro no Supabase — mesmo padrão de corsario.html (sem SDK, fetch cru) ---- */
  function supaCfg() { return root.APP_CONFIG || null; }
  async function supaBuscar(tabela, query) {
    const cfg = supaCfg();
    if (!cfg) throw new Error("Supabase não configurado nesta página (falta js/config.js).");
    const url = cfg.SUPABASE_URL + "/rest/v1/" + tabela + "?" + (query || "select=*");
    // header x-cc-token (item 2.1) só entra se js/supabase.js carregou nesta página —
    // essas buscas do drawer são todas leitura (SELECT continua público na RLS nova),
    // então funcionam igual com ou sem o header; manda quando dá, por consistência.
    const headers = Object.assign({ apikey: cfg.SUPABASE_ANON_KEY, Authorization: "Bearer " + cfg.SUPABASE_ANON_KEY },
      root.CC_SUPABASE ? root.CC_SUPABASE.headersComToken() : {});
    const r = await fetch(url, { headers: headers });
    if (!r.ok) {
      let detalhe = "HTTP " + r.status;
      try { const corpo = await r.json(); if (corpo && corpo.message) detalhe = corpo.message; } catch (e) { /* corpo não era JSON */ }
      throw new Error(tabela + ": " + detalhe);
    }
    return r.json();
  }

  /* ---- a régua do Corsário — MESMA fórmula de corsario.html (não mexer sem revalidar
     lá também: pesos ok=100%/andamento=70%/iniciar=40%/entendimento=20%, patente por
     faixa de %). Duplicada aqui de propósito: corsario.html não expõe essas funções
     num objeto global, e extrair um módulo compartilhado tocaria numa página que já
     funciona — o cálculo é uma regra de negócio pequena e estável (documentada, com o
     mesmo comentário de aviso das duas pontas). */
  const PESOS_REGUA = { "ok": 1, "ajuste em andamento": 0.7, "a iniciar": 0.4, "em entendimento": 0.2 };
  function calcularRegua(statusList) {
    const aplicaveis = statusList.filter((s) => s !== "não se aplica");
    if (!aplicaveis.length) return { pct: null, patente: "Fora da régua" };
    const pct = aplicaveis.reduce((soma, s) => soma + (PESOS_REGUA[s] || 0), 0) / aplicaveis.length;
    const patente = pct >= 0.995 ? "Corsário" : pct >= 0.75 ? "Capitão" : pct >= 0.5 ? "Timoneiro" : pct >= 0.25 ? "Marujo" : "Grumete";
    return { pct: pct, patente: patente };
  }
  function fmtPct(pct) { return pct == null ? "—" : (pct * 100).toFixed(1).replace(".", ",") + "%"; }

  /* ---- junção PROJETO×PESSOA (Camada 2, item 2.2 — meta_inovacao_projeto_representantes)
     — item 4.4: "Núcleo e representante(s)" deixa de ler só `proj.representantes` (texto
     livre) quando a junção estiver disponível nesta página (js/db-projeto-representantes.js
     + js/db-pessoas.js carregados — hoje: só participantes.html; editor.html carrega os
     dois módulos mas não js/drawer.js, então não é afetado). Memoizada (uma carga só,
     reaproveitada por toda navegação do drawer nesta página) — mesmo princípio de
     `promessa` em cada módulo js/db-*.js. Páginas que não carregam os dois módulos (ex.:
     plano.html, demandas.html, corsario.html — cobertas por tools/testar_drawer_headless.js
     com ?semrede=1) continuam no texto livre de sempre, sem quebrar nada: "convivendo", não
     substituindo, como o resto da Camada 2/4. */
  let promessaJuncaoRepresentantes = null;
  function carregarJuncaoRepresentantes() {
    if (!root.DB_PROJETO_REPRESENTANTES || !root.DB_PESSOAS) return Promise.resolve(null);
    if (promessaJuncaoRepresentantes) return promessaJuncaoRepresentantes;
    promessaJuncaoRepresentantes = Promise.all([
      root.DB_PROJETO_REPRESENTANTES.carregar(),
      root.DB_PESSOAS.carregar(),
    ]).then(([repr, pessoas]) => ({
      porProjeto: root.DB_PROJETO_REPRESENTANTES.porProjeto(repr.lista),
      pessoasPorDbId: new Map(pessoas.lista.map((p) => [p.db_id, p])),
    })).catch((err) => {
      console.error("drawer: falha ao carregar a junção projeto×pessoa (item 2.2), caindo pro texto livre", err);
      return null;
    });
    return promessaJuncaoRepresentantes;
  }

  // pessoa golden (meta_inovacao_pessoas) virando span clicável: reaproveita o id LEGADO
  // de 32 curados quando o nome bate (é o caso comum — o grupo "Projetos" do golden record
  // nasceu exatamente desses nomes, ver js/db-responsaveis.js.LEGADO); sem bater, cai pra
  // texto plano, mesmo comportamento de sempre de spanPessoa() pra um nome sem id conhecido.
  // Exportada em DRAWER (abaixo) desde o item 5.9 parte 5 — canva-consolidado.html reusa
  // pra virar facilitador_pessoa_id/responsavel_pessoa_id (item 2.5) em span clicável,
  // em vez de reimplementar o mesmo casamento nome→id LEGADO.
  function spanPessoaGolden(g) {
    const rotulo = g.nome_exibicao || g.nome;
    const legado = idsDeTexto(rotulo)[0];
    return legado ? spanPessoa(legado, true) : esc(rotulo);
  }

  async function representantesHtml(proj) {
    const junc = await carregarJuncaoRepresentantes();
    if (junc && proj.db_id != null) {
      const vinculos = junc.porProjeto[proj.db_id] || [];
      const golden = vinculos.map((v) => junc.pessoasPorDbId.get(v.pessoa_id)).filter(Boolean);
      if (golden.length) {
        return esc(proj.nucleo || "—") + '<div style="margin-top:6px">' + golden.map(spanPessoaGolden).join(" · ") + "</div>";
      }
      // projeto sem vínculo nesta tabela ainda (não migrado, ou placeholder tipo "Núcleo de
      // Startups" — item 2.2/4.1): cai pro texto livre abaixo, igual sempre foi.
    }
    return esc(proj.nucleo || "—") + '<div style="margin-top:6px">' + (proj.representantes || []).map((r) => spanPessoa(r)).join(" · ") + "</div>";
  }

  const STATUS_ATIVIDADE_CLASSE = { nao_iniciado: "atividade_nao_iniciado", em_execucao: "atividade_em_execucao", atrasado: "atividade_atrasado" };
  function badgeAtividade(statusBruto) {
    const chave = STATUS_ATIVIDADE_CLASSE[statusBruto] || statusBruto;
    if (root.CC_STATUS) return CC_STATUS.badge(chave);
    return '<span class="chip st-nao">' + esc(statusBruto || "—") + "</span>";
  }

  /* ---- shell do drawer (DOM, criado uma vez, reaproveitado) ---- */
  let elOverlay, elPainel, elTitulo, elCorpo, aberto = false, fechandoPorHash = false;

  function garantirDOM() {
    if (elOverlay) return;
    elOverlay = document.createElement("div");
    elOverlay.className = "drawer-overlay";
    elPainel = document.createElement("div");
    elPainel.className = "drawer-painel";
    elPainel.setAttribute("role", "dialog");
    elPainel.setAttribute("aria-modal", "true");
    elPainel.innerHTML =
      '<div class="drawer-cabecalho"><h2 class="drawer-titulo" id="drawer-titulo"></h2>' +
      '<button type="button" class="drawer-fechar" aria-label="Fechar painel">✕</button></div>' +
      '<div class="drawer-corpo" id="drawer-corpo"></div>';
    document.body.appendChild(elOverlay);
    document.body.appendChild(elPainel);
    elTitulo = elPainel.querySelector("#drawer-titulo");
    elCorpo = elPainel.querySelector("#drawer-corpo");

    elPainel.querySelector(".drawer-fechar").addEventListener("click", fechar);
    elOverlay.addEventListener("click", fechar);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && aberto) fechar(); });
  }

  function mostrar(titulo) {
    garantirDOM();
    elTitulo.textContent = titulo;
    elCorpo.innerHTML = '<p class="drawer-carregando">Carregando…</p>';
    elOverlay.classList.add("aberto");
    elPainel.classList.add("aberto");
    aberto = true;
    document.body.style.overflow = "hidden";
  }

  function fechar() {
    if (!aberto) return;
    elOverlay.classList.remove("aberto");
    elPainel.classList.remove("aberto");
    aberto = false;
    document.body.style.overflow = "";
    // "fechar limpa o hash" — só quando o hash é dono do drawer, pra não atrapalhar
    // outro uso de hash na página (ex.: corsario.html usa #cards/#matriz pra visão)
    if (/^#(iniciativa|pessoa)=/.test(location.hash)) {
      fechandoPorHash = true;
      history.replaceState(null, "", location.pathname + location.search);
      fechandoPorHash = false;
    }
  }

  /* ---- blocos de conteúdo (helpers de montagem) ---- */
  function bloco(titulo, corpoHtml, id) {
    return '<div class="drawer-bloco"' + (id ? ' id="' + id + '"' : "") + '><h3>' + esc(titulo) + "</h3>" + corpoHtml + "</div>";
  }
  function verMais(href, texto) { return '<a class="ver-mais" href="' + href + '">' + esc(texto) + " →</a>"; }
  function vazio(texto) { return '<p class="drawer-vazio">' + esc(texto) + "</p>"; }

  function preencherBlocoAsync(id, promessa, renderOk) {
    promessa.then((valor) => {
      const el = document.getElementById(id);
      if (el) el.querySelector(".drawer-bloco-corpo").innerHTML = renderOk(valor);
    }).catch((err) => {
      const el = document.getElementById(id);
      if (el) el.querySelector(".drawer-bloco-corpo").innerHTML = '<p class="drawer-erro">Não consegui carregar — ' + esc(err.message || String(err)) + "</p>";
    });
  }
  function blocoAsync(titulo, id) {
    return '<div class="drawer-bloco" id="' + id + '"><h3>' + esc(titulo) + '</h3><div class="drawer-bloco-corpo"><p class="drawer-carregando">Carregando…</p></div></div>';
  }

  /* ==================== PAINEL DE INICIATIVA ==================== */

  async function abrirIniciativa(nomeOuSlug) {
    const projetos = (root.DB && root.DB.projetos) || [];
    const proj = projetos.find((p) => p.iniciativa === nomeOuSlug) ||
      projetos.find((p) => slugify(p.iniciativa) === slugify(nomeOuSlug));
    if (!proj) {
      mostrar("Iniciativa não encontrada");
      elCorpo.innerHTML = vazio('Não achei "' + nomeOuSlug + '" em data/projetos.js.');
      return;
    }
    const nome = proj.iniciativa;
    mostrar(nome);

    const idRepr = "drawer-repr-ini", idRegua = "drawer-regua", idAtividades = "drawer-ativ-ini", idMatriz = "drawer-matriz-ini";
    elCorpo.innerHTML =
      blocoAsync("Núcleo e representante(s)", idRepr) +
      blocoAsync("Posição na régua do Corsário", idRegua) +
      blocoAsync("Atividades da iniciativa", idAtividades) +
      blocoAsync("Matriz de demandas", idMatriz) +
      bloco("Próximos encontros", proximosEncontrosHtml() +
        '<p class="drawer-nota">Agenda geral dos ciclos — não há vínculo direto encontro↔iniciativa nos dados.</p>' +
        verMais("agenda.html", "Ver agenda completa"));

    preencherBlocoAsync(idRepr, representantesHtml(proj), (h) => h);
    preencherBlocoAsync(idRegua, buscarRegua(nome), (r) => reguaHtml(nome, r));
    preencherBlocoAsync(idAtividades, supaBuscar("plano_acao_atividades", "iniciativa=eq." + encodeURIComponent(nome) + "&deleted_at=is.null"), (linhas) => atividadesIniciativaHtml(linhas));
    preencherBlocoAsync(idMatriz, supaBuscar("meta_inovacao_matriz_celulas", QUERY_MATRIZ_CELULAS), (linhas) => matrizHtml(linhas, nome));
  }

  async function buscarRegua(nomeIniciativa) {
    const [criterios, statusRows] = await Promise.all([
      supaBuscar("corsario_criterios", "select=chave,rotulo,grupo,ordem&order=ordem"),
      supaBuscar("corsario_status", "select=criterio,status,observacao&iniciativa=eq." + encodeURIComponent(nomeIniciativa)),
    ]);
    const porChave = Object.fromEntries(criterios.map((c) => [c.chave, c]));
    const itens = statusRows.map((r) => ({ criterio: porChave[r.criterio] || { rotulo: r.criterio, grupo: "" }, status: String(r.status || "").toLowerCase().trim() }));
    const calc = calcularRegua(itens.map((i) => i.status));
    return { calc: calc, itens: itens };
  }

  function reguaHtml(nome, r) {
    if (!r.itens.length) return vazio("Sem critérios registrados no Corsário ainda.");
    const emMovimento = r.itens.filter((i) => i.status === "ajuste em andamento").map((i) => i.criterio.rotulo);
    const aIniciar = r.itens.filter((i) => i.status === "a iniciar").map((i) => i.criterio.rotulo);
    return '<div class="drawer-regua">' +
      '<span class="drawer-regua-pct">' + fmtPct(r.calc.pct) + "</span>" +
      '<span class="drawer-regua-patente">' + esc(r.calc.patente) + "</span>" +
      '<div class="drawer-barra"><div class="drawer-barra-fill" style="width:' + ((r.calc.pct || 0) * 100) + '%"></div></div>' +
      "</div>" +
      (emMovimento.length ? '<div class="drawer-lista-curta"><b>Em movimento (' + emMovimento.length + "):</b> " + emMovimento.map(esc).join(", ") + "</div>" : "") +
      (aIniciar.length ? '<div class="drawer-lista-curta"><b>A iniciar (' + aIniciar.length + "):</b> " + aIniciar.map(esc).join(", ") + "</div>" : "") +
      verMais("corsario.html?q=" + encodeURIComponent(nome) + "#cards", "Ver os " + r.itens.length + " critérios");
  }

  function atividadesIniciativaHtml(linhas) {
    if (!linhas.length) return vazio("Nenhuma atividade registrada ainda.");
    return linhas.slice(0, 6).map((a) =>
      '<div class="drawer-linha"><span>' + esc(a.descricao || "(sem descrição)") + "</span>" + badgeAtividade(a.status) + "</div>"
    ).join("") + (linhas.length > 6 ? '<p class="drawer-nota">+ ' + (linhas.length - 6) + " outra(s).</p>" : "") +
      verMais("plano-acao.html", "Ver em Atividades por iniciativa");
  }

  // Aposentadoria de meta_inovacao_matriz_demandas (docs/PLANO_EXECUCAO_GOLDEN_RECORD.md,
  // frente própria aberta 27/08/2026): este bloco lia direto da tabela antiga
  // (meta_inovacao_matriz_demandas, wide-format, uma coluna física por canal) — que
  // CONGELOU na virada do item 3.2 e não recebe mais escrita. Ou seja, toda edição feita
  // na grade nova (demandas.html) desde então ficava invisível aqui: o painel de
  // iniciativa mostrava o estado de ANTES da virada, não o atual. Passa a ler
  // meta_inovacao_matriz_celulas (tabela nova do item 3.1, uma linha por
  // projeto_id+canal_id) — mesma tabela que demandas.html/a aba "matriz" do editor.html
  // já usam. Busca a tabela inteira (pequena: no máx. 27 projetos × 10 canais) com o
  // embed de projeto/canal, mesmo formato já comprovado em produção por
  // js/matriz-store.js (SELECT_COM_NOMES) — e casa client-side pelo NOME da iniciativa,
  // não por projeto_id: assim continua funcionando mesmo em páginas/estados onde
  // proj.db_id não veio hidratado (ex.: portfólio ainda no seed local), do mesmo jeito
  // que o bloco sempre dependeu só do nome, nunca de um id.
  const QUERY_MATRIZ_CELULAS = "select=estado,deleted_at,canal:meta_inovacao_canais(nome),projeto:meta_inovacao_projetos(iniciativa)";
  function matrizHtml(linhas, nomeIniciativa) {
    const preenchidas = (linhas || [])
      .filter((r) => !r.deleted_at && r.estado && r.projeto && r.projeto.iniciativa === nomeIniciativa)
      .map((r) => ({ nome: (r.canal && r.canal.nome) || "canal", valor: r.estado }));
    if (!preenchidas.length) return vazio("Iniciativa ainda não tem célula preenchida na Matriz.");
    return preenchidas.map((x) => {
      const chave = root.CC_STATUS ? CC_STATUS.chaveDeEntrada("celula_matriz", x.valor) : x.valor;
      return '<div class="drawer-linha"><span>' + esc(x.nome) + "</span>" + (root.CC_STATUS ? CC_STATUS.badge(chave) : esc(x.valor)) + "</div>";
    }).join("") + verMais("demandas.html", "Ver Matriz de demandas completa");
  }

  function proximosEncontrosHtml() {
    const encontros = (root.DB && root.DB.agenda && root.DB.agenda.encontros) || [];
    const h = hoje();
    const porCanal = Object.fromEntries(((root.DB && root.DB.canais) || []).map((c) => [c.id, c]));
    const proximos = encontros.filter((e) => e.data && e.data >= h).sort((a, b) => a.data.localeCompare(b.data)).slice(0, 3);
    if (!proximos.length) return vazio("Nenhum encontro com data definida ainda.");
    return proximos.map((e) => {
      const c = porCanal[e.canal];
      return '<div class="drawer-linha"><span>' + esc(c ? c.nome : e.canal) + "</span><span class=\"mono\">" + esc(fmtBR(e.data)) + "</span></div>";
    }).join("");
  }

  /* ==================== PAINEL DE PESSOA ==================== */

  async function abrirPessoa(id) {
    const lista = (root.DB && root.DB.responsaveis) || [];
    const p = lista.find((x) => x.id === id);
    if (!p) {
      mostrar("Pessoa não encontrada");
      elCorpo.innerHTML = vazio('Não achei o id "' + id + '" na lista canônica (data/pessoas.js.responsaveis).');
      return;
    }
    mostrar(p.nome);
    const h = hoje();
    const nos = ((root.DB && root.DB.nos && root.DB.nos.nos) || []).filter((n) => idsDeTexto(n.guardiao).includes(id));
    const plano = ((root.DB && root.DB.plano) || []).filter((a) => Array.isArray(a.responsavel_id) && a.responsavel_id.includes(id));
    const acoesAtrasadas = plano.filter((a) => root.CALC && root.CALC.ehAtrasada(a, h));
    const acoesResto = plano.filter((a) => !acoesAtrasadas.includes(a)).sort((a, b) => (a.prazo_iso || "").localeCompare(b.prazo_iso || ""));
    const acoesOrdenadas = acoesAtrasadas.concat(acoesResto);
    const idAtividades = "drawer-ativ-pessoa";

    elCorpo.innerHTML =
      bloco("Papéis", papeisHtml(p, id)) +
      bloco("Nós do caminho crítico onde é guardiã",
        nos.length ? nos.map((n) => '<div class="drawer-linha"><a href="caminho.html#no' + n.no + '">Nó ' + n.no + " — " + esc(n.titulo) + "</a></div>").join("") : vazio("Não é guardiã de nenhum nó.")) +
      bloco("Ações do plano sob responsabilidade",
        (acoesOrdenadas.length
          ? acoesOrdenadas.slice(0, 8).map((a) => {
              const [cls, rot] = root.stClass ? root.stClass(a, h) : ["st-nao", a.status];
              return '<a class="drawer-linha" href="plano.html?q=' + encodeURIComponent(a.id) + "#" + a.id + '"><span>' + esc(a.id) + " — " + esc(a.atividade) + '</span><span class="chip ' + cls + '">' + rot + "</span></a>";
            }).join("") + (acoesOrdenadas.length > 8 ? '<p class="drawer-nota">+ ' + (acoesOrdenadas.length - 8) + " outra(s).</p>" : "")
          : vazio("Nenhuma ação do plano sob esta responsabilidade."))) +
      blocoAsync("Atividades por iniciativa", idAtividades) +
      '<div class="drawer-bloco">' + verMais("minhas-acoes.html?pessoa=" + encodeURIComponent(id), "Ver tudo em Minhas ações") + "</div>";

    preencherBlocoAsync(idAtividades, supaBuscar("plano_acao_atividades", "responsavel=eq." + encodeURIComponent(id) + "&deleted_at=is.null"), (linhas) => atividadesIniciativaHtml(linhas));
  }

  // "Representante de X" aqui embaixo continua casando por TEXTO (idsDeTexto), não pela
  // junção do item 2.2 — decisão de escopo do item 4.4, não esquecimento: a direção
  // pessoa→projetos exigiria uma segunda tradução (id LEGADO de 32 curados → pessoa_id
  // golden, hoje só resolvida por js/db-responsaveis.js.LEGADO, item 4.3 — não carregado
  // nas páginas que abrem este painel) só pra alimentar um casamento que, no fim, ainda
  // seria por nome dos dois lados. O ganho de correção do item 4.4 é o sentido
  // projeto→representante (representantesHtml() acima, painel de INICIATIVA) — é ali que
  // o texto livre podia divergir da FK (alias, nome duplicado); a lista abaixo raramente
  // é alcançada a partir de participantes.html (grupo "Projetos" não ganha card próprio
  // lá, ver comentário em participantes.html) e nunca teve esse risco de ambiguidade
  // maior que o resto do texto livre que este item não tocou (ex.: data/pessoas.js).
  function papeisHtml(p, id) {
    const linhas = [];
    ((root.DB && root.DB.pessoas) || []).forEach((raw) => {
      if (idsDeTexto(raw.nome).includes(id)) {
        linhas.push(esc(raw.grupo) + (raw.papel ? " — " + esc(raw.papel) : "") + (raw.nucleo ? " (" + esc(raw.nucleo) + ")" : ""));
      }
    });
    ((root.DB && root.DB.projetos) || []).forEach((proj) => {
      (proj.representantes || []).forEach((r) => {
        if (idsDeTexto(r).includes(id)) linhas.push("Representante de " + esc(proj.iniciativa) + " (" + esc(proj.nucleo) + ")");
      });
    });
    if (!linhas.length) return vazio("Sem papel registrado em data/pessoas.js ou data/projetos.js.");
    return linhas.map((l) => "<div>" + l + "</div>").join("");
  }

  /* ==================== helpers públicos pra marcar nomes como clicáveis ====================
     Uso: nas páginas, ao montar HTML, trocar esc(nome) por DRAWER.spanIniciativa(nome) /
     DRAWER.spanPessoa(nome). Se o nome não resolver pra ninguém conhecido (pessoa sem id
     canônico — ex.: liderança externa da URC), devolve texto plano, sem inventar link. */
  function spanIniciativa(nome) {
    if (!nome) return "";
    return '<span class="entidade-clicavel" data-drawer-iniciativa="' + esc(nome) + '">' + esc(nome) + "</span>";
  }
  function spanPessoa(nomeOuId, ehId) {
    if (!nomeOuId) return "";
    const id = ehId ? nomeOuId : idsDeTexto(nomeOuId)[0];
    if (!id) return esc(nomeOuId);
    const rotulo = ehId ? nomeResponsavel(nomeOuId) : nomeOuId;
    return '<span class="entidade-clicavel" data-drawer-pessoa="' + esc(id) + '">' + esc(rotulo) + "</span>";
  }
  // wrap por token: preserva o texto original ("Sandra/Gerência"), só marca os pedaços
  // que resolvem pra um id conhecido — usado em plano.html (campo "resp" combinado)
  function spanPessoasEmTexto(texto) {
    if (!texto) return "";
    const partes = String(texto).split(/(\s+e\s+|\/|\+|,\s*)/i); // captura os separadores junto
    return partes.map((parte) => {
      if (/^\s+e\s+|^\/|^\+|^,\s*$/i.test(parte) || !parte.trim()) return esc(parte);
      const id = idsDeTexto(parte)[0];
      return id ? spanPessoa(id, true) : esc(parte);
    }).join("");
  }

  /* ==================== roteamento por hash + delegação de clique ==================== */

  function aplicarHash() {
    if (fechandoPorHash) return;
    const h = location.hash;
    if (h.indexOf("#iniciativa=") === 0) abrirIniciativa(decodeURIComponent(h.slice(12)));
    else if (h.indexOf("#pessoa=") === 0) abrirPessoa(decodeURIComponent(h.slice(8)));
  }

  function ligarDelegacao() {
    document.addEventListener("click", (e) => {
      const elIni = e.target.closest("[data-drawer-iniciativa]");
      if (elIni) { e.preventDefault(); location.hash = "iniciativa=" + encodeURIComponent(slugify(elIni.dataset.drawerIniciativa)); return; }
      const elPes = e.target.closest("[data-drawer-pessoa]");
      if (elPes) { e.preventDefault(); location.hash = "pessoa=" + encodeURIComponent(elPes.dataset.drawerPessoa); }
    });
    window.addEventListener("hashchange", aplicarHash);
  }

  function montarQuandoPronto() {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
    else iniciar();
  }
  function iniciar() {
    ligarDelegacao();
    if (location.hash) aplicarHash();
  }

  const DRAWER = {
    abrirIniciativa: abrirIniciativa,
    abrirPessoa: abrirPessoa,
    fechar: fechar,
    spanIniciativa: spanIniciativa,
    spanPessoa: spanPessoa,
    spanPessoaGolden: spanPessoaGolden,
    spanPessoasEmTexto: spanPessoasEmTexto,
    slugify: slugify,
  };
  root.DRAWER = DRAWER;
  montarQuandoPronto();
})(this);
