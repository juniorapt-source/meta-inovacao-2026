# Changelog

## v0.17.1 — 2026-08-13
Corrige ordem de carregamento de `js/config.js` antes de `js/db-plano.js`/`js/db-agenda.js`.

Depois da correção dos GRANTs (nota "Correção pós-ativação" na v0.17.0 abaixo), o 401
sumiu mas apareceu outro erro no console: `Error: js/config.js não carregado — falta
window.APP_CONFIG` (`supabase.js:25`, disparado de dentro de `buscarDoSupabase()` em
`db-plano.js`). Causa raiz: `js/config.js` — o arquivo que define
`window.APP_CONFIG` (URL + anon key do Supabase), sem o qual `js/supabase.js` não monta
client nenhum — **não estava sendo carregado** em `index.html`, `caminho.html`,
`agenda.html` e `editor.html` (tag `<script>` ausente, não é questão de ordem: faltava o
`<script src="js/config.js">` inteiro). Em `minhas-acoes.html` a tag existia, mas
posicionada depois de `js/db-plano.js` no documento — não chegava a quebrar nada de fato
(o `<script>` final que chama `DB_PLANO.carregar()` só roda depois que todas as tags
anteriores, incluindo a de `js/config.js`, já executaram), mas ficava inconsistente com
o resto do site. `plano.html` já estava correto e não mudou.

- **`index.html`, `caminho.html`, `agenda.html`, `editor.html`** — adicionado
  `<script src="js/config.js"></script>` logo depois de `data/config.js` e antes de
  `js/gate.js`/`js/supabase.js`/`js/db-plano.js`/`js/db-agenda.js` (mesma posição de
  `plano.html`, `participantes.html` e `projetos.html`, que já estavam certos).
- **`minhas-acoes.html`** — `js/config.js` movido do fim da lista de scripts pra logo
  depois de `data/config.js`, mesma posição das outras páginas.
- Nenhum `defer`/`async` em nenhum desses `<script>` (confirmado) — o bug era 100%
  ausência/posição da tag, não um problema de carregamento assíncrono; não havia
  nenhuma chamada a `APP_CONFIG` em tempo de módulo (top-level) fora de uma função, então
  não foi necessário nenhum guard `if (!window.APP_CONFIG) return`.
- Suíte completa (headless + node) permanece verde — esses testes forçam
  `window.CC_FORCAR_FALLBACK`/`?semrede=1`, então não bateram nesse bug (o fallback local
  nunca chega a chamar `buscarDoSupabase()`). Validado à parte com um script CDP ad-hoc
  que abre as 6 páginas SEM `?semrede=1` (rede real) e confere que nenhuma emite mais o
  erro "js/config.js não carregado" — confirmado limpo nas 6, e sem nenhuma outra
  exceção nova (o que também confirma, de quebra, que o GRANT da correção anterior está
  funcionando de ponta a ponta em produção).

## v0.17.0 — 2026-08-13
Prompt 10 do plano de melhorias (item 3.1, "ajustado"): unificação da persistência —
PLANO e AGENDA saem de `data/*.js` e passam a viver no Supabase, com `data/plano.js`/
`data/agenda.js` virando seed + fallback de leitura. `nos`, `projetos`, `pessoas`,
`matriz`, `config` continuam só em `data/*.js`, como sempre. Código pronto e testado;
as duas tabelas ainda **não foram criadas** no Supabase — ver "Como ativar" no rodapé
(não executei o SQL: só tenho a anon key, sem permissão de DDL; mesma situação da
v0.16.0/P3, onde o JR. rodou o SQL manualmente).

- **`tools/sql/2026-08_plano.sql`** e **`tools/sql/2026-08_agenda.sql`** (gerados, não
  executados) — criam `meta_inovacao_plano_acoes` e `meta_inovacao_agenda_encontros`
  (nomes seguindo o prefixo `meta_inovacao_` já usado por `meta_inovacao_matriz_demandas`,
  reaproveitando a convenção em vez de inventar uma nova), com o mesmo padrão de RLS do
  P3: remoção dinâmica de qualquer policy existente (`pg_policies`), SELECT público, e
  INSERT/UPDATE exigindo `x-cc-token` — sem policy de DELETE (soft delete via
  `deleted_at`, mesmo padrão de `plano_acao_atividades`). As duas reaproveitam
  `cc_touch_updated_at()` se já existir (criada no P3) ou criam se não. As colunas de
  status guardam as chaves canônicas de `js/status.js` (contexto `"acao"` em
  `meta_inovacao_plano_acoes`, `"encontro"` em `meta_inovacao_agenda_encontros"`) — não é
  vocabulário novo. `meta_inovacao_plano_acoes` ganhou colunas além do pedido literal do
  prompt (`dependencias`, `cc_tipo`/`no_critico`, `como`/`monitor`/`ferramenta`) pra não
  perder o bloco "Depende de/solução proposta" de `plano.html` nem os chips ★Nó/cadeia/SLA
  de `caminho.html`; `meta_inovacao_agenda_encontros` funde `local`+`modo` num campo só
  (`local_modo`), `confirmados`+`convidados` também (`confirmacoes`, texto livre "3/5") e
  "hora" (sempre vazia até hoje) dentro de `turno` — 4 colunas em vez de 6, sem perder
  informação nenhuma. Cada script tem um cabeçalho longo documentando essas decisões e
  20/47 linhas de seed geradas de `data/plano.js`/`data/agenda.js` (`tools/gerar_seed_supabase.js`,
  novo, não faz parte do site — só gera SQL).
- **`js/db-plano.js`** e **`js/db-agenda.js`** (novos) — `window.DB_PLANO`/`window.DB_AGENDA`:
  `.carregar()` busca do Supabase (via `CC_SUPABASE.obterClienteEsm()`) e traduz cada linha
  pro MESMO formato de objeto que o site sempre usou (`id`/`frente`/`sub`/`atividade`/
  `resp`/`prazo`/`status`/... pro plano; `id`/`ciclo`/`canal`/`data`/`status`/... pra
  agenda) — o resto do código (`js/calc.js`, `js/core.js`, filtros de `plano.html`,
  `js/timeline.js`) não precisa saber que o dado agora vem de outro lugar. Se a chamada
  falhar (rede fora do ar, tabela ainda não criada, `file://`), cai sozinho pro seed local
  (`window.DB.plano`/`window.DB.agenda.encontros`) e devolve `usandoFallback:true` — cada
  página mostra um aviso discreto ("dados locais — pode haver defasagem") quando isso
  acontece. `.salvar()`/`.criar()`/`.removerSoft()` (plano) e `.salvar()`/`.removerSoft()`
  (agenda, sem `.criar()` — não existe UI de "novo encontro", são sempre os mesmos 20)
  ficam só pro `editor.html`.
- **`index.html`, `plano.html`, `caminho.html`, `minhas-acoes.html`** — trocaram
  `window.DB.plano` por `await DB_PLANO.carregar()` uma vez no topo da IIFE (viraram
  `async function`); `agenda.html` idem com `DB_AGENDA.carregar()` (+ `DB_PLANO.carregar()`
  também, só pro aviso do Nó 1/CAN-02). Nenhum cálculo mudou — `js/calc.js`, `stClass`,
  filtros e ordenação continuam exatamente os mesmos, só recebendo a lista carregada em
  vez de ler `DB.plano` direto. `js/timeline.js` ajustado pro novo formato combinado
  (`e.localModo`/`e.confirmacoes` em vez de `e.local`/`e.modo`/`e.confirmados`/`e.convidados`).
  **Limitação conhecida, deixada de propósito**: `js/drawer.js` (painel de Pessoa/
  Iniciativa) e `js/busca.js` (índice de busca global) continuam lendo o seed síncrono
  (`window.DB.plano`/`window.DB.agenda.encontros`) em vez do dado ao vivo — não entraram
  no escopo desta migração; se algum dia o plano/agenda mudar no Supabase sem um reload da
  página, esses dois pontos especificamente não refletem na hora.
- **`editor.html`** — "Plano de ação" e "Agenda" saem do modelo "edita cópia local → baixa
  `data/*.js` → substitui no repo" e viram CRUD ao vivo, mesmo padrão de
  `plano-acao.html`/`demandas.html`: cada campo grava direto no Supabase ao perder o foco
  (`change`), com indicador por linha ("salvando…"/"salvo"/motivo do erro). Editor único —
  hoje só o JR. usa o Modo edição — então essas duas linhas saíram sem rede de segurança de
  revisão por download, igual `demandas.html` desde a v0.3.0. "+ Nova atividade" do plano
  continua existindo, agora gravando via `DB_PLANO.criar()` em vez de só empilhar num array
  local; Agenda não ganhou "+ Novo encontro" (não existia antes, fora de escopo). Matriz,
  Pessoas, Projetos e URC continuam exatamente no modelo antigo (baixar/substituir/publicar).
  "Como publicar a mudança" no rodapé passa a ser dinâmico conforme o conjunto selecionado.
- **Testes headless adaptados pra não depender de rede** (item 3.1 exigia isso): toda
  sessão CDP que navega por página que lê plano/agenda injeta
  `window.CC_FORCAR_FALLBACK = true` antes do primeiro load
  (`Page.addScriptToEvaluateOnNewDocument`) — cobre inclusive navegação disparada por
  clique dentro da própria página (kpi-card do dashboard, Enter na busca, drawer), não só
  a URL inicial. Várias URLs de teste também levam `?semrede=1` como reforço redundante.
  Sem isso, `testar_dashboard_headless.js` falhava de verdade nesta sessão (o clique no
  KPI navegava pra `plano.html` sem forçar fallback, e a tentativa real de rede — tabela
  ainda não criada — não resolvia a tempo da checagem de 300ms).
- **Versão**: o prompt original citava "v0.8.0", desatualizado (a numeração já estava em
  v0.16.0) — bump seguiu a sequência real, v0.17.0, sem regredir.

