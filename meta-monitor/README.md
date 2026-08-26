# Carta de Corso — painel da Unidade de Inovação

> A carta de corso era o documento que legitimava o corsário: mesma tripulação, nova bandeira. Este ambiente é a nossa — o registro permanente de que a Inovação navega dentro das regras do Sebrae. As campanhas passam; a Carta fica.

## O plano vigente: Meta Inovação 2026

Ambiente estático (HTML + CSS + JS puro, sem build e sem backend) para acompanhar o plano de ação Atendimento e Relacionamento da Unidade de Inovação: 47 ações em 5 frentes, caminho crítico de 7 nós, agenda dos ciclos com a URC, matriz de demandas 27 iniciativas × 10 canais e participantes.

## Páginas

| Página | O quê |
|---|---|
| `index.html` | Dashboard: trilho dos 7 nós, KPIs, radar de carga por dia, atrasadas, próximos 7 dias |
| `plano.html` | 47 ações com filtros e busca; cada linha expande com dependências e a solução proposta (como executar, como monitorar, ferramenta) |
| `minhas-acoes.html` | "O que eu tenho que fazer?" por responsável: nós do caminho crítico onde é guardiã, ações do plano e atividades por iniciativa sob sua guarda |
| `caminho.html` | Os 7 nós do caminho crítico com estado calculado, fallbacks e gatilhos; SLAs pactuados e janelas de folga |
| `agenda.html` | Ciclos 1 e 2 com a URC e os 20 encontros (10 canais × 2 ciclos; Ciclo 1 já com grade v2, Ciclo 2 "a agendar") |
| `demandas.html` | Matriz 27 iniciativas × 10 canais com o fluxo previsto → oficina → formulário → priorizado → encaminhado |
| `participantes.html` | Pessoas por grupo, com pendências de indicação (CAN-05) e fallback do Nó 2 |
| `projetos.html` | Portfólio de projetos por núcleo, com representantes |
| `plano-acao.html` | Atividades por iniciativa (CRUD via Supabase) |
| `corsario.html` | Adequação de cada iniciativa ao ecossistema oficial (Supabase, somente leitura) — régua de 19 critérios, patente por faixa de % |
| `editor.html` | Modo edição: Plano de ação e Agenda editam ao vivo no Supabase (linha a linha, salva sozinho); matriz, pessoas, projetos e URC continuam no modelo "edita a cópia local, baixa `data/*.js`, publica no Git"; aba **Histórico** com as últimas 100 alterações (log de auditoria) |

## Como os dados funcionam

A maior parte do conteúdo vive em `data/*.js`, um arquivo por conjunto, sempre no formato:

```js
window.DB = window.DB || {};
window.DB.chave = { ...JSON puro... };
```

