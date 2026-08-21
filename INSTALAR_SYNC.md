# Sincronização automática com o GitHub

## A causa raiz

Este projeto tem **duas cópias e um sentido só de fluxo**. As sessões do Claude Code
trabalham na nuvem, commitam e empurram direto pro GitHub. A pasta no Mac só recebe
alguma coisa quando alguém digita `git pull`, e você quase nunca abre o terminal.

Não é bug, é ausência de gatilho: nada na sua rotina dispara um pull. Em 20/08 o
repositório andou duas vezes (v0.30.0 e o script da reversão) e a pasta local ficou
parada no commit anterior. Foi assim que a §6.5 do plano do canvas quase virou código em
cima de um mundo que não existia mais.

**A fonte da verdade é o GitHub.** A pasta local é espelho. O conserto é dar ao espelho um
gatilho próprio, em vez de depender da sua memória.

---

## Instalação, uma vez só

### 1. Confirme que o push funciona à mão

O `launchd` roda sem terminal e sem ninguém pra digitar senha. Se o seu git ainda pede
credencial, ele vai falhar calado pra sempre. Então rode uma vez, no Terminal:

```bash
cd "$HOME/Documents/Claude/Projects/ambiente de monitoramento meta inovação"
chmod +x sync-carta-corso.sh
./sync-carta-corso.sh
```

Se pedir usuário e senha, resolva antes de seguir: instale o GitHub CLI e rode
`gh auth login`, ou configure um token no chaveiro. Se terminar com "sincronizado" ou
"em dia", pode continuar.

### 2. Ligue o agendamento

```bash
cp "$HOME/Documents/Claude/Projects/ambiente de monitoramento meta inovação/br.com.cartacorso.sync.plist" ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/br.com.cartacorso.sync.plist
```

Pronto. A partir daí ele roda a cada 20 minutos e uma vez a cada login.

### 3. Para conferir depois

```bash
tail -20 ~/Library/Logs/cartacorso-sync.log
```

### Para desligar

```bash
launchctl bootout gui/$(id -u)/br.com.cartacorso.sync
```

### Para rodar na hora, sem esperar os 20 minutos

```bash
launchctl kickstart -k gui/$(id -u)/br.com.cartacorso.sync
```

---

## O que o script faz, na ordem

1. **Só age no `main`.** Se você estiver em outro branch, ele sai sem tocar em nada
2. **Trava de segurança primeiro.** Se aparecer `.docx`, `.xlsx`, `.pptx`, `.pdf`, `.csv`,
   `.zip` ou arquivo de credencial na fila de commit, ele **para** e escreve no log qual
   arquivo é. O repositório é público, e a raiz da pasta já tem material interno solto.
   Sem essa trava, "automatizar o push" é sinônimo de "publicar por acidente"
3. **Puxa antes de empurrar**, com `--rebase --autostash`, pra não criar merge inútil nem
   perder o que você estava editando
4. **Commita e empurra** o que nasceu no Mac, com mensagem `sync: <data e hora>`
5. Se o push falhar, o commit fica feito e ele tenta de novo no ciclo seguinte

---

## Duas coisas que valem mais que o script

**Torne o repositório privado.** O site continua público pelo Vercel, que publica de
repositório privado sem problema em conta pessoal. O código-fonte não precisa estar
aberto, e hoje ele carrega o `tokenEscrita` em texto puro e material de trabalho interno
na raiz. Com o repositório fechado, automatizar push deixa de ser uma aposta.

**Acerte o `.gitignore` antes de confiar no `git add -A`.** Enquanto arquivo de trabalho
interno puder ser pego por um `add -A` distraído, a trava do script está protegendo você
de um problema que dava pra não ter.