**Como ativar** (⚠️ decisão/execução do JR., não deste commit):
  1. No SQL Editor do Supabase, rodar `tools/sql/2026-08_plano.sql` e depois
     `tools/sql/2026-08_agenda.sql` (nessa ordem — não dependem um do outro, mas os dois
     usam o mesmo token e a mesma função de trigger, então rodar plano primeiro deixa a
     função já criada pro segundo script reaproveitar via `CREATE OR REPLACE`).
  2. Cada script já vem com o token de escrita ATUAL preenchido (mesmo UUID de
     `data/config.js.tokenEscrita`, o mesmo do P3) em vez do placeholder — não precisa
     trocar nada antes de rodar.
  3. Conferir a linha de verificação no fim de cada script: 47 linhas em
     `meta_inovacao_plano_acoes`, 20 em `meta_inovacao_agenda_encontros`.
  4. Recarregar qualquer página do site — sem fazer mais nada, `js/db-plano.js`/
     `js/db-agenda.js` já passam a ler do Supabase (o `try/catch` que hoje cai no
     fallback simplesmente para de disparar). Nenhum outro passo de código necessário.

**Correção pós-ativação (2026-08-13):** os dois scripts acima, depois de rodados em
produção, se mostraram incompletos — faltava `GRANT SELECT, INSERT, UPDATE ... TO anon,
authenticated` e a policy de SELECT saiu com o nome `select_publico` em vez do padrão
`cc_select_publico`. Sem o GRANT, RLS nunca chega a ser avaliado (é a barreira anterior à
policy no Postgres), então o site recebia `401 permission denied for table` mesmo com a
policy de SELECT certa. Corrigido manualmente em produção (GRANT aplicado, policy
renomeada) e nos scripts versionados, pra ficarem coerentes com o banco real — **não
precisa rodar de novo** quem já rodou a versão anterior. Documentado o checklist completo
de toda tabela nova em `tools/sql/PADRAO_TABELA.md`, pra não repetir isso no P13
(`meta_inovacao_audit_log`) nem em qualquer tabela futura.

## v0.16.0 — 2026-08-13
Prompt 3 do plano de melhorias (item 2.1): proteção de escrita no Supabase por token
compartilhado. Código do site pronto; falta só rodar o SQL manualmente (não incluído
neste push — ver "Como ativar" no rodapé, é decisão operacional, não de código).

- **Tabelas com escrita client-side** (as únicas do repositório inteiro — conferido lendo
  todo `.insert(`/`.update(`/`.delete(`/`fetch` do site): `plano_acao_atividades`
  (`plano-acao.html`) e `meta_inovacao_matriz_demandas` (`demandas.html`, via
  `js/matriz-store.js`). `corsario_criterios`/`corsario_status` são só leitura — não
  entram na proteção porque não têm o que proteger.
- **`tools/sql/2026-08_protecao_escrita.sql`** (gerado, não executado — SQL sempre roda
  manualmente no Supabase, padrão do projeto) — pras 2 tabelas acima: remove qualquer
  policy de INSERT/UPDATE/DELETE existente hoje (busca dinâmica no catálogo do Postgres
  via `pg_policies`, não um nome adivinhado — os nomes atuais não estão documentados no
  repo) e cria policies novas exigindo
  `current_setting('request.headers', true)::json->>'x-cc-token' = '<TOKEN>'`. SELECT
  intocado nas duas (leitura pública continua igual). Token como placeholder claramente
  marcado (`SUBSTITUIR_PELO_TOKEN_UUID`, repetido em cada policy); bloco de reversão
  comentado logo depois de cada tabela.
- **`js/supabase.js`** (novo) — client Supabase centralizado, `window.CC_SUPABASE`. Antes
  deste módulo, 3 lugares diferentes criavam client cada um do seu jeito
  (`js/matriz-store.js` via SDK clássica do CDN; `plano-acao.html`/`minhas-acoes.html`
  via `import()` dinâmico da lib ESM, cada uma com sua cópia da função). As duas formas
  de carregar a lib continuam existindo (trocar isso tocaria em mais código do que o
  necessário), mas agora as DUAS passam pelo módulo novo, que sempre configura o client
  com o header `x-cc-token` (lido de `window.CC_TOKEN`) em toda requisição — inclusive
  as de leitura raw-fetch de `corsario.html`/`js/drawer.js`, por consistência, mesmo
  elas não precisando do token hoje (SELECT continua público).
- **`window.CC_TOKEN`** — definido por `js/gate.js`, sempre, com ou sem `exigirSenha`
  ativo (hoje `false`): nesse caso o token vem direto de `DB.config.tokenEscrita`
  (comportamento preservado — sem barreira nova pra quem já podia editar). Se
  `exigirSenha` virar `true` no futuro, o token só fica disponível depois da senha certa
  — gravado em `sessionStorage.cc_token` junto do `cc_auth` já existente, e derivado de
  lá nas próximas cargas da mesma aba (sem re-perguntar a senha). `data/config.js` ganha
  o campo `tokenEscrita` (placeholder `"SUBSTITUIR_PELO_TOKEN"`).
- **Erro de escrita amigável** (item 2.4) — `CC_SUPABASE.mensagemEscritaAmigavel(err)`
  reconhece o formato de erro de permissão/RLS do PostgREST (status 401/403 quando
  disponível, código Postgres `42501`, ou palavras-chave da mensagem — o client não
  expõe sempre o mesmo formato, então a checagem não depende de um campo só) e devolve
  "Sem permissão de escrita — fale com o JR." — aplicado em `plano-acao.html`
  (salvar/criar/remover atividade) e `demandas.html` (salvar célula/remover linha/
  adicionar linha). Qualquer OUTRO tipo de falha (rede fora do ar, etc.) continua
  mostrando a mensagem de erro de sempre — só a permissão vira a frase amigável.
- Validado com Chrome headless real contra o Supabase de produção: criei uma atividade
  de teste em `plano-acao.html` pelo fluxo normal (client centralizado + `CC_TOKEN`
  vindo do config), confirmei o autosave, removi (soft delete) pra não deixar rastro —
  escrita real ponta a ponta funcionando com o novo client, do jeito que vai continuar
  funcionando depois do SQL rodado (é o mesmo token, só passa a ser exigido). Suíte
  completa (13 testes) passando, incluindo o roundtrip do editor.

**Como ativar** (⚠️ decisão/execução do JR., não deste commit):
  1. Gerar um token aleatório (UUID ou similar).
  2. Substituir as 6 ocorrências de `SUBSTITUIR_PELO_TOKEN_UUID` no script SQL pelo token.
  3. Rodar `tools/sql/2026-08_protecao_escrita.sql` no SQL Editor do Supabase.
  4. Substituir `tokenEscrita` em `data/config.js` pelo MESMO token.
  5. Commit e push do passo 4 (sem isso o site manda um token errado e ninguém escreve).

## v0.15.0 — 2026-08-13
Prompt 11 do plano de melhorias (item 3.2): drawer lateral de Iniciativa/Pessoa —
`js/drawer.js`. Fecha o ciclo indicador → causa → responsável → ação sem página nova.

- **`js/drawer.js`** (novo) — painel único (`window.DRAWER`): desliza da direita (~480px)
  no desktop, tela cheia no mobile; fecha por X, Esc ou clique fora; fechar limpa o hash.
  Roteamento leve por `#iniciativa=<slug>`/`#pessoa=<id>` — link direto compartilhável,
  reage a `hashchange` (volta/avança do navegador também abre/fecha certo).
  - Painel de **Iniciativa**: núcleo + representante(s) (síncrono, `data/projetos.js`) ·
    posição na régua do Corsário (assíncrono, REST puro no Supabase — mesma fórmula de
    `corsario.html`, pesos ok=100%/andamento=70%/iniciar=40%/entendimento=20%, duplicada
    de propósito num arquivo à parte pra não mexer numa página que já funciona) com os
    critérios "em movimento" e "a iniciar" resumidos · atividades da iniciativa
    (`plano_acao_atividades`, com status) · linha na Matriz de demandas (só células
    ≠ vazia) · próximos 3 encontros (agenda geral dos ciclos — rotulado como tal: não há
    vínculo encontro↔iniciativa nos dados, e o painel não inventa um).
  - Painel de **Pessoa**: papéis (cruza `data/pessoas.js` + representações em
    `data/projetos.js` pelo id canônico — pode listar mais de um papel, ex.: Comitê E
    núcleo) · nós do caminho crítico onde é guardiã · ações do plano sob responsabilidade
    (atrasadas primeiro) · atividades por iniciativa (`plano_acao_atividades` filtrado por
    `responsavel`) · link "ver tudo em Minhas ações".
  - Cada bloco linka pra página de origem já filtrada (pedido explícito): régua →
    `corsario.html?q=<nome>#cards`, atividades → `plano-acao.html`, Matriz →
    `demandas.html`, ação → `plano.html?q=ID#ID`, "ver tudo" → `minhas-acoes.html?pessoa=id`.
- **Helpers de marcação** — `DRAWER.spanIniciativa(nome)`/`DRAWER.spanPessoa(nomeOuId)`/
  `DRAWER.spanPessoasEmTexto(texto)` (pra campos combinados tipo "Sandra/Gerência", cada
  pedaço resolvido separadamente, texto original preservado). Resolução de pessoa usa
  `js/responsaveis.js` (já existia desde a v0.9.0) — um nome só vira link se resolver pra
  exatamente um id canônico; gente sem id (ex.: liderança externa da URC) fica texto
  plano, sem inventar vínculo. `js/core.js`/páginas não precisaram de wiring por clique
  nenhum: um único listener delegado em `js/drawer.js` cobre todos os pontos de ativação.
- **Pontos de clique ativados** (item 4.1 — sublinhado pontilhado + cursor pointer no
  hover, `.entidade-clicavel`):
  - Iniciativa: `demandas.html` (linhas da Matriz), `projetos.html` (tabela), `corsario.html`
    (cards e matriz), `plano-acao.html` (título do painel da iniciativa selecionada).
  - Pessoa: `participantes.html` (nome em cada card de grupo + liderança/canais da URC —
    só os que resolvem), `projetos.html` (chips de representante), `plano.html` (coluna
    Responsável, por token).
  - `js/config.js`/`js/responsaveis.js` adicionados nas páginas que ainda não tinham
    (`projetos.html`, `participantes.html`, `plano.html` ganham `js/config.js`; as 5
    páginas do drawer que não tinham ganham `js/responsaveis.js`) — mesmo raciocínio da
    v0.14.0 pro índice de busca: sem isso, o drawer não teria como resolver nome→id nem
    falar com o Supabase nessas páginas.
