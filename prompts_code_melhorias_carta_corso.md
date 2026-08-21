# Prompts para o Claude Code — Plano de Melhorias Carta de Corso

**Cobertura:** todos os itens restantes do plano (o Prompt 1, Bloco 1 itens 1.1–1.4 + gate, já foi entregue separadamente).
**Como usar:** copie um prompt por vez, na ordem. Cada prompt é autossuficiente e termina com testes + push automático (automações liberadas). Onde há dependência de prompt anterior, está marcado no topo. Onde há decisão sua pendente, está marcado com ⚠️ DECISÃO.

**Ordem recomendada de execução:**
P2 → P3 → P4 → P5 → P6 → P7 → (P8 e P9 quando quiser) → P10 → P11 → (P12 opcional) → P13

---

--## PROMPT 2 — Bloco 1 final: menu em domínios, KPIs clicáveis, legenda de status
*(itens 1.5 + 1.6 + 1.7 · sem dependências)*

```
# CONTEXTO

Repositório do site Carta de Corso (www.cartacorso.com.br), site estático com dados 
em data/*.js (padrão window.DB), deploy automático no Vercel via git push. Vamos 
fechar o Bloco 1 do plano de melhorias com 3 ajustes de navegação e leitura. 
Automações liberadas: execute, rode a suíte de testes e, se tudo passar, commit e push.

# TAREFA 1 — Agrupar o menu lateral em domínios

1.1. No sidebar compartilhado, inserir títulos de seção (estilo discreto: caixa alta, 
     fonte menor, cor secundária, sem link) agrupando os itens existentes assim:
     VISÃO       → Dashboard · Caminho crítico
     EXECUÇÃO    → Plano de ação · Agenda dos ciclos · Matriz de demandas · 
                   Atividades por iniciativa
     PESSOAS     → Participantes · Projetos
     JORNADA     → O Caminho para o Corsário
     ADMIN       → Modo edição
1.2. Não alterar URLs, nomes de arquivos nem a ordem interna dos grupos.
1.3. Aplicar em todas as páginas que renderizam o sidebar (se o sidebar for duplicado 
     por página, alterar todas; se for gerado por JS compartilhado, alterar na fonte).

# TAREFA 2 — KPIs do Dashboard clicáveis (drill-down nível 1)

2.1. Em plano.html: fazer os filtros existentes (frente, status, responsável, 
     crítico, busca) lerem parâmetros de querystring no carregamento. 
     Ex.: plano.html?status=atrasada aplica o filtro de status "Atrasada".
     Mapear também: ?status=vence7 (vencem em 7 dias, se esse filtro existir na 
     página; se não existir, criar a opção no select de status calculando prazo <= 
     hoje+7 e status não concluído) e ?status=janela (em janela, sem data fixa).
2.2. No Dashboard (index.html): transformar os cartões de KPI em links:
     ATRASADAS        → plano.html?status=atrasada
     VENCEM EM 7 DIAS → plano.html?status=vence7
     EM JANELA        → plano.html?status=janela
     CONCLUÍDAS       → plano.html?status=concluida
     EM ANDAMENTO     → plano.html?status=em_andamento
     AÇÕES NO PLANO   → plano.html (sem filtro)
2.3. Manter o visual dos cartões; adicionar apenas cursor pointer e um hover sutil 
     coerente com a identidade. Os itens listados em "Atrasadas agora" e "Próximos 
     7 dias" também viram links para plano.html com a busca preenchida com o ID 
     (ex.: plano.html?q=CMT-02).

# TAREFA 3 — Legenda e consistência mínima de status

3.1. Auditar todas as páginas e listar (no relatório final) todos os rótulos de 
     status em uso e suas cores.
3.2. Garantir que a mesma cor nunca signifique estados semanticamente diferentes em 
     páginas diferentes. Se houver conflito, ajustar a cor do rótulo menos usado.
3.3. Adicionar uma legenda compacta (uma linha, badges pequenos) no topo das páginas 
     agenda.html e caminho.html explicando os vocabulários próprios delas 
     (AGENDADO / A AGENDAR / VENCEU SEM CONCLUIR / À FRENTE etc.).
3.4. NÃO unificar a taxonomia de dados neste prompt (isso é um trabalho futuro 
     separado). Apenas legenda + coerência de cores.

# TAREFA 4 — Validação e publicação

4.1. node --check em todos os arquivos com JS alterado.
4.2. Rodar a suíte de testes headless completa.
4.3. Se tudo passar: incrementar versão no rodapé, atualizar CHANGELOG, 
     git add -A && git commit -m "menu em domínios + KPIs clicáveis + legenda de 
     status" && git push.
4.4. Se falhar: não fazer push; reportar e aguardar.

# AO FINAL

Reporte: arquivos alterados, resultado dos testes, tabela de todos os status 
encontrados na auditoria (rótulo · cor · páginas onde aparece).
```

