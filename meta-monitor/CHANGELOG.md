# Changelog

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
