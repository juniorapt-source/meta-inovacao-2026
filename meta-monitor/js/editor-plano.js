/* editor.html — aba "Plano de ação" (as 47 ações do caminho crítico, editadas ao vivo
 * desde o P10 — ver README, "Como os dados funcionam").
 *
 * 8ª e ÚLTIMA etapa da extração do inline de editor.html pro próprio arquivo (ver
 * BACKLOG.md, "editor.html grande demais"). Deixada por último de propósito — é a mais
 * crítica (edição ao vivo das 47 ações) e a mais acoplada das 8.
 *
 * Estado privado deste módulo: planoAtual/planoFallback/planoCarregando/
 * formNovaAberto/STATUS_ACAO (só Plano usava) e coletivosAtual/
 * listaResponsaveisMontada (só usados por listaResponsaveis(), abaixo, que por sua vez
 * só é chamada por gravarPlanoResponsaveis(), só chamada por criarAtividade() — cadeia
 * inteira exclusiva desta aba, confirmado antes de mover).
 *
 * ÚNICA dependência cross-arquivo de verdade: pessoasAtual/pessoasFallback, dentro de
 * listaResponsaveis() — lidos/escritos via window.EDITOR_PESSOAS_CACHE (definido em
 * editor.html, já usado por URC e Projetos desde as etapas 4 e 5), em vez da variável
 * direta. Com esta etapa, editor.html deixa de ter QUALQUER leitor/escritor direto de
 * pessoasAtual/pessoasFallback — a variável em si continua lá (não migrou pra dentro de
 * js/editor-pessoas.js: isso é só uma limpeza opcional futura, não uma correção
 * necessária — ver nota da etapa 6 no BACKLOG.md).
 *
 * Depende dos globais já expostos em editor.html desde a etapa 3 (window.opts,
 * window.marcarLinhaStatus, window.detErro — lição daquela etapa: são declarados
 * dentro do IIFE de editor.html, não são globais "de graça", por isso precisaram do
 * window.X = X explícito) e dos globais de sempre (esc, EDITOR_ATUAL, DB_PLANO,
 * DB_PESSOAS, DB_COLETIVOS, DB_RESPONSAVEIS, DB_PLANO_RESPONSAVEIS, RESP, DB — este
 * último é o window.DB de dados estáticos, usado só pra window.DB.responsaveis, a
 * lista legada que RESP.mapearTexto() resolve).
 *
 * API exposta: window.EDITOR_PLANO.render() — chamado pelo dispatcher de abas
 * (render(), em editor.html) quando o <select id="ed-conjunto"> está em "plano".
 */
