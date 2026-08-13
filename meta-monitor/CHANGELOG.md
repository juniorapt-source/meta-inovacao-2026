# Changelog

## v0.9.0 — 2026-08-13
Prompt 4 do plano de melhorias (item 2.2): lista canônica de responsáveis (BACKLOG #004) e
a página "Minhas ações" (BACKLOG #003) — a visão transversal "o que eu tenho que fazer?".

- **Lista canônica de responsáveis** — `data/pessoas.js` ganha `window.DB.responsaveis`: 31
  entradas (id estável + nome + grupo de agrupamento) extraídas varrendo `resp` de
  `data/plano.js`, `guardiao` de `data/nos.js` e `representantes` de `data/projetos.js`.
  `js/responsaveis.js` novo (funções puras, testável em node como `js/calc.js`) resolve
  texto livre — "JR. e Pova", "Comitê e Sandra" — pra array de ids, separando por " e ",
  "/", "+" e ",". `data/plano.js` ganha `responsavel_id` nas 47 ações (campo `resp`
  original intocado), gerado por `tools/gerar_responsavel_id.js` — idempotente, com modo
  `--check` que falha se `resp` for editado sem regenerar o campo derivado (novo passo na
  suíte de testes). Único valor livre sem mapeamento: `"Núcleo de Startups"` em
  `data/projetos.js` — placeholder de indicação pendente, não pessoa, deixado de fora de
  propósito (mesmo tratamento que `index.html` já dava a ele).
  - `tools/validar_dados.py` tinha um guardrail genérico contra qualquer campo de autoria
    fora de `data/projetos.js` (histórico real: "Criss"/"Cris" divergindo entre datasets).
    `responsavel_id` entra como exceção pontual e comentada no próprio arquivo — é a versão
    estruturada de um campo (`resp`) que já existia antes do guardrail, não autoria nova; a
    consistência entre os dois fica garantida pelo `--check` acima, fechando a mesma lacuna
    de drift que o guardrail existe pra evitar.
  - `plano-acao.html`: campo livre "Responsável" vira `<select>` alimentado pela lista
    canônica (agrupado por Coordenação/Coletivo/Núcleos/Projetos). Atividade gravada antes
    desta mudança com texto que não bate com nenhum id canônico ganha uma opção "⚠ legado"
    marcada visualmente (`.pa-legado`), sem apagar nada — some sozinha na próxima vez que
    alguém escolher uma pessoa de verdade pra aquela linha. Hoje as 22 atividades reais no
    Supabase têm `responsavel` vazio — a via legada existe pronta pro dia em que não tiver.
- **`minhas-acoes.html`** (nova, menu Execução logo após "Plano de ação") — seletor "Ver
  como" (lista canônica), persistido em `localStorage` (`cc_ver_como`) e com link direto
  `?pessoa=<id>` compartilhável (a página reflete a pessoa atual na URL via
  `history.replaceState`, sem empilhar histórico). Três seções por pessoa: nós do caminho
  crítico onde é guardiã (`data/nos.js`, casado por `js/responsaveis.js` — mesmo
  vocabulário de estado de `caminho.html`), ações do plano onde `responsavel_id` inclui a
  pessoa (ordenadas: atrasadas → prazo crescente → janelas por último, mesmo critério de
  "janela" do resto do site), atividades por iniciativa do Supabase onde `responsavel` é a
  pessoa. Cabeçalho com o resumo "N itens sob sua guarda · X atrasados · Y vencem em 7
  dias" (`.frase-contexto`, classe nova em `css/base.css` — destaque discreto, reaproveitada
  pelo item 2.3 do plano de melhorias no Dashboard).
  - Seção de "Próximos encontros" (pedida no prompt original) foi omitida de propósito:
    `data/agenda.js` não tem nenhum campo ligando um encontro a uma pessoa — sem esse
    vínculo nos dados, inventar um seria inventar dado; comentário no HTML documenta o
    porquê e deixa o lugar pronto pro dia em que esse campo existir.
- `tools/testar_minhas_acoes_headless.js` — 8º teste do repo: abre
  `minhas-acoes.html?pessoa=sandra` num Chrome real via CDP e confere que a contagem de nós
  (3) e de ações (14) listadas bate com a recalculada em Node a partir dos mesmos dados
  (não hardcoded às cegas), e que o resumo do cabeçalho cita os números certos.
- Validado com Chrome headless real (contra o Supabase de produção): select de responsável
  em `plano-acao.html` com as 31 opções agrupadas, `minhas-acoes.html` com nós/ações/
  atividades corretas pra "sandra" e resumo batendo, `node tools/gerar_responsavel_id.js
  --check` OK, suíte completa (8 testes) passando.

## v0.8.1 — 2026-08-13
- `corsario.html`: paleta de status (ok/ajuste em andamento/a iniciar/em entendimento/não se aplica) trocada dos hex vivos copiados direto da planilha-fonte (`#E8F5E9`/`#2E7D32` etc.) pelos tokens "lavados" do resto do site (`--ok`/`--prog`/`--warn`/`--ink-2`/`--ink-3`) — mesma lógica já aplicada às cores de núcleo desta página (v0.6.2). Vale nos três lugares que reaproveitam as mesmas classes (`.crs-st-*`/`.crs-crit-na`/`.crs-mz-na`): legenda, células da matriz e chips do detalhe expandido dos cards — conferido nos três via Chrome headless contra o Supabase de produção.
- Achado ao trocar: `var(--warn)`/`var(--warn-w)` (usado aqui em "a iniciar") mede 3.6:1 de contraste — abaixo de WCAG AA (4.5:1). É o mesmo par de tokens já usado em `.st-janela`, `.cel-oficina` e `.aviso` em várias páginas; mantido por consistência com o padrão já estabelecido no restante do site, mas fica registrado como possível item futuro do plano de melhorias (ajustar `--warn`/`--warn-w` em `css/base.css` teria efeito em todas essas páginas de uma vez, não só aqui).

## v0.8.0 — 2026-08-13
Prompt 2 do plano de melhorias: menu em domínios, KPIs do Dashboard viram drill-down real pra `plano.html`, e auditoria + legenda de status.

- **Menu em domínios** (`js/core.js`) — sidebar agrupado em 5 seções discretas (títulos em caixa alta, sem link): Visão (Dashboard · Caminho crítico), Execução (Plano de ação · Agenda dos ciclos · Matriz de demandas · Atividades por iniciativa), Pessoas (Participantes · Projetos), Jornada (O Caminho para o Corsário), Admin (Modo edição). `PAGINAS` virou `GRUPOS` (array de `{titulo, paginas}}`); URLs, rótulos e a ordem *dentro* de cada grupo continuam exatamente os mesmos — só a forma de agrupar mudou. Títulos de grupo somem no menu mobile (`css/base.css`, `@media max-width:960px`) pra não quebrar o fluxo horizontal de chips.
- **KPIs do Dashboard viram links de verdade** (`index.html` → `plano.html`) — os 6 cards do topo (Ações no plano, Concluídas, Em andamento, Atrasadas, Vencem em 7 dias, Em janela) e cada linha de "Atrasadas agora"/"Próximos 7 dias" agora são `<a href>` reais, não mais botões que expandiam uma lista inline (decisão da v0.3.6, **removida** — `plano.html` já tem filtro completo + ordenação + busca, a lista inline ficou redundante). `plano.html` lê `?status=` (concluida/em_andamento/atrasada/vence7/janela) e `?q=` no carregamento; dois filtros novos no `<select>` de status (`__vence7`, `__janela`) que não existiam antes. Linhas de "Atrasadas agora"/"Próximos 7 dias" levam a `plano.html?q=ID#ID` — busca preenchida (pedido) + auto-abre o detalhe da linha (comportamento que já existia via `#ID`, preservado). `tools/testar_dashboard_headless.js` (F7) **reescrito**: testava a expansão inline (agora removida); passa a testar que o clique navega de verdade e a contagem bate entre o card e `plano.html` filtrado.
- **Auditoria de status + legenda** — auditoria completa reportada na entrega (rótulo · cor · páginas). Achado um bug real: `agenda.html` colorria "agendado" de âmbar na visão Lista e de azul na visão Calendário (`js/calendario.js`) — a mesma página, o mesmo status, duas cores diferentes. Corrigido (`classeEncontro()`, fonte única pras duas visões). Núcleos (caminho.html) e encontros (agenda.html) reaproveitam as cores `st-*` do site com um vocabulário PRÓPRIO, diferente do "status de atividade" de `plano.html`/`index.html` — em vez de recolorir (quebraria a consistência já estabelecida com o trilho do Dashboard e o calendário), as duas páginas ganharam uma legenda compacta no topo (`.legenda-vocab`, nova em `css/base.css`) explicando o vocabulário local; a de `caminho.html` é gerada direto do mapa `NOME`/`CLS` já existente no script (fonte única, sem duplicar rótulo).
- Validado com Chrome headless real: ordem/agrupamento do menu, hrefs dos 6 KPIs, clique de verdade navegando e a contagem batendo, as 5 combinações de `?status=` + `?q=` carregando direto, e as duas legendas renderizando com o texto/cor certos.

## v0.7.1 — 2026-08-12
Bloco 1 do plano de melhorias: 4 ajustes de baixa complexidade + gate de senha preparado e desativado.

- **Privacidade** — rodapé do sidebar (`css/base.css`, `.nav .rodape::after`) trocado de "Confidencial · Documento de bordo" pra "Uso interno · Unidade de Inovação"; como é um único `::after` compartilhado, a troca já vale nas 10 páginas do painel de uma vez. `robots.txt` novo na raiz do site (`meta-monitor/robots.txt`, é o que vira `/robots.txt` no domínio publicado) com `Disallow: /`. Nomes de pessoas em Participantes/URC não foram tocados (decisão adiada, como pedido).
- **Sticky column + header nas tabelas largas** — conferido em Chrome headless real (scroll vertical e horizontal, célula do canto, cores de fundo computadas): tanto a Matriz de Demandas (`.matriz-wrap`/`.matriz` em `css/base.css`) quanto a visão Matriz do Corsário (`.crs-matriz-wrap` em `corsario.html`) já tinham `position:sticky` correto na primeira coluna e no cabeçalho, com fundo sólido e z-index em camadas (corpo=1/2, header=2/3) de trabalho anterior nesta mesma sessão — nada precisou mudar, só validar.
- **Contraste WCAG AA** — `--ink-2` (.55→.72) e `--ink-3` (.35→.68) em `css/base.css`: as duas falhavam feio contra os fundos reais de tabela (2.0–3.5:1 medido pela fórmula de luminância relativa do WCAG contra `--surface`/`--ceu`/`--neutro-w`), inclusive o cabeçalho `<th>` de toda tabela do site e o traço "—" de `.cel-vazia` na Matriz de Demandas. Os novos valores seguram 4.7–5.8:1 nos três fundos. `.matriz-wrap` ganhou `background:var(--surface)` explícito (não tinha nenhum — a textura do body vazava nos "gaps" das células sem cor própria); os wrappers de tabela de `plano.html` e `agenda.html` já eram `.card` (fundo sólido de fábrica), então não precisaram de mudança. Textura preservada no resto de cada página e intacta no Dashboard.
- **Rótulo de menu** — "Plano de Ação x Projeto" → "Atividades por iniciativa" no sidebar (`js/core.js`) e no `<title>`/`<h1>` de `plano-acao.html` — resolve BACKLOG #005 parcialmente (nome do arquivo e URL continuam `plano-acao.html`, sem mudar link nenhum). Isso também apaga a colisão de nome com "Plano de ação" (`plano.html`) que o changelog da v0.4.0 já tinha registrado como intencional.
- **Gate de senha (construído, desativado)** — `data/config.js` ganha `exigirSenha:false`; `js/gate.js` novo, carregado logo depois de `data/config.js` nas 10 páginas do painel (antes do `js/core.js`/render de cada página). Com a flag `false` (default) o arquivo não faz nada. Quando `true`, cobre a tela com um overlay (mesma identidade visual — fundo bege, tipografia do site, título "Carta de Corso") até `sessionStorage.cc_auth` existir; senha errada mostra "Senha incorreta." sem reload; senha certa seta o sessionStorage e some com o overlay. Comparação é sempre por SHA-256 hex (`crypto.subtle.digest`) contra `HASH_SENHA`, hoje o placeholder `"SUBSTITUIR_PELO_HASH"` — a senha em texto claro não existe em nenhum arquivo do repo. `tools/gerar_hash_senha.html` novo (roda local, offline, gera o hash SHA-256 de uma senha digitada) pra ativar sem expor a senha no chat/repo. Comentário no topo de `gate.js` deixa claro que é proteção client-side leve, não autenticação de verdade (isso é o item 2.1 do plano de melhorias, ainda não feito).
- Validado ponta a ponta em Chrome headless: overlay aparece/some corretamente, senha errada não recarrega a página, `tools/gerar_hash_senha.html` gera exatamente o hash que `gate.js` valida, e as 10 páginas continuam sem overlay (flag desligada) e com o rodapé novo.
- `BACKLOG.md` criado (não existia antes) — registro de baixa do item #005 e do estado do item 2.1 (proteção de escrita no Supabase, ainda não iniciado). É o registro do que já foi feito; o plano completo (blocos 1–3, prompts P2–P13) fica em `prompts_code_melhorias_carta_corso.md`, na raiz do repositório git, um nível acima de `meta-monitor/`.

## v0.7.0 — 2026-08-12
Lote de 16 ajustes pedidos após revisão do painel, cobrindo 9 páginas + identidade tipográfica global. Layout, tema e responsividade preservados; nenhuma dependência nova além da webfont do item 16.

- **Dashboard** (`index.html`): removido "— distribuir com Sandra e Pova" do hint do Radar de carga; removida a seção "Atualizações do ambiente" (título + card + o `<script src="data/changelog.js">` que só ela usava — `data/changelog.js` continua existindo pro `editor.html`).
- **Plano de ação** (`plano.html`): cabeçalhos da tabela viram clicáveis — ordenação asc → desc → sem ordenação (ícone ▲/▼, `aria-sort`, teclado) nas 6 colunas, sem tocar nos filtros já existentes (a ordenação entra como um `sort()` sobre a lista já filtrada).
- **Caminho crítico** (`caminho.html`): removida a seção "Onde mora a folga" (título + card); ajustada a frase de abertura da página, que citava essa seção.
- **Agenda dos ciclos** (`agenda.html`): a lista de Encontros virou um card por ciclo (título próprio, coluna "Ciclo" removida por ficar redundante); coluna de data ganhou o dia da semana abreviado pt-BR (`17/08 (seg)`).
- **Matriz de demandas** (`demandas.html`): dois status novos no seletor — `Oficina confirmada` (verde, entre "previsto" e "oficina feita") e `Não se aplica o uso` (cinza itálico, junto de "justificado"); cores novas em `css/base.css` (`.cel-oficina_confirmada`, `.cel-nao_aplica`).
- **Participantes** (`participantes.html`): card do Comitê passa a ser o primeiro (URC continua logo depois, como já era); todo integrante com núcleo identificável (casamento por nome exato contra `data/pessoas.js`, grupo "Núcleos" — sem match não escreve nada) ganha " — núcleo" ao lado do nome, inclusive nos responsáveis por canal da URC; removidos "— 3 de 8 canais com indicação" e "11 responsáveis operacionais indicados ao todo".
- **Projetos** (`projetos.html`): métrica "Pessoas envolvidas: N" por núcleo (contagem distinct por nome sobre todas as iniciativas do núcleo, mesmo critério de "pessoa física" do dashboard — placeholder "Núcleo de Startups" não conta).
- **O Caminho para o Corsário** (`corsario.html`):
  - Subtítulo sem o `max-width:74ch` herdado de `.pagina-sub` (override só nesta página) — ocupa a largura toda do container.
  - Filtro por patente (chips, "Todas as patentes" + as 5 faixas) — mesma fonte única (`listaFiltrada()`) dos filtros de núcleo/busca/ordenação, então vale nas duas visões de graça.
  - **Matriz vira a visão default** (Cards vira a alternativa) — só troca o fallback de `aplicarHash()` quando não há hash; mecanismo de toggle/hash idêntico.
  - Cabeçalhos da matriz batendo com `o_caminho_para_o_corsario_v3.xlsx` (aba "Jornada", linha 2) — texto por extenso, com as ordens de "Núcleo/Iniciativa/…/% de adequação/Patente"; sem `text-transform:uppercase` nos headers (o `th{}` genérico de `css/base.css` já vem uppercase — precisou de `text-transform:none` explícito, não bastava só remover a declaração local). A patente no CORPO da matriz continua em caixa alta como badge (`.crs-mz-patente-valor`) — só o header mudou. Colunas de critério alargadas (90px → 128px) pra caber o texto completo com quebra de linha.
- **Global — item 16**: fim das fontes serifadas no painel. `css/base.css` ganha `--font-sans: 'Open Sans','Lato',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif`; `body`, `h1..h6`, `button/input/select/textarea/table` passam a usar essa stack (os últimos quatro não herdam a fonte do `body` por padrão no UA stylesheet dos navegadores — precisou do reset explícito). As 10 páginas do painel trocam `Spectral` por `Open+Sans`/`Lato` no `<link>` do Google Fonts (mantendo DM Sans e IBM Plex Mono, que já eram sem serifa). Todo `font-family:'Spectral'`/`'Spectral',Georgia,serif` do repositório (`css/base.css` + `index.html`, `agenda.html`, `corsario.html`, `demandas.html`, `projetos.html`) foi trocado por `var(--font-sans)`. `apresentacao_canais.html` (deck da URC, propositalmente fora do tema desde a v0.5.0) já usa Inter/Archivo — conferido, nenhuma serifa lá, nada a mudar. Tamanhos, pesos e line-heights preservados — só a família mudou.
- `tools/validar_site.py`: ids obrigatórios de `index.html` (perdeu `log`) e `caminho.html` (perdeu `folga`) atualizados pra bater com as seções removidas.
- Validado com Chrome headless via CDP contra o Supabase de produção: ordenação da tabela do Plano, os 2 status novos na Matriz de demandas (via "Ativar edição"), núcleo inline nos Participantes, métrica de Projetos, filtro de patente/visão-default/headers da Matriz do Corsário, e ausência de `Spectral`/`Georgia`/`Times`/`Cambria` computada em `body` e nos headings de todas as páginas tocadas.

## v0.6.2 — 2026-08-12
- `corsario.html` (visão Matriz): coluna **"Patente"** renomeada pra **"Patente Atual"** e movida pra logo depois de Iniciativa (antes de "Base no Foco"), em vez de ficar isolada no fim da tabela — não é mais sticky, rola junto com os critérios como as demais.
- Cores de núcleo trocadas dos tons vivos da planilha-fonte (`#005EB8`/`#00796B`/`#6A4FA3`/`#E65100`, que continuam só nas cores de *status* de critério, pra bater com a origem) pelos tokens já lavados de `css/base.css` — `var(--prog)` azul, `var(--ok)` verde, `var(--sla)` roxo/malva, `var(--cc)` laranja/terracota — mesma lógica de matiz, mas na tinta de papel antigo do resto do site. Vale pra célula sólida da matriz, pro chip do card e pro chip de filtro por igual (todos usam `corNucleo()`, fonte única).
- Cabeçalhos de coluna da matriz alinhados à tipografia padrão de `<th>` do site (`css/base.css`): maiúsculas, `letter-spacing:.05em`, cor `var(--grafite)` em vez de `var(--tinta)` — antes destoava do resto das tabelas do painel (`plano.html`, `demandas.html`, `projetos.html`).

## v0.6.1 — 2026-08-12
- `corsario.html`: segunda visualização, **Matriz** (iniciativas × critérios), no espírito da planilha de origem — alternador segmentado "Cards | Matriz" junto aos controles existentes, padrão Cards. Estado espelhado em `location.hash` (`#cards`/`#matriz`, sem `localStorage`) — link direto pra `#matriz` já abre nela, e o alternador some/reaparece corretamente no botão voltar/avançar do navegador (`hashchange`).
  - Fonte única: mesmo `TODAS`/`calcular()` dos cards — a filtragem/ordenação foi extraída pra uma função só (`listaFiltrada()`) que os dois renders consomem; filtro por núcleo, busca e ordenação valem igual pras duas visões, sem lógica duplicada.
  - Tabela semântica com cabeçalho fixo e as colunas Núcleo/Iniciativa fixas à esquerda (`position:sticky`) dentro de um contêiner com `overflow:auto`/`max-height:70vh` — rolagem horizontal esperada nos 19 critérios + % + patente. Célula de núcleo com fundo sólido na cor do núcleo (mesma paleta dos cards) e texto branco; células de status reaproveitam as mesmas classes de cor dos cards (`crs-st-*`), com texto abreviado (`ok`/`andamento`/`a iniciar`/`entend.`/`n.a.`) e `title` com o rótulo completo do critério + status + observação. Cabeçalhos de critério com rótulo curto por `chave` (mapa `ROTULOS_CURTOS`, com fallback pro `rotulo` truncado se vier critério novo sem mapeamento) e `title` com o rótulo completo.
  - Validado contra o Supabase de produção via Chrome headless (CDP): ALI Academy 23,3% Grumete · Catalisa Gov 53,7% Timoneiro · Sebraetec 49,5% Marujo · adequação média da frota 34,8% — batendo com a conferência visual pedida contra a planilha-fonte.
  - `tools/validar_site.py`: ids novos (`crs-segmento`, `crs-matriz-wrap`, `crs-matriz`) na lista obrigatória de `corsario.html`. Nenhuma outra página alterada; nenhuma mudança no Supabase (mesmas tabelas, policies e GRANTs de v0.6.0).

## v0.6.0 — 2026-08-12
- Nova aba **O Caminho para o Corsário** (`corsario.html`) — adequação de cada iniciativa ao ecossistema oficial (Foco, catálogo, canais da URC), lida direto do Supabase (tabelas `corsario_criterios` e `corsario_status`, 19 critérios × 28 iniciativas), somente leitura via REST puro (`fetch`, sem SDK) — reaproveita `window.APP_CONFIG` (`js/config.js`) do mesmo projeto Supabase já usado por `demandas.html`/`plano-acao.html`.
  - Régua de adequação: `não se aplica` sai do cálculo — cada iniciativa é medida só pelos critérios que fazem sentido pra ela, com pesos `ok`=100%, `ajuste em andamento`=70%, `a iniciar`=40%, `em entendimento`=20%. Patente (Grumete/Marujo/Timoneiro/Capitão/Corsário) por faixa de %. Validado offline (`node`) contra o caso de aceite: ALI Ecossistema com 8 critérios n.a. → régua de 11 aplicáveis → ~25,45% → Marujo; com os mesmos 8 n.a. e os 11 restantes em ok → 100% → Corsário.
  - Painel da frota (adequação média, contagem por patente, última atualização), filtro por núcleo em chips coloridos, busca por nome, ordenação (%, nome, núcleo), cards expansíveis com os 19 critérios agrupados por `grupo` e ordenados por `ordem`, e legenda fixa no fim da aba (patentes + status/pesos + a regra de ouro por extenso). Erro de rede vira mensagem amigável com botão "Tentar de novo", sem derrubar as outras abas.
  - `js/core.js`: item novo no menu, entre "Plano de Ação x Projeto" e "Modo edição".
  - **⚠️ Pendência operacional:** validado contra o Supabase real — as tabelas existem e estão populadas, mas o role `anon` ainda não tem `GRANT SELECT` (mesmo padrão já visto em `meta_inovacao_matriz_demandas` na v0.3.1 e `plano_acao_atividades` na v0.4.0). Rodar manualmente no SQL Editor do Supabase: `GRANT SELECT ON public.corsario_criterios TO anon; GRANT SELECT ON public.corsario_status TO anon;` (e checar se há política de RLS de `SELECT` liberando as duas tabelas pro role `anon`). Até lá a aba mostra o erro amigável com "Tentar de novo" em vez de dados — sem quebrar nada nas outras 9 abas (confirmado via Chrome headless/CDP).

## v0.5.1 — 2026-08-12
- `js/core.js`: a marca no topo do menu lateral (`montarShell`) lia o texto fixo "Meta Inovação 2026" em vez de `DB.config.projeto` — inconsistente com o nome já usado em todos os `<title>` das páginas e no próprio `data/config.js` ("Carta de Corso") desde a v0.2.0. Passa a renderizar `cfg.projeto`, com o mesmo fallback "Carta de Corso" que o resto da função já usa. O subtítulo (`cfg.subtitulo` — "Meta Inovação 2026 · Unidade de Inovação · Sebrae Nacional") continua igual, sem perder a referência ao programa.

## v0.5.0 — 2026-08-12
- Nova identidade visual **"Carta Náutica"** aplicada a todo o painel — só tema, sem mudar estrutura, conteúdo ou funcionalidades. `css/base.css` reescrito: paleta papel-de-mapa-antigo (`--bg`/`--surface` marfim, `--ink` tinta escura, acento único vermelho-lacre `--accent`), tipografia Spectral (títulos e corpo) + DM Sans (nav/labels/UI, uppercase, letter-spacing largo) + IBM Plex Mono (datas/IDs, sem mudança de fonte), bordas sem radius em todo lugar, e três texturas de fundo: grade náutica 90×90 (CSS puro), rosa dos ventos e a caveira/ossos cruzados (easter egg a 3,5% de opacidade) — as duas últimas via SVG embutido em `::before`/`::after` de `.conteudo`, sem precisar de nó novo no HTML. Nomes de variável antigos (`--tinta`, `--azul`, `--linha`...) viraram alias dos tokens novos, então todo `var(--x)` já espalhado pelas páginas herdou a paleta nova sem precisar caçar cada uso.
- KPIs (dashboard e demais páginas) trocam de cards separados por um container único com divisores internos — mais fiel à referência "carta náutica" que o grid de cards com sombra do tema antigo.
- Cores de status (concluído/andamento/atrasada/janela/caminho-crítico/SLA) preservadas como famílias distintas — a diferenciação funcional não muda — mas lavadas para tons de tinta compatíveis com o papel, coerentes com o acento único.
- `index.html`, `agenda.html`, `demandas.html`, `projetos.html`, `editor.html`, `plano-acao.html`: blocos `<style>` locais (e um `style=""` inline em `editor.html`) também migrados — Archivo→Spectral, Inter→DM Sans, hex antigos→tokens novos. `plano-acao.html` entrou porque já está no menu (v0.4.1); teria ficado com fonte não carregada se ficasse de fora.
- `apresentacao_canais.html` deliberadamente fora do escopo: é um documento à parte (deck dos canais URC), com identidade cromática própria por canal — aplicar o tema do painel ali quebraria o propósito do arquivo.
- Varredura (`grep`) no repositório confirma zero referência remanescente a `Archivo`/`Inter`/hex antigos fora do deck.

## v0.4.2 — 2026-08-12
- **Correção de versão**: o pedido original citava "v0.3.7" (a partir do commit 672011e/v0.3.6), mas o painel já tinha avançado pra v0.4.1 nesse meio-tempo (Plano de Ação + soft delete). Publicando como v0.4.2 — próximo patch real — pra não regredir o número de versão.
- `index.html`: cards "Em andamento" e "Atrasadas" sinalizam sobreposição — cada ação que aparece nas duas listas (hoje CAN-02 e CAN-06) ganha o sufixo discreto "· também em andamento" / "· também atrasada" no título, sem badge nem cor nova (reusa `var(--grafite)`). Contagem dos cards não muda. A checagem de sobreposição usa a mesma `getAcoesPorCategoria` já existente, uma vez por render de lista — não reimplementa a regra em outro lugar.
- `tools/testar_dashboard_headless.js`: **6º teste do repo** — `render_reflete_mutacao_sem_refresh`, trava a decisão da v0.3.6 (clique nos cards de KPI re-renderiza a lista na hora, não só no carregamento da página). Sobe um Chrome/Chromium real headless via CDP (Chrome DevTools Protocol) cru, usando só `WebSocket`/`fetch`/`child_process` nativos do Node ≥22 — **sem instalar Playwright nem qualquer dependência nova** (os 5 testes existentes não usam navegador; verifiquei antes de escrever este — não havia nenhuma referência a Playwright no repo, ao contrário do que o pedido original presumia). Testado que o guardrail falha de verdade (reintroduzi o bug antigo, confirmei exit 1, reverti).
- README.md atualizado: 6 testes documentados, `tools/` na árvore de estrutura.

## v0.4.1 — 2026-08-12
- Menu: item de `plano-acao.html` renomeado pra "Plano de Ação x Projeto" (`js/core.js`) — só o rótulo do menu; título da página, `<h1>` e URL continuam iguais. Convive com o "Plano de ação" antigo (plano.html) sem quebrar layout da nav.
- `plano-acao.html`: remoção de atividade vira **soft delete** — `UPDATE deleted_at/updated_at` em vez de `DELETE` físico. A leitura passa a filtrar `.is("deleted_at", null)`. A coluna já tinha sido adicionada na tabela `plano_acao_atividades` no Supabase (com índice em `iniciativa, deleted_at`); nenhum DDL rodado por aqui.
- Texto do `confirm()` de remoção ajustado pra "Remover esta atividade?" — o antigo "...não pode ser desfeita" deixou de ser verdade com soft delete.
- Validado contra o Supabase real de produção (o GRANT da v0.4.0 já tinha sido aplicado manualmente): criar → confirmar remoção some da UI → linha continua na tabela via REST com `deleted_at` preenchido → reload não traz ela de volta → cancelar o confirm não muda nada.

## v0.4.0 — 2026-08-12
- Nova aba **Plano de Ação** (`plano-acao.html`) — CRUD de atividades por iniciativa (descrição, responsável, status), com navegação lateral pelas 27 iniciativas de `data/projetos.js` (mesma ordem/nomes, sem hardcode). Persistência no Supabase, tabela `plano_acao_atividades` (id, iniciativa, descricao, responsavel, status, ordem, created_at, updated_at). Sem login — igual ao resto do painel.
  - Descrição/responsável salvam com debounce de 600ms; status, criação e remoção salvam imediato. Cores sutis por status (cinza/azul/vermelho suave).
  - `supabase-js` carregado via `import()` dinâmico do build ESM do CDN, dentro de um `<script>` clássico (não `type="module"`) — mantém o arquivo testável por `node --check` junto com o resto do site, sem bundler.
  - **Bump de minor, não patch**: é uma funcionalidade nova (página + integração de backend), não uma correção.
  - Nome da aba mantém colisão proposital com a aba "Plano de ação" já existente (o plano de 47 ações do caminho crítico) — são dois conceitos diferentes; decisão confirmada com o usuário antes de implementar.
  - **⚠️ Pendência operacional:** a tabela `plano_acao_atividades` já existe no Supabase, mas a role `anon` não tinha GRANT (confirmado em produção: `permission denied for table`, mesmo problema já visto com `meta_inovacao_matriz_demandas` na v0.3.1). `supabase/plano_acao_atividades.sql` corrige isso (GRANT + RLS + trigger de `updated_at`) — **precisa ser rodado manualmente no SQL Editor do Supabase** antes da aba funcionar; até lá ela mostra um erro amigável com botão "Tentar de novo", não trava a página.

## v0.3.6 — 2026-08-12
- `index.html`: os 5 cards de KPI com prazo (Concluídas, Em andamento, Atrasadas, Vencem em 7 dias, Em janela) viram clicáveis — clique no número expande o card e revela a lista das ações, no mesmo espírito do card de portfólio. Um só aberto por vez, chevron ▼/▲, teclado (Enter/Space), `role="button"`/`tabindex="0"`, transição ~200ms com altura medida via JS (sem max-height chumbado). Card "47 ações no plano" e os dois cards de portfólio/gestores continuam como estavam.
- Nova função `getAcoesPorCategoria(categoria)` (inline em `index.html`, arquivo continua autocontido): relê `window.DB.plano` a cada chamada — sem cache — e replica exatamente os critérios de `CALC.kpis`, preservando duas particularidades já existentes em vez de "corrigi-las" por conta própria: "Em andamento" e "Atrasada" se sobrepõem (uma ação pode estar nas duas listas — hoje CAN-02 e CAN-06), e "Em janela" exige `!prazo_iso && prazo` (não só ausência de `prazo_iso`).
- A lista de cada card é regerada a partir de `getAcoesPorCategoria` no momento do clique, não só no carregamento da página — necessário pra refletir uma edição feita em outro lugar sem precisar de refresh (bug pego e corrigido durante o teste headless deste ciclo: o clique inicialmente só alternava a visibilidade do HTML montado no load).

## v0.3.5 — 2026-08-12
- Nomenclatura de núcleos unificada em Title Case (preposições/artigos minúsculos) em todo o painel: "Inovação para Competitividade", "Inovação Territorial", "Startups", "Tecnologias Portadoras de Futuro". `data/projetos.js` (27 registros) e `data/pessoas.js` corrigidos — este último também tinha "Inovação para Escala e Startups" divergente pra Paulo Puppin Zandonadi, agora "Startups".
- "Gestão do Conhecimento e Processos" formalizado como 5º núcleo válido no whitelist (`editor.html` e `tools/validar_dados.py`) — sem projeto de portfólio hoje, mas usado em `data/pessoas.js` (Lara, Sandra Paraíso).
- `index.html`: mini-breakdown do card "Gestores de projetos na UI" só lista núcleo com ≥1 projeto — Gestão do Conhecimento e Processos não aparece com "0 projetos".
- `tools/validar_dados.py`: whitelist de núcleos passa de 4 para 5 valores; novo guardrail cruza `data/pessoas.js.nucleo` contra a mesma lista (evita a divergência silenciosa que causou este ciclo).

## v0.3.4 — 2026-08-12
- `participantes.html`: card da URC reescrito — o rótulo antigo "destinatário/destinatária da proposta" (Enio/Milva hardcoded em `data/pessoas.js`, grupo "URC") sai; entra `data/urc.js`, com liderança transversal (Enio, Milva, Iuri Barbosa de Andrade) e responsáveis por canal (CNR, Portal e Loja indicados; 5 canais aguardando indicação — badge âmbar). Email nunca é renderizado na página pública.
- `editor.html`: dois conjuntos novos, "URC — Liderança" e "URC — Responsáveis por canal" (o segundo edita uma lista achatada com dropdown de canal fixo e agrupa de volta ao salvar); ambos regravam `data/urc.js` inteiro, sem perder o bloco não selecionado.
- `js/editor_io.js` e `tools/validar_dados.py`: loader generalizado para arquivos com mais de uma atribuição `window.DB.x = ...;` no mesmo arquivo (balanceando colchetes/chaves em vez de cortar no primeiro `;`, que pode estar dentro de uma string) — necessário porque `data/urc.js` declara `urc_lideranca` e `urc_canais` no mesmo arquivo. `tools/testar_editor.js` (F6) passa a testar todos os blocos de cada arquivo, não só o último.
- `tools/validar_dados.py`: valida os 8 canais da URC na ordem canônica, estrutura de liderança/responsáveis, e barra (exit 1) qualquer responsável de canal que também esteja na liderança. O guardrail anti-duplicação do ciclo anterior (v0.3.3) foi ajustado para não confundir o campo `responsaveis` de `urc_canais` — domínio diferente de `data/projetos.js` — com duplicação de autoria de iniciativa.
- `.chip.pessoa` centralizado em `css/base.css` (antes só existia no `<style>` local de `projetos.html`; agora reusado também pelo card da URC).

## v0.3.3 — 2026-08-12
- `index.html`: card "Gestores de projetos na UI" — 18 pessoas físicas distintas (exclui o placeholder "Núcleo de Startups" da contagem), linha de apoio e nota de rodapé dinâmicas; nota só aparece se houver iniciativa com representante pendente.
- Débito técnico: `data/projetos.js` vira fonte canônica de autoria por iniciativa. Removidos os campos `representante` (que tinha divergido — "Criss" vs "Cris", nomes concatenados em vez de array) e `nucleo` (sempre vazio) de `data/iniciativas.js`; nenhuma página chegava a renderizar esses campos, então não houve mudança visual a migrar.
- `tools/validar_dados.py`: dois guardrails novos — (1) toda iniciativa citada em `iniciativas.js`/`matriz.js` precisa existir em `data/projetos.js`; (2) nenhum `data/*.js` além de `projetos.js` pode ter campo cujo nome case com `/respons|dono|gestor|representante|owner/i`. Falha o build se a duplicação voltar.
- `tools/validar_site.py`: `projetos.html` incluído na varredura de referências quebradas e sintaxe do JS embutido.

## v0.3.2 — 2026-08-12
- Novo dataset `data/projetos.js`: 27 iniciativas do portfólio da UI, agrupadas nos 4 núcleos, com representante(s) por iniciativa. "Sebrae Startups" segue com "Núcleo de Startups" — pendência da Sandra indicar a pessoa nominal com o gestor.
- Nova página `projetos.html`: filtro por núcleo e busca, seções colapsáveis por núcleo, representantes como chips, contagem por linha e no rodapé. Link "Projetos" adicionado ao menu de todas as páginas.
- `index.html`: 2 novos cards no dashboard — total de projetos no portfólio e núcleos × representantes distintos (com mini-breakdown por núcleo), ambos calculados a partir de `data/projetos.js`.
- `editor.html`: novo conjunto editável "Projetos & Representantes" (núcleo via dropdown, representantes por vírgula), gera `data/projetos.js` atualizado.
- `tools/validar_dados.py` e `tools/validar_site.py` estendidos para cobrir `data/projetos.js` e `projetos.html`.

## v0.3.1 — 2026-08-12
- Corrige `supabase/setup.sql` — adiciona GRANTs de tabela pra `anon` e `authenticated`, sem os quais o RLS não chega a ser avaliado e o cliente recebe permission denied.

## v0.3.0 — 2026-08-12
- `editor.html`: botão "+ Nova atividade" na aba Plano — formulário inline, ID gerado automaticamente pelo prefixo da frente (CMT/INS/CAN/PTF/CG, ou `ATV-` sem frente).
- `participantes.html`: card do Comitê com o nome completo (Comitê de Atendimento e Relacionamento da Inovação), sem repetir a descrição abaixo de cada nome; card UI sem a linha de papel; card Núcleos recriado com os 8 representantes atuais e seu núcleo.
- `demandas.html`: matriz de demandas migrada para Supabase (tabela `meta_inovacao_matriz_demandas`) — edição inline colaborativa, realtime entre abas/máquinas, identificação do editor, exportar JSON, cache de 30s. Cai para leitura local (`data/matriz.js`) se o Supabase não responder.
- `agenda.html`: visão calendário (toggle com a Lista) — mês corrente por padrão, navegação livre, faixas contínuas dos ciclos, marcos dos 7 nós do caminho crítico e dos encontros já datados.
- `supabase/setup.sql` criado (tabela + RLS + seed a partir de `data/matriz.js`) — **não executado neste deploy**, precisa rodar manualmente no SQL Editor do Supabase (sem credencial de DDL disponível no ambiente da automação).

## v0.2.0 — 2026-08-12
- O ambiente ganha nome e identidade: **Carta de Corso** (título das páginas, cabeçalho e config). O plano vigente segue como Meta Inovação 2026, no subtítulo.
- Deck dos 8 canais URC (apresentacao_canais.html) incorporado ao repositório, com o slide da soma citando a meta de omnicanalidade da URC (2025).

## v0.1.0 — 2026-08-11
Primeira versão publicável do painel Meta Inovação 2026.

- Dashboard com trilho dos 7 nós do caminho crítico, 6 KPIs, radar de carga por dia, atrasadas e próximos 7 dias.
- Plano de ação: 47 ações navegáveis com solução proposta por ação (como executar, como monitorar, ferramenta).
- Caminho crítico: 7 nós com estado calculado por data, fallbacks, gatilhos, 2 SLAs e janelas de folga.
- Agenda: Ciclos 1 e 2 com a URC; 16 encontros criados como "a agendar" (Nó 1 pendente).
- Matriz de demandas 27 iniciativas × 8 canais, nascendo limpa, com fluxo de estados por célula.
- Participantes por grupo com pendências de indicação e fallback do Nó 2.
- Modo edição no navegador com download do data/*.js atualizado no formato canônico.
- 5 testes automatizados (dados, cálculos, site, KPIs cruzados, roundtrip do editor).
