/* Teste da frente "Fluxo de dados" (js/db-fluxo.js + data/fluxo_dados.js), puro/sem navegador
 * e sem rede: integridade do snapshot, vocabulário dos enums, regra de negócio
 * "toda rota com status ok precisa de alvo_definido = true" (AVISO, não derruba a suíte —
 * é qualidade de dado, não bug de código), derivados puros e mensagem de erro de permissão. */
const path = require("path");
const root = path.join(__dirname, "..");

global.window = global; // data/*.js e os módulos publicam em window/this
global.window.DB = {};
global.window.CC_FORCAR_FALLBACK = true;
require(path.join(root, "js", "db-base.js"));
require(path.join(root, "data", "fluxo_dados.js"));
const CC = require(path.join(root, "js", "supabase.js"));
global.window.CC_SUPABASE = CC;
// db-fluxo.js é `(function(root){...})(this)`: em Node `this` é module.exports, então ele só
// consegue publicar em globalThis.DB_FLUXO (mesma nota de js/db-base.js).
require(path.join(root, "js", "db-fluxo.js"));
const F = globalThis.DB_FLUXO;
require(path.join(root, "js", "fluxo-form.js"));
const FF = global.window.FLUXO_FORM;

let erros = 0, avisos = 0;
function checa(nome, cond) { if (cond) console.log("  ok:", nome); else { console.error("  FALHA:", nome); erros++; } }
function avisa(nome, cond) { if (cond) console.log("  ok:", nome); else { console.warn("  AVISO:", nome); avisos++; } }

const S = window.DB.fluxo_dados;
checa("snapshot existe", !!S);
checa("7 sistemas, 2 rotas, 1 painel, 5 encaminhamentos (snapshot de 16/10/2026)",
  S.sistemas.length === 7 && S.rotas.length === 2 && S.paineis.length === 1 && S.encaminhamentos.length === 5);

const ids = (l) => new Set(l.map((x) => x.id));
const sis = ids(S.sistemas), rotas = ids(S.rotas), pain = ids(S.paineis), encs = ids(S.encaminhamentos);

S.rotas.forEach((r) => {
  checa("rota " + r.id.slice(0, 8) + ": enums válidos",
    F.TIPOS_DADO.includes(r.tipo_dado) && F.STATUS.includes(r.status) && F.MECANISMOS.includes(r.mecanismo_hoje) && F.MECANISMOS.includes(r.mecanismo_alvo)
    && (r.chega_completo == null || F.CHEGA_COMPLETO.includes(r.chega_completo)) && (r.existe_outra_fonte == null || ["sim", "nao", "nao_sabe"].includes(r.existe_outra_fonte)));
  ["sistema_origem_id", "sistema_destino_hoje_id", "sistema_destino_alvo_id", "golden_hoje_id", "golden_alvo_id"].forEach((k) => {
    checa("rota " + r.id.slice(0, 8) + "." + k + " aponta pra sistema existente", r[k] == null || sis.has(r[k]));
  });
});
S.rotas.forEach((r) => checa("rota " + r.id.slice(0, 8) + ": outras_fontes é lista", Array.isArray(r.outras_fontes)));
S.rota_destinos.forEach((d) => checa("rota_destinos aponta pra rota e sistema existentes, momento válido", rotas.has(d.rota_id) && sis.has(d.sistema_id) && F.MOMENTOS.includes(d.momento)));
checa("snapshot: 3 linhas em rota_destinos (patch3 copia os 3 destinos do Prêmio)", S.rota_destinos.length === 3);
S.paineis.forEach((p) => {
  checa("painel: sem indicador/ferramenta no snapshot, com link_painel (vazio)", !("indicador" in p) && !("ferramenta" in p) && p.link_painel === null);
  checa("painel: status válido", F.STATUS.includes(p.status));
  checa("painel: fontes apontam pra sistemas existentes", [p.sistema_fonte_hoje_id, p.sistema_fonte_alvo_id].every((i) => i == null || sis.has(i)));
});
S.painel_rotas.forEach((l) => checa("painel_rotas liga painel e rota existentes", pain.has(l.painel_id) && rotas.has(l.rota_id)));
S.encaminhamentos.forEach((e) => {
  checa("encaminhamento '" + e.acao.slice(0, 30) + "': rota e/ou painel", (e.rota_id || e.painel_id) && (!e.rota_id || rotas.has(e.rota_id)) && (!e.painel_id || pain.has(e.painel_id)));
  checa("encaminhamento: status válido", F.STATUS_ENC.includes(e.status));
  checa("encaminhamento: dependência existe", !e.depende_de_id || encs.has(e.depende_de_id));
});

