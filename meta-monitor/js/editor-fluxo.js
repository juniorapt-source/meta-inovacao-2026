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
 * PRECISA de js/db-fluxo.js, js/fluxo-form.js (formulários), js/db-projetos.js e js/editor-shared.js
 * (esc/avisoFallback).
 */
(function () {
  "use strict";
  const F = window.DB_FLUXO;
  let dados = null, fallback = false, carregando = false, iniciativasBase = [];
  let secao = "rotas";            // rotas | paineis | encaminhamentos | sistemas
  let aberto = null;              // { id|null } formulário aberto na seção atual
  let mensagem = null;            // { ok:boolean, texto }

  const ativos = (l) => (l || []).filter((x) => x.ativo !== false);
  const area = () => document.getElementById("ed-area");

  // especificação dos campos, HTML do formulário, leitura/validação e gravação moram em
  // js/fluxo-form.js (compartilhado com a página fluxo-dados.html)
  const FF = window.FLUXO_FORM;
  const CAMPOS = FF.CAMPOS;
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

  const nomesDestino = (rotaId, momento) => F.nomesDestinos(dados, rotaId, momento).join(", ") || "—";
  const sistemaNome = (id) => { const s = (dados.sistemas || []).find((x) => x.id === id); return s ? s.nome : "—"; };
  const ctx = () => ({ dados: dados, fallback: fallback, iniciativasBase: iniciativasBase });

  // ---- resumos das listas ----
  function resumo(secaoAtual, r) {
    if (secaoAtual === "rotas") return esc(r.iniciativa) + " · " + esc(F.ROTULO_TIPO_DADO[r.tipo_dado]) + " — " + esc(sistemaNome(r.sistema_origem_id)) + " → " + esc(nomesDestino(r.id, "hoje")) + " (alvo " + esc(nomesDestino(r.id, "alvo")) + ")"
      + "<br><small>envia hoje: " + esc(r.quem_envia_hoje || "não informado") + " · deveria enviar: " + esc(r.quem_deveria_enviar || "não informado") + " · " + esc(F.ROTULO_STATUS[r.status] || r.status) + "</small>";
    if (secaoAtual === "paineis") return esc(r.nome) + " — " + esc(r.iniciativa || "transversal") + " (" + esc(sistemaNome(r.sistema_fonte_hoje_id)) + " → " + esc(sistemaNome(r.sistema_fonte_alvo_id)) + ") · " + esc(F.ROTULO_STATUS[r.status] || r.status) + ' <span data-link-painel="' + esc(r.id) + '"></span>';
    if (secaoAtual === "encaminhamentos") return esc(r.acao) + " — " + esc(r.responsavel || "sem responsável") + " · " + esc(r.prazo || "sem prazo") + " · " + esc(F.ROTULO_ENC[r.status] || r.status);
    return esc(r.nome) + " <small>(" + esc(r.slug) + " · " + esc(r.tipo || "—") + ")</small>";
  }

  function injetarEstilos() {
    FF.injetarEstilos();
    if (document.getElementById("ed-fluxo-estilos")) return;
    const st = document.createElement("style"); st.id = "ed-fluxo-estilos";
    st.textContent =
      ".fx-lista{list-style:none;margin:0 0 14px;padding:0}.fx-lista li{display:flex;gap:10px;justify-content:space-between;align-items:center;padding:8px 10px;border-top:1px solid var(--border-soft);font:400 13px 'DM Sans',sans-serif}" +
      ".fx-lista li.off{opacity:.55}.fx-acoes{display:flex;gap:6px;flex-shrink:0}";
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
    return FF.formHtml(secao, reg, ctx(), { linkNovoSistema: true });
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
    FF.ligarForm(el);
    if (secao === "paineis") FF.anexarLinksPainel(el, dados.paineis);
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
    const col = FF.coletar(secao);
    if (col.erros.length) { mensagem = { ok: false, texto: col.erros.join(" ") }; render(); return FF.restaurar(secao, col); }
    try {
      await FF.gravar(secao, aberto.id, col, ctx());
      await recarregar("Salvo.");
    } catch (err) {
      // rota gravada mas destinos não: o formulário continua aberto, agora apontando para a
      // rota que já existe, para "Salvar" de novo só repetir os destinos (sem duplicar a rota)
      if (err.rotaId) {
        aberto = { id: err.rotaId };
        try { const r = await F.carregar({ recarregar: true }); dados = r.dados; fallback = r.usandoFallback; } catch (e) { /* mantém a tela atual */ }
        mensagem = { ok: false, texto: "A rota foi salva, mas os destinos não. " + F.mensagemErro(err) + " Clique em Salvar para tentar de novo." };
        render(); return FF.restaurar(secao, col);
      }
      falhou(err); FF.restaurar(secao, col);
    }
  }

  window.EDITOR_FLUXO = { render: render };
})();
