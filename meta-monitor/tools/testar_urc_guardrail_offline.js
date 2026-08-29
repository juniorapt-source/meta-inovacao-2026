/* Guardrail da URC (item 4.4/5.9-1) conferido OFFLINE — item D4.3.
 *
 * tools/testar_guardrail_urc_supabase.js já cobre isso, mas só quando alcança o
 * Supabase de produção: sem rede ele faz skip com aviso (graceful-skip, de propósito).
 * E tools/testar_urc_editor_headless.js roda com ?semrede=1, onde a escrita está
 * bloqueada — ou seja, nenhum dos dois exercita a REGRA em si num ambiente sem rede.
 *
 * Este teste fecha essa janela sem depender de rede nenhuma: chama
 * DB_URC.criarResponsavel/salvarResponsavel direto e confere que a violação é barrada
 * ANTES de qualquer ida ao Supabase, que quem não é liderança passa do guardrail, e que
 * em modo de teste o bloqueio de escrita vem ANTES do guardrail (a ordem de sempre).
 *
 * Nasceu junto com a migração do js/db-urc.js pra fábrica js/db-base.js (item D4.3), que
 * é exatamente o tipo de mudança que poderia trocar essa ordem sem ninguém ver.
 */
const path = require("path");
require(path.join(__dirname, "..", "js", "db-base.js")); // publica a fábrica em globalThis
const mod = require(path.join(__dirname, "..", "js", "db-urc.js"));
const URC = mod.DB_URC;

let erros = 0;
function checa(nome, cond) {
  if (cond) { console.log("  ok:", nome); }
  else { console.error("  FALHA:", nome); erros++; }
}

const LIDERANCA = [{ nome: "Fulana Líder", pessoa_id: "p1" }];

(async function () {
  checa("DB_URC exporta a API completa", [
    "TABELA_LIDERANCA", "TABELA_CANAIS", "CANAIS_FIXOS", "carregar",
    "salvarLideranca", "criarLideranca", "removerLiderancaSoft",
    "salvarResponsavel", "criarResponsavel", "removerResponsavelSoft",
    "nomeEhLideranca", "MSG_GUARDRAIL_LIDERANCA",
  ].every((k) => k in URC));

  async function erroDe(fn) { try { await fn(); return ""; } catch (e) { return (e && e.message) || String(e); } }

  // --- fora do modo de teste: o guardrail barra antes de tentar rede ---
  const e1 = await erroDe(() => URC.criarResponsavel({ nome: "Fulana Líder", canal: "CNR" }, "jose", LIDERANCA));
  checa("criarResponsavel barra liderança (por nome)", e1.indexOf(URC.MSG_GUARDRAIL_LIDERANCA) !== -1);

  const e2 = await erroDe(() => URC.salvarResponsavel("x", { pessoa_id: "p1", nome: "Nome Curto" }, "jose", LIDERANCA));
  checa("salvarResponsavel barra liderança (por pessoa_id, mesmo com nome diferente)", e2.indexOf(URC.MSG_GUARDRAIL_LIDERANCA) !== -1);

  // quem não é liderança passa do guardrail — aqui a chamada segue e só falha por não
  // haver CC_SUPABASE neste processo, que é o comportamento de sempre da escrita.
  const e3 = await erroDe(() => URC.criarResponsavel({ nome: "Outra Pessoa", canal: "CNR" }, "jose", LIDERANCA));
  checa("não-liderança passa do guardrail", e3.indexOf(URC.MSG_GUARDRAIL_LIDERANCA) === -1 && e3.length > 0);

  checa("nomeEhLideranca compara por pessoa_id quando os dois lados têm FK",
    URC.nomeEhLideranca({ pessoa_id: "p1", nome: "qualquer" }, LIDERANCA) === true);
  checa("nomeEhLideranca cai pro nome quando falta pessoa_id de um lado",
    URC.nomeEhLideranca({ nome: "Fulana Líder" }, LIDERANCA) === true);
  checa("nomeEhLideranca não acusa quem não é liderança",
    URC.nomeEhLideranca({ pessoa_id: "p9", nome: "Outra Pessoa" }, LIDERANCA) === false);

  // --- modo de teste: bloqueio de escrita vem ANTES do guardrail ---
  mod.CC_FORCAR_FALLBACK = true; // `this` do módulo é a raiz que js/db-urc.js enxerga em Node
  const e4 = await erroDe(() => URC.criarResponsavel({ nome: "Fulana Líder", canal: "CNR" }, "jose", LIDERANCA));
  checa("em modo de teste, o bloqueio de escrita vem antes do guardrail", e4.indexOf("modo de teste") === 0);
  for (const [rotulo, fn] of [
    ["salvarLideranca", () => URC.salvarLideranca("x", {}, "jose")],
    ["criarLideranca", () => URC.criarLideranca({ nome: "x" }, "jose")],
    ["removerLiderancaSoft", () => URC.removerLiderancaSoft("x", "jose")],
    ["removerResponsavelSoft", () => URC.removerResponsavelSoft("x", "jose")],
  ]) {
    checa("modo de teste bloqueia " + rotulo, (await erroDe(fn)).indexOf("modo de teste") === 0);
  }

  // --- carregar() combinado continua com a forma de sempre ---
  const r = await URC.carregar();
  checa("carregar() devolve lideranca + canaisFlat + canais agrupado + aviso de fallback",
    ["lideranca", "canaisFlat", "canais", "usandoFallback", "motivoFallback"].every((k) => k in r));
  checa("canais agrupados são os 8 canais fixos, mesmo sem dado nenhum", r.canais.length === URC.CANAIS_FIXOS.length);
  checa("modo de teste marca usandoFallback", r.usandoFallback === true);

  if (erros) { console.error("testar_urc_guardrail_offline: " + erros + " erro(s)"); process.exit(1); }
  console.log("testar_urc_guardrail_offline OK: guardrail da URC íntegro sem depender de rede");
})().catch((e) => { console.error("testar_urc_guardrail_offline: erro inesperado", e); process.exit(1); });
