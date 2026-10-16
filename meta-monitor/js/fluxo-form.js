/* Formulários da frente "Fluxo de dados" (Projeto Corso), compartilhados entre a aba "Fluxo de
 * dados" do editor.html (js/editor-fluxo.js) e a página fluxo-dados.html (js/fluxo-dados.js,
 * botões "Nova rota" / "Novo encaminhamento" em modo de edição).
 *
 * Aqui mora o que é comum: a especificação dos campos, o HTML do formulário, a leitura e a
 * validação do que foi digitado, a gravação (rota + destinos, painel + rotas ligadas) e os
 * estilos. Quem usa decide onde o formulário aparece, a lista, a mensagem e o recarregamento.
 *
 * Contexto (ctx) que quem usa passa: { dados, fallback, iniciativasBase }.
 * PRECISA de js/db-fluxo.js antes e de js/core.js (esc). Sem estado próprio.
 */
(function () {
  "use strict";
  const F = window.DB_FLUXO;
  const ativos = (l) => (l || []).filter((x) => x.ativo !== false);
  const hoje = () => new Date().toISOString().slice(0, 10);
  const _esc = (s) => (typeof window.esc === "function" ? window.esc(s) : String(s == null ? "" : s));

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
      { k: "destinos_hoje", rot: "Destino hoje (um ou mais)", t: "destinos", momento: "hoje" },
      { k: "destinos_alvo", rot: "Destino alvo (um ou mais)", t: "destinos", momento: "alvo" },
      ENUM(F.MECANISMOS, F.ROTULO_MECANISMO, { k: "mecanismo_hoje", rot: "Mecanismo hoje", obrig: true, padrao: "a_definir" }),
      ENUM(F.MECANISMOS, F.ROTULO_MECANISMO, { k: "mecanismo_alvo", rot: "Mecanismo alvo", obrig: true, padrao: "a_definir" }),
      { k: "frequencia", rot: "Frequência", t: "text" },
      ENUM(F.CHEGA_COMPLETO, F.ROTULO_CHEGA, { k: "chega_completo", rot: "Chega completo?", obrig: true, padrao: "nao_sabe" }),
      { k: "perda", rot: "O que se perde", t: "area" },
      { k: "outras_fontes", rot: "Outras fontes", t: "fontes" },
      { k: "risco_divergencia", rot: "Risco de divergência", t: "area" },
      { k: "identificacao_no_foco", rot: "Identificação no Foco", t: "area" },
      { k: "golden_hoje_id", rot: "Golden hoje", t: "sistema" },
      { k: "golden_alvo_id", rot: "Golden alvo", t: "sistema" },
      ENUM(F.STATUS, F.ROTULO_STATUS, { k: "status", rot: "Status", obrig: true, padrao: "entendimento" }),
      { k: "validado_com", rot: "Validado com", t: "text" },
      { k: "validado_em", rot: "Validado em", t: "date" },
      { k: "observacao", rot: "Observação", t: "area" },
    ],
    // indicador e ferramenta saíram do formulário na v0.32.0 (as colunas ficam no banco, anuláveis,
    // e como o formulário nem lê nem envia esses campos, editar um painel antigo não os apaga)
    paineis: [
      { k: "nome", rot: "Nome do painel", t: "text", obrig: true },
      { k: "iniciativa", rot: "Iniciativa (vazio = transversal)", t: "iniciativa", branco: true },
      { k: "link_painel", rot: "Link do painel (opcional, http:// ou https://)", t: "url" },
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

  function listaIniciativas(ctx) {
    const s = new Set(ctx.iniciativasBase || []);
    ativos(ctx.dados.rotas).concat(ativos(ctx.dados.paineis)).forEach((x) => x.iniciativa && s.add(x.iniciativa));
    return Array.from(s).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }

  // ---- renderização de campos ----
  function opcoesHtml(pares, atual, branco) {
    return (branco ? '<option value="">—</option>' : "") + pares.map((p) => '<option value="' + _esc(p[0]) + '"' + (p[0] === atual ? " selected" : "") + ">" + _esc(p[1]) + "</option>").join("");
  }
  function fonteItemHtml(valor) {
    return '<div class="fx-fonte"><input type="text" data-fonte placeholder="Ex.: planilha da equipe, outro sistema…" value="' + _esc(valor || "") + '">'
      + '<button type="button" class="ed-btn sec" data-fonte-rm aria-label="Remover esta fonte">Remover</button></div>';
  }

  function campoHtml(c, reg, ctx) {
    const dados = ctx.dados;
    const v = reg ? reg[c.k] : (c.padrao || null);
    const id = "fx-" + c.k;
    let ctl = "";
    if (c.t === "text") ctl = '<input type="text" id="' + id + '" data-k="' + c.k + '" value="' + _esc(v || "") + '">';
    else if (c.t === "url") ctl = '<input type="url" id="' + id + '" data-k="' + c.k + '" inputmode="url" placeholder="https://…" value="' + _esc(v || "") + '">';
    else if (c.t === "date") ctl = '<input type="date" id="' + id + '" data-k="' + c.k + '" value="' + _esc(v || "") + '">';
    else if (c.t === "area") ctl = '<textarea id="' + id + '" data-k="' + c.k + '" rows="2">' + _esc(v || "") + "</textarea>";
    else if (c.t === "enum") ctl = '<select id="' + id + '" data-k="' + c.k + '">' + opcoesHtml(c.opcoes.map((o) => [o, c.rotulos[o]]), v, c.branco) + "</select>";
    else if (c.t === "sistema") {
      ctl = '<select id="' + id + '" data-k="' + c.k + '">' + opcoesHtml(ativos(dados.sistemas).map((s) => [s.id, s.nome]), v, true) + "</select>";
    } else if (c.t === "tipo_sistema") {
      ctl = '<input type="text" id="' + id + '" data-k="' + c.k + '" list="fx-tipos" value="' + _esc(v || "") + '"><datalist id="fx-tipos">' + F.TIPOS_SISTEMA_SUGERIDOS.map((t) => '<option value="' + _esc(t) + '">').join("") + "</datalist>";
    } else if (c.t === "rota") {
      ctl = '<select id="' + id + '" data-k="' + c.k + '">' + opcoesHtml(ativos(dados.rotas).map((r) => [r.id, r.iniciativa + " · " + F.ROTULO_TIPO_DADO[r.tipo_dado]]), v, true) + "</select>";
    } else if (c.t === "painel") {
      ctl = '<select id="' + id + '" data-k="' + c.k + '">' + opcoesHtml(ativos(dados.paineis).map((p) => [p.id, p.nome]), v, true) + "</select>";
    } else if (c.t === "enc") {
      const self = reg && reg.id;
      ctl = '<select id="' + id + '" data-k="' + c.k + '">' + opcoesHtml(ativos(dados.encaminhamentos).filter((e) => e.id !== self).map((e) => [e.id, e.acao]), v, true) + "</select>";
    } else if (c.t === "iniciativa") {
      const lista = listaIniciativas(ctx);
      const livre = v && lista.indexOf(v) === -1;
      ctl = '<select id="' + id + '" data-k="' + c.k + '" data-iniciativa="1">'
        + opcoesHtml(lista.map((n) => [n, n]), v, true) + '<option value="__outra__"' + (livre ? " selected" : "") + ">outra (texto livre)</option></select>"
        + '<input type="text" id="' + id + '-livre" placeholder="Nome da iniciativa" value="' + _esc(livre ? v : "") + '"' + (livre ? "" : " hidden") + ">";
    } else if (c.t === "destinos") {
      // vários sistemas por momento: caixas de marcar (mesmo padrão das rotas do painel)
      const marcados = new Set(reg ? F.destinosDaRota(dados, reg.id, c.momento) : []);
      ctl = '<div class="fx-rotas" id="' + id + '">' + (ativos(dados.sistemas).map((s) =>
        '<label><input type="checkbox" data-destino="' + c.momento + '" value="' + _esc(s.id) + '"' + (marcados.has(s.id) ? " checked" : "") + "> " + _esc(s.nome) + "</label>").join("") || "<em>Nenhum sistema cadastrado.</em>") + "</div>";
    } else if (c.t === "fontes") {
      const lista = F.normalizarFontes(reg ? reg.outras_fontes : []);
      ctl = '<div id="' + id + '"><div class="fx-fontes">' + lista.map(fonteItemHtml).join("") + "</div>"
        + '<button type="button" class="ed-btn sec" data-fonte-add>+ Adicionar fonte</button> <small>Sem itens = nenhuma outra fonte informada.</small></div>';
    }
    // destinos/fontes têm vários controles dentro: <div> em vez de <label>, para um clique no
    // texto do rótulo não marcar a primeira caixa sem querer
    const tag = (c.t === "destinos" || c.t === "fontes") ? "div" : "label";
    return "<" + tag + ' class="fx-campo' + (c.destaque ? " fx-destaque" : "") + (c.t === "destinos" || c.t === "fontes" ? " fx-linha-larga" : "") + '"><span>' + _esc(c.rot) + (c.obrig ? " *" : "") + "</span>" + ctl + "</" + tag + ">";
  }

  // opts.linkNovoSistema: o editor oferece trocar para a seção "Sistemas" (a página não)
  function formHtml(secao, reg, ctx, opts) {
    opts = opts || {};
    let h = '<form class="fx-form" id="fx-form" novalidate>' + CAMPOS[secao].map((c) => campoHtml(c, reg, ctx)).join("");
    if (secao === "paineis") {
      const ligadas = new Set((ctx.dados.painel_rotas || []).filter((l) => reg && l.painel_id === reg.id).map((l) => l.rota_id));
      h += '<div class="fx-campo fx-linha-larga"><span>Rotas que alimentam este painel</span><div class="fx-rotas">'
        + (ativos(ctx.dados.rotas).map((r) => '<label><input type="checkbox" data-rota="' + _esc(r.id) + '"' + (ligadas.has(r.id) ? " checked" : "") + "> " + _esc(r.iniciativa + " · " + F.ROTULO_TIPO_DADO[r.tipo_dado]) + "</label>").join("") || "<em>Nenhuma rota cadastrada.</em>") + "</div></div>";
    }
    if (opts.linkNovoSistema && (secao === "rotas" || secao === "paineis")) h += '<p class="fx-linha-larga"><small>Sistema não está na lista? <a href="#" id="fx-novo-sistema">Cadastrar sistema novo</a> (você perde o que não salvou aqui).</small></p>';
    h += '<div class="fx-linha-larga"><button type="submit" class="ed-btn"' + (ctx.fallback ? " disabled" : "") + '>Salvar</button> <button type="button" class="ed-btn sec" id="fx-cancelar">Cancelar</button></div></form>';
    return h;
  }

  // listeners internos do formulário (iniciativa "outra", lista de fontes). Quem usa liga o
  // submit e o cancelar. Chamar depois de cada render do formulário.
  function ligarForm(raiz) {
    raiz.querySelectorAll("select[data-iniciativa]").forEach((s) => s.addEventListener("change", () => {
      document.getElementById(s.id + "-livre").hidden = s.value !== "__outra__";
    }));
    const fontes = raiz.querySelector("#fx-outras_fontes");
    if (fontes) fontes.addEventListener("click", (e) => {
      const lista = fontes.querySelector(".fx-fontes");
      if (e.target.closest("[data-fonte-add]")) {
        lista.insertAdjacentHTML("beforeend", fonteItemHtml(""));
        lista.lastElementChild.querySelector("input").focus();
      } else {
        const rm = e.target.closest("[data-fonte-rm]");
        if (rm) rm.closest(".fx-fonte").remove();
      }
    });
  }

  // ---- leitura e validação ----
  function rotuloLista(l) { return l.join(", "); }

  // validação pura (sem DOM): devolve a lista de mensagens de problema
  function validar(secao, campos, destinos) {
    const faltando = [], msgs = [];
    CAMPOS[secao].forEach((c) => {
      if (c.obrig && (campos[c.k] == null || campos[c.k] === "")) faltando.push(c.rot);
    });
    if (faltando.length) msgs.push("Preencha: " + rotuloLista(faltando) + ".");
    if (secao === "paineis") {
      const r = F.validarLinkPainel(campos.link_painel);
      if (!r.ok) msgs.push(r.erro);
    }
    if (secao === "encaminhamentos" && !campos.rota_id && !campos.painel_id) msgs.push("Escolha uma rota e/ou um painel.");
    return msgs;
  }

  // lê o formulário aberto. { campos, destinos, erros }
  function coletar(secao) {
    const campos = {}; let destinos = [];
    CAMPOS[secao].forEach((c) => {
      if (c.t === "destinos") {
        document.querySelectorAll('input[data-destino="' + c.momento + '"]:checked').forEach((i) => destinos.push({ sistema_id: i.value, momento: c.momento }));
        return;
      }
      if (c.t === "fontes") {
        campos[c.k] = F.normalizarFontes(Array.prototype.map.call(document.querySelectorAll("#fx-" + c.k + " [data-fonte]"), (i) => i.value));
        return;
      }
      const el = document.getElementById("fx-" + c.k);
      let v = el ? el.value : "";
      if (c.t === "iniciativa" && v === "__outra__") v = document.getElementById("fx-" + c.k + "-livre").value;
      v = (v || "").trim();
      campos[c.k] = v === "" ? null : v;
    });
    if (secao === "paineis") {
      const r = F.validarLinkPainel(campos.link_painel);
      if (r.ok) campos.link_painel = r.valor;
    }
    if (secao === "encaminhamentos") campos.concluido_em = campos.status === "feito" ? hoje() : null;
    return { campos: campos, destinos: destinos, erros: validar(secao, campos, destinos) };
  }

  // após re-render por erro, devolve ao formulário o que a pessoa tinha digitado
  function restaurar(secao, col) {
    const campos = col.campos;
    CAMPOS[secao].forEach((c) => {
      if (c.t === "destinos") {
        const marcados = new Set(col.destinos.filter((d) => d.momento === c.momento).map((d) => d.sistema_id));
        document.querySelectorAll('input[data-destino="' + c.momento + '"]').forEach((i) => { i.checked = marcados.has(i.value); });
        return;
      }
      if (c.t === "fontes") {
        const lista = document.querySelector("#fx-" + c.k + " .fx-fontes");
        if (lista) lista.innerHTML = (campos[c.k] || []).map(fonteItemHtml).join("");
        return;
      }
      const el = document.getElementById("fx-" + c.k); if (!el || campos[c.k] == null) return;
      if (c.t === "iniciativa" && Array.prototype.every.call(el.options, (o) => o.value !== campos[c.k])) {
        el.value = "__outra__"; const l = document.getElementById(el.id + "-livre"); l.hidden = false; l.value = campos[c.k];
      } else el.value = campos[c.k];
    });
  }

  // ---- gravação ----
  async function sincronizarRotasDoPainel(painelId, dados) {
    const marcadas = new Set(Array.prototype.map.call(document.querySelectorAll("input[data-rota]:checked"), (i) => i.getAttribute("data-rota")));
    const atuais = new Set((dados.painel_rotas || []).filter((l) => l.painel_id === painelId).map((l) => l.rota_id));
    for (const r of marcadas) if (!atuais.has(r)) await F.vincularPainelRota(painelId, r);
    for (const r of atuais) if (!marcadas.has(r)) await F.desvincularPainelRota(painelId, r);
  }

  // id = null cria; id = uuid atualiza. Devolve o registro gravado.
  // Rota: grava a rota (INSERT devolve a linha, com o id) e SÓ ENTÃO os destinos. Se os destinos
  // falharem, a rota já existe: o erro sai com `rotaId` para quem chama manter o formulário
  // aberto apontando para essa rota e a pessoa repetir (a repetição vira UPDATE + diff, sem
  // duplicar a rota).
  async function gravar(secao, id, col, ctx) {
    if (secao === "rotas") {
      const reg = id ? await F.salvar("rotas", id, col.campos) : await F.criar("rotas", col.campos);
      try { await F.sincronizarDestinos(reg.id, col.destinos); }
      catch (err) { err.rotaId = reg.id; throw err; }
      return reg;
    }
    const reg = id ? await F.salvar(secao, id, col.campos) : await F.criar(secao, col.campos);
    if (secao === "paineis") await sincronizarRotasDoPainel(reg.id, ctx.dados);
    return reg;
  }

  // ---- link do painel na leitura ----
  // Preenche cada <span data-link-painel="ID"> com um <a> "Abrir painel", montado por DOM (o
  // href só é setado depois de validar o esquema; nada de innerHTML com o endereço).
  function anexarLinksPainel(raiz, paineis) {
    const porId = {}; (paineis || []).forEach((p) => { porId[p.id] = p; });
    raiz.querySelectorAll("[data-link-painel]").forEach((el) => {
      const p = porId[el.getAttribute("data-link-painel")];
      const url = p && F.linkSeguro(p.link_painel);
      el.textContent = "";
      if (!url) return;
      const a = document.createElement("a");
      a.setAttribute("href", url); a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener noreferrer");
      a.textContent = "Abrir painel";
      el.appendChild(a);
    });
  }

  // ---- estilos ----
  const ESTILOS =
    ".fx-form{background:var(--branco);border:1px solid var(--linha);padding:14px;margin-top:10px;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px 14px}" +
    ".fx-campo{display:flex;flex-direction:column;gap:3px;font:600 11px 'DM Sans',sans-serif;color:var(--grafite)}" +
    ".fx-campo input,.fx-campo select,.fx-campo textarea{font:400 13px 'DM Sans',sans-serif;color:var(--tinta);padding:6px 8px;border:1px solid var(--linha);border-radius:0;background:var(--branco);width:100%;box-sizing:border-box}" +
    ".fx-destaque{background:var(--prog-w);padding:8px;grid-column:1/-1}.fx-destaque span{font-size:12px;color:var(--prog)}" +
    ".fx-linha-larga{grid-column:1/-1}.fx-rotas{display:flex;flex-wrap:wrap;gap:6px 16px;font:400 13px 'DM Sans',sans-serif}" +
    ".fx-fontes{display:flex;flex-direction:column;gap:6px;margin-bottom:6px}.fx-fonte{display:flex;gap:6px;align-items:center}.fx-fonte input{flex:1}" +
    ".fx-msg{margin:0 0 10px;padding:8px 12px;font:400 13px 'DM Sans',sans-serif}.fx-msg.ok{background:var(--ok-w);color:var(--ok)}.fx-msg.erro{background:var(--warn-w);color:var(--warn)}";
  // Alinhamento das caixas de marcar (v0.32.0): `.fx-campo input{width:100%}` valia também para
  // checkbox, que ocupava a linha toda e empurrava o texto do rótulo para baixo. Regra separada
  // de propósito, para aparecer isolada no diff.
  const ESTILOS_CHECKBOX =
    ".fx-rotas label{display:inline-flex;align-items:center;gap:6px;font-weight:400}" +
    ".fx-rotas input[type=checkbox]{width:auto;flex:none;margin:0;padding:0}";

  function injetarEstilos() {
    if (document.getElementById("fx-form-estilos")) return;
    const st = document.createElement("style"); st.id = "fx-form-estilos";
    st.textContent = ESTILOS + ESTILOS_CHECKBOX;
    document.head.appendChild(st);
  }

  window.FLUXO_FORM = {
    CAMPOS: CAMPOS, formHtml: formHtml, ligarForm: ligarForm, coletar: coletar, validar: validar,
    restaurar: restaurar, gravar: gravar, anexarLinksPainel: anexarLinksPainel, injetarEstilos: injetarEstilos,
    listaIniciativas: listaIniciativas,
  };
})();
