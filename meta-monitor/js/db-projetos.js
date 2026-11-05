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

  // v0.36.0 — ligação por projeto_id (tools/sql/2026-11_projeto_id_ligacao.sql) nas tabelas
  // que guardavam só o nome: plano_acao_atividades, meta_inovacao_iniciativa_links,
  // fluxo_dados_rotas, fluxo_dados_paineis (e meta_inovacao_canva_demandas, que já tinha).
  //
  // resolvedor(projetos) devolve uma função linha -> projeto do cadastro (ou null): casa por
  // projeto_id e, para linha sem projeto_id, pelo nome (sem caixa/espaços nas pontas).
  // `campoNome` é a coluna de texto da linha ("iniciativa"; no Canva, "projeto").
  function resolvedor(projetos, campoNome) {
    const campo = campoNome || "iniciativa";
    const nome = (x) => String(x == null ? "" : x).trim().toLowerCase();
    const porId = new Map(), porNome = new Map();
    (projetos || []).forEach((p) => {
      if (!p) return;
      if (p.db_id != null) porId.set(String(p.db_id), p);
      if (p.iniciativa && !porNome.has(nome(p.iniciativa))) porNome.set(nome(p.iniciativa), p);
    });
    return function (linha) {
      if (!linha) return null;
      if (linha.projeto_id != null) {
        const p = porId.get(String(linha.projeto_id));
        if (p) return p;
      }
      return porNome.get(nome(linha[campo])) || null;
    };
  }

  // Filtro PostgREST "do projeto": linhas com o projeto_id OU, sem projeto_id, com o nome.
  // Serve tanto pro .or() do supabase-js quanto pra query string crua (or=(...)).
  function aspas(v) { return '"' + String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"'; }
  function filtroDoProjeto(projetoId, nome, campoNome) {
    const campo = campoNome || "iniciativa";
    const porNome = campo + ".eq." + aspas(nome == null ? "" : nome);
    if (projetoId == null || projetoId === "") return porNome;
    return "projeto_id.eq." + Number(projetoId) + ",and(projeto_id.is.null," + porNome + ")";
  }

  // erro de "coluna não existe" — o script de projeto_id ainda não rodou (42703 no Postgres,
  // PGRST204 no cache do PostgREST). Quem consulta por projeto_id cai pro nome nesse caso.
  function faltaColunaProjetoId(err) {
    if (!err) return false;
    const c = String(err.code || "");
    const msg = String(err.message || err.details || err).toLowerCase();
    return c === "42703" || c === "PGRST204" || (msg.indexOf("projeto_id") !== -1 && (msg.indexOf("does not exist") !== -1 || msg.indexOf("could not find") !== -1));
  }

  // Renomear no editor: leva o nome novo pras tabelas que ainda são lidas pelo nome. Depois
  // do script SQL, o gatilho cc_propagar_nome_projeto já fez isto no banco e aqui não sobra
  // linha com o nome velho (0 linhas, sem efeito). Antes do script, é o que evita que
  // atividades, Sites/Painéis e Fluxo de dados fiquem órfãos. O Canva não entra: o site
  // não tem UPDATE direto nele (só o gatilho do banco alcança).
  // Devolve a lista de tabelas que falharam (vazia = tudo certo).
  const TABELAS_COM_NOME = [
    { tabela: "plano_acao_atividades", autoria: true },
    { tabela: "meta_inovacao_iniciativa_links", autoria: true },
    { tabela: "fluxo_dados_rotas", autoria: false },
    { tabela: "fluxo_dados_paineis", autoria: false },
  ];
  async function propagarNome(nomeAntes, nomeDepois, usuario) {
    if (!nomeAntes || !nomeDepois || nomeAntes === nomeDepois) return [];
    if (BASE.forcarFallback && BASE.forcarFallback(root)) return [];
    const supa = await root.CC_SUPABASE.obterClienteEsm();
    const falhas = [];
    for (const t of TABELAS_COM_NOME) {
      const patch = { iniciativa: nomeDepois };
      if (t.autoria) patch.updated_by = usuario || null;
      try {
        const r = await supa.from(t.tabela).update(patch).eq("iniciativa", nomeAntes);
        if (r.error) throw r.error;
      } catch (err) {
        console.error("db-projetos: falha ao levar o nome novo para " + t.tabela, err);
        falhas.push(t.tabela);
      }
    }
    return falhas;
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
    resolvedor: resolvedor,
    filtroDoProjeto: filtroDoProjeto,
    faltaColunaProjetoId: faltaColunaProjetoId,
    propagarNome: propagarNome,
    TABELAS_COM_NOME: TABELAS_COM_NOME.map((t) => t.tabela),
  };
})(this);