- `tools/testar_drawer_headless.js` — 13º teste do repo: `#iniciativa=sebraetec` renderiza
  os 5 blocos esperados com a régua batendo (~49,5% · Marujo — mesmo valor já validado em
  `corsario.html` desde a v0.6.1); `#pessoa=sandra` renderiza os 4 blocos com 3 nós e as
  ações certas; fechar por X/Esc/clique fora limpa o estado e o hash; um nome clicável
  real em `plano.html` abre o drawer certo; iniciativas clicáveis conferidas em
  `demandas.html` e na visão Cards do Corsário.
- Validado com Chrome headless real (screenshots desktop e mobile): painéis completos
  pra Sebraetec e Sandra, suíte completa (13 testes) passando.

## v0.14.0 — 2026-08-13
Prompt 8 do plano de melhorias (item 2.6): busca global client-side — `js/busca.js`.

- **Índice** (`BUSCA.construirIndice`, função pura testável em node) — 5 entidades a
  partir de `window.DB`: ações do plano (id/atividade/responsável, 47), iniciativas
  (`data/projetos.js`, 27), pessoas (a lista CANÔNICA de `data/pessoas.js.responsaveis`,
  31 — não `window.DB.pessoas`, que repete o mesmo nome em registros de papel diferente
  sem id estável pra linkar sem ambiguidade), nós do caminho crítico (7), encontros da
  agenda (`data/agenda.js` × `data/canais.js`/`data/agenda.js` ciclos, 20). Total: 132
  entidades. Texto normalizado (acento fora, minúsculo) pra busca — mesma função de
  `js/responsaveis.js`, duplicada de propósito (3 linhas, não vale criar dependência
  cruzada entre módulos só por isso).
  - Pra o índice ficar completo em TODA página (não só nas que já carregavam certos
    `data/*.js` pro próprio uso), as 10 páginas com sidebar ganharam os `<script>` de
    `data/*.js` que ainda não tinham (`editor.html` já carregava tudo). Sem isso, por
    exemplo, buscar "Sandra" em `index.html` não achava a pessoa (a página nunca tinha
    carregado `data/pessoas.js`) — achado rodando o teste headless real, não só lendo
    o código.
- **UI** (`js/core.js` só injeta os pontos de entrada — a lógica é toda de `js/busca.js`,
  mesmo padrão do menu hambúrguer da v0.13.0, zero mudança de HTML por página):
  - Desktop: campo de busca no topo do `<nav>` (logo abaixo da marca), dropdown de
    resultados agrupados por tipo (Ações · Iniciativas · Pessoas · Nós · Encontros),
    até 5 por grupo, navegável por ↑/↓ + Enter, fecha com Esc ou clique fora.
  - Atalho de teclado "/" foca o campo — desviando de qualquer input/textarea/select/
    contenteditable já focado, pra não roubar a barra de dentro de um campo de texto.
  - Header mobile: botão 🔍 abre um painel de busca (mesmo mecanismo de índice/resultado)
    sem precisar abrir o menu hambúrguer primeiro (pedido explícito do prompt); fecha o
    menu se estiver aberto (os dois painéis não cabem juntos numa tela de 390px).
- **Links por tipo** (pedido explícito): ação → `plano.html?q=ID#ID`; iniciativa →
  `corsario.html?q=<nome>#cards` (visão CARDS, não a Matriz — `corsario.html` ganhou
  suporte a `?q=` pré-preenchendo `#crs-busca` antes do primeiro render, mesmo padrão de
  `?q=` que `plano.html` já tinha); pessoa → `minhas-acoes.html?pessoa=<id>`; nó →
  `caminho.html#noN`; encontro → `agenda.html#<id-do-encontro>` (as linhas da tabela de
  encontros ganharam `id="..."` — não tinham antes, precisou pra esse deep-link existir).
- `tools/testar_busca_headless.js` — 12º teste do repo: "/" foca o campo; "CMT-01" acha
  exatamente a ação certa e Enter navega de verdade pra `plano.html?q=CMT-01#CMT-01` (com
  o filtro da página já aplicado); "Sebraetec" acha a iniciativa, abre `corsario.html` na
  visão Cards com a busca preenchida; "Sandra" acha a pessoa certa; o painel de busca do
  header mobile (390×844) faz tudo isso igual.
- Validado com Chrome headless real (screenshots do dropdown desktop e do painel mobile):
  132 entidades indexadas, os 5 cenários de link acima conferidos ponta a ponta, suíte
  completa (12 testes) passando.

## v0.13.0 — 2026-08-13
Prompt 7 do plano de melhorias (item 2.5): responsividade mobile — sidebar vira menu
hambúrguer abaixo de 768px, tabelas viram cards empilhados, Matriz fica desktop-only com
aviso amigável. Máximo de CSS, mínimo de HTML — ver detalhe por tarefa.

- **Sidebar → menu hambúrguer** — `js/core.js` (`montarShell`) passa a injetar um
  `.mob-header` (título + botão ☰) e um `.mob-backdrop` dentro do `.shell` de TODA página
  automaticamente — zero mudança de HTML por página só pra isso (a casca `.shell` já é
  compartilhada). Abaixo de 768px, `.nav` vira painel `position:fixed` fora da tela
  (`transform:translateX`) que desliza por cima do conteúdo ao abrir; fecha ao clicar no
  botão, no backdrop, num link do menu ou com Esc. Rodapé de versão continua dentro do
  painel aberto (a regra antiga que escondia `.nav .rodape` no breakpoint velho de 960px
  não existe mais — o painel mobile é literalmente o mesmo `<nav>` do desktop, só
  reposicionado). O breakpoint de 960px do painel anterior (nav virava chips horizontais)
  foi substituído por este de 768px, que é o pedido neste prompt — de 768px pra cima o
  site continua exatamente como sempre foi.
- **`index.html`** — `#kpis` em grade de 2 colunas; `#duas-colunas` ("Atrasadas agora" /
  "Próximos 7 dias") empilha em 1 coluna. O empilhamento era feito via
  `window.matchMedia(...).matches` + `style.gridTemplateColumns` no carregamento da
  página — saiu; virou classe (`.duas-colunas`, substitui o `style=""` inline que
  impedia a media query de fazer efeito) + CSS puro (item 2.5 pede isso explicitamente).
- **`plano.html`/`agenda.html`** — tabela vira pilha de cards abaixo de 768px (mecanismo
  genérico `table.tabela-cards` em `css/base.css`, ordem dos campos por página via
  `td:nth-child(N){order:...}`): em `plano.html`, ID + atividade em cima, frente logo
  abaixo, responsável/prazo/status embaixo — os dois últimos ganham `data-label` (pedido
  explícito do prompt: "onde inevitável, atributos data-* pros rótulos dos cards") pro
  `::before{content:attr(data-label)}` rotular o campo sem precisar de mais marcação.
  `agenda.html` segue a ordem natural das colunas (Canal, Pauta, Data, Local, Confirmações,
  Status já lêem bem de cima pra baixo), com `data-label` em Data/Local/Confirmações.
- **`minhas-acoes.html`** — não tem `<table>` (já eram linhas `.ma-linha` flex), mas o
  mesmo problema de largura existia; `.ma-linha{flex-direction:column}` no mobile resolve
  igual, sem precisar de marcação nova.
- **`.filtros` empilhados em largura total** — vale em toda página que usa a classe
  (`plano.html`, `projetos.html`, `corsario.html`...), não só nas citadas no prompt.
- **Matriz desktop-only** (`demandas.html` + visão Matriz de `corsario.html`) — aviso
  "Esta carta é grande demais para o bolso — abra num monitor" + links pras demais
  páginas, no lugar da tabela. `demandas.html`: `.largura-desktop` nos blocos
  (`.mz-topo`, `#mz-estado`, `.matriz-wrap`, `.mz-rodape`, `#legenda`), aviso sempre
  presente (a página inteira É a Matriz). `corsario.html`: só a visão Matriz esconde (a
  visão Cards continua normal no mobile) — `elAvisoMobile.classList.toggle("mostrar",
  visao === "matriz")` em `renderTudo()`, mesmo lugar que já decide qual visão está ativa.
  - **2 bugs achados e corrigidos durante a implementação** (pegos só ao tirar screenshot
    real, não só checar propriedades isoladas — registrado aqui porque é o tipo de coisa
    que passaria despercebida numa checagem só textual): (1) `.mob-backdrop.show` só
    mudava `opacity`, nunca `display` — o backdrop (que nasce `display:none`) nunca
    aparecia de verdade. (2) `.shell` mantém `min-height:100vh` do desktop; a versão
    mobile ganhou uma 2ª linha de grid (header + conteúdo) e o `align-content:stretch`
    padrão do CSS Grid distribuía o espaço sobrando de `min-height:100vh` entre as duas
    linhas quando o conteúdo era curto — em `demandas.html`, com a Matriz escondida, o
    header hambúrguer esticava pra ~284px de altura. Corrigido com
    `.shell{align-content:start}` no mobile. Um 3º achado, de especificidade CSS pura
    (sem chegar a aparecer errado numa tela, mas travava a lógica): `.largura-desktop`
    (utilitário de esconder) perdia de regras sem media query definidas depois de
    `css/base.css` no `<style>` de cada página (ex.: `.mz-topo{display:flex}`) no empate
    de especificidade, por causa da ordem de carregamento — `!important` na classe
    utilitária resolve (uso legítimo: "esconder não importa o quê").
- `tools/testar_mobile_headless.js` — 11º teste do repo: viewport 390×844
  (`Emulation.setDeviceMetricsOverride`), confere hambúrguer abrindo/fechando (clique,
  backdrop, link, `aria-expanded`), KPIs em 2 colunas, `plano.html` com as 47 ações
  ainda todas lá (só como cards), `agenda.html` idem, e a Matriz (demandas.html + visão
  Matriz do Corsário) mostrando o aviso — com a visão Cards do Corsário continuando
  normal.
- Validado com Chrome headless real em dois viewports (1440×900 e 390×844, com
  screenshot de cada): sidebar/hambúrguer, KPIs, cards de `plano.html`/`agenda.html`,
  aviso de `demandas.html`, `minhas-acoes.html`; suíte completa (11 testes) passando em
  ambos os viewports sem alterar nenhum valor calculado.

## v0.12.0 — 2026-08-13
Prompt 9 do plano de melhorias (item 2.7): terceira visão em `agenda.html` — TIMELINE.

