#!/bin/zsh
# ---------------------------------------------------------------------------
# Sincroniza a pasta local do Carta de Corso com o GitHub.
#
# Existe porque a fonte da verdade deste projeto é o GitHub (as sessões do
# Claude Code commitam e empurram de lá), enquanto a pasta local só recebe
# arquivo quando alguém lembra de puxar. Resultado: o main local vive atrás.
#
# Ordem: puxa primeiro, commita depois, empurra por último. E PARA sozinho se
# aparecer arquivo que não deveria ir pra um repositório público.
#
# Instalação e uso: ver INSTALAR_SYNC.md, ao lado deste arquivo.
# ---------------------------------------------------------------------------
set -u

REPO="$HOME/Documents/Claude/Projects/ambiente de monitoramento meta inovação"

cd "$REPO" 2>/dev/null || { echo "[$(date '+%F %T')] pasta não encontrada: $REPO"; exit 1; }
git rev-parse --git-dir >/dev/null 2>&1 || { echo "[$(date '+%F %T')] não é repositório git"; exit 1; }

BRANCH="$(git symbolic-ref --short HEAD 2>/dev/null || echo '')"
if [ "$BRANCH" != "main" ]; then
  echo "[$(date '+%F %T')] branch '$BRANCH', não é main. Saindo sem mexer."
  exit 0
fi

# --- 1) trava de segurança: repositório público não recebe material interno ---
# Roda ANTES de qualquer coisa. Se aparecer .docx/.xlsx/.pptx/.pdf/.csv ou
# arquivo de credencial na fila, para tudo e avisa. Um dia você vai largar uma
# planilha com nomes nessa pasta, e nesse dia isso aqui vale o script inteiro.
PENDENTES="$(git status --porcelain | cut -c4-)"
SUSPEITOS="$(printf '%s\n' "$PENDENTES" | grep -Ei '\.(docx|xlsx|xlsm|pptx|pdf|csv|zip|key|pem|p12|env)"?$' || true)"
if [ -n "$SUSPEITOS" ]; then
  echo "[$(date '+%F %T')] PAROU. Arquivo que não deve ir pro repositório público na fila:"
  printf '  %s\n' "$SUSPEITOS"
  echo "  Resolva à mão: mova pra fora da pasta, ou acrescente ao .gitignore."
  exit 2
fi

# --- 2) puxa o que as sessões do Code empurraram ---
if ! git pull --rebase --autostash; then
  echo "[$(date '+%F %T')] pull falhou (conflito ou rede). Nada foi empurrado."
  exit 1
fi

# --- 3) commita o que nasceu aqui (planos, docs) e empurra ---
if [ -n "$(git status --porcelain)" ]; then
  git add -A
  git commit -m "sync: $(date '+%Y-%m-%d %H:%M')" >/dev/null || true
  if git push; then
    echo "[$(date '+%F %T')] sincronizado e empurrado."
  else
    echo "[$(date '+%F %T')] commit feito, push falhou. Fica pro próximo ciclo."
    exit 1
  fi
else
  echo "[$(date '+%F %T')] em dia, nada a commitar."
fi
