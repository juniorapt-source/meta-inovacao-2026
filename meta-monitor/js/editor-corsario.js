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
  let formNovaIniciativaAberto = false;

  async function render() {
    const area = document.getElementById("ed-area");
    const sel = document.getElementById("ed-conjunto");

    if (!corsarioAtual && !corsarioCarregando) {
      corsarioCarregando = true;
      area.innerHTML = '<div class="ed-carregando">Carregando o Caminho do Corsário…</div>';
      try {
        const r = await DB_CORSARIO.carregar();
        corsarioAtual = r; corsarioFallback = r.usandoFallback;
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

    // agrupa por iniciativa — mesma lógica de corsario.html/processar(): núcleo é o
    // primeiro valor não vazio encontrado entre as linhas da iniciativa.
    const porIniciativa = new Map();
    statusRows.forEach((r) => {
      if (!porIniciativa.has(r.iniciativa)) porIniciativa.set(r.iniciativa, { nome: r.iniciativa, nucleo: r.nucleo, porCriterio: new Map() });
      const ent = porIniciativa.get(r.iniciativa);
      if (!ent.nucleo && r.nucleo) ent.nucleo = r.nucleo;
      ent.porCriterio.set(r.criterio, r);
    });
    const iniciativas = Array.from(porIniciativa.values()).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    let h = corsarioFallback ? avisoFallback("(sem cópia local disponível)") : "";
    h += '<div class="ed-topo" style="margin-bottom:12px"><button type="button" id="ed-abrir-nova-ini" class="ed-btn"' + dis + '>+ Nova iniciativa</button>' +
      '<span style="font-size:12px;color:var(--grafite)">Clique no botão pequeno ao lado de cada status pra ver/editar a observação.</span></div>';
    h += '<div id="ed-form-nova-ini" class="ed-nova" style="display:' + (formNovaIniciativaAberto ? "block" : "none") + '">' +
      '<h3>Nova iniciativa</h3>' +
      '<div class="ed-nova-grid">' +
        '<div class="ed-campo-erro" data-campo="nome"><label>Nome *</label><input type="text" id="nvi-nome" placeholder="ex.: Nova iniciativa X">' +
          '<span class="ed-erro-msg">Obrigatório.</span></div>' +
        '<div class="ed-campo-erro" data-campo="nucleo"><label>Núcleo *</label><select id="nvi-nucleo">' + opts(NUCLEOS_VALIDOS, NUCLEOS_VALIDOS[0]) + '</select></div>' +
      '</div>' +
      '<p style="font-size:12px;color:var(--grafite);margin-top:8px">Cria ' + criterios.length + ' linhas (uma por critério), todas como "Não se aplica" — edite cada uma na tabela depois.</p>' +
      '<div class="ed-nova-acoes"><button type="button" id="ed-confirmar-nova-ini" class="ed-btn">Criar</button>' +
        '<button type="button" id="ed-cancelar-nova-ini" class="ed-btn sec">Cancelar</button></div>' +
    '</div>';

    h += '<div class="ed-wrap"><table class="ed-tab ed-matriz"><thead><tr><th class="col-ini">Iniciativa</th><th style="width:150px">Núcleo</th>';
    criterios.forEach(c => h += '<th title="' + esc(c.rotulo || c.chave) + '">' + esc(rotuloColunaCorsario(c)) + '</th>');
    h += '</tr></thead><tbody>';
    iniciativas.forEach((ini) => {
      h += '<tr><td class="col-ini">' + esc(ini.nome) + '</td><td style="font-size:11.5px">' + esc(ini.nucleo || "—") + '</td>';
      criterios.forEach((c) => {
        const r = ini.porCriterio.get(c.chave);
        const idAttr = r ? ' data-id="' + esc(String(r.db_id)) + '"' : "";
        const obs = (r && r.observacao) || "";
        h += '<td><div class="cel-status-wrap">' +
          '<select data-ini="' + esc(ini.nome) + '" data-nucleo="' + esc(ini.nucleo || "") + '" data-crit="' + esc(c.chave) + '"' + idAttr + dis + '>' +
            opts(STATUS_CORSARIO, r ? r.status : "não se aplica", ROTULO_STATUS_CORSARIO) +
          '</select>' +
          '<button type="button" class="ed-obs-btn" data-obs="' + esc(obs) + '" title="' + (obs ? esc(obs) : "Sem observação — clique pra adicionar") + '"' + dis + '>' + (obs ? "🗨" : "·") + '</button>' +
        '</div></td>';
      });
      h += '</tr>';
    });
    area.innerHTML = h + '</tbody></table></div>';

    area.querySelectorAll("tbody select[data-crit]").forEach(el => el.addEventListener("change", async e => {
      const t = e.target, td = t.closest("td");
      const usuario = EDITOR_ATUAL.nomeAtual();
      marcarCelulaStatus(td, "salvando");
      try {
        if (t.dataset.id) {
          await DB_CORSARIO.salvar(t.dataset.id, { status: t.value }, usuario);
        } else {
          // item 5.7 — iniciativa já existente no Corsário (só faltava linha pra este
          // critério): resolve as duas FKs pela régua de nome de sempre.
          const [projetoId, porNucleo] = await Promise.all([projetoIdPorIniciativa(t.dataset.ini), nucleosPorNome()]);
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
          const [projetoId, porNucleo] = await Promise.all([projetoIdPorIniciativa(select.dataset.ini), nucleosPorNome()]);
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

    const btnAbrirNovaIni = document.getElementById("ed-abrir-nova-ini");
    if (btnAbrirNovaIni) btnAbrirNovaIni.addEventListener("click", () => { formNovaIniciativaAberto = true; render(); });
    if (formNovaIniciativaAberto) {
      document.getElementById("ed-cancelar-nova-ini").addEventListener("click", () => { formNovaIniciativaAberto = false; render(); });
      document.getElementById("ed-confirmar-nova-ini").addEventListener("click", criarIniciativa);
    }
  }

  async function criarIniciativa() {
    const campo = id => document.getElementById(id);
    const nome = campo("nvi-nome").value.trim();
    document.querySelectorAll("#ed-form-nova-ini .ed-campo-erro").forEach(el => el.classList.remove("ed-campo-erro"));
    if (!nome) {
      document.querySelector('#ed-form-nova-ini [data-campo="nome"]').classList.add("ed-campo-erro");
      return;
    }
    const jaExiste = (corsarioAtual.statusRows || []).some(r => r.iniciativa.toLowerCase() === nome.toLowerCase());
    if (jaExiste) {
      window.alert('Já existe uma iniciativa chamada "' + nome + '" — edite as células dela na tabela em vez de criar de novo.');
      return;
    }
    const nucleo = campo("nvi-nucleo").value;
    const btn = document.getElementById("ed-confirmar-nova-ini");
    btn.disabled = true;
    try {
      // item 5.7 — esta iniciativa nasce direto aqui no Corsário, sem passar por "+ Novo
      // projeto"; pode ou não já existir em meta_inovacao_projetos com o mesmo nome
      // (coincidência de texto) — projetoIdPorIniciativa() resolve se existir, e devolve
      // null honestamente se não existir (a linha nasce sem projeto_id, não com um errado).
      const [projetoId, porNucleo] = await Promise.all([projetoIdPorIniciativa(nome), nucleosPorNome()]);
      const criadas = await DB_CORSARIO.criarIniciativa(nome, nucleo, corsarioAtual.criterios, EDITOR_ATUAL.nomeAtual(), { projetoId: projetoId, nucleoId: porNucleo[nucleo] || null });
      corsarioAtual.statusRows.push(...criadas);
      formNovaIniciativaAberto = false;
      render();
    } catch (err) {
      console.error("editor: falha ao criar iniciativa do corsário", err);
      btn.disabled = false;
      window.alert((window.CC_SUPABASE && CC_SUPABASE.mensagemEscritaAmigavel(err)) || "Não foi possível criar a iniciativa.");
    }
  }

  window.EDITOR_CORSARIO = { render: render };
})();
