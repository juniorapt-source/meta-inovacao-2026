/* editor.html — aba "Fluxo de dados" (Projeto Corso): rotas, painéis, encaminhamentos e
 * sistemas das tabelas fluxo_dados_* (Supabase).
 *
 * Diferente das outras abas vivas (que salvam campo a campo ao sair dele), esta usa um
 * formulário com botão "Salvar": uma rota tem ~22 campos que só fazem sentido juntos
 * (origem, destino, mecanismo, golden), e salvar pela metade deixaria a linha num estado
 * contraditório. Nunca DELETE: "Desativar" grava ativo=false (a única exceção é desvincular
 * painel×rota). Quem lê é a página fluxo-dados.html (js/fluxo-dados.js).
 *
 * API exposta: window.EDITOR_FLUXO.render() — chamado pelo dispatcher de editor.html.
 * PRECISA de js/db-fluxo.js, js/db-projetos.js e js/editor-shared.js (esc/avisoFallback).
 */
(function () {
  "use strict";
  const F = window.DB_FLUXO;
  let dados = null, fallback = false, carregando = false, iniciativasBase = [];
  let secao = "rotas";            // rotas | paineis | encaminhamentos | sistemas
  let aberto = null;              // { id|null } formulário aberto na seção atual
  let mensagem = null;            // { ok:boolean, texto }

  const hoje = () => new Date().toISOString().slice(0, 10);
  const ativos = (l) => (l || []).filter((x) => x.ativo !== false);
  const area = () => document.getElementById("ed-area");

  // ---- especificação dos campos ----
  const ENUM = (lista, rot, extra) => Object.assign({ t: "enum", opcoes: lista, rotulos: rot }, extra || {});
  const CAMPOS = {
    rotas: [
      { k: "quem_envia_hoje", rot: "Quem envia hoje", t: "text", destaque: true },
      { k: "quem_deveria_enviar", rot: "Quem deveria enviar", t: "text", destaque: true },
      { k: "iniciativa", rot: "Iniciativa", t: "iniciativa", obrig: true },
      ENUM(F.TIPOS_DADO, F.ROTULO_TIPO_DADO, { k: "tipo_dado", rot: "Tipo de dado", obrig: true }),
      { k: "descricao", rot: "Descrição (nome curto da rota)", t: "area", obrig: true },
      { k: "sistema_origem_id", rot: "Sistema de origem", t: "sistema" },
      { k: "sistema_destino_hoje_id", rot: "Destino hoje", t: "sistema" },
      { k: "sistema_destino_alvo_id", rot: "Destino alvo", t: "sistema" },
      ENUM(F.MECANISMOS, F.ROTULO_MECANISMO, { k: "mecanismo_hoje", rot: "Mecanismo hoje", obrig: true, padrao: "a_definir" }),
      ENUM(F.MECANISMOS, F.ROTULO_MECANISMO, { k: "mecanismo_alvo", rot: "Mecanismo alvo", obrig: true, padrao: "a_definir" }),
      { k: "frequencia", rot: "Frequência", t: "text" },
      ENUM(F.CHEGA_COMPLETO, F.ROTULO_CHEGA, { k: "chega_completo", rot: "Chega completo?", obrig: true, padrao: "nao_sabe" }),
      { k: "perda", rot: "O que se perde", t: "area" },
      ENUM(F.OUTRA_FONTE, F.ROTULO_OUTRA, { k: "existe_outra_fonte", rot: "Existe outra fonte?", obrig: true, padrao: "nao_sabe" }),
      { k: "risco_divergencia", rot: "Risco de divergência", t: "area" },
      { k: "identificacao_no_foco", rot: "Identificação no Foco", t: "area" },
      { k: "golden_hoje_id", rot: "Golden hoje", t: "sistema" },
      { k: "golden_alvo_id", rot: "Golden alvo", t: "sistema" },
      ENUM(F.STATUS, F.ROTULO_STATUS, { k: "status", rot: "Status", obrig: true, padrao: "entendimento" }),
      { k: "validado_com", rot: "Validado com", t: "text" },
      { k: "validado_em", rot: "Validado em", t: "date" },
      { k: "observacao", rot: "Observação", t: "area" },
    ],
    paineis: [
      { k: "nome", rot: "Nome do painel", t: "text", obrig: true },
      { k: "iniciativa", rot: "Iniciativa (vazio = transversal)", t: "iniciativa", branco: true },
      { k: "indicador", rot: "Indicador", t: "text" },
      { k: "ferramenta", rot: "Ferramenta", t: "text" },
      { k: "sistema_fonte_hoje_id", rot: "Fonte hoje", t: "sistema" },
      { k: "sistema_fonte_alvo_id", rot: "Fonte alvo", t: "sistema" },
      { k: "responsavel", rot: "Responsável", t: "text" },
      ENUM(F.STATUS, F.ROTULO_STATUS, { k: "status", rot: "Status", obrig: true, padrao: "entendimento" }),
      { k: "observacao", rot: "Observação", t: "area" },
    ],
    encaminhamentos: [
      { k: "acao", rot: "Ação", t: "text", obrig: true },
      { k: "rota_id", rot: "Rota", t: "rota" },
      { k: "painel_id", rot: "Painel", t: "painel" },
      { k: "responsavel", rot: "Responsável", t: "text" },
      { k: "prazo", rot: "Prazo", t: "date" },
      ENUM(F.STATUS_ENC, F.ROTULO_ENC, { k: "status", rot: "Status", obrig: true, padrao: "a_fazer" }),
      { k: "depende_de_id", rot: "Depende de (fica bloqueada até essa ficar feita)", t: "enc" },
      { k: "observacao", rot: "Observação", t: "area" },
    ],
    sistemas: [
      { k: "slug", rot: "Slug (identificador curto, minúsculas)", t: "text", obrig: true },
      { k: "nome", rot: "Nome", t: "text", obrig: true },
      { k: "tipo", rot: "Tipo", t: "tipo_sistema", obrig: true },
      { k: "mantenedor", rot: "Mantenedor", t: "text" },
      { k: "observacao", rot: "Observação", t: "area" },
    ],
  };
  const ROTULO_NOVO = { rotas: "+ Nova rota", paineis: "+ Novo painel", encaminhamentos: "+ Novo encaminhamento", sistemas: "+ Novo sistema" };
  const TITULO = { rotas: "Rotas", paineis: "Painéis", encaminhamentos: "Encaminhamentos", sistemas: "Sistemas" };

  // ---- carga ----
  async function garantirDados(recarregar) {
    if ((dados && !recarregar) || carregando) return;
    carregando = true;
    try {
      const r = await F.carregar({ recarregar: !!recarregar });
      dados = r.dados; fallback = r.usandoFallback;
      try { iniciativasBase = (await window.DB_PROJETOS.carregar()).lista.map((p) => p.iniciativa); }
      catch (e) { iniciativasBase = ((window.DB && window.DB.projetos) || []).map((p) => p.iniciativa); }
    } finally { carregando = false; }
    render();
  }

  const sistemaNome = (id) => { const s = (dados.sistemas || []).find((x) => x.id === id); return s ? s.nome : "—"; };
  function listaIniciativas(atual) {
    const s = new Set(iniciativasBase);
    ativos(dados.rotas).concat(ativos(dados.paineis)).forEach((x) => x.iniciativa && s.add(x.iniciativa));
    return Array.from(s).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  // ---- renderização de campos ----
  function opcoesHtml(pares, atual, branco) {
    return (branco ? '<option value="">—</option>' : "") + pares.map((p) => '<option value="' + esc(p[0]) + '"' + (p[0] === atual ? " selected" : "") + ">" + esc(p[1]) + "</option>").join("");
  }
  function campoHtml(c, reg) {
    const v = reg ? reg[c.k] : (c.padrao || null);
    const id = "fx-" + c.k;
    let ctl = "";
    if (c.t === "text") ctl = '<input type="text" id="' + id + '" data-k="' + c.k + '" value="' + esc(v || "") + '">';
    else if (c.t === "date") ctl = '<input type="date" id="' + id + '" data-k="' + c.k + '" value="' + esc(v || "") + '">';
    else if (c.t === "area") ctl = '<textarea id="' + id + '" data-k="' + c.k + '" rows="2">' + esc(v || "") + "</textarea>";
    else if (c.t === "enum") ctl = '<select id="' + id + '" data-k="' + c.k + '">' + opcoesHtml(c.opcoes.map((o) => [o, c.rotulos[o]]), v, c.branco) + "</select>";
    else if (c.t === "sistema") {
      ctl = '<select id="' + id + '" data-k="' + c.k + '">' + opcoesHtml(ativos(dados.sistemas).map((s) => [s.id, s.nome]), v, true) + "</select>";
    } else if (c.t === "tipo_sistema") {
      ctl = '<input type="text" id="' + id + '" data-k="' + c.k + '" list="fx-tipos" value="' + esc(v || "") + '"><datalist id="fx-tipos">' + F.TIPOS_SISTEMA_SUGERIDOS.map((t) => '<option value="' + esc(t) + '">').join("") + "</datalist>";
    } else if (c.t === "rota") {
      ctl = '<select id="' + id + '" data-k="' + c.k + '">' + opcoesHtml(ativos(dados.rotas).map((r) => [r.id, r.iniciativa + " · " + F.ROTULO_TIPO_DADO[r.tipo_dado]]), v, true) + "</select>";
    } else if (c.t === "painel") {
      ctl = '<select id="' + id + '" data-k="' + c.k + '">' + opcoesHtml(ativos(dados.paineis).map((p) => [p.id, p.nome]), v, true) + "</select>";
    } else if (c.t === "enc") {
      const self = reg && reg.id;
      ctl = '<select id="' + id + '" data-k="' + c.k + '">' + opcoesHtml(ativos(dados.encaminhamentos).filter((e) => e.id !== self).map((e) => [e.id, e.acao]), v, true) + "</select>";
    } else if (c.t === "iniciativa") {
      const lista = listaIniciativas();
      const livre = v && lista.indexOf(v) === -1;
      ctl = '<select id="' + id + '" data-k="' + c.k + '" data-iniciativa="1">'
        + opcoesHtml(lista.map((n) => [n, n]), v, true) + '<option value="__outra__"' + (livre ? " selected" : "") + ">outra (texto livre)</option></select>"
        + '<input type="text" id="' + id + '-livre" placeholder="Nome da iniciativa" value="' + esc(livre ? v : "") + '"' + (livre ? "" : " hidden") + ">";
    }
    return '<label class="fx-campo' + (c.destaque ? " fx-destaque" : "") + '"><span>' + esc(c.rot) + (c.obrig ? " *" : "") + "</span>" + ctl + "</label>";
  }

  function lerForm(secaoAtual) {
    const out = {}; const erros = [];
    CAMPOS[secaoAtual].forEach((c) => {
      const el = document.getElementById("fx-" + c.k);
      let v = el ? el.value : "";
      if (c.t === "iniciativa" && v === "__outra__") v = document.getElementById("fx-" + c.k + "-livre").value;
      v = (v || "").trim();
      if (c.obrig && !v) erros.push(c.rot);
      out[c.k] = v === "" ? null : v;
    });
    return { campos: out, erros: erros };
  }

  // ---- resumos das listas ----
  function resumo(secaoAtual, r) {
    if (secaoAtual === "rotas") return esc(r.iniciativa) + " · " + esc(F.ROTULO_TIPO_DADO[r.tipo_dado]) + " — " + esc(sistemaNome(r.sistema_origem_id)) + " → " + esc(sistemaNome(r.sistema_destino_hoje_id)) + " (alvo " + esc(sistemaNome(r.sistema_destino_alvo_id)) + ")"
      + "<br><small>envia hoje: " + esc(r.quem_envia_hoje || "não informado") + " · deveria enviar: " + esc(r.quem_deveria_enviar || "não informado") + " · " + esc(F.ROTULO_STATUS[r.status] || r.status) + "</small>";
    if (secaoAtual === "paineis") return esc(r.nome) + " — " + esc(r.iniciativa || "transversal") + " (" + esc(sistemaNome(r.sistema_fonte_hoje_id)) + " → " + esc(sistemaNome(r.sistema_fonte_alvo_id)) + ") · " + esc(F.ROTULO_STATUS[r.status] || r.status);
    if (secaoAtual === "encaminhamentos") return esc(r.acao) + " — " + esc(r.responsavel || "sem responsável") + " · " + esc(r.prazo || "sem prazo") + " · " + esc(F.ROTULO_ENC[r.status] || r.status);
    return esc(r.nome) + " <small>(" + esc(r.slug) + " · " + esc(r.tipo || "—") + ")</small>";
  }

  function injetarEstilos() {
    if (document.getElementById("ed-fluxo-estilos")) return;
    const st = document.createElement("style"); st.id = "ed-fluxo-estilos";
    st.textContent =
      ".fx-lista{list-style:none;margin:0 0 14px;padding:0}.fx-lista li{display:flex;gap:10px;justify-content:space-between;align-items:center;padding:8px 10px;border-top:1px solid var(--border-soft);font:400 13px 'DM Sans',sans-serif}" +
      ".fx-lista li.off{opacity:.55}.fx-acoes{display:flex;gap:6px;flex-shrink:0}" +
      ".fx-form{background:var(--branco);border:1px solid var(--linha);padding:14px;margin-top:10px;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px 14px}" +
      ".fx-campo{display:flex;flex-direction:column;gap:3px;font:600 11px 'DM Sans',sans-serif;color:var(--grafite)}" +
      ".fx-campo input,.fx-campo select,.fx-campo textarea{font:400 13px 'DM Sans',sans-serif;color:var(--tinta);padding:6px 8px;border:1px solid var(--linha);border-radius:0;background:var(--branco);width:100%;box-sizing:border-box}" +
      ".fx-destaque{background:var(--prog-w);padding:8px;grid-column:1/-1}.fx-destaque span{font-size:12px;color:var(--prog)}" +
      ".fx-linha-larga{grid-column:1/-1}.fx-rotas{display:flex;flex-wrap:wrap;gap:6px 16px;font:400 13px 'DM Sans',sans-serif}" +
      ".fx-msg{margin:0 0 10px;padding:8px 12px;font:400 13px 'DM Sans',sans-serif}.fx-msg.ok{background:var(--ok-w);color:var(--ok)}.fx-msg.erro{background:var(--warn-w);color:var(--warn)}";
    document.head.appendChild(st);
  }

  // ---- tela ----
  function render() {
    injetarEstilos();
    const el = area();
    if (!dados) { el.innerHTML = "<p>Carregando…</p>"; garantirDados(); return; }
    let h = (fallback ? avisoFallback() : "");
    h += '<div class="vista-toggle" id="fx-secoes">' + Object.keys(TITULO).map((s) => '<button type="button" data-s="' + s + '" class="' + (s === secao ? "ativo" : "") + '">' + TITULO[s] + "</button>").join("") + "</div>";
    if (mensagem) h += '<p class="fx-msg ' + (mensagem.ok ? "ok" : "erro") + '" role="status">' + esc(mensagem.texto) + "</p>";
    const lista = dados[secao] || [];
    h += '<p><button type="button" class="ed-btn" id="fx-novo"' + (fallback ? " disabled" : "") + ">" + ROTULO_NOVO[secao] + "</button></p>";
    h += '<ul class="fx-lista">' + (lista.length ? lista.map((r) =>
      '<li class="' + (r.ativo === false ? "off" : "") + '"><span>' + resumo(secao, r) + (r.ativo === false ? " <small>(desativado)</small>" : "") + '</span><span class="fx-acoes">'
      + '<button type="button" class="ed-btn sec" data-ed="' + esc(r.id) + '">Editar</button>'
      + '<button type="button" class="ed-btn sec" data-at="' + esc(r.id) + '"' + (fallback ? " disabled" : "") + ">" + (r.ativo === false ? "Reativar" : "Desativar") + "</button></span></li>").join("") : "<li>Nada cadastrado ainda.</li>") + "</ul>";
    if (aberto) h += formHtml();
    area().innerHTML = h;
    ligar();
  }

  function formHtml() {
    const reg = aberto.id ? (dados[secao] || []).find((x) => x.id === aberto.id) : null;
    let h = '<form class="fx-form" id="fx-form" novalidate>' + CAMPOS[secao].map((c) => campoHtml(c, reg)).join("");
    if (secao === "paineis") {
      const ligadas = new Set((dados.painel_rotas || []).filter((l) => reg && l.painel_id === reg.id).map((l) => l.rota_id));
      h += '<div class="fx-campo fx-linha-larga"><span>Rotas que alimentam este painel</span><div class="fx-rotas">'
        + (ativos(dados.rotas).map((r) => '<label><input type="checkbox" data-rota="' + esc(r.id) + '"' + (ligadas.has(r.id) ? " checked" : "") + "> " + esc(r.iniciativa + " · " + F.ROTULO_TIPO_DADO[r.tipo_dado]) + "</label>").join("") || "<em>Nenhuma rota cadastrada.</em>") + "</div></div>";
    }
    if (secao === "rotas" || secao === "paineis") h += '<p class="fx-linha-larga"><small>Sistema não está na lista? <a href="#" id="fx-novo-sistema">Cadastrar sistema novo</a> (você perde o que não salvou aqui).</small></p>';
    h += '<div class="fx-linha-larga"><button type="submit" class="ed-btn"' + (fallback ? " disabled" : "") + '>Salvar</button> <button type="button" class="ed-btn sec" id="fx-cancelar">Cancelar</button></div></form>';
    return h;
  }

  function ligar() {
    const el = area();
    el.querySelectorAll("#fx-secoes button").forEach((b) => b.addEventListener("click", () => { secao = b.getAttribute("data-s"); aberto = null; mensagem = null; render(); }));
    const novo = document.getElementById("fx-novo"); if (novo) novo.addEventListener("click", () => { aberto = { id: null }; mensagem = null; render(); });
    el.querySelectorAll("[data-ed]").forEach((b) => b.addEventListener("click", () => { aberto = { id: b.getAttribute("data-ed") }; mensagem = null; render(); }));
    el.querySelectorAll("[data-at]").forEach((b) => b.addEventListener("click", () => alternarAtivo(b.getAttribute("data-at"))));
    const cancel = document.getElementById("fx-cancelar"); if (cancel) cancel.addEventListener("click", () => { aberto = null; render(); });
    const sis = document.getElementById("fx-novo-sistema");
    if (sis) sis.addEventListener("click", (e) => { e.preventDefault(); secao = "sistemas"; aberto = { id: null }; render(); });
    el.querySelectorAll("select[data-iniciativa]").forEach((s) => s.addEventListener("change", () => {
      document.getElementById(s.id + "-livre").hidden = s.value !== "__outra__";
    }));
    const form = document.getElementById("fx-form"); if (form) form.addEventListener("submit", (e) => { e.preventDefault(); salvar(); });
  }

  function falhou(err) { mensagem = { ok: false, texto: F.mensagemErro(err) }; console.error("editor-fluxo:", err); render(); }

  async function alternarAtivo(id) {
    const reg = (dados[secao] || []).find((x) => x.id === id); if (!reg) return;
    try { await (reg.ativo === false ? F.reativar : F.desativar)(secao, id); await recarregar(reg.ativo === false ? "Reativado." : "Desativado."); }
    catch (err) { falhou(err); }
  }
  async function recarregar(texto) {
    const r = await F.carregar({ recarregar: true });
    dados = r.dados; fallback = r.usandoFallback; aberto = null; mensagem = { ok: true, texto: texto }; render();
  }

  async function salvar() {
    const { campos, erros } = lerForm(secao);
    if (erros.length) { mensagem = { ok: false, texto: "Preencha: " + erros.join(", ") + "." }; render(); return restaurar(campos); }
    if (secao === "encaminhamentos") {
      if (!campos.rota_id && !campos.painel_id) { mensagem = { ok: false, texto: "Escolha uma rota e/ou um painel." }; render(); return restaurar(campos); }
      campos.concluido_em = campos.status === "feito" ? hoje() : null;
    }
    try {
      const reg = aberto.id ? await F.salvar(secao, aberto.id, campos) : await F.criar(secao, campos);
      if (secao === "paineis") await sincronizarRotas(reg.id);
      await recarregar("Salvo.");
    } catch (err) { falhou(err); restaurar(campos); }
  }
  // após re-render por erro, devolve ao formulário o que a pessoa tinha digitado
  function restaurar(campos) {
    CAMPOS[secao].forEach((c) => {
      const el = document.getElementById("fx-" + c.k); if (!el || campos[c.k] == null) return;
      if (c.t === "iniciativa" && Array.prototype.every.call(el.options, (o) => o.value !== campos[c.k])) {
        el.value = "__outra__"; const l = document.getElementById(el.id + "-livre"); l.hidden = false; l.value = campos[c.k];
      } else el.value = campos[c.k];
    });
  }
  async function sincronizarRotas(painelId) {
    const marcadas = new Set(Array.prototype.map.call(area().querySelectorAll("input[data-rota]:checked"), (i) => i.getAttribute("data-rota")));
    const atuais = new Set((dados.painel_rotas || []).filter((l) => l.painel_id === painelId).map((l) => l.rota_id));
    for (const r of marcadas) if (!atuais.has(r)) await F.vincularPainelRota(painelId, r);
    for (const r of atuais) if (!marcadas.has(r)) await F.desvincularPainelRota(painelId, r);
  }

  window.EDITOR_FLUXO = { render: render };
})();
