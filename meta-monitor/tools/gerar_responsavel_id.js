/* Injeta o campo "responsavel_id" em cada ação de data/plano.js, calculado a partir do
 * campo "resp" (texto livre já existente, mantido intocado) via js/responsaveis.js +
 * data/pessoas.js (window.DB.responsaveis). Idempotente: pode rodar de novo depois de
 * qualquer edição em data/plano.js (ex.: nova ação) — só substitui a linha
 * "responsavel_id" se já existir, ou insere logo depois de "resp" se não existir ainda.
 *
 * Uso:
 *   node tools/gerar_responsavel_id.js           grava data/plano.js
 *   node tools/gerar_responsavel_id.js --check   não grava; falha (exit 1) se "responsavel_id"
 *                                                 gravado hoje divergir do que "resp" geraria
 *                                                 agora — é o guardrail contra "resp" editado à
 *                                                 mão sem regenerar, roda nos testes (README).
 * Depende de: data/plano.js, data/pessoas.js, js/responsaveis.js
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");

const MODO_CHECK = process.argv.includes("--check");
const REPO = path.join(__dirname, "..");
const CAMINHO_PLANO = path.join(REPO, "data", "plano.js");

global.window = global;
require(path.join(REPO, "data", "pessoas.js"));
require(path.join(REPO, "data", "plano.js"));
const RESP = require(path.join(REPO, "js", "responsaveis.js"));

const lista = window.DB.responsaveis;
const acoes = window.DB.plano;

const semMapear = [];
const mapa = {}; // id da ação -> array de ids de responsável
acoes.forEach((a) => {
  const { ids, naoMapeados } = RESP.mapearTexto(lista, a.resp);
  mapa[a.id] = ids;
  if (naoMapeados.length) semMapear.push({ acao: a.id, resp: a.resp, naoMapeados });
});

if (MODO_CHECK) {
  const divergentes = acoes.filter((a) => JSON.stringify(a.responsavel_id || null) !== JSON.stringify(mapa[a.id]));
  if (divergentes.length) {
    console.error("FALHOU — data/plano.js está fora de sincronia com \"resp\" (rode sem --check pra regravar):");
    divergentes.forEach((a) => console.error(
      "  " + a.id + ": responsavel_id gravado=" + JSON.stringify(a.responsavel_id || null) +
      " · esperado (a partir de resp=" + JSON.stringify(a.resp) + ")=" + JSON.stringify(mapa[a.id])
    ));
    process.exit(1);
  }
  console.log("gerar_responsavel_id --check OK — responsavel_id de todas as " + acoes.length + " ações bate com \"resp\".");
  process.exit(0);
}

let texto = fs.readFileSync(CAMINHO_PLANO, "utf8");
const linhas = texto.split("\n");
let idAtual = null;
let alterados = 0;
const saida = [];
for (let i = 0; i < linhas.length; i++) {
  const linha = linhas[i];
  const mId = linha.match(/^\s*"id":\s*"([^"]+)",?\s*$/);
  if (mId) idAtual = mId[1];

  // já existe uma linha "responsavel_id" pra essa ação (rerun) — substitui em vez de duplicar
  if (/^\s*"responsavel_id":/.test(linha) && idAtual && mapa[idAtual]) {
    const indent = linha.match(/^(\s*)/)[1];
    saida.push(indent + '"responsavel_id": ' + JSON.stringify(mapa[idAtual]) + ",");
    continue;
  }

  saida.push(linha);

  const mResp = linha.match(/^(\s*)"resp":\s*"[^"]*",?\s*$/);
  const proximaJaTemCampo = linhas[i + 1] && /^\s*"responsavel_id":/.test(linhas[i + 1]);
  if (mResp && idAtual && mapa[idAtual] && !proximaJaTemCampo) {
    const indent = mResp[1];
    saida.push(indent + '"responsavel_id": ' + JSON.stringify(mapa[idAtual]) + ",");
    alterados++;
  }
}

fs.writeFileSync(CAMINHO_PLANO, saida.join("\n"));

console.log("responsavel_id gravado em " + alterados + " ação(ões) (de " + acoes.length + ").");
if (semMapear.length) {
  console.log("AVISO — valores de responsável sem mapeamento canônico:");
  semMapear.forEach((s) => console.log("  " + s.acao + ": \"" + s.resp + "\" -> não mapeado: " + JSON.stringify(s.naoMapeados)));
} else {
  console.log("Todos os valores de \"resp\" mapearam para a lista canônica.");
}
