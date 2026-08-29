# Backlog do plano de melhorias

Registro dos itens do "plano de melhorias" do painel Carta de Corso e seu estado. Este
arquivo não existia no repositório antes da v0.7.1. O plano completo (blocos 1–3, prompts
P2–P13) vive em `../prompts_code_melhorias_carta_corso.md` — este `BACKLOG.md` é o
registro de BAIXA (o que já foi feito, quando e por quê), não uma cópia do plano; consulte
o outro arquivo pra ver o que ainda falta e em que ordem. Os números #001/#002 do backlog
original não apareceram em nenhum prompt lido até agora (só #003/#004/#005) — se existirem,
ainda não foram cruzados aqui.

## `editor.html` grande demais — extraindo aba por aba (concluído, 28/08/2026)

**Status:** concluído (28/08/2026) — 8 de 8 abas extraídas. Débitos que a extração
deixou (guardrail de FK cego pras âncoras migradas, helpers ainda em `editor.html`):
`docs/PLANO_EXECUCAO_DEBITOS_TECNICOS.md`, itens D1 e D6.1.

`editor.html` chegou a 105KB/~1750 linhas misturando o JS inline de 8 abas (Plano,
Agenda, Matriz, Pessoas, Projetos, URC-Liderança, URC-Canais, Corsário) num único
`<script>`. Sugestão do José (28/08/2026): sem build no projeto, uma reescrita completa
sai cara — mas dá pra quebrar o JS de cada aba em `js/editor-<aba>.js` conforme o arquivo
for sendo mexido, reduzindo o "raio de explosão" de cada edição sem mudar nenhum
comportamento. Plano acordado: uma aba por vez, da mais isolada (menos estado
compartilhado com as outras) pra mais arriscada — Histórico e Matriz primeiro (as duas
únicas só-leitura), Plano por último (a mais crítica: edição ao vivo das 47 ações, mais
helpers compartilhados). O que for genuinamente compartilhado entre 2+ abas (`opts()`,
`nucleosPorNome()`, `detErro()`...) fica em `editor.html` até uma 2ª aba precisar dele —
só aí vira um `js/editor-shared.js`, em vez de adivinhar hoje o que vai ser
compartilhado.

**Etapa 1 — Histórico → `js/editor-historico.js`:** feita. Zero estado compartilhado com
outras abas; expõe `window.EDITOR_HISTORICO.{montar,ativar}`. `alternarAba()` (o
"spine" que troca entre a aba Dados/Histórico) passou a chamar `EDITOR_HISTORICO.ativar()`
em vez de uma função local. Testado com `tools/testar_historico_headless.js` (dedicado)
+ suíte geral, tudo verde.

**Etapa 2 — Matriz → `js/editor-matriz.js`:** feita. Único ponto de acoplamento com o
"spine": o botão "Exportar cópia de segurança" (genérico, usado só por conjuntos
`snapshot:true` — hoje só a Matriz) precisa do modelo carregado pra gerar o arquivo;
resolvido expondo `window.EDITOR_MATRIZ.modeloAtual()` além de `.render()`. Testado com
`tools/testar_matriz_editor_headless.js` (dedicado — inclui a checagem de o snapshot
gerado bater chave a chave com o de `demandas.html`) + suíte geral, tudo verde.

**Etapa 3 — Corsário → `js/editor-corsario.js`:** feita, mas revelou um problema que
mudou como as etapas seguintes são feitas: `opts()`, `avisoFallback()`,
`marcarLinhaStatus()`/`marcarCelulaStatus()`, `detErro()`, `nucleosPorNome()`,
`projetoIdPorIniciativa()`, `normalizarNomePessoa()`, `nomeExibicaoPessoa()` e
`NUCLEOS_VALIDOS` são declarados DENTRO do IIFE de `editor.html` — não são globais de
verdade. Um script à parte (`js/editor-corsario.js`) referenciando `opts(...)` sem mais
não enxergava nada e estourava `ReferenceError` assim que uma célula com dado de
verdade tentasse renderizar. **O teste manual da época só bateu no caminho vazio
(offline), que nunca chega a chamar essas funções — passou sem detectar o problema.**
Corrigido expondo cada uma via `window.X = X` logo após a declaração, sem mudar onde
elas moram (continuam em `editor.html`, ainda usadas pelas abas não extraídas). Achado e
corrigido antes do merge pra `main` — nenhum código quebrado chegou a ir pro ar.
**Lição pra quem for extrair as próximas abas:** todo helper que a aba extraída chama e
que não é um `DB_*`/`window.esc`/`window.CC_*` já confirmadamente global precisa dessa
checagem — teste sempre com DADO REAL (dublê de Supabase, não só `?semrede=1` vazio)
antes de considerar a etapa pronta; ver o commit da etapa 3 pro exemplo de como montar
esse teste.

**Etapa 4 — URC (Liderança+Canais) → `js/editor-urc.js`:** feita. As duas sub-abas
compartilham uma carga (`DB_URC.carregar()` busca as duas juntas — o guardrail do item
4.4 precisa da liderança carregada mesmo editando só canais); `canaisAtual`/
`canaisFallback` viraram estado privado do módulo (confirmado que só URC os usava antes
de mover). Diferente das etapas 1-3, esta tinha uma dependência bidirecional de verdade
com uma aba NÃO extraída: `pessoasAtual`/`pessoasFallback` são compartilhados com
Pessoas e Projetos. Resolvido com `window.EDITOR_PESSOAS_CACHE.{obter,definir}` (getter/
setter definido em `editor.html`, ao lado da variável) — quem carrega primeiro grava,
quem abre depois reaproveita, confirmado com um teste ad-hoc (1 chamada à tabela só,
abrindo Pessoas e depois URC). Testado com `tools/testar_urc_editor_headless.js`
(dedicado, offline+online com dublê, inclui o guardrail) + suíte geral, tudo verde.

**Etapa 5 — Projetos & Representantes → `js/editor-projetos.js`:** feita. Mesmo padrão
da etapa 4 (`window.EDITOR_PESSOAS_CACHE`, sem mudança) + um cache novo,
`window.EDITOR_PROJETOS_CACHE.{obter,definir,marcarCarregando}` — `projetosAtual`/
`projetosFallback`/`projetosCarregando` são compartilhados com `projetoIdPorIniciativa()`
(fica em `editor.html`, usado pela aba Corsário); `projetoIdPorIniciativa()` continua no
mesmo closure da variável, não precisou do getter/setter. Testado com
`tools/testar_projetos_editor_representantes_headless.js` (dedicado) + dois scripts CDP
ad-hoc extras confirmando o fluxo completo de "+ Novo projeto" (criação → vínculo de
representante → propagação pro Corsário via insert em lote) ponta a ponta.

`editor.html`: 1744 → 852 linhas (as cinco etapas).

**Etapa 6 — Pessoas → `js/editor-pessoas.js`:** feita. `pessoasCarregando` virou estado
privado do módulo (confirmado que só `renderPessoas` usava essa trava — URC e Projetos
nunca checaram "carregando", só a lista). **`pessoasAtual`/`pessoasFallback` NÃO foram
movidos** — ficaram de propósito em `editor.html`, diferente do que a nota da etapa 5
cogitava: `listaResponsaveis()` (usada pela aba Plano, ainda não extraída) lê/escreve
nelas direto no mesmo closure, então mover a variável quebraria essa leitura até o Plano
também ser extraído. Esta etapa só usa `window.EDITOR_PESSOAS_CACHE` (já existente desde
a etapa 4), sem mudar sua API. **A oportunidade real de "fechar o círculo" e mover a
variável de vez fica pra quando o Plano (etapa 8) for extraído** — aí sim não sobra
nenhum consumidor direto em `editor.html`. Testado com um script CDP ad-hoc (não existe
teste headless dedicado pra esta aba): offline e online com dublê, editando um campo de
texto e um checkbox, os dois gravando certo.

`editor.html`: 1744 → 788 linhas (as seis etapas, menos da metade do tamanho original).

**Etapa 7 — Agenda → `js/editor-agenda.js`:** feita. A mais isolada das que restavam —
zero estado compartilhado com qualquer outra aba (`agendaAtual`/`agendaFallback`/
`agendaCarregando`/`STATUS_ENC`/`ROTULO_ENC` só eram usados aqui, confirmado antes de
mover). Testado com um script CDP ad-hoc (sem teste headless dedicado pra esta aba):
offline e online com dublê — o teste bateu de propósito na tradução de status
(`encontro_confirmado` → "Confirmado", não a chave crua), pra garantir que o item
2.4/P6 (a correção que criou `STATUS_ENC`/`ROTULO_ENC`) continua funcionando depois da
extração.

`editor.html`: 1744 → 729 linhas (as sete etapas).

**Etapa 8 — Plano → `js/editor-plano.js`:** feita — última das 8. A mais crítica
(edição ao vivo das 47 ações) e a mais acoplada: `mapaPrefixos`/`proximoId`/
`listaResponsaveis`/`gravarPlanoResponsaveis` e todo o estado (`planoAtual`/
`planoFallback`/`planoCarregando`/`formNovaAberto`/`coletivosAtual`/
`listaResponsaveisMontada`) eram exclusivos desta aba — confirmado antes de mover — e
foram todos junto. Única dependência cross-arquivo: `pessoasAtual`/`pessoasFallback`
dentro de `listaResponsaveis()`, via `EDITOR_PESSOAS_CACHE` (mesmo padrão das etapas
4/5, sem mudança na API).

**Incidente durante esta etapa, corrigido antes do commit:** a primeira tentativa de
remoção por linha apagou por engano `marcarLinhaStatus()`/`marcarCelulaStatus()`/
`detErro()` inteiras — elas ficavam fisicamente ENTRE `mapaPrefixos` e `renderPlano` no
arquivo original, mas são compartilhadas por Agenda/Pessoas/Projetos/URC, não
exclusivas do Plano. `tools/testar_urc_editor_headless.js` pegou na hora (3 asserções
falhando + uma exceção em cascata) — reforça a lição da etapa 3: rodar a suíte
COMPLETA (não só o teste da aba que acabou de mudar) depois de qualquer edição que
mexa no meio de um arquivo compartilhado, porque a extração de uma aba pode arrastar
código de outra sem querer quando as duas estão fisicamente próximas no arquivo
original.

`editor.html`: 1744 → 519 linhas — **redução de 70%, as 8 etapas concluídas.**

**Não fechado, registrado como oportunidade futura opcional (não bloqueia nada):**
`pessoasAtual`/`pessoasFallback` continuam morando em `editor.html` (via
`EDITOR_PESSOAS_CACHE`) em vez de dentro de `js/editor-pessoas.js`, mesmo depois da
etapa 8 ter removido o último consumidor direto de dentro de `editor.html`. Também:
`opts`/`avisoFallback`/`marcarLinhaStatus`/`marcarCelulaStatus`/`detErro`/
`nucleosPorNome`/`projetoIdPorIniciativa`/`normalizarNomePessoa`/`nomeExibicaoPessoa`/
`NUCLEOS_VALIDOS` continuam em `editor.html`, expostos via `window.X`, embora hoje só
sejam chamados pelos 8 arquivos `js/editor-*.js` (nenhum consumidor direto sobrou em
`editor.html` depois da etapa 8) — dá pra virar um `js/editor-shared.js` de verdade
numa rodada futura, mas não é urgente: o objetivo original (reduzir o raio de explosão
de mexer numa aba) já foi alcançado com as 8 extrações.

## Sidebar compacta/colapsável — implementada (28/08/2026)

**Status:** resolvido

Durante o refactor de UI/UX de `corsario.html` (v0.21.0, "protagonismo da Matriz"), a
sidebar ficou fora de escopo por instrução explícita (não alterar largura, itens ou
comportamento — componente compartilhado entre páginas). Ficou registrada aqui como
sugestão pra uma rodada futura: uma sidebar compactável (largura reduzida ou colapsável)
daria mais espaço horizontal útil pra páginas com tabelas largas, como a Matriz do
Corsário (19 colunas de critério) e a Matriz de demandas — hoje as duas dependem de scroll
horizontal contido justamente por essa disputa de espaço com o menu lateral.

**O que foi feito:** em vez de reduzir a largura (exigiria um jogo de ícones que a
sidebar não tem hoje — só rótulos de texto), o menu passou a ser **ocultável por
completo**, com uma aba fina "» Menu" fixada na borda esquerda pra reabrir. Um botão "«
Ocultar menu" entra no topo do próprio `<nav>` (`js/core.js`, `montarShell`/
`montarColapsavel`, nova função) — clicar nele soma a classe `nav-colapsada` em `.shell`,
que zera a coluna do grid do menu (`css/base.css`, regra só dentro de
`@media (min-width:768px)` pra nunca competir com o mecanismo de menu hambúrguer do
mobile, que é outro). O estado fica em `localStorage` (`cc_nav_colapsada`) — colapsar
numa página vale nas outras ao navegar, já que aqui cada página é um carregamento novo,
não uma SPA; sem `localStorage` (file://, modo privado) o toggle ainda funciona dentro da
mesma página, só não persiste. Zero mudança de HTML por página (mesmo padrão do menu
mobile, injetado a partir do `<nav>` vazio que já existe em toda tela).

**Teste:** sem headless novo (é layout puro, CSS+localStorage, sem lógica de dados pra
travar) — validado manualmente: toggle esconde/mostra o menu, aba de reabrir aparece só
colapsado, estado sobrevive a navegar pra outra página, e em ≤767px (mobile) o mecanismo
não aparece — quem manda lá continua sendo o hambúrguer de sempre. `tools/validar_site.py`
e a suíte headless (`tools/testar_mobile_headless.js` etc.) seguem verdes.

## Item 3.4 — Histórico e auditoria

**Status:** código pronto e testado (v0.19.0) — ativação manual pendente (rodar o SQL, não é passo de código)

Item 3.4 do plano de melhorias, último da fila — depende de P10 (persistência), já
entregue. Com a edição direta no Supabase e a perspectiva da Expansão (mais gente
editando), faltava saber quem mudou o quê e quando.

**O que foi feito no código:** `tools/sql/2026-08_auditoria.sql` (novo) cria
`meta_inovacao_audit_log` + a função `cc_audit()` `SECURITY DEFINER`, com trigger
`AFTER INSERT/UPDATE/DELETE` nas 4 tabelas editáveis. `js/editor_atual.js` (novo,
`window.EDITOR_ATUAL`) centraliza a identificação de quem edita — rodapé "Editando
como… trocar" com a lista canônica de responsáveis + "Outro", embutido nas 4 telas de
escrita (`editor.html`, `demandas.html`, `plano-acao.html`, `plano.html`). `editor.html`
ganhou a aba "Histórico" (últimas 100 alterações, filtro por tabela/autor, status sempre
traduzido via `CC_STATUS.rotulo` — nunca a chave crua). `js/supabase.js` manda o header
`x-cc-editor` em toda escrita. Detalhes completos no CHANGELOG v0.19.0.

**Ativação:** rodar `tools/sql/2026-08_auditoria.sql` no SQL Editor do Supabase (depois
de plano/agenda/proteção de escrita) — sem nenhum passo de código depois disso, a aba
Histórico de `editor.html` já passa a ler o log de verdade.

## Cobertura de teste com rede real

**Status:** resolvido (28/08/2026)

Os testes headless da suíte forçam fallback local via `?semrede=1` (e
`window.CC_FORCAR_FALLBACK`) e por isso não pegavam bugs de integração real com o
Supabase — ex.: o GRANT esquecido no P10 e a ordem de `js/config.js` no bug fix seguinte
(ambos só apareceram em produção, não na suíte).

**O que foi feito:** `tools/testar_rede_real_headless.js` (novo) — 2 páginas
(`index.html`, cobrindo Plano; `agenda.html`, cobrindo Plano+Agenda, os dois conjuntos que
hoje vivem no Supabase) abertas SEM `?semrede=1`/`CC_FORCAR_FALLBACK`, contra o Supabase de
verdade. Confere: `#aviso-fallback` continua escondido (não caiu pro local), zero erro de
console/exceção durante o carregamento, e a contagem de linhas no piso conhecido (47/20) ou
acima — piso, não igualdade, pra dado novo cadastrado depois não virar falso-positivo. Só
leitura (nunca escreve), então é seguro rodar contra produção quantas vezes quiser. Exige
`--confirmar` (ou `CC_CONFIRMAR_REDE_REAL=1`) — sem isso sai sem tentar rede, pra nunca
disparar sem querer numa rodada em lote com os outros `testar_*`; por isso também não
entra no README como parte da suíte automática, só documentado como comando manual.

**Testado como:** não dá pra validar contra o Supabase de produção de dentro de uma sessão
do Claude Code (rede bloqueada pra `supabase.co`, mesma limitação do golden record) — o
que foi validado aqui foi o caminho de FALHA: rodado de propósito neste ambiente sem rede,
o teste pegou exatamente os 3 sintomas que deveria pegar (`#aviso-fallback` visível,
`TypeError` de import do SDK no console, `DB_PLANO.carregar()`/`DB_AGENDA.carregar()`
confirmando `usandoFallback:true`) e saiu com código 1. O caminho de sucesso (rede real
funcionando) fica pra José confirmar rodando de verdade antes do próximo deploy grande que
mexer em `js/db-plano.js`/`js/db-agenda.js`/`js/config.js` ou nas policies/GRANTs dessas
duas tabelas — ver o comando no README.

## #005 — Rótulos de menu confusos

**Status:** parcialmente resolvido (v0.7.1)

O item "Plano de Ação x Projeto" no sidebar colidia de nome com "Plano de ação"
(`plano.html`) — dois conceitos diferentes (o plano de 47 ações do caminho crítico vs. as
atividades por iniciativa/projeto), mas com rótulos quase idênticos no menu.

**O que foi feito:** renomeado no sidebar (`js/core.js`) e no `<title>`/`<h1>` de
`plano-acao.html` para **"Atividades por iniciativa"**. Nome do arquivo e URL
(`plano-acao.html`) não mudaram — nenhum link quebrou.

**Por que "parcial":** o plano de melhorias original pode ter mais frentes associadas a
este item (ex.: revisão de outros rótulos ambíguos no menu) que não estavam no escopo do
Bloco 1. Se houver mais partes do #005, listar aqui na próxima rodada.

## #004 — Lista fixa de responsáveis

**Status:** resolvido (v0.9.0)

Não existia uma lista canônica de responsáveis — cada dataset (`data/plano.js`, `data/nos.js`,
Supabase de `plano-acao.html`) tinha seu próprio texto livre pra "quem é responsável".

**O que foi feito:** `data/pessoas.js` ganhou `window.DB.responsaveis` — 31 responsáveis
(id estável + nome + grupo de agrupamento visual), extraídos varrendo `resp` de
`data/plano.js`, `guardiao` de `data/nos.js` e `representantes` de `data/projetos.js`.
`js/responsaveis.js` (novo, funções puras testáveis em node) resolve texto livre ("JR. e
Pova", "Comitê e Sandra") pra array de ids. `data/plano.js` ganhou `responsavel_id` em
cada uma das 47 ações — campo `resp` original mantido intocado, gerado por
`tools/gerar_responsavel_id.js` (idempotente; `--check` trava divergência se `resp` for
editado à mão sem regenerar). `plano-acao.html` trocou o campo livre "Responsável" por um
select alimentado pela lista canônica; atividade gravada antes da mudança com texto que não
bate com nenhum id vira opção "⚠ legado" marcada visualmente, sem apagar nada.

**Valor livre sem mapeamento:** `"Núcleo de Startups"` em `data/projetos.js` (representante
da iniciativa Sebrae Startups) — é um placeholder de indicação pendente (mesmo tratamento
que `index.html` já dá a ele via `PLACEHOLDER_RE`), não uma pessoa; ficou de fora da lista
canônica de propósito. Nenhum valor de `resp` (plano) ou `guardiao` (nós) ficou sem mapear.

**Guardrail ajustado:** `tools/validar_dados.py` tinha um guardrail genérico contra campos
de autoria fora de `data/projetos.js` (histórico: "Criss"/"Cris" divergindo). `responsavel_id`
é uma exceção pontual e documentada no próprio arquivo — é a versão estruturada do `resp`
que já existia antes do guardrail, não autoria nova; a consistência é garantida por
`tools/gerar_responsavel_id.js --check`, que fecha a mesma lacuna de drift.

## #003 — Visão "Minhas ações" por responsável

**Status:** resolvido (v0.9.0)

Não existia uma visão que respondesse "o que eu tenho que fazer?" pra uma pessoa específica.

**O que foi feito:** `minhas-acoes.html` novo (menu Execução, logo após "Plano de ação").
Seletor "Ver como" (lista canônica, `data/pessoas.js.responsaveis`), persistido em
`localStorage` (`cc_ver_como`) e suportando link direto `?pessoa=<id>` (compartilhável no
WhatsApp — a página reflete a pessoa atual na querystring). Três seções: nós do caminho
crítico onde é guardiã (`data/nos.js`, casado por `js/responsaveis.js`), ações do plano
onde `responsavel_id` inclui a pessoa (atrasadas → prazo crescente → janelas), atividades
por iniciativa do Supabase onde `responsavel` é a pessoa. Cabeçalho com resumo
"N itens sob sua guarda · X atrasados · Y vencem em 7 dias".

**Seção de encontros da agenda omitida de propósito:** `data/agenda.js` não tem nenhum
campo ligando um encontro a uma pessoa — o prompt original pedia pra omitir a seção nesse
caso em vez de inventar o vínculo, e foi o que se fez (comentário no HTML explica o porquê,
pronto pra a seção entrar se esse campo existir um dia).

## Item 3.1 — Unificação da persistência no Supabase (Plano e Agenda)

**Status:** ativo em produção (v0.17.0 + correção pós-ativação abaixo)

Plano de ação (status/prazos das 47 ações) e Agenda (datas/locais/confirmações dos 20
encontros) viviam só em `data/plano.js`/`data/agenda.js`, editados via `editor.html` no
modelo "edita cópia local → baixa arquivo → substitui no repo → commit" — o mesmo modelo
que `plano_acao_atividades` e a matriz de demandas já tinham deixado pra trás bem antes
(CRUD ao vivo no Supabase).

**O que foi feito no código:** `tools/sql/2026-08_plano.sql`/`2026-08_agenda.sql` (novos,
gerados por `tools/gerar_seed_supabase.js`) criam `meta_inovacao_plano_acoes`/
`meta_inovacao_agenda_encontros` com o mesmo padrão de RLS/token do item 2.1, seed
incluso. `js/db-plano.js`/`js/db-agenda.js` (novos) leem de lá com fallback automático
pro seed local (`data/plano.js`/`data/agenda.js`, que continuam no repo só pra isso) se o
Supabase estiver fora do ar — aviso discreto na tela quando isso acontece.
`index.html`/`plano.html`/`caminho.html`/`minhas-acoes.html`/`agenda.html` migrados pra
ler por essa camada; `editor.html` migrado pra CRUD ao vivo nesses dois conjuntos
(matriz/pessoas/projetos/URC continuam no modelo antigo de baixar/publicar). Testes
headless adaptados pra forçar o fallback local via `window.CC_FORCAR_FALLBACK`/
`?semrede=1`, sem depender de rede real. Detalhes completos no CHANGELOG v0.17.0.

**Limitação conhecida:** `js/drawer.js` (painel de Pessoa/Iniciativa) e `js/busca.js`
(índice de busca global) continuam lendo o seed síncrono em vez do dado ao vivo — fora do
escopo desta leva, registrado no CHANGELOG.

**Ativação:** `2026-08_plano.sql` e `2026-08_agenda.sql` foram rodados no Supabase — as
duas tabelas estão em produção, `js/db-plano.js`/`js/db-agenda.js` já leem de lá.

**Bug do gerador de SQL do P10:** os dois scripts saíram sem `GRANT SELECT, INSERT,
UPDATE` pras roles `anon`/`authenticated` e criavam a policy de SELECT com o nome
`select_publico` (duplicando o padrão que devia ser único, `cc_select_publico`). Sem o
GRANT, RLS nunca chega a ser avaliado — o site recebeu `401 permission denied for table`
em produção mesmo com a policy de SELECT certa criada. Corrigido em produção (GRANT
aplicado manualmente, policy renomeada) e nos scripts versionados (`tools/sql/2026-08_plano.sql`/
`2026-08_agenda.sql`, cabeçalho documenta o antes/depois). Padrão documentado em
`tools/sql/PADRAO_TABELA.md` — checklist obrigatório pra qualquer tabela nova daqui em
diante (P13/`meta_inovacao_audit_log` incluído).

## Item 2.1 — Proteção de escrita no Supabase (token compartilhado)

**Status:** ativo (v0.16.0 + commit "ativa token de escrita Supabase")

Até a v0.15.0, as policies de RLS do Supabase aceitavam escrita anônima em
`plano_acao_atividades` e `meta_inovacao_matriz_demandas` — qualquer um com a URL gravava.

**O que foi feito no código:** `js/supabase.js` novo (client Supabase centralizado,
`window.CC_SUPABASE`) — as duas formas que já existiam de criar client (SDK clássica via
CDN em `js/matriz-store.js`, `import()` dinâmico da lib ESM em `plano-acao.html`/
`minhas-acoes.html`) passam a configurar o header `x-cc-token` em toda requisição, lido de
`window.CC_TOKEN`. `js/gate.js` define `CC_TOKEN` sempre (direto de
`DB.config.tokenEscrita` enquanto `exigirSenha` for `false`, como é hoje; derivado de
`sessionStorage.cc_token` — gravado junto do `cc_auth` na hora da senha certa — se
`exigirSenha` virar `true` no futuro). Erro de escrita por permissão vira "Sem permissão
de escrita — fale com o JR." em vez de stacktrace (`plano-acao.html`, `demandas.html`).
`tools/sql/2026-08_protecao_escrita.sql` gerado (script de RLS pras 2 tabelas, com token
placeholder e bloco de reversão). **Ativado:** o JR. rodou o SQL manualmente no Supabase e
`data/config.js.tokenEscrita` foi trocado do placeholder pro token real (commit "ativa
token de escrita Supabase") — as duas tabelas já exigem `x-cc-token` certo pra
INSERT/UPDATE; o mesmo token passou a ser reaproveitado nas policies de
`meta_inovacao_plano_acoes`/`meta_inovacao_agenda_encontros` (item 3.1) em vez de gerar um
novo. `js/gate.js` documenta a distinção: é proteção client-side leve contra acesso
casual, não impede escrita de quem tiver a senha do site (consegue extrair o token do
sessionStorage) — proporcional à escolha de senha compartilhada sem usuários individuais;
Supabase Auth com usuários fica registrado como evolução futura mais forte.
