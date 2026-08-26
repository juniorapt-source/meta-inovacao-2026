/* Teste puro (sem DOM, sem rede) do item 4.3 — js/db-responsaveis.js: monta a lista de
 * responsáveis (pessoa OU coletivo) a partir do golden record (DB_PESSOAS/DB_COLETIVOS),
 * no lugar da lista estática window.DB.responsaveis. Mesmo padrão de tools/testar_calc.js.
 *
 * Roda em dois cenários:
 *  (a) contra o SEED local (data/pessoas.js + data/coletivos.js) — o que o site vê no
 *      fallback offline (?semrede=1) hoje: sem "Gerência UI" (só existe em produção,
 *      Camada 1) e sem db_id (linhas cruas do arquivo, não do Supabase).
 *  (b) contra um golden record FABRICADO (fixture própria) — pra exercitar os casos que
 *      o seed local não cobre: pessoa golden nova fora do LEGADO (URC), pessoa inativa,
 *      coletivo novo fora do LEGADO, e confirmar que db_id vira o id novo quando presente.
 */
"use strict";
const DB_RESPONSAVEIS = require("../js/db-responsaveis.js");

// data/pessoas.js grava DUAS variáveis (window.DB.pessoas e window.DB.responsaveis) —
// diferente do helper de 1 variável de tools/testar_calc.js, este pega a atribuição
// certa pelo NOME (regex até o "];" que fecha o array), não só a última do arquivo.
function dbVar(arquivo, variavel) {
  const fs = require("fs");
  const t = fs.readFileSync("data/" + arquivo, "utf8");
  const marcador = "window.DB." + variavel + " =";
  const inicio = t.indexOf(marcador);
  if (inicio === -1) throw new Error('não achei "' + marcador + '" em data/' + arquivo);
  const fim = t.indexOf("\n];", inicio);
  const json = t.slice(inicio + marcador.length, fim + 2).trim().replace(/;\s*$/, "");
  return JSON.parse(json);
}

const erros = [];
function checar(cond, msg) { if (!cond) erros.push(msg); }

// ---- (a) seed local ----
const pessoasSeed = dbVar("pessoas.js", "pessoas");
const coletivosSeed = dbVar("coletivos.js", "coletivos");
const listaSeed = DB_RESPONSAVEIS.montar(pessoasSeed, coletivosSeed);

checar(Array.isArray(listaSeed) && listaSeed.length > 0, "seed: montar() deveria devolver uma lista não vazia");

// jr/jose_mendes_junior colapsam numa única opção visível, com o outro id em aliasIds
const jr = DB_RESPONSAVEIS.encontrar(listaSeed, "jr");
checar(!!jr, "seed: id \"jr\" deveria resolver pra uma entrada");
checar(jr && jr.id === "jr", "seed: entrada de \"jr\" deveria ter id primário \"jr\" (não \"jose_mendes_junior\")");
checar(jr && (jr.aliasIds || []).includes("jose_mendes_junior"), "seed: entrada de \"jr\" deveria reconhecer \"jose_mendes_junior\" como apelido");
const porJuniorAlias = DB_RESPONSAVEIS.encontrar(listaSeed, "jose_mendes_junior");
checar(porJuniorAlias === jr, "seed: buscar por \"jose_mendes_junior\" deveria achar a MESMA entrada de \"jr\"");
checar(listaSeed.filter((e) => e.nome === "JR.").length === 1, "seed: \"JR.\" não pode aparecer 2x na lista (deveria estar colapsado numa única opção)");

// sandra/sandra_chaves_paraiso, mesmo padrão
const sandra = DB_RESPONSAVEIS.encontrar(listaSeed, "sandra");
checar(!!sandra && sandra.id === "sandra", "seed: id \"sandra\" deveria resolver com id primário \"sandra\"");
checar(sandra && (sandra.aliasIds || []).includes("sandra_chaves_paraiso"), "seed: \"sandra\" deveria reconhecer \"sandra_chaves_paraiso\" como apelido");
checar(listaSeed.filter((e) => e.nome === "Sandra").length === 1, "seed: \"Sandra\" não pode aparecer 2x na lista");

// os 32 ids do LEGADO conhecidos hoje resolvem pra alguma entrada (exceto "gerencia",
// que depende de "Gerência UI" só existir em produção — Camada 1 não populou o seed local)
const IDS_LEGADO_SEM_GERENCIA = Object.keys(DB_RESPONSAVEIS.LEGADO).filter((id) => id !== "gerencia");
IDS_LEGADO_SEM_GERENCIA.forEach((id) => {
  checar(!!DB_RESPONSAVEIS.encontrar(listaSeed, id), 'seed: id legado "' + id + '" deveria resolver pra uma entrada (não deveria virar "legado" sem motivo)');
});
checar(!DB_RESPONSAVEIS.encontrar(listaSeed, "gerencia"), 'seed: "gerencia" não deveria resolver no fallback local (data/coletivos.js não tem "Gerência UI" — só existe em produção)');

