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
 * de onde os dados vieram.
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
    return (data || []).map(linhaParaAcao);
  }

  function seedLocal() {
    return ((root.DB && root.DB.plano) || []).slice();
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

  // ---- escrita (usada só por editor.html, Modo edição) ----
  async function salvar(id, campos, usuario) {
    const supa = await root.CC_SUPABASE.obterClienteEsm();
    const patch = Object.assign({}, campos, { updated_by: usuario || null });
    const { data, error } = await supa.from(TABELA).update(patch).eq("id", id).select().single();
    if (error) throw error;
    return linhaParaAcao(data);
  }

  async function criar(acaoParcial, usuario) {
    const supa = await root.CC_SUPABASE.obterClienteEsm();
    const payload = Object.assign({}, acaoParaLinha(acaoParcial), { updated_by: usuario || null });
    const { data, error } = await supa.from(TABELA).insert(payload).select().single();
    if (error) throw error;
    return linhaParaAcao(data);
  }

  async function removerSoft(id, usuario) {
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