// regra de negócio — aviso, exit 0
const semAlvo = F.rotasOkSemAlvo(S);
avisa("toda rota com status ok tem alvo_definido = true" + (semAlvo.length ? " (" + semAlvo.length + " violam: " + semAlvo.map((r) => r.iniciativa + "/" + r.tipo_dado).join(", ") + ")" : ""), semAlvo.length === 0);
checa("rotasOkSemAlvo detecta o caso ruim (fixture)", F.rotasOkSemAlvo({ rotas_lacunas: [{ status: "ok", alvo_definido: false }, { status: "ok", alvo_definido: true }, { status: "andamento", alvo_definido: false }] }).length === 1);

// derivados puros
checa("piorStatus: entendimento vence", F.piorStatus(["ok", "entendimento", "andamento"]) === "entendimento");
checa("piorStatus: nao_se_aplica não puxa pra baixo", F.piorStatus(["ok", "nao_se_aplica"]) === "ok");
checa("piorStatus: lista vazia = null", F.piorStatus([]) === null);
const porId = { a: { status: "a_fazer" }, b: { status: "feito" } };
checa("encaminhamento travado enquanto a dependência não está feita", F.encaminhamentoTravado({ depende_de_id: "a" }, porId));
checa("encaminhamento liberado quando a dependência está feita", !F.encaminhamentoTravado({ depende_de_id: "b" }, porId));

// mensagem de erro de permissão lembra do GRANT
const m = F.mensagemErro({ status: 401, tabela: "fluxo_dados_rotas", operacao: "UPDATE" });
checa("erro 401 menciona GRANT e a tabela", /GRANT/.test(m) && /fluxo_dados_rotas/.test(m));
checa("erro 42501 também", /GRANT/.test(F.mensagemErro({ code: "42501", message: "permission denied for table x" })));
checa("PGRST205 explica o cache de schema", /cache de schema/.test(F.mensagemErro({ code: "PGRST205", tabela: "fluxo_dados_rotas" })));


// ---------------------------------------------------------------- v0.32.0 (puros)
// Ajuste 1 — lista de fontes
checa("fontes: tira branco, espaços e duplicados exatos", JSON.stringify(F.normalizarFontes([" A ", "", "A", "B", "  ", "a"])) === JSON.stringify(["A", "B", "a"]));
checa("fontes: vazio e nulo viram lista vazia", F.normalizarFontes([]).length === 0 && F.normalizarFontes(null).length === 0);
checa("fontes: ida e volta preserva a ordem", JSON.stringify(F.normalizarFontes(F.normalizarFontes(["x", "y", "z"]))) === JSON.stringify(["x", "y", "z"]));
checa("fontes: remover um item deixa os outros", JSON.stringify(F.normalizarFontes(["x", "y", "z"].filter((i) => i !== "y"))) === JSON.stringify(["x", "z"]));
checa("leitura: lista preenchida mostra os itens", F.resumoOutrasFontes({ outras_fontes: ["Planilha A"], existe_outra_fonte: "nao" }).itens[0] === "Planilha A");
checa("leitura: legado 'sim' + lista vazia = aviso 'Há outra fonte, ainda não informada'", F.resumoOutrasFontes({ outras_fontes: [], existe_outra_fonte: "sim" }).aviso === "Há outra fonte, ainda não informada");
checa("leitura: legado 'nao' + lista vazia = 'Sem outra fonte'", F.resumoOutrasFontes({ outras_fontes: [], existe_outra_fonte: "nao" }).aviso === "Sem outra fonte");
checa("leitura: nao_sabe + vazio = nenhuma informada, sem inventar", F.resumoOutrasFontes({ outras_fontes: [], existe_outra_fonte: "nao_sabe" }).aviso === "Nenhuma outra fonte informada");

