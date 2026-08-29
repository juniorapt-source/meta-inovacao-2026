/* Camada de dados do conjunto PLANO (item 3.1 do plano de melhorias) — window.DB_PLANO.
 *
 * Lê de meta_inovacao_plano_acoes no Supabase; se a chamada falhar (offline, file://,
 * rede fora do ar, tabela ainda não criada), cai pra window.DB.plano — data/plano.js
 * continua carregado via <script> em toda página como SEED e fallback de leitura, não
 * como fonte primária. Todas as páginas que liam DB.plano diretamente (index.html,
 * plano.html, caminho.html, minhas-acoes.html) chamam DB_PLANO.carregar().
 *
 * O mecanismo comum (fallback, memoização, modo de teste ?semrede=1/CC_FORCAR_FALLBACK,
 * bloqueio de escrita em teste) vive em js/db-base.js desde o item D4.1 — API pública
 * inalterada (item D4.3).
 *
 * Formato do objeto "ação" devolvido é o MESMO de sempre (id/frente/sub/atividade/resp/
 * responsavel_id/prazo/prazo_iso/status/dep/cc/como/monitor/ferramenta) — o resto do
 * código (js/core.js stClass, js/calc.js, filtros de plano.html...) não precisa saber
 * de onde os dados vieram. Item 5.9 (parte 7) acrescenta um campo, só quando lido do
 * Supabase: responsaveis_golden (vínculos crus de meta_inovacao_plano_responsaveis, item
 * 2.6 — ver anexarResponsaveisGolden abaixo, ligado no gancho `aposBuscar` da fábrica);
 * no seed local (data/plano.js) fica sempre [], porque o seed nunca teve essa junção.
 *
 * PRECISA de js/db-base.js carregado antes.
 */
(function (root) {
  "use strict";

  const BASE = root.DB_BASE || (typeof globalThis !== "undefined" && globalThis.DB_BASE);
  if (!BASE) throw new Error("js/db-plano.js: js/db-base.js precisa ser carregado antes deste arquivo.");

  const TABELA = "meta_inovacao_plano_acoes";

  // status guardado no banco é a chave canônica (P6) só dos 3 estados ARMAZENADOS —
  // "atrasada"/"janela" nunca foram um valor gravado, sempre calculados (CALC.ehAtrasada
  // + presença de prazo_iso). O resto do código compara a.status contra os RÓTULOS de
  // sempre ("Não iniciado"/"Em andamento"/"Concluído"), então a tradução de volta
  // acontece aqui, uma vez só, na borda — ninguém mais no site precisa saber que o banco
  // guarda a chave canônica por baixo.
  const ROTULO_POR_CHAVE = { nao_iniciado: "Não iniciado", em_andamento: "Em andamento", concluida: "Concluído" };
  const CHAVE_POR_ROTULO = { "Não iniciado": "nao_iniciado", "Em andamento": "em_andamento", "Concluído": "concluida" };

  function linhaParaAcao(r) {
    return {
      id: r.id,
      frente: r.frente,
      sub: r.subfrente,
      atividade: r.atividade,
      resp: r.responsavel,
      responsavel_id: r.responsavel_id || [],
      prazo: r.prazo_texto,
      prazo_iso: r.prazo_iso,
      status: ROTULO_POR_CHAVE[r.status] || r.status,
      dep: r.dependencias || [],
      cc: { tipo: r.cc_tipo, no: r.no_critico },
      como: r.como,
      monitor: r.monitor,
      ferramenta: r.ferramenta,
      ordem: r.ordem,
      db_id: r.id, // pra edição — nesta tabela o id de exibição JÁ É a chave primária
      db_updated_at: r.updated_at,
    };
  }

  function acaoParaLinha(a) {
    return {
      id: a.id, frente: a.frente, subfrente: a.sub, atividade: a.atividade,
      responsavel: a.resp, responsavel_id: a.responsavel_id || [],
      prazo_iso: a.prazo_iso || null, prazo_texto: a.prazo,
      status: CHAVE_POR_ROTULO[a.status] || a.status,
      dependencias: a.dep || [], cc_tipo: (a.cc && a.cc.tipo) || null, no_critico: (a.cc && a.cc.no) || null,
      como: a.como, monitor: a.monitor, ferramenta: a.ferramenta, ordem: a.ordem,
    };
  }

  // item 5.9 (parte 7) — anexa, em cada ação, os vínculos golden de
  // meta_inovacao_plano_responsaveis (item 2.6: pessoa_id/coletivo_id, "convivendo" com o
  // texto legado responsavel_id[], nunca substituindo) em a.responsaveis_golden — cru
  // (pessoa_id/coletivo_id/ordem), sem resolver nome: quem consome (ex.: minhas-acoes.html)
  // decide como casar contra a pessoa/coletivo selecionada. Best-effort de propósito: se a
  // página não carregou js/db-plano-responsaveis.js (script tag ausente) ou a busca falha,
  // cada ação fica com responsaveis_golden:[] — nunca impede a leitura das ações por isso,
  // mesmo espírito de "cai pro texto legado" das outras partes do 5.9. Roda como gancho
  // `aposBuscar` da fábrica: só no caminho da rede, nunca no do seed.
  async function anexarResponsaveisGolden(lista) {
    if (!root.DB_PLANO_RESPONSAVEIS) {
      lista.forEach((a) => { a.responsaveis_golden = []; });
      return;
    }
    try {
      const { lista: vinculos } = await root.DB_PLANO_RESPONSAVEIS.carregar();
      const idx = root.DB_PLANO_RESPONSAVEIS.porPlanoAcao(vinculos);
      lista.forEach((a) => {
        a.responsaveis_golden = (idx[a.id] || []).map((v) => ({ pessoa_id: v.pessoa_id, coletivo_id: v.coletivo_id, ordem: v.ordem }));
      });
    } catch (err) {
      console.error("db-plano: falha ao carregar vínculos golden (meta_inovacao_plano_responsaveis), ações ficam sem responsaveis_golden", err);
      lista.forEach((a) => { a.responsaveis_golden = []; });
    }
  }

  const api = BASE.criarWrapper({
    nome: "db-plano",
    raiz: root,
    tabela: TABELA,
    ordem: "ordem",
    linhaPara: linhaParaAcao,
    paraLinha: acaoParaLinha,
    aposBuscar: anexarResponsaveisGolden,
    // sem golden record no seed local — cada ação sai com responsaveis_golden:[] pra quem
    // consome (minhas-acoes.html) não precisar de "|| []" espalhado pelo código.
    seed: function () { return ((root.DB && root.DB.plano) || []).map((a) => Object.assign({ responsaveis_golden: [] }, a)); },
    avisoFalha: "db-plano: falha ao carregar do Supabase, caindo pro seed local (data/plano.js)",
  });

  root.DB_PLANO = {
    TABELA: TABELA,
    carregar: api.carregar,
    salvar: api.salvar,
    criar: api.criar,
    removerSoft: api.removerSoft,
    acaoParaLinha: acaoParaLinha,
    CHAVE_POR_ROTULO: CHAVE_POR_ROTULO,
  };
})(this);
