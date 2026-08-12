/* Teste F6: para cada arquivo de dados, parsear -> serializar -> re-parsear e comparar. */
const fs = require("fs"), path = require("path");
const IO = require(path.join(__dirname, "..", "js", "editor_io.js"));
const DATA = path.join(__dirname, "..", "data");
let erros = 0;
for (const f of fs.readdirSync(DATA).filter(x => x.endsWith(".js"))) {
  const texto = fs.readFileSync(path.join(DATA, f), "utf8");
  const chave = texto.match(/window\.DB\.([A-Za-z_]+)\s*=/)[1];
  const obj = IO.parsear(texto);
  const serializado = IO.serializar(chave, obj);
  if (!serializado.startsWith("window.DB = window.DB || {};\nwindow.DB." + chave + " = ")) {
    console.error("FALHA cabeçalho:", f); erros++; continue;
  }
  const re = IO.parsear(serializado);
  if (JSON.stringify(re) !== JSON.stringify(obj)) { console.error("FALHA roundtrip:", f); erros++; }
}
if (erros) { console.error("testar_editor: " + erros + " erro(s)"); process.exit(1); }
console.log("testar_editor OK: roundtrip integro em todos os arquivos de data/");