// Ajuste 2 — destinos múltiplos: diff e conjuntos
const d1 = F.diffDestinos([{ sistema_id: "a", momento: "hoje" }, { sistema_id: "b", momento: "hoje" }], [{ sistema_id: "b", momento: "hoje" }, { sistema_id: "c", momento: "hoje" }, { sistema_id: "c", momento: "hoje" }]);
checa("diff: insere só o novo e remove só o tirado", d1.inserir.length === 1 && d1.inserir[0].sistema_id === "c" && d1.remover.length === 1 && d1.remover[0].sistema_id === "a");
const d2 = F.diffDestinos([{ sistema_id: "a", momento: "hoje" }], [{ sistema_id: "a", momento: "hoje" }]);
checa("diff: nada mudou = nada a fazer (não apaga e reinsere)", d2.inserir.length === 0 && d2.remover.length === 0);
const d3 = F.diffDestinos([{ sistema_id: "a", momento: "hoje" }], [{ sistema_id: "a", momento: "alvo" }]);
checa("diff: mesmo sistema em outro momento = insere alvo e remove hoje", d3.inserir[0].momento === "alvo" && d3.remover[0].momento === "hoje");
checa("lacuna de destino compara conjuntos (ordem e repetição não contam)", F.lacunaDestino(["a", "b"], ["b", "a", "a"]) === false);
checa("lacuna de destino: conjuntos diferentes", F.lacunaDestino(["a"], ["a", "b"]) === true && F.lacunaDestino([], ["a"]) === true && F.lacunaDestino([], []) === false);
checa("nomesDestinos lê rota_destinos + sistemas", F.nomesDestinos(S, S.rotas[0].id, "hoje").join() === "Foco (Salesforce)");

// Ajuste 4/5 — formulário de painel
const chavesPainel = FF.CAMPOS.paineis.map((c) => c.k);
checa("form de painel: sem indicador e sem ferramenta", !chavesPainel.includes("indicador") && !chavesPainel.includes("ferramenta"));
checa("form de painel: tem link_painel, no lugar onde estavam", chavesPainel.indexOf("link_painel") === chavesPainel.indexOf("iniciativa") + 1);
checa("link: aceita https", F.validarLinkPainel("https://app.powerbi.com/x?y=1").ok === true);
checa("link: aceita http e faz trim", F.validarLinkPainel("  http://a.com/p  ").valor === "http://a.com/p");
checa("link: vazio é permitido (opcional) e vira null", F.validarLinkPainel("   ").ok === true && F.validarLinkPainel("").valor === null);
checa("link: recusa javascript:", F.validarLinkPainel("javascript:alert(1)").ok === false);
checa("link: recusa texto sem esquema", F.validarLinkPainel("app.powerbi.com/x").ok === false);
checa("link: recusa ftp:, data: e espaço no meio", !F.validarLinkPainel("ftp://a.com").ok && !F.validarLinkPainel("data:text/html,x").ok && !F.validarLinkPainel("https://a.com/a b").ok);
checa("link: 'https://' sozinho é recusado", F.validarLinkPainel("https://").ok === false);
checa("linkSeguro devolve null para esquema perigoso", F.linkSeguro("JavaScript:alert(1)") === null && F.linkSeguro("https://a.com") === "https://a.com");
checa("validar painel: link inválido vira mensagem", FF.validar("paineis", { nome: "x", status: "entendimento", link_painel: "javascript:1" }, []).some((m) => /http/.test(m)));

