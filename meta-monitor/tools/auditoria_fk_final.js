/* Camada 5, item 5.1 — AUDITORIA FINAL de FK das Camadas 2 e 4, ponta a ponta.
 *
 * "Ponta a ponta" aqui tem duas metades, e este script é a segunda:
 *
 *   METADE A — as linhas que JÁ EXISTEM têm a FK preenchida?
 *     É um retrato do banco. Não roda aqui (este ambiente não alcança supabase.co
 *     — ver item 7 do "Status por camada" do plano) e a anon key nem enxergaria
 *     meta_inovacao_canva_demandas. Mede-se com
 *     `tools/sql/2026-08_auditoria_fk_final.sql` (só leitura, veredito por FK,
 *     José roda no SQL Editor) e, pro que é público, com
 *     `node tools/relatorio_cobertura_fk.js` de uma máquina com rede.
 *
 *   METADE B — as linhas que AINDA VÃO EXISTIR vão nascer com a FK preenchida?
 *     É uma propriedade do CÓDIGO, não do banco: dá pra medir aqui, offline e
 *     sem depender de ninguém rodar nada. É o que este script faz — pra cada FK
 *     das Camadas 2/4 ele percorre as PORTAS DE ENTRADA (todo caminho do site que
 *     cria ou altera linha daquela tabela) e confere se a FK entra na escrita.
 *
 * Por que a metade B é o que decide o item 5.2: uma FK 100% preenchida hoje mas
 * que nenhuma tela grava volta a ficar furada na primeira linha nova — vira um
 * retrato que envelhece, exatamente a armadilha que o item 2.5 evitou reescrevendo
 * cc_canva_gravar/cc_canva_editar em vez de só popular o que existia. Dropar a
 * coluna de texto (5.3) de uma FK assim troca um dado desatualizado por um dado
 * ausente.
 *
 * O script também lista, por FK, QUEM LÊ ela hoje no site — a outra metade da
 * decisão do 5.2: coluna de texto que ainda é a única fonte de alguma tela não
 * pode ser dropada, por mais completa que a FK esteja.
 *
 * Uso:
 *   node tools/auditoria_fk_final.js           # relatório pra leitura humana
 *   node tools/auditoria_fk_final.js --check   # pra suíte/CI: sai != 0 se o
 *                                              # conjunto de lacunas MUDOU
 *   node tools/auditoria_fk_final.js --json    # mesmo conteúdo, pra script
 *
 * Sobre o --check: hoje existem lacunas conhecidas (listadas em
 * LACUNAS_REGISTRADAS abaixo, e em docs/CAMADA5_AUDITORIA_FK.md). Falhar por
 * causa delas todo dia não ensinaria nada. Então o --check compara o conjunto
 * ATUAL com o REGISTRADO e reclama nos dois sentidos:
 *   - lacuna nova (uma tela regrediu, ou uma porta de entrada nova nasceu sem FK);
 *   - lacuna registrada que sumiu (foi corrigida e ninguém deu baixa aqui).
 * É o corolário do 2.5 aplicado a código: item que ficou pra trás vira linha com
 * status, nunca linha removida.
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");

const REPO = path.dirname(__dirname);
const ler = (rel) => fs.readFileSync(path.join(REPO, rel), "utf8");

/* ---------------------------------------------------------------------------
 * Fontes lidas. Manter explícito (em vez de varrer o repositório) é de propósito:
 * arquivo novo que grave uma dessas tabelas TEM que aparecer aqui, e a lista é o
 * lugar onde isso fica visível na revisão.
 * ------------------------------------------------------------------------- */
const FONTES = {
  "js/db-projetos.js": null,
  "js/db-projeto-representantes.js": null,
  "js/db-urc.js": null,
  "js/db-plano.js": null,
  "js/db-corsario.js": null,
  "js/db-canva.js": null,
  "js/drawer.js": null,
  "editor.html": null,
  "plano-acao.html": null,
  "minhas-acoes.html": null,
  "corsario.html": null,
  "participantes.html": null,
  "projetos.html": null,
  "index.html": null,
  "canva-consolidado.html": null,
  "tools/sql/2026-08_canva_demandas_fk.sql": null,
};
Object.keys(FONTES).forEach((f) => { FONTES[f] = ler(f); });

