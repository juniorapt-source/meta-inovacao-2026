/* editor.html — aba "Projetos & Representantes" (item 4.1 do plano de melhorias).
 *
 * 5ª etapa da extração do inline de editor.html pro próprio arquivo (ver BACKLOG.md,
 * "editor.html grande demais"; Histórico, Matriz, Corsário e URC foram as etapas 1-4).
 *
 * Estado privado deste módulo: projRepresentantesAtual (vínculo projeto×pessoa,
 * meta_inovacao_projeto_representantes), formNovoProjRepresentantesSelecionados e
 * formNovoProjetoAberto — confirmado que só esta aba os usava antes de mover.
 *
 * DUAS dependências cross-arquivo de verdade (mesmo padrão da etapa 4 — URC — com
 * pessoasAtual, ver comentário lá):
 *   - pessoasAtual/pessoasFallback são compartilhados com Pessoas (ainda em
 *     editor.html) e URC (js/editor-urc.js) — lidos/escritos via
 *     window.EDITOR_PESSOAS_CACHE (definido em js/editor-shared.js desde 29/08/2026,
 *     D6.1).
 *   - projetosAtual/projetosFallback/projetosCarregando são compartilhados com
 *     projetoIdPorIniciativa() (fica em js/editor-shared.js desde 29/08/2026, D6.1,
 *     usado pela aba Corsário) — lidos/escritos via window.EDITOR_PROJETOS_CACHE
 *     (definido em editor.html, ao lado da declaração da variável). Antes do D6.1,
 *     projetoIdPorIniciativa() fechava sobre projetosAtual direto, no mesmo closure
 *     desta declaração; agora que mora em outro arquivo, passa pelo getter/setter como
 *     qualquer outro consumidor de fora.
 *
 * Depende dos globais já expostos por js/editor-shared.js (window.opts,
 * window.avisoFallback, window.marcarLinhaStatus, window.detErro,
 * window.nucleosPorNome, window.normalizarNomePessoa, window.nomeExibicaoPessoa,
 * window.NUCLEOS_VALIDOS) e dos globais de sempre (esc, EDITOR_ATUAL, DB_PROJETOS,
 * DB_PESSOAS, DB_PROJETO_REPRESENTANTES, DB_CORSARIO).
 *
 * API exposta: window.EDITOR_PROJETOS.render() — chamado pelo dispatcher de abas
 * (render(), em editor.html) quando o <select id="ed-conjunto"> está em "projetos".
 */
