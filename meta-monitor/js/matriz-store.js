/* Cliente da matriz de demandas — window.matrizStore.
 *
 * Camada 3 do golden record de cadastros de referência (docs/PLANO_EXECUCAO_GOLDEN_RECORD.md,
 * itens 3.1/3.2). Este arquivo APONTA PRA TABELA NOVA, meta_inovacao_matriz_celulas:
 * uma linha por (projeto_id, canal_id), no lugar da tabela antiga
 * meta_inovacao_matriz_demandas, que tinha 1 linha por iniciativa e 10 COLUNAS FÍSICAS
 * (uma por canal). O ganho é o objetivo declarado da camada: cadastrar um canal novo em
 * meta_inovacao_canais faz a coluna aparecer na grade sozinha — sem ALTER TABLE e sem
 * mexer em HTML.
 *
 * Formato da tabela nova (tools/sql/2026-08_matriz_celulas.sql, item 3.1 — já rodado em
 * produção):
 *   id bigint PK · projeto_id FK -> meta_inovacao_projetos · canal_id FK ->
 *   meta_inovacao_canais · estado text (CHECK com os 7 valores de ESTADOS, abaixo) ·
 *   updated_at · updated_by · UNIQUE (projeto_id, canal_id).
 * Célula ausente = célula vazia: NÃO existe uma linha por par possível, e a grade não
 * cria nenhuma até alguém editar de fato (upsert em salvarCelula).
 *
 * A TABELA ANTIGA CONTINUA SENDO LIDA — carregarLegado(), abaixo. Não pra montar a
 * grade (isso é 100% matriz_celulas), mas pra alimentar a conferência célula a célula
 * que demandas.html mostra durante a janela de validação humana (item 3.5 do plano, que
 * decide quando aposentar a tabela antiga). Nada neste arquivo ESCREVE na tabela antiga:
 * ela congela no estado em que a migração do item 3.1 a deixou e serve como rede de
 * segurança pra rollback + base de comparação.
 *
 * Client: window.CC_SUPABASE.clientePrincipal() (js/supabase.js) — mesmo padrão dos
 * outros js/db-*.js, com o header x-cc-token de escrita e a mesma seleção de SDK que o
 * resto da página usa (clássica via <script> do CDN em demandas.html, ESM no resto).
 *
 * montarModelo()/paraSnapshot() (item 3.3): a montagem da grade (célula → linha/coluna)
 * e a tradução pro formato de data/matriz.js moraram só em demandas.html até o item 3.2.
 * Vieram pra cá pra a aba "matriz" do editor.html usar a MESMA função — a leitura ao
 * vivo (DB_CANAIS + DB_PROJETOS + matrizStore) e o snapshot exportado batem chave a
 * chave com o que demandas.html mostra e exporta por construção, não por promessa.
 */
