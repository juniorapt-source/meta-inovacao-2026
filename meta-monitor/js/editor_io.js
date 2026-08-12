/* Serialização dos arquivos de dados no formato canônico do repositório. Puro, testável em node. */
(function (root) {
  "use strict";
  const IO = {};
  IO.serializar = function (chave, obj) {
    return "window.DB = window.DB || {};\nwindow.DB." + chave + " = " + JSON.stringify(obj, null, 1) + ";\n";
  };
  IO.parsear = function (texto) {
    const seg = texto.split("window.DB.").pop();
    return JSON.parse(seg.slice(seg.indexOf("=") + 1).trim().replace(/;\s*$/, ""));
  };
  if (typeof module !== "undefined" && module.exports) module.exports = IO;
  else root.EDITOR_IO = IO;
})(this);
