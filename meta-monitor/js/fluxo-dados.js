/* fluxo-dados.html — tela "Fluxo de dados" (Projeto Corso), SOMENTE LEITURA.
 *
 * 4 blocos: Matriz (iniciativa × cliente/atendimento/processo/painel, vinda da view
 * fluxo_dados_matriz), Rotas (view fluxo_dados_rotas_lacunas), Painéis (view
 * fluxo_dados_paineis_prontidao) e Encaminhamentos. Os dados vêm de DB_FLUXO.carregar(),
 * que lê do Supabase e cai pro snapshot data/fluxo_dados.js. A edição mora na aba "Fluxo de
 * dados" do editor.html (js/editor-fluxo.js).
 *
 * PRECISA de js/core.js (esc, montarShell), js/db-fluxo.js e js/db-projetos.js antes.
 */
(function () {
  "use strict";
  const F = window.DB_FLUXO;
  const CAMADAS = ["cliente", "atendimento", "processo", "painel"];
  let D = null;            // dados carregados
  let iniciativas = [];    // linhas da matriz
  let selecionada = "";    // "" = todas

  const $ = (id) => document.getElementById(id);
  const rotulo = (map, k) => (k && map[k] !== undefined ? map[k] : (k || "—"));
  const ativos = (l) => (l || []).filter((x) => x.ativo !== false);

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
    $("fd-rotas").innerHTML = lista.map((r) => {
      const quem = (v) => (v ? esc(v) : '<span class="vazio">não informado</span>');
      return '<article class="fd-card"><h3>' + esc(r.iniciativa) + " · " + esc(rotulo(F.ROTULO_TIPO_DADO, r.tipo_dado)) + " " + chipStatus(r.status) + "</h3>"
        + '<div class="fd-linha">' + esc(r.descricao || "") + "</div>"
        + '<div class="fd-quem"><div class="fd-linha"><b>Quem envia hoje:</b> ' + quem(r.quem_envia_hoje) + "</div>"
        + '<div class="fd-linha"><b>Quem deveria enviar:</b> ' + quem(r.quem_deveria_enviar) + "</div></div>"
        + '<div class="fd-linha"><b>Origem</b> ' + esc(r.origem || "—") + '<span class="fd-seta">→</span><b>destino hoje</b> ' + esc(r.destino_hoje || "—")
        + '<span class="fd-seta">→</span><b>destino alvo</b> ' + esc(r.destino_alvo || "—") + "</div>"
        + '<div class="fd-linha"><b>Mecanismo</b> ' + esc(rotulo(F.ROTULO_MECANISMO, r.mecanismo_hoje)) + '<span class="fd-seta">→</span>' + esc(rotulo(F.ROTULO_MECANISMO, r.mecanismo_alvo))
        + " · <b>chega completo</b> " + esc(rotulo(F.ROTULO_CHEGA, r.chega_completo)) + "</div>"
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
        + '<div class="fd-linha">' + esc(p.indicador || "") + (p.iniciativa ? " · " + esc(p.iniciativa) : " · transversal") + "</div>"
        + '<div class="fd-linha"><b>Fonte hoje</b> ' + esc(p.fonte_hoje || "—") + '<span class="fd-seta">→</span><b>fonte alvo</b> ' + esc(p.fonte_alvo || "—") + "</div>"
        + '<div class="fd-linha"><b>Rotas:</b> ' + p.rotas_ok + " ok · " + p.rotas_pendentes + " pendentes (de " + p.rotas_ligadas + ")</div>"
        + "<div>" + pronto + "</div></article>";
    }).join("");
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

  function renderTudo() { renderMatriz(); renderFiltro(); renderRotas(); renderPaineis(); renderEncaminhamentos(); }
  function selecionar(ini) { selecionada = ini; renderTudo(); if (ini) $("fd-filtro").scrollIntoView({ behavior: "smooth", block: "start" }); }

  async function iniciar() {
    montarShell("fluxo-dados.html");
    try {
      const rp = await window.DB_PROJETOS.carregar();
      iniciativas = rp.lista.map((p) => p.iniciativa);
    } catch (e) { iniciativas = ((window.DB && window.DB.projetos) || []).map((p) => p.iniciativa); }
    const r = await F.carregar();
    D = r.dados;
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
