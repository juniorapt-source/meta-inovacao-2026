/* editor.html — aba "Histórico" (item 3.4 do plano de melhorias: log de auditoria).
 *
 * Primeira aba extraída do inline de editor.html pro próprio arquivo (ver BACKLOG.md,
 * "editor.html grande demais" — sugestão do José, 28/08/2026): reduz o "raio de
 * explosão" de mexer nesta aba, sem mudar nenhum comportamento. Escolhida como piloto
 * por ser a mais isolada das 8 abas — zero variável compartilhada com Plano/Agenda/
 * Matriz/Pessoas/Projetos/URC/Corsário, só depende de globais que já existem antes
 * deste script carregar (window.esc, window.CC_STATUS, window.CC_SUPABASE — ver
 * <script src="..."> em editor.html, esta tag entra depois das três).
 *
 * Só leitura (audit log): mostra as últimas 100 linhas de meta_inovacao_audit_log,
 * geradas pelo trigger cc_audit() (tools/sql/2026-08_auditoria.sql). Nunca escreve.
 *
 * API exposta: window.EDITOR_HISTORICO.montar() — chamado uma vez, na carga da página
 * (mesmo padrão de window.EDITOR_ATUAL/window.DB_* do resto do projeto). Depois de
 * montar(), a aba se vira sozinha (liga os próprios listeners); o "spine" que troca
 * entre a aba Dados/Histórico (alternarAba(), em editor.html) só chama
 * EDITOR_HISTORICO.ativar() quando o usuário clica em "Histórico" — o módulo decide
 * internamente se precisa recarregar (historicoCarregadoUmaVez).
 */