// arquivos que contam como "o site" quando a pergunta é quem LÊ uma FK — tools/
// fica de fora de propósito (relatório não é tela).
const ARQUIVOS_DO_SITE = Object.keys(FONTES).filter((f) => !f.startsWith("tools/"));

/* corpo de uma função declarada como `function nome(` — casamento de chaves, pra
 * checar o que ela grava sem depender da formatação de uma linha específica. */
function corpo(src, nome) {
  const i = src.indexOf("function " + nome + "(");
  if (i < 0) return "";
  const abre = src.indexOf("{", i);
  if (abre < 0) return "";
  let nivel = 0;
  for (let j = abre; j < src.length; j++) {
    if (src[j] === "{") nivel++;
    else if (src[j] === "}") { nivel--; if (nivel === 0) return src.slice(abre, j + 1); }
  }
  return src.slice(abre);
}

const tem = (src, re) => re.test(src);

/* ---------------------------------------------------------------------------
 * O mapa da auditoria. Uma entrada por FK criada nas Camadas 2/4.
 *
 * porta.ok() responde "esta porta de entrada grava a FK?" — sempre ancorado num
 * trecho de código nomeado em `ancora`, pra que um falso positivo aqui seja
 * diagnosticável sem ler o script inteiro.
 * ------------------------------------------------------------------------- */
