/* Camada 3 — conferência célula a célula entre a matriz NOVA e a ANTIGA.
 *
 * É o teste de aceite do item 3.2 rodado contra produção: "a grade nova mostra os
 * mesmos estados que a tabela antiga, célula a célula". A mesma conferência aparece
 * dentro de demandas.html (painel "Conferência com a tabela antiga"); esta versão de
 * linha de comando existe pra dar o retrato completo, sem limite de listagem, e pra
 * poder ser rodada de fora do navegador durante a janela de validação do item 3.5.
 *
 * Lê o Supabase só pra LEITURA, com a anon key de js/config.js (mesmo padrão de
 * tools/relatorio_cobertura_fk.js). Não escreve nada, em tabela nenhuma.
 *
 * Uso:
 *   node tools/conferir_matriz_celulas.js            # relatório pra ler
 *   node tools/conferir_matriz_celulas.js --check    # sai 1 se houver divergência
 *
 * LEITURA DO RESULTADO — a tabela antiga PAROU de receber escrita na virada do item
 * 3.2. Então:
 *   - divergência logo depois da migração = erro de migração (é o que este script
 *     existe pra pegar antes de alguém confiar na grade nova);
 *   - divergência semanas depois = provavelmente edição feita na grade nova desde
 *     então, o que é o esperado. Por isso --check só faz sentido logo após a virada,
 *     e o relatório sem --check é o uso normal daí em diante.
 */
"use strict";
const path = require("node:path");

const REPO = path.dirname(__dirname);
global.window = global;
require(path.join(REPO, "js", "config.js"));
const CFG = global.APP_CONFIG;
if (!CFG || !CFG.SUPABASE_URL || !CFG.SUPABASE_ANON_KEY) {
  console.error("conferir_matriz_celulas: não achei APP_CONFIG em js/config.js.");
  process.exit(2);
}

const SO_CHECAR = process.argv.includes("--check");

async function buscar(tabela, query) {
  const url = CFG.SUPABASE_URL + "/rest/v1/" + tabela + "?" + query;
  const r = await fetch(url, {
    headers: { apikey: CFG.SUPABASE_ANON_KEY, Authorization: "Bearer " + CFG.SUPABASE_ANON_KEY },
  });
  if (!r.ok) {
    let detalhe = "HTTP " + r.status;
    try { const b = await r.json(); if (b && b.message) detalhe = b.message; } catch (e) { /* corpo não-JSON */ }
    throw new Error(tabela + ": " + detalhe);
  }
  return r.json();
}

function norm(s) { return String(s == null ? "" : s).trim().toLowerCase(); }

// mesmas colunas "não-canal" que js/matriz-store.js ignora na tabela antiga — todo o
// resto das colunas de texto de lá é um canal, nomeado pelo slug.
const META_LEGADO = ["id", "iniciativa", "nucleo", "criado_em", "atualizado_em", "atualizado_por", "created_at", "updated_at", "updated_by", "deleted_at"];

(async function () {
  let celulas, projetos, canais, legado;
  try {
    [celulas, projetos, canais, legado] = await Promise.all([
      buscar("meta_inovacao_matriz_celulas", "select=projeto_id,canal_id,estado,updated_at,updated_by"),
      buscar("meta_inovacao_projetos", "select=id,iniciativa&deleted_at=is.null"),
      buscar("meta_inovacao_canais", "select=id,slug,nome,ordem,ativo&deleted_at=is.null"),
      buscar("meta_inovacao_matriz_demandas", "select=*"),
    ]);
  } catch (err) {
    console.error("conferir_matriz_celulas — ERRO lendo o Supabase:", err.message);
    console.error("(as 4 tabelas precisam existir: a migração do item 3.1 já rodou neste banco?)");
    process.exit(2);
  }

  const nomeProjeto = new Map(projetos.map((p) => [Number(p.id), p.iniciativa]));
  const slugCanal = new Map(canais.map((c) => [Number(c.id), c.slug]));

  // grade NOVA, indexada por iniciativa|slug (o mesmo par que a tabela antiga conhece)
  const nova = new Map();
  const semNome = [];
  celulas.forEach((c) => {
    const ini = nomeProjeto.get(Number(c.projeto_id));
    const slug = slugCanal.get(Number(c.canal_id));
    if (!ini || !slug) { semNome.push(c); return; }
    nova.set(norm(ini) + "|" + norm(slug), { estado: c.estado || "", iniciativa: ini, canal: slug });
  });

  // grade ANTIGA, achatada de 1 linha × 10 colunas pra células
  const antiga = [];
  legado.forEach((linha) => {
    Object.keys(linha).forEach((coluna) => {
      if (META_LEGADO.indexOf(coluna) !== -1) return;
      if (typeof linha[coluna] !== "string") return;
      antiga.push({ iniciativa: linha.iniciativa, canal: coluna, estado: linha[coluna] || "" });
    });
  });

  const vistos = new Set();
  let iguais = 0;
  const divergentes = [];
  antiga.forEach((c) => {
    const k = norm(c.iniciativa) + "|" + norm(c.canal);
    vistos.add(k);
    const n = nova.get(k);
    const estadoNovo = n ? n.estado : "";           // célula ausente = vazia
    if (estadoNovo === c.estado) { iguais++; return; }
    divergentes.push({ iniciativa: c.iniciativa, canal: c.canal, antiga: c.estado || "(vazia)", nova: estadoNovo || "(vazia)" });
  });
  nova.forEach((v, k) => {
    if (!vistos.has(k) && v.estado) {
      divergentes.push({ iniciativa: v.iniciativa, canal: v.canal, antiga: "(não existe na tabela antiga)", nova: v.estado });
    }
  });

  console.log("Conferência célula a célula — matriz nova × matriz antiga");
  console.log("  " + celulas.length + " célula(s) em meta_inovacao_matriz_celulas · " +
    legado.length + " linha(s) em meta_inovacao_matriz_demandas · " +
    projetos.length + " projeto(s) · " + canais.length + " canal(is) no catálogo");
  console.log("  " + iguais + " conferem · " + divergentes.length + " divergem");

  if (semNome.length) {
    console.log("");
    console.log("  ATENÇÃO — " + semNome.length + " célula(s) apontam pra projeto ou canal fora do catálogo");
    console.log("  (soft delete, provavelmente). Elas aparecem em demandas.html marcadas como órfãs:");
    semNome.slice(0, 20).forEach((c) => console.log("    projeto_id=" + c.projeto_id + " canal_id=" + c.canal_id + " estado=" + (c.estado || "(vazia)")));
    if (semNome.length > 20) console.log("    …e mais " + (semNome.length - 20) + ".");
  }

  if (divergentes.length) {
    console.log("");
    console.log("  DIVERGÊNCIAS");
    console.log("    " + "iniciativa".padEnd(34) + "canal".padEnd(14) + "antiga".padEnd(16) + "nova");
    divergentes.forEach((d) => {
      console.log("    " + String(d.iniciativa).slice(0, 32).padEnd(34) + String(d.canal).padEnd(14) + String(d.antiga).padEnd(16) + d.nova);
    });
    console.log("");
    console.log("  Divergência é esperada quando alguém já editou na grade nova depois da");
    console.log("  virada (a tabela antiga não recebe mais escrita). Divergência que ninguém");
    console.log("  reconhece como edição própria é erro de migração — resolver antes do 3.5.");
  }

  if (SO_CHECAR && divergentes.length) process.exit(1);
})();
