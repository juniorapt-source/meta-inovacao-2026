/* Teste de aceite do item D4.1 (docs/PLANO_EXECUCAO_DEBITOS_TECNICOS.md): a fábrica
 * js/db-base.js faz, sozinha, exatamente o que os 13 wrappers js/db-*.js fazem copiado —
 * leitura com fallback pro seed, memoização, modo de teste (?semrede=1/CC_FORCAR_FALLBACK)
 * bloqueando ESCRITA, e updated_by em toda gravação.
 *
 * Não fala com o Supabase: usa um dublê do cliente (mesma cadeia
 * from().select().is().order() / update().eq().select().single() / insert()...) que
 * registra o que foi chamado. Mesmo espírito de tools/testar_supabase_erros.js.
 */
const path = require("path");
const BASE = require(path.join(__dirname, "..", "js", "db-base.js")).DB_BASE;

let erros = 0;
function checa(nome, cond) {
  if (cond) { console.log("  ok:", nome); }
  else { console.error("  FALHA:", nome); erros++; }
}

// --- dublê do cliente Supabase -------------------------------------------------
// cada método devolve o próprio objeto (a cadeia do supabase-js) e o objeto é "thenable",
// então `await consulta` e `await consulta.single()` resolvem pra resposta configurada.
function dubleCliente(resposta, log) {
  const consulta = {
    select(cols) { log.push(["select", cols]); return consulta; },
    is(col, val) { log.push(["is", col, val]); return consulta; },
    order(col, opts) { log.push(["order", col, opts && opts.ascending]); return consulta; },
    update(patch) { log.push(["update", patch]); return consulta; },
    insert(payload) { log.push(["insert", payload]); return consulta; },
    eq(col, val) { log.push(["eq", col, val]); return consulta; },
    single() { log.push(["single"]); return consulta; },
    then(ok, falha) { return Promise.resolve(resposta).then(ok, falha); },
  };
  return { from(t) { log.push(["from", t]); return consulta; } };
}

// raiz falsa no lugar de window: é daqui que a fábrica lê CC_SUPABASE, CC_FORCAR_FALLBACK
// e location, exatamente como cada wrapper lê do seu próprio `root`.
function raizFalsa(resposta, log) {
  return {
    CC_SUPABASE: { obterClienteEsm: async () => dubleCliente(resposta, log) },
    location: { search: "" },
  };
}

const SEED = [{ nome: "do seed", ordem: 1, db_id: null }];
function config(raiz, extra) {
  return Object.assign({
    nome: "db-teste",
    raiz: raiz,
    tabela: "tabela_de_teste",
    ordem: "ordem",
    linhaPara: (r) => ({ nome: r.nome, ordem: r.ordem, db_id: r.id }),
    paraLinha: (o) => ({ nome: o.nome, ordem: o.ordem }),
    seed: () => SEED.slice(),
    avisoFalha: "db-teste: falha ao carregar (esperado neste teste)",
  }, extra || {});
}

