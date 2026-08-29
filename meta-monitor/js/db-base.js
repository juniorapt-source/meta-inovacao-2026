/* Fábrica dos wrappers de dados (item D4.1 de docs/PLANO_EXECUCAO_DEBITOS_TECNICOS.md)
 * — window.DB_BASE.
 *
 * Os 13 arquivos js/db-*.js nasceram por cópia: todos repetem o mesmo esqueleto
 * (forcarFallback() lendo ?semrede=1/CC_FORCAR_FALLBACK, buscarDoSupabase(), seedLocal(),
 * memoização em `promessa`, bloquearEscritaEmTeste(), salvar/criar/removerSoft com
 * updated_by). Mudar a política de fallback ou o tratamento de erro significava editar 13
 * arquivos e lembrar dos 13 — foi assim que o GRANT esquecido do P10 passou e que a
 * v0.29.0 quebrou 5 tabelas de uma vez.
 *
 * Este arquivo é SÓ a fábrica. Ele não muda nenhuma tela e não migra wrapper nenhum: a
 * migração é dos itens D4.2 (2 wrappers simples primeiro) e D4.3 (o resto, um commit por
 * wrapper). O comportamento aqui é o mesmo observável de hoje, colado dos wrappers atuais
 * — incluindo os detalhes que parecem descuido e não são:
 *
 *   - `carregar()` calcula `forcar` ANTES de olhar a memoização (uma segunda chamada sem
 *     {recarregar:true} devolve a promessa já resolvida, mesmo que o modo teste tenha
 *     mudado no meio);
 *   - a leitura exige js/supabase.js carregado e falha com mensagem própria; a escrita
 *     não checa (estoura no acesso, como hoje);
 *   - o texto do motivoFallback do modo teste e a mensagem de bloqueio de escrita são os
 *     mesmos, palavra por palavra — tem teste headless que casa por texto.
 *
 * Uso (o que o wrapper vira em D4.2/D4.3):
 *
 *   const api = root.DB_BASE.criarWrapper({
 *     nome: "db-nucleos",                  // só pras mensagens de console
 *     raiz: root,                          // de onde vêm CC_SUPABASE/CC_FORCAR_FALLBACK/location
 *     tabela: "meta_inovacao_nucleos",
 *     ordem: "ordem",                      // string, lista de strings, {coluna,ascendente}[] ou null
 *     linhaPara: linhaParaNucleo,          // linha do banco -> objeto do site
 *     paraLinha: nucleoParaLinha,          // objeto do site -> linha do banco (só quem tem criar())
 *     seed: () => ((root.DB && root.DB.nucleos) || []).slice(),
 *     avisoFalha: "db-nucleos: falha ao carregar do Supabase, caindo pro seed local (data/nucleos.js)",
 *   });
 *   root.DB_NUCLEOS = { TABELA: api.TABELA, carregar: api.carregar, ... };
 *
 * O wrapper continua dono da sua API pública: a fábrica devolve as peças, quem exporta o
 * quê (e com que nome) é decisão de cada arquivo — db-agenda.js não tem `criar`,
 * db-pessoa-papeis.js não tem `salvar`, e isso não muda.
 *
 * Fora do escopo por desenho: db-canva.js, db-canva-consolidado.js e db-responsaveis.js
 * (RPC/derivado, não seguem este padrão — o próprio D4.3 os deixa de fora).
 *
 * Node: os arquivos js/db-*.js são `(function (root) {...})(this)`, e em Node `this` no
 * topo do módulo é o `module.exports` daquele arquivo — ou seja, o `root` de db-nucleos.js
 * NÃO é o mesmo de db-base.js. Por isso a fábrica também se publica em globalThis, e o
 * wrapper migrado deve resolvê-la como
 * `root.DB_BASE || (typeof globalThis !== "undefined" && globalThis.DB_BASE)`; no
 * navegador os dois são window, e nada muda. Em Node, quem for testar precisa dar
 * `require("../js/db-base.js")` antes de requerer o wrapper.
 */
