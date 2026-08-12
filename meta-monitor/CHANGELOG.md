# Changelog

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