---

--## PROMPT 3 — Proteção de escrita no Supabase
*(item 2.1 adaptado à decisão de senha compartilhada · depende do gate do Prompt 1 estar no repositório, mesmo desativado)*

⚠️ **DECISÃO/AVISO:** com senha compartilhada e sem usuários, a proteção possível é um token compartilhado validado por RLS. Isso impede escrita por bots e curiosos, mas quem tiver a senha do site consegue, tecnicamente, extrair o token. É proteção proporcional à escolha feita — a alternativa forte (Supabase Auth com usuários) fica registrada no plano como evolução futura.

```
# CONTEXTO

Repositório do site Carta de Corso. O site usa Supabase (chave anon no client) para 
CRUD em plano-acao.html (tabela plano_acao_atividades) e nas células da Matriz de 
demandas. Hoje as policies de RLS permitem escrita anônima — qualquer pessoa com a 
URL pode gravar. Vamos restringir a escrita a um token compartilhado, mantendo a 
leitura pública. Automações liberadas para o código do site; os comandos SQL você 
NÃO executa — gera o script e me entrega para eu rodar manualmente no Supabase 
(padrão do projeto).

# TAREFA 1 — Script SQL (gerar, não executar)

1.1. Criar tools/sql/2026-XX_protecao_escrita.sql com:
     a) Em todas as tabelas com escrita pelo site (plano_acao_atividades e a(s) 
        tabela(s) da Matriz — descubra os nomes reais lendo o código do site): 
        remover as policies de INSERT/UPDATE/DELETE anônimas atuais.
     b) Criar policies de INSERT/UPDATE/DELETE que exigem header customizado:
        current_setting('request.headers', true)::json->>'x-cc-token' = '<TOKEN>'
        Deixe <TOKEN> como placeholder claramente marcado no script; vou gerar um 
        token aleatório (UUID) e substituir antes de rodar.
     c) Manter as policies de SELECT como estão (leitura pública).
1.2. Comentar cada bloco do script explicando o que faz e como reverter.

# TAREFA 2 — Client

2.1. Centralizar a criação do client Supabase (se ainda não for centralizada) em um 
     módulo único (js/supabase.js ou equivalente já existente).
2.2. Configurar o client para enviar o header x-cc-token em todas as requisições, 
     lendo o valor de window.CC_TOKEN.
2.3. window.CC_TOKEN é definido em js/gate.js APÓS o desbloqueio por senha: derive o 
     token do sessionStorage — concretamente, ao validar a senha, além de cc_auth, 
     gravar cc_token com um valor que virá de data/config.js (campo tokenEscrita, 
     placeholder "SUBSTITUIR_PELO_TOKEN"). Enquanto exigirSenha === false, ler 
     tokenEscrita direto do config (comportamento atual preservado).
2.4. Tratar erro de escrita 401/403 nas telas de CRUD com mensagem amigável: 
     "Sem permissão de escrita — fale com o JR." (sem stacktrace na tela).

# TAREFA 3 — Validação e publicação

3.1. node --check nos arquivos alterados; rodar a suíte de testes completa 
     (os testes de roundtrip do editor devem continuar passando com o token vindo 
     do config).
3.2. Se tudo passar: incrementar versão, CHANGELOG, commit e push.

# AO FINAL

Reporte: nomes reais das tabelas encontradas, arquivos alterados, caminho do script 
SQL gerado e o passo a passo de ativação (gerar UUID → substituir no SQL → rodar no 
Supabase → substituir tokenEscrita no config.js → commit).
```