(function (root) {
  "use strict";

  const TABELA = "meta_inovacao_matriz_celulas";
  const TABELA_LEGADA = "meta_inovacao_matriz_demandas";
  const CACHE_MS = 30000;

  /* Os 7 valores aceitos pelo CHECK da coluna `estado` — os MESMOS da tabela antiga
     (supabase/setup.sql: check (<canal> in ('', 'previsto', ...))). A fonte da verdade é
     o CHECK no banco; esta lista existe pra grade só oferecer o que o banco aceita, em
     vez de deixar o usuário escolher um valor que o INSERT vai recusar com 23514.
     ATENÇÃO: "oficina_confirmada" e "nao_aplica" existem em js/status.js (e em
     css/base.css) mas NUNCA estiveram no CHECK — escolhê-los sempre falhou no salvar,
     silenciosamente, desde a v0.7.0. Se um dia entrarem de verdade, entram primeiro no
     CHECK do banco e depois aqui, nesta ordem. */
  const ESTADOS = ["", "previsto", "oficina", "formulario", "justificado", "priorizado", "encaminhado"];

  /* select com os nomes vindos por junção: cada célula chega sabendo a INICIATIVA do seu
     projeto e o SLUG do seu canal, além dos ids. Isso paga três coisas de uma vez:
     1) a grade continua conseguindo casar célula com linha/coluna mesmo se o catálogo de
        projetos ou de canais tiver caído pro seed local (sem db_id pra casar por id);
     2) célula órfã (projeto ou canal que sumiu do catálogo — soft delete, por exemplo)
        aparece na tela com NOME, não como "#id";
     3) a conferência com a tabela antiga (que só conhece iniciativa × slug) tem como
        comparar sem uma segunda consulta.
     Se o embed falhar por qualquer motivo (cache de schema do PostgREST, FK renomeada),
     buscarDoSupabase() refaz a consulta sem ele em vez de derrubar a página inteira. */
  const SELECT_COM_NOMES = "*,projeto:meta_inovacao_projetos(iniciativa),canal:meta_inovacao_canais(slug)";

  async function cliente() {
    if (!root.CC_SUPABASE) throw new Error("js/supabase.js não carregado antes de js/matriz-store.js.");
    return root.CC_SUPABASE.clientePrincipal();
  }

  // mesmo interruptor de teste dos outros js/db-*.js: ?semrede=1 na URL ou
  // window.CC_FORCAR_FALLBACK — usado pelos tools/testar_*_headless.js.
  function forcarFallback() {
    if (root.CC_FORCAR_FALLBACK) return true;
    try { return new URLSearchParams(root.location.search).get("semrede") === "1"; } catch (e) { return false; }
  }

  function bloquearEscritaEmTeste() {
    if (forcarFallback()) throw new Error("modo de teste (semrede) — escrita bloqueada de propósito, pra nunca gravar de verdade durante testes automatizados.");
  }

  // linha viva = sem soft delete. A tabela pode nem ter a coluna deleted_at (o item 3.1
  // não a previu); nesse caso r.deleted_at é undefined e a linha passa. Filtrar aqui em
  // vez de com .is("deleted_at", null) na consulta é de propósito: um .is() numa coluna
  // que não existe derruba a consulta inteira com 42703.
  function viva(r) { return !r.deleted_at; }

  /* formato canônico de célula devolvido por carregar():
       { id, projeto_id, canal_id, estado, iniciativa, canal_slug, updated_at, updated_by }
     iniciativa/canal_slug ficam null quando a consulta veio sem o embed; projeto_id/
     canal_id ficam null quando a célula veio do seed local (data/matriz.js, que só
     conhece nome de iniciativa e slug de canal). Quem consome casa pelos dois. */
  function normalizar(r) {
    return {
      id: r.id != null ? r.id : null,
      projeto_id: r.projeto_id != null ? Number(r.projeto_id) : null,
      canal_id: r.canal_id != null ? Number(r.canal_id) : null,
      estado: r.estado || "",
      iniciativa: (r.projeto && r.projeto.iniciativa) || null,
      canal_slug: (r.canal && r.canal.slug) || null,
      // a tabela nova usa updated_at/updated_by (PADRAO_TABELA.md); a antiga usava
      // atualizado_em/atualizado_por. Aceita os dois na LEITURA pra não depender do nome
      // exato ter sobrevivido à migração do item 3.1 — a escrita usa só updated_by.
      updated_at: r.updated_at || r.atualizado_em || null,
      updated_by: r.updated_by || r.atualizado_por || null,
    };
  }

  async function buscarDoSupabase() {
    const supa = await cliente();
    const comNomes = await supa.from(TABELA).select(SELECT_COM_NOMES).order("projeto_id", { ascending: true }).order("canal_id", { ascending: true });
    let data = comNomes.data;
    if (comNomes.error) {
      console.warn("matriz-store: consulta com junção falhou, refazendo sem ela (a grade segue, só perde o nome de célula órfã) —", comNomes.error);
      const cru = await supa.from(TABELA).select("*").order("projeto_id", { ascending: true }).order("canal_id", { ascending: true });
      if (cru.error) throw cru.error;
      data = cru.data;
    }
    return (data || []).filter(viva).map(normalizar);
  }

  // seed local (data/matriz.js) — objeto { iniciativa: { slug_do_canal: estado } }. Sem
  // id de banco em lugar nenhum: por isso a grade fica somente-leitura no fallback.
  function seedLocal() {
    const bruto = (root.DB && root.DB.matriz) || {};
    const out = [];
    Object.keys(bruto).forEach((iniciativa) => {
      const celulas = bruto[iniciativa] || {};
      Object.keys(celulas).forEach((slug) => {
        out.push({
          id: null, projeto_id: null, canal_id: null,
          estado: celulas[slug] || "",
          iniciativa: iniciativa, canal_slug: slug,
          updated_at: null, updated_by: null,
        });
      });
    });
    return out;
  }

  let cache = { resultado: null, ts: 0 };

  /* carregar({recarregar}) -> { lista, usandoFallback, motivoFallback }
     Nunca lança (mesmo contrato de js/db-projetos.js/js/db-canais.js): se o Supabase não
     responder, devolve o seed local marcado como fallback e quem chama decide o que
     mostrar. Cache de 30s, furado por {recarregar:true} ou invalidar(). */
  async function carregar(opts) {
    const recarregar = !!(opts && opts.recarregar);
    const agora = Date.now();
    if (!recarregar && cache.resultado && (agora - cache.ts) < CACHE_MS) return cache.resultado;

    let resultado;
    if (forcarFallback()) {
      resultado = { lista: seedLocal(), usandoFallback: true, motivoFallback: "modo de teste (semrede) — sem tentar rede" };
    } else {
      try {
        resultado = { lista: await buscarDoSupabase(), usandoFallback: false, motivoFallback: null };
      } catch (err) {
        console.error("matriz-store: falha ao carregar " + TABELA + ", caindo pro seed local (data/matriz.js)", err);
        resultado = { lista: seedLocal(), usandoFallback: true, motivoFallback: (err && err.message) || String(err) };
      }
    }
    cache = { resultado: resultado, ts: agora };
    return resultado;
  }

  function invalidar() { cache = { resultado: null, ts: 0 }; }

  // guarda no cache a célula recém-gravada, preservando iniciativa/canal_slug — o
  // .select() do upsert volta sem os embeds, e perder o nome aqui faria a célula sumir da
  // conferência com a tabela antiga até o próximo carregar().
  function mesclarNoCache(celula, anterior) {
    if (!cache.resultado || !cache.resultado.lista) return celula;
    const lista = cache.resultado.lista;
    const i = lista.findIndex((c) => c.projeto_id === celula.projeto_id && c.canal_id === celula.canal_id);
    const nomes = {
      iniciativa: celula.iniciativa || (i > -1 ? lista[i].iniciativa : null) || (anterior && anterior.iniciativa) || null,
      canal_slug: celula.canal_slug || (i > -1 ? lista[i].canal_slug : null) || (anterior && anterior.canal_slug) || null,
    };
    const completa = Object.assign({}, celula, nomes);
    if (i > -1) lista[i] = completa; else lista.push(completa);
    return completa;
  }

  /* salvarCelula({projeto_id, canal_id, estado, iniciativa?, canal_slug?}, usuario)
     UPSERT no par (projeto_id, canal_id) — é o UNIQUE da tabela. Upsert e não
     "update se tem id, senão insert" de propósito: duas pessoas editando a MESMA célula
     ao mesmo tempo (o caso normal aqui — a matriz é editada a várias mãos, com realtime)
     não podem virar 23505 na cara de quem chegou meio segundo depois. */
  async function salvarCelula(celula, usuario) {
    bloquearEscritaEmTeste();
    const projeto_id = celula && celula.projeto_id;
    const canal_id = celula && celula.canal_id;
    if (projeto_id == null || canal_id == null) {
      throw new Error("célula sem projeto_id/canal_id — só dá pra gravar quando o portfólio e o catálogo de canais vieram do Supabase (online).");
    }
    const estado = (celula && celula.estado) || "";
    if (ESTADOS.indexOf(estado) === -1) {
      throw new Error('estado "' + estado + '" não é aceito pela matriz (valores válidos: ' + ESTADOS.map((e) => e || "(vazio)").join(", ") + ").");
    }
    const supa = await cliente();
    const payload = { projeto_id: projeto_id, canal_id: canal_id, estado: estado, updated_by: usuario || null };
    const { data, error } = await supa.from(TABELA).upsert(payload, { onConflict: "projeto_id,canal_id" }).select().single();
    if (error) throw error;
    return mesclarNoCache(normalizar(data), celula);
  }

  /* ---- tabela antiga, só leitura (item 3.5: validação humana ao longo do tempo) ---- */

  // colunas da tabela antiga que NÃO são canal. Todo o resto das colunas de texto dela é
  // uma coluna física de canal, nomeada pelo slug ("foco", "cnr", ...) — derivar assim,
  // em vez de repetir a lista dos 10 slugs aqui, faz a conferência enxergar até uma
  // coluna de canal que exista lá e não exista no catálogo novo.
  const META_LEGADO = ["id", "iniciativa", "nucleo", "criado_em", "atualizado_em", "atualizado_por", "created_at", "updated_at", "updated_by", "deleted_at"];

  /* carregarLegado() -> [{ iniciativa, canal_slug, estado }]
     Lança se a tabela antiga não responder — quem chama (demandas.html) trata como
     "sem conferência agora", nunca como erro de página: a grade não depende disto. */
  async function carregarLegado() {
    const supa = await cliente();
    const { data, error } = await supa.from(TABELA_LEGADA).select("*").order("iniciativa", { ascending: true });
    if (error) throw error;
    const out = [];
    (data || []).filter(viva).forEach((linha) => {
      Object.keys(linha).forEach((coluna) => {
        if (META_LEGADO.indexOf(coluna) !== -1) return;
        const valor = linha[coluna];
        if (typeof valor !== "string") return; // só as colunas de canal são text
        out.push({ iniciativa: linha.iniciativa, canal_slug: coluna, estado: valor || "" });
      });
    });
    return out;
  }

  /* assina mudanças em tempo real na tabela NOVA. onChange recebe o payload do Supabase
     Realtime. Não lança: se o canal não estiver disponível (por exemplo, se
     meta_inovacao_matriz_celulas ainda não tiver sido adicionada à publicação
     supabase_realtime — a checagem 16 de tools/sql/2026-08_matriz_celulas_diagnostico.sql
     diz se está ou não, e a migração NÃO cuida disso), devolve null e quem
     chama segue sem atualização automática, exatamente como antes de existir realtime. */
  function subscribeRealtime(onChange) {
    try {
      return root.CC_SUPABASE.obterClienteClassico()
        .channel("realtime:" + TABELA)
        .on("postgres_changes", { event: "*", schema: "public", table: TABELA }, (payload) => {
          invalidar();
          onChange(payload);
        })
        .subscribe();
    } catch (e) {
      console.warn("matriz-store: realtime indisponível —", e);
      return null;
    }
  }

  /* ---- modelo de grade (linhas × colunas), item 3.3 do plano ----
     Movido pra cá de demandas.html (item 3.2) pra virar a MESMA função nas duas telas
     que precisam montar a Matriz a partir dos três cadastros de referência (projetos,
     canais, células): demandas.html (edição ao vivo) e a aba "matriz" do editor.html
     (leitura + snapshot). Uma cópia colada em cada arquivo garantiria divergir cedo ou
     tarde; uma função só, chamada dos dois lugares, não. */

  function norm(s) { return String(s == null ? "" : s).trim().toLowerCase(); }

  /* montarModelo(projetos, canais, celulas) -> { colunas, linhas }
       linhas   = window.DB_PROJETOS.carregar().lista (ou o seed local)
       colunas  = window.DB_CANAIS.carregar().lista (ou o seed local), na ordem de `ordem`
       celulas  = matrizStore.carregar().lista — uma por (projeto_id, canal_id)
     Casa cada célula com sua linha/coluna por id e, quando falta id (catálogo caiu pro
     seed local mas as células vieram do Supabase, ou vice-versa), pelo NOME/SLUG que a
     célula já traz junto (junção feita em normalizar(), acima). Célula cujo projeto ou
     canal não existe em nenhum catálogo vira uma linha/coluna extra marcada "órfã" — só
     quando tem estado preenchido, pra nunca fazer dado sumir em silêncio nem materializar
     linha/coluna fantasma totalmente vazia. Canal desativado no catálogo só continua na
     grade se ainda tiver estado gravado em alguma célula. */
  function montarModelo(projetos, canais, celulas) {
    const cols = [], mapaCol = new Map();
    const lins = [], mapaLin = new Map();
    let seq = 0;

    function registrarCol(col) {
      cols.push(col);
      if (col.canal_id != null) mapaCol.set("id:" + col.canal_id, col);
      if (col.slug) mapaCol.set("slug:" + norm(col.slug), col);
      return col;
    }
    function registrarLin(lin) {
      lins.push(lin);
      if (lin.projeto_id != null) mapaLin.set("id:" + lin.projeto_id, lin);
      if (lin.iniciativa) mapaLin.set("nome:" + norm(lin.iniciativa), lin);
      return lin;
    }

    (canais || []).slice()
      .sort((a, b) => (Number(a.ordem) || 0) - (Number(b.ordem) || 0))
      .forEach((c) => registrarCol({
        chave: "c" + (seq++),
        canal_id: c.db_id != null ? Number(c.db_id) : null,
        slug: c.slug || null,
        nome: c.nome || c.slug || "canal",
        nome_completo: c.nome_completo || "",
        ativo: c.ativo !== false,
        foraDoCatalogo: false,
        temDado: false,
      }));

    (projetos || []).forEach((p) => registrarLin({
      projeto_id: p.db_id != null ? Number(p.db_id) : null,
      iniciativa: p.iniciativa || "",
      nucleo: p.nucleo || "",
      orfa: false,
      celulas: {},
    }));

    function nomeDeLinha(cel) { return cel.iniciativa || (cel.projeto_id != null ? "Iniciativa #" + cel.projeto_id : ""); }
    function nomeDeColuna(cel) { return cel.canal_slug || (cel.canal_id != null ? "Canal #" + cel.canal_id : ""); }

    function acharLinha(cel, criar) {
      let lin = cel.projeto_id != null ? mapaLin.get("id:" + cel.projeto_id) : null;
      if (lin) return lin;
      lin = cel.iniciativa ? mapaLin.get("nome:" + norm(cel.iniciativa)) : null;
      if (lin) {
        if (lin.projeto_id == null && cel.projeto_id != null) {
          lin.projeto_id = Number(cel.projeto_id);
          mapaLin.set("id:" + lin.projeto_id, lin);
        }
        return lin;
      }
      if (!criar) return null;
      return registrarLin({
        projeto_id: cel.projeto_id != null ? Number(cel.projeto_id) : null,
        iniciativa: nomeDeLinha(cel), nucleo: "", orfa: true, celulas: {},
      });
    }

    function acharColuna(cel, criar) {
      let col = cel.canal_id != null ? mapaCol.get("id:" + cel.canal_id) : null;
      if (col) return col;
      col = cel.canal_slug ? mapaCol.get("slug:" + norm(cel.canal_slug)) : null;
      if (col) {
        if (col.canal_id == null && cel.canal_id != null) {
          col.canal_id = Number(cel.canal_id);
          mapaCol.set("id:" + col.canal_id, col);
        }
        return col;
      }
      if (!criar) return null;
      return registrarCol({
        chave: "c" + (seq++),
        canal_id: cel.canal_id != null ? Number(cel.canal_id) : null,
        slug: cel.canal_slug || null,
        nome: nomeDeColuna(cel), nome_completo: "", ativo: false, foraDoCatalogo: true, temDado: true,
      });
    }

    (celulas || []).forEach((cel) => {
      let lin = acharLinha(cel, false);
      let col = acharColuna(cel, false);
      if (!lin || !col) {
        if (!cel.estado) return;
        if (!lin && !nomeDeLinha(cel)) return;
        if (!col && !nomeDeColuna(cel)) return;
        lin = lin || acharLinha(cel, true);
        col = col || acharColuna(cel, true);
      }
      lin.celulas[col.chave] = cel;
      if (cel.estado) col.temDado = true;
    });

    return { colunas: cols.filter((c) => c.ativo || c.temDado), linhas: lins };
  }

  /* paraSnapshot(linhas, colunas) -> { iniciativa: { slug_do_canal: estado } }
     Traduz um modelo de montarModelo() pro formato CONGELADO de data/matriz.js — ver a
     nota grande no topo de PLANO_EXECUCAO_GOLDEN_RECORD.md (Camada 3, item 3.3): esse
     formato é o fallback offline de demandas.html, indexado por SLUG e não por
     canal_id, e não pode mudar sem trocar os três lugares junto (aqui, seedLocal() acima
     e o seedCelulas() de demandas.html). Coluna sem slug (canal conhecido só por id)
     fica de fora — o arquivo é indexado por slug. */
  function paraSnapshot(linhas, colunas) {
    const obj = {};
    (linhas || []).forEach((l) => {
      const cells = {};
      (colunas || []).forEach((c) => {
        if (!c.slug) return;
        const cel = l.celulas[c.chave];
        cells[c.slug] = (cel && cel.estado) || "";
      });
      obj[l.iniciativa] = cells;
    });
    return obj;
  }

  const matrizStore = {
    TABELA: TABELA,
    TABELA_LEGADA: TABELA_LEGADA,
    ESTADOS: ESTADOS,
    carregar: carregar,
    carregarLegado: carregarLegado,
    invalidar: invalidar,
    salvarCelula: salvarCelula,
    subscribeRealtime: subscribeRealtime,
    montarModelo: montarModelo,
    paraSnapshot: paraSnapshot,
  };

  root.matrizStore = matrizStore;
})(this);
