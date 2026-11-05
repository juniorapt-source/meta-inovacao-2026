/* Camada de dados do conjunto PROJETOS ("Correções v0.18.x") — window.DB_PROJETOS.
 *
 * Lê de meta_inovacao_projetos no Supabase; cai pra window.DB.projetos (data/projetos.js,
 * SEED + fallback) se a rede falhar. O mecanismo comum (fallback, memoização, modo de
 * teste ?semrede=1/CC_FORCAR_FALLBACK, bloqueio de escrita em teste) vive em
 * js/db-base.js desde o item D4.1 — API pública inalterada (item D4.3).
 *
 * PRECISA de js/db-base.js carregado antes.
 */
(function (root) {
  "use strict";

  const BASE = root.DB_BASE || (typeof globalThis !== "undefined" && globalThis.DB_BASE);
  if (!BASE) throw new Error("js/db-projetos.js: js/db-base.js precisa ser carregado antes deste arquivo.");

  const TABELA = "meta_inovacao_projetos";

  // Onde o projeto aparece (v0.35.0, tools/sql/2026-11_projetos_visibilidade.sql). Uma coluna
  // boolean por tela, default true. O cadastro de projetos é a única fonte: cada tela lista
  // os projetos com a sua marca ligada. `rotulo` é o texto da caixa no editor.
  const VISIBILIDADE = [
    { k: "exibir_corsario",    rotulo: "Corsário",    titulo: "O Caminho para o Corsário (corsario.html)" },
    { k: "exibir_sites",       rotulo: "Sites",       titulo: "Sites (sites.html)" },
    { k: "exibir_paineis",     rotulo: "Painéis",     titulo: "Painéis (paineis.html)" },
    { k: "exibir_fluxo_dados", rotulo: "Fluxo",       titulo: "Fluxo de dados (fluxo-dados.html)" },
    { k: "exibir_atividades",  rotulo: "Atividades",  titulo: "Atividades por iniciativa (plano-acao.html)" },
    { k: "exibir_matriz",      rotulo: "Matriz",      titulo: "Matriz de demandas (demandas.html)" },
    { k: "exibir_canva",       rotulo: "Canva",       titulo: "Canva das oficinas (canva.html e canva-consolidado.html)" },
  ];
  const CHAVES_VIS = VISIBILIDADE.map((v) => v.k);

  // true se o projeto aparece naquela tela. Sem a coluna (script SQL ainda não rodado, ou
  // seed local) vale true — nada some por falta do campo.
  function exibir(p, chave) { return !p || p[chave] !== false; }
  // true quando a lista veio do banco JÁ com as colunas de visibilidade. Telas que mudam de
  // fonte (Corsário, Sites, Painéis) só passam a ler do cadastro quando isto é true; antes
  // disso continuam como eram.
  function temVisibilidade(lista) { return !!(lista && lista.length && lista.every((p) => p._visNoBanco)); }

  // Agrupa linhas de outra tabela (ex.: corsario_status) pelos projetos visíveis numa tela.
  // Casa por projeto_id e, para linha sem projeto_id, pelo nome (sem caixa/espaços nas pontas).
  // Devolve um item por projeto visível, na ordem da lista, mesmo sem linha nenhuma; linhas
  // de projeto escondido ou fora do cadastro ficam de fora.
  function agruparPorProjeto(linhas, projetos, chave) {
    const nome = (x) => String(x == null ? "" : x).trim().toLowerCase();
    const grupos = (projetos || []).filter((p) => exibir(p, chave)).map((p) => ({ projeto: p, linhas: [] }));
    const porId = new Map(), porNome = new Map();
    grupos.forEach((g) => {
      if (g.projeto.db_id != null) porId.set(String(g.projeto.db_id), g);
      if (!porNome.has(nome(g.projeto.iniciativa))) porNome.set(nome(g.projeto.iniciativa), g);
    });
    (linhas || []).forEach((r) => {
      const g = (r.projeto_id != null && porId.get(String(r.projeto_id))) || (r.projeto_id == null && porNome.get(nome(r.iniciativa)));
      if (g) g.linhas.push(r);
    });
    return grupos;
  }

  function linhaParaProjeto(r) {
    const p = {
      nucleo: r.nucleo,
      // nucleo_id (Camada 2, item 2.1) — lido desde sempre (a migração já populava),
      // mas só passou a ser GRAVADO por este módulo no item 5.5; até lá só
      // sobrevivia por causa do UPDATE original, e uma troca de núcleo feita pelo
      // <select> de editor.html derivava (texto mudava, FK ficava presa no valor
      // antigo) — é o que o 5.1 achou.
      nucleo_id: r.nucleo_id || null,
      iniciativa: r.iniciativa,
      representantes: r.representantes || [],
      ordem: r.ordem,
      db_id: r.id,
    };
    CHAVES_VIS.forEach((k) => { if (k in r) p[k] = r[k] !== false; });
    if ("exibir_corsario" in r) p._visNoBanco = true;
    return p;
  }

  function projetoParaLinha(p) {
    const linha = {
      nucleo: p.nucleo,
      nucleo_id: p.nucleo_id || null,
      iniciativa: p.iniciativa,
      representantes: p.representantes || [],
      ordem: p.ordem,
    };
    // só manda as marcas que o chamador definiu — assim criar() continua funcionando antes do
    // script SQL rodar (o banco não teria as colunas) e, depois dele, o default true do banco vale
    CHAVES_VIS.forEach((k) => { if (typeof p[k] === "boolean") linha[k] = p[k]; });
    return linha;
  }

  const api = BASE.criarWrapper({
    nome: "db-projetos",
    raiz: root,
    tabela: TABELA,
    ordem: "ordem",
    linhaPara: linhaParaProjeto,
    paraLinha: projetoParaLinha,
    seed: function () { return ((root.DB && root.DB.projetos) || []).slice(); },
    avisoFalha: "db-projetos: falha ao carregar do Supabase, caindo pro seed local (data/projetos.js)",
  });

  root.DB_PROJETOS = {
    TABELA: TABELA,
    carregar: api.carregar,
    salvar: api.salvar,
    criar: api.criar,
    removerSoft: api.removerSoft,
    projetoParaLinha: projetoParaLinha,
    VISIBILIDADE: VISIBILIDADE,
    exibir: exibir,
    temVisibilidade: temVisibilidade,
    agruparPorProjeto: agruparPorProjeto,
  };
})(this);
