const C = require("../js/calc.js");
const fs = require("fs");
function db(nome) {
  const t = fs.readFileSync("data/" + nome, "utf8");
  const seg = t.split("window.DB.").pop();          // pega a atribuição real (2ª linha)
  const json = seg.slice(seg.indexOf("=") + 1).trim().replace(/;\s*$/, "");
  return JSON.parse(json);
}
const plano = db("plano.js");
const hoje = "2026-08-11";
const k = C.kpis(plano, hoje);
console.log("KPIs:", JSON.stringify(k));
if (k.total !== 47) throw new Error("total != 47");
if (C.somaDias("2026-08-11", 7) !== "2026-08-18") throw new Error("somaDias");
if (C.fmtBR("2026-08-14") !== "14/08") throw new Error("fmtBR");
const carga = C.cargaPorDia(plano);
const c14 = carga.find((c) => c.iso === "2026-08-14");
console.log("Carga 14/08:", c14 ? c14.ids.join(", ") : "—");
if (!c14 || c14.carga < 3) throw new Error("14/08 deveria concentrar >=3 entregas");
const nos = db("nos.js").nos;
console.log("Estados dos nós:", nos.map((n) => n.no + ":" + C.estadoNo(n, plano, hoje)).join(" "));

// item 2.3 — frase de contexto do Dashboard: nosCriticos conta "risco" (venceu sem
// concluir, nós 1 e 2 nesta data de referência) + "hoje" (nenhum nesta data) = 2.
const resumo = C.resumoUrgencia(plano, nos, hoje);
console.log("Resumo de urgência:", JSON.stringify(resumo));
if (resumo.atrasadas !== k.atrasadas) throw new Error("resumoUrgencia.atrasadas deveria bater com C.kpis().atrasadas");
if (resumo.nosCriticos !== 2) throw new Error("resumoUrgencia.nosCriticos esperado 2 (nós 1 e 2 em risco em " + hoje + ")");
if (resumo.diasCargaConcentrada < 1) throw new Error("resumoUrgencia.diasCargaConcentrada deveria contar pelo menos o dia 14/08");

// "Dashboard orientado à decisão" — comparadorAtrasadas: nó crítico primeiro (★ Nó N,
// a.cc.tipo==="no"), dentro de cada grupo mais antiga primeiro (prazo_iso asc). Confere
// contra as atrasadas reais de hoje="2026-08-11" (mesmas 7 de k.atrasadas acima).
const atrasadasOrdenadas = plano.filter((a) => C.ehAtrasada(a, hoje)).sort(C.comparadorAtrasadas);
const primeiraNaoCritica = atrasadasOrdenadas.findIndex((a) => !(a.cc && a.cc.tipo === "no"));
if (primeiraNaoCritica !== -1) {
  const depoisTemCritica = atrasadasOrdenadas.slice(primeiraNaoCritica).some((a) => a.cc && a.cc.tipo === "no");
  if (depoisTemCritica) throw new Error("comparadorAtrasadas: achou ação de nó crítico depois de uma não-crítica");
}
for (let i = 1; i < atrasadasOrdenadas.length; i++) {
  const anterior = atrasadasOrdenadas[i - 1], atual = atrasadasOrdenadas[i];
  const mesmoGrupo = !!(anterior.cc && anterior.cc.tipo === "no") === !!(atual.cc && atual.cc.tipo === "no");
  if (mesmoGrupo && (anterior.prazo_iso || "") > (atual.prazo_iso || "")) {
    throw new Error("comparadorAtrasadas: dentro do mesmo grupo, " + anterior.id + " (" + anterior.prazo_iso + ") deveria vir depois de " + atual.id + " (" + atual.prazo_iso + ")");
  }
}
console.log("Atrasadas ordenadas (crítico primeiro):", atrasadasOrdenadas.map((a) => a.id + (a.cc && a.cc.tipo === "no" ? "★" : "")).join(", "));

console.log("F2 OK");
