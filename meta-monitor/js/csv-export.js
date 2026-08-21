/* Exportador de CSV compartilhado — window.CSV_EXPORT.
 *
 * Extraído de canva.html (item 3 do plano "canvas preenchido direto no site") pro item 4
 * (canva-consolidado.html) reaproveitar, em vez de escrever uma segunda implementação —
 * o §12 do plano avisa: "duas implementações do mesmo CSV divergem na primeira coluna
 * nova". O que se repetia entre as duas telas não é o CABEÇALHO (cada uma exporta colunas
 * diferentes — o gestor exporta só o que ele preencheu, a consolidação exporta com status
 * e autoria), é a mecânica: escapar aspas, o BOM UTF-8 que faz o Excel abrir acentuado sem
 * pedir encoding, e o disparo do download via Blob. É só isso que este módulo cobre.
 *
 * campo(v)         → um valor formatado como campo CSV entre aspas, aspas internas escapadas.
 * montar(cab, lin) → string CSV completa (BOM + cabeçalho + linhas), pronta pro Blob.
 * baixar(nome, s)  → dispara o download de `s` como arquivo `nome` (revoga o object URL
 *                    sozinho, depois de um tempo — mesmo padrão de sempre neste site).
 */
(function (root) {
  "use strict";

  function campo(v) {
    return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"';
  }

  function montar(cabecalho, linhas) {
    const cab = cabecalho.map(campo).join(",");
    const corpo = linhas.map((l) => l.map(campo).join(",")).join("\n");
    return "﻿" + cab + "\n" + corpo + (corpo ? "\n" : "");
  }

  function baixar(nomeArquivo, csvTexto) {
    const blob = new Blob([csvTexto], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nomeArquivo;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  const CSV_EXPORT = { campo: campo, montar: montar, baixar: baixar };

  // exportado como módulo também, mesmo padrão de js/db-canva.js — não há teste node hoje
  // pra este arquivo, mas mantém a porta aberta sem custo.
  if (typeof module !== "undefined" && module.exports) module.exports = CSV_EXPORT;
  else root.CSV_EXPORT = CSV_EXPORT;
})(typeof globalThis !== "undefined" ? globalThis : this);
