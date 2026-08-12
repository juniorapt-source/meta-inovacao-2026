/* Teste F6: para cada arquivo de dados, parsear -> serializar -> re-parsear e comparar.
   Cobre todos os blocos window.DB.x de cada arquivo (a maioria tem 1; data/urc.js tem 2). */
const fs = require("fs"), path = require("path");
const IO = require(path.join(__dirname, "..", "js", "editor_io.js"));
const DATA = path.join(__dirname, "..", "data");
let erros = 0;
for (const f of fs.readdirSync(DATA).filter(x => x.endsWith(".js"))) {
  const texto = fs.readFileSync(path.join(DATA, f), "utf8");
  const blocos = IO.parsearTodos(texto);
  const chaves = Object.keys(blocos);
  if (!chaves.length) { console.error("FALHA: nenhum bloco window.DB.x encontrado em", f); erros++; continue; }
  const serializado = IO.serializarMulti(chaves.map(c => [c, blocos[c]]));
  if (!serializado.startsWith("window.DB = window.DB || {};\n")) {
    console.error("FALHA cabeçalho:", f); erros++; continue;
  }
  const re = IO.parsearTodos(serializado);
  if (JSON.stringify(re) !== JSON.stringify(blocos)) { console.error("FALHA roundtrip:", f); erros++; }
}
if (erros) { console.error("testar_editor: " + erros + " erro(s)"); process.exit(1); }
console.log("testar_editor OK: roundtrip integro em todos os arquivos de data/");
