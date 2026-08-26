/* Lista de responsáveis (pessoa OU coletivo) usada por plano-acao.html e
 * minhas-acoes.html — golden record de cadastros de referência, Camada 4, item 4.3.
 *
 * Substitui window.DB.responsaveis (data/pessoas.js, lista estática de 32 ids mantida
 * à mão) como fonte do <select> de "Responsável"/"Ver como": a lista agora é MONTADA,
 * na hora de carregar a tela, a partir de DB_PESSOAS.carregar() + DB_COLETIVOS.carregar()
 * (golden record das Camadas 0/1) — mesmo princípio de "cadastra e aparece sozinho" das
 * outras camadas: uma pessoa/coletivo novo cadastrado na aba "Pessoas"/"Coletivos" do
 * editor.html aparece aqui sem editar este arquivo.
 *
 * Não é um wrapper de tabela Supabase (não existe meta_inovacao_responsaveis) — é
 * função pura sobre listas já carregadas, sem rede nem DOM, testável via node (mesmo
 * padrão de js/calc.js e js/responsaveis.js). O nome "DB_" segue a convenção dos outros
 * módulos de dado do site (js/db-*.js), não a convenção de CRUD.
 *
 * COMPATIBILIDADE com o que já está gravado: plano_acao_atividades.responsavel e
 * meta_inovacao_plano_acoes.responsavel_id guardam, hoje, os 32 ids antigos de
 * window.DB.responsaveis ("jr", "comite", "gabriel_barreto_barros"...) — Camada 5 decide
 * se esse texto é migrado, não este item. Por isso os 32 ids antigos são preservados
 * EXATAMENTE (LEGADO abaixo — mesma tradução id → pessoa/coletivo já usada e confirmada
 * em tools/sql/2026-08_plano_responsaveis.sql, item 2.6, já rodada em produção). Uma
 * pessoa/coletivo cadastrado DEPOIS disso ganha id novo ("pessoa:<id>"/"coletivo:<id>",
 * a chave primária do golden record) — LEGADO não cresce nunca.
 *
 * DECISÃO da UX dos ids duplicados, adiada da Camada 1 pra esta (ver
 * PLANO_EXECUCAO_GOLDEN_RECORD.md, notas da Camada 4): "jr"/"jose_mendes_junior" e
 * "sandra"/"sandra_chaves_paraiso" já resolviam pra MESMA pessoa golden desde o item 2.6
 * — a partir daqui viram 1 única opção no select (id canônico "jr"/"sandra"), com o id
 * "extra" guardado em aliasIds só pra reconhecer dado já gravado com o outro id (pré-
 * seleciona certo; a próxima gravação já sai com o id canônico, sem precisar migrar nada).
 */
