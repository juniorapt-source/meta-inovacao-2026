/* editor.html — aba "Pessoas" (Camada 1 do golden record de cadastros de referência).
 *
 * 6ª etapa da extração do inline de editor.html pro próprio arquivo (ver BACKLOG.md,
 * "editor.html grande demais"; Histórico, Matriz, Corsário, URC e Projetos foram as
 * etapas 1-5).
 *
 * pessoasCarregando é privado deste módulo — confirmado que só renderPessoas() usava
 * essa trava (URC e Projetos leem a lista via EDITOR_PESSOAS_CACHE sem checar
 * "carregando", igual já era antes desta extração).
 *
 * pessoasAtual/pessoasFallback continuam sendo a MESMA variável que já existia em
 * editor.html (não viraram estado privado deste módulo): listaResponsaveis() (usada
 * pela aba Plano, ainda não extraída) lê/escreve nelas direto, no mesmo closure — mover
 * a variável pra cá quebraria essa leitura. Este módulo acessa a variável via
 * window.EDITOR_PESSOAS_CACHE.{obter,definir} (definido em js/editor-shared.js desde
 * 29/08/2026, D6.1 — já usado por URC e Projetos desde as etapas 4 e 5).
 *
 * Depende dos globais já expostos por js/editor-shared.js (window.opts,
 * window.avisoFallback, window.marcarLinhaStatus, window.detErro,
 * window.NUCLEOS_VALIDOS) e dos globais de sempre (esc, EDITOR_ATUAL, DB_PESSOAS).
 *
 * "+ Nova pessoa" (05/11/2026): até aqui a aba só editava linhas existentes — não havia
 * como cadastrar alguém pelo site. O formulário grava via DB_PESSOAS.criar (o GRANT de
 * INSERT e a policy cc_token_insert já existiam desde 2026-08_migracao_modo_edicao.sql).
 * Mesmo padrão visual do "+ Novo projeto" (js/editor-projetos.js). Some no fallback.
 *
 * API exposta: window.EDITOR_PESSOAS.render() — chamado pelo dispatcher de abas
 * (render(), em editor.html) quando o <select id="ed-conjunto"> está em "pessoas".
 */