// Ajuste 3 — validações da criação pela página (mesmas do editor: compartilhadas)
const rotaOk = { iniciativa: "Prêmio Startups", tipo_dado: "cliente", descricao: "x", mecanismo_hoje: "a_definir", mecanismo_alvo: "a_definir", chega_completo: "nao_sabe", status: "entendimento" };
checa("rota: completa passa", FF.validar("rotas", rotaOk, []).length === 0);
checa("rota: sem descricao é recusada", FF.validar("rotas", Object.assign({}, rotaOk, { descricao: null }), []).some((m) => /Descrição/.test(m)));
checa("rota: sem tipo_dado e sem iniciativa são recusadas", FF.validar("rotas", Object.assign({}, rotaOk, { tipo_dado: null, iniciativa: null }), [])[0].match(/Tipo de dado/) && FF.validar("rotas", Object.assign({}, rotaOk, { iniciativa: null }), []).length === 1);
const padrao = (sec, k) => FF.CAMPOS[sec].find((c) => c.k === k).padrao;
checa("rota: padrões chega_completo=nao_sabe e mecanismos=a_definir", padrao("rotas", "chega_completo") === "nao_sabe" && padrao("rotas", "mecanismo_hoje") === "a_definir" && padrao("rotas", "mecanismo_alvo") === "a_definir");
const chavesRota = FF.CAMPOS.rotas.map((c) => c.k);
checa("form de rota: sem existe_outra_fonte e sem sistema_destino_*_id", !["existe_outra_fonte", "sistema_destino_hoje_id", "sistema_destino_alvo_id"].some((k) => chavesRota.includes(k)));
checa("encaminhamento: exige acao e uma ligação (rota e/ou painel)", FF.validar("encaminhamentos", { acao: null, rota_id: null, painel_id: null, status: "a_fazer" }, []).length === 2
  && FF.validar("encaminhamentos", { acao: "x", rota_id: "r", painel_id: null, status: "a_fazer" }, []).length === 0
  && FF.validar("encaminhamentos", { acao: "x", rota_id: null, painel_id: "p", status: "a_fazer" }, []).length === 0);
checa("encaminhamento: status começa em a_fazer", padrao("encaminhamentos", "status") === "a_fazer");

