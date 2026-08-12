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
console.log("F2 OK");