// "Gerência UI" (linha de pessoa, grupo UI, sem nome_exibicao) não vira opção fantasma
checar(!listaSeed.some((e) => e.nome === "Gerência UI" && e.tipo === "pessoa"), "seed: \"Gerência UI\" não deveria aparecer como PESSOA (só nome_exibicao preenchido vira opção)");

// idsEquivalentes cobre o id canônico + o apelido, nessa ordem
const equivJr = DB_RESPONSAVEIS.idsEquivalentes(listaSeed, "jr");
checar(equivJr.includes("jr") && equivJr.includes("jose_mendes_junior"), "seed: idsEquivalentes(\"jr\") deveria incluir \"jr\" e \"jose_mendes_junior\"");
const equivDesconhecido = DB_RESPONSAVEIS.idsEquivalentes(listaSeed, "um-id-que-nao-existe");
checar(equivDesconhecido.length === 1 && equivDesconhecido[0] === "um-id-que-nao-existe", "seed: idsEquivalentes de um id desconhecido devolve só ele mesmo (dado legado de verdade, sem tradução)");

// ---- (b) fixture fabricada — golden record com pessoa/coletivo fora do LEGADO ----
const pessoasFixture = pessoasSeed.concat([
  { nome: "Zezinho Teste da Silva", nome_exibicao: "Zezinho", grupo: "URC", ativo: true, db_id: 501 },
  { nome: "Pessoa Inativa", nome_exibicao: "Inativa", grupo: "Projetos", ativo: false, db_id: 502 },
  { nome: "Sem Nome De Exibicao", grupo: "Projetos", ativo: true, db_id: 503 }, // nunca deveria virar opção
]);
const coletivosFixture = coletivosSeed.concat([
  { nome: "Gerência UI", ordem: 6, db_id: 601 },
  { nome: "Grupo de Testes", ordem: 7, db_id: 602 },
]);
const listaFixture = DB_RESPONSAVEIS.montar(pessoasFixture, coletivosFixture);

checar(!!DB_RESPONSAVEIS.encontrar(listaFixture, "gerencia"), "fixture: \"gerencia\" deveria resolver agora que \"Gerência UI\" existe nos coletivos");

const enio = listaFixture.find((e) => e.nome === "Zezinho");
checar(!!enio, "fixture: pessoa golden nova (URC, fora do LEGADO) deveria aparecer na lista — \"cadastra e aparece sozinho\"");
checar(enio && enio.id === "pessoa:501", 'fixture: id novo deveria ser "pessoa:501" (db_id real), veio "' + (enio && enio.id) + '"');
checar(enio && enio.grupo === "URC", "fixture: pessoa golden do grupo URC deveria aparecer agrupada como \"URC\"");

checar(!listaFixture.some((e) => e.nome === "Inativa"), "fixture: pessoa com ativo:false não deveria aparecer como opção");
checar(!listaFixture.some((e) => e.nome === "Sem Nome De Exibicao"), "fixture: pessoa sem nome_exibicao não deveria aparecer como opção");

const grupoTestes = listaFixture.find((e) => e.nome === "Grupo de Testes");
checar(!!grupoTestes, "fixture: coletivo novo (fora do LEGADO) deveria aparecer na lista");
checar(grupoTestes && grupoTestes.id === "coletivo:602", 'fixture: id novo deveria ser "coletivo:602", veio "' + (grupoTestes && grupoTestes.id) + '"');

// ordem de grupos — Coordenação/Coletivo/Núcleos/URC/Projetos, alfabético dentro de cada um
const gruposNaOrdem = listaFixture.map((e) => e.grupo);
const posicoes = DB_RESPONSAVEIS.ORDEM_GRUPOS.map((g) => gruposNaOrdem.lastIndexOf(g)).filter((p) => p !== -1);
checar(posicoes.every((p, i) => i === 0 || p >= posicoes[i - 1]), "fixture: grupos deveriam sair na ordem " + DB_RESPONSAVEIS.ORDEM_GRUPOS.join(", "));

if (erros.length) {
  console.error("FALHOU testar_responsaveis:");
  erros.forEach((e) => console.error(" -", e));
  process.exitCode = 1;
} else {
  console.log("testar_responsaveis OK — seed local: " + listaSeed.length + " responsáveis; fixture: " + listaFixture.length + " responsáveis (com pessoa/coletivo fora do LEGADO)");
}
