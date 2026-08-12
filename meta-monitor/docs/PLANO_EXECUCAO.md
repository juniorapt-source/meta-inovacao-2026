# PLANO DE EXECUÇÃO — Ambiente de Monitoramento Meta Inovação 2026
**Regime: pré-autorizado.** Este documento é o contrato de execução. Cada fase só avança se o teste automatizado da fase passar. Falhou → protocolo de ajuste → reteste. Nada trava o conjunto.

## O que será construído
Site estático multi-página (Vercel-ready, sem build step, sem backend), com dados versionados em Git desde o primeiro commit. Sandra mantém editando arquivos de dados (ou pelo Modo Edição no navegador) → commit → deploy automático.

| Página | Monitora |
|---|---|
| `index.html` | Dashboard: KPIs, trilho dos 7 nós, radar de carga por dia (14/08!), próximos 7 dias |
| `plano.html` | As 47 ações com filtros + **solução proposta por ação** (como executar · como monitorar · ferramenta) |
| `caminho.html` | 7 nós + 2 SLAs: guardião, fallback pré-combinado, gatilho de escalada, status |
| `agenda.html` | Ciclos 1 e 2, encontros por canal, datas, locais, confirmações |
| `demandas.html` | Matriz 27 iniciativas × 8 canais: oficina → formulário (5 d.u.) → priorização → URC |
| `participantes.html` | Comitê, representantes por núcleo (CAN-05), pendências de indicação |
| `editor.html` | Modo Edição: altera status/células/agenda no navegador e baixa o arquivo de dados atualizado |

## Arquitetura de dados
`data/*.js` com `window.DB.x = [JSON puro]` — funciona em `file://` e no Vercel, sem fetch/CORS. Validação por script (`tools/validar_dados.py`) que extrai e parseia o JSON de cada arquivo.

## Fases, testes de aceite e critério de avanço
| Fase | Entrega | Teste automatizado (aceite) |
|---|---|---|
| F0 | Repo git iniciado, estrutura, .gitignore, BUILD_STATUS.md | `git log` ≥ 1 commit; árvore criada |
| F1 | Camada de dados completa (plano+soluções, nós, canais, agenda, matriz, pessoas, iniciativas, config, changelog) | JSON válido em todos; contagens: 47 ações, 27 iniciativas, 8 canais, 7 nós; dependências apontam para IDs existentes |
| F2 | `css/base.css` (identidade herdada do site atual) + `js/core.js` + `js/calc.js` (funções puras) | `node` carrega calc.js; helpers de data corretos (3 asserts) |
| F3 | Dashboard | HTML parseia; links/scripts existem; **KPIs do JS = KPIs recalculados em Python** (dupla contagem independente) |
| F4 | plano.html + caminho.html | HTML parseia; todos os `script src` existem; 47 linhas renderizáveis (ids no dado) |
| F5 | agenda.html + demandas.html + participantes.html | HTML parseia; matriz referencia só iniciativas/canais válidos |
| F6 | editor.html | Roundtrip em node: dado → serializado pelo editor → re-parse ≡ original |
| F7 | README (deploy Vercel + fluxo de manutenção), CHANGELOG, versão no rodapé, commits por fase, tag `v0.1.0` | `git log` ≥ 8 commits; tag existe |
| F8 | Pacote final `.zip` com `.git` incluído + entrega | `unzip -l` contém `.git/HEAD`, todas as páginas e `data/` |

## Protocolo de ajuste (quando um teste falha)
1. Registrar `AJUSTE` no BUILD_STATUS.md com a causa. 2. Corrigir. 3. Reexecutar o teste (máx. 3 tentativas). 4. Persistindo, registrar em `PENDENCIAS.md`, isolar o item e **seguir com o restante** — o plano não trava por um item.

## Indicador de execução (anti-travamento)
`BUILD_STATUS.md` recebe uma linha carimbada a cada fase: `[hh:mm] F# — OK` ou `F# — AJUSTE(n)`. Se a última linha tiver mais de uma fase de distância do fim esperado, algo prendeu — o arquivo mostra exatamente onde. O resumo final no chat traz a mesma régua.

## Decisões tomadas por liberdade concedida
1. Continuidade visual com o index atual (Archivo/Inter/IBM Plex Mono, azul institucional) — identidade já publicada vence invenção nova.
2. Datas textuais do plano ("contínuo", "set–out") não entram no cálculo de atraso; viram badge "janela" — evita falso vermelho.
3. Encontros dos ciclos nascem "a agendar" (Nó 1 ainda pendente); o editor preenche quando a URC devolver a grade.
4. Núcleo das 27 iniciativas fica em branco no dado (não invento mapeamento); campo pronto para preenchimento.
5. `.git` vai dentro do zip: o histórico nasce junto, como pedido.
