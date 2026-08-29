#!/usr/bin/env bash
# D3.1 do plano de débitos técnicos (docs/PLANO_EXECUCAO_DEBITOS_TECNICOS.md) — a suíte
# do README (~25 comandos) era rodada um a um, à mão. Não existia runner nem CI: nada
# impedia um push quebrado de ir pro ar, e a única barreira era a disciplina de quem
# commitava.
#
# Este script roda a MESMA suíte do README, na MESMA ordem. O item D3.2 reconciliou os 15
# testes que existiam em tools/ e não estavam aqui nem no README: rodados um a um, nenhum
# obsoleto — os 15 entraram nas duas fontes (README.md e este script) juntos.
#
# Uso:
#   tools/rodar_testes.sh                # roda tudo: sem-Chrome primeiro, depois com-Chrome
#   tools/rodar_testes.sh --sem-chrome   # só os que não abrem navegador (rápido, sem CDP)
#   tools/rodar_testes.sh --com-chrome   # só os que abrem Chrome/Chromium via CDP
#
# Ordem: primeiro os testes que não precisam de Chrome (mais rápidos, então "para no
# primeiro vermelho" já pega o mais barato de diagnosticar primeiro), depois os headless
# via CDP. Pra rodar os headless, precisa de um Chrome/Chromium instalado — cada teste já
# procura sozinho (CHROME_PATH ou os caminhos comuns de Linux/macOS, ver
# tools/testar_dashboard_headless.js:acharChrome()); se nenhum for achado, o teste falha
# com a mensagem explicando onde configurar CHROME_PATH, e este script conta isso como
# vermelho normal (não tem tratamento especial pra "Chrome ausente").
#
# Para no primeiro vermelho (comportamento padrão de suíte: não adianta rodar o resto se
# a base já quebrou) e imprime um resumo final por teste — inclusive os que não chegaram
# a rodar, marcados "não executado", pra ficar claro o que a rodada realmente cobriu.
set -uo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

MODO="${1:-tudo}"
case "$MODO" in
  --sem-chrome|--com-chrome|tudo) ;;
  *) echo "uso: $0 [--sem-chrome|--com-chrome]" >&2; exit 2 ;;
esac

# nome | comando — mesma ordem e mesmo conjunto do README ("Testes (os mesmos usados na
# construção)"). Mudar a suíte é mudar as duas fontes juntas (README.md e esta lista), o
# corolário do 2.5 aplicado aqui: nenhuma das duas fica pra trás sozinha.
SEM_CHROME=(
  "validar_dados.py|python3 tools/validar_dados.py"
  "testar_calc.js|node tools/testar_calc.js"
  "validar_site.py|python3 tools/validar_site.py"
  "testar_kpis_cruzado.py|python3 tools/testar_kpis_cruzado.py"
  "testar_editor.js|node tools/testar_editor.js"
  "gerar_responsavel_id.js --check|node tools/gerar_responsavel_id.js --check"
  "testar_responsaveis.js|node tools/testar_responsaveis.js"
  "testar_catalogos_base.js|node tools/testar_catalogos_base.js"
  "testar_db_base.js|node tools/testar_db_base.js"
  "testar_busca_golden.js|node tools/testar_busca_golden.js"
  "auditoria_fk_final.js --check|node tools/auditoria_fk_final.js --check"
  # item D3.2 — órfãos reconciliados, puros/sem navegador
  "testar_canva.js|node tools/testar_canva.js"
  "testar_supabase_erros.js|node tools/testar_supabase_erros.js"
  # os 2 abaixo falam com o Supabase de PRODUÇÃO (leitura pública) mas nunca travam a
  # suíte por falta de rede: sem conseguir alcançar, saem 0 com aviso — mesma postura de
  # graceful-skip, não precisam do --confirmar que testar_rede_real_headless.js exige
  "testar_iniciativas_cruzado.js|node tools/testar_iniciativas_cruzado.js"
  "testar_guardrail_urc_supabase.js|node tools/testar_guardrail_urc_supabase.js"
)

