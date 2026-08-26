/* Teste puro em node (sem Chrome) — item 5.9 parte 6 (js/busca.js, Opção A, decidido por
 * José em 26/08/2026): a lógica de busca não muda, só o LINK do resultado de tipo
 * "iniciativa" quando o projeto já tem golden record (p.db_id, item 5.5).
 *
 * Mesmo espírito de tools/testar_calc.js: exercita direto a função pura
 * (construirIndice), sem navegador — busca.js já documenta essa parte como "testável em
 * node, sem DOM". A parte de UI/DOM continua coberta por
 * tools/testar_busca_headless.js (inalterado por este item: cenário lá é o seed local,
 * sem db_id, então continua batendo com o link de sempre).
 */
"use strict";
const BUSCA = require("../js/busca.js");

function throwIf(condicao, mensagem) { if (condicao) throw new Error(mensagem); }

// projeto COM golden record (db_id resolvido, item 5.5) — link do resultado passa a
// apontar pelo hash #iniciativa= que js/drawer.js resolve (item 3.2), não mais por
// ?q=<texto>#cards.
const DB_COM_GOLDEN = {
  projetos: [
    { db_id: 101, nucleo_id: 701, iniciativa: "Iniciativa Alfa", nucleo: "Núcleo A", representantes: ["Carol"] },
  ],
};

// mesmo projeto, mas sem golden record ainda (db_id ausente — seed local/offline,
// mesmo cenário do tools/testar_busca_headless.js) — mantém o link de sempre.
const DB_SEM_GOLDEN = {
  projetos: [
    { iniciativa: "Iniciativa Alfa", nucleo: "Núcleo A", representantes: ["Carol"] },
  ],
};

const idxComGolden = BUSCA.construirIndice(DB_COM_GOLDEN);
const itemComGolden = idxComGolden.find((i) => i.tipo === "iniciativa");
throwIf(!itemComGolden, 'não achei o item "iniciativa" no índice (cenário com golden record)');
throwIf(itemComGolden.href !== "corsario.html#iniciativa=iniciativa-alfa",
  'com p.db_id preenchido, o link deveria ser "corsario.html#iniciativa=iniciativa-alfa" (mesmo slug que DRAWER.abrirIniciativa() resolve), veio "' + itemComGolden.href + '"');

const idxSemGolden = BUSCA.construirIndice(DB_SEM_GOLDEN);
const itemSemGolden = idxSemGolden.find((i) => i.tipo === "iniciativa");
throwIf(!itemSemGolden, 'não achei o item "iniciativa" no índice (cenário sem golden record)');
throwIf(itemSemGolden.href !== "corsario.html?q=Iniciativa%20Alfa#cards",
  'sem p.db_id, o link deveria continuar "corsario.html?q=Iniciativa%20Alfa#cards" (visão Cards de sempre), veio "' + itemSemGolden.href + '"');

// a LÓGICA de busca (chave/match por texto) não muda: mesma chave nos dois cenários,
// e buscar() continua achando o item pelo texto digitado independente de ter FK ou não.
throwIf(itemComGolden.chave !== itemSemGolden.chave, "a chave de busca (texto) não deveria mudar com ou sem golden record — só o link muda");
const achouComGolden = BUSCA.buscar(idxComGolden, "alfa");
const achouSemGolden = BUSCA.buscar(idxSemGolden, "alfa");
throwIf(!achouComGolden.iniciativa || achouComGolden.iniciativa.length !== 1, 'buscar("alfa") deveria achar 1 resultado no cenário com golden record');
throwIf(!achouSemGolden.iniciativa || achouSemGolden.iniciativa.length !== 1, 'buscar("alfa") deveria achar 1 resultado no cenário sem golden record');

console.log("testar_busca_golden OK — link do resultado de iniciativa aponta pelo hash #iniciativa= (drawer) quando há golden record (p.db_id), e continua no link de sempre (corsario.html?q=...#cards) quando não há; a lógica de busca por texto não mudou.");
