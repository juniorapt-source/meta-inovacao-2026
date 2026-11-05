/* Teste puro (sem navegador, sem rede) do "onde o projeto aparece" (v0.35.0):
 * js/db-projetos.js (exibir, temVisibilidade, projetoParaLinha, agruparPorProjeto) e a linha
 * escondida da Matriz em js/matriz-store.js (montarModelo). */
"use strict";
const path = require("path");
const root = path.join(__dirname, "..");

global.window = global;
global.window.DB = {};
global.window.CC_FORCAR_FALLBACK = true;
require(path.join(root, "js", "db-base.js"));
const modProj = require(path.join(root, "js", "db-projetos.js"));
const P = modProj.DB_PROJETOS || globalThis.DB_PROJETOS;
const modMatriz = require(path.join(root, "js", "matriz-store.js"));
const M = modMatriz.matrizStore || globalThis.matrizStore;

let erros = 0;
function checa(nome, cond) { if (cond) console.log("  ok:", nome); else { console.error("  FALHA:", nome); erros++; } }

// exibir / temVisibilidade
checa("7 telas na lista de visibilidade", P.VISIBILIDADE.length === 7 && P.VISIBILIDADE.every((v) => /^exibir_/.test(v.k) && v.rotulo));
checa("sem a coluna, o projeto aparece", P.exibir({ iniciativa: "x" }, "exibir_sites") === true);
checa("coluna false esconde", P.exibir({ exibir_sites: false }, "exibir_sites") === false);
checa("lista vazia não tem visibilidade", P.temVisibilidade([]) === false);
checa("seed (sem marca do banco) não tem visibilidade", P.temVisibilidade([{ iniciativa: "a" }]) === false);
checa("lista do banco com as colunas tem visibilidade", P.temVisibilidade([{ _visNoBanco: true }, { _visNoBanco: true }]) === true);

// projetoParaLinha só manda as marcas definidas
const semMarca = P.projetoParaLinha({ iniciativa: "a", nucleo: "n" });
checa("criar sem marcas não manda exibir_* (funciona antes do script SQL)", !Object.keys(semMarca).some((k) => /^exibir_/.test(k)));
const comMarca = P.projetoParaLinha({ iniciativa: "a", exibir_corsario: false, exibir_sites: true });
checa("criar com marcas manda só as definidas", comMarca.exibir_corsario === false && comMarca.exibir_sites === true && !("exibir_canva" in comMarca));

// agruparPorProjeto
const projetos = [
  { db_id: 1, iniciativa: "Alfa", nucleo: "N1", exibir_corsario: true },
  { db_id: 2, iniciativa: "Beta", nucleo: "N1", exibir_corsario: false },
  { db_id: 3, iniciativa: "Gama", nucleo: "N2", exibir_corsario: true },
];
const linhas = [
  { projeto_id: 1, iniciativa: "Alfa (nome antigo)", criterio: "c1" },
  { projeto_id: null, iniciativa: "  alfa ", criterio: "c2" },   // legado sem FK, casa pelo nome
  { projeto_id: 2, iniciativa: "Beta", criterio: "c1" },          // projeto escondido
  { projeto_id: null, iniciativa: "Livre", criterio: "c1" },      // fora do cadastro
  { projeto_id: 99, iniciativa: "Gama", criterio: "c1" },         // FK de outro projeto: não casa pelo nome
];
const g = P.agruparPorProjeto(linhas, projetos, "exibir_corsario");
checa("um grupo por projeto visível, na ordem do cadastro", g.map((x) => x.projeto.db_id).join(",") === "1,3");
checa("Alfa junta FK e nome legado", g[0].linhas.length === 2);
checa("Gama aparece sem linhas", g[1].linhas.length === 0);

// Matriz: projeto com exibir_matriz=false some e não vira linha órfã
const modelo = M.montarModelo(
  [{ db_id: 1, iniciativa: "Alfa", nucleo: "N1" }, { db_id: 2, iniciativa: "Beta", nucleo: "N1", exibir_matriz: false }],
  [{ db_id: 10, slug: "c1", nome: "C1", ordem: 1, ativo: true }, { db_id: 11, slug: "c2", nome: "C2", ordem: 2, ativo: false }],
  [
    { projeto_id: 1, canal_id: 10, estado: "previsto", iniciativa: "Alfa", canal_slug: "c1" },
    { projeto_id: 2, canal_id: 10, estado: "previsto", iniciativa: "Beta", canal_slug: "c1" },
    { projeto_id: 2, canal_id: 11, estado: "previsto", iniciativa: "Beta", canal_slug: "c2" },
  ]
);
checa("Matriz: só Alfa, sem linha órfã de Beta", modelo.linhas.map((l) => l.iniciativa).join(",") === "Alfa");
checa("Matriz: canal desativado com dado só de projeto escondido não aparece", modelo.colunas.map((c) => c.slug).join(",") === "c1");

if (erros) { console.error("FALHOU projetos_visibilidade: " + erros + " checagem(ns)."); process.exit(1); }
console.log("projetos_visibilidade OK");