COM_CHROME=(
  "testar_dashboard_headless.js|node tools/testar_dashboard_headless.js"
  "testar_minhas_acoes_headless.js|node tools/testar_minhas_acoes_headless.js"
  "testar_status_badges_headless.js|node tools/testar_status_badges_headless.js"
  "testar_timeline_headless.js|node tools/testar_timeline_headless.js"
  "testar_mobile_headless.js|node tools/testar_mobile_headless.js"
  "testar_busca_headless.js|node tools/testar_busca_headless.js"
  "testar_drawer_headless.js|node tools/testar_drawer_headless.js"
  "testar_matriz_headless.js|node tools/testar_matriz_headless.js"
  "testar_matriz_editor_headless.js|node tools/testar_matriz_editor_headless.js"
  "testar_projetos_editor_representantes_headless.js|node tools/testar_projetos_editor_representantes_headless.js"
  "testar_urc_editor_headless.js|node tools/testar_urc_editor_headless.js"
  "testar_plano_acao_responsavel_headless.js|node tools/testar_plano_acao_responsavel_headless.js"
  # item D3.2 — órfãos reconciliados, headless via CDP
  "testar_kanban_headless.js|node tools/testar_kanban_headless.js"
  "testar_projetos_headless.js|node tools/testar_projetos_headless.js"
  "testar_participantes_headless.js|node tools/testar_participantes_headless.js"
  "testar_canva_oficina.js|node tools/testar_canva_oficina.js"
  "testar_canva_multiprojeto_headless.js|node tools/testar_canva_multiprojeto_headless.js"
  "testar_canva_combo_pessoas_headless.js|node tools/testar_canva_combo_pessoas_headless.js"
  "testar_canva_consolidado_golden_headless.js|node tools/testar_canva_consolidado_golden_headless.js"
  "testar_historico_headless.js|node tools/testar_historico_headless.js"
  "testar_dashboard_golden_headless.js|node tools/testar_dashboard_golden_headless.js"
  "testar_minhas_acoes_golden_headless.js|node tools/testar_minhas_acoes_golden_headless.js"
  "testar_projetos_golden_headless.js|node tools/testar_projetos_golden_headless.js"
)

NOMES=()
STATUS=()   # OK | FALHOU | "não executado"
PAROU=0

rodar_lote() {
  local rotulo="$1"; shift
  local lote=("$@")
  echo ""
  echo "== $rotulo (${#lote[@]} teste(s)) =="
  for entrada in "${lote[@]}"; do
    local nome="${entrada%%|*}"
    local cmd="${entrada#*|}"
    if [ "$PAROU" -eq 1 ]; then
      NOMES+=("$nome"); STATUS+=("não executado")
      continue
    fi
    echo ""
    echo "--- $nome ---"
    if bash -c "$cmd"; then
      NOMES+=("$nome"); STATUS+=("OK")
    else
      NOMES+=("$nome"); STATUS+=("FALHOU")
      echo ""
      echo ">>> VERMELHO em '$nome' — parando aqui (rodar de novo depois de corrigir)."
      PAROU=1
    fi
  done
}

if [ "$MODO" != "--com-chrome" ]; then
  rodar_lote "sem Chrome" "${SEM_CHROME[@]}"
fi
if [ "$MODO" != "--sem-chrome" ]; then
  rodar_lote "com Chrome (headless via CDP)" "${COM_CHROME[@]}"
fi

echo ""
echo "======================================================================"
echo "Resumo — $(date +%Y-%m-%d\ %H:%M)"
FALHOU_ALGUM=0
for i in "${!NOMES[@]}"; do
  s="${STATUS[$i]}"
  case "$s" in
    OK) marca="[ OK  ]" ;;
    FALHOU) marca="[FALHOU]"; FALHOU_ALGUM=1 ;;
    *) marca="[ ..  ]" ;;
  esac
  printf "%s %s — %s\n" "$marca" "${NOMES[$i]}" "$s"
done
echo "======================================================================"

if [ "$FALHOU_ALGUM" -eq 1 ]; then
  exit 1
fi
exit 0