(function () {
  "use strict";

  // item 3.3 — meta_inovacao_matriz_demandas congelou na virada do 3.2 (não recebe mais
  // escrita: js/matriz-store.js só LÊ dela, pra conferência com a tabela antiga). O
  // trigger de auditoria (cc_audit_matriz_celulas, criado junto com a tabela no item 3.1 —
  // tools/sql/2026-08_matriz_celulas.sql) já grava as edições novas na tabela sucessora,
  // meta_inovacao_matriz_celulas: as duas ficam no mapa, a antiga só pra não fazer o
  // histórico já gravado sumir da tela.
  const TABELAS_HISTORICO = {
    meta_inovacao_plano_acoes: "Plano de ação",
    meta_inovacao_agenda_encontros: "Agenda",
    plano_acao_atividades: "Atividades por iniciativa",
    meta_inovacao_matriz_celulas: "Matriz de demandas",
    meta_inovacao_matriz_demandas: "Matriz de demandas (histórico anterior ao 3.2)",
    corsario_status: "O Caminho para o Corsário",
  };
  // contexto de js/status.js (CC_STATUS) pro campo "status" de cada tabela — a matriz não
  // tem uma coluna "status" única (tinha uma por canal na tabela antiga; a nova tem uma
  // só, "estado"), então as duas são tratadas à parte em valorParaExibicao() abaixo,
  // traduzindo TODO campo que não seja id/iniciativa (antiga) ou o campo "estado" (nova).
  const CONTEXTO_STATUS_POR_TABELA = {
    meta_inovacao_plano_acoes: "acao",
    meta_inovacao_agenda_encontros: "encontro",
    plano_acao_atividades: "atividade",
  };
  const CAMPOS_IGNORADOS_DIFF = ["updated_at", "created_at", "updated_by", "atualizado_por", "atualizado_em"];

  // item 3.2 do prompt — nunca mostra a chave crua (snake_case) de um campo de status;
  // sempre traduz via CC_STATUS.chaveDeEntrada + CC_STATUS.rotulo antes de exibir.
  function valorParaExibicaoHistorico(tabela, campo, valor) {
    if (valor === null || valor === undefined || valor === "") return "—";
    if (Array.isArray(valor)) return valor.length ? valor.join(", ") : "—";
    if (typeof valor === "boolean") return valor ? "sim" : "não";
    if (window.CC_STATUS) {
      if (tabela === "meta_inovacao_matriz_demandas" && campo !== "id" && campo !== "iniciativa") {
        return CC_STATUS.rotulo(CC_STATUS.chaveDeEntrada("celula_matriz", valor));
      }
      if (tabela === "meta_inovacao_matriz_celulas" && campo === "estado") {
        return CC_STATUS.rotulo(CC_STATUS.chaveDeEntrada("celula_matriz", valor));
      }
      if (campo === "status" && CONTEXTO_STATUS_POR_TABELA[tabela]) {
        return CC_STATUS.rotulo(CC_STATUS.chaveDeEntrada(CONTEXTO_STATUS_POR_TABELA[tabela], valor));
      }
    }
    return String(valor);
  }

  function diffCampos(anterior, novo) {
    const chaves = new Set([...Object.keys(anterior || {}), ...Object.keys(novo || {})]);
    const mudou = [];
    chaves.forEach((c) => {
      if (CAMPOS_IGNORADOS_DIFF.includes(c)) return;
      const a = anterior ? anterior[c] : undefined, n = novo ? novo[c] : undefined;
      if (JSON.stringify(a) === JSON.stringify(n)) return;
      mudou.push(c);
    });
    return mudou;
  }

  function formatarDataHoraHistorico(iso) {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    const p = (n) => String(n).padStart(2, "0");
    return p(d.getDate()) + "/" + p(d.getMonth() + 1) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  function resumoLinhaHistorico(l) {
    if (l.operacao === "INSERT") return '<span class="hist-op-insert">criado</span>';
    if (l.operacao === "DELETE") return '<span class="hist-op-delete">removido</span>';
    const mudou = diffCampos(l.valor_anterior, l.valor_novo);
    if (!mudou.length) return "sem mudança visível";
    return mudou.map((c) =>
      esc(c) + ": " + esc(valorParaExibicaoHistorico(l.tabela, c, l.valor_anterior && l.valor_anterior[c])) +
      " → " + esc(valorParaExibicaoHistorico(l.tabela, c, l.valor_novo && l.valor_novo[c]))
    ).join(", ");
  }

  function linhaHtmlHistorico(l) {
    return '<div class="hist-linha"><span class="mono">' + formatarDataHoraHistorico(l.criado_em) + '</span> · ' +
      '<span class="hist-autor">' + esc(l.autor || "—") + '</span> · ' +
      '<span class="mono">' + esc(l.registro_id) + '</span> ' +
      '<span class="hist-resumo">' + resumoLinhaHistorico(l) + '</span></div>';
  }

  // modo de teste (?semrede=1/CC_FORCAR_FALLBACK) — mesmo mecanismo de js/db-plano.js. O
  // log em si NÃO tem fallback client-side de verdade (não faz sentido: editar em
  // file:///offline não gera escrita real, então não haveria nada real pra "cair" pra um
  // seed) — este mock existe só pra exercitar a RENDERIZAÇÃO (formatação de data/hora,
  // diff de campos, tradução de status via CC_STATUS.rotulo, filtros) sem bater no
  // Supabase de produção durante os testes headless.
  function forcarFallbackHistorico() {
    if (window.CC_FORCAR_FALLBACK) return true;
    try { return new URLSearchParams(location.search).get("semrede") === "1"; } catch (e) { return false; }
  }
  const MOCK_HISTORICO = [
    { id: 1, tabela: "meta_inovacao_plano_acoes", registro_id: "CMT-02", operacao: "UPDATE",
      valor_anterior: { status: "nao_iniciado" }, valor_novo: { status: "em_andamento" },
      autor: "JR.", criado_em: "2026-08-12T15:42:00Z" },
    { id: 2, tabela: "plano_acao_atividades", registro_id: "42", operacao: "INSERT",
      valor_anterior: null, valor_novo: { descricao: "Nova atividade de teste", status: "nao_iniciado" },
      autor: "Sandra", criado_em: "2026-08-12T10:05:00Z" },
    { id: 3, tabela: "meta_inovacao_matriz_demandas", registro_id: "9", operacao: "DELETE",
      valor_anterior: { iniciativa: "Sebraetec", cnr: "previsto" }, valor_novo: null,
      autor: "JR.", criado_em: "2026-08-11T09:00:00Z" },
  ];

  let historicoCarregadoUmaVez = false;
  let historicoBruto = []; // últimas 100 (ou menos, já filtradas por tabela) vindas do Supabase/mock

  function montarOpcoesAutorHistorico() {
    const sel = document.getElementById("hist-autor");
    const atual = sel.value;
    const autores = [...new Set(historicoBruto.map((l) => l.autor).filter(Boolean))].sort();
    sel.innerHTML = '<option value="">Todos os autores</option>' +
      autores.map((a) => '<option value="' + esc(a) + '"' + (a === atual ? " selected" : "") + '>' + esc(a) + '</option>').join("");
  }

  function renderHistoricoFiltrado() {
    const painel = document.getElementById("hist-lista");
    const autorFiltro = document.getElementById("hist-autor").value;
    const lista = autorFiltro ? historicoBruto.filter((l) => l.autor === autorFiltro) : historicoBruto;
    painel.innerHTML = lista.length ? lista.map(linhaHtmlHistorico).join("") : '<div class="ed-carregando">Nenhuma alteração registrada ainda.</div>';
  }

  async function carregarHistorico() {
    const painel = document.getElementById("hist-lista");
    painel.innerHTML = '<div class="ed-carregando">Carregando…</div>';
    const tabelaFiltro = document.getElementById("hist-tabela").value;

    if (forcarFallbackHistorico()) {
      historicoBruto = tabelaFiltro ? MOCK_HISTORICO.filter((l) => l.tabela === tabelaFiltro) : MOCK_HISTORICO.slice();
      montarOpcoesAutorHistorico();
      renderHistoricoFiltrado();
      return;
    }
    try {
      const supa = await CC_SUPABASE.obterClienteEsm();
      let q = supa.from("meta_inovacao_audit_log").select("*").order("criado_em", { ascending: false }).limit(100);
      if (tabelaFiltro) q = q.eq("tabela", tabelaFiltro);
      const { data, error } = await q;
      if (error) throw error;
      historicoBruto = data || [];
      montarOpcoesAutorHistorico();
      renderHistoricoFiltrado();
    } catch (err) {
      console.error("editor: falha ao carregar histórico", err);
      painel.innerHTML = '<div class="ed-erro-carregar">Não foi possível carregar o histórico — ' + esc((err && err.message) || String(err)) +
        '.<br>Confira se <span class="mono">tools/sql/2026-08_auditoria.sql</span> já foi rodado no SQL Editor.</div>';
    }
  }

  function montar() {
    document.getElementById("hist-tabela").addEventListener("change", carregarHistorico);
    document.getElementById("hist-autor").addEventListener("change", renderHistoricoFiltrado);
    document.getElementById("hist-recarregar").addEventListener("click", carregarHistorico);
  }

  // chamado pelo "spine" (alternarAba(), em editor.html) toda vez que a aba Histórico é
  // aberta — carrega só na primeira vez (mesmo comportamento de antes da extração);
  // "Recarregar" (acima) continua funcionando a qualquer momento, sem essa trava.
  function ativar() {
    if (historicoCarregadoUmaVez) return;
    historicoCarregadoUmaVez = true;
    carregarHistorico();
  }

  window.EDITOR_HISTORICO = { montar: montar, ativar: ativar };
})();