(function () {
  "use strict";

  let pessoasCarregando = false;
  let formNovaPessoaAberto = false;
  // grupos de sempre (comentário da tabela em 2026-08_migracao_modo_edicao.sql + os que
  // vieram com o golden record); o campo aceita texto livre, isto é só sugestão.
  const GRUPOS_SUGERIDOS = ["UI", "Comitê", "Núcleos", "Projetos", "URC", "Coordenação", "Coletivo"];

  async function render() {
    const area = document.getElementById("ed-area");
    const sel = document.getElementById("ed-conjunto");

    const cacheInicial = EDITOR_PESSOAS_CACHE.obter();
    if (!cacheInicial.lista && !pessoasCarregando) {
      pessoasCarregando = true;
      area.innerHTML = '<div class="ed-carregando">Carregando pessoas…</div>';
      try {
        const { lista, usandoFallback } = await DB_PESSOAS.carregar();
        EDITOR_PESSOAS_CACHE.definir(lista, usandoFallback);
      } catch (err) {
        console.error("editor: falha ao carregar pessoas", err);
        pessoasCarregando = false;
        area.innerHTML = '<div class="ed-erro-carregar">Não foi possível carregar pessoas  agora.</div>';
        return;
      }
      pessoasCarregando = false;
    }
    if (sel.value !== "pessoas") return;
    const cache = EDITOR_PESSOAS_CACHE.obter();
    const lista = cache.lista || [];
    const dis = cache.fallback ? " disabled" : "";
    let h = cache.fallback ? avisoFallback("data/pessoas.js") : "";
    const grupos = GRUPOS_SUGERIDOS.slice();
    lista.forEach(p => { if (p.grupo && grupos.indexOf(p.grupo) < 0) grupos.push(p.grupo); });
    h += '<div class="ed-topo" style="margin-bottom:12px"><button type="button" id="ed-abrir-nova-pessoa" class="ed-btn"' + dis + '>+ Nova pessoa</button></div>';
    h += '<div id="ed-form-nova-pessoa" class="ed-nova" style="display:' + (formNovaPessoaAberto && !cache.fallback ? "block" : "none") + '">' +
      '<h3>Nova pessoa</h3>' +
      '<div class="ed-nova-grid">' +
        '<div data-campo="nome"><label>Nome *</label><input type="text" id="nvpe-nome" placeholder="como aparece nas listas">' +
          '<span class="ed-erro-msg">Obrigatório.</span></div>' +
        '<div><label>Nome completo</label><input type="text" id="nvpe-nome-completo"></div>' +
        '<div><label>Exibição</label><input type="text" id="nvpe-nome-exibicao" placeholder="apelido curto"></div>' +
        '<div data-campo="grupo"><label>Grupo *</label><input type="text" id="nvpe-grupo" list="nvpe-grupos" placeholder="ex.: UI, Comitê, Núcleos">' +
          '<datalist id="nvpe-grupos">' + grupos.map(g => '<option value="' + esc(g) + '">').join("") + '</datalist>' +
          '<span class="ed-erro-msg">Obrigatório.</span></div>' +
        '<div><label>Papel</label><input type="text" id="nvpe-papel"></div>' +
        '<div><label>Núcleo</label><select id="nvpe-nucleo">' + opts([""].concat(NUCLEOS_VALIDOS), "") + '</select></div>' +
        '<div><label>E-mail</label><input type="email" id="nvpe-email"></div>' +
      '</div>' +
      '<div class="ed-nova-acoes"><button type="button" id="ed-confirmar-nova-pessoa" class="ed-btn">Adicionar</button>' +
        '<button type="button" id="ed-cancelar-nova-pessoa" class="ed-btn sec">Cancelar</button></div>' +
    '</div>';
    // nome_completo/nome_exibicao/email/ativo são as colunas da Camada 1 do golden record
    // de pessoas (tools/sql/2026-08_pessoas_golden.sql) — convivem com nome/papel/grupo/
    // nucleo/pendente, que continuam sendo o que participantes.html lê. Núcleo virou
    // <select> (mesma lista NUCLEOS_VALIDOS de "Projetos & Representantes"), com opção
    // vazia porque só as linhas do grupo "Núcleos" preenchem este campo.
    h += '<div class="ed-wrap"><table class="ed-tab"><thead><tr>' +
      '<th style="width:170px">Nome</th>' +
      '<th style="width:190px">Nome completo</th>' +
      '<th style="width:110px">Exibição</th>' +
      '<th>Papel</th>' +
      '<th style="width:90px">Grupo</th>' +
      '<th style="width:180px">Núcleo</th>' +
      '<th style="width:170px">E-mail</th>' +
      '<th style="width:60px">Ativo</th>' +
      '<th style="width:80px">Pendente</th>' +
      '<th style="width:70px"></th></tr></thead><tbody>';
    lista.forEach((p) => {
      h += '<tr data-id="' + esc(String(p.db_id)) + '">' +
        '<td><input type="text" data-f="nome" value="' + esc(p.nome) + '"' + dis + '></td>' +
        '<td><input type="text" data-f="nome_completo" value="' + esc(p.nome_completo || "") + '" placeholder="ainda não preenchido"' + dis + '></td>' +
        '<td><input type="text" data-f="nome_exibicao" value="' + esc(p.nome_exibicao || "") + '"' + dis + '></td>' +
        '<td><input type="text" data-f="papel" value="' + esc(p.papel || "") + '"' + dis + '></td>' +
        '<td><input type="text" data-f="grupo" value="' + esc(p.grupo || "") + '"' + dis + '></td>' +
        '<td><select data-f="nucleo"' + dis + '>' + opts([""].concat(NUCLEOS_VALIDOS), p.nucleo || "") + '</select></td>' +
        '<td><input type="email" data-f="email" value="' + esc(p.email || "") + '"' + dis + '></td>' +
        '<td style="text-align:center"><input type="checkbox" data-f="ativo"' + (p.ativo !== false ? " checked" : "") + dis + '></td>' +
        '<td style="text-align:center"><input type="checkbox" data-f="pendente"' + (p.pendente ? " checked" : "") + dis + '></td>' +
        '<td><span class="ed-row-status" aria-live="polite"></span></td></tr>';
    });
    area.innerHTML = h + '</tbody></table></div>';

    area.querySelectorAll("tbody [data-f]").forEach(el => el.addEventListener("change", async e => {
      const t = e.target, tr = t.closest("tr"), id = tr.dataset.id, campo = t.dataset.f;
      // campos novos da Camada 1 (nome_completo/nome_exibicao/email) usam NULL pra "ainda
      // não preenchido" (é o que marca uma pessoa como pendente de nome completo — ver
      // tools/sql/2026-08_pessoas_golden.sql); os campos originais mantêm o comportamento
      // de sempre (string, inclusive vazia).
      const campoNulavel = campo === "nome_completo" || campo === "nome_exibicao" || campo === "email";
      const valor = campo === "pendente" || campo === "ativo" ? t.checked : (campoNulavel ? (t.value || null) : t.value);
      const p = lista.find(x => String(x.db_id) === id);
      if (p) p[campo] = valor;
      marcarLinhaStatus(tr, "salvando");
      try {
        await DB_PESSOAS.salvar(p.db_id, { [campo]: valor }, EDITOR_ATUAL.nomeAtual());
        marcarLinhaStatus(tr, "salvo");
      } catch (err) {
        console.error("editor: falha ao salvar pessoa", err);
        marcarLinhaStatus(tr, (window.CC_SUPABASE && CC_SUPABASE.mensagemEscritaAmigavel(err)) || "falhou", detErro(err));
      }
    }));

    const btnAbrir = document.getElementById("ed-abrir-nova-pessoa");
    if (btnAbrir) btnAbrir.addEventListener("click", () => { formNovaPessoaAberto = true; render(); });
    if (formNovaPessoaAberto && !cache.fallback) {
      document.getElementById("ed-cancelar-nova-pessoa").addEventListener("click", () => { formNovaPessoaAberto = false; render(); });
      document.getElementById("ed-confirmar-nova-pessoa").addEventListener("click", criarPessoa);
      const nomeEl = document.getElementById("nvpe-nome");
      if (nomeEl) nomeEl.focus();
    }
  }

  async function criarPessoa() {
    const val = id => (document.getElementById(id).value || "").trim();
    const nome = val("nvpe-nome"), grupo = val("nvpe-grupo");
    const form = document.getElementById("ed-form-nova-pessoa");
    form.querySelectorAll(".ed-campo-erro").forEach(el => el.classList.remove("ed-campo-erro"));
    let erro = false;
    if (!nome) { form.querySelector('[data-campo="nome"]').classList.add("ed-campo-erro"); erro = true; }
    if (!grupo) { form.querySelector('[data-campo="grupo"]').classList.add("ed-campo-erro"); erro = true; }
    if (erro) return;
    const lista = EDITOR_PESSOAS_CACHE.obter().lista || [];
    // a mesma pessoa pode ter uma linha por grupo (ex.: Comitê e Núcleos) — duplicata
    // é só o par nome+grupo.
    const jaExiste = lista.some(p => (p.nome || "").toLowerCase() === nome.toLowerCase() && (p.grupo || "").toLowerCase() === grupo.toLowerCase());
    if (jaExiste) {
      window.alert('Já existe "' + nome + '" no grupo "' + grupo + '" — edite a linha dela na tabela em vez de criar de novo.');
      return;
    }
    const maiorOrdem = lista.reduce((m, p) => Math.max(m, Number(p.ordem) || 0), 0);
    const nova = {
      nome: nome,
      nome_completo: val("nvpe-nome-completo") || null,
      nome_exibicao: val("nvpe-nome-exibicao") || null,
      papel: val("nvpe-papel") || null,
      grupo: grupo,
      nucleo: val("nvpe-nucleo") || null,
      email: val("nvpe-email") || null,
      pendente: false,
      ativo: true,
      ordem: maiorOrdem + 1
    };
    const btn = document.getElementById("ed-confirmar-nova-pessoa");
    btn.disabled = true;
    try {
      const criada = await DB_PESSOAS.criar(nova, EDITOR_ATUAL.nomeAtual());
      lista.push(criada); // mesma referência do EDITOR_PESSOAS_CACHE — Projetos/URC/Plano já enxergam
      formNovaPessoaAberto = false;
      render();
    } catch (err) {
      console.error("editor: falha ao criar pessoa", err);
      btn.disabled = false;
      window.alert((window.CC_SUPABASE && CC_SUPABASE.mensagemEscritaAmigavel(err)) || "Não consegui criar a pessoa: " + ((err && err.message) || err));
    }
  }

  window.EDITOR_PESSOAS = { render: render };
})();
