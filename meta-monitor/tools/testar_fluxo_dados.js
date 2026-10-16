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
    && (r.chega_completo == null || F.CHEGA_COMPLETO.includes(r.chega_completo)) && (r.existe_outra_fonte == null || F.OUTRA_FONTE.includes(r.existe_outra_fonte)));
  ["sistema_origem_id", "sistema_destino_hoje_id", "sistema_destino_alvo_id", "golden_hoje_id", "golden_alvo_id"].forEach((k) => {
    checa("rota " + r.id.slice(0, 8) + "." + k + " aponta pra sistema existente", r[k] == null || sis.has(r[k]));
  });
});
S.paineis.forEach((p) => {
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
  console.log(erros ? "\n" + erros + " falha(s)." : "\nOK" + (avisos ? " (" + avisos + " aviso(s))" : ""));
  process.exit(erros ? 1 : 0);
})();