// fallback offline + escrita bloqueada em modo de teste
(async () => {
  const r = await F.carregar();
  checa("modo de teste devolve o snapshot com usandoFallback", r.usandoFallback === true && r.dados.rotas.length === 2 && r.dados.matriz.length === 3);
  let bloqueou = false;
  try { await F.criar("rotas", { iniciativa: "x" }); } catch (e) { bloqueou = /modo de teste/.test(e.message); }
  checa("escrita bloqueada em modo de teste", bloqueou);
  let recusou = false;
  try { await F.criar("painel_rotas", {}); } catch (e) { recusou = true; }
  checa("painel_rotas não é editável por criar/salvar (só vincular/desvincular)", recusou);

  // ---- escrita contra um cliente falso (nada de rede): o que é enviado e em que ordem ----
  window.CC_FORCAR_FALLBACK = false;
  const log = []; let banco = []; let falharEm = null;
  const falso = {
    from(tabela) {
      const q = { tabela: tabela, op: "select", filtros: {}, corpo: null };
      const b = {
        select() { return b; },
        insert(c) { q.op = "insert"; q.corpo = c; return b; },
        update(c) { q.op = "update"; q.corpo = c; return b; },
        delete() { q.op = "delete"; return b; },
        eq(k, v) { q.filtros[k] = v; return b; },
        single() { q.unico = true; return b; },
        then(res, rej) {
          log.push({ tabela: q.tabela, op: q.op, corpo: q.corpo, filtros: q.filtros });
          if (falharEm && falharEm.tabela === q.tabela && falharEm.op === q.op) return Promise.resolve({ data: null, error: { code: "42501", message: "permission denied", status: 403 } }).then(res, rej);
          let data = null;
          if (q.tabela === "fluxo_dados_rota_destinos" && q.op === "select") data = banco.filter((d) => d.rota_id === q.filtros.rota_id);
          else if (q.op === "insert" || q.op === "update") data = q.unico ? Object.assign({ id: "rota-nova" }, q.corpo) : null;
          return Promise.resolve({ data: data, error: null }).then(res, rej);
        },
      };
      return b;
    },
  };
  CC.obterClienteEsm = async () => falso;

  banco = [{ rota_id: "R", sistema_id: "a", momento: "hoje" }, { rota_id: "R", sistema_id: "b", momento: "hoje" }];
  log.length = 0;
  await F.sincronizarDestinos("R", [{ sistema_id: "b", momento: "hoje" }, { sistema_id: "c", momento: "hoje" }]);
  const ops = log.map((l) => l.op + ":" + (l.filtros.sistema_id || (l.corpo && l.corpo[0] && l.corpo[0].sistema_id) || ""));
  checa("sincronizar: lê o banco, insere só o novo e deleta só o removido (sem 'apagar tudo')", JSON.stringify(ops) === JSON.stringify(["select:", "insert:c", "delete:a"]));
  checa("sincronizar: DELETE filtra rota, sistema e momento", log[2].filtros.rota_id === "R" && log[2].filtros.sistema_id === "a" && log[2].filtros.momento === "hoje");
  log.length = 0;
  await F.sincronizarDestinos("R", [{ sistema_id: "a", momento: "hoje" }, { sistema_id: "b", momento: "hoje" }]);
  checa("sincronizar: sem diferença = só a leitura", log.length === 1 && log[0].op === "select");

  // painel: indicador/ferramenta nunca são enviados (editar painel antigo não os apaga)
  log.length = 0;
  await F.salvar("paineis", "P", { nome: "Painel", link_painel: "https://a.com", status: "ok" });
  checa("salvar painel: corpo sem indicador e sem ferramenta, com link_painel", !("indicador" in log[0].corpo) && !("ferramenta" in log[0].corpo) && log[0].corpo.link_painel === "https://a.com");

  // rota nova: INSERT devolve a linha (id) e SÓ DEPOIS os destinos; sem existe_outra_fonte nem sistema_destino_*
  log.length = 0; banco = [];
  const colRota = { campos: Object.assign({}, rotaOk, { outras_fontes: ["A", "B"] }), destinos: [{ sistema_id: "a", momento: "hoje" }, { sistema_id: "b", momento: "hoje" }] };
  const regNovo = await FF.gravar("rotas", null, colRota, { dados: S });
  checa("rota nova: primeiro INSERT da rota, depois select/insert dos destinos, com o id devolvido",
    log[0].tabela === "fluxo_dados_rotas" && log[0].op === "insert" && regNovo.id === "rota-nova" && log[1].op === "select" && log[2].tabela === "fluxo_dados_rota_destinos" && log[2].op === "insert"
    && log[2].corpo.length === 2 && log[2].corpo.every((d) => d.rota_id === "rota-nova"));
  checa("rota nova: corpo leva outras_fontes e não leva campos deprecados", JSON.stringify(log[0].corpo.outras_fontes) === '["A","B"]' && !("existe_outra_fonte" in log[0].corpo) && !("sistema_destino_hoje_id" in log[0].corpo));
  // lista vazia continua lista (não vira null)
  log.length = 0;
  await F.salvar("rotas", "R", { outras_fontes: [] });
  checa("salvar rota com fontes vazias envia [] (nenhuma outra fonte informada)", Array.isArray(log[0].corpo.outras_fontes) && log[0].corpo.outras_fontes.length === 0);

  // falha nos destinos depois da rota: erro volta com rotaId (a tela mantém o formulário aberto)
  falharEm = { tabela: "fluxo_dados_rota_destinos", op: "insert" }; log.length = 0;
  let err2 = null;
  try { await FF.gravar("rotas", null, colRota, { dados: S }); } catch (e) { err2 = e; }
  checa("falha nos destinos: erro carrega rotaId e a rota NÃO é reinserida", err2 && err2.rotaId === "rota-nova" && log.filter((l) => l.tabela === "fluxo_dados_rotas").length === 1);
  checa("falha nos destinos: mensagem de permissão amigável disponível", /Sem permissão/.test(CC.mensagemEscritaAmigavel(err2) || ""));
  falharEm = null;
  window.CC_FORCAR_FALLBACK = true;

  console.log(erros ? "\n" + erros + " falha(s)." : "\nOK" + (avisos ? " (" + avisos + " aviso(s))" : ""));
  process.exit(erros ? 1 : 0);
})();
