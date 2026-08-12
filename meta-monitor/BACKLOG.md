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