- **`js/timeline.js`** (novo módulo, mesmo padrão sem framework de `js/calendario.js`) —
  `TIMELINE.montar(container, {ciclos, encontros, canais, hojeISO})`. Grid CSS puro (sem
  SVG, sem lib nova): 1 linha por canal (10, ordem de `data/canais.js`), 1 coluna por dia
  do eixo + 1 coluna final "A definir". Eixo cobre do início do Ciclo 1 ao fim do último
  ciclo cadastrado; como o Ciclo 2 ainda não tem "fim" definido (`ini`/`fim` `null`, "a
  agendar"), o eixo cai pro maior valor conhecido entre o fim do Ciclo 1 e as datas já
  marcadas de qualquer encontro — nunca corta um marcador com data pra fora do eixo por
  falta do fim do Ciclo 2; quando o Ciclo 2 ganhar datas, o eixo cresce sozinho, sem
  mudar código. Cada encontro é um marcador (pontinho de 12px, cor sólida do status
  canônico — `window.CC_STATUS`, contexto "encontro", `js/status.js`) com tooltip nativo
  (`title=`: data, turno, local/modo, confirmações). Linha vertical tracejada de "hoje"
  quando a data cai dentro do eixo (fora dele — caso de hoje, 13/08, antes do Ciclo 1
  começar em 18/08 — a linha simplesmente não aparece, sem erro).
  - Colunas em largura FIXA em px (não `1fr`) de propósito: a largura total do grid supera
    o container só quando há muitos dias, e o scroll horizontal pedido pro mobile sai de
    graça do `overflow-x:auto` do wrapper — mesmo mecanismo, sem layout mobile à parte.
    Nome do canal `position:sticky;left:0` (mesmo pedido).
  - `js/calendario.js` não mudou de comportamento; só reaproveitado como referência de
    padrão (namespace `window.TIMELINE`, mesmo jeito de consumir `DB.agenda`/`DB.canais`).
- `agenda.html` — botão "Timeline" no `.vista-toggle` (Lista · Calendário · Timeline);
  visão montada só na primeira vez que é aberta (mesmo padrão já usado pro Calendário).
- `tools/testar_timeline_headless.js` — 10º teste do repo: nº de marcadores renderizados
  = nº de encontros em `data/agenda.js` (20 = 20), nº de linhas de canal = nº de canais em
  `data/canais.js` (10 = 10), coluna "A definir" presente, marcador com tooltip preenchido,
  e a troca de volta pro botão Lista reativa a visão Lista corretamente.
- Validado com Chrome headless real: 20 marcadores batendo 1:1 com os 20 encontros (8
  datados no Ciclo 1 nas colunas de dia certas + 12 sem data — 2 do Ciclo 1 (DXP,
  Contabilizações) + os 10 do Ciclo 2 inteiro — na coluna "A definir"), linha de "hoje"
  testada also com uma data simulada dentro do eixo (posição em px conferida à mão),
  suíte completa (10 testes) passando.

## v0.11.0 — 2026-08-13
Prompt 6 do plano de melhorias (item 2.4): taxonomia única de status — `js/status.js`
(`window.CC_STATUS`) consumido por todas as páginas, sem mudar o significado de nenhum
estado. Migrado página a página, suíte completa rodada depois de CADA uma.

- **`js/status.js`** (novo) — dicionário único: 26 estados canônicos em 5 contextos
  (`acao`, `no_critico`, `encontro`, `celula_matriz`, `atividade` — o pedido original
  listava só os 4 primeiros; `atividade` entrou por auditoria, ver nota abaixo), cada um
  com chave estável, rótulo de exibição e `classe` (nome de classe CSS que já existe em
  `css/base.css` — este arquivo não duplica cor em hex/var() nenhuma). `CC_STATUS.badge(chave)`
  monta o HTML padronizado (cor + rótulo em texto — nunca cor sozinha);
  `CC_STATUS.chaveDeEntrada(contexto, valorBruto)` traduz um valor já gravado em
  `data/*.js`/Supabase pra chave canônica, sem exigir migração de dado nenhuma.
  - Auditoria encontrou mais estados em uso real do que o pedido original listava:
    5 estados de nó (não 3 — faltavam "cumprido"/"ok" e "em andamento"/"atencao"), 9
    células de matriz (não 6 — faltavam "vazia", "oficina_confirmada" e "nao_aplica",
    as duas últimas adicionadas na v0.7.0) e um 5º contexto inteiro, "atividade"
    (plano-acao.html/Supabase: nao_iniciado/em_execucao/atrasado — vocabulário PRÓPRIO,
    nem os 5 estados de "acao" nem nenhum dos outros 3). Todos entraram no dicionário.
  - Chaves de nó e de atividade levam prefixo (`no_`/`atividade_`) pra nunca colidir no
    mesmo namespace plano com as chaves de "acao" — ex.: "em andamento" de nó usa
    `st-janela` (âmbar), bem diferente da cor de "em_andamento" de ação (`st-andamento`,
    azul); tratar os dois como uma chave só teria sido uma fusão de significado errada.
- **Migração, nesta ordem, suíte completa depois de cada uma:**
  - `plano.html` — `stClass` (`js/core.js`, compartilhada por plano.html/index.html/
    caminho.html/minhas-acoes.html) passa a delegar pra `CC_STATUS` internamente; nenhuma
    das 4 páginas precisou de mudança própria pra esse pedaço.
  - `index.html` — já coberto pela migração de `stClass` acima; nada de local pra migrar.
  - `caminho.html` — dicionário local `NOME`/`CLS` (5 estados de nó) trocado por lookup em
    `CC_STATUS` via mapa de tradução `estado curto → chave canônica`; legenda gerada com
    `CC_STATUS.badge`.
  - `agenda.html` — `classeEncontro()` local trocada por `CC_STATUS.chaveDeEntrada`/`badge`;
    rótulo por linha passa a vir capitalizado do dicionário ("Agendado") em vez do texto
    bruto salvo em minúsculo ("agendado") — mesmo significado, só a caixa do texto muda.
    `js/calendario.js` (visão Calendário, mesma página): `COR_ENCONTRO` local trocado por
    `CC_STATUS` também, fechando de vez a divergência de cor entre Lista/Calendário que a
    v0.8.0 já tinha corrigido manualmente (agora as duas leem da mesma fonte, não tem mais
    como divergir de novo). `COR_NO` do calendário ficou de fora de propósito — é a cor de
    um marcador (bolinha), não um badge de "cor + texto".
  - `demandas.html` — dicionário local `ROTULO` trocado por `CC_STATUS.rotulo`; `ORDEM`
    (valores gravados no Supabase/`data/matriz.js`) intocado — contrato de dado não muda.
    Legenda estática do fluxo da célula (`#legenda`, HTML fixo) ficou de fora de propósito:
    é um diagrama de fluxo ilustrativo (não lista todos os 9 estados, só o caminho feliz),
    não uma listagem exaustiva de vocabulário como as `legenda-vocab` de outras páginas.
  - `plano-acao.html` — array local `STATUS_OPCOES` (valor + rótulo hardcoded) trocado por
    `STATUS_VALORES` (só os valores, contrato do Supabase intocado) + `CC_STATUS.rotulo`.
  - `minhas-acoes.html` (por último, como pedido) — os dois dicionários locais que ela
    duplicava (`NOME_NO`/`CLS_NO`, cópia do de `caminho.html`; `STATUS_ATIVIDADE`, cópia
    do de `plano-acao.html`) saem — os dois agora leem de `CC_STATUS`, mesma fonte das
    páginas originais. Badges de ação já vinham de `stClass`, sem mudança própria aqui.
- `tools/testar_status_badges_headless.js` — 9º teste do repo: pra cada uma das 6 páginas
  migradas, confere que a contagem de badges renderizados (linhas/células/cards — legendas
  excluídas de propósito, são texto explicativo fixo, não um badge por registro) é
  EXATAMENTE a mesma de antes da migração (62/16/18/20/270/17, capturadas contra o código
  pré-migração e registradas no teste).
- Validado com Chrome headless real depois de cada página: suíte completa (9 testes)
  passando em todas as 6 rodadas, badges intactos, select de status/responsável com os
  mesmos rótulos de antes (conferido também via comparação direta em Node, sem depender
  só do navegador).

## v0.10.0 — 2026-08-13
Prompt 5 do plano de melhorias (item 2.3): Dashboard reordenado por urgência decisória —
mesmos componentes de sempre, ordem nova, nenhum cálculo mudou de resultado.

- **Frase de contexto** — `js/calc.js` ganha `CALC.resumoUrgencia(plano, nos, hojeISO)`,
  reunindo 3 números que já existiam espalhados noutros cálculos da própria página (não
  reimplementados: reusa `C.ehAtrasada`, `C.estadoNo`, `C.cargaPorDia`): ações atrasadas,
  nós do caminho crítico em "venceu sem concluir" ou "vence hoje", dias do radar de carga
  com 2+ entregas a partir de hoje. `index.html` exibe logo abaixo do título "Dashboard":
  "N itens precisam de atenção hoje · X ações atrasadas · Y nós críticos · Z dias com carga
  concentrada" — parcela zerada some da frase; se as 3 forem zero, "Nenhum item crítico
  hoje — plano no ritmo." (`.frase-contexto`/`.zerado`, classes novas em `css/base.css`,
  já usadas antes pela v0.9.0 em `minhas-acoes.html` — mesmo componente, dois lugares).
  Nota: o pedido original citava só 2 das 3 parcelas na frase-exemplo ("X ações atrasadas
  · Y nós críticos"); as 3 entram citadas porque a 1ª tarefa pediu explicitamente o cálculo
  das 3 — se o total "N itens" somasse só 2 das 3 parcelas nomeadas, o número não bateria
  com a soma do que está escrito ao lado dele.
- **Reordenação por urgência decisória** (`index.html`) — nova ordem: frase de contexto ·
  timeline dos 7 nós (mantida — mapa mental do plano) · Atrasadas agora + Próximos 7 dias
  lado a lado · Radar de carga · KPIs numéricos (os 6 cards clicáveis) · Composição do
  portfólio. Os dois últimos eram um grid só (`#kpis` com os 6 cards de status + os 2 cards
  de portfólio dentro do mesmo container); separados em `#kpis` e `#portfolio` (containers
  distintos, mesma classe `.grid.kpis`, mesmo HTML de cada card) pra virarem blocos 5º/6º
  de verdade — nenhum card mudou de conteúdo ou cálculo, só o container que o recebe.
- `tools/testar_calc.js`: cobre `CALC.resumoUrgencia` (nós 1 e 2 em risco na data de
  referência do teste, atrasadas batendo com `CALC.kpis().atrasadas`).
- `tools/validar_site.py`: `frase-contexto` e `portfolio` entram nos ids obrigatórios de
  `index.html`.
- Validado com Chrome headless real: ordem das 8 seções do `<main>` batendo com a nova
  sequência, frase de contexto com o texto certo, `#kpis` com 6 cards e `#portfolio` com 2,
  suíte completa (8 testes) passando sem mudança nos valores de KPI já cross-validados.

## v0.9.0 — 2026-08-13
Prompt 4 do plano de melhorias (item 2.2): lista canônica de responsáveis (BACKLOG #004) e
a página "Minhas ações" (BACKLOG #003) — a visão transversal "o que eu tenho que fazer?".

- **Lista canônica de responsáveis** — `data/pessoas.js` ganha `window.DB.responsaveis`: 31
  entradas (id estável + nome + grupo de agrupamento) extraídas varrendo `resp` de
  `data/plano.js`, `guardiao` de `data/nos.js` e `representantes` de `data/projetos.js`.
  `js/responsaveis.js` novo (funções puras, testável em node como `js/calc.js`) resolve
  texto livre — "JR. e Pova", "Comitê e Sandra" — pra array de ids, separando por " e ",
  "/", "+" e ",". `data/plano.js` ganha `responsavel_id` nas 47 ações (campo `resp`
  original intocado), gerado por `tools/gerar_responsavel_id.js` — idempotente, com modo
  `--check` que falha se `resp` for editado sem regenerar o campo derivado (novo passo na
  suíte de testes). Único valor livre sem mapeamento: `"Núcleo de Startups"` em
  `data/projetos.js` — placeholder de indicação pendente, não pessoa, deixado de fora de
  propósito (mesmo tratamento que `index.html` já dava a ele).
  - `tools/validar_dados.py` tinha um guardrail genérico contra qualquer campo de autoria
    fora de `data/projetos.js` (histórico real: "Criss"/"Cris" divergindo entre datasets).
    `responsavel_id` entra como exceção pontual e comentada no próprio arquivo — é a versão
    estruturada de um campo (`resp`) que já existia antes do guardrail, não autoria nova; a
    consistência entre os dois fica garantida pelo `--check` acima, fechando a mesma lacuna
    de drift que o guardrail existe pra evitar.
  - `plano-acao.html`: campo livre "Responsável" vira `<select>` alimentado pela lista
    canônica (agrupado por Coordenação/Coletivo/Núcleos/Projetos). Atividade gravada antes
    desta mudança com texto que não bate com nenhum id canônico ganha uma opção "⚠ legado"
    marcada visualmente (`.pa-legado`), sem apagar nada — some sozinha na próxima vez que
    alguém escolher uma pessoa de verdade pra aquela linha. Hoje as 22 atividades reais no
    Supabase têm `responsavel` vazio — a via legada existe pronta pro dia em que não tiver.
- **`minhas-acoes.html`** (nova, menu Execução logo após "Plano de ação") — seletor "Ver
  como" (lista canônica), persistido em `localStorage` (`cc_ver_como`) e com link direto
  `?pessoa=<id>` compartilhável (a página reflete a pessoa atual na URL via
  `history.replaceState`, sem empilhar histórico). Três seções por pessoa: nós do caminho
  crítico onde é guardiã (`data/nos.js`, casado por `js/responsaveis.js` — mesmo
  vocabulário de estado de `caminho.html`), ações do plano onde `responsavel_id` inclui a
  pessoa (ordenadas: atrasadas → prazo crescente → janelas por último, mesmo critério de
  "janela" do resto do site), atividades por iniciativa do Supabase onde `responsavel` é a
  pessoa. Cabeçalho com o resumo "N itens sob sua guarda · X atrasados · Y vencem em 7
  dias" (`.frase-contexto`, classe nova em `css/base.css` — destaque discreto, reaproveitada
  pelo item 2.3 do plano de melhorias no Dashboard).
  - Seção de "Próximos encontros" (pedida no prompt original) foi omitida de propósito:
    `data/agenda.js` não tem nenhum campo ligando um encontro a uma pessoa — sem esse
    vínculo nos dados, inventar um seria inventar dado; comentário no HTML documenta o
    porquê e deixa o lugar pronto pro dia em que esse campo existir.
- `tools/testar_minhas_acoes_headless.js` — 8º teste do repo: abre
  `minhas-acoes.html?pessoa=sandra` num Chrome real via CDP e confere que a contagem de nós
  (3) e de ações (14) listadas bate com a recalculada em Node a partir dos mesmos dados
  (não hardcoded às cegas), e que o resumo do cabeçalho cita os números certos.
- Validado com Chrome headless real (contra o Supabase de produção): select de responsável
  em `plano-acao.html` com as 31 opções agrupadas, `minhas-acoes.html` com nós/ações/
  atividades corretas pra "sandra" e resumo batendo, `node tools/gerar_responsavel_id.js
  --check` OK, suíte completa (8 testes) passando.

## v0.8.1 — 2026-08-13
- `corsario.html`: paleta de status (ok/ajuste em andamento/a iniciar/em entendimento/não se aplica) trocada dos hex vivos copiados direto da planilha-fonte (`#E8F5E9`/`#2E7D32` etc.) pelos tokens "lavados" do resto do site (`--ok`/`--prog`/`--warn`/`--ink-2`/`--ink-3`) — mesma lógica já aplicada às cores de núcleo desta página (v0.6.2). Vale nos três lugares que reaproveitam as mesmas classes (`.crs-st-*`/`.crs-crit-na`/`.crs-mz-na`): legenda, células da matriz e chips do detalhe expandido dos cards — conferido nos três via Chrome headless contra o Supabase de produção.
- Achado ao trocar: `var(--warn)`/`var(--warn-w)` (usado aqui em "a iniciar") mede 3.6:1 de contraste — abaixo de WCAG AA (4.5:1). É o mesmo par de tokens já usado em `.st-janela`, `.cel-oficina` e `.aviso` em várias páginas; mantido por consistência com o padrão já estabelecido no restante do site, mas fica registrado como possível item futuro do plano de melhorias (ajustar `--warn`/`--warn-w` em `css/base.css` teria efeito em todas essas páginas de uma vez, não só aqui).

## v0.8.0 — 2026-08-13
Prompt 2 do plano de melhorias: menu em domínios, KPIs do Dashboard viram drill-down real pra `plano.html`, e auditoria + legenda de status.

- **Menu em domínios** (`js/core.js`) — sidebar agrupado em 5 seções discretas (títulos em caixa alta, sem link): Visão (Dashboard · Caminho crítico), Execução (Plano de ação · Agenda dos ciclos · Matriz de demandas · Atividades por iniciativa), Pessoas (Participantes · Projetos), Jornada (O Caminho para o Corsário), Admin (Modo edição). `PAGINAS` virou `GRUPOS` (array de `{titulo, paginas}}`); URLs, rótulos e a ordem *dentro* de cada grupo continuam exatamente os mesmos — só a forma de agrupar mudou. Títulos de grupo somem no menu mobile (`css/base.css`, `@media max-width:960px`) pra não quebrar o fluxo horizontal de chips.
- **KPIs do Dashboard viram links de verdade** (`index.html` → `plano.html`) — os 6 cards do topo (Ações no plano, Concluídas, Em andamento, Atrasadas, Vencem em 7 dias, Em janela) e cada linha de "Atrasadas agora"/"Próximos 7 dias" agora são `<a href>` reais, não mais botões que expandiam uma lista inline (decisão da v0.3.6, **removida** — `plano.html` já tem filtro completo + ordenação + busca, a lista inline ficou redundante). `plano.html` lê `?status=` (concluida/em_andamento/atrasada/vence7/janela) e `?q=` no carregamento; dois filtros novos no `<select>` de status (`__vence7`, `__janela`) que não existiam antes. Linhas de "Atrasadas agora"/"Próximos 7 dias" levam a `plano.html?q=ID#ID` — busca preenchida (pedido) + auto-abre o detalhe da linha (comportamento que já existia via `#ID`, preservado). `tools/testar_dashboard_headless.js` (F7) **reescrito**: testava a expansão inline (agora removida); passa a testar que o clique navega de verdade e a contagem bate entre o card e `plano.html` filtrado.
- **Auditoria de status + legenda** — auditoria completa reportada na entrega (rótulo · cor · páginas). Achado um bug real: `agenda.html` colorria "agendado" de âmbar na visão Lista e de azul na visão Calendário (`js/calendario.js`) — a mesma página, o mesmo status, duas cores diferentes. Corrigido (`classeEncontro()`, fonte única pras duas visões). Núcleos (caminho.html) e encontros (agenda.html) reaproveitam as cores `st-*` do site com um vocabulário PRÓPRIO, diferente do "status de atividade" de `plano.html`/`index.html` — em vez de recolorir (quebraria a consistência já estabelecida com o trilho do Dashboard e o calendário), as duas páginas ganharam uma legenda compacta no topo (`.legenda-vocab`, nova em `css/base.css`) explicando o vocabulário local; a de `caminho.html` é gerada direto do mapa `NOME`/`CLS` já existente no script (fonte única, sem duplicar rótulo).
- Validado com Chrome headless real: ordem/agrupamento do menu, hrefs dos 6 KPIs, clique de verdade navegando e a contagem batendo, as 5 combinações de `?status=` + `?q=` carregando direto, e as duas legendas renderizando com o texto/cor certos.

## v0.7.1 — 2026-08-12
Bloco 1 do plano de melhorias: 4 ajustes de baixa complexidade + gate de senha preparado e desativado.

- **Privacidade** — rodapé do sidebar (`css/base.css`, `.nav .rodape::after`) trocado de "Confidencial · Documento de bordo" pra "Uso interno · Unidade de Inovação"; como é um único `::after` compartilhado, a troca já vale nas 10 páginas do painel de uma vez. `robots.txt` novo na raiz do site (`meta-monitor/robots.txt`, é o que vira `/robots.txt` no domínio publicado) com `Disallow: /`. Nomes de pessoas em Participantes/URC não foram tocados (decisão adiada, como pedido).
- **Sticky column + header nas tabelas largas** — conferido em Chrome headless real (scroll vertical e horizontal, célula do canto, cores de fundo computadas): tanto a Matriz de Demandas (`.matriz-wrap`/`.matriz` em `css/base.css`) quanto a visão Matriz do Corsário (`.crs-matriz-wrap` em `corsario.html`) já tinham `position:sticky` correto na primeira coluna e no cabeçalho, com fundo sólido e z-index em camadas (corpo=1/2, header=2/3) de trabalho anterior nesta mesma sessão — nada precisou mudar, só validar.
- **Contraste WCAG AA** — `--ink-2` (.55→.72) e `--ink-3` (.35→.68) em `css/base.css`: as duas falhavam feio contra os fundos reais de tabela (2.0–3.5:1 medido pela fórmula de luminância relativa do WCAG contra `--surface`/`--ceu`/`--neutro-w`), inclusive o cabeçalho `<th>` de toda tabela do site e o traço "—" de `.cel-vazia` na Matriz de Demandas. Os novos valores seguram 4.7–5.8:1 nos três fundos. `.matriz-wrap` ganhou `background:var(--surface)` explícito (não tinha nenhum — a textura do body vazava nos "gaps" das células sem cor própria); os wrappers de tabela de `plano.html` e `agenda.html` já eram `.card` (fundo sólido de fábrica), então não precisaram de mudança. Textura preservada no resto de cada página e intacta no Dashboard.
- **Rótulo de menu** — "Plano de Ação x Projeto" → "Atividades por iniciativa" no sidebar (`js/core.js`) e no `<title>`/`<h1>` de `plano-acao.html` — resolve BACKLOG #005 parcialmente (nome do arquivo e URL continuam `plano-acao.html`, sem mudar link nenhum). Isso também apaga a colisão de nome com "Plano de ação" (`plano.html`) que o changelog da v0.4.0 já tinha registrado como intencional.
- **Gate de senha (construído, desativado)** — `data/config.js` ganha `exigirSenha:false`; `js/gate.js` novo, carregado logo depois de `data/config.js` nas 10 páginas do painel (antes do `js/core.js`/render de cada página). Com a flag `false` (default) o arquivo não faz nada. Quando `true`, cobre a tela com um overlay (mesma identidade visual — fundo bege, tipografia do site, título "Carta de Corso") até `sessionStorage.cc_auth` existir; senha errada mostra "Senha incorreta." sem reload; senha certa seta o sessionStorage e some com o overlay. Comparação é sempre por SHA-256 hex (`crypto.subtle.digest`) contra `HASH_SENHA`, hoje o placeholder `"SUBSTITUIR_PELO_HASH"` — a senha em texto claro não existe em nenhum arquivo do repo. `tools/gerar_hash_senha.html` novo (roda local, offline, gera o hash SHA-256 de uma senha digitada) pra ativar sem expor a senha no chat/repo. Comentário no topo de `gate.js` deixa claro que é proteção client-side leve, não autenticação de verdade (isso é o item 2.1 do plano de melhorias, ainda não feito).
- Validado ponta a ponta em Chrome headless: overlay aparece/some corretamente, senha errada não recarrega a página, `tools/gerar_hash_senha.html` gera exatamente o hash que `gate.js` valida, e as 10 páginas continuam sem overlay (flag desligada) e com o rodapé novo.
- `BACKLOG.md` criado (não existia antes) — registro de baixa do item #005 e do estado do item 2.1 (proteção de escrita no Supabase, ainda não iniciado). É o registro do que já foi feito; o plano completo (blocos 1–3, prompts P2–P13) fica em `prompts_code_melhorias_carta_corso.md`, na raiz do repositório git, um nível acima de `meta-monitor/`.

## v0.7.0 — 2026-08-12
Lote de 16 ajustes pedidos após revisão do painel, cobrindo 9 páginas + identidade tipográfica global. Layout, tema e responsividade preservados; nenhuma dependência nova além da webfont do item 16.

- **Dashboard** (`index.html`): removido "— distribuir com Sandra e Pova" do hint do Radar de carga; removida a seção "Atualizações do ambiente" (título + card + o `<script src="data/changelog.js">` que só ela usava — `data/changelog.js` continua existindo pro `editor.html`).
- **Plano de ação** (`plano.html`): cabeçalhos da tabela viram clicáveis — ordenação asc → desc → sem ordenação (ícone ▲/▼, `aria-sort`, teclado) nas 6 colunas, sem tocar nos filtros já existentes (a ordenação entra como um `sort()` sobre a lista já filtrada).
- **Caminho crítico** (`caminho.html`): removida a seção "Onde mora a folga" (título + card); ajustada a frase de abertura da página, que citava essa seção.
- **Agenda dos ciclos** (`agenda.html`): a lista de Encontros virou um card por ciclo (título próprio, coluna "Ciclo" removida por ficar redundante); coluna de data ganhou o dia da semana abreviado pt-BR (`17/08 (seg)`).
- **Matriz de demandas** (`demandas.html`): dois status novos no seletor — `Oficina confirmada` (verde, entre "previsto" e "oficina feita") e `Não se aplica o uso` (cinza itálico, junto de "justificado"); cores novas em `css/base.css` (`.cel-oficina_confirmada`, `.cel-nao_aplica`).
- **Participantes** (`participantes.html`): card do Comitê passa a ser o primeiro (URC continua logo depois, como já era); todo integrante com núcleo identificável (casamento por nome exato contra `data/pessoas.js`, grupo "Núcleos" — sem match não escreve nada) ganha " — núcleo" ao lado do nome, inclusive nos responsáveis por canal da URC; removidos "— 3 de 8 canais com indicação" e "11 responsáveis operacionais indicados ao todo".
- **Projetos** (`projetos.html`): métrica "Pessoas envolvidas: N" por núcleo (contagem distinct por nome sobre todas as iniciativas do núcleo, mesmo critério de "pessoa física" do dashboard — placeholder "Núcleo de Startups" não conta).
- **O Caminho para o Corsário** (`corsario.html`):
  - Subtítulo sem o `max-width:74ch` herdado de `.pagina-sub` (override só nesta página) — ocupa a largura toda do container.
  - Filtro por patente (chips, "Todas as patentes" + as 5 faixas) — mesma fonte única (`listaFiltrada()`) dos filtros de núcleo/busca/ordenação, então vale nas duas visões de graça.
  - **Matriz vira a visão default** (Cards vira a alternativa) — só troca o fallback de `aplicarHash()` quando não há hash; mecanismo de toggle/hash idêntico.
  - Cabeçalhos da matriz batendo com `o_caminho_para_o_corsario_v3.xlsx` (aba "Jornada", linha 2) — texto por extenso, com as ordens de "Núcleo/Iniciativa/…/% de adequação/Patente"; sem `text-transform:uppercase` nos headers (o `th{}` genérico de `css/base.css` já vem uppercase — precisou de `text-transform:none` explícito, não bastava só remover a declaração local). A patente no CORPO da matriz continua em caixa alta como badge (`.crs-mz-patente-valor`) — só o header mudou. Colunas de critério alargadas (90px → 128px) pra caber o texto completo com quebra de linha.
- **Global — item 16**: fim das fontes serifadas no painel. `css/base.css` ganha `--font-sans: 'Open Sans','Lato',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif`; `body`, `h1..h6`, `button/input/select/textarea/table` passam a usar essa stack (os últimos quatro não herdam a fonte do `body` por padrão no UA stylesheet dos navegadores — precisou do reset explícito). As 10 páginas do painel trocam `Spectral` por `Open+Sans`/`Lato` no `<link>` do Google Fonts (mantendo DM Sans e IBM Plex Mono, que já eram sem serifa). Todo `font-family:'Spectral'`/`'Spectral',Georgia,serif` do repositório (`css/base.css` + `index.html`, `agenda.html`, `corsario.html`, `demandas.html`, `projetos.html`) foi trocado por `var(--font-sans)`. `apresentacao_canais.html` (deck da URC, propositalmente fora do tema desde a v0.5.0) já usa Inter/Archivo — conferido, nenhuma serifa lá, nada a mudar. Tamanhos, pesos e line-heights preservados — só a família mudou.
- `tools/validar_site.py`: ids obrigatórios de `index.html` (perdeu `log`) e `caminho.html` (perdeu `folga`) atualizados pra bater com as seções removidas.
- Validado com Chrome headless via CDP contra o Supabase de produção: ordenação da tabela do Plano, os 2 status novos na Matriz de demandas (via "Ativar edição"), núcleo inline nos Participantes, métrica de Projetos, filtro de patente/visão-default/headers da Matriz do Corsário, e ausência de `Spectral`/`Georgia`/`Times`/`Cambria` computada em `body` e nos headings de todas as páginas tocadas.

## v0.6.2 — 2026-08-12
- `corsario.html` (visão Matriz): coluna **"Patente"** renomeada pra **"Patente Atual"** e movida pra logo depois de Iniciativa (antes de "Base no Foco"), em vez de ficar isolada no fim da tabela — não é mais sticky, rola junto com os critérios como as demais.
- Cores de núcleo trocadas dos tons vivos da planilha-fonte (`#005EB8`/`#00796B`/`#6A4FA3`/`#E65100`, que continuam só nas cores de *status* de critério, pra bater com a origem) pelos tokens já lavados de `css/base.css` — `var(--prog)` azul, `var(--ok)` verde, `var(--sla)` roxo/malva, `var(--cc)` laranja/terracota — mesma lógica de matiz, mas na tinta de papel antigo do resto do site. Vale pra célula sólida da matriz, pro chip do card e pro chip de filtro por igual (todos usam `corNucleo()`, fonte única).
- Cabeçalhos de coluna da matriz alinhados à tipografia padrão de `<th>` do site (`css/base.css`): maiúsculas, `letter-spacing:.05em`, cor `var(--grafite)` em vez de `var(--tinta)` — antes destoava do resto das tabelas do painel (`plano.html`, `demandas.html`, `projetos.html`).

## v0.6.1 — 2026-08-12
- `corsario.html`: segunda visualização, **Matriz** (iniciativas × critérios), no espírito da planilha de origem — alternador segmentado "Cards | Matriz" junto aos controles existentes, padrão Cards. Estado espelhado em `location.hash` (`#cards`/`#matriz`, sem `localStorage`) — link direto pra `#matriz` já abre nela, e o alternador some/reaparece corretamente no botão voltar/avançar do navegador (`hashchange`).
  - Fonte única: mesmo `TODAS`/`calcular()` dos cards — a filtragem/ordenação foi extraída pra uma função só (`listaFiltrada()`) que os dois renders consomem; filtro por núcleo, busca e ordenação valem igual pras duas visões, sem lógica duplicada.
  - Tabela semântica com cabeçalho fixo e as colunas Núcleo/Iniciativa fixas à esquerda (`position:sticky`) dentro de um contêiner com `overflow:auto`/`max-height:70vh` — rolagem horizontal esperada nos 19 critérios + % + patente. Célula de núcleo com fundo sólido na cor do núcleo (mesma paleta dos cards) e texto branco; células de status reaproveitam as mesmas classes de cor dos cards (`crs-st-*`), com texto abreviado (`ok`/`andamento`/`a iniciar`/`entend.`/`n.a.`) e `title` com o rótulo completo do critério + status + observação. Cabeçalhos de critério com rótulo curto por `chave` (mapa `ROTULOS_CURTOS`, com fallback pro `rotulo` truncado se vier critério novo sem mapeamento) e `title` com o rótulo completo.
  - Validado contra o Supabase de produção via Chrome headless (CDP): ALI Academy 23,3% Grumete · Catalisa Gov 53,7% Timoneiro · Sebraetec 49,5% Marujo · adequação média da frota 34,8% — batendo com a conferência visual pedida contra a planilha-fonte.
  - `tools/validar_site.py`: ids novos (`crs-segmento`, `crs-matriz-wrap`, `crs-matriz`) na lista obrigatória de `corsario.html`. Nenhuma outra página alterada; nenhuma mudança no Supabase (mesmas tabelas, policies e GRANTs de v0.6.0).

## v0.6.0 — 2026-08-12
- Nova aba **O Caminho para o Corsário** (`corsario.html`) — adequação de cada iniciativa ao ecossistema oficial (Foco, catálogo, canais da URC), lida direto do Supabase (tabelas `corsario_criterios` e `corsario_status`, 19 critérios × 28 iniciativas), somente leitura via REST puro (`fetch`, sem SDK) — reaproveita `window.APP_CONFIG` (`js/config.js`) do mesmo projeto Supabase já usado por `demandas.html`/`plano-acao.html`.
  - Régua de adequação: `não se aplica` sai do cálculo — cada iniciativa é medida só pelos critérios que fazem sentido pra ela, com pesos `ok`=100%, `ajuste em andamento`=70%, `a iniciar`=40%, `em entendimento`=20%. Patente (Grumete/Marujo/Timoneiro/Capitão/Corsário) por faixa de %. Validado offline (`node`) contra o caso de aceite: ALI Ecossistema com 8 critérios n.a. → régua de 11 aplicáveis → ~25,45% → Marujo; com os mesmos 8 n.a. e os 11 restantes em ok → 100% → Corsário.
  - Painel da frota (adequação média, contagem por patente, última atualização), filtro por núcleo em chips coloridos, busca por nome, ordenação (%, nome, núcleo), cards expansíveis com os 19 critérios agrupados por `grupo` e ordenados por `ordem`, e legenda fixa no fim da aba (patentes + status/pesos + a regra de ouro por extenso). Erro de rede vira mensagem amigável com botão "Tentar de novo", sem derrubar as outras abas.
  - `js/core.js`: item novo no menu, entre "Plano de Ação x Projeto" e "Modo edição".
  - **⚠️ Pendência operacional:** validado contra o Supabase real — as tabelas existem e estão populadas, mas o role `anon` ainda não tem `GRANT SELECT` (mesmo padrão já visto em `meta_inovacao_matriz_demandas` na v0.3.1 e `plano_acao_atividades` na v0.4.0). Rodar manualmente no SQL Editor do Supabase: `GRANT SELECT ON public.corsario_criterios TO anon; GRANT SELECT ON public.corsario_status TO anon;` (e checar se há política de RLS de `SELECT` liberando as duas tabelas pro role `anon`). Até lá a aba mostra o erro amigável com "Tentar de novo" em vez de dados — sem quebrar nada nas outras 9 abas (confirmado via Chrome headless/CDP).

## v0.5.1 — 2026-08-12
- `js/core.js`: a marca no topo do menu lateral (`montarShell`) lia o texto fixo "Meta Inovação 2026" em vez de `DB.config.projeto` — inconsistente com o nome já usado em todos os `<title>` das páginas e no próprio `data/config.js` ("Carta de Corso") desde a v0.2.0. Passa a renderizar `cfg.projeto`, com o mesmo fallback "Carta de Corso" que o resto da função já usa. O subtítulo (`cfg.subtitulo` — "Meta Inovação 2026 · Unidade de Inovação · Sebrae Nacional") continua igual, sem perder a referência ao programa.

## v0.5.0 — 2026-08-12
- Nova identidade visual **"Carta Náutica"** aplicada a todo o painel — só tema, sem mudar estrutura, conteúdo ou funcionalidades. `css/base.css` reescrito: paleta papel-de-mapa-antigo (`--bg`/`--surface` marfim, `--ink` tinta escura, acento único vermelho-lacre `--accent`), tipografia Spectral (títulos e corpo) + DM Sans (nav/labels/UI, uppercase, letter-spacing largo) + IBM Plex Mono (datas/IDs, sem mudança de fonte), bordas sem radius em todo lugar, e três texturas de fundo: grade náutica 90×90 (CSS puro), rosa dos ventos e a caveira/ossos cruzados (easter egg a 3,5% de opacidade) — as duas últimas via SVG embutido em `::before`/`::after` de `.conteudo`, sem precisar de nó novo no HTML. Nomes de variável antigos (`--tinta`, `--azul`, `--linha`...) viraram alias dos tokens novos, então todo `var(--x)` já espalhado pelas páginas herdou a paleta nova sem precisar caçar cada uso.
- KPIs (dashboard e demais páginas) trocam de cards separados por um container único com divisores internos — mais fiel à referência "carta náutica" que o grid de cards com sombra do tema antigo.
- Cores de status (concluído/andamento/atrasada/janela/caminho-crítico/SLA) preservadas como famílias distintas — a diferenciação funcional não muda — mas lavadas para tons de tinta compatíveis com o papel, coerentes com o acento único.
- `index.html`, `agenda.html`, `demandas.html`, `projetos.html`, `editor.html`, `plano-acao.html`: blocos `<style>` locais (e um `style=""` inline em `editor.html`) também migrados — Archivo→Spectral, Inter→DM Sans, hex antigos→tokens novos. `plano-acao.html` entrou porque já está no menu (v0.4.1); teria ficado com fonte não carregada se ficasse de fora.
- `apresentacao_canais.html` deliberadamente fora do escopo: é um documento à parte (deck dos canais URC), com identidade cromática própria por canal — aplicar o tema do painel ali quebraria o propósito do arquivo.
- Varredura (`grep`) no repositório confirma zero referência remanescente a `Archivo`/`Inter`/hex antigos fora do deck.

## v0.4.2 — 2026-08-12
- **Correção de versão**: o pedido original citava "v0.3.7" (a partir do commit 672011e/v0.3.6), mas o painel já tinha avançado pra v0.4.1 nesse meio-tempo (Plano de Ação + soft delete). Publicando como v0.4.2 — próximo patch real — pra não regredir o número de versão.
- `index.html`: cards "Em andamento" e "Atrasadas" sinalizam sobreposição — cada ação que aparece nas duas listas (hoje CAN-02 e CAN-06) ganha o sufixo discreto "· também em andamento" / "· também atrasada" no título, sem badge nem cor nova (reusa `var(--grafite)`). Contagem dos cards não muda. A checagem de sobreposição usa a mesma `getAcoesPorCategoria` já existente, uma vez por render de lista — não reimplementa a regra em outro lugar.
- `tools/testar_dashboard_headless.js`: **6º teste do repo** — `render_reflete_mutacao_sem_refresh`, trava a decisão da v0.3.6 (clique nos cards de KPI re-renderiza a lista na hora, não só no carregamento da página). Sobe um Chrome/Chromium real headless via CDP (Chrome DevTools Protocol) cru, usando só `WebSocket`/`fetch`/`child_process` nativos do Node ≥22 — **sem instalar Playwright nem qualquer dependência nova** (os 5 testes existentes não usam navegador; verifiquei antes de escrever este — não havia nenhuma referência a Playwright no repo, ao contrário do que o pedido original presumia). Testado que o guardrail falha de verdade (reintroduzi o bug antigo, confirmei exit 1, reverti).
- README.md atualizado: 6 testes documentados, `tools/` na árvore de estrutura.

## v0.4.1 — 2026-08-12
- Menu: item de `plano-acao.html` renomeado pra "Plano de Ação x Projeto" (`js/core.js`) — só o rótulo do menu; título da página, `<h1>` e URL continuam iguais. Convive com o "Plano de ação" antigo (plano.html) sem quebrar layout da nav.
- `plano-acao.html`: remoção de atividade vira **soft delete** — `UPDATE deleted_at/updated_at` em vez de `DELETE` físico. A leitura passa a filtrar `.is("deleted_at", null)`. A coluna já tinha sido adicionada na tabela `plano_acao_atividades` no Supabase (com índice em `iniciativa, deleted_at`); nenhum DDL rodado por aqui.
- Texto do `confirm()` de remoção ajustado pra "Remover esta atividade?" — o antigo "...não pode ser desfeita" deixou de ser verdade com soft delete.
- Validado contra o Supabase real de produção (o GRANT da v0.4.0 já tinha sido aplicado manualmente): criar → confirmar remoção some da UI → linha continua na tabela via REST com `deleted_at` preenchido → reload não traz ela de volta → cancelar o confirm não muda nada.

## v0.4.0 — 2026-08-12
- Nova aba **Plano de Ação** (`plano-acao.html`) — CRUD de atividades por iniciativa (descrição, responsável, status), com navegação lateral pelas 27 iniciativas de `data/projetos.js` (mesma ordem/nomes, sem hardcode). Persistência no Supabase, tabela `plano_acao_atividades` (id, iniciativa, descricao, responsavel, status, ordem, created_at, updated_at). Sem login — igual ao resto do painel.
  - Descrição/responsável salvam com debounce de 600ms; status, criação e remoção salvam imediato. Cores sutis por status (cinza/azul/vermelho suave).
  - `supabase-js` carregado via `import()` dinâmico do build ESM do CDN, dentro de um `<script>` clássico (não `type="module"`) — mantém o arquivo testável por `node --check` junto com o resto do site, sem bundler.
  - **Bump de minor, não patch**: é uma funcionalidade nova (página + integração de backend), não uma correção.
  - Nome da aba mantém colisão proposital com a aba "Plano de ação" já existente (o plano de 47 ações do caminho crítico) — são dois conceitos diferentes; decisão confirmada com o usuário antes de implementar.
  - **⚠️ Pendência operacional:** a tabela `plano_acao_atividades` já existe no Supabase, mas a role `anon` não tinha GRANT (confirmado em produção: `permission denied for table`, mesmo problema já visto com `meta_inovacao_matriz_demandas` na v0.3.1). `supabase/plano_acao_atividades.sql` corrige isso (GRANT + RLS + trigger de `updated_at`) — **precisa ser rodado manualmente no SQL Editor do Supabase** antes da aba funcionar; até lá ela mostra um erro amigável com botão "Tentar de novo", não trava a página.

## v0.3.6 — 2026-08-12
- `index.html`: os 5 cards de KPI com prazo (Concluídas, Em andamento, Atrasadas, Vencem em 7 dias, Em janela) viram clicáveis — clique no número expande o card e revela a lista das ações, no mesmo espírito do card de portfólio. Um só aberto por vez, chevron ▼/▲, teclado (Enter/Space), `role="button"`/`tabindex="0"`, transição ~200ms com altura medida via JS (sem max-height chumbado). Card "47 ações no plano" e os dois cards de portfólio/gestores continuam como estavam.
- Nova função `getAcoesPorCategoria(categoria)` (inline em `index.html`, arquivo continua autocontido): relê `window.DB.plano` a cada chamada — sem cache — e replica exatamente os critérios de `CALC.kpis`, preservando duas particularidades já existentes em vez de "corrigi-las" por conta própria: "Em andamento" e "Atrasada" se sobrepõem (uma ação pode estar nas duas listas — hoje CAN-02 e CAN-06), e "Em janela" exige `!prazo_iso && prazo` (não só ausência de `prazo_iso`).
- A lista de cada card é regerada a partir de `getAcoesPorCategoria` no momento do clique, não só no carregamento da página — necessário pra refletir uma edição feita em outro lugar sem precisar de refresh (bug pego e corrigido durante o teste headless deste ciclo: o clique inicialmente só alternava a visibilidade do HTML montado no load).

## v0.3.5 — 2026-08-12
- Nomenclatura de núcleos unificada em Title Case (preposições/artigos minúsculos) em todo o painel: "Inovação para Competitividade", "Inovação Territorial", "Startups", "Tecnologias Portadoras de Futuro". `data/projetos.js` (27 registros) e `data/pessoas.js` corrigidos — este último também tinha "Inovação para Escala e Startups" divergente pra Paulo Puppin Zandonadi, agora "Startups".
- "Gestão do Conhecimento e Processos" formalizado como 5º núcleo válido no whitelist (`editor.html` e `tools/validar_dados.py`) — sem projeto de portfólio hoje, mas usado em `data/pessoas.js` (Lara, Sandra Paraíso).
- `index.html`: mini-breakdown do card "Gestores de projetos na UI" só lista núcleo com ≥1 projeto — Gestão do Conhecimento e Processos não aparece com "0 projetos".
- `tools/validar_dados.py`: whitelist de núcleos passa de 4 para 5 valores; novo guardrail cruza `data/pessoas.js.nucleo` contra a mesma lista (evita a divergência silenciosa que causou este ciclo).

## v0.3.4 — 2026-08-12
- `participantes.html`: card da URC reescrito — o rótulo antigo "destinatário/destinatária da proposta" (Enio/Milva hardcoded em `data/pessoas.js`, grupo "URC") sai; entra `data/urc.js`, com liderança transversal (Enio, Milva, Iuri Barbosa de Andrade) e responsáveis por canal (CNR, Portal e Loja indicados; 5 canais aguardando indicação — badge âmbar). Email nunca é renderizado na página pública.
- `editor.html`: dois conjuntos novos, "URC — Liderança" e "URC — Responsáveis por canal" (o segundo edita uma lista achatada com dropdown de canal fixo e agrupa de volta ao salvar); ambos regravam `data/urc.js` inteiro, sem perder o bloco não selecionado.
- `js/editor_io.js` e `tools/validar_dados.py`: loader generalizado para arquivos com mais de uma atribuição `window.DB.x = ...;` no mesmo arquivo (balanceando colchetes/chaves em vez de cortar no primeiro `;`, que pode estar dentro de uma string) — necessário porque `data/urc.js` declara `urc_lideranca` e `urc_canais` no mesmo arquivo. `tools/testar_editor.js` (F6) passa a testar todos os blocos de cada arquivo, não só o último.
- `tools/validar_dados.py`: valida os 8 canais da URC na ordem canônica, estrutura de liderança/responsáveis, e barra (exit 1) qualquer responsável de canal que também esteja na liderança. O guardrail anti-duplicação do ciclo anterior (v0.3.3) foi ajustado para não confundir o campo `responsaveis` de `urc_canais` — domínio diferente de `data/projetos.js` — com duplicação de autoria de iniciativa.
- `.chip.pessoa` centralizado em `css/base.css` (antes só existia no `<style>` local de `projetos.html`; agora reusado também pelo card da URC).

## v0.3.3 — 2026-08-12
- `index.html`: card "Gestores de projetos na UI" — 18 pessoas físicas distintas (exclui o placeholder "Núcleo de Startups" da contagem), linha de apoio e nota de rodapé dinâmicas; nota só aparece se houver iniciativa com representante pendente.
- Débito técnico: `data/projetos.js` vira fonte canônica de autoria por iniciativa. Removidos os campos `representante` (que tinha divergido — "Criss" vs "Cris", nomes concatenados em vez de array) e `nucleo` (sempre vazio) de `data/iniciativas.js`; nenhuma página chegava a renderizar esses campos, então não houve mudança visual a migrar.
- `tools/validar_dados.py`: dois guardrails novos — (1) toda iniciativa citada em `iniciativas.js`/`matriz.js` precisa existir em `data/projetos.js`; (2) nenhum `data/*.js` além de `projetos.js` pode ter campo cujo nome case com `/respons|dono|gestor|representante|owner/i`. Falha o build se a duplicação voltar.
- `tools/validar_site.py`: `projetos.html` incluído na varredura de referências quebradas e sintaxe do JS embutido.

## v0.3.2 — 2026-08-12
- Novo dataset `data/projetos.js`: 27 iniciativas do portfólio da UI, agrupadas nos 4 núcleos, com representante(s) por iniciativa. "Sebrae Startups" segue com "Núcleo de Startups" — pendência da Sandra indicar a pessoa nominal com o gestor.
- Nova página `projetos.html`: filtro por núcleo e busca, seções colapsáveis por núcleo, representantes como chips, contagem por linha e no rodapé. Link "Projetos" adicionado ao menu de todas as páginas.
- `index.html`: 2 novos cards no dashboard — total de projetos no portfólio e núcleos × representantes distintos (com mini-breakdown por núcleo), ambos calculados a partir de `data/projetos.js`.
- `editor.html`: novo conjunto editável "Projetos & Representantes" (núcleo via dropdown, representantes por vírgula), gera `data/projetos.js` atualizado.
- `tools/validar_dados.py` e `tools/validar_site.py` estendidos para cobrir `data/projetos.js` e `projetos.html`.

## v0.3.1 — 2026-08-12
- Corrige `supabase/setup.sql` — adiciona GRANTs de tabela pra `anon` e `authenticated`, sem os quais o RLS não chega a ser avaliado e o cliente recebe permission denied.

## v0.3.0 — 2026-08-12
- `editor.html`: botão "+ Nova atividade" na aba Plano — formulário inline, ID gerado automaticamente pelo prefixo da frente (CMT/INS/CAN/PTF/CG, ou `ATV-` sem frente).
- `participantes.html`: card do Comitê com o nome completo (Comitê de Atendimento e Relacionamento da Inovação), sem repetir a descrição abaixo de cada nome; card UI sem a linha de papel; card Núcleos recriado com os 8 representantes atuais e seu núcleo.
- `demandas.html`: matriz de demandas migrada para Supabase (tabela `meta_inovacao_matriz_demandas`) — edição inline colaborativa, realtime entre abas/máquinas, identificação do editor, exportar JSON, cache de 30s. Cai para leitura local (`data/matriz.js`) se o Supabase não responder.
- `agenda.html`: visão calendário (toggle com a Lista) — mês corrente por padrão, navegação livre, faixas contínuas dos ciclos, marcos dos 7 nós do caminho crítico e dos encontros já datados.
- `supabase/setup.sql` criado (tabela + RLS + seed a partir de `data/matriz.js`) — **não executado neste deploy**, precisa rodar manualmente no SQL Editor do Supabase (sem credencial de DDL disponível no ambiente da automação).

## v0.2.0 — 2026-08-12
- O ambiente ganha nome e identidade: **Carta de Corso** (título das páginas, cabeçalho e config). O plano vigente segue como Meta Inovação 2026, no subtítulo.
- Deck dos 8 canais URC (apresentacao_canais.html) incorporado ao repositório, com o slide da soma citando a meta de omnicanalidade da URC (2025).

## v0.1.0 — 2026-08-11
Primeira versão publicável do painel Meta Inovação 2026.

- Dashboard com trilho dos 7 nós do caminho crítico, 6 KPIs, radar de carga por dia, atrasadas e próximos 7 dias.
- Plano de ação: 47 ações navegáveis com solução proposta por ação (como executar, como monitorar, ferramenta).
- Caminho crítico: 7 nós com estado calculado por data, fallbacks, gatilhos, 2 SLAs e janelas de folga.
- Agenda: Ciclos 1 e 2 com a URC; 16 encontros criados como "a agendar" (Nó 1 pendente).
- Matriz de demandas 27 iniciativas × 8 canais, nascendo limpa, com fluxo de estados por célula.
- Participantes por grupo com pendências de indicação e fallback do Nó 2.
- Modo edição no navegador com download do data/*.js atualizado no formato canônico.
- 5 testes automatizados (dados, cálculos, site, KPIs cruzados, roundtrip do editor).