---

--## PROMPT 4 — Visão "Minhas ações" por responsável fiz 
*(item 2.2 · resolve BACKLOG #003 e #004 · sem dependência técnica dos anteriores, mas rode depois do P2 para herdar a querystring)*

```
# CONTEXTO

Repositório do site Carta de Corso. Hoje não existe uma visão que responda "o que eu 
tenho que fazer?" para uma pessoa específica. Vamos criar a visão transversal por 
responsável, fechando os itens #003 e #004 do BACKLOG. Automações liberadas: 
executar, testar, commit e push.

# TAREFA 1 — Lista fixa de responsáveis (BACKLOG #004)

1.1. Criar em data/pessoas.js (ou onde a lista de pessoas já vive) um array canônico 
     de responsáveis com id estável e nome de exibição. Popular com todas as pessoas 
     já citadas como responsáveis no plano (Sandra, Gerência, Comitê, JR., Pova, 
     Anny, e os representantes de núcleo já existentes em pessoas/projetos). Extrair 
     a lista real varrendo data/plano.js e as atividades do Supabase 
     (plano-acao.html) — liste no relatório os valores livres encontrados que não 
     mapeiam para ninguém.
1.2. Em plano-acao.html: trocar o campo livre "Responsável" por um select alimentado 
     pela lista canônica. Atividades existentes com texto livre: exibir o valor 
     antigo como opção "legada" marcada visualmente, sem apagar dado de ninguém.
1.3. Em data/plano.js: adicionar campo responsavel_id nas ações, mapeando os textos 
     atuais para ids. Onde o responsável for múltiplo ("JR. e Pova"), usar array de 
     ids. Manter o campo de texto original intocado (compatibilidade).

# TAREFA 2 — Página "Minhas ações" (BACKLOG #003)

2.1. Criar minhas-acoes.html seguindo o padrão visual e o sidebar do site (entra no 
     grupo EXECUÇÃO do menu, logo após "Plano de ação").
2.2. Conteúdo: seletor "Ver como: [pessoa]" no topo (select da lista canônica), 
     persistido em localStorage (chave cc_ver_como). Ao selecionar, exibir em seções:
     a) NÓS DO CAMINHO CRÍTICO onde a pessoa é guardiã (de data/nos.js) — com 
        status, fallback e gatilho resumidos;
     b) AÇÕES DO PLANO (data/plano.js) onde responsavel_id inclui a pessoa — 
        ordenadas por: atrasadas primeiro, depois por prazo crescente, janelas por 
        último;
     c) ATIVIDADES POR INICIATIVA (Supabase) onde o responsável é a pessoa;
     d) PRÓXIMOS ENCONTROS da agenda em que a pessoa aparece como envolvida, se 
        esse vínculo existir nos dados (se não existir, omitir a seção — não 
        inventar vínculo).
2.3. Cabeçalho da página com o resumo no tom do produto: "N itens sob sua guarda · 
     X atrasados · Y vencem em 7 dias".
2.4. Suportar querystring ?pessoa=<id> (link direto compartilhável no WhatsApp).

# TAREFA 3 — Validação e publicação

3.1. node --check, suíte de testes completa. Adicionar um teste headless novo: 
     dado um responsável com ações conhecidas nos dados, a página lista a contagem 
     correta.
3.2. Passando tudo: incrementar versão, CHANGELOG, dar baixa nos itens #003 e #004 
     do BACKLOG.md, commit e push.

# AO FINAL

Reporte: arquivos criados/alterados, lista de valores de responsável não mapeados 
(para eu decidir), resultado dos testes.
```

---

--## PROMPT 5 — Dashboard reorganizado por urgência decisória  fiz 
*(item 2.3 · rodar após P2 para os links já existirem)*

```
# CONTEXTO

Repositório do site Carta de Corso. O Dashboard atual abre com timeline de etapas e 
KPIs de contagem; a informação acionável (atrasadas, radar de carga) vem depois. 
Vamos reordenar por urgência decisória, sem redesenhar componentes. Automações 
liberadas: executar, testar, commit e push.

# TAREFA 1 — Frase de contexto

1.1. Adicionar em js/calc.js uma função que calcula: nº de ações atrasadas, nº de 
     nós do caminho crítico em estado crítico (vencido sem concluir / vence hoje), 
     nº de dias no radar de carga com 2+ entregas.
1.2. Logo abaixo do título "Dashboard", exibir a frase de contexto: 
     "N itens precisam de atenção hoje · X ações atrasadas · Y nós críticos" 
     (omitir parcelas zeradas; se tudo zerado: "Nenhum item crítico hoje — plano no 
     ritmo."). Estilo: destaque discreto, coerente com a identidade.

# TAREFA 2 — Reordenação das seções

2.1. Nova ordem do index.html:
     1º  Frase de contexto (Tarefa 1)
     2º  Timeline dos 7 nós (mantida — é o mapa mental do plano)
     3º  ATRASADAS AGORA + PRÓXIMOS 7 DIAS (lado a lado, como já são)
     4º  RADAR DE CARGA
     5º  KPIs numéricos (cartões clicáveis)
     6º  Composição do portfólio (gestores por núcleo etc.)
2.2. Nenhum componente é removido; apenas movido. Preservar todos os cálculos.

# TAREFA 3 — Validação e publicação

3.1. node --check, suíte completa (os testes de KPI cross-validados devem passar 
     sem alteração de valores).
3.2. Passando: incrementar versão, CHANGELOG, commit e push.

# AO FINAL

Reporte: diff estrutural (ordem antiga → nova) e resultado dos testes.
```

---

--## PROMPT 6 — Taxonomia única de status
*(item 2.4 · rodar antes de P12/Kanban · toca muitos arquivos: atenção redobrada aos testes)*

```
# CONTEXTO

Repositório do site Carta de Corso. Hoje cada página tem vocabulário próprio de 
status (ATRASADA, VENCEU SEM CONCLUIR, NÃO INICIADO · JANELA, A AGENDAR, AGENDADO, 
"a definir"...). Vamos criar um módulo canônico de status consumido por todas as 
páginas, sem mudar o significado de nada. Automações liberadas, MAS este prompt toca 
muitos arquivos: rode a suíte de testes após CADA tarefa, não só no final.

# TAREFA 1 — Módulo canônico

1.1. Criar js/status.js expondo window.CC_STATUS: dicionário com os estados 
     canônicos, cada um com: chave estável (snake_case), rótulo de exibição, cor 
     (referenciando as variáveis CSS existentes), e contexto de uso 
     (acao | no_critico | encontro | celula_matriz).
1.2. Estados de ação:      nao_iniciado, em_andamento, concluida, atrasada, janela
     Estados de nó:        venceu_sem_concluir, vence_hoje, a_frente
     Estados de encontro:  agendado, a_agendar, a_definir
     Estados de célula:    previsto, oficina, formulario, justificado, priorizado, 
                           encaminhado
1.3. Incluir função helper CC_STATUS.badge(chave) que retorna o HTML do badge 
     padronizado (cor + rótulo em texto — nunca cor sozinha).

# TAREFA 2 — Migração página a página

2.1. Migrar NESTA ordem, testando após cada uma: plano.html → index.html → 
     caminho.html → agenda.html → demandas.html → plano-acao.html (a nova 
     minhas-acoes.html, se já existir, por último).
2.2. Em cada página: substituir a renderização local de badges pela chamada ao 
     helper; substituir comparações de string de status por comparações com as 
     chaves canônicas. Onde os dados em data/*.js usarem strings de exibição como 
     valor, adicionar mapeamento de entrada (dado antigo → chave canônica) dentro 
     de status.js, SEM alterar os arquivos de dados neste prompt (a Sandra edita 
     esses arquivos; não mudar o formato que ela conhece).

# TAREFA 3 — Validação e publicação

3.1. Suíte completa + verificação visual automatizada: para cada página, o teste 
     headless deve confirmar que a contagem de badges renderizados antes e depois 
     da migração é idêntica.
3.2. Passando: incrementar versão, CHANGELOG, commit e push.

# AO FINAL

Reporte: tabela de mapeamento (string antiga → chave canônica → páginas afetadas) 
e resultado dos testes por página.
```

---

--## PROMPT 7 — Responsividade mobile
*(item 2.5 · sem dependências)*

```
# CONTEXTO

Repositório do site Carta de Corso. O site é consumido também pelo celular (links 
circulam no WhatsApp da equipe), mas o sidebar fixo e as tabelas largas tornam o 
mobile hostil. Vamos tornar as telas principais utilizáveis em viewport estreito. 
Automações liberadas: executar, testar, commit e push.

# TAREFA 1 — Sidebar responsivo

1.1. Abaixo de 768px: sidebar vira menu hambúrguer — header fixo no topo com o 
     título "Carta de Corso" e o botão; ao abrir, o menu desliza por cima do 
     conteúdo (overlay), com os mesmos grupos de domínio. Fechar ao navegar ou ao 
     tocar fora.
1.2. Preservar o rodapé de versão dentro do menu aberto.

# TAREFA 2 — Conteúdo em viewport estreito

2.1. index.html: cartões de KPI em grade 2 colunas; listas "Atrasadas/Próximos 7 
     dias" empilhadas.
2.2. plano.html e minhas-acoes.html (se existir): abaixo de 768px, cada linha da 
     tabela vira um card empilhado (ID + atividade em cima; responsável, prazo e 
     badge de status embaixo). Filtros empilhados em largura total.
2.3. agenda.html: tabela de encontros vira lista de cards por canal.
2.4. demandas.html (Matriz) e a visão MATRIZ do Corsário: manter desktop-only — 
     em viewport estreito, exibir aviso amigável no tom do produto ("Esta carta é 
     grande demais para o bolso — abra num monitor") + link para as demais visões.
2.5. Tocar o mínimo possível no HTML: preferir CSS (media queries + display) e, 
     onde inevitável, atributos data-* para os rótulos dos cards.

# TAREFA 3 — Validação e publicação

3.1. node --check, suíte completa. Adicionar teste headless com viewport 390x844 
     verificando: menu abre/fecha, plano.html renderiza cards, matriz exibe o aviso.
3.2. Passando: incrementar versão, CHANGELOG, commit e push.

# AO FINAL

Reporte: arquivos alterados, screenshots headless (desktop vs 390px) das páginas 
principais se a infra de teste permitir, resultado dos testes.
```

---

--## PROMPT 8 — Busca global
*(item 2.6 · melhor após P6, para reaproveitar chaves de status nos resultados)*

```
# CONTEXTO

Repositório do site Carta de Corso. Todos os dados já estão no client (window.DB + 
Supabase). Vamos criar busca global client-side. Automações liberadas.

# TAREFA 1 — Índice e UI

1.1. Criar js/busca.js: constrói em memória um índice das entidades — ações do 
     plano (ID, atividade, responsável), iniciativas, pessoas, nós do caminho 
     crítico, encontros da agenda. Normalizar acentos e caixa.
1.2. UI: campo de busca no topo do sidebar (desktop) e no header mobile, com 
     atalho de teclado "/" para focar. Resultados em dropdown agrupados por tipo 
     (Ações · Iniciativas · Pessoas · Nós · Encontros), máximo 5 por grupo, 
     navegáveis por setas + Enter.
1.3. Cada resultado linka para a página certa com querystring de filtro/busca já 
     suportada (plano.html?q=ID, minhas-acoes.html?pessoa=id, etc.). Para 
     iniciativas, linkar para a visão CARDS do Corsário com a busca preenchida.

# TAREFA 2 — Validação e publicação

2.1. node --check, suíte completa + teste headless: buscar um ID conhecido retorna 
     o resultado esperado e o link correto.
2.2. Passando: incrementar versão, CHANGELOG, commit e push.

# AO FINAL

Reporte: entidades indexadas e contagens, resultado dos testes.
```

---

--## PROMPT 9 — Timeline na Agenda dos ciclos
*(item 2.7 · sem dependências)*

```
# CONTEXTO

Repositório do site Carta de Corso. agenda.html já tem o toggle LISTA/CALENDÁRIO. 
Vamos adicionar a terceira visão: TIMELINE. Automações liberadas.

# TAREFA 1 — Visão Timeline

1.1. Adicionar botão "TIMELINE" ao toggle existente.
1.2. Renderização: uma linha por canal (Foco+, CNR, Sebrae na sua empresa, Portal, 
     Marketing Cloud, Loja, Rede própria e parceira, Assessoria de Negócios, DXP, 
     Contabilizações e instrumentos), eixo horizontal de datas cobrindo do início 
     do Ciclo 1 ao fim do Ciclo 2 (encontros sem data ficam numa faixa "a definir" 
     à direita).
1.3. Cada encontro é um marcador na linha, com a cor do status canônico e tooltip 
     (data, turno, local/modo, confirmações). Marcar "hoje" com linha vertical.
1.4. Implementação em SVG ou CSS grid — sem bibliotecas novas. Mobile: rolagem 
     horizontal com o nome do canal sticky à esquerda.

# TAREFA 2 — Validação e publicação

2.1. node --check, suíte completa + teste headless: nº de marcadores = nº de 
     encontros nos dados.
2.2. Passando: incrementar versão, CHANGELOG, commit e push.

# AO FINAL

Reporte: arquivos alterados e resultado dos testes.
```

---

## PROMPT 10 — Unificação da persistência no Supabase
*(item 3.1 · DEPENDE do P3 aplicado, com token de escrita ativo no Supabase · executar em janela tranquila, um conjunto por vez)*

⚠️ **DECISÃO:** confirmar antes de rodar quais conjuntos migram. Recomendação: `plano` (status/prazos) e `agenda` (datas/locais/confirmações) — os dois que a Sandra mais atualiza. `nos`, `projetos`, `pessoas` e `config` permanecem em data/*.js.

```
# CONTEXTO

Repositório do site Carta de Corso. Hoje coexistem dois modelos de persistência: 
data/*.js versionados no Git (fluxo: Modo edição → baixar arquivo → validar_dados.py 
→ commit) e Supabase (plano-acao.html, Matriz). Vamos migrar os conjuntos de edição 
frequente — PLANO (status e prazos das ações) e AGENDA (datas, locais, confirmações) 
— para o Supabase, seguindo o padrão já validado no projeto (soft delete via 
deleted_at, saves com debounce, RLS com token de escrita). data/*.js viram SEED + 
fallback de leitura. Automações liberadas para o código; scripts SQL você gera e me 
entrega para execução manual (padrão do projeto). Migrar UM conjunto por vez, com a 
suíte de testes passando entre eles.

# TAREFA 1 — Migração do conjunto PLANO

1.1. Gerar tools/sql/2026-XX_plano.sql: tabela plano_acoes (id texto = ID atual 
     tipo CMT-01, campos: frente, subfrente, atividade, responsavel_id[], prazo_iso, 
     prazo_texto, status chave canônica, no_critico, deleted_at, updated_at, 
     updated_by texto livre). Policies: SELECT público, escrita via token (mesmo 
     padrão do script anterior). Incluir INSERTs de seed gerados a partir do 
     data/plano.js atual.
1.2. Camada de dados: criar js/db-plano.js — lê do Supabase; se a chamada falhar 
     (offline/file://), cai para window.DB de data/plano.js com aviso discreto 
     "dados locais — pode haver defasagem". Todas as páginas que hoje leem 
     data/plano.js passam a ler dessa camada.
1.3. Modo edição (editor.html), conjunto "Plano de ação": trocar o fluxo 
     gerar-arquivo-e-baixar por CRUD direto no Supabase (debounce, indicador 
     SALVANDO/SALVO/FALHOU igual ao da Matriz). Manter o botão "Exportar JSON" 
     como backup manual. Manter o fluxo antigo de download disponível atrás de um 
     link "modo avançado (Git)" — não remover nada da Sandra sem rede de segurança.
1.4. Rodar a suíte completa. Os testes que leem data/plano.js devem ser adaptados 
     para testar a camada js/db-plano.js com o fallback local (os testes headless 
     não devem depender de rede).

# TAREFA 2 — Migração do conjunto AGENDA

2.1. Mesmo padrão: tools/sql/2026-XX_agenda.sql (tabela agenda_encontros com seed 
     de data/agenda.js), js/db-agenda.js com fallback, editor.html conjunto 
     "Agenda" em CRUD direto.
2.2. Suíte completa novamente.

# TAREFA 3 — Documentação e publicação

3.1. Atualizar o README/CHANGELOG descrevendo o novo modelo: o que vive no Supabase 
     (edição direta) e o que vive em data/*.js (edição via Git). Atualizar as 
     instruções "Como publicar a mudança" do Modo edição para refletir os dois 
     caminhos.
3.2. Incrementar versão (minor: v0.8.0), commit e push. NÃO fazer push se qualquer 
     teste estiver falhando.

# AO FINAL

Reporte: caminhos dos 2 scripts SQL (com ordem de execução), arquivos 
criados/alterados, o que mudou para a Sandra no dia a dia (em 3 linhas, linguagem 
não técnica — vou encaminhar a ela), resultado dos testes.
```

---

--## PROMPT 11 — Drill-down por entidade: painéis de Iniciativa e Pessoa
*(item 3.2 · melhor após P4 e P6; funciona sem P10)*

```
# CONTEXTO

Repositório do site Carta de Corso. Vamos fechar o ciclo indicador → causa → 
responsável → ação com painéis de detalhe para as duas entidades centrais: 
INICIATIVA e PESSOA. Nada de páginas novas — um drawer lateral (ou modal em mobile) 
aberto por clique em qualquer nome, em qualquer tela. Automações liberadas.

# TAREFA 1 — Infra do drawer

1.1. Criar js/drawer.js: componente único de painel lateral (desktop: desliza da 
     direita, ~480px; mobile: tela cheia), com fechamento por X, Esc e clique fora. 
     Identidade visual do site.
1.2. Roteamento leve por hash: #iniciativa=<slug> e #pessoa=<id> abrem o drawer 
     direto (links compartilháveis). Fechar limpa o hash.

# TAREFA 2 — Painel de INICIATIVA

2.1. Conteúdo, nesta ordem: nome + núcleo + representante(s) · posição na régua do 
     Corsário (patente + % + barra) · os critérios "em movimento" e "a iniciar" 
     (resumo dos 19) · atividades da iniciativa (do plano-acao/Supabase) com status 
     · linha da iniciativa na Matriz de demandas (células com estado ≠ vazio) · 
     próximos encontros dos ciclos relevantes.
2.2. Cada bloco linka para a página de origem já filtrada.

# TAREFA 3 — Painel de PESSOA

3.1. Conteúdo: nome + papéis (Comitê/URC/UI/representante e de quê) · nós do 
     caminho crítico onde é guardiã · ações do plano sob sua responsabilidade 
     (atrasadas primeiro) · atividades por iniciativa · link "ver tudo em Minhas 
     ações".

# TAREFA 4 — Ativação nos pontos de clique

4.1. Tornar clicáveis (abrindo o drawer): nomes de iniciativa em demandas.html, 
     projetos.html, O Caminho para o Corsário (cards e matriz) e plano-acao.html; 
     nomes de pessoa em participantes.html, projetos.html, e o responsável nas 
     linhas de plano.html.
4.2. Affordance discreta: sublinhado pontilhado no hover, cursor pointer.

# TAREFA 5 — Validação e publicação

5.1. node --check, suíte completa + testes headless novos: abrir 
     #iniciativa=sebraetec renderiza o painel com os blocos esperados; idem para 
     uma pessoa conhecida.
5.2. Passando: incrementar versão, CHANGELOG, commit e push.

# AO FINAL

Reporte: arquivos criados/alterados, lista de pontos de clique ativados por página, 
resultado dos testes.
```

---

## PROMPT 12 — Modo Kanban do plano de ação
*(item 3.3 · OPCIONAL · depende de P6 (taxonomia); escrita de status depende de P3; melhor após P10)*

```
# CONTEXTO

Repositório do site Carta de Corso. plano.html ganhará uma visão Kanban da mesma 
entidade (toggle LISTA | KANBAN). Automações liberadas.

# TAREFA 1 — Visão Kanban

1.1. Toggle no topo de plano.html. Colunas: NÃO INICIADO · EM ANDAMENTO · CONCLUÍDO, 
     com as ações ATRASADAS destacadas (borda/badge vermelho) dentro da coluna em 
     que estão, e as de JANELA agrupadas numa faixa própria no rodapé da coluna 
     NÃO INICIADO.
1.2. Card: ID, atividade (truncada em 2 linhas), responsável, prazo, badge. Clique 
     abre o drawer da entidade (se P11 aplicado) ou expande inline.
1.3. Drag-and-drop entre colunas (HTML5 DnD nativo, sem lib) atualiza o status: se 
     o conjunto PLANO já estiver no Supabase (P10), grava direto com debounce e 
     indicador SALVANDO/SALVO/FALHOU; se ainda estiver em data/plano.js, o DnD fica 
     DESABILITADO com tooltip "edição de status pelo Modo edição" — nunca simular 
     gravação que não persiste.
1.4. Filtros existentes (frente, responsável, busca) valem também na visão Kanban.

# TAREFA 2 — Validação e publicação

2.1. node --check, suíte completa + teste headless: contagem de cards por coluna 
     bate com as contagens de status dos dados.
2.2. Passando: incrementar versão, CHANGELOG, commit e push.

# AO FINAL

Reporte: arquivos alterados, se o DnD ficou ativo ou desabilitado (e por quê), 
resultado dos testes.
```

---

## PROMPT 13 — Histórico e auditoria
*(item 3.4 · depende de P10 · último da fila; ganha importância na fase de Expansão)*

```
# CONTEXTO

Repositório do site Carta de Corso. Com a edição direta no Supabase aberta a mais 
pessoas, precisamos saber quem mudou o quê e quando. Automações liberadas para o 
código; SQL gerado para execução manual minha.

# TAREFA 1 — Log de alterações (SQL, gerar)

1.1. tools/sql/2026-XX_auditoria.sql: tabela cc_audit_log (id, tabela, registro_id, 
     campo, valor_anterior, valor_novo, autor texto, criado_em) + triggers de 
     UPDATE/INSERT/DELETE nas tabelas editáveis (plano_acoes, agenda_encontros, 
     plano_acao_atividades, células da Matriz). SELECT do log restrito ao token de 
     escrita (não é dado público).
1.2. Autor: como não há usuários, gravar o identificador informado pelo client — 
     ver Tarefa 2.

# TAREFA 2 — Identificação leve do editor

2.1. Na primeira ação de edição da sessão, pedir uma vez "Quem está editando?" 
     (select da lista canônica de pessoas + opção outro), gravar em localStorage 
     (cc_editor) e enviar como campo autor em toda escrita. Trocável num link 
     pequeno "editando como: Sandra · trocar" no rodapé das telas de edição.

# TAREFA 3 — Visão "Últimas alterações"

3.1. No Modo edição, nova aba/seção "Histórico": lista das últimas 100 alterações 
     (quando · quem · o quê: "CMT-02 status: Não iniciado → Em andamento"), com 
     filtro por conjunto e por autor.

# TAREFA 4 — Validação e publicação

4.1. node --check, suíte completa (com mock do log no fallback local).
4.2. Passando: incrementar versão, CHANGELOG, commit e push.

# AO FINAL

Reporte: caminho do SQL, arquivos alterados, resultado dos testes.
```

---

## Controle de dependências (resumo)

| Prompt | Item do plano | Depende de | SQL manual? | Decisão sua antes? |
|---|---|---|---|---|
| P2 | 1.5 + 1.6 + 1.7 | — | não | não |
| P3 | 2.1 | P1 (gate no repo) | **sim** | aviso lido |
| P4 | 2.2 (#003/#004) | P2 (recomendado) | não | não |
| P5 | 2.3 | P2 | não | não |
| P6 | 2.4 | — | não | não |
| P7 | 2.5 | — | não | não |
| P8 | 2.6 | P6 (recomendado) | não | não |
| P9 | 2.7 | — | não | não |
| P10 | 3.1 | **P3 ativo** | **sim (2 scripts)** | **sim: conjuntos a migrar** |
| P11 | 3.2 | P4 + P6 (recomendado) | não | não |
| P12 | 3.3 (opcional) | P6; P10 p/ DnD | não | não |
| P13 | 3.4 | P10 | **sim** | não |
