/* editor.html — aba "Agenda" (encontros dos ciclos com a URC, editada ao vivo desde o
 * P10 — ver README, "Como os dados funcionam").
 *
 * 7ª etapa da extração do inline de editor.html pro próprio arquivo (ver BACKLOG.md,
 * "editor.html grande demais"; Histórico, Matriz, Corsário, URC, Projetos e Pessoas
 * foram as etapas 1-6). A mais isolada das que restam — zero estado compartilhado com
 * qualquer outra aba (confirmado antes de mover: agendaAtual/agendaFallback/
 * agendaCarregando/STATUS_ENC/ROTULO_ENC só eram usados aqui).
 *
 * Depende dos globais já expostos em editor.html (window.opts, window.marcarLinhaStatus,
 * window.detErro) e dos globais de sempre (esc, CC_STATUS, EDITOR_ATUAL, DB_AGENDA).
 *
 * API exposta: window.EDITOR_AGENDA.render() — chamado pelo dispatcher de abas
 * (render(), em editor.html) quando o <select id="ed-conjunto"> está em "agenda".
 */
(function () {
  "use strict";

  // correção — os valores abaixo eram vocabulário de antes da taxonomia única (P6/item
  // 2.4): STATUS_ENC tinha os rótulos crus de antes da migração de meta_inovacao_agenda_
  // encontros pras chaves canônicas "encontro_*" (P10) — o <select> da Agenda mostrava a
  // própria chave interna cortada ("encontro_agen…") porque nem o valor bate mais com o
  // que está gravado, nem havia rótulo (dropdown sem 3º argumento em opts()).
  const STATUS_ENC = Object.keys(CC_STATUS.ESTADOS).filter((k) => CC_STATUS.ESTADOS[k].contexto === "encontro");
  const ROTULO_ENC = Object.fromEntries(STATUS_ENC.map((k) => [k, CC_STATUS.rotulo(k)]));

  let agendaAtual = null, agendaFallback = false, agendaCarregando = false;

  async function render() {
    const area = document.getElementById("ed-area");
    const sel = document.getElementById("ed-conjunto");

    if (!agendaAtual && !agendaCarregando) {
      agendaCarregando = true;
      area.innerHTML = '<div class="ed-carregando">Carregando agenda…</div>';
      try {
        const { lista, usandoFallback } = await DB_AGENDA.carregar();
        agendaAtual = lista; agendaFallback = usandoFallback;
      } catch (err) {
        console.error("editor: falha ao carregar agenda", err);
        agendaCarregando = false;
        area.innerHTML = '<div class="ed-erro-carregar">Não foi possível carregar a agenda  agora.</div>';
        return;
      }
      agendaCarregando = false;
    }
    if (sel.value !== "agenda") return;
    const lista = agendaAtual || [];
    let h = agendaFallback ? '<div class="aviso" style="margin-bottom:12px"><b>Dados locais</b> — não foi possível atualizar os dados agora; estas são as informações da última versão salva. As alterações não serão salvas enquanto isso; recarregue a página mais tarde.</div>' : "";
    h += '<div class="ed-wrap"><table class="ed-tab"><thead><tr><th>Encontro</th><th style="width:120px">Data</th><th style="width:110px">Turno</th><th style="width:170px">Local · modo</th><th style="width:150px">Status</th><th style="width:90px">Confirmações</th><th>Nota</th><th style="width:70px"></th></tr></thead><tbody>';
    lista.forEach(en => {
      const dis = agendaFallback ? " disabled" : "";
      h += '<tr data-id="' + esc(String(en.db_id)) + '"><td class="ed-mono">' + esc(en.id) + '</td>' +
        '<td><input type="text" data-f="data" value="' + esc(en.data || "") + '" placeholder="AAAA-MM-DD"' + dis + '></td>' +
        '<td><input type="text" data-f="turno" value="' + esc(en.turno || "") + '" placeholder="manhã, tarde · 14h..."' + dis + '></td>' +
        '<td><input type="text" data-f="localModo" value="' + esc(en.localModo || "") + '" placeholder="ex.: Sede Sebrae · presencial"' + dis + '></td>' +
        '<td><select data-f="status"' + dis + '>' + opts(STATUS_ENC, en.status, ROTULO_ENC) + '</select></td>' +
        '<td><input type="text" data-f="confirmacoes" value="' + esc(en.confirmacoes || "") + '" placeholder="3/5"' + dis + '></td>' +
        '<td><input type="text" data-f="nota" value="' + esc(en.nota || "") + '"' + dis + '></td>' +
        '<td><span class="ed-row-status" aria-live="polite"></span></td></tr>';
    });
    area.innerHTML = h + '</tbody></table></div>';

    const CAMPO_COLUNA = { data: "data_iso", turno: "turno", localModo: "local_modo", status: "status", confirmacoes: "confirmacoes", nota: "observacao" };
    area.querySelectorAll("tbody select[data-f],tbody input[data-f]").forEach(el => el.addEventListener("change", async e => {
      const t = e.target, tr = t.closest("tr"), dbId = tr.dataset.id, campo = t.dataset.f;
      const coluna = CAMPO_COLUNA[campo];
      const valorColuna = t.value.trim() === "" && (campo === "data" || campo === "turno" || campo === "localModo" || campo === "confirmacoes") ? null : t.value;
      const en = lista.find(x => String(x.db_id) === dbId);
      if (en) en[campo] = valorColuna;
      marcarLinhaStatus(tr, "salvando");
      try {
        await DB_AGENDA.salvar(en ? en.db_id : dbId, { [coluna]: valorColuna }, EDITOR_ATUAL.nomeAtual());
        marcarLinhaStatus(tr, "salvo");
      } catch (err) {
        console.error("editor: falha ao salvar encontro da agenda", err);
        marcarLinhaStatus(tr, (window.CC_SUPABASE && CC_SUPABASE.mensagemEscritaAmigavel(err)) || "falhou", detErro(err));
      }
    }));
  }

  window.EDITOR_AGENDA = { render: render };
})();
