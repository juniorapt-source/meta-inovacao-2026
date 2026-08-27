/* Camada de dados do conjunto PLANO (item 3.1 do plano de melhorias) — window.DB_PLANO.
 *
 * Lê de meta_inovacao_plano_acoes no Supabase; se a chamada falhar (offline, file://,
 * rede fora do ar, tabela ainda não criada), cai pra window.DB.plano — data/plano.js
 * continua carregado via <script> em toda página como SEED e fallback de leitura, não
 * como fonte primária. Todas as páginas que liam DB.plano diretamente (index.html,
 * plano.html, caminho.html, minhas-acoes.html) passam a chamar DB_PLANO.carregar().
 *
 * Formato do objeto "ação" devolvido é o MESMO de sempre (id/frente/sub/atividade/resp/
 * responsavel_id/prazo/prazo_iso/status/dep/cc/como/monitor/ferramenta) — o resto do
 * código (js/core.js stClass, js/calc.js, filtros de plano.html...) não precisa saber
 * de onde os dados vieram. Item 5.9 (parte 7) acrescenta um campo, só quando lido do
 * Supabase: responsaveis_golden (vínculos crus de meta_inovacao_plano_responsaveis, item
 * 2.6 — ver anexarResponsaveisGolden abaixo); no seed local (data/plano.js) fica sempre
 * [], porque o seed nunca teve essa junção.
 *
 * ?semrede=1 na URL (ou window.CC_FORCAR_FALLBACK = true antes deste script carregar)
 * força o fallback local sem tentar rede — usado pelos testes headless (item 3.1 pede
 * explicitamente que eles não dependam de rede) E é um jeito real de testar a própria
 * UI de fallback (o aviso "dados locais" aparece de verdade, não é só um atalho de teste).
 */
(function (root) {
  "use strict";

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

  function forcarFallback() {
    if (root.CC_FORCAR_FALLBACK) return true;
    try { return new URLSearchParams(root.location.search).get("semrede") === "1"; } catch (e) { return false; }
  }

  async function buscarDoSupabase() {
    if (!root.CC_SUPABASE) throw new Error("js/supabase.js não carregado.");
    const supa = await root.CC_SUPABASE.obterClienteEsm();
    const { data, error } = await supa.from(TABELA).select("*").is("deleted_at", null).order("ordem", { ascending: true });
    if (error) throw error;
    const lista = (data || []).map(linhaParaAcao);
    await anexarResponsaveisGolden(lista);
    return lista;
  }

  // item 5.9 (parte 7) — anexa, em cada ação, os vínculos golden de
  // meta_inovacao_plano_responsaveis (item 2.6: pessoa_id/coletivo_id, "convivendo" com o
  // texto legado responsavel_id[], nunca substituindo) em a.responsaveis_golden — cru
  // (pessoa_id/coletivo_id/ordem), sem resolver nome: quem consome (ex.: minhas-acoes.html)
  // decide como casar contra a pessoa/coletivo selecionada. Best-effort de propósito: se a
  // página não carregou js/db-plano-responsaveis.js (script tag ausente) ou a busca falha,
  // cada ação fica com responsaveis_golden:[] — nunca impede a leitura das ações por isso,
  // mesmo espírito de "cai pro texto legado" das outras partes do 5.9.
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

  function seedLocal() {
    // sem golden record no seed local — cada ação sai com responsaveis_golden:[] pra quem
    // consome (minhas-acoes.html) não precisar de "|| []" espalhado pelo código.
    return ((root.DB && root.DB.plano) || []).map((a) => Object.assign({ responsaveis_golden: [] }, a));
  }

  let promessa = null;
  // carregar({forcar:true}) ou ?semrede=1 pula a rede de propósito — devolve o mesmo
  // seedLocal(), mas marcado como fallback de verdade (usandoFallback:true), pra
  // exercitar a MESMA UI de aviso que apareceria numa falha real de rede, sem depender
  // de rede pra isso acontecer de forma confiável num teste.
  async function carregar(opts) {
    const forcar = (opts && opts.forcar) || forcarFallback();
    if (promessa && !(opts && opts.recarregar)) return promessa;
    promessa = (async () => {
      if (forcar) {
        return { lista: seedLocal(), usandoFallback: true, motivoFallback: "modo de teste (semrede) — sem tentar rede" };
      }
      try {
        const lista = await buscarDoSupabase();
        return { lista: lista, usandoFallback: false, motivoFallback: null };
      } catch (err) {
        console.error("db-plano: falha ao carregar do Supabase, caindo pro seed local (data/plano.js)", err);
        return { lista: seedLocal(), usandoFallback: true, motivoFallback: (err && err.message) || String(err) };
      }
    })();
    return promessa;
  }

  // ---- escrita (editor.html, Modo edição, e o Kanban de plano.html a partir do item 3.3) ----
  // Trava de segurança (item 3.3): em modo de teste (?semrede=1 / CC_FORCAR_FALLBACK) a
  // ESCRITA fica bloqueada de propósito, não só a leitura — sem isso, um teste headless
  // que exercitasse o drag-and-drop do Kanban gravaria de verdade no Supabase de produção.
  // Erro claro em vez de deixar a chamada tentar rede (ou pior, escrever por acidente).
  function bloquearEscritaEmTeste() {
    if (forcarFallback()) throw new Error("modo de teste (semrede) — escrita bloqueada de propósito, pra nunca gravar de verdade durante testes automatizados.");
  }

  async function salvar(id, campos, usuario) {
    bloquearEscritaEmTeste();
    const supa = await root.CC_SUPABASE.obterClienteEsm();
    const patch = Object.assign({}, campos, { updated_by: usuario || null });
    const { data, error } = await supa.from(TABELA).update(patch).eq("id", id).select().single();
    if (error) throw error;
    return linhaParaAcao(data);
  }

  async function criar(acaoParcial, usuario) {
    bloquearEscritaEmTeste();
    const supa = await root.CC_SUPABASE.obterClienteEsm();
    const payload = Object.assign({}, acaoParaLinha(acaoParcial), { updated_by: usuario || null });
    const { data, error } = await supa.from(TABELA).insert(payload).select().single();
    if (error) throw error;
    return linhaParaAcao(data);
  }

  async function removerSoft(id, usuario) {
    bloquearEscritaEmTeste();
    const supa = await root.CC_SUPABASE.obterClienteEsm();
    const agora = new Date().toISOString();
    const { error } = await supa.from(TABELA).update({ deleted_at: agora, updated_by: usuario || null }).eq("id", id);
    if (error) throw error;
  }

  root.DB_PLANO = {
    TABELA: TABELA,
    carregar: carregar,
    salvar: salvar,
    criar: criar,
    removerSoft: removerSoft,
    acaoParaLinha: acaoParaLinha,
    CHAVE_POR_ROTULO: CHAVE_POR_ROTULO,
  };
})(this);
