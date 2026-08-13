# Backlog do plano de melhorias

Registro dos itens do "plano de melhorias" do painel Carta de Corso e seu estado. Este
arquivo não existia no repositório antes da v0.7.1. O plano completo (blocos 1–3, prompts
P2–P13) vive em `../prompts_code_melhorias_carta_corso.md` — este `BACKLOG.md` é o
registro de BAIXA (o que já foi feito, quando e por quê), não uma cópia do plano; consulte
o outro arquivo pra ver o que ainda falta e em que ordem. Os números #001/#002 do backlog
original não apareceram em nenhum prompt lido até agora (só #003/#004/#005) — se existirem,
ainda não foram cruzados aqui.

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

## Item 2.1 — Proteção de escrita no Supabase (token compartilhado)

**Status:** não iniciado — é o PROMPT 3 de `prompts_code_melhorias_carta_corso.md`

Hoje as policies de RLS do Supabase aceitam escrita anônima em `plano_acao_atividades` e
na(s) tabela(s) da Matriz — qualquer um com a URL grava. O plano é restringir a escrita a
um header `x-cc-token` validado por RLS, com o token liberado só depois do gate de senha
(`js/gate.js`) desbloquear — por isso o PROMPT 3 depende do gate já estar no repositório
(mesmo desativado, que é o estado atual). `js/gate.js` já documenta essa distinção no
comentário de topo: é proteção client-side leve contra acesso casual, não impede escrita
de quem tiver a senha — o token compartilhado do item 2.1 é o que fecha essa lacuna
(dentro da proporção que uma senha compartilhada sem usuários individuais permite; o
próprio PROMPT 3 registra Supabase Auth com usuários como evolução futura mais forte).
