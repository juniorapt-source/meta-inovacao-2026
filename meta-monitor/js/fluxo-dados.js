/* fluxo-dados.html — tela "Fluxo de dados" (Projeto Corso). Somente leitura, salvo no modo de
 * edição (botão "Ativar edição", flag em sessionStorage): aí aparecem "Nova rota", "Novo painel" e
 * "Novo encaminhamento", com o formulário compartilhado de js/fluxo-form.js (o mesmo da aba do editor).
 *
 * 4 blocos: Matriz (iniciativa × cliente/atendimento/processo/painel, vinda da view
 * fluxo_dados_matriz), Rotas (view fluxo_dados_rotas_lacunas), Painéis (view
 * fluxo_dados_paineis_prontidao) e Encaminhamentos. Os dados vêm de DB_FLUXO.carregar(),
 * que lê do Supabase e cai pro snapshot data/fluxo_dados.js. A edição completa mora na aba "Fluxo
 * de dados" do editor.html (js/editor-fluxo.js).
 *
 * PRECISA de js/core.js (esc, montarShell), js/db-fluxo.js, js/fluxo-form.js e js/db-projetos.js
 * antes.
 */
(function () {
  "use strict";
  const F = window.DB_FLUXO;
  const CAMADAS = ["cliente", "atendimento", "processo", "painel"];
  let D = null;            // dados carregados
  let iniciativas = [];    // linhas da matriz
  let selecionada = "";    // "" = todas
  let usandoFallback = false;
  let formAberto = null;   // { secao: "rotas"|"encaminhamentos", id: null|uuid }
  let mensagem = null;     // { ok, texto }
  const FF = window.FLUXO_FORM;
  const CHAVE_EDICAO = "cc_fluxo_edicao";
  const TITULO_FORM = { rotas: "Nova rota", paineis: "Novo painel", encaminhamentos: "Novo encaminhamento" };

  const $ = (id) => document.getElementById(id);
  const rotulo = (map, k) => (k && map[k] !== undefined ? map[k] : (k || "—"));
  const ativos = (l) => (l || []).filter((x) => x.ativo !== false);

  function edicaoLigada() { try { return sessionStorage.getItem(CHAVE_EDICAO) === "1"; } catch (e) { return false; } }
  function definirEdicao(on) {
    try { if (on) sessionStorage.setItem(CHAVE_EDICAO, "1"); else sessionStorage.removeItem(CHAVE_EDICAO); } catch (e) { /* sem sessionStorage: o modo vale só até recarregar */ }
  }
  const ctx = () => ({ dados: D, fallback: usandoFallback, iniciativasBase: iniciativas });
  function textoErro(err) {
    const S = window.CC_SUPABASE;
    return (S && S.ehErroDePermissao && S.ehErroDePermissao(err) && S.mensagemEscritaAmigavel(err)) || F.mensagemErro(err);
  }

  function chipStatus(s) {
    if (!s) return "";
    return '<span class="fd-st fd-st-' + esc(s) + '">' + esc(rotulo(F.ROTULO_STATUS, s)) + "</span>";
  }

  function listaIniciativas() {
    const nomes = new Set();
    iniciativas.forEach((n) => nomes.add(n));
    D.rotas_lacunas.forEach((r) => nomes.add(r.iniciativa));
    D.matriz.forEach((m) => nomes.add(m.iniciativa));
    D.paineis_prontidao.forEach((p) => p.iniciativa && nomes.add(p.iniciativa));
    return Array.from(nomes).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  function renderMatriz() {
    const idx = {};
    D.matriz.forEach((m) => { idx[m.iniciativa + "|" + m.camada] = m; });
    const linhas = listaIniciativas();
    let h = "<thead><tr><th>Iniciativa</th>" + CAMADAS.map((c) => "<th>" + esc(F.ROTULO_TIPO_DADO[c]) + "</th>").join("") + "</tr></thead><tbody>";
    linhas.forEach((ini) => {
      h += '<tr' + (ini === selecionada ? ' class="sel"' : "") + "><td>" + esc(ini) + "</td>";
      CAMADAS.forEach((c) => {
        const m = idx[ini + "|" + c];
        if (!m) { h += '<td><span class="fd-vazia">sem rota cadastrada</span></td>'; return; }
        h += '<td><button type="button" class="fd-cel" data-ini="' + esc(ini) + '" title="' + m.qtd + ' cadastrado(s) — ver ' + esc(ini) + '">' + chipStatus(m.status_pior) + "</button></td>";
      });
      h += "</tr>";
    });
    $("fd-matriz").innerHTML = h + "</tbody>";
  }

  function renderFiltro() {
    $("fd-filtro").innerHTML = selecionada
      ? 'Mostrando: <b>' + esc(selecionada) + '</b> · <a href="#" id="fd-limpar">ver todas as iniciativas</a>'
      : "Mostrando todas as iniciativas.";
    const a = $("fd-limpar");
    if (a) a.addEventListener("click", (e) => { e.preventDefault(); selecionar(""); });
  }

  function seloLacuna(r) {
    let h = "";
    if (r.alvo_definido === false) h += '<span class="fd-selo">alvo indefinido</span>';
    if (r.lacuna_destino) h += '<span class="fd-selo">sem destino</span>';
    if (r.lacuna_golden) h += '<span class="fd-selo">sem golden</span>';
    if (r.lacuna_mecanismo) h += '<span class="fd-selo">sem mecanismo</span>';
    if (r.lacuna_remetente) h += '<span class="fd-selo">sem remetente</span>';
    return h || '<span class="fd-selo ok">sem lacunas</span>';
  }

  function renderRotas() {
    const lista = D.rotas_lacunas.filter((r) => !selecionada || r.iniciativa === selecionada);
    if (!lista.length) { $("fd-rotas").innerHTML = '<p class="fd-vazio-msg">Nenhuma rota cadastrada' + (selecionada ? " para " + esc(selecionada) : "") + ".</p>"; return; }
    const rotaPorId = {}; ativos(D.rotas).forEach((x) => { rotaPorId[x.id] = x; });
    const chips = (nomes) => (nomes.length ? nomes.map((n) => '<span class="fd-chip">' + esc(n) + "</span>").join("") : "—");
    $("fd-rotas").innerHTML = lista.map((r) => {
      // outras fontes e destinos vêm das tabelas (a view de lacunas só traz destino em texto e
      // não traz outras fontes); se a rota não estiver na tabela, cai no texto da view
      const tab = rotaPorId[r.id] || {};
      const fontes = F.resumoOutrasFontes(tab);
      const hojeN = F.nomesDestinos(D, r.id, "hoje"), alvoN = F.nomesDestinos(D, r.id, "alvo");
      const quem = (v) => (v ? esc(v) : '<span class="vazio">não informado</span>');
      return '<article class="fd-card"><h3>' + esc(r.iniciativa) + " · " + esc(rotulo(F.ROTULO_TIPO_DADO, r.tipo_dado)) + " " + chipStatus(r.status) + "</h3>"
        + '<div class="fd-linha">' + esc(r.descricao || "") + "</div>"
        + '<div class="fd-quem"><div class="fd-linha"><b>Quem envia hoje:</b> ' + quem(r.quem_envia_hoje) + "</div>"
        + '<div class="fd-linha"><b>Quem deveria enviar:</b> ' + quem(r.quem_deveria_enviar) + "</div></div>"
        + '<div class="fd-linha"><b>Origem</b> ' + esc(r.origem || "—") + '<span class="fd-seta">→</span><b>destino hoje</b> ' + (hojeN.length || !r.destino_hoje ? chips(hojeN) : esc(r.destino_hoje))
        + '<span class="fd-seta">→</span><b>destino alvo</b> ' + (alvoN.length || !r.destino_alvo ? chips(alvoN) : esc(r.destino_alvo)) + "</div>"
        + '<div class="fd-linha"><b>Mecanismo</b> ' + esc(rotulo(F.ROTULO_MECANISMO, r.mecanismo_hoje)) + '<span class="fd-seta">→</span>' + esc(rotulo(F.ROTULO_MECANISMO, r.mecanismo_alvo))
        + " · <b>chega completo</b> " + esc(rotulo(F.ROTULO_CHEGA, r.chega_completo)) + "</div>"
        + '<div class="fd-linha"><b>Outras fontes</b> ' + (fontes.itens.length ? chips(fontes.itens) : '<span class="fd-vazia">' + esc(fontes.aviso) + "</span>") + "</div>"
        + "<div>" + seloLacuna(r) + "</div></article>";
    }).join("");
  }

  function renderPaineis() {
    const lista = D.paineis_prontidao.filter((p) => !selecionada || p.iniciativa === selecionada || (!p.iniciativa && !selecionada));
    if (!lista.length) { $("fd-paineis").innerHTML = '<p class="fd-vazio-msg">Nenhum painel cadastrado' + (selecionada ? " para " + esc(selecionada) : "") + ".</p>"; return; }
    $("fd-paineis").innerHTML = lista.map((p) => {
      const pronto = p.pronto_para_reapontar
        ? '<span class="fd-selo ok">pronto para reapontar</span>'
        : '<span class="fd-selo">ainda não pronto</span>';
      return '<article class="fd-card"><h3>' + esc(p.nome) + " " + chipStatus(p.status) + "</h3>"
        + '<div class="fd-linha">' + (p.iniciativa ? esc(p.iniciativa) : "transversal") + ' <span data-link-painel="' + esc(p.id) + '"></span></div>'
        + '<div class="fd-linha"><b>Fonte hoje</b> ' + esc(p.fonte_hoje || "—") + '<span class="fd-seta">→</span><b>fonte alvo</b> ' + esc(p.fonte_alvo || "—") + "</div>"
        + '<div class="fd-linha"><b>Rotas:</b> ' + p.rotas_ok + " ok · " + p.rotas_pendentes + " pendentes (de " + p.rotas_ligadas + ")</div>"
        + "<div>" + pronto + "</div></article>";
    }).join("");
    // link do painel: a view de prontidão não tem link_painel; vem da tabela fluxo_dados_paineis
    FF.anexarLinksPainel($("fd-paineis"), D.paineis);
  }

  function renderEncaminhamentos() {
    const rotaPorId = {}; ativos(D.rotas).forEach((r) => { rotaPorId[r.id] = r; });
    const painelPorId = {}; ativos(D.paineis).forEach((p) => { painelPorId[p.id] = p; });
    const encPorId = {}; D.encaminhamentos.forEach((e) => { encPorId[e.id] = e; });
    const lista = ativos(D.encaminhamentos).filter((e) => {
      if (!selecionada) return true;
      const r = rotaPorId[e.rota_id], p = painelPorId[e.painel_id];
      return (r && r.iniciativa === selecionada) || (p && p.iniciativa === selecionada);
    });
    if (!lista.length) { $("fd-enc").innerHTML = '<p class="fd-vazio-msg">Nenhum encaminhamento' + (selecionada ? " para " + esc(selecionada) : "") + ".</p>"; return; }
    $("fd-enc").innerHTML = lista.map((e) => {
      const r = rotaPorId[e.rota_id], p = painelPorId[e.painel_id];
      const alvo = [r ? "rota " + r.iniciativa + " · " + rotulo(F.ROTULO_TIPO_DADO, r.tipo_dado) : "", p ? "painel " + p.nome : ""].filter(Boolean).join(" + ");
      let dep = "";
      if (e.depende_de_id) {
        const d = encPorId[e.depende_de_id];
        const travado = F.encaminhamentoTravado(e, encPorId);
        dep = '<div class="fd-linha"><b>Depende de:</b> ' + esc(d ? d.acao : "(ação removida)") + (d ? " [" + esc(rotulo(F.ROTULO_ENC, d.status)) + "]" : "")
          + (travado ? ' <span class="fd-selo">bloqueada até a anterior ficar feita</span>' : ' <span class="fd-selo ok">dependência resolvida</span>') + "</div>";
      }
      const cls = e.status === "feito" ? "ok" : e.status === "andamento" ? "andamento" : e.status === "cancelado" ? "nao_se_aplica" : e.status === "bloqueado" ? "a_iniciar" : "entendimento";
      return '<article class="fd-card"><h3>' + esc(e.acao) + ' <span class="fd-st fd-st-' + cls + '">' + esc(rotulo(F.ROTULO_ENC, e.status)) + "</span></h3>"
        + '<div class="fd-linha"><b>Para:</b> ' + esc(alvo || "—") + "</div>"
        + '<div class="fd-linha"><b>Responsável:</b> ' + esc(e.responsavel || "não definido") + " · <b>prazo:</b> " + esc(e.prazo || "sem prazo") + "</div>" + dep + "</article>";
    }).join("");
  }

  // ---- modo de edição: Nova rota / Novo encaminhamento ----
  function renderEdicao() {
    const on = edicaoLigada();
    let h = "";
    if (!on) h = '<button type="button" class="ed-btn sec" id="fd-ed-ligar">Ativar edição</button>';
    else h = '<button type="button" class="ed-btn" id="fd-ed-rota"' + (usandoFallback ? " disabled" : "") + '>Nova rota</button>'
      + '<button type="button" class="ed-btn" id="fd-ed-painel"' + (usandoFallback ? " disabled" : "") + '>Novo painel</button>'
      + '<button type="button" class="ed-btn" id="fd-ed-enc"' + (usandoFallback ? " disabled" : "") + '>Novo encaminhamento</button>'
      + '<button type="button" class="ed-btn sec" id="fd-ed-desligar">Sair da edição</button>';
    $("fd-edicao").innerHTML = h;
    $("fd-msg").innerHTML = mensagem ? '<p class="fx-msg ' + (mensagem.ok ? "ok" : "erro") + '">' + esc(mensagem.texto) + "</p>" : "";
    if (on && formAberto) {
      const reg = formAberto.id ? (D[formAberto.secao] || []).find((x) => x.id === formAberto.id) : null;
      $("fd-form").innerHTML = '<h2>' + TITULO_FORM[formAberto.secao] + "</h2>" + FF.formHtml(formAberto.secao, reg, ctx());
      FF.ligarForm($("fd-form"));
      $("fx-form").addEventListener("submit", (e) => { e.preventDefault(); salvarForm(); });
      $("fx-cancelar").addEventListener("click", () => { formAberto = null; renderEdicao(); });
    } else $("fd-form").innerHTML = "";
    const on1 = $("fd-ed-ligar"); if (on1) on1.addEventListener("click", () => { definirEdicao(true); mensagem = null; renderEdicao(); });
    const off = $("fd-ed-desligar"); if (off) off.addEventListener("click", () => { definirEdicao(false); formAberto = null; mensagem = null; renderEdicao(); });
    const nr = $("fd-ed-rota"); if (nr) nr.addEventListener("click", () => { formAberto = { secao: "rotas", id: null }; mensagem = null; renderEdicao(); $("fd-form").scrollIntoView({ block: "nearest" }); });
    const np = $("fd-ed-painel"); if (np) np.addEventListener("click", () => { formAberto = { secao: "paineis", id: null }; mensagem = null; renderEdicao(); $("fd-form").scrollIntoView({ block: "nearest" }); });
    const ne = $("fd-ed-enc"); if (ne) ne.addEventListener("click", () => { formAberto = { secao: "encaminhamentos", id: null }; mensagem = null; renderEdicao(); $("fd-form").scrollIntoView({ block: "nearest" }); });
  }

  async function recarregarDados() {
    const r = await F.carregar({ recarregar: true });
    D = r.dados; usandoFallback = r.usandoFallback;
  }

  async function salvarForm() {
    const secao = formAberto.secao;
    const col = FF.coletar(secao);
    if (col.erros.length) { mensagem = { ok: false, texto: col.erros.join(" ") }; renderEdicao(); return FF.restaurar(secao, col); }
    try {
      await FF.gravar(secao, formAberto.id, col, ctx());
      await recarregarDados();
      formAberto = null; mensagem = { ok: true, texto: "Salvo." };
      renderTudo();
    } catch (err) {
      console.error("fluxo-dados: falha ao salvar", err);
      if (err.rotaId) {
        // a rota já foi gravada; o formulário fica aberto nela para repetir só os destinos
        formAberto = { secao: "rotas", id: err.rotaId };
        try { await recarregarDados(); renderTudo(); } catch (e) { /* mantém a tela atual */ }
        mensagem = { ok: false, texto: "A rota foi salva, mas os destinos não. " + textoErro(err) + " Clique em Salvar para tentar de novo." };
      } else mensagem = { ok: false, texto: textoErro(err) };
      renderEdicao(); FF.restaurar(secao, col);
    }
  }

  function renderTudo() { FF.injetarEstilos(); renderEdicao(); renderMatriz(); renderFiltro(); renderRotas(); renderPaineis(); renderEncaminhamentos(); }
  function selecionar(ini) { selecionada = ini; renderTudo(); if (ini) $("fd-filtro").scrollIntoView({ behavior: "smooth", block: "start" }); }

  async function iniciar() {
    montarShell("fluxo-dados.html");
    try {
      const rp = await window.DB_PROJETOS.carregar();
      iniciativas = rp.lista.map((p) => p.iniciativa);
    } catch (e) { iniciativas = ((window.DB && window.DB.projetos) || []).map((p) => p.iniciativa); }
    const r = await F.carregar();
    D = r.dados; usandoFallback = r.usandoFallback;
    if (r.usandoFallback) {
      $("aviso-fallback").hidden = false;
      if (r.motivoFallback) $("aviso-fallback").insertAdjacentHTML("beforeend", ' <small title="' + esc(r.motivoFallback) + '">(' + esc(r.motivoFallback) + ")</small>");
    }
    $("fd-matriz").addEventListener("click", (ev) => {
      const b = ev.target.closest(".fd-cel");
      if (b) selecionar(b.getAttribute("data-ini"));
    });
    renderTudo();
  }
  iniciar().catch((err) => {
    console.error(err);
    $("fd-estado").innerHTML = '<p class="aviso">Não foi possível montar a página: ' + esc(err.message || String(err)) + "</p>";
  });
})();
