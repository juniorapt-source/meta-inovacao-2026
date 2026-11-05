/* editor.html — aba "O Caminho para o Corsário" (item 5.7 do golden record — nucleo_id/
 * projeto_id em iniciativa nova/linha de status nova).
 *
 * 3ª aba extraída do inline de editor.html pro próprio arquivo (ver BACKLOG.md,
 * "editor.html grande demais"; Histórico e Matriz foram as etapas 1 e 2). Diferente
 * daquelas duas, esta aba EDITA ao vivo (status/observação por célula, + nova
 * iniciativa) — por isso usa alguns helpers genuinamente compartilhados com outras
 * abas: `opts()`, `avisoFallback()`, `marcarCelulaStatus()`, `detErro()`,
 * `projetoIdPorIniciativa()`, `nucleosPorNome()`, `NUCLEOS_VALIDOS`, todos em
 * js/editor-shared.js desde 29/08/2026 (D6.1), além dos globais de sempre (esc,
 * EDITOR_ATUAL, DB_CORSARIO).
 *
 * API exposta: window.EDITOR_CORSARIO.render() — chamado pelo dispatcher de abas
 * (render(), em editor.html) quando o <select id="ed-conjunto"> está em "corsario".
 */
(function () {
  "use strict";

  /* vocabulário do conjunto "corsario" — mesma régua de corsario.html (não mexer sem
     revalidar contra o card da ALI Ecossistema, mesmo aviso que corsario.html tem sobre
     isso). "não se aplica" é o default de uma célula sem linha ainda no banco (ver
     render() abaixo) — bate com o que corsario.html já assume pra item ausente. */
  const STATUS_CORSARIO = ["não se aplica", "ok", "ajuste em andamento", "a iniciar", "em entendimento"];
  const ROTULO_STATUS_CORSARIO = { "não se aplica": "Não se aplica", "ok": "Ok", "ajuste em andamento": "Ajuste em andamento", "a iniciar": "A iniciar", "em entendimento": "Em entendimento" };
  /* cabeçalhos curtos — mesmo dicionário de corsario.html (ROTULOS_MATRIZ); mantidos em
     sincronia manualmente (arquitetura sem build step — ver R5 do refactor v0.21, nenhum
     módulo JS compartilhado entre as duas páginas pra isso hoje). Se um dia crescer, vira
     candidato a um js/corsario_rotulos.js compartilhado. */
  const ROTULOS_MATRIZ_CORSARIO = {
    base_foco: "Clientes no Foco", instrumentos: "Instrumentos", solucao: "Solução",
    atend_foco: "Atendimentos no Foco", painel_dw: "Acompanhamento no DW/Foco", campanha_foco: "Campanha no Foco",
    portal: "Site no Portal", lp_mc: "LP no Mkt Cloud", captura_mc: "Captura de lead Mkt Cloud",
    transbordo_mc: "Transbordo Mkt/Foco", transbordo_ufs: "Transbordo para as UFs", email_mc: "E-mail Mkt Cloud",
    whats_mc: "WhatsApp Mkt Cloud", jornadas_mc: "Jornadas", loja: "Loja", cnr_receptiva: "CNR Receptiva",
    cnr_ativa: "CNR Ativa", assessoria: "Assessoria", rede: "Rede de atendimento",
  };
  function rotuloColunaCorsario(c) {
    if (ROTULOS_MATRIZ_CORSARIO[c.chave]) return ROTULOS_MATRIZ_CORSARIO[c.chave];
    const r = c.rotulo || c.chave || "";
    return r.length > 40 ? r.slice(0, 39) + "…" : r;
  }

  // estado ao vivo — carregado sob demanda na primeira vez que a aba é aberta, mesmo
  // padrão das outras abas vivas de editor.html.
  let corsarioAtual = null, corsarioFallback = false, corsarioCarregando = false;
  let corsarioProjetos = null; // lista do cadastro (v0.35.0) ou null = modo antigo
  // preferências de visualização — só conveniência por navegador (localStorage pode falhar/estar bloqueado)
  let invertida = false, filtroNucleo = "";
  try { invertida = localStorage.getItem("ed-corsario-invertida") === "1"; filtroNucleo = localStorage.getItem("ed-corsario-nucleo") || ""; } catch (e) { /* segue com o padrão */ }
  function guardarPref(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignora */ } }

  /* estilos próprios desta aba, injetados uma vez (mantém editor.html enxuto). A grade rola
     dentro do próprio quadro, então o cabeçalho (sticky top) e a primeira coluna (sticky
     left) ficam sempre visíveis; cores de status = mesma paleta de corsario.html (.crs-st-*). */
  (function injetarEstilos() {
    if (document.getElementById("ed-corsario-estilos")) return;
    const st = document.createElement("style");
    st.id = "ed-corsario-estilos";
    st.textContent =
      ".ed-wrap-alto{max-height:calc(100vh - 210px)}" +
      ".ed-matriz thead th{position:sticky;top:0;z-index:2;box-shadow:inset 0 -1px 0 var(--linha)}" +
      ".ed-matriz thead th.col-ini{left:0;z-index:3;background:var(--ceu)}" +
      ".ed-matriz .col-ini{z-index:1}" +
      ".ed-invertida .th-ini{min-width:130px;text-transform:none;letter-spacing:0;font-size:11.5px}" +
      ".ed-invertida .th-nuc{display:block;font-weight:400;font-size:10px;color:var(--ink-3);margin-top:2px}" +
      '.ed-matriz select[data-st="ok"]{background:var(--ok-w);color:var(--ok)}' +
      '.ed-matriz select[data-st="ajuste em andamento"]{background:var(--prog-w);color:var(--prog)}' +
      '.ed-matriz select[data-st="a iniciar"]{background:var(--warn-w);color:var(--warn)}' +
      '.ed-matriz select[data-st="em entendimento"]{background:var(--neutro-w);color:var(--ink-2)}' +
      '.ed-matriz select[data-st="não se aplica"]{color:var(--ink-3);font-style:italic}';
    document.head.appendChild(st);
  })();

  async function render() {
    const area = document.getElementById("ed-area");
    const sel = document.getElementById("ed-conjunto");

    if (!corsarioAtual && !corsarioCarregando) {
      corsarioCarregando = true;
      area.innerHTML = '<div class="ed-carregando">Carregando o Caminho do Corsário…</div>';
      try {
        const [r, rp] = await Promise.all([DB_CORSARIO.carregar(), DB_PROJETOS.carregar()]);
        corsarioAtual = r; corsarioFallback = r.usandoFallback;
        // cadastro de projetos como fonte da lista (v0.35.0) — só quando ele veio do banco
        // já com as colunas de visibilidade; antes disso, a lista sai de corsario_status
        corsarioProjetos = (!rp.usandoFallback && DB_PROJETOS.temVisibilidade(rp.lista)) ? rp.lista : null;
      } catch (err) {
        console.error("editor: falha ao carregar corsário", err);
        corsarioCarregando = false;
        area.innerHTML = '<div class="ed-erro-carregar">Não foi possível carregar o Caminho do Corsário  agora.</div>';
        return;
      }
      corsarioCarregando = false;
    }
    if (sel.value !== "corsario") return;
    const criterios = corsarioAtual.criterios || [];
    const statusRows = corsarioAtual.statusRows || [];
    const dis = corsarioFallback ? " disabled" : "";
    if (corsarioFallback && !criterios.length) {
      area.innerHTML = '<div class="aviso">Não foi possível carregar os dados agora e este conjunto não tem uma versão salva localmente. Recarregue a página mais tarde.</div>';
      return;
    }

    // agrupa por iniciativa — mesma lógica de corsario.html/processar(). Com o cadastro de
    // projetos disponível: um item por projeto marcado "Corsário", nome e núcleo do cadastro.
    // Sem ele (modo antigo): núcleo é o primeiro valor não vazio entre as linhas.
    const porIniciativa = new Map();
    if (corsarioProjetos) {
      DB_PROJETOS.agruparPorProjeto(statusRows, corsarioProjetos, "exibir_corsario").forEach((g) => {
        const ent = { nome: g.projeto.iniciativa, nucleo: g.projeto.nucleo, projetoId: g.projeto.db_id, porCriterio: new Map() };
        g.linhas.forEach((r) => ent.porCriterio.set(r.criterio, r));
        porIniciativa.set("p" + g.projeto.db_id, ent);
      });
    } else {
      statusRows.forEach((r) => {
        if (!porIniciativa.has(r.iniciativa)) porIniciativa.set(r.iniciativa, { nome: r.iniciativa, nucleo: r.nucleo, projetoId: null, porCriterio: new Map() });
        const ent = porIniciativa.get(r.iniciativa);
        if (!ent.nucleo && r.nucleo) ent.nucleo = r.nucleo;
        ent.porCriterio.set(r.criterio, r);
      });
    }
    const todasIniciativas = Array.from(porIniciativa.values()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    const nucleosPresentes = Array.from(new Set(todasIniciativas.map(i => i.nucleo).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR"));
    if (filtroNucleo && !nucleosPresentes.includes(filtroNucleo)) filtroNucleo = "";
    const iniciativas = filtroNucleo ? todasIniciativas.filter(i => i.nucleo === filtroNucleo) : todasIniciativas;

    let h = corsarioFallback ? avisoFallback("(sem cópia local disponível)") : "";
    h += '<div class="ed-topo" style="margin-bottom:12px">' +
      '<label for="ed-filtro-nucleo" style="font:600 13px \'DM Sans\',sans-serif">Núcleo:</label>' +
      '<select id="ed-filtro-nucleo"><option value="">Todos (' + todasIniciativas.length + ')</option>' +
        nucleosPresentes.map(n => '<option value="' + esc(n) + '"' + (n === filtroNucleo ? " selected" : "") + '>' + esc(n) + ' (' + todasIniciativas.filter(i => i.nucleo === n).length + ')</option>').join("") + '</select>' +
      '<button type="button" id="ed-inverter" class="ed-btn sec" title="Troca linhas por colunas">⇄ Inverter eixos</button>' +
      '<span style="font-size:12px;color:var(--grafite)">Clique no botão pequeno ao lado de cada status pra ver/editar a observação.</span></div>';
    // v0.35.0: o Corsário não cria mais iniciativa própria — a lista vem do cadastro de projetos
    h += '<p class="ed-nota-fonte" style="font-size:12px;color:var(--grafite);margin:0 0 10px">Para incluir ou tirar um projeto daqui, marque ou desmarque <b>Corsário</b> na aba <b>Projetos &amp; Representantes</b>.</p>';

    const celula = (ini, c) => {
      const r = ini.porCriterio.get(c.chave);
      const idAttr = (r ? ' data-id="' + esc(String(r.db_id)) + '"' : "") + (ini.projetoId != null ? ' data-projeto="' + esc(String(ini.projetoId)) + '"' : "");
      const obs = (r && r.observacao) || "";
      const st = r ? r.status : "não se aplica";
      return '<td><div class="cel-status-wrap">' +
        '<select data-st="' + esc(st) + '" data-ini="' + esc(ini.nome) + '" data-nucleo="' + esc(ini.nucleo || "") + '" data-crit="' + esc(c.chave) + '"' + idAttr + dis + '>' +
          opts(STATUS_CORSARIO, st, ROTULO_STATUS_CORSARIO) +
        '</select>' +
        '<button type="button" class="ed-obs-btn" data-obs="' + esc(obs) + '" title="' + (obs ? esc(obs) : "Sem observação — clique pra adicionar") + '"' + dis + '>' + (obs ? "🗨" : "·") + '</button>' +
      '</div></td>';
    };
    if (!iniciativas.length) {
      h += '<div class="aviso">Nenhuma iniciativa neste núcleo.</div>';
    } else if (!invertida) {
      h += '<div class="ed-wrap ed-wrap-alto"><table class="ed-tab ed-matriz"><thead><tr><th class="col-ini">Iniciativa</th><th style="width:150px">Núcleo</th>';
      criterios.forEach(c => h += '<th title="' + esc(c.rotulo || c.chave) + '">' + esc(rotuloColunaCorsario(c)) + '</th>');
      h += '</tr></thead><tbody>';
      iniciativas.forEach((ini) => {
        h += '<tr><td class="col-ini">' + esc(ini.nome) + '</td><td style="font-size:11.5px">' + esc(ini.nucleo || "—") + '</td>';
        criterios.forEach(c => h += celula(ini, c));
        h += '</tr>';
      });
    } else {
      // eixos invertidos: critérios nas linhas, iniciativas nas colunas
      h += '<div class="ed-wrap ed-wrap-alto"><table class="ed-tab ed-matriz ed-invertida"><thead><tr><th class="col-ini">Critério</th>';
      iniciativas.forEach(ini => h += '<th class="th-ini" title="' + esc(ini.nome + " — " + (ini.nucleo || "sem núcleo")) + '">' + esc(ini.nome) + '<span class="th-nuc">' + esc(ini.nucleo || "—") + '</span></th>');
      h += '</tr></thead><tbody>';
      criterios.forEach((c) => {
        h += '<tr><td class="col-ini" title="' + esc(c.rotulo || c.chave) + '">' + esc(rotuloColunaCorsario(c)) + '</td>';
        iniciativas.forEach(ini => h += celula(ini, c));
        h += '</tr>';
      });
    }
    area.innerHTML = h + (iniciativas.length ? '</tbody></table></div>' : '');

    area.querySelectorAll("tbody select[data-crit]").forEach(el => el.addEventListener("change", async e => {
      const t = e.target, td = t.closest("td");
      const usuario = EDITOR_ATUAL.nomeAtual();
      marcarCelulaStatus(td, "salvando");
      t.dataset.st = t.value;
      try {
        if (t.dataset.id) {
          await DB_CORSARIO.salvar(t.dataset.id, { status: t.value }, usuario);
        } else {
          // item 5.7 — iniciativa já existente no Corsário (só faltava linha pra este
          // critério): resolve as duas FKs pela régua de nome de sempre.
          const [projetoId, porNucleo] = await Promise.all([t.dataset.projeto ? Number(t.dataset.projeto) : projetoIdPorIniciativa(t.dataset.ini), nucleosPorNome()]);
          const criado = await DB_CORSARIO.criar({ iniciativa: t.dataset.ini, nucleo: t.dataset.nucleo, projeto_id: projetoId, nucleo_id: porNucleo[t.dataset.nucleo] || null, criterio: t.dataset.crit, status: t.value }, usuario);
          t.dataset.id = String(criado.db_id);
          statusRows.push(criado); // mantém a cópia local em sincronia — evita duplicar a linha se o conjunto for re-renderizado sem recarregar
        }
        marcarCelulaStatus(td, "salvo");
      } catch (err) {
        console.error("editor: falha ao salvar status do corsário", err);
        marcarCelulaStatus(td, (window.CC_SUPABASE && CC_SUPABASE.mensagemEscritaAmigavel(err)) || "falhou", detErro(err));
      }
    }));

    area.querySelectorAll(".ed-obs-btn").forEach(btn => btn.addEventListener("click", async e => {
      if (corsarioFallback) return;
      const td = e.target.closest("td");
      const select = td.querySelector("select");
      const atual = btn.dataset.obs || "";
      const nova = window.prompt("Observação para \"" + select.dataset.crit + "\" (" + select.dataset.ini + "):", atual);
      if (nova === null) return; // cancelou
      const usuario = EDITOR_ATUAL.nomeAtual();
      marcarCelulaStatus(td, "salvando");
      try {
        if (select.dataset.id) {
          await DB_CORSARIO.salvar(select.dataset.id, { observacao: nova || null }, usuario);
        } else {
          // item 5.7 — mesma régua da outra porta de escrita, acima.
          const [projetoId, porNucleo] = await Promise.all([select.dataset.projeto ? Number(select.dataset.projeto) : projetoIdPorIniciativa(select.dataset.ini), nucleosPorNome()]);
          const criado = await DB_CORSARIO.criar({ iniciativa: select.dataset.ini, nucleo: select.dataset.nucleo, projeto_id: projetoId, nucleo_id: porNucleo[select.dataset.nucleo] || null, criterio: select.dataset.crit, status: select.value, observacao: nova || null }, usuario);
          select.dataset.id = String(criado.db_id);
          statusRows.push(criado);
        }
        btn.dataset.obs = nova || "";
        btn.title = nova || "Sem observação — clique pra adicionar";
        btn.textContent = nova ? "🗨" : "·";
        marcarCelulaStatus(td, "salvo");
      } catch (err) {
        console.error("editor: falha ao salvar observação do corsário", err);
        marcarCelulaStatus(td, (window.CC_SUPABASE && CC_SUPABASE.mensagemEscritaAmigavel(err)) || "falhou", detErro(err));
      }
    }));

    document.getElementById("ed-filtro-nucleo").addEventListener("change", e => { filtroNucleo = e.target.value; guardarPref("ed-corsario-nucleo", filtroNucleo); render(); });
    document.getElementById("ed-inverter").addEventListener("click", () => { invertida = !invertida; guardarPref("ed-corsario-invertida", invertida ? "1" : "0"); render(); });
  }

  window.EDITOR_CORSARIO = { render: render };
})();
