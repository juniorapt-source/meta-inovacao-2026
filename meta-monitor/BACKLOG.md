# Backlog do plano de melhorias

Registro dos itens do "plano de melhorias" do painel Carta de Corso e seu estado. Este
arquivo não existia no repositório antes da v0.7.1. O plano completo (blocos 1–3, prompts
P2–P13) vive em `../prompts_code_melhorias_carta_corso.md` — este `BACKLOG.md` é o
registro de BAIXA (o que já foi feito, quando e por quê), não uma cópia do plano; consulte
o outro arquivo pra ver o que ainda falta e em que ordem. Os números #001/#002 do backlog
original não apareceram em nenhum prompt lido até agora (só #003/#004/#005) — se existirem,
ainda não foram cruzados aqui.

## Sidebar compacta/colapsável — sugestão fora de escopo (refactor v0.21 do Corsário)

**Status:** aberto — sugestão registrada, não implementada

Durante o refactor de UI/UX de `corsario.html` (v0.21.0, "protagonismo da Matriz"), a
sidebar ficou fora de escopo por instrução explícita (não alterar largura, itens ou
comportamento — componente compartilhado entre páginas). Registrando aqui como sugestão
pra uma rodada futura: uma sidebar compactável (largura reduzida ou colapsável) daria mais
espaço horizontal útil pra páginas com tabelas largas, como a Matriz do Corsário (19
colunas de critério) e a Matriz de demandas — hoje as duas dependem de scroll horizontal
contido justamente por essa disputa de espaço com o menu lateral.

**Nenhuma implementação feita** — só o registro da sugestão.

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

**Status:** aberto — avaliar

Os testes headless atuais forçam fallback local via `?semrede=1` (e
`window.CC_FORCAR_FALLBACK`) e por isso não pegam bugs de integração real com o
Supabase — ex.: o GRANT esquecido no P10 e a ordem de `js/config.js` no bug fix seguinte
(ambos só apareceram em produção, não na suíte).

**A avaliar:** adicionar 1–2 testes headless por página crítica que rodem contra o
Supabase de produção (ou um staging), acionados manualmente antes de deploys grandes.

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
