/* editor.html — abas "URC — Liderança" e "URC — Responsáveis por canal" (item 4.2).
 *
 * 4ª etapa da extração do inline de editor.html pro próprio arquivo (ver BACKLOG.md,
 * "editor.html grande demais"; Histórico, Matriz e Corsário foram as etapas 1-3). As
 * duas sub-abas viram um módulo só porque compartilham uma única carga — DB_URC.carregar()
 * busca liderança e canais juntos, porque o guardrail de "responsável de canal não pode
 * ter nome de liderança" (item 4.4) precisa da lista de liderança carregada mesmo
 * quando se está editando só os canais.
 *
 * Estado privado deste módulo: urcAtual/urcFallback/urcCarregando (só URC usa) e
 * canaisAtual/canaisFallback (catálogo golden de canais, meta_inovacao_canais — também
 * só URC usa hoje; a aba Matriz busca DB_CANAIS por conta própria, sem cache
 * compartilhado). pessoasAtual/pessoasFallback são DIFERENTES — genuinamente
 * compartilhados com as abas Pessoas e Projetos, que ainda vivem em editor.html — por
 * isso este módulo lê/escreve neles através de window.EDITOR_PESSOAS_CACHE (getter/
 * setter definido em editor.html, ao lado da declaração de pessoasAtual), em vez de uma
 * variável própria: se este módulo carregar primeiro, quem abrir "Pessoas"/"Projetos"
 * depois reaproveita; se uma daquelas já carregou antes, este módulo reaproveita.
 *
 * Depende de globais já expostos em editor.html (window.opts, window.avisoFallback,
 * window.marcarLinhaStatus, window.detErro, window.normalizarNomePessoa,
 * window.nomeExibicaoPessoa — todos precisaram virar window.X explicitamente na etapa 3,
 * porque são declarados dentro do IIFE de editor.html, não são globais "de graça") e dos
 * globais de sempre (esc, EDITOR_ATUAL, DB_URC, DB_PESSOAS, DB_CANAIS).
 *
 * API exposta: window.EDITOR_URC.renderLideranca()/renderCanais() — chamadas pelo
 * dispatcher de abas (render(), em editor.html) pras chaves "urc_lideranca"/"urc_canais".
 */