(function (root) {
  "use strict";
  const DB_RESPONSAVEIS = {};

  const LEGADO = {
    jr:                     { tipo: "pessoa",   nome: "JR.",      grupo: "Coordenação" },
    sandra:                 { tipo: "pessoa",   nome: "Sandra",   grupo: "Coordenação" },
    anny:                   { tipo: "pessoa",   nome: "Anny",     grupo: "Coordenação" },
    pova:                   { tipo: "pessoa",   nome: "Pova",     grupo: "Coordenação" },
    gerencia:               { tipo: "coletivo", nome: "Gerência UI",           grupo: "Coletivo" },

    comite:                 { tipo: "coletivo", nome: "Comitê",                grupo: "Coletivo" },
    urc:                    { tipo: "coletivo", nome: "URC",                   grupo: "Coletivo" },
    solucoes:               { tipo: "coletivo", nome: "Soluções",              grupo: "Coletivo" },
    coordenadores:          { tipo: "coletivo", nome: "Coordenadores",         grupo: "Coletivo" },
    gestores:               { tipo: "coletivo", nome: "Gestores dos projetos", grupo: "Coletivo" },

    gabriel_barreto_barros: { tipo: "pessoa", nome: "Gabriel", grupo: "Núcleos" },
    hulda_giesbrecht:       { tipo: "pessoa", nome: "Hulda",   grupo: "Núcleos" },
    lara_chicuta_franco:    { tipo: "pessoa", nome: "Lara",    grupo: "Núcleos" },
    marcus_lopes_bezerra:   { tipo: "pessoa", nome: "Marcus",  grupo: "Núcleos" },
    matheus_queiroz_campos: { tipo: "pessoa", nome: "Matheus", grupo: "Núcleos" },
    paulo_puppin_zandonadi: { tipo: "pessoa", nome: "Paulo",   grupo: "Núcleos" },
    sandra_chaves_paraiso:  { tipo: "pessoa", nome: "Sandra",  grupo: "Núcleos", aliasDe: "sandra" },
    jose_mendes_junior:     { tipo: "pessoa", nome: "JR.",     grupo: "Núcleos", aliasDe: "jr" },

    agnaldo:  { tipo: "pessoa", nome: "Agnaldo",  grupo: "Projetos" },
    carol:    { tipo: "pessoa", nome: "Carol",    grupo: "Projetos" },
    cris:     { tipo: "pessoa", nome: "Cris",     grupo: "Projetos" },
    dario:    { tipo: "pessoa", nome: "Dario",    grupo: "Projetos" },
    felipe:   { tipo: "pessoa", nome: "Felipe",   grupo: "Projetos" },
    fernanda: { tipo: "pessoa", nome: "Fernanda", grupo: "Projetos" },
    fred:     { tipo: "pessoa", nome: "Fred",     grupo: "Projetos" },
    jessica:  { tipo: "pessoa", nome: "Jéssica",  grupo: "Projetos" },
    rafa:     { tipo: "pessoa", nome: "Rafa",     grupo: "Projetos" },
    raquel:   { tipo: "pessoa", nome: "Raquel",   grupo: "Projetos" },
    thiago:   { tipo: "pessoa", nome: "Thiago",   grupo: "Projetos" },
    valeria:  { tipo: "pessoa", nome: "Valéria",  grupo: "Projetos" },
    webia:    { tipo: "pessoa", nome: "Wébia",    grupo: "Projetos" },
  };
  DB_RESPONSAVEIS.LEGADO = LEGADO;

  // ordem de exibição dos grupos no select — mesma ordem visual de sempre (Coordenação,
  // Coletivo, Núcleos, Projetos), com "URC" entrando depois de Núcleos: são pessoas do
  // golden record que nunca estiveram na lista estática (só liderança/canais da URC),
  // ficam disponíveis como responsável a partir de agora (mesmo princípio de "cadastra e
  // aparece sozinho" — não é regressão, é a lista de pessoas ficando mais completa).
  const ORDEM_GRUPOS = ["Coordenação", "Coletivo", "Núcleos", "URC", "Projetos", "Outros"];
  DB_RESPONSAVEIS.ORDEM_GRUPOS = ORDEM_GRUPOS;

  function normalizarChave(s) {
    return String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  }

  // só pessoas ativas E com nome_exibicao preenchido entram como opção — o golden record
  // só marca nome_exibicao pra gente física de verdade; "Gerência UI" continua sem
  // nome_exibicao de propósito, porque virou coletivo, não pessoa (ver
  // tools/sql/2026-08_coletivos_gerencia_ui.sql) — filtrar por isso evita um "pessoa
  // fantasma" duplicando a opção do coletivo "Gerência UI" na lista.
  function pessoasSelecionaveis(pessoas) {
    return (pessoas || []).filter((p) => p.ativo !== false && p.nome_exibicao);
  }

  // agrupa as linhas duplicadas (mesma pessoa física, uma linha por grupo/papel —
  // Camada 1 do golden record) por nome_exibicao normalizado — é o campo que a migração
  // 2026-08_pessoas_golden.sql garante ser o MESMO em toda linha da mesma pessoa (ver
  // docs/CAMADA1_DEDUPE_PESSOAS.md), então serve de chave de identidade sem precisar de
  // pessoa_papeis (que nenhuma tela ainda lê).
  function agruparPorPessoa(pessoas) {
    const porIdentidade = new Map();
    pessoasSelecionaveis(pessoas).forEach((p) => {
      const chave = normalizarChave(p.nome_exibicao);
      if (!porIdentidade.has(chave)) porIdentidade.set(chave, []);
      porIdentidade.get(chave).push(p);
    });
    return porIdentidade;
  }

  function grupoDaPessoa(linhas) {
    const grupos = linhas.map((l) => l.grupo);
    if (grupos.includes("UI")) return "Coordenação";
    if (grupos.includes("Núcleos")) return "Núcleos";
    if (grupos.includes("URC")) return "URC";
    if (grupos.includes("Projetos")) return "Projetos";
    return "Outros";
  }

  // chave estável pro id novo ("pessoa:<chave>"/"coletivo:<chave>") — db_id de verdade
  // quando a linha veio do Supabase; nome normalizado no fallback offline (data/pessoas.js/
  // data/coletivos.js, que não carregam db_id — ver js/db-pessoas.js/js/db-coletivos.js).
  function chaveNova(row) { return row.db_id != null ? String(row.db_id) : normalizarChave(row.nome); }

  /* Monta a lista de responsáveis (pessoa OU coletivo) a partir do golden record já
   * carregado (DB_PESSOAS.carregar().lista, DB_COLETIVOS.carregar().lista). Pura — sem
   * rede, sem DOM. */
  DB_RESPONSAVEIS.montar = function (pessoas, coletivos) {
    const porIdentidade = agruparPorPessoa(pessoas);
    const porNomeColetivo = new Map();
    (coletivos || []).forEach((c) => porNomeColetivo.set(normalizarChave(c.nome), c));

    const usadosPessoa = new Set();   // chave de identidade já coberta por um id do LEGADO
    const usadosColetivo = new Set(); // nome normalizado de coletivo já coberto pelo LEGADO
    const porEntrada = new Map();     // "tipo:chave" -> entrada (junta ids duplicados do LEGADO, ex. jr/jose_mendes_junior)

    function entradaDe(tipo, chave, base) {
      const k = tipo + ":" + chave;
      let e = porEntrada.get(k);
      if (!e) { e = Object.assign({ id: null, aliasIds: [], tipo: tipo }, base); porEntrada.set(k, e); }
      return e;
    }

    // 1) ids do LEGADO — preserva EXATAMENTE (dado já gravado depende disso)
    Object.keys(LEGADO).forEach((id) => {
      const alvo = LEGADO[id];
      const chave = normalizarChave(alvo.nome);
      if (alvo.tipo === "pessoa") {
        const linhas = porIdentidade.get(chave);
        if (!linhas) return; // pessoa inativa/removida do golden record, ou fallback offline sem essa linha
        usadosPessoa.add(chave);
        const e = entradaDe("pessoa", chave, { nome: alvo.nome, grupo: alvo.grupo, dbId: chaveNova(linhas[0]) });
        if (alvo.aliasDe) e.aliasIds.push(id); else e.id = id; // id primário só quando NÃO é apelido de outro
      } else {
        const coletivo = porNomeColetivo.get(chave);
        if (!coletivo) return; // coletivo ainda não existe nesta base (ex.: fallback offline sem "Gerência UI")
        usadosColetivo.add(chave);
        const e = entradaDe("coletivo", chave, { nome: alvo.nome, grupo: alvo.grupo, dbId: chaveNova(coletivo) });
        e.id = id;
      }
    });

    // 2) pessoas/coletivos golden que ainda não têm id do LEGADO — "cadastra e aparece
    //    sozinho": ganham id novo, baseado na chave primária real do golden record.
    porIdentidade.forEach((linhas, chave) => {
      if (usadosPessoa.has(chave)) return;
      const e = entradaDe("pessoa", chave, { nome: linhas[0].nome_exibicao, grupo: grupoDaPessoa(linhas), dbId: chaveNova(linhas[0]) });
      if (!e.id) e.id = "pessoa:" + chaveNova(linhas[0]);
    });
    porNomeColetivo.forEach((coletivo, chave) => {
      if (usadosColetivo.has(chave)) return;
      const e = entradaDe("coletivo", chave, { nome: coletivo.nome, grupo: "Coletivo", dbId: chaveNova(coletivo) });
      if (!e.id) e.id = "coletivo:" + chaveNova(coletivo);
    });

    const lista = Array.from(porEntrada.values()).filter((e) => e.id); // descarta entrada que só tinha apelido, sem id primário (não deveria acontecer)
    lista.sort((a, b) => {
      const oa = ORDEM_GRUPOS.indexOf(a.grupo), ob = ORDEM_GRUPOS.indexOf(b.grupo);
      if (oa !== ob) return (oa === -1 ? 99 : oa) - (ob === -1 ? 99 : ob);
      return a.nome.localeCompare(b.nome, "pt-BR");
    });
    return lista;
  };

  // acha a entrada (pra pré-seleção do <option selected>) cujo id OU algum aliasId bate
  // com o texto já gravado no Supabase — quando não acha nada, o chamador decide como
  // tratar (mesmo padrão "legado" já usado em plano-acao.html antes deste item).
  DB_RESPONSAVEIS.encontrar = function (lista, valor) {
    if (!valor) return null;
    return (lista || []).find((e) => e.id === valor || (e.aliasIds || []).includes(valor)) || null;
  };

  // todos os ids que valem como "esta pessoa/coletivo" pra filtrar contra dado já
  // gravado (id canônico + apelidos) — usado por minhas-acoes.html pra achar
  // atividades/ações gravadas com o id "extra" (ex. "jose_mendes_junior"), sem
  // reescrever nada e sem depender mais do casamento de texto de js/responsaveis.js.
  DB_RESPONSAVEIS.idsEquivalentes = function (lista, id) {
    const e = DB_RESPONSAVEIS.encontrar(lista, id);
    return e ? [e.id].concat(e.aliasIds || []) : [id];
  };

  if (typeof module !== "undefined" && module.exports) module.exports = DB_RESPONSAVEIS;
  else root.DB_RESPONSAVEIS = DB_RESPONSAVEIS;
})(this);