(function (root) {
  "use strict";

  const MOTIVO_MODO_TESTE = "modo de teste (semrede) — sem tentar rede";
  const ERRO_ESCRITA_EM_TESTE = "modo de teste (semrede) — escrita bloqueada de propósito, pra nunca gravar de verdade durante testes automatizados.";

  // ?semrede=1 na URL (ou CC_FORCAR_FALLBACK = true antes dos scripts carregarem) força o
  // fallback local sem tentar rede — usado pelos testes headless E como jeito real de
  // exercitar a UI de aviso "dados locais". Cópia literal do que está nos 13 wrappers.
  function forcarFallback(raiz) {
    if (raiz.CC_FORCAR_FALLBACK) return true;
    try { return new URLSearchParams(raiz.location.search).get("semrede") === "1"; } catch (e) { return false; }
  }

  // `ordem` aceita os 3 formatos que os wrappers de hoje usam, na prática:
  //   "ordem"                       -> .order("ordem", {ascending:true})
  //   ["ciclo", "canal"]            -> dois .order() encadeados, ambos ascendentes (db-agenda)
  //   [{ coluna: "x", ascendente: false }]  -> controle fino, se algum dia precisar
  //   null / undefined              -> sem .order() nenhum (db-pessoa-papeis e as junções)
  function normalizarOrdem(ordem) {
    if (!ordem) return [];
    const lista = Array.isArray(ordem) ? ordem : [ordem];
    return lista.map((o) => (typeof o === "string"
      ? { coluna: o, ascendente: true }
      : { coluna: o.coluna, ascendente: o.ascendente !== false }));
  }

  function aplicarOrdem(consulta, ordem) {
    return ordem.reduce((q, o) => q.order(o.coluna, { ascending: o.ascendente }), consulta);
  }

  function criarWrapper(cfg) {
    if (!cfg || !cfg.tabela) throw new Error("DB_BASE.criarWrapper: falta `tabela`.");
    if (typeof cfg.linhaPara !== "function") throw new Error("DB_BASE.criarWrapper (" + cfg.tabela + "): falta `linhaPara`.");

    const nome = cfg.nome || cfg.tabela;
    const raiz = cfg.raiz || root;
    const TABELA = cfg.tabela;
    const linhaPara = cfg.linhaPara;
    const paraLinha = cfg.paraLinha || null;
    const ordem = normalizarOrdem(cfg.ordem);
    // sem seed configurado = tabela que não tem equivalente em data/*.js (as junções da
    // Camada 1): o fallback devolve lista vazia, não quebra. Mesmo que db-pessoa-papeis.js.
    const seed = cfg.seed || function () { return []; };
    const avisoFalha = cfg.avisoFalha || (nome + ": falha ao carregar do Supabase, caindo pro seed local");
    // hook opcional pra quem enriquece a lista DEPOIS da busca e só quando veio da rede
    // (db-plano.js e os vínculos golden de meta_inovacao_plano_responsaveis).
    const aposBuscar = cfg.aposBuscar || null;

    function emModoTeste() { return forcarFallback(raiz); }

    async function cliente() {
      return await raiz.CC_SUPABASE.obterClienteEsm();
    }

    async function buscarDoSupabase() {
      if (!raiz.CC_SUPABASE) throw new Error("js/supabase.js não carregado.");
      const supa = await cliente();
      const consulta = aplicarOrdem(supa.from(TABELA).select("*").is("deleted_at", null), ordem);
      const { data, error } = await consulta;
      if (error) throw error;
      const lista = (data || []).map(linhaPara);
      if (aposBuscar) await aposBuscar(lista);
      return lista;
    }

    let promessa = null;
    let ultimoUsandoFallback = null;

    async function carregar(opts) {
      const forcar = (opts && opts.forcar) || emModoTeste();
      if (promessa && !(opts && opts.recarregar)) return promessa;
      promessa = (async () => {
        if (forcar) {
          ultimoUsandoFallback = true;
          return { lista: seed(), usandoFallback: true, motivoFallback: MOTIVO_MODO_TESTE };
        }
        try {
          const lista = await buscarDoSupabase();
          ultimoUsandoFallback = false;
          return { lista: lista, usandoFallback: false, motivoFallback: null };
        } catch (err) {
          console.error(avisoFalha, err);
          ultimoUsandoFallback = true;
          return { lista: seed(), usandoFallback: true, motivoFallback: (err && err.message) || String(err) };
        }
      })();
      return promessa;
    }

    // Trava de segurança (item 3.3): em modo de teste a ESCRITA fica bloqueada de
    // propósito, não só a leitura — sem isso, um teste headless que exercitasse o
    // drag-and-drop do Kanban gravaria de verdade no Supabase de produção.
    function bloquearEscritaEmTeste() {
      if (emModoTeste()) throw new Error(ERRO_ESCRITA_EM_TESTE);
    }

    async function salvar(id, campos, usuario) {
      bloquearEscritaEmTeste();
      const supa = await cliente();
      const patch = Object.assign({}, campos, { updated_by: usuario || null });
      const { data, error } = await supa.from(TABELA).update(patch).eq("id", id).select().single();
      if (error) throw error;
      return linhaPara(data);
    }

    async function criar(objetoParcial, usuario) {
      if (!paraLinha) throw new Error("DB_BASE (" + TABELA + "): criar() precisa de `paraLinha` na configuração.");
      bloquearEscritaEmTeste();
      const supa = await cliente();
      const payload = Object.assign({}, paraLinha(objetoParcial), { updated_by: usuario || null });
      const { data, error } = await supa.from(TABELA).insert(payload).select().single();
      if (error) throw error;
      return linhaPara(data);
    }

    async function removerSoft(id, usuario) {
      bloquearEscritaEmTeste();
      const supa = await cliente();
      const agora = new Date().toISOString();
      const { error } = await supa.from(TABELA).update({ deleted_at: agora, updated_by: usuario || null }).eq("id", id);
      if (error) throw error;
    }

    return {
      TABELA: TABELA,
      carregar: carregar,
      salvar: salvar,
      criar: criar,
      removerSoft: removerSoft,
      // estado da última carga: null enquanto ninguém carregou. Hoje cada tela guarda isso
      // por conta própria a partir do retorno de carregar(); fica aqui pra quem quiser
      // perguntar depois, sem mudar nada de quem já lê o campo do retorno.
      usandoFallback: function () { return ultimoUsandoFallback; },
      // expostos porque os wrappers de hoje têm essas duas funções internas e alguns
      // arquivos com mais de uma tabela (db-urc.js, db-corsario.js) vão precisar delas
      // fora do que a fábrica cobre.
      emModoTeste: emModoTeste,
      bloquearEscritaEmTeste: bloquearEscritaEmTeste,
      buscarDoSupabase: buscarDoSupabase,
    };
  }

  const API = {
    criarWrapper: criarWrapper,
    forcarFallback: forcarFallback,
    normalizarOrdem: normalizarOrdem,
    MOTIVO_MODO_TESTE: MOTIVO_MODO_TESTE,
    ERRO_ESCRITA_EM_TESTE: ERRO_ESCRITA_EM_TESTE,
  };

  root.DB_BASE = API;
  // ver a nota "Node" no cabeçalho: no navegador globalThis === window (mesma coisa); em
  // Node é o que permite o wrapper achar a fábrica, já que cada arquivo tem seu `root`.
  if (typeof globalThis !== "undefined" && globalThis !== root) globalThis.DB_BASE = API;
})(this);
