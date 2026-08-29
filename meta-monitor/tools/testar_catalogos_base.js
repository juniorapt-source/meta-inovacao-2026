/* Teste de aceite da Camada 0 (PLANO_EXECUCAO_GOLDEN_RECORD.md) — confere que os 3
 * seeds locais (data/nucleos.js, data/canais.js, data/coletivos.js) têm as
 * contagens certas (5/10/5) e que os 3 wrappers (js/db-nucleos.js, js/db-canais.js,
 * js/db-coletivos.js) carregam sem erro e exportam a API esperada. Não fala com o
 * Supabase (mesmo espírito de tools/testar_calc.js) — a contagem/RLS em produção é
 * conferida à mão no item 0.4 [humano].
 */
const fs = require("fs");
const path = require("path");

// item D4.2/D4.3: os wrappers migrados pedem a fábrica js/db-base.js. Em Node, `this` no
// topo de cada arquivo é o module.exports DAQUELE arquivo, então eles acham a fábrica por
// globalThis — que é o que este require publica. No navegador a ordem equivalente é a das
// tags <script> (db-base.js logo depois de supabase.js, antes dos db-*.js).
require(path.join(__dirname, "..", "js", "db-base.js"));

// mesma técnica de tools/testar_calc.js: os arquivos de data/ usam `window.DB...`,
// que não existe em Node — lê como texto e extrai o literal em vez de rodar o
// arquivo.
function db(nome) {
  const t = fs.readFileSync(path.join(__dirname, "..", "data", nome), "utf8");
  const seg = t.split("window.DB.").pop();
  const json = seg.slice(seg.indexOf("=") + 1).trim().replace(/;\s*$/, "");
  return JSON.parse(json);
}

const nucleos = db("nucleos.js");
console.log("Núcleos (seed local):", nucleos.length);
if (nucleos.length !== 5) throw new Error("data/nucleos.js deveria ter 5 núcleos, tem " + nucleos.length);

const canais = db("canais.js");
console.log("Canais (seed local):", canais.length);
if (canais.length !== 10) throw new Error("data/canais.js deveria ter 10 canais, tem " + canais.length);

const coletivos = db("coletivos.js");
console.log("Coletivos (seed local):", coletivos.length);
if (coletivos.length !== 5) throw new Error("data/coletivos.js deveria ter 5 coletivos, tem " + coletivos.length);

// wrappers: cada um é `(function (root) {...})(this)` — em Node, `this` no topo do
// módulo é module.exports, então requerer o arquivo já é o teste de "carrega sem
// erro"; o objeto exportado (DB_NUCLEOS/DB_CANAIS/DB_COLETIVOS) sai colado nele.
function carregouSemErro(nomeArquivo, chaveEsperada) {
  delete require.cache[require.resolve("../js/" + nomeArquivo)];
  const mod = require("../js/" + nomeArquivo);
  const api = mod[chaveEsperada];
  if (!api) throw new Error(nomeArquivo + " não exportou " + chaveEsperada);
  ["TABELA", "carregar", "salvar", "criar", "removerSoft"].forEach((fn) => {
    if (!(fn in api)) throw new Error(nomeArquivo + "." + chaveEsperada + " não tem " + fn);
  });
  console.log(nomeArquivo + ": ok (" + api.TABELA + ")");
}

carregouSemErro("db-nucleos.js", "DB_NUCLEOS");
carregouSemErro("db-canais.js", "DB_CANAIS");
carregouSemErro("db-coletivos.js", "DB_COLETIVOS");

console.log("Camada 0 — catálogos-base: seeds e wrappers OK.");
