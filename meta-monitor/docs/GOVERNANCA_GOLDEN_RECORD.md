# Governança do portfólio — Golden Record de Projetos & Iniciativas

## Decisão

**Golden record (fonte única da verdade) da lista de iniciativas/projetos:**

- **Dado:** tabela Supabase `meta_inovacao_projetos`
  (schema em `tools/sql/2026-08_migracao_modo_edicao.sql`).
- **Tela de governança (onde nasce, muda e morre uma iniciativa):**
  conjunto **"Projetos & Representantes"** da `editor.html`
  (CRUD ao vivo via `js/db-projetos.js` → `DB_PROJETOS`).

Campos canônicos por iniciativa: `nucleo`, `iniciativa`, `representantes[]`, `ordem`
(+ metadados `deleted_at` soft-delete, `updated_by`, `updated_at`).

**Regra de propagação escolhida:** *leitura ao vivo em tudo.* Toda tela e o
`js/drawer.js` passam a ler o portfólio via `DB_PROJETOS.carregar()` (Supabase),
usando `data/projetos.js` apenas como **fallback offline auto-regenerado** — nunca
mais como fonte editada à mão.

## O problema que estamos corrigindo

Antes desta frente havia **4 listas independentes** de iniciativas:

| Fonte | Nº | Papel |
|---|---|---|
| `meta_inovacao_projetos` (Supabase) | 27 | **golden record** (rica: núcleo + representantes) |
| `data/projetos.js` (estático) | 27 | lido por 8 telas + todos os drawers → defasava do golden |
| `data/iniciativas.js` (estático, só nomes) | 27 | eixo de linhas da matriz de demandas |
| `corsario_status` (Supabase) | 28 | fonte do Corsário (extra: "Salas do Empreendedor") |

Sintoma: editar no `editor.html` não refletia nas telas que liam o arquivo estático;
`demandas.html` mantinha o próprio elenco (add/remove por `prompt`); e o Corsário tem
uma iniciativa a mais.

## Plano de conformação (camadas)

### Camada 1 — Matriz de demandas obedece ao golden record  ✅ (em execução)
- `demandas.html` deriva o **eixo de linhas** de `DB_PROJETOS.carregar()` (golden),
  não mais de `DB.iniciativas`. As células de canal continuam em
  `meta_inovacao_matriz_demandas`, unidas por nome de iniciativa.
- Remove a criação/remoção de iniciativa dentro da `demandas.html` (iniciativa só
  nasce/morre no golden record). Aqui edita-se **só os canais**.
- Iniciativas com célula na matriz mas ausentes do golden aparecem sinalizadas como
  **"fora do portfólio"** (não somem em silêncio) — insumo para reconciliar.
- **Aposenta `data/iniciativas.js`** (removido de `demandas.html` e do `<script>`
  morto em `editor.html`; `editor.html` já derivava iniciativas do `corsario_status`).

### Camada 2 — Drawer e telas estáticas leem ao vivo  ✅ (feita)
- Novo bootstrap **`js/portfolio.js`** (`window.PORTFOLIO`) hidrata `window.DB.projetos`
  **no lugar** (muta o mesmo array) a partir do golden record via `DB_PROJETOS`, e dispara
  `portfolio:pronto`. `data/projetos.js` continua como seed instantâneo + fallback offline.
- `js/drawer.js` **não muda**: ele já lê `DB.projetos` na hora de abrir o painel, então
  passa a ver o dado vivo de graça assim que a hidratação roda.
- Telas que renderizam portfólio no load esperam `await PORTFOLIO.pronto` antes de montar:
  `index.html` (KPIs de portfólio) e `plano-acao.html` (nav de iniciativas).
- Telas que só abrem drawer sob demanda só ganharam os `<script>` de `js/db-projetos.js` +
  `js/portfolio.js`: `plano.html`, `agenda.html`, `participantes.html`, `minhas-acoes.html`,
  `caminho.html`, `corsario.html`, `demandas.html`.
- `projetos.html` já era ao vivo (usa `DB_PROJETOS.carregar()` direto) — intocada.
- Verificado no navegador: as 8 telas carregam sem erro; `DB.projetos` hidrata para 27 com
  `ordem`/`db_id` (campos que só existem na tabela, não no seed) → confirma leitura do golden.

### Camada 3 — Fallback auto-regenerado  ✅ (feita)
- Novo **`tools/publicar_seed_projetos.js`**: lê `meta_inovacao_projetos` e reescreve
  `data/projetos.js` (sentido inverso do `gerar_seed_supabase.js`). `--check` sai 1 se o
  seed estiver defasado do golden (pra CI/testes).
- Ao rodar, revelou e corrigiu drift real que estava dormente no seed: **ALI Rural**
  `Júnior`→`Jr.` e **Consult** `Matheus`→`Carol` (valores editados no golden que o seed
  estático nunca recebeu).
- Regressão da camada 1 corrigida de tabela: `tools/validar_dados.py` lia o extinto
  `data/iniciativas.js`; passou a derivar a lista canônica de `data/projetos.js`.

### Camada 4 — Reconciliar Corsário (27 × 28) + limpezas
- **"Salas do Empreendedor" — SAIR de todo o projeto (decidido Aug/2026).** Vive só na
  tabela `corsario_status` (Supabase) → migração `tools/sql/2026-08_remover_salas_empreendedor.sql`
  (rodar no SQL editor; hard delete com diagnóstico antes/depois). Não está em nenhum
  `data/*.js`. Referências textuais restantes: `tools/gerar_dados.py` (gerador legado) e
  comentários de `tools/testar_iniciativas_cruzado.js`.
- **Núcleo "fantasma" `Gestão do Conhecimento e Processos`:** decidido **MANTER** (Aug/2026).
  Não é puramente fantasma — tem 0 projetos, mas **2 pessoas reais** (Lara Chicuta Franco,
  Sandra Chaves Silva Paraíso) em `data/pessoas.js` + `meta_inovacao_pessoas`. Ter 0 projetos
  no portfólio não é erro de dado; o núcleo continua no whitelist. Nada a fazer.
- **Representantes órfãos:** conferido no navegador — das 34 instâncias, só **1** não
  resolve para id canônico: `"Núcleo de Startups"` (Sebrae Startups), que é o **placeholder
  intencional** de "aguarda indicação nominal" (index.html trata `/^núcleo de/i`). Ou seja,
  não há órfão acidental para limpar.
- **`tools/gerar_dados.py`:** **APOSENTADO/deletado** (Aug/2026). Era gerador legado NÃO
  referenciado em lugar nenhum que, se rodado, recriava o extinto `data/iniciativas.js` e
  reintroduzia dados de portfólio defasados (incl. "Salas do Empreendedor"). Superado pelo
  golden record + `publicar_seed_projetos.js`.

## Status
- Camada 1: ✅ feita e verificada.
- Camada 2: ✅ feita e verificada.
- Camada 3: ✅ feita e verificada (tool `publicar_seed_projetos.js`, `--check` verde).
- Camada 4: ✅ resolvida (código/repo) —
  - Salas do Empreendedor: fora do repo; migração SQL escrita, **falta só rodar no Supabase**
    (`tools/sql/2026-08_remover_salas_empreendedor.sql` — write que só o usuário faz).
  - Núcleo fantasma: **mantido** (tem 2 pessoas reais).
  - `gerar_dados.py`: **deletado**.
  - Representantes órfãos: nada a fazer (só o placeholder intencional não resolve).