Isso permite abrir o site direto do disco (file://) e publicar no Vercel sem fetch, CORS ou build. Datas textuais ("contínuo", "set–out") não entram no cálculo de atraso: viram o selo "janela".

**Exceção — Plano de ação e Agenda vivem no Supabase** (`meta_inovacao_plano_acoes` e
`meta_inovacao_agenda_encontros`, mesmo padrão de `plano_acao_atividades`/
`meta_inovacao_matriz_demandas`): `js/db-plano.js`/`js/db-agenda.js` buscam de lá em toda
página que consome esses dois conjuntos (`index.html`, `plano.html`, `caminho.html`,
`minhas-acoes.html`, `agenda.html`); `data/plano.js`/`data/agenda.js` continuam no
repositório, mas viraram **seed + fallback de leitura**: se o Supabase estiver fora do ar
(ou a tabela ainda não existir), a página cai pra última cópia local e mostra um aviso
discreto ("dados locais — pode haver defasagem"). Todo o resto (`nos`, `projetos`,
`pessoas`, `matriz`, `config`, ...) continua só em `data/*.js`, editado via `editor.html` e
publicado por commit — nada mudou nesses.

## Publicar no Vercel (uma vez)

Sugestão de nome do projeto/repositório: `cartadecorso` — a URL fica `cartadecorso.vercel.app`.

Caminho recomendado — via GitHub:
1. Crie um repositório vazio no GitHub (ex.: `meta-inovacao-2026`).
2. Neste diretório: `git remote add origin <URL do repo>` e `git push -u origin main --tags`.
3. No Vercel: **Add New → Project → Import** do repositório. Framework preset: **Other**. Sem comando de build, output = raiz. Deploy.

Alternativa sem GitHub: `npm i -g vercel && vercel` na raiz do projeto.

A partir daí, todo `git push` publica sozinho.

## Manutenção do dia a dia (Sandra)

**Plano de ação e Agenda** — abra `editor.html`, escolha o conjunto, edite. Cada campo
salva sozinho no Supabase assim que você sai dele (o indicador ao lado da linha mostra
"salvando…"/"salvo"/o motivo se falhar). Não precisa baixar nem publicar nada.

**Todo o resto** (matriz, pessoas, projetos, URC):
1. Abra `editor.html`, escolha o conjunto, edite e clique em **Gerar e baixar arquivo atualizado**.
2. Substitua o arquivo de mesmo nome em `data/`.
3. Confira e publique:

```bash
python3 tools/validar_dados.py
git add data/
git commit -m "atualiza dados: <o que mudou>"
git push
```

Quem preferir pode editar `data/*.js` direto no editor de texto — o formato é JSON legível.

> Antes do primeiro commit de cada pessoa, ajustar a identidade do Git:
> `git config user.name "Seu Nome"` e `git config user.email "voce@sebrae.com.br"`.

## Testes (os mesmos usados na construção)

```bash
python3 tools/validar_dados.py         # integridade dos dados (47/27/10/7/2/20, dependências)
node tools/testar_calc.js              # cálculos: KPIs, atraso, carga por dia, estado dos nós
python3 tools/validar_site.py          # HTML: referências locais e ids obrigatórios por página
python3 tools/testar_kpis_cruzado.py   # KPIs do Python == KPIs do JS
node tools/testar_editor.js            # roundtrip da serialização do editor
node tools/gerar_responsavel_id.js --check # data/plano.js.responsavel_id ainda bate com "resp"
                                        # (roda de novo sem --check se alguém editou "resp" à
                                        # mão sem regenerar)
node tools/testar_dashboard_headless.js # dashboard num Chrome/Chromium real via CDP: clique no
                                        # card de KPI navega pra plano.html já filtrado (mesma
                                        # contagem) — usa o navegador já instalado, nada novo
node tools/testar_minhas_acoes_headless.js # minhas-acoes.html?pessoa=<id>: nós + ações listadas
                                        # batem com a contagem recalculada a partir dos dados
node tools/testar_status_badges_headless.js # taxonomia única de status (js/status.js):
                                        # contagem de badges por página idêntica à de antes
                                        # da migração, nas 6 páginas migradas
node tools/testar_timeline_headless.js # agenda.html, visão Timeline: nº de marcadores =
                                        # nº de encontros nos dados, 1 linha por canal
node tools/testar_mobile_headless.js   # viewport 390×844: menu hambúrguer abre/fecha,
                                        # plano.html/agenda.html viram cards, Matriz
                                        # (demandas.html e a visão Matriz do Corsário)
                                        # mostra o aviso desktop-only
node tools/testar_busca_headless.js    # busca global: "/" foca o campo, um ID de ação
                                        # conhecido navega certo, iniciativa abre o
                                        # Corsário na visão Cards, pessoa e o painel do
                                        # header mobile também batem
node tools/testar_drawer_headless.js   # drawer de Iniciativa/Pessoa: #iniciativa=sebraetec
                                        # e #pessoa=sandra renderizam os blocos esperados,
                                        # fechar (X/Esc/clique fora) limpa o hash, nomes
                                        # clicáveis abrem o painel certo
node tools/testar_matriz_headless.js   # grade dinâmica da Matriz (Camada 3 do golden
                                        # record): colunas saem de meta_inovacao_canais na
                                        # ordem do catálogo, canal novo vira coluna sem
                                        # deploy, gravação é upsert no par (projeto, canal),
                                        # órfãos continuam visíveis e o offline segue
                                        # somente-leitura. Substitui o Supabase por um dublê
                                        # injetado no navegador — não fala com a rede
node tools/testar_matriz_editor_headless.js # a aba "matriz" do editor.html (item 3.3):
                                        # carrega ao vivo (DB_CANAIS/DB_PROJETOS/
                                        # matrizStore), colunas na ordem do catálogo,
                                        # canal novo vira coluna sem deploy, zero <select>
                                        # (somente leitura), e o snapshot exportado bate
                                        # chave a chave com o de demandas.html — offline e
                                        # com o mesmo dublê de Supabase
node tools/testar_catalogos_base.js    # Camada 0: seeds (5/10/5) e os 3 wrappers db-*.js
node tools/testar_projetos_editor_representantes_headless.js # aba "Projetos &
                                        # Representantes" do editor.html (item 4.1):
                                        # vínculo existente vira chip removível, texto
                                        # puro pro placeholder sem pessoa, adicionar
                                        # grava o vínculo E sincroniza representantes[]
                                        # (texto legado), remover desfaz as duas coisas
node tools/testar_urc_editor_headless.js # abas "URC — Liderança"/"URC —
                                        # Responsáveis por canal" do editor.html (item
                                        # 4.2): <select> de pessoa golden pré-selecionado
                                        # pelo pessoa_id, trocar grava pessoa_id + nome
                                        # (texto legado); trocar o <select> de canal
                                        # grava canal_id junto; guardrail do item 4.4
                                        # continua bloqueando responsável de canal = nome
                                        # de liderança, agora pelo <select>; "+ Adicionar
                                        # responsável" grava canal_id+pessoa_id+nome a
                                        # partir dos 2 <select> do topo
```

Dois relatórios leem **produção** (só leitura, anon key de `js/config.js`) — não entram na
suíte acima porque dependem de rede e do estado real do banco:

```bash
node tools/relatorio_cobertura_fk.js      # Camada 2: quanto de FK ficou NULL, por tabela
node tools/conferir_matriz_celulas.js     # Camada 3: matriz nova × matriz antiga, célula a
                                          # célula (--check sai 1 se houver divergência)
```

E um diagnóstico em SQL puro, pra rodar no SQL Editor do Supabase quando a dúvida for
sobre o BANCO e não sobre o site — `tools/sql/2026-08_matriz_celulas_diagnostico.sql`:
17 checagens de schema/RLS/publicação `supabase_realtime` de `meta_inovacao_matriz_celulas`,
cada uma com veredito `OK`/`DIVERGE`/`ATENÇÃO` e o que fazer em cada caso. Só leitura.

Os testes headless que tocam páginas que leem Plano/Agenda (`index.html`, `plano.html`,
`caminho.html`, `minhas-acoes.html`, `agenda.html`) não dependem de rede: cada sessão CDP
injeta `window.CC_FORCAR_FALLBACK = true` antes de navegar (via
`Page.addScriptToEvaluateOnNewDocument`) e várias URLs de teste também carregam
`?semrede=1` — os dois mecanismos fazem `js/db-plano.js`/`js/db-agenda.js` pular a
chamada ao Supabase e usar direto o seed local (`data/plano.js`/`data/agenda.js`),
inclusive em navegações disparadas por clique dentro da própria página (kpi-card, Enter na
busca, drawer). Pra testar manualmente o caminho do Supabase de verdade, abra a página sem
esse parâmetro.

## Estrutura

```
index.html plano.html minhas-acoes.html caminho.html agenda.html demandas.html participantes.html editor.html
css/base.css          identidade visual herdada do painel original
js/calc.js            funções puras de cálculo (testáveis em node)
js/core.js            shell de navegação e utilitários
js/responsaveis.js    lista canônica de responsáveis: texto livre → array de ids (testável em node)
js/status.js           taxonomia única de status: window.CC_STATUS (testável em node)
js/calendario.js      componente de calendário mensal (agenda.html, visão Calendário)
js/timeline.js         componente de timeline por canal (agenda.html, visão Timeline)
js/busca.js             busca global client-side: window.BUSCA (índice/filtro testáveis em node)
js/drawer.js             drawer lateral de Iniciativa/Pessoa: window.DRAWER
js/supabase.js           client Supabase centralizado + header x-cc-token: window.CC_SUPABASE
js/db-plano.js           Plano de ação: window.DB_PLANO — lê/grava meta_inovacao_plano_acoes,
                          cai pra data/plano.js (seed) se o Supabase falhar
js/db-agenda.js          Agenda: window.DB_AGENDA — lê/grava meta_inovacao_agenda_encontros,
                          cai pra data/agenda.js (seed) se o Supabase falhar
js/editor_atual.js       identificação de quem edita: window.EDITOR_ATUAL — rodapé
                          "Editando como… trocar" nas 4 telas de escrita (editor.html,
                          demandas.html, plano-acao.html, plano.html)
js/editor_io.js       serialização canônica dos dados (testável em node)
data/*.js             config, plano, nos, canais, agenda, iniciativas, matriz, pessoas
                       (+ pessoas.responsaveis: lista canônica de responsáveis), changelog
                       — plano e agenda aqui são só seed/fallback (dado ao vivo mora no
                       Supabase, ver "Como os dados funcionam" acima)
tools/                geração de dados a partir do xlsx + os testes
tools/sql/             scripts SQL pra rodar manualmente no Supabase (RLS, tabelas etc.)
tools/vendor/          único código de terceiro do repositório (encoder de QR, ver
                        tools/vendor/README.md) — não é carregado por nenhuma página do site
qrcodes/               um QR code .png por canal (item 7 do plano do canvas das oficinas,
                        docs/PLANO_CANVA_OFICINAS.md), gerado por
                        tools/gerar_qrcodes_canais.js — pronto pra colar no último slide de
                        cada apresentação, ver qrcodes/README.md
docs/                 PLANO_EXECUCAO.md, BUILD_STATUS.md, PENDENCIAS.md (se houver)
```

## Regras editoriais embutidas

- Encontros nascem **a agendar** enquanto o Nó 1 (devolutiva URC) não fecha.
- Núcleos das 27 iniciativas ficam em branco até definição oficial — o painel não inventa dado.
- A matriz de demandas nasce limpa; os estados avançam só com fato registrado.