(function () {
  "use strict";

  /* vocabulário do conjunto "plano" — mesma régua de plano.html/data/plano.js. */
  const STATUS_ACAO = ["Não iniciado", "Em andamento", "Concluído"];

  let planoAtual = null, planoFallback = false, planoCarregando = false;
  let formNovaAberto = false;

  // item 5.6 do plano — golden record de coletivos (Camada 0), só pra alimentar
  // listaResponsaveis() abaixo; nenhuma outra tela deste módulo edita coletivos
  // diretamente, então não precisa do padrão fallback/carregando dos outros globais.
  let coletivosAtual = null;

  /* prefixo de ID por frente, descoberto a partir dos dados carregados (não hardcodado) */
  function mapaPrefixos() {
    const mapa = {};
    (planoAtual || []).forEach(a => { const p = (a.id || "").split("-")[0]; if (p && !mapa[a.frente]) mapa[a.frente] = p; });
    return mapa;
  }
  function proximoId(frente) {
    const prefixo = (frente && mapaPrefixos()[frente]) || "ATV";
    const nums = (planoAtual || []).map(a => (a.id || "").split("-")).filter(p => p[0] === prefixo).map(p => parseInt(p[1], 10)).filter(n => !isNaN(n));
    const prox = (nums.length ? Math.max.apply(null, nums) : 0) + 1;
    return prefixo + "-" + String(prox).padStart(2, "0");
  }

  // item 5.6 — lista "montada" de DB_RESPONSAVEIS (pessoa OU coletivo do golden record,
  // ids antigos preservados — mesma função que plano-acao.html/minhas-acoes.html usam
  // desde o item 4.3), carregada sob demanda e reaproveitando a cache de pessoas se a
  // aba "Projetos" ou "Pessoas" já carregou antes nesta sessão (EDITOR_PESSOAS_CACHE,
  // mesmo princípio de nucleosPorNome/projetoIdPorIniciativa em editor.html).
  let listaResponsaveisMontada = null;
  async function listaResponsaveis() {
    if (!listaResponsaveisMontada) {
      try {
        const cache = EDITOR_PESSOAS_CACHE.obter();
        let pessoasAtual = cache.lista;
        if (!pessoasAtual) {
          const r = await DB_PESSOAS.carregar();
          pessoasAtual = r.lista;
          EDITOR_PESSOAS_CACHE.definir(r.lista, r.usandoFallback);
        }
        if (!coletivosAtual) { const r = await DB_COLETIVOS.carregar(); coletivosAtual = r.lista; }
        listaResponsaveisMontada = DB_RESPONSAVEIS.montar(pessoasAtual, coletivosAtual);
      } catch (err) {
        console.error("editor: falha ao montar a lista golden de responsáveis — vínculos de meta_inovacao_plano_responsaveis não serão gravados nesta sessão", err);
        listaResponsaveisMontada = [];
      }
    }
    return listaResponsaveisMontada;
  }

  // item 5.6 — grava, em meta_inovacao_plano_responsaveis, um vínculo por id resolvido
  // de responsavel_id[] (a MESMA lista, agora traduzida pessoa/coletivo pelo golden
  // record via DB_RESPONSAVEIS.encontrar — id antigo ou "pessoa:<id>"/"coletivo:<id>",
  // os dois já resolvem desde o item 4.3). Best-effort por id, mesmo padrão de
  // sincronia de 4.1/4.2: uma falha num vínculo não desfaz a ação já criada, só avisa
  // no console. Id que não resolve pra nada no golden record (não deveria acontecer —
  // são os mesmos ~32 ids do LEGADO) é pulado silenciosamente, não é erro.
  async function gravarPlanoResponsaveis(planoAcaoId, responsavelIds, usuario) {
    if (!responsavelIds || !responsavelIds.length) return;
    const lista = await listaResponsaveis();
    if (!lista.length) return;
    for (let i = 0; i < responsavelIds.length; i++) {
      const entrada = DB_RESPONSAVEIS.encontrar(lista, responsavelIds[i]);
      if (!entrada) continue;
      try {
        await DB_PLANO_RESPONSAVEIS.criar({
          plano_acao_id: planoAcaoId,
          pessoa_id: entrada.tipo === "pessoa" ? Number(entrada.dbId) : null,
          coletivo_id: entrada.tipo === "coletivo" ? Number(entrada.dbId) : null,
          ordem: i + 1,
        }, usuario);
      } catch (err) {
        console.error('editor: ação criada, mas falhou ao vincular responsável "' + responsavelIds[i] + '" em meta_inovacao_plano_responsaveis', err);
      }
    }
  }

  async function render() {
    const area = document.getElementById("ed-area");
    const sel = document.getElementById("ed-conjunto");

    if (!planoAtual && !planoCarregando) {
      planoCarregando = true;
      area.innerHTML = '<div class="ed-carregando">Carregando plano…</div>';
      try {
        const { lista, usandoFallback } = await DB_PLANO.carregar();
        planoAtual = lista; planoFallback = usandoFallback;
      } catch (err) {
        console.error("editor: falha ao carregar plano", err);
        planoCarregando = false;
        area.innerHTML = '<div class="ed-erro-carregar">Não foi possível carregar o plano  agora.</div>';
        return;
      }
      planoCarregando = false;
    }
    if (sel.value !== "plano") return; // usuário trocou de conjunto enquanto isso carregava
    const lista = planoAtual || [];
    const frentes = [...new Set(lista.map(a => a.frente))];
    let h = planoFallback ? '<div class="aviso" style="margin-bottom:12px"><b>Dados locais</b> — não foi possível atualizar os dados agora; estas são as informações da última versão salva. As alterações não serão salvas enquanto isso; recarregue a página mais tarde.</div>' : "";
    h += '<div class="ed-topo" style="margin-bottom:12px"><button type="button" id="ed-abrir-nova" class="ed-btn"' + (planoFallback ? " disabled" : "") + '>+ Nova atividade</button></div>';
    h += '<div id="ed-form-nova" class="ed-nova" style="display:' + (formNovaAberto ? "block" : "none") + '">' +
      '<h3>Nova atividade <span class="ed-nova-id" id="ed-id-preview">' + esc(proximoId(frentes[0])) + '</span></h3>' +
      '<div class="ed-nova-grid">' +
        '<div class="ed-campo-erro" data-campo="frente"><label>Frente</label>' +
          '<select id="nv-frente">' + frentes.map(f => '<option value="' + esc(f) + '">' + esc(f) + '</option>').join("") + '<option value="">— sem frente (prefixo ATV-) —</option></select>' +
        '</div>' +
        '<div class="ed-campo-erro" data-campo="sub"><label>Subcategoria</label><input type="text" id="nv-sub" placeholder="ex.: Governança"></div>' +
        '<div class="ed-campo-erro full" data-campo="atividade"><label>Atividade *</label><input type="text" id="nv-atividade">' +
          '<span class="ed-erro-msg">Obrigatório.</span></div>' +
        '<div class="ed-campo-erro" data-campo="resp"><label>Responsável</label><input type="text" id="nv-resp"></div>' +
        '<div class="ed-campo-erro" data-campo="status"><label>Status</label><select id="nv-status">' + opts(STATUS_ACAO, STATUS_ACAO[0]) + '</select></div>' +
        '<div class="ed-campo-erro" data-campo="prazo"><label>Prazo *</label><input type="text" id="nv-prazo" placeholder="14/08">' +
          '<span class="ed-erro-msg">Obrigatório.</span></div>' +
        '<div class="ed-campo-erro" data-campo="prazo_iso"><label>Prazo ISO *</label><input type="date" id="nv-prazo-iso">' +
          '<span class="ed-erro-msg">Obrigatório.</span></div>' +
        '<div class="ed-campo-erro" data-campo="dep"><label>Dependências (IDs, vírgula)</label><input type="text" id="nv-dep" placeholder="ex.: INS-06, CAN-02"></div>' +
        '<div class="ed-campo-erro full" data-campo="como"><label>Como executar *</label><textarea id="nv-como"></textarea>' +
          '<span class="ed-erro-msg">Obrigatório — validar_dados.py exige esse campo em toda ação.</span></div>' +
        '<div class="ed-campo-erro full" data-campo="monitor"><label>Como monitorar *</label><textarea id="nv-monitor"></textarea>' +
          '<span class="ed-erro-msg">Obrigatório — validar_dados.py exige esse campo em toda ação.</span></div>' +
        '<div class="ed-campo-erro" data-campo="ferramenta"><label>Ferramenta *</label><input type="text" id="nv-ferramenta">' +
          '<span class="ed-erro-msg">Obrigatório — validar_dados.py exige esse campo em toda ação.</span></div>' +
      '</div>' +
      '<div class="ed-nova-acoes"><button type="button" id="ed-confirmar-nova" class="ed-btn">Adicionar</button>' +
        '<button type="button" id="ed-cancelar-nova" class="ed-btn sec">Cancelar</button></div>' +
    '</div>';
    h += '<div class="ed-wrap"><table class="ed-tab"><thead><tr><th>ID</th><th>Atividade</th><th style="width:150px">Status</th><th style="width:110px">Prazo</th><th style="width:130px">Prazo ISO</th><th style="width:70px"></th></tr></thead><tbody>';
    lista.forEach(a => {
      h += '<tr data-id="' + esc(a.id) + '"><td class="ed-mono">' + esc(a.id) + '</td><td>' + esc(a.atividade) + '</td>' +
         '<td><select data-f="status"' + (planoFallback ? " disabled" : "") + '>' + opts(STATUS_ACAO, a.status) + '</select></td>' +
         '<td><input type="text" data-f="prazo" value="' + esc(a.prazo) + '"' + (planoFallback ? " disabled" : "") + '></td>' +
         '<td><input type="text" data-f="prazo_iso" value="' + esc(a.prazo_iso || "") + '" placeholder="AAAA-MM-DD ou vazio"' + (planoFallback ? " disabled" : "") + '></td>' +
         '<td><span class="ed-row-status" aria-live="polite"></span></td></tr>';
    });
    area.innerHTML = h + '</tbody></table></div>';

    const CAMPO_COLUNA = { status: "status", prazo: "prazo_texto", prazo_iso: "prazo_iso" };
    area.querySelectorAll("tbody select[data-f],tbody input[data-f]").forEach(el => {
      el.addEventListener("change", async e => {
        const t = e.target, tr = t.closest("tr"), id = tr.dataset.id, campo = t.dataset.f;
        const coluna = CAMPO_COLUNA[campo];
        let valorColuna = t.value;
        if (campo === "status") valorColuna = DB_PLANO.CHAVE_POR_ROTULO[t.value] || t.value;
        else if (campo === "prazo_iso") valorColuna = t.value.trim() === "" ? null : t.value;
        const a = lista.find(x => x.id === id);
        if (a) a[campo] = campo === "prazo_iso" && t.value.trim() === "" ? null : t.value;
        marcarLinhaStatus(tr, "salvando");
        try {
          await DB_PLANO.salvar(id, { [coluna]: valorColuna }, EDITOR_ATUAL.nomeAtual());
          marcarLinhaStatus(tr, "salvo");
        } catch (err) {
          console.error("editor: falha ao salvar ação do plano", err);
          marcarLinhaStatus(tr, (window.CC_SUPABASE && CC_SUPABASE.mensagemEscritaAmigavel(err)) || "falhou", detErro(err));
        }
      });
    });

    document.getElementById("ed-abrir-nova").addEventListener("click", () => { formNovaAberto = true; render(); });
    if (formNovaAberto) {
      document.getElementById("nv-frente").addEventListener("change", e => {
        document.getElementById("ed-id-preview").textContent = proximoId(e.target.value);
      });
      document.getElementById("ed-cancelar-nova").addEventListener("click", () => { formNovaAberto = false; render(); });
      document.getElementById("ed-confirmar-nova").addEventListener("click", criarAtividade);
    }
  }

  async function criarAtividade() {
    const campo = id => document.getElementById(id);
    const obrigatorios = {
      atividade: campo("nv-atividade").value.trim(),
      prazo: campo("nv-prazo").value.trim(),
      prazo_iso: campo("nv-prazo-iso").value.trim(),
      como: campo("nv-como").value.trim(),
      monitor: campo("nv-monitor").value.trim(),
      ferramenta: campo("nv-ferramenta").value.trim()
    };
    let ok = true;
    document.querySelectorAll("#ed-form-nova .ed-campo-erro").forEach(el => el.classList.remove("ed-campo-erro"));
    for (const nomeCampo in obrigatorios) {
      if (!obrigatorios[nomeCampo]) {
        ok = false;
        const wrap = document.querySelector('#ed-form-nova [data-campo="' + nomeCampo + '"]');
        if (wrap) wrap.classList.add("ed-campo-erro");
      }
    }
    if (!ok) return;

    const frente = campo("nv-frente").value;
    const dep = campo("nv-dep").value.split(",").map(s => s.trim()).filter(Boolean);
    const respTexto = campo("nv-resp").value.trim();
    // item 5.6 — resolve o texto livre digitado em "Responsável" contra a lista canônica
    // de sempre (window.DB.responsaveis, os ~32 ids), mesma função (RESP.mapearTexto) que
    // js/drawer.js já usa pra marcar nome como clicável. Antes deste item, `responsavel_id`
    // nascia sempre `[]` aqui — o texto e o array já estavam desacoplados NA CRIAÇÃO, antes
    // mesmo de chegar em meta_inovacao_plano_responsaveis (é o que o 5.1 achou).
    const responsavelIds = (window.RESP && window.DB && window.DB.responsaveis)
      ? RESP.mapearTexto(window.DB.responsaveis, respTexto).ids : [];
    const nova = {
      id: proximoId(frente),
      frente: frente || "Sem frente",
      sub: campo("nv-sub").value.trim(),
      atividade: obrigatorios.atividade,
      resp: respTexto,
      responsavel_id: responsavelIds,
      prazo: obrigatorios.prazo,
      prazo_iso: obrigatorios.prazo_iso,
      status: campo("nv-status").value,
      dep: dep,
      cc: { tipo: null },
      como: obrigatorios.como,
      monitor: obrigatorios.monitor,
      ferramenta: campo("nv-ferramenta").value.trim(),
      ordem: (planoAtual || []).length + 1
    };
    const btn = document.getElementById("ed-confirmar-nova");
    btn.disabled = true;
    try {
      const usuario = EDITOR_ATUAL.nomeAtual();
      const criada = await DB_PLANO.criar(nova, usuario);
      planoAtual.push(criada);
      // item 5.6 — a ação já está criada (sucesso garantido); os vínculos da junção são
      // best-effort a partir daqui, mesmo padrão de 4.1 (adicionar representante).
      await gravarPlanoResponsaveis(criada.db_id, responsavelIds, usuario);
      formNovaAberto = false;
      render();
    } catch (err) {
      console.error("editor: falha ao criar ação do plano", err);
      btn.disabled = false;
      window.alert((window.CC_SUPABASE && CC_SUPABASE.mensagemEscritaAmigavel(err)) || "Não consegui criar a atividade: " + ((err && err.message) || err));
    }
  }

  window.EDITOR_PLANO = { render: render };
})();
