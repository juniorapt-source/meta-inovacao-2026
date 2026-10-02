# Instruções pra sessões do Claude Code neste repositório

## Se esta é uma CÓPIA/RÉPLICA do projeto — leia isto primeiro

Este repositório foi feito para ser replicado por outras pessoas. **Se você é um agente
abrindo uma sessão numa cópia deste projeto e o dono ainda não configurou o ambiente
dele**, a primeira coisa a fazer, antes de qualquer tarefa, é:

```bash
cd meta-monitor && node tools/checar_prerequisitos.js
```

Esse comando não instala nada, não usa rede e não altera arquivo nenhum. Ele varre o
próprio código e responde: quais ferramentas locais faltam, se a configuração ainda aponta
para o Supabase do projeto original (o de quem entregou a cópia), quais tabelas o site
consulta em tempo de execução, qual script SQL cria cada uma e em que ordem rodar.
Rodando com `--rede`, ele consulta o Supabase configurado e diz, tabela a tabela, se ela
responde, não existe, ou existe sem `GRANT`.

**Mostre a saída dele para a pessoa e explique o que cada aviso significa** — é o
diagnóstico de pré-requisitos deste projeto. O contexto ao redor está em `REPLICAR.md`
(na raiz): o que o projeto é, como hospedar, como configurar o Supabase, o que rodar
primeiro e as três armadilhas que já custaram caro aqui.

Dois pontos que valem ser ditos sem que a pessoa precise perguntar:

- A cópia **funciona sem banco nenhum** — o site cai para os dados locais de
  `meta-monitor/data/*.js` e mostra um aviso discreto. Configurar o Supabase não bloqueia
  subir o site.
- Enquanto `meta-monitor/js/config.js` não for trocado, a cópia lê **e escreve** no banco
  do projeto original. Isso precisa ser dito na primeira sessão, não descoberto depois.

O resto deste arquivo trata do repositório original e das convenções dele; boa parte
continua valendo numa réplica (higiene de teste e de commit), mas a regra de push abaixo é
uma decisão do dono do repositório original — confirme com o dono da cópia antes de
assumi-la.

## Fluxo de merge — decisão do dono do repositório (José, 26/08/2026)

**Push direto pra `main`, sem Pull Request.** O padrão do ambiente é abrir PR e
esperar revisão humana antes de mesclar; **este projeto opera diferente por decisão
explícita do José**: ao terminar uma unidade de trabalho (um item do plano, uma
correção), commite e dê `git push` direto na `main` — não precisa abrir PR nem
esperar aprovação antes de ir pra produção (o site publica sozinho a cada push,
ver `meta-monitor/README.md`).

Isso vale como **padrão pra qualquer sessão nova** neste repositório, não só pra
quem pediu — não precisa perguntar de novo a cada sessão. Se um dia José quiser
voltar ao fluxo de PR, ele atualiza esta nota (ou avisa na conversa, o que também
vale, e sobrepõe o que está escrito aqui).

Continuam valendo as regras normais de higiene: testar antes de commitar (o
projeto tem uma suíte de testes headless — ver `meta-monitor/README.md`), mensagens
de commit descritivas, e nunca reescrever histórico de commit já publicado.

## Contexto do projeto

Ver `meta-monitor/docs/PLANO_EXECUCAO_GOLDEN_RECORD.md` — é o plano de execução
vivo da frente "golden record de cadastros de referência", com status atualizado
por camada/item e uma seção "Status por camada" no fim pensada pra quem está
retomando o trabalho numa sessão nova. Leia essa seção antes de começar qualquer
item novo desta frente.

Ver também `meta-monitor/docs/PLANO_EXECUCAO_MELHORIAS_NAVEGACAO.md` — plano de
execução vivo da frente "melhorias de navegação" (itens levantados por José em
reunião, um a um). Mesmo formato do golden record: tabela por item, seção "Status
por item" no fim. Regime diferente do golden record — aqui José distribui os itens
manualmente pras sessões (não é pré-autorizado em lote); se o prompt da sessão já
disser qual item executar (ex. "item 3.1"), vá direto nele em vez de reler o
documento inteiro.