const ITENS = [
  {
    item: "2.1",
    fk: "meta_inovacao_projetos.nucleo_id",
    textoLegado: "meta_inovacao_projetos.nucleo (text)",
    leitura: [
      {
        arquivo: "js/db-projetos.js",
        como: "linhaParaProjeto() expõe nucleo_id pro resto do site",
        ok: () => tem(corpo(FONTES["js/db-projetos.js"], "linhaParaProjeto"), /nucleo_id/),
      },
      {
        arquivo: "editor.html",
        como: "a grade de projetos usa nucleo_id em vez do texto",
        ok: () => tem(FONTES["editor.html"], /nucleo_id/),
      },
    ],
    portas: [
      {
        nome: "projeto novo (editor.html → DB_PROJETOS.criar)",
        ancora: "projetoParaLinha() em js/db-projetos.js — é o que vira payload do insert",
        ok: () => tem(corpo(FONTES["js/db-projetos.js"], "projetoParaLinha"), /nucleo_id/),
      },
      {
        nome: "trocar o núcleo na grade (editor.html → DB_PROJETOS.salvar)",
        ancora: 'handler dos <select data-f="nucleo"> em editor.html, que grava { [campo]: valor }',
        ok: () => tem(FONTES["editor.html"], /nucleo_id/),
      },
    ],
  },
  {
    item: "2.2",
    fk: "meta_inovacao_projeto_representantes (junção projeto × pessoa)",
    textoLegado: "meta_inovacao_projetos.representantes (text[])",
    leitura: [
      {
        arquivo: "editor.html",
        como: "aba \"Projetos & Representantes\" monta os chips a partir da junção (item 4.1)",
        ok: () => tem(FONTES["editor.html"], /DB_PROJETO_REPRESENTANTES\.carregar\(/),
      },
      {
        arquivo: "js/drawer.js",
        como: "painel de iniciativa lê a junção, texto só como fallback (item 4.4)",
        ok: () => tem(FONTES["js/drawer.js"], /DB_PROJETO_REPRESENTANTES/),
      },
    ],
    portas: [
      {
        nome: "adicionar representante (editor.html, item 4.1)",
        ancora: 'DB_PROJETO_REPRESENTANTES.criar({ projeto_id: p.db_id, … }) no handler do <select> "+ adicionar…"',
        ok: () => tem(FONTES["editor.html"], /DB_PROJETO_REPRESENTANTES\.criar\(\{\s*projeto_id:\s*p\.db_id/),
      },
      {
        nome: "projeto novo com representantes (editor.html, item 4.1)",
        ancora: "DB_PROJETO_REPRESENTANTES.criar({ projeto_id: criado.db_id, … }) logo depois do DB_PROJETOS.criar",
        ok: () => tem(FONTES["editor.html"], /DB_PROJETO_REPRESENTANTES\.criar\(\{\s*projeto_id:\s*criado\.db_id/),
      },
      {
        nome: "remover representante (editor.html, item 4.1)",
        ancora: "DB_PROJETO_REPRESENTANTES.removerSoft() no X do chip",
        ok: () => tem(FONTES["editor.html"], /DB_PROJETO_REPRESENTANTES\.removerSoft\(/),
      },
    ],
  },
  {
    item: "2.3",
    fk: "meta_inovacao_urc_lideranca.pessoa_id",
    textoLegado: "meta_inovacao_urc_lideranca.nome (text)",
    leitura: [
      {
        arquivo: "js/db-urc.js",
        como: "linhaParaLideranca() expõe pessoa_id pra tela",
        ok: () => tem(corpo(FONTES["js/db-urc.js"], "linhaParaLideranca"), /pessoa_id/),
      },
      {
        arquivo: "editor.html",
        como: "<select> de pessoa vem pré-selecionado pelo pessoa_id (item 4.2)",
        ok: () => tem(FONTES["editor.html"], /selectPessoaUrcHtml\(\s*p\.pessoa_id/),
      },
    ],
    portas: [
      {
        nome: "trocar a pessoa da liderança (editor.html, item 4.2)",
        ancora: "patch { pessoa_id, nome } antes do DB_URC.salvarLideranca em editor.html",
        ok: () => tem(FONTES["editor.html"], /pessoa_id:\s*pessoaId/) && tem(FONTES["editor.html"], /DB_URC\.salvarLideranca\(/),
      },
      {
        nome: "payload de escrita (js/db-urc.js)",
        ancora: "liderancaParaLinha() — o que criarLideranca manda pro insert",
        ok: () => tem(corpo(FONTES["js/db-urc.js"], "liderancaParaLinha"), /pessoa_id/),
      },
    ],
  },
  {
    item: "2.4",
    fk: "meta_inovacao_urc_canais_responsaveis.canal_id + .pessoa_id",
    textoLegado: "meta_inovacao_urc_canais_responsaveis.canal + .nome (text)",
    leitura: [
      {
        arquivo: "js/db-urc.js",
        como: "linhaParaResponsavel() expõe canal_id e pessoa_id pra tela",
        ok: () => {
          const c = corpo(FONTES["js/db-urc.js"], "linhaParaResponsavel");
          return tem(c, /canal_id/) && tem(c, /pessoa_id/);
        },
      },
      {
        arquivo: "editor.html",
        como: "<select> de pessoa vem pré-selecionado pelo pessoa_id (item 4.2)",
        ok: () => tem(FONTES["editor.html"], /selectPessoaUrcHtml\(\s*l\.pessoa_id/),
      },
    ],
    portas: [
      {
        nome: "trocar a pessoa do canal (editor.html, item 4.2)",
        ancora: "patch { pessoa_id, nome } antes do DB_URC.salvarResponsavel em editor.html",
        ok: () => tem(FONTES["editor.html"], /pessoa_id:\s*pessoaId/) && tem(FONTES["editor.html"], /DB_URC\.salvarResponsavel\(/),
      },
      {
        nome: "trocar o canal da linha (editor.html, item 4.2)",
        ancora: "patch { canal, canal_id: canalIdPorNome(…) } no mesmo handler",
        ok: () => tem(FONTES["editor.html"], /canal_id:\s*canalIdPorNome\(/),
      },
      {
        nome: "+ Adicionar responsável (editor.html, item 4.2)",
        ancora: "DB_URC.criarResponsavel({ canal, canal_id, nome, pessoa_id, … })",
        ok: () => tem(FONTES["editor.html"], /DB_URC\.criarResponsavel\(\{[^}]*canal_id[^}]*pessoa_id/),
      },
      {
        nome: "payload de escrita (js/db-urc.js)",
        ancora: "responsavelParaLinha() — o que salvarResponsavel/criarResponsavel mandam",
        ok: () => {
          const c = corpo(FONTES["js/db-urc.js"], "responsavelParaLinha");
          return tem(c, /canal_id/) && tem(c, /pessoa_id/);
        },
      },
    ],
  },
  {
    item: "2.5",
    fk: "meta_inovacao_canva_demandas.nucleo_id + .canal_id + .facilitador_pessoa_id + .responsavel_pessoa_id",
    textoLegado: "meta_inovacao_canva_demandas.nucleo + .canal + .facilitador + .responsavel (text)",
    leitura: [
      {
        // canva.html (js/db-canva.js) só GRAVA, via RPC (nem SELECT nem GRANT de leitura
        // pro anon nesta tabela — ver o comentário no topo de js/db-canva.js) — não há o
        // que ler lá. canva-consolidado.html (js/db-canva-consolidado.js) é a ÚNICA tela
        // com leitura direta (select("*")) desta tabela, e é onde o item 5.9 (parte 5)
        // fez as 4 FKs entrarem: núcleo/canal/facilitador/responsável resolvidos por
        // FK primeiro, texto legado só como fallback (mesmo "convivendo" das partes 2/3).
        arquivo: "canva-consolidado.html",
        como: "núcleo/canal/facilitador/responsável resolvidos pelas 4 FKs (item 5.9, parte 5), texto legado só como fallback",
        ok: () => ["nucleo_id", "canal_id", "facilitador_pessoa_id", "responsavel_pessoa_id"]
          .every((col) => tem(FONTES["canva-consolidado.html"], new RegExp(col))),
      },
    ],
    portas: [
      {
        nome: "demanda nova (RPC cc_canva_gravar)",
        ancora: "corpo de cc_canva_gravar em tools/sql/2026-08_canva_demandas_fk.sql",
        ok: () => {
          const sql = FONTES["tools/sql/2026-08_canva_demandas_fk.sql"];
          const i = sql.indexOf("FUNCTION public.cc_canva_gravar");
          const j = sql.indexOf("FUNCTION public.cc_canva_editar");
          const trecho = i < 0 ? "" : sql.slice(i, j > i ? j : sql.length);
          return ["nucleo_id", "canal_id", "facilitador_pessoa_id", "responsavel_pessoa_id"]
            .every((col) => trecho.includes(col));
        },
      },
      {
        nome: "editar demanda (RPC cc_canva_editar)",
        ancora: "corpo de cc_canva_editar — recalcula as 2 FKs de pessoa quando o texto muda",
        ok: () => {
          const sql = FONTES["tools/sql/2026-08_canva_demandas_fk.sql"];
          const i = sql.indexOf("FUNCTION public.cc_canva_editar");
          const trecho = i < 0 ? "" : sql.slice(i);
          return trecho.includes("facilitador_pessoa_id") && trecho.includes("responsavel_pessoa_id");
        },
      },
      {
        nome: "nenhuma escrita direta escapa da RPC (js/db-canva.js)",
        ancora: "js/db-canva.js não pode ter .from('meta_inovacao_canva_demandas').insert/update/upsert",
        ok: () => !tem(FONTES["js/db-canva.js"], /from\(\s*["']meta_inovacao_canva_demandas["']\s*\)\s*\.\s*(insert|update|upsert)/),
      },
    ],
  },
  {
    item: "2.6",
    fk: "meta_inovacao_plano_responsaveis (junção ação × pessoa/coletivo)",
    textoLegado: "meta_inovacao_plano_acoes.responsavel_id (text[])",
    leitura: [
      {
        arquivo: "js/db-plano.js",
        como: "carrega a junção junto com as ações (a.responsaveis_golden)",
        ok: () => FONTES["js/db-plano.js"].includes("meta_inovacao_plano_responsaveis"),
      },
      {
        // 5.9 (parte 7, 26/08/2026): a entrada original desta leitura apontava pra
        // "plano-acao.html" — não fazia sentido (aquela tela edita plano_acao_atividades,
        // uma tabela SEM ligação com plano_acao_id; a junção referencia
        // meta_inovacao_plano_acoes, a tabela por trás de minhas-acoes.html/plano.html/
        // editor.html). Corrigido pra apontar pra quem de fato passou a ler a junção.
        arquivo: "minhas-acoes.html",
        como: "seção \"Ações do plano\" casa por vínculo golden além do texto legado (acaoTemVinculoGolden)",
        ok: () => FONTES["minhas-acoes.html"].includes("meta_inovacao_plano_responsaveis") || FONTES["minhas-acoes.html"].includes("responsaveis_golden"),
      },
    ],
    portas: [
      {
        nome: "ação nova (editor.html → DB_PLANO.criar)",
        ancora: "acaoParaLinha() em js/db-plano.js + qualquer escrita na junção pelo site",
        ok: () => ARQUIVOS_DO_SITE.some((f) => FONTES[f].includes("meta_inovacao_plano_responsaveis")),
      },
      {
        nome: "trocar responsável (plano-acao.html / minhas-acoes.html / editor.html → DB_PLANO.salvar)",
        ancora: "os 3 handlers de <select> de responsável gravam responsavel_id (text[]) e só",
        ok: () => ARQUIVOS_DO_SITE.some((f) => FONTES[f].includes("meta_inovacao_plano_responsaveis")),
      },
    ],
  },
  {
    item: "2.7",
    fk: "corsario_status.projeto_id + .nucleo_id",
    textoLegado: "corsario_status.iniciativa + .nucleo (text)",
    leitura: [
      {
        arquivo: "js/db-corsario.js",
        como: "linhaParaStatus() expõe projeto_id/nucleo_id pra tela",
        ok: () => {
          const c = corpo(FONTES["js/db-corsario.js"], "linhaParaStatus");
          return tem(c, /projeto_id/) || tem(c, /nucleo_id/);
        },
      },
      {
        arquivo: "corsario.html",
        como: "a régua do Corsário casa por FK em vez de por iniciativa/nucleo (texto)",
        ok: () => tem(FONTES["corsario.html"], /projeto_id|nucleo_id/),
      },
    ],
    portas: [
      {
        nome: "primeira avaliação de um critério (editor.html → DB_CORSARIO.criar)",
        ancora: "payload de criar() em js/db-corsario.js",
        ok: () => {
          const c = corpo(FONTES["js/db-corsario.js"], "criar");
          return tem(c, /projeto_id/) && tem(c, /nucleo_id/);
        },
      },
      {
        nome: "+ Nova iniciativa (editor.html → DB_CORSARIO.criarIniciativa)",
        ancora: "payload de criarIniciativa() em js/db-corsario.js — 19 linhas de uma vez",
        ok: () => {
          const c = corpo(FONTES["js/db-corsario.js"], "criarIniciativa");
          return tem(c, /projeto_id/) && tem(c, /nucleo_id/);
        },
      },
    ],
  },
];

/* ---------------------------------------------------------------------------
 * Lacunas já conhecidas e registradas em docs/CAMADA5_AUDITORIA_FK.md e na
 * tabela da Camada 5 do plano. Chave: "<item> :: <nome da porta>".
 * ------------------------------------------------------------------------- */
// vazio desde 26/08/2026 — as 6 lacunas achadas pelo item 5.1 foram fechadas pelos
// itens 5.5 (2.1), 5.6 (2.6) e 5.7 (2.7) no mesmo dia. Histórico completo (o que cada
// uma era e como foi resolvida) em docs/PLANO_EXECUCAO_GOLDEN_RECORD.md, seção da
// Camada 5, "Como o 5.5/5.6/5.7 ficaram" — não repetido aqui pra não ter duas fontes
// da mesma informação. Corolário do 2.5: item resolvido esvazia a lista, nunca é a
// lista que é apagada.
const LACUNAS_REGISTRADAS = [];

/* Quem lê a FK hoje — probe por arquivo, não grep de token solto: `pessoa_id`
 * aparece em meia dúzia de tabelas diferentes, e contar isso como leitura daria
 * um retrato bonito e falso. Cada probe aponta pro trecho que de fato consome a
 * FK daquela tabela. */
function leitores(item) {
  return (item.leitura || []).filter((l) => l.ok()).map((l) => l.arquivo + " (" + l.como + ")");
}

const resultado = ITENS.map((it) => {
  const portas = it.portas.map((p) => ({ nome: p.nome, ancora: p.ancora, ok: !!p.ok() }));
  const lacunas = portas.filter((p) => !p.ok);
  return {
    item: it.item,
    fk: it.fk,
    textoLegado: it.textoLegado,
    portas: portas,
    lacunas: lacunas.map((p) => it.item + " :: " + p.nome),
    leitores: leitores(it),
    escritaCompleta: lacunas.length === 0,
  };
});

const lacunasAtuais = resultado.reduce((acc, r) => acc.concat(r.lacunas), []);
const novas = lacunasAtuais.filter((l) => !LACUNAS_REGISTRADAS.includes(l));
const sumidas = LACUNAS_REGISTRADAS.filter((l) => !lacunasAtuais.includes(l));

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ itens: resultado, lacunasAtuais, novas, sumidas }, null, 2));
} else {
  const L = [];
  L.push("Auditoria final de FK — Camadas 2 e 4 (item 5.1), metade B: caminho de escrita");
  L.push("=".repeat(78));
  L.push("Esta metade é estática: mede o CÓDIGO, não o banco. A cobertura das linhas que");
  L.push("já existem (metade A) sai de tools/sql/2026-08_auditoria_fk_final.sql, rodado");
  L.push("no SQL Editor — este ambiente não alcança o Supabase.");
  L.push("");
  resultado.forEach((r) => {
    L.push("[" + (r.escritaCompleta ? " OK  " : "LACUNA") + "] " + r.item + " — " + r.fk);
    L.push("        texto legado: " + r.textoLegado);
    r.portas.forEach((p) => {
      L.push("        " + (p.ok ? "grava " : "NÃO grava") + " · " + p.nome);
      if (!p.ok) L.push("               âncora: " + p.ancora);
    });
    if (r.leitores.length) {
      r.leitores.forEach((l, i) => L.push("        " + (i === 0 ? "lido hoje por: " : "               ") + l));
    } else {
      L.push("        lido hoje por: NINGUÉM — nenhuma tela consome esta FK; o site ainda lê só o texto legado");
    }
    L.push("");
  });
  L.push("=".repeat(78));
  L.push("Lacunas de escrita: " + lacunasAtuais.length + " (registradas: " + LACUNAS_REGISTRADAS.length + ")");
  if (novas.length) {
    L.push("");
    L.push("LACUNA NOVA — não estava registrada. Ou uma tela regrediu, ou nasceu uma porta");
    L.push("de entrada sem FK. Registre em docs/CAMADA5_AUDITORIA_FK.md e na tabela da");
    L.push("Camada 5 do plano antes de dar baixa:");
    novas.forEach((l) => L.push("  + " + l));
  }
  if (sumidas.length) {
    L.push("");
    L.push("LACUNA REGISTRADA QUE SUMIU — provavelmente foi corrigida e ninguém deu baixa.");
    L.push("Tire de LACUNAS_REGISTRADAS aqui e atualize docs/CAMADA5_AUDITORIA_FK.md:");
    sumidas.forEach((l) => L.push("  - " + l));
  }
  if (!novas.length && !sumidas.length) {
    L.push("Conjunto de lacunas idêntico ao registrado — nenhuma regressão, nenhuma baixa pendente.");
  }
  console.log(L.join("\n"));
}

if (process.argv.includes("--check")) {
  process.exit(novas.length || sumidas.length ? 1 : 0);
}