(function () {
  "use strict";

  let urcAtual = null, urcFallback = false, urcCarregando = false;
  let canaisAtual = null, canaisFallback = false;

  // item 4.2 — carrega junto DB_PESSOAS (seletor de pessoa, liderança e responsável de
  // canal) e DB_CANAIS (seletor de canal, só pra resolver canal_id — a LISTA de opções do
  // <select> continua sendo DB_URC.CANAIS_FIXOS, ver renderCanais). Reaproveita a cache
  // de pessoas se a aba "Pessoas"/"Projetos" já carregou (EDITOR_PESSOAS_CACHE, ver
  // comentário no topo do arquivo).
  async function garantirCarregada() {
    if (urcAtual || urcCarregando) return true;
    urcCarregando = true;
    try {
      const cachePessoas = EDITOR_PESSOAS_CACHE.obter();
      const [urcRes, pessoasRes, canaisRes] = await Promise.all([
        DB_URC.carregar(),
        cachePessoas.lista ? Promise.resolve({ lista: cachePessoas.lista, usandoFallback: cachePessoas.fallback }) : DB_PESSOAS.carregar(),
        canaisAtual ? Promise.resolve({ lista: canaisAtual, usandoFallback: canaisFallback }) : DB_CANAIS.carregar(),
      ]);
      urcAtual = urcRes; urcFallback = urcRes.usandoFallback;
      EDITOR_PESSOAS_CACHE.definir(pessoasRes.lista, pessoasRes.usandoFallback);
      canaisAtual = canaisRes.lista; canaisFallback = canaisRes.usandoFallback;
      return true;
    } catch (err) {
      console.error("editor: falha ao carregar URC", err);
      return false;
    } finally {
      urcCarregando = false;
    }
  }

  // item 4.2 — <select> de pessoa (golden record, meta_inovacao_pessoas) pra "URC —
  // Liderança" e "URC — Responsáveis por canal", no lugar do texto livre. Mesma prioridade
  // de rótulo de nomeExibicaoPessoa(); se a linha ainda não tem pessoa_id (não deveria
  // acontecer — cobertura esperada 100% no item 2.3/2.4), tenta casar pelo texto atual
  // (normalizarNomePessoa, mesma régua do item 4.1) só pra pré-selecionar visualmente, sem
  // gravar nada sozinho. Se não achar ninguém, mostra o texto como opção "não vinculada" —
  // escolher outra pessoa na lista é o que resolve o vínculo.
  function selectPessoaHtml(pessoaIdAtual, nomeAtualTexto, dis) {
    const pessoasAtual = EDITOR_PESSOAS_CACHE.obter().lista;
    const pessoas = (pessoasAtual || []).slice().sort((a, b) => nomeExibicaoPessoa(a).localeCompare(nomeExibicaoPessoa(b), "pt-BR"));
    let atualId = pessoaIdAtual == null ? null : String(pessoaIdAtual);
    if (atualId == null && nomeAtualTexto) {
      const achado = pessoas.find(ps => normalizarNomePessoa(ps.nome) === normalizarNomePessoa(nomeAtualTexto) || normalizarNomePessoa(ps.nome_exibicao) === normalizarNomePessoa(nomeAtualTexto));
      if (achado) atualId = String(achado.db_id);
    }
    const rotuloVazio = atualId ? "— selecionar pessoa —" : (nomeAtualTexto ? nomeAtualTexto + " (não vinculado)" : "— selecionar pessoa —");
    let h = '<option value=""' + (atualId ? "" : " selected") + '>' + esc(rotuloVazio) + '</option>';
    h += pessoas.filter(ps => ps.ativo !== false || String(ps.db_id) === atualId)
      .map(ps => '<option value="' + esc(String(ps.db_id)) + '"' + (String(ps.db_id) === atualId ? " selected" : "") + '>' + esc(nomeExibicaoPessoa(ps)) + '</option>').join("");
    return '<select data-f="pessoa_id"' + dis + '>' + h + '</select>';
  }
  // resolve canal_id a partir do texto do canal (mesma régua da migração 2026-08_urc_canais_fk.sql
  // — igualdade exata contra meta_inovacao_canais.nome), pra manter a FK em sincronia quando o
  // <select> de canal (CANAIS_FIXOS, texto) muda — a LISTA de opções não muda no 4.2 (ver
  // comentário em renderCanais sobre por que os 2 canais golden fora de CANAIS_FIXOS ficam
  // de fora aqui).
  function canalIdPorNome(nomeCanal) {
    const c = (canaisAtual || []).find(x => x.nome === nomeCanal);
    return c ? c.db_id : null;
  }

  async function renderLideranca() {
    const area = document.getElementById("ed-area");
    const sel = document.getElementById("ed-conjunto");

    if (!urcAtual && !urcCarregando) {
      area.innerHTML = '<div class="ed-carregando">Carregando URC…</div>';
      const ok = await garantirCarregada();
      if (!ok) { area.innerHTML = '<div class="ed-erro-carregar">Não foi possível carregar a URC  agora.</div>'; return; }
    }
    if (sel.value !== "urc_lideranca") return;
    const lista = urcAtual.lideranca;
    const dis = urcFallback ? " disabled" : "";
    let h = urcFallback ? avisoFallback("data/urc.js") : "";
    // item 4.2 — "Nome" trocou de <input type="text"> pra <select> de pessoa (golden
    // record, meta_inovacao_pessoas via pessoa_id — item 2.3). Papel/email continuam
    // texto livre (o cargo na URC e o e-mail de contato não têm por que ser os mesmos do
    // cadastro golden de pessoas).
    h += '<div class="ed-wrap"><table class="ed-tab"><thead><tr><th style="width:220px">Nome</th><th>Papel</th><th style="width:220px">Email (opcional)</th><th style="width:70px"></th></tr></thead><tbody>';
    lista.forEach((p) => {
      h += '<tr data-id="' + esc(String(p.db_id)) + '">' +
        '<td>' + selectPessoaHtml(p.pessoa_id, p.nome, dis) + '</td>' +
        '<td><input type="text" data-f="papel" value="' + esc(p.papel || "") + '"' + dis + '></td>' +
        '<td><input type="text" data-f="email" value="' + esc(p.email || "") + '" placeholder="nome@sebrae.com.br"' + dis + '></td>' +
        '<td><span class="ed-row-status" aria-live="polite"></span></td></tr>';
    });
    area.innerHTML = h + '</tbody></table></div>';

    area.querySelectorAll("tbody select[data-f],tbody input[data-f]").forEach(el => el.addEventListener("change", async e => {
      const t = e.target, tr = t.closest("tr"), id = tr.dataset.id, campo = t.dataset.f;
      const p = lista.find(x => String(x.db_id) === id);
      if (!p) return;
      let patch;
      if (campo === "pessoa_id") {
        // trocar a pessoa grava as duas colunas juntas: pessoa_id (FK nova) e nome (texto
        // legado que participantes.html/o guardrail de liderança ainda leem) — mesmo
        // padrão de sincronia best-effort do item 4.1, só que num único UPDATE porque as
        // duas colunas vivem na mesma linha (não numa junção à parte).
        const pessoaId = t.value ? Number(t.value) : null;
        const pessoasAtual = EDITOR_PESSOAS_CACHE.obter().lista;
        const pessoa = pessoaId ? (pessoasAtual || []).find(ps => ps.db_id === pessoaId) : null;
        patch = { pessoa_id: pessoaId, nome: pessoa ? pessoa.nome : p.nome };
      } else {
        const valor = campo === "email" && t.value.trim() === "" ? null : t.value;
        patch = { [campo]: valor };
      }
      marcarLinhaStatus(tr, "salvando");
      try {
        const salvo = await DB_URC.salvarLideranca(p.db_id, patch, EDITOR_ATUAL.nomeAtual());
        Object.assign(p, salvo);
        marcarLinhaStatus(tr, "salvo");
      } catch (err) {
        console.error("editor: falha ao salvar liderança da URC", err);
        marcarLinhaStatus(tr, (window.CC_SUPABASE && CC_SUPABASE.mensagemEscritaAmigavel(err)) || "falhou", detErro(err));
      }
    }));
  }

  async function renderCanais() {
    const area = document.getElementById("ed-area");
    const sel = document.getElementById("ed-conjunto");

    if (!urcAtual && !urcCarregando) {
      area.innerHTML = '<div class="ed-carregando">Carregando URC…</div>';
      const ok = await garantirCarregada();
      if (!ok) { area.innerHTML = '<div class="ed-erro-carregar">Não foi possível carregar a URC  agora.</div>'; return; }
    }
    if (sel.value !== "urc_canais") return;
    const linhas = urcAtual.canaisFlat;
    const dis = urcFallback ? " disabled" : "";
    let h = urcFallback ? avisoFallback("data/urc.js") : "";
    const pessoasAtual = EDITOR_PESSOAS_CACHE.obter().lista;
    // item 4.2 — "+ Adicionar responsável" trocou o prompt() de texto livre por dois
    // <select> (canal + pessoa golden). A LISTA de canais continua sendo
    // DB_URC.CANAIS_FIXOS (os 8 de sempre), não os 10 do catálogo inteiro
    // (meta_inovacao_canais) — "Sebrae na sua empresa"/"Contabilizações e instrumentos"
    // ainda não têm responsável indicado (ver tools/sql/2026-08_urc_canais_fk.sql) e
    // agruparPorCanal() (js/db-urc.js), que participantes.html lê pra montar o card de
    // cada canal, só conhece esses 8; abrir a lista pros 10 sem tocar naquela função faria
    // um responsável cadastrado num canal novo desaparecer silenciosamente de lá.
    const disAdd = (dis || !((pessoasAtual || []).some(ps => ps.ativo !== false))) ? " disabled" : "";
    const pessoasParaAdd = (pessoasAtual || []).filter(ps => ps.ativo !== false).slice().sort((a, b) => nomeExibicaoPessoa(a).localeCompare(nomeExibicaoPessoa(b), "pt-BR"));
    h += '<div class="ed-topo" style="margin-bottom:12px">' +
      '<select id="ed-novo-resp-canal"' + disAdd + '>' + opts(DB_URC.CANAIS_FIXOS, DB_URC.CANAIS_FIXOS[0]) + '</select> ' +
      '<select id="ed-novo-resp-pessoa"' + disAdd + '><option value="">— selecionar pessoa —</option>' +
        pessoasParaAdd.map(ps => '<option value="' + esc(String(ps.db_id)) + '">' + esc(nomeExibicaoPessoa(ps)) + '</option>').join("") +
      '</select> ' +
      '<button type="button" id="ed-add-resp" class="ed-btn"' + disAdd + '>+ Adicionar responsável</button>' +
    '</div>';
    h += '<div class="ed-wrap"><table class="ed-tab"><thead><tr><th style="width:200px">Canal</th><th>Nome *</th><th style="width:220px">Email (opcional)</th><th style="width:70px"></th><th style="width:36px"></th></tr></thead><tbody>';
    linhas.forEach((l) => {
      h += '<tr data-id="' + esc(String(l.db_id)) + '">' +
        '<td><select data-f="canal"' + dis + '>' + opts(DB_URC.CANAIS_FIXOS, l.canal) + '</select></td>' +
        '<td>' + selectPessoaHtml(l.pessoa_id, l.nome, dis) + '</td>' +
        '<td><input type="text" data-f="email" value="' + esc(l.email || "") + '" placeholder="nome@sebrae.com.br"' + dis + '></td>' +
        '<td><span class="ed-row-status" aria-live="polite"></span></td>' +
        '<td><button type="button" class="ed-btn sec" data-del="' + esc(String(l.db_id)) + '" style="padding:4px 8px"' + dis + ' title="Remover">×</button></td></tr>';
    });
    area.innerHTML = h + '</tbody></table></div>';

    // guardrail (item 4.4, tools/validar_dados.py replicado aqui): DB_URC.salvarResponsavel/
    // criarResponsavel recebem a lista de liderança e recusam (throw) se o nome bater com
    // algum líder — a mensagem de erro do próprio módulo já é amigável o bastante pra
    // mostrar direto no indicador da linha, sem precisar traduzir aqui.
    area.querySelectorAll("tbody select[data-f],tbody input[data-f]").forEach(el => el.addEventListener("change", async e => {
      const t = e.target, tr = t.closest("tr"), id = tr.dataset.id, campo = t.dataset.f;
      const linha = linhas.find(x => String(x.db_id) === id);
      if (!linha) return;
      let patch;
      if (campo === "pessoa_id") {
        // mesmo par pessoa_id+nome (texto legado) da liderança, ver renderLideranca —
        // só que aqui vai pelo caminho de salvarResponsavel, que checa o guardrail contra
        // o `nome` do patch antes de gravar.
        const pessoaId = t.value ? Number(t.value) : null;
        const pessoasAtual = EDITOR_PESSOAS_CACHE.obter().lista;
        const pessoa = pessoaId ? (pessoasAtual || []).find(ps => ps.db_id === pessoaId) : null;
        patch = { pessoa_id: pessoaId, nome: pessoa ? pessoa.nome : linha.nome };
      } else if (campo === "canal") {
        // trocar o canal atualiza canal_id junto (mesma régua de igualdade exata da
        // migração 2026-08_urc_canais_fk.sql) — sem isso o <select> mudaria o texto mas a
        // FK ficaria presa no canal antigo.
        patch = { canal: t.value, canal_id: canalIdPorNome(t.value) };
      } else {
        const valor = campo === "email" && t.value.trim() === "" ? null : t.value;
        patch = { [campo]: valor };
      }
      marcarLinhaStatus(tr, "salvando");
      try {
        const salvo = await DB_URC.salvarResponsavel(linha.db_id, patch, EDITOR_ATUAL.nomeAtual(), urcAtual.lideranca);
        Object.assign(linha, salvo);
        marcarLinhaStatus(tr, "salvo");
      } catch (err) {
        console.error("editor: falha ao salvar responsável de canal", err);
        marcarLinhaStatus(tr, (window.CC_SUPABASE && CC_SUPABASE.mensagemEscritaAmigavel(err)) || (err && err.message) || "falhou", detErro(err));
      }
    }));
    area.querySelectorAll("[data-del]").forEach(btn => btn.addEventListener("click", async e => {
      const id = e.target.dataset.del;
      if (!window.confirm("Remover este responsável?")) return;
      try {
        await DB_URC.removerResponsavelSoft(id, EDITOR_ATUAL.nomeAtual());
        urcAtual.canaisFlat = urcAtual.canaisFlat.filter(x => String(x.db_id) !== id);
        renderCanais();
      } catch (err) {
        console.error("editor: falha ao remover responsável", err);
        window.alert((window.CC_SUPABASE && CC_SUPABASE.mensagemEscritaAmigavel(err)) || (err && err.message) || "Não consegui remover.");
      }
    }));
    // item 4.2 — trocou o prompt() de nome livre pelos dois <select> do topo (canal +
    // pessoa golden, montados acima). email sai vazio (quem quiser, edita na própria
    // linha depois de criada, mesmo fluxo de sempre); ordem é a próxima dentro do canal
    // escolhido, igual ao que já era antes.
    const btnAdd = document.getElementById("ed-add-resp");
    if (btnAdd) btnAdd.addEventListener("click", async () => {
      const canalSel = document.getElementById("ed-novo-resp-canal");
      const pessoaSel = document.getElementById("ed-novo-resp-pessoa");
      const canalNome = canalSel ? canalSel.value : DB_URC.CANAIS_FIXOS[0];
      const pessoaId = pessoaSel && pessoaSel.value ? Number(pessoaSel.value) : null;
      if (!pessoaId) { window.alert("Escolha uma pessoa antes de adicionar."); return; }
      const pessoasAtual = EDITOR_PESSOAS_CACHE.obter().lista;
      const pessoa = (pessoasAtual || []).find(ps => ps.db_id === pessoaId);
      if (!pessoa) return;
      const doCanal = (urcAtual.canaisFlat || []).filter(l => l.canal === canalNome);
      const proximaOrdem = doCanal.length ? Math.max.apply(null, doCanal.map(l => l.ordem || 0)) + 1 : 1;
      btnAdd.disabled = true;
      try {
        const nova = await DB_URC.criarResponsavel({ canal: canalNome, canal_id: canalIdPorNome(canalNome), nome: pessoa.nome, pessoa_id: pessoaId, email: pessoa.email || null, ordem: proximaOrdem }, EDITOR_ATUAL.nomeAtual(), urcAtual.lideranca);
        urcAtual.canaisFlat.push(nova);
        renderCanais();
      } catch (err) {
        console.error("editor: falha ao criar responsável", err);
        btnAdd.disabled = false;
        window.alert((window.CC_SUPABASE && CC_SUPABASE.mensagemEscritaAmigavel(err)) || (err && err.message) || "Não consegui criar.");
      }
    });
  }

  window.EDITOR_URC = { renderLideranca: renderLideranca, renderCanais: renderCanais };
})();
