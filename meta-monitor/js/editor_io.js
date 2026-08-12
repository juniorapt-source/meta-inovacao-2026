/* Serialização dos arquivos de dados no formato canônico do repositório. Puro, testável em node. */
(function (root) {
  "use strict";
  const IO = {};

  IO.serializar = function (chave, obj) {
    return "window.DB = window.DB || {};\nwindow.DB." + chave + " = " + JSON.stringify(obj, null, 1) + ";\n";
  };

  /* alguns arquivos (ex.: data/urc.js) têm mais de uma atribuição window.DB.x = ...; no mesmo
     arquivo. serializarMulti escreve todas em ordem, com uma atribuição por bloco. */
  IO.serializarMulti = function (pares) {
    let out = "window.DB = window.DB || {};\n";
    pares.forEach(([chave, obj]) => {
      out += "\nwindow.DB." + chave + " = " + JSON.stringify(obj, null, 1) + ";\n";
    });
    return out;
  };

  /* extrai TODAS as atribuições window.DB.<chave> = <JSON>; de um arquivo, na ordem em que
     aparecem, tolerando ";" dentro de strings (não corta ingenuamente no primeiro ";"). */
  IO.parsearTodos = function (texto) {
    const resultado = {};
    const re = /window\.DB\.(\w+)\s*=\s*/g;
    let m;
    while ((m = re.exec(texto))) {
      const chave = m[1];
      let i = re.lastIndex;
      while (i < texto.length && /\s/.test(texto[i])) i++;
      if (texto[i] !== "{" && texto[i] !== "[") continue; // ex.: "window.DB = window.DB || {}"
      let depth = 0, inStr = false, escape = false, j = i;
      for (; j < texto.length; j++) {
        const c = texto[j];
        if (inStr) {
          if (escape) escape = false;
          else if (c === "\\") escape = true;
          else if (c === '"') inStr = false;
        } else {
          if (c === '"') inStr = true;
          else if (c === "{" || c === "[") depth++;
          else if (c === "}" || c === "]") { depth--; if (depth === 0) { j++; break; } }
        }
      }
      resultado[chave] = JSON.parse(texto.slice(i, j));
      re.lastIndex = j;
    }
    return resultado;
  };

  /* mantém a assinatura antiga: devolve o valor da ÚLTIMA atribuição do arquivo. */
  IO.parsear = function (texto) {
    const todos = IO.parsearTodos(texto);
    const chaves = Object.keys(todos);
    return todos[chaves[chaves.length - 1]];
  };

  if (typeof module !== "undefined" && module.exports) module.exports = IO;
  else root.EDITOR_IO = IO;
})(this);