(function () {
  "use strict";

  let projRepresentantesAtual = null;
  let formNovoProjRepresentantesSelecionados = [];
  let formNovoProjetoAberto = false;

  // item 4.1 — chips + <select> de "+ adicionar pessoa…" pro formulário de "Novo
  // projeto" (representantes escolhidos ANTES de o projeto existir, então não há
  // projeto_id ainda pra gravar em meta_inovacao_projeto_representantes — fica em
  // memória, o vínculo de verdade só é gravado em criarProjeto(), depois do projeto
  // nascer). Indicação pendente (texto livre, ex.: "Núcleo de Startups", ver
  // docs/GOVERNANCA_GOLDEN_RECORD.md) continua possível lado a lado: quem digitar ali
  // não vira vínculo em meta_inovacao_projeto_representantes, só entra no
  // representantes[] (texto), igual à linha que já existe em produção.
  function nvpReprAreaHtml() {
    const pessoasAtual = EDITOR_PESSOAS_CACHE.obter().lista;
    const escolhidos = new Set(formNovoProjRepresentantesSelecionados.map(ps => String(ps.db_id)));
    const disponiveis = (pessoasAtual || []).filter(ps => ps.ativo !== false && !escolhidos.has(String(ps.db_id)))
      .slice().sort((a, b) => nomeExibicaoPessoa(a).localeCompare(nomeExibicaoPessoa(b), "pt-BR"));
    const chips = formNovoProjRepresentantesSelecionados.map(ps =>
      '<span class="chip pessoa">' + esc(nomeExibicaoPessoa(ps)) +
      ' <button type="button" class="ed-chip-remover" data-remover-nvp-repr="' + esc(String(ps.db_id)) + '" title="Remover">×</button></span>'
    ).join("");
    return chips +
      '<select id="nvp-repr-select"><option value="">+ adicionar pessoa…</option>' +
      disponiveis.map(ps => '<option value="' + esc(String(ps.db_id)) + '">' + esc(nomeExibicaoPessoa(ps)) + '</option>').join("") +
      '</select> <input type="text" id="nvp-repr-placeholder" placeholder="ou indicação pendente, ex.: Núcleo de Startups">';
  }
  function ligarNvpReprHandlers() {
    const pessoasAtual = EDITOR_PESSOAS_CACHE.obter().lista;
    const reprSel = document.getElementById("nvp-repr-select");
    if (reprSel) reprSel.addEventListener("change", e => {
      const id = e.target.value; if (!id) return;
      const pessoa = (pessoasAtual || []).find(ps => String(ps.db_id) === id);
      if (pessoa && !formNovoProjRepresentantesSelecionados.some(ps => String(ps.db_id) === id)) formNovoProjRepresentantesSelecionados.push(pessoa);
      atualizarNvpReprArea();
    });
    document.querySelectorAll("[data-remover-nvp-repr]").forEach(btn => btn.addEventListener("click", e => {
      const id = e.target.dataset.removerNvpRepr;
      formNovoProjRepresentantesSelecionados = formNovoProjRepresentantesSelecionados.filter(ps => String(ps.db_id) !== id);
      atualizarNvpReprArea();
    }));
  }
  // re-renderiza só a área de chips/select — preserva o que já foi digitado em
  // Núcleo/Iniciativa/placeholder (um innerHTML da ed-nova inteira apagaria o que o
  // usuário ainda não confirmou, porque os valores só voltam pro estado no "Adicionar").
  function atualizarNvpReprArea() {
    const cont = document.getElementById("nvp-repr-area");
    if (!cont) return;
    const placeholderAntes = (document.getElementById("nvp-repr-placeholder") || {}).value || "";
    cont.innerHTML = nvpReprAreaHtml();
    const placeholderEl = document.getElementById("nvp-repr-placeholder");
    if (placeholderEl) placeholderEl.value = placeholderAntes;
    ligarNvpReprHandlers();
  }

  async function render() {
    const area = document.getElementById("ed-area");
    const sel = document.getElementById("ed-conjunto");

    const cacheProjInicial = EDITOR_PROJETOS_CACHE.obter();
    if (!cacheProjInicial.lista && !cacheProjInicial.carregando) {
      EDITOR_PROJETOS_CACHE.marcarCarregando(true);
      area.innerHTML = '<div class="ed-carregando">Carregando projetos…</div>';
      try {
        // item 4.1 — o seletor de pessoa precisa de DB_PESSOAS (lista pra escolher) e
        // DB_PROJETO_REPRESENTANTES (vínculo projeto×pessoa, item 2.2) junto com
        // DB_PROJETOS; reaproveita a cache de pessoas se a aba "Pessoas"/URC já
        // carregou antes (EDITOR_PESSOAS_CACHE), pra não buscar a mesma tabela duas vezes.
        const cachePessoas0 = EDITOR_PESSOAS_CACHE.obter();
        const [projRes, pessoasRes, represRes] = await Promise.all([
          DB_PROJETOS.carregar(),
          cachePessoas0.lista ? Promise.resolve({ lista: cachePessoas0.lista, usandoFallback: cachePessoas0.fallback }) : DB_PESSOAS.carregar(),
          DB_PROJETO_REPRESENTANTES.carregar(),
        ]);
        EDITOR_PROJETOS_CACHE.definir(projRes.lista, projRes.usandoFallback);
        EDITOR_PESSOAS_CACHE.definir(pessoasRes.lista, pessoasRes.usandoFallback);
        projRepresentantesAtual = represRes.lista;
      } catch (err) {
        console.error("editor: falha ao carregar projetos", err);
        EDITOR_PROJETOS_CACHE.marcarCarregando(false);
        area.innerHTML = '<div class="ed-erro-carregar">Não foi possível carregar projetos  agora.</div>';
        return;
      }
      EDITOR_PROJETOS_CACHE.marcarCarregando(false);
    }
    if (sel.value !== "projetos") return;
    const cacheProj = EDITOR_PROJETOS_CACHE.obter();
    const cachePessoas = EDITOR_PESSOAS_CACHE.obter();
    const pessoasAtual = cachePessoas.lista, pessoasFallback = cachePessoas.fallback;
    const lista = cacheProj.lista || [];
    const dis = cacheProj.fallback ? " disabled" : "";
    // "adicionar representante" exige rede (grava em duas tabelas) — some no fallback,
    // mesmo critério de "+ Novo projeto" logo abaixo.
    const disRepr = (cacheProj.fallback || pessoasFallback) ? " disabled" : "";
    let h = cacheProj.fallback ? avisoFallback("data/projetos.js") : "";
    const pessoasPorId = {};
    (pessoasAtual || []).forEach(ps => { pessoasPorId[String(ps.db_id)] = ps; });
    const pessoasSelecionaveis = (pessoasAtual || []).filter(ps => ps.ativo !== false)
      .slice().sort((a, b) => nomeExibicaoPessoa(a).localeCompare(nomeExibicaoPessoa(b), "pt-BR"));
    const represPorProjeto = DB_PROJETO_REPRESENTANTES.porProjeto(projRepresentantesAtual);
    // "+ Novo projeto" — cria uma iniciativa nova direto no golden record (meta_inovacao_projetos
    // via DB_PROJETOS.criar). É a ÚNICA porta de entrada de projeto novo no site (demandas.html
    // deixou de criar iniciativa na camada 1 da governança). Some no modo fallback (sem rede).
    h += '<div class="ed-topo" style="margin-bottom:12px"><button type="button" id="ed-abrir-novo-proj" class="ed-btn"' + dis + '>+ Novo projeto</button></div>';
    h += '<div id="ed-form-novo-proj" class="ed-nova" style="display:' + (formNovoProjetoAberto ? "block" : "none") + '">' +
      '<h3>Novo projeto</h3>' +
      '<div class="ed-nova-grid">' +
        '<div data-campo="nucleo"><label>Núcleo *</label><select id="nvp-nucleo">' + opts(NUCLEOS_VALIDOS, NUCLEOS_VALIDOS[0]) + '</select></div>' +
        '<div class="full" data-campo="iniciativa"><label>Iniciativa *</label><input type="text" id="nvp-iniciativa" placeholder="ex.: Nova iniciativa X">' +
          '<span class="ed-erro-msg">Obrigatório.</span></div>' +
        '<div class="full" data-campo="representantes"><label>Representantes *</label>' +
          '<div id="nvp-repr-area" class="ed-repr-cel">' + nvpReprAreaHtml() + '</div>' +
          '<span class="ed-erro-msg">Escolha ao menos uma pessoa, ou preencha a indicação pendente.</span></div>' +
      '</div>' +
      '<div class="ed-nova-acoes"><button type="button" id="ed-confirmar-novo-proj" class="ed-btn">Adicionar</button>' +
        '<button type="button" id="ed-cancelar-novo-proj" class="ed-btn sec">Cancelar</button></div>' +
    '</div>';
    h += '<div class="ed-wrap"><table class="ed-tab"><thead><tr><th style="width:220px">Núcleo</th><th>Iniciativa</th><th>Representantes</th><th style="width:70px"></th></tr></thead><tbody>';
    lista.forEach((p) => {
      const vinculos = represPorProjeto[p.db_id] || [];
      const jaSelecionados = new Set(vinculos.map(v => String(v.pessoa_id)));
      const disponiveis = pessoasSelecionaveis.filter(ps => !jaSelecionados.has(String(ps.db_id)));
      const chips = vinculos.map(v => {
        const pessoa = pessoasPorId[String(v.pessoa_id)];
        const nomeRepr = pessoa ? nomeExibicaoPessoa(pessoa) : "pessoa removida";
        return '<span class="chip pessoa" data-pessoa="' + esc(String(v.pessoa_id)) + '">' + esc(nomeRepr) +
          ' <button type="button" class="ed-chip-remover" data-remover-repr="' + esc(String(v.db_id)) + '" title="Remover representante" aria-label="Remover ' + esc(nomeRepr) + '"' + disRepr + '>×</button></span>';
      }).join("") || (vinculos.length ? "" : '<span class="ed-repr-vazio">' + esc((p.representantes || []).join(", ") || "nenhum") + '</span>');
      h += '<tr data-id="' + esc(String(p.db_id)) + '">' +
        '<td><select data-f="nucleo"' + dis + '>' + opts(NUCLEOS_VALIDOS, p.nucleo) + '</select></td>' +
        '<td><input type="text" data-f="iniciativa" value="' + esc(p.iniciativa) + '"' + dis + '></td>' +
        '<td><div class="ed-repr-cel">' + chips +
          '<select class="ed-add-repr" data-projeto="' + esc(String(p.db_id)) + '"' + disRepr + '><option value="">+ adicionar…</option>' +
          disponiveis.map(ps => '<option value="' + esc(String(ps.db_id)) + '">' + esc(nomeExibicaoPessoa(ps)) + '</option>').join("") +
          '</select></div></td>' +
        '<td><span class="ed-row-status" aria-live="polite"></span> <button type="button" class="ed-btn sec" data-del="' + esc(String(p.db_id)) + '" style="padding:4px 8px"' + dis + ' title="Remover projeto">×</button></td></tr>';
    });
    area.innerHTML = h + '</tbody></table></div>';

    area.querySelectorAll("tbody select[data-f],tbody input[data-f]").forEach(el => el.addEventListener("change", async e => {
      const t = e.target, tr = t.closest("tr"), id = tr.dataset.id, campo = t.dataset.f;
      const valor = t.value;
      const p = lista.find(x => String(x.db_id) === id);
      if (p) p[campo] = valor;
      marcarLinhaStatus(tr, "salvando");
      try {
        // item 5.5 — trocar o núcleo grava nucleo_id junto com o texto, mesmo padrão de
        // sincronia dos itens 4.1/4.2 (a FK anda junto do campo que o <select> já mostra,
        // sem virar um segundo controle na tela).
        const patch = { [campo]: valor };
        if (campo === "nucleo") {
          const porNome = await nucleosPorNome();
          patch.nucleo_id = porNome[valor] || null;
          if (p) p.nucleo_id = patch.nucleo_id;
        }
        await DB_PROJETOS.salvar(p.db_id, patch, EDITOR_ATUAL.nomeAtual());
        marcarLinhaStatus(tr, "salvo");
      } catch (err) {
        console.error("editor: falha ao salvar projeto", err);
        marcarLinhaStatus(tr, (window.CC_SUPABASE && CC_SUPABASE.mensagemEscritaAmigavel(err)) || "falhou", detErro(err));
      }
    }));

    // item 4.1 — adicionar representante: grava o vínculo em
    // meta_inovacao_projeto_representantes (fonte nova) e, best-effort, sincroniza
    // representantes[] (texto legado que projetos.html/index.html/js/drawer.js/
    // js/busca.js ainda leem) — uma falha só na sincronia do texto não desfaz o
    // vínculo, só fica registrada no console pra investigar depois.
    area.querySelectorAll(".ed-add-repr").forEach(elSel => elSel.addEventListener("change", async e => {
      const t = e.target, tr = t.closest("tr"), projetoId = t.dataset.projeto, pessoaIdStr = t.value;
      if (!pessoaIdStr) return;
      const p = lista.find(x => String(x.db_id) === projetoId);
      const pessoa = pessoasPorId[pessoaIdStr];
      if (!p || !pessoa) return;
      t.disabled = true;
      marcarLinhaStatus(tr, "salvando");
      try {
        const vinculosAtuais = represPorProjeto[p.db_id] || [];
        const proximaOrdem = vinculosAtuais.length ? Math.max.apply(null, vinculosAtuais.map(v => v.ordem || 0)) + 1 : 1;
        const criado = await DB_PROJETO_REPRESENTANTES.criar({ projeto_id: p.db_id, pessoa_id: Number(pessoaIdStr), ordem: proximaOrdem }, EDITOR_ATUAL.nomeAtual());
        projRepresentantesAtual.push(criado);
        try {
          const novoTexto = (p.representantes || []).concat([pessoa.nome]);
          await DB_PROJETOS.salvar(p.db_id, { representantes: novoTexto }, EDITOR_ATUAL.nomeAtual());
          p.representantes = novoTexto;
        } catch (errTexto) {
          console.error("editor: representante vinculado, mas falhou ao sincronizar representantes[] (texto legado) — pode ficar desatualizado em projetos.html/index.html até o próximo ajuste", errTexto);
        }
        marcarLinhaStatus(tr, "salvo");
        render();
      } catch (err) {
        console.error("editor: falha ao adicionar representante", err);
        marcarLinhaStatus(tr, (window.CC_SUPABASE && CC_SUPABASE.mensagemEscritaAmigavel(err)) || "falhou", detErro(err));
        t.disabled = false;
      }
    }));

    // item 4.1 — remover representante: soft-delete do vínculo + tenta tirar o token
    // correspondente de representantes[], casando pela mesma régua de normalização de
    // tools/sql/2026-08_projeto_representantes.sql (nome ou nome_exibicao). Se não achar
    // (nome divergente demais do texto legado), só o vínculo sai — o texto fica como
    // estava, sem risco de remover o token errado.
    area.querySelectorAll("[data-remover-repr]").forEach(btn => btn.addEventListener("click", async e => {
      const t = e.target, tr = t.closest("tr"), chip = t.closest(".chip");
      const vinculoId = t.dataset.removerRepr;
      const projetoId = tr.dataset.id;
      const p = lista.find(x => String(x.db_id) === projetoId);
      const pessoaIdStr = chip && chip.dataset.pessoa;
      const pessoa = pessoaIdStr ? pessoasPorId[pessoaIdStr] : null;
      const nomeRepr = pessoa ? nomeExibicaoPessoa(pessoa) : "este representante";
      if (!window.confirm('Remover "' + nomeRepr + '" dos representantes de "' + (p ? p.iniciativa : "este projeto") + '"?')) return;
      marcarLinhaStatus(tr, "salvando");
      try {
        await DB_PROJETO_REPRESENTANTES.removerSoft(vinculoId, EDITOR_ATUAL.nomeAtual());
        projRepresentantesAtual = (projRepresentantesAtual || []).filter(v => String(v.db_id) !== vinculoId);
        if (p && pessoa) {
          const idx = (p.representantes || []).findIndex(tok => {
            const n = normalizarNomePessoa(tok);
            return n === normalizarNomePessoa(pessoa.nome) || n === normalizarNomePessoa(pessoa.nome_exibicao);
          });
          if (idx >= 0) {
            const novoTexto = p.representantes.slice(0, idx).concat(p.representantes.slice(idx + 1));
            try {
              await DB_PROJETOS.salvar(p.db_id, { representantes: novoTexto }, EDITOR_ATUAL.nomeAtual());
              p.representantes = novoTexto;
            } catch (errTexto) {
              console.error("editor: representante desvinculado, mas falhou ao sincronizar representantes[] (texto legado)", errTexto);
            }
          }
        }
        marcarLinhaStatus(tr, "salvo");
        render();
      } catch (err) {
        console.error("editor: falha ao remover representante", err);
        marcarLinhaStatus(tr, (window.CC_SUPABASE && CC_SUPABASE.mensagemEscritaAmigavel(err)) || "falhou", detErro(err));
      }
    }));

    area.querySelectorAll("[data-del]").forEach(btn => btn.addEventListener("click", async e => {
      const id = e.target.dataset.del;
      const p = (EDITOR_PROJETOS_CACHE.obter().lista || []).find(x => String(x.db_id) === id);
      const nomeProj = p ? p.iniciativa : "este projeto";
      // soft-delete (deleted_at) — some do golden record e, via camada 2, de todas as telas;
      // a linha continua no banco pra auditoria, só filtrada por deleted_at is null.
      if (!window.confirm('Remover o projeto "' + nomeProj + '"? Ele sai do portfólio (golden record) e de todas as telas.')) return;
      try {
        await DB_PROJETOS.removerSoft(id, EDITOR_ATUAL.nomeAtual());
        const filtrada = (EDITOR_PROJETOS_CACHE.obter().lista || []).filter(x => String(x.db_id) !== id);
        EDITOR_PROJETOS_CACHE.definir(filtrada, EDITOR_PROJETOS_CACHE.obter().fallback);
        render();
      } catch (err) {
        console.error("editor: falha ao remover projeto", err);
        window.alert((window.CC_SUPABASE && CC_SUPABASE.mensagemEscritaAmigavel(err)) || (err && err.message) || "Não consegui remover o projeto.");
      }
    }));

    const btnAbrirNovoProj = document.getElementById("ed-abrir-novo-proj");
    if (btnAbrirNovoProj) btnAbrirNovoProj.addEventListener("click", () => { formNovoProjetoAberto = true; formNovoProjRepresentantesSelecionados = []; render(); });
    if (formNovoProjetoAberto) {
      document.getElementById("ed-cancelar-novo-proj").addEventListener("click", () => { formNovoProjetoAberto = false; formNovoProjRepresentantesSelecionados = []; render(); });
      document.getElementById("ed-confirmar-novo-proj").addEventListener("click", criarProjeto);
      ligarNvpReprHandlers();
      const iniEl = document.getElementById("nvp-iniciativa");
      if (iniEl) iniEl.focus();
    }
  }

  async function criarProjeto() {
    const campo = id => document.getElementById(id);
    const iniciativa = campo("nvp-iniciativa").value.trim();
    const selecionados = formNovoProjRepresentantesSelecionados.slice();
    const placeholderTexto = (campo("nvp-repr-placeholder") || {}).value ? campo("nvp-repr-placeholder").value.trim() : "";
    document.querySelectorAll("#ed-form-novo-proj .ed-campo-erro").forEach(el => el.classList.remove("ed-campo-erro"));
    let erro = false;
    if (!iniciativa) { document.querySelector('#ed-form-novo-proj [data-campo="iniciativa"]').classList.add("ed-campo-erro"); erro = true; }
    // representantes >= 1: mesmo requisito do validar_dados.py (o seed regenerado pela camada 3
    // precisa passar); se a indicação nominal ainda não veio, usar o placeholder de texto.
    if (!selecionados.length && !placeholderTexto) { document.querySelector('#ed-form-novo-proj [data-campo="representantes"]').classList.add("ed-campo-erro"); erro = true; }
    if (erro) return;
    const projetosAtual = EDITOR_PROJETOS_CACHE.obter().lista;
    const jaExiste = (projetosAtual || []).some(p => p.iniciativa.toLowerCase() === iniciativa.toLowerCase());
    if (jaExiste) {
      window.alert('Já existe um projeto chamado "' + iniciativa + '" — edite a linha dele na tabela em vez de criar de novo.');
      return;
    }
    const representantesTexto = selecionados.map(ps => ps.nome).concat(placeholderTexto ? [placeholderTexto] : []);
    const nucleoEscolhido = campo("nvp-nucleo").value;
    // item 5.5 — projeto novo já nasce com nucleo_id, não só o texto.
    const porNome = await nucleosPorNome();
    const nova = {
      nucleo: nucleoEscolhido,
      nucleo_id: porNome[nucleoEscolhido] || null,
      iniciativa: iniciativa,
      representantes: representantesTexto,
      ordem: (projetosAtual || []).length + 1
    };
    const btn = document.getElementById("ed-confirmar-novo-proj");
    btn.disabled = true;
    try {
      const criado = await DB_PROJETOS.criar(nova, EDITOR_ATUAL.nomeAtual());
      projetosAtual.push(criado); // mesma referência de array de EDITOR_PROJETOS_CACHE — muta em conjunto
      // item 4.1 — vincula cada pessoa escolhida no seletor em
      // meta_inovacao_projeto_representantes; o texto de indicação pendente (se
      // preenchido) não vira vínculo de propósito, mesmo padrão do "Núcleo de
      // Startups" já existente em produção (docs/GOVERNANCA_GOLDEN_RECORD.md).
      for (let i = 0; i < selecionados.length; i++) {
        try {
          const vinculo = await DB_PROJETO_REPRESENTANTES.criar({ projeto_id: criado.db_id, pessoa_id: selecionados[i].db_id, ordem: i + 1 }, EDITOR_ATUAL.nomeAtual());
          projRepresentantesAtual.push(vinculo);
        } catch (errRepr) {
          console.error("editor: projeto criado, mas falhou ao vincular representante \"" + selecionados[i].nome + "\"", errRepr);
        }
      }
      // Propaga pro "Caminho do Corsário". O golden record (meta_inovacao_projetos) é a fonte
      // única, mas a tela do Corsário monta a lista de iniciativas a partir de corsario_status
      // (tabela à parte, status por iniciativa×critério) — sem semear essa tabela, o projeto
      // novo ficaria invisível lá. Cria 1 linha por critério, todas "não se aplica" (nasce
      // "não avaliada", fora da régua, não "reprovada em tudo"), exatamente como o botão
      // "+ Nova iniciativa" do conjunto Corsário. Falha aqui NÃO desfaz o projeto (ele já está
      // no golden) — só avisa, pra reconciliar depois pelo conjunto "O Caminho para o Corsário".
      try {
        const corsario = await DB_CORSARIO.carregar();
        if (corsario.usandoFallback || !(corsario.criterios || []).length) {
          window.alert('Projeto criado. Mas não consegui carregar o Caminho do Corsário agora para incluí-lo lá — abra o conjunto "O Caminho para o Corsário" mais tarde e crie a iniciativa "' + criado.iniciativa + '" por lá.');
        } else {
          const jaNoCorsario = (corsario.statusRows || []).some(r => String(r.iniciativa).toLowerCase() === criado.iniciativa.toLowerCase());
          if (!jaNoCorsario) {
            // item 5.7 — as duas FKs já estão em mãos (o projeto acabou de nascer): não
            // precisa da régua de nome de projetoIdPorIniciativa/nucleosPorNome, é o
            // db_id/nucleo_id do próprio `criado`.
            const criadas = await DB_CORSARIO.criarIniciativa(criado.iniciativa, criado.nucleo, corsario.criterios, EDITOR_ATUAL.nomeAtual(), { projetoId: criado.db_id, nucleoId: criado.nucleo_id });
            corsario.statusRows.push(...criadas); // mantém o cache do DB_CORSARIO em dia, pra o próximo render do conjunto já mostrar a iniciativa nova
          }
        }
      } catch (errCorsario) {
        console.error("editor: projeto criado no golden, mas falhou ao semear o Corsário", errCorsario);
        window.alert('Projeto criado. Mas não consegui incluí-lo automaticamente no Caminho do Corsário — crie a iniciativa "' + criado.iniciativa + '" no conjunto "O Caminho para o Corsário".');
      }
      formNovoProjetoAberto = false;
      formNovoProjRepresentantesSelecionados = [];
      render();
    } catch (err) {
      console.error("editor: falha ao criar projeto", err);
      btn.disabled = false;
      window.alert((window.CC_SUPABASE && CC_SUPABASE.mensagemEscritaAmigavel(err)) || "Não consegui criar o projeto: " + ((err && err.message) || err));
    }
  }

  window.EDITOR_PROJETOS = { render: render };
})();