(async function () {
  // --- leitura feliz: monta a consulta certa e mapeia com linhaPara ---
  {
    const log = [];
    const raiz = raizFalsa({ data: [{ id: "u1", nome: "Do banco", ordem: 3 }], error: null }, log);
    const api = BASE.criarWrapper(config(raiz));
    const r = await api.carregar();
    checa("TABELA é a configurada", api.TABELA === "tabela_de_teste");
    checa("carregar() devolve a lista do banco mapeada", r.lista.length === 1 && r.lista[0].db_id === "u1" && r.lista[0].nome === "Do banco");
    checa("carregar() marca usandoFallback:false", r.usandoFallback === false && r.motivoFallback === null);
    checa("consulta filtra deleted_at nulo", log.some((c) => c[0] === "is" && c[1] === "deleted_at" && c[2] === null));
    checa("consulta ordena pela coluna configurada, ascendente", log.some((c) => c[0] === "order" && c[1] === "ordem" && c[2] === true));
    checa("usandoFallback() reflete a última carga", api.usandoFallback() === false);
  }

  // --- memoização: a segunda chamada não vai na rede; {recarregar:true} vai ---
  {
    const log = [];
    const raiz = raizFalsa({ data: [{ id: "u1", nome: "A", ordem: 1 }], error: null }, log);
    const api = BASE.criarWrapper(config(raiz));
    await api.carregar();
    await api.carregar();
    const idas = log.filter((c) => c[0] === "from").length;
    checa("segunda carregar() reaproveita a promessa (1 ida só)", idas === 1);
    await api.carregar({ recarregar: true });
    checa("carregar({recarregar:true}) vai de novo na rede", log.filter((c) => c[0] === "from").length === 2);
  }

  // --- erro do banco: cai pro seed, com o motivo real ---
  {
    const log = [];
    const raiz = raizFalsa({ data: null, error: { message: "boom" } }, log);
    const api = BASE.criarWrapper(config(raiz));
    const r = await api.carregar();
    checa("erro do banco cai pro seed local", r.lista.length === 1 && r.lista[0].nome === "do seed");
    checa("erro do banco marca usandoFallback:true com o motivo", r.usandoFallback === true && r.motivoFallback === "boom");
  }

  // --- sem js/supabase.js carregado: mensagem própria, ainda cai pro seed ---
  {
    const api = BASE.criarWrapper(config({ location: { search: "" } }));
    const r = await api.carregar();
    checa("sem CC_SUPABASE cai pro seed com mensagem própria", r.usandoFallback === true && r.motivoFallback === "js/supabase.js não carregado.");
  }

  // --- sem seed configurado (junções da Camada 1): lista vazia, não quebra ---
  {
    const log = [];
    const raiz = raizFalsa({ data: null, error: { message: "sem rede" } }, log);
    const api = BASE.criarWrapper(config(raiz, { seed: null, ordem: null }));
    const r = await api.carregar();
    checa("sem seed, o fallback é lista vazia", Array.isArray(r.lista) && r.lista.length === 0 && r.usandoFallback === true);
    checa("ordem:null não encadeia .order()", !log.some((c) => c[0] === "order"));
  }

  // --- ordem com mais de uma coluna (db-agenda: ciclo, canal) ---
  {
    const log = [];
    const raiz = raizFalsa({ data: [], error: null }, log);
    const api = BASE.criarWrapper(config(raiz, { ordem: ["ciclo", "canal"] }));
    await api.carregar();
    const ords = log.filter((c) => c[0] === "order");
    checa("ordem em lista vira dois .order() na ordem dada", ords.length === 2 && ords[0][1] === "ciclo" && ords[1][1] === "canal");
  }
  {
    const log = [];
    const raiz = raizFalsa({ data: [], error: null }, log);
    const api = BASE.criarWrapper(config(raiz, { ordem: [{ coluna: "criado_em", ascendente: false }] }));
    await api.carregar();
    checa("ordem descendente é respeitada", log.some((c) => c[0] === "order" && c[1] === "criado_em" && c[2] === false));
  }

  // --- hook aposBuscar (db-plano e os vínculos golden): roda só quando veio da rede ---
  {
    const log = [];
    const raiz = raizFalsa({ data: [{ id: "u1", nome: "A", ordem: 1 }], error: null }, log);
    const api = BASE.criarWrapper(config(raiz, {
      aposBuscar: async (lista) => { lista.forEach((x) => { x.enriquecido = true; }); },
    }));
    const r = await api.carregar();
    checa("aposBuscar enriquece a lista vinda da rede", r.lista[0].enriquecido === true);

    const raiz2 = raizFalsa({ data: null, error: { message: "x" } }, []);
    const api2 = BASE.criarWrapper(config(raiz2, { aposBuscar: async () => { throw new Error("não deveria rodar"); } }));
    const r2 = await api2.carregar();
    checa("aposBuscar não roda no caminho do seed", r2.lista[0].nome === "do seed" && r2.lista[0].enriquecido === undefined);
  }

  // --- escrita: updated_by, eq("id"), e o formato de cada uma ---
  {
    const log = [];
    const raiz = raizFalsa({ data: { id: "u9", nome: "Depois", ordem: 2 }, error: null }, log);
    const api = BASE.criarWrapper(config(raiz));

    const salvo = await api.salvar("u9", { nome: "Depois" }, "jose");
    checa("salvar() devolve a linha mapeada por linhaPara", salvo.db_id === "u9" && salvo.nome === "Depois");
    const upd = log.find((c) => c[0] === "update");
    checa("salvar() acrescenta updated_by ao patch", upd[1].updated_by === "jose" && upd[1].nome === "Depois");
    checa("salvar() filtra por id", log.some((c) => c[0] === "eq" && c[1] === "id" && c[2] === "u9"));

    log.length = 0;
    const criado = await api.criar({ nome: "Novo", ordem: 4 }, null);
    const ins = log.find((c) => c[0] === "insert");
    checa("criar() usa paraLinha e updated_by null quando não há usuário", ins[1].nome === "Novo" && ins[1].ordem === 4 && ins[1].updated_by === null);
    checa("criar() devolve a linha mapeada", criado.db_id === "u9");

    log.length = 0;
    await api.removerSoft("u9", "jose");
    const soft = log.find((c) => c[0] === "update");
    checa("removerSoft() grava deleted_at e updated_by", typeof soft[1].deleted_at === "string" && soft[1].updated_by === "jose");
    checa("removerSoft() é update, não delete", !log.some((c) => c[0] === "insert"));
  }

  // --- erro na escrita sobe (não vira fallback silencioso) ---
  {
    const raiz = raizFalsa({ data: null, error: { message: "permission denied" } }, []);
    const api = BASE.criarWrapper(config(raiz));
    let subiu = false;
    try { await api.salvar("u1", { nome: "x" }, "jose"); } catch (e) { subiu = e && e.message === "permission denied"; }
    checa("erro de escrita sobe pro chamador", subiu);
  }

  // --- criar() sem paraLinha configurado: erro explicativo, não TypeError ---
  {
    const raiz = raizFalsa({ data: {}, error: null }, []);
    const api = BASE.criarWrapper(config(raiz, { paraLinha: null }));
    let msg = "";
    try { await api.criar({ nome: "x" }); } catch (e) { msg = e.message; }
    checa("criar() sem paraLinha explica o que falta", msg.indexOf("paraLinha") !== -1);
  }

  // --- modo de teste: CC_FORCAR_FALLBACK ---
  {
    const log = [];
    const raiz = raizFalsa({ data: [{ id: "u1", nome: "A", ordem: 1 }], error: null }, log);
    raiz.CC_FORCAR_FALLBACK = true;
    const api = BASE.criarWrapper(config(raiz));
    const r = await api.carregar();
    checa("CC_FORCAR_FALLBACK devolve o seed sem tentar rede", r.lista[0].nome === "do seed" && !log.some((c) => c[0] === "from"));
    checa("motivoFallback do modo de teste é o texto de sempre", r.motivoFallback === BASE.MOTIVO_MODO_TESTE && r.motivoFallback === "modo de teste (semrede) — sem tentar rede");

    for (const [rotulo, fn] of [["salvar", () => api.salvar("u1", {}, "jose")], ["criar", () => api.criar({ nome: "x" }, "jose")], ["removerSoft", () => api.removerSoft("u1", "jose")]]) {
      let msg = "";
      try { await fn(); } catch (e) { msg = e.message; }
      checa("modo de teste bloqueia " + rotulo + "()", msg === BASE.ERRO_ESCRITA_EM_TESTE);
    }
    checa("nenhuma escrita chegou no dublê em modo de teste", !log.some((c) => c[0] === "update" || c[0] === "insert"));
  }

  // --- modo de teste: ?semrede=1 na URL ---
  {
    const log = [];
    const raiz = raizFalsa({ data: [], error: null }, log);
    raiz.location = { search: "?semrede=1&outro=2" };
    const api = BASE.criarWrapper(config(raiz));
    const r = await api.carregar();
    checa("?semrede=1 força o fallback", r.usandoFallback === true && !log.some((c) => c[0] === "from"));
    checa("forcarFallback() lê a URL", BASE.forcarFallback(raiz) === true);
    checa("sem ?semrede a URL não força nada", BASE.forcarFallback({ location: { search: "?x=1" } }) === false);
    checa("raiz sem location não quebra forcarFallback()", BASE.forcarFallback({}) === false);
  }

  // --- carregar({forcar:true}) sem estar em modo de teste ---
  {
    const log = [];
    const raiz = raizFalsa({ data: [{ id: "u1", nome: "A", ordem: 1 }], error: null }, log);
    const api = BASE.criarWrapper(config(raiz));
    const r = await api.carregar({ forcar: true });
    checa("carregar({forcar:true}) devolve o seed marcado como fallback", r.usandoFallback === true && r.lista[0].nome === "do seed");
    await api.salvar("u1", { nome: "x" }, "jose");
    checa("escrita segue liberada fora do modo de teste", log.some((c) => c[0] === "update"));
  }

  // --- configuração incompleta falha cedo, com mensagem ---
  {
    let m1 = "", m2 = "";
    try { BASE.criarWrapper({ linhaPara: () => ({}) }); } catch (e) { m1 = e.message; }
    try { BASE.criarWrapper({ tabela: "t" }); } catch (e) { m2 = e.message; }
    checa("criarWrapper sem tabela explica o que falta", m1.indexOf("tabela") !== -1);
    checa("criarWrapper sem linhaPara explica o que falta", m2.indexOf("linhaPara") !== -1);
  }

  // --- a fábrica não muda nenhum wrapper: os 13 seguem como estão (item D4.2/D4.3) ---
  {
    const fs = require("fs");
    const nucleos = fs.readFileSync(path.join(__dirname, "..", "js", "db-nucleos.js"), "utf8");
    checa("D4.1 não migrou wrapper nenhum (db-nucleos.js segue autônomo)", nucleos.indexOf("DB_BASE") === -1);
  }

  if (erros) { console.error("testar_db_base: " + erros + " erro(s)"); process.exit(1); }
  console.log("testar_db_base OK: fábrica js/db-base.js com o mesmo comportamento dos wrappers de hoje");
})().catch((e) => { console.error("testar_db_base: erro inesperado", e); process.exit(1); });
