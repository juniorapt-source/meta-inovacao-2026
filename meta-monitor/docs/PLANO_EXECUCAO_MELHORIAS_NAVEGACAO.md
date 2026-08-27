# PLANO DE EXECUÇÃO — Melhorias de navegação (Carta de Corso)

**Regime: José distribui os itens um a um pras sessões do Claude Code.** Diferente da
frente do golden record (`PLANO_EXECUCAO_GOLDEN_RECORD.md`, que roda pré-autorizada
camada por camada), aqui José revisa cada item em produção antes de mandar o próximo —
este documento é a lista de tarefas e o histórico do que já foi feito, não uma fila de
execução automática. Continuam valendo as regras normais de higiene do projeto
(`CLAUDE.md`): testar antes de commitar, mensagens de commit descritivas, nunca
reescrever histórico já publicado. Push direto na `main` continua sendo o fluxo padrão
do repositório (o site publica sozinho a cada push — ver `meta-monitor/README.md`).

Origem: reunião de José em 26/08/2026, documento
`melhorias_de_navegação_2608_projeto_corso.docx` — 5 itens levantados, causa raiz
conferida no código antes de cada correção.

> **STATUS GERAL (atualizado 27/08/2026):** Itens 1 e 4 concluídos e em produção. Item 2
> concluído e em produção, mas sua solução original (o botão "‹ Trocar de projeto")
> **fica mantida** — o item 3 foi redesenhado (ver "Item 3 — redesenho" abaixo) depois de
> José testar em produção e pedir um modelo diferente do que tinha sido entregue
> (checklist de múltipla escolha em vez de "trocar de um projeto pro outro"). Item 3
> (versão nova, checklist) **rodadas 1 e 2 EM PRODUÇÃO; RODADA 3 na branch, aguardando
> merge** — o teste do José em produção (3.9) derrubou o desenho de "um formulário por
> projeto" e pediu o inverso: uma matriz, um registro por projeto. Ver "Rodada 3" no item
> 3. O texto abaixo descreve o estado ANTES desse teste: **sub-itens 3.1 a 3.8 feitos e testados**
> (checklist ponta a ponta em Chrome headless, dois testes headless verdes, incluindo o
> isolamento entre projetos conferido no armazenamento e não só no DOM). Falta só o 3.9,
> o teste do José em produção — e ele só é possível DEPOIS do merge, porque produção é o
> que a `main` publica a cada push. Ordem correta, portanto: merge único do item inteiro
> na `main` → deploy automático → José confere (3.9).
> Item 5
> **NÃO INICIADO** — uma das duas decisões que travava o desenho já foi tomada
> (descartar a apresentação atual), falta a segunda (link varia por ciclo/oficina?).
> Se você está retomando este trabalho numa sessão nova: leia a seção "Status por item —
> resumo pra retomar" no fim primeiro.

## Legenda — modelo e esforço por atividade

(Mesma régua da frente do golden record — `PLANO_EXECUCAO_GOLDEN_RECORD.md` — reusada
aqui de propósito, pra manter os dois documentos comparáveis.)

| Modelo | Quando usar aqui |
|---|---|
| **Haiku** | Cópia de padrão já existente quase à risca, texto/comentário. |
| **Sonnet** | A maioria do pacote — causa raiz já mapeada, correção mecânica, sem decisão de arquitetura em aberto. |
| **Opus** | Mudança de modelo de estado ou de dado com risco real de regressão silenciosa (dado do projeto errado aparecendo no lugar errado, por exemplo). |

| Esforço | Quando usar |
|---|---|
| **baixo** | Mudança pequena e contida, 1 arquivo, padrão já resolvido antes. |
| **médio** | Várias partes móveis, caminho conhecido. |
| **alto** | Mexe em lógica de estado E de tela ao mesmo tempo, risco de regressão sutil. |

Atividades marcadas **[humano]** são decisão ou validação que só José faz.

---

## Item 1 — Menu lateral não obedecia ao scroll — ✅ CONCLUÍDO (27/08/2026)

| Atividade | Arquivo(s) | Status |
|---|---|---|
| `.nav` (`css/base.css`) tinha `height:100vh` sem `overflow-y` — itens de baixo do menu (ex. Pessoas › Projetos) ficavam fora da viewport | `css/base.css` | ✅ em `main` — [PR #19](https://github.com/juniorapt-source/meta-inovacao-2026/pull/19) |

**Teste de aceite:** ✅ passou — `tools/validar_site.py`, `tools/testar_mobile_headless.js`, `tools/testar_busca_headless.js`.

---

## Item 4 — "Devolutiva da URC sobre a grade" não aparecia no Plano de ação — ✅ CONCLUÍDO (27/08/2026)

| Atividade | Arquivo(s) | Status |
|---|---|---|
| Busca de `plano.html` comparava só `id+atividade+sub`; título do Nó crítico (`data/nos.js`) nunca entrava na comparação | `plano.html`, `js/core.js` (tooltip do badge "★ Nó N") | ✅ em `main` — [PR #20](https://github.com/juniorapt-source/meta-inovacao-2026/pull/20) |

**Teste de aceite:** ✅ passou — busca por "devolutiva da urc" verificada contra `data/plano.js`+`data/nos.js` retorna CAN-02; `tools/testar_dashboard_headless.js`/`tools/testar_busca_headless.js` verdes.

**Pendência não bloqueante, fora do escopo de código:** alinhar o texto do título da
ação CAN-02 com o do nó crítico 1 é decisão de conteúdo (`data/plano.js`/`data/nos.js`),
não item de código — fica em aberto se José quiser.

---

## Item 2 — Canvas de demandas: botão para voltar/trocar de projeto — ✅ CONCLUÍDO (27/08/2026)

| Atividade | Arquivo(s) | Status |
|---|---|---|
| Botão "‹ Trocar de projeto" no topo da mini-matriz | `canva.html` | ✅ em `main` — [PR #20](https://github.com/juniorapt-source/meta-inovacao-2026/pull/20) |

**Mantido mesmo depois do redesenho do item 3** — a mini-matriz de cada projeto
continua precisando de uma forma de voltar ao topo da tela; só o mecanismo de escolher
o projeto é que muda (select único → checklist, ver Item 3 abaixo).

---

## Item 3 — Canvas de demandas: responder por mais de um projeto — 🔄 RODADA 3 (3.1–3.8 em produção; rodada 3 na branch, aguardando merge)

### Histórico (por que este item foi reaberto)

Duas rodadas já foram feitas e mescladas em produção antes deste redesenho:

1. **PR #20 (27/08/2026):** aviso "Já respondeu por: ..." que só aparece depois de já
   existir um SEGUNDO projeto com demanda salva, mais o botão "‹ Trocar de projeto"
   (item 2).
2. **PR #21 (27/08/2026):** frase fixa abaixo do `<select>` explicando que dá pra
   responder por mais de um projeto reusando o mesmo campo.

José testou em produção (print anexo à conversa) e não reconheceu isso como "a opção
de adicionar outro projeto" — o modelo mental que ele quer é diferente: uma **lista de
checkboxes com todos os projetos disponíveis pra seleção, agrupados por categoria, com
"Selecionar Todos" por grupo** (padrão de referência: um campo multi-seleção de
formulário do FOCO/Salesforce, print anexo à conversa de 27/08/2026) — marca de uma vez
todos os projetos que vai responder, e a tela mostra a matriz de cada um.

**Decisão tomada:** implementar o checklist. Os elementos das duas rodadas anteriores
("Já respondeu por", a frase fixa) ficam **obsoletos** e devem ser removidos, não só
escondidos — o checklist resolve visibilidade e múltipla seleção de forma nativa. O
botão "‹ Trocar de projeto" (item 2) é reaproveitado como "voltar ao topo da tela".

### Por que é mudança de arquitetura, não ajuste de UI

Hoje existe **1 caderno global** (`let caderno = null;`) e **1 seção `#cv-passo2`**.
O checklist exige **N cadernos simultâneos** (um por projeto marcado) e **N blocos de
matriz na tela**. Rode em **plan mode** antes de codar.

### Contexto técnico herdado (leia antes de mexer em qualquer arquivo)

- `canva.html`: página standalone (fora do `.shell/.nav` do site, pública, sem login).
  Script inline no fim do `<body>`.
  - `DB_PROJETOS.carregar()` → `{ lista: projetos, usandoFallback }`, cada projeto tem
    `.nucleo` e `.iniciativa`. Hoje monta `<optgroup>` por núcleo dentro do `<select
    id="cv-projeto">` (`montarSelectProjetos()`).
  - `let caderno = null;` — o caderno ATIVO (1 só). `escolherProjeto(nomeProjeto)`
    troca esse caderno via `DB_CANVA.carregarCaderno(nomeProjeto)` e chama `render()`.
  - `render()` desenha tudo em cima do `caderno` global: `renderLinhasCanal()` (mini-
    matriz dos 10 canais com contagem por canal), `paineisAbertos.forEach
    (sincronizarPainel)` (cartões de demanda abertos), `renderResumo()`. Todas leem
    `caderno`/`paineisAbertos` do closure, não recebem como parâmetro.
  - `DB_CANVA.assinar(function (c) { if (c === caderno) render(); })` — 1 único
    listener global, só re-renderiza se o caderno que mudou é o ativo.
  - `garantirPainelDom(canalId)`, `painelHtml(canal)`, `adicionarCartao(canalId,
    focar)`, `coletarCampos(cartaoEl)` — todas assumem 1 só `#cv-mini-matriz` e 1 só
    `#cv-paineis` na página (ids fixos).
  - `canalDestaque` (de `?canal=` no QR de oficina) abre automaticamente o painel
    daquele canal no caderno ativo.
  - A remover nesta tarefa: `#cv-trocar-projeto` mantém a FUNÇÃO (voltar ao topo), mas
    `#cv-projetos-feitos` e a frase fixa abaixo do `<select>` (das PRs #20/#21) ficam
    obsoletos.

  - **HTML do 3.2 já feito — ids novos que o 3.3 precisa usar:** `#cv-projeto` deixou de
    ser `<select>` e virou `<div role="group">` vazio (container que
    `montarListaProjetos()` preenche — ver comentário no `<style>` de `canva.html` pra
    estrutura exata de cada grupo: `fieldset.cv-projeto-grupo[data-nucleo]` › `legend >
    label.cv-projeto-item.cv-projeto-todos > input.cv-chk-todos-grupo[data-nucleo]`, e um
    `label.cv-projeto-item > input.cv-chk-projeto[value=nomeDoProjeto]` por projeto).
    Projetos de texto livre (escape) entram num grupo à parte, `#cv-projeto-livres`
    (ainda não existe no DOM — o 3.3 cria ao adicionar o primeiro). O botão
    `#cv-escape-voltar` ("Voltar para a lista") foi REMOVIDO — o fluxo novo não substitui
    mais o campo, só adiciona; no lugar tem `#cv-escape-adicionar` ("Adicionar à
    seleção"), que deve criar/marcar o checkbox livre e limpar o campo de texto (não
    existe mais "desativar o select", porque não tem select).

- `js/db-canva.js` (`window.DB_CANVA`): NÃO faz SELECT/INSERT direto na tabela (só RPCs
  `cc_canva_gravar`/`cc_canva_editar` — anon sem GRANT na tabela). Fonte da verdade da
  TELA é o localStorage (chave `cc_canva_<slug_do_projeto>_<sessao_id>`), banco é o
  destino.
  - **Importante pro redesenho:** a sessão já é POR PROJETO (`sessaoDoProjeto
    (projeto)`, comentário "Uma sessão por projeto" no código) — trocar de projeto já
    preservava o anterior intacto. Ter N cadernos simultâneos **não exige mudança de
    schema de storage** — é só chamar `carregarCaderno()` uma vez por projeto marcado
    e guardar os N resultados, em vez de só 1.
  - Já exportadas, reaproveitáveis sem mudar: `slug(nome)`, `carregarCaderno(projeto)`,
    `salvarCaderno(caderno)`, `salvarDemanda(caderno, campos)`, `removerDemanda(...)`,
    `definirAutor(caderno, nome)`, `contarPorCanal(caderno)`, `assinar(callback)`.
  - `projetosRespondidosLocalmente()` (adicionada no PR #20) fica **obsoleta** com o
    checklist — quem já está marcado é a fonte de verdade agora, não quem tem
    demanda salva. Avaliar remover (ou deixar sem uso — decidir no code review do PR).
  - **Não existe hoje** nenhuma chave persistindo "quais projetos o gestor marcou" (só
    existe "qual caderno cada projeto tem"). Precisa criar.

### Quebra em sub-itens

| # | Atividade | Arquivo(s) | Modelo/Esforço | Status |
|---|---|---|---|---|
| 3.1 | `js/db-canva.js`: nova chave de persistência (padrão de `CHAVE_SESSOES`) + `salvarSelecaoProjetos(lista)`/`carregarSelecaoProjetos()`, exportadas em `DB_CANVA` | `js/db-canva.js` | Sonnet / baixo | ✅ feito — branch `claude/plano-execucao-item-3-1-8redft`, `tools/testar_canva.js`/`tools/validar_site.py` verdes |
| 3.2 | HTML de `canva.html`: troca `<select id="cv-projeto">` por checklist agrupado por núcleo, com "Selecionar todos" por grupo (indeterminate quando parcial); "Não encontrei meu projeto" passa a ADICIONAR um checkbox de texto livre à seleção em vez de substituir o campo | `canva.html` | Sonnet / médio | ✅ feito — branch `claude/plano-execucao-item-3-1-8redft`, só HTML/CSS (o `#cv-projeto` virou `<div>` container vazio, `role="group"`; conteúdo — fieldset por núcleo + "selecionar todos" — é montado em JS pelo 3.3); `tools/validar_site.py canva.html` verde. **JS ainda não foi atualizado (3.3) — a tela FICA QUEBRADA no navegador até o 3.3 rodar** (script referencia `selProjeto.value`/`.disabled` que não existem mais no `<div>`); é esperado nesta ordem, não faz sentido testar no navegador antes do 3.3+3.4. |
| 3.3 | JS de `canva.html`: `montarListaProjetos()` substitui `montarSelectProjetos()`; `const cadernos = new Map()` substitui `let caderno`; toggle de checkbox atualiza seleção, persiste (3.1), chama `renderBlocosProjetos()` (cria/remove blocos sem apagar dado local ao desmarcar); `DB_CANVA.assinar()` passa a procurar o caderno certo dentro do Map | `canva.html` | **Opus / alto** — é o núcleo da reescrita de estado, maior risco de regressão sutil | ✅ feito (27/08/2026) — feito JUNTO com o 3.4, como a própria "Ordem recomendada" deste plano manda: `renderBlocosProjetos()` não fecha sem `montarBlocoProjeto()`, e separar os dois só produziria um stub pra ser jogado fora. Ver "O que a reescrita 3.3/3.4 mudou" abaixo. |
| 3.4 | `montarBlocoProjeto(nomeProjeto)`: fábrica que parametriza por projeto o que hoje são funções globais sobre ids fixos (`renderLinhasCanal`, `sincronizarPainel`, `garantirPainelDom`, `painelHtml`, `adicionarCartao`, `coletarCampos`, `renderResumo`) — cada bloco tem seu próprio `<section>` com heading "Sua linha na matriz — X" e ids/`data-projeto` escopados | `canva.html` | **Opus / alto** — mesma razão do 3.3, é a mesma reescrita | ✅ feito (27/08/2026), junto com o 3.3. Nenhum id novo por bloco: dentro do bloco tudo é achado por classe/`data-canal`, e os ids que sobraram nos cartões (`sv-<uuid>`, `name` dos radios) já eram únicos por demanda. |
| 3.5 | `canalDestaque` (contexto do QR de oficina) abre o painel daquele canal em TODOS os blocos criados a partir de agora, não só o primeiro | `canva.html` | Sonnet / baixo (depende do 3.3/3.4 prontos) | ✅ atendido por construção no 3.4 — o trecho que abre `canalDestaque` mora DENTRO da fábrica, então roda uma vez por bloco. Conferido em Chrome headless (2 projetos marcados com `?canal=empresa` → cartão de `empresa` aberto nos dois). Falta só virar teste permanente, no 3.8. |
| 3.6 | `#cv-resumo`/"Baixar minha cópia (.csv)" passam a ser por bloco/projeto (confirmar antes se `csv-export.js` já exporta 1 caderno por vez — deveria, caderno já é escopado a 1 projeto) | `canva.html`, conferir `js/csv-export.js` | Sonnet / baixo | ✅ atendido por construção no 3.4 — resumo e botão de .csv são gerados dentro de cada bloco e fecham sobre o caderno daquele projeto. `js/csv-export.js` não precisou de mudança nenhuma (a suspeita do plano estava certa: ele já recebia cabeçalho+linhas prontos). |
| 3.7 | Limpeza: remover `#cv-projetos-feitos`, a frase fixa do PR #21, e `projetosRespondidosLocalmente()` (`js/db-canva.js`) se não sobrar uso — código morto, não código escondido | `canva.html`, `js/db-canva.js` | Sonnet / baixo | ✅ feito (27/08/2026) — removidos `#cv-projetos-feitos`/`#cv-lista-projetos-feitos` (e a frase fixa) de `canva.html`, e `projetosRespondidosLocalmente()` (função + export em `DB_CANVA`) de `js/db-canva.js`. Conferido que não sobrou referência em nenhum `.js`/`.html`/`.css` do repo. `tools/testar_canva.js`, `tools/testar_canva_oficina.js` e `tools/validar_site.py` verdes. |
| 3.8 | Ajustar `tools/testar_canva_oficina.js` + novo `tools/testar_canva_multiprojeto_headless.js` (mesmo padrão CDP cru dos outros testes headless do repo): marcar 2+ checkboxes de núcleos diferentes → 2+ blocos; "Selecionar Todos" marca o grupo inteiro; desmarcar não apaga dado (remarcar devolve); F5 restaura seleção; `?projeto=` pré-marca | `tools/testar_canva_oficina.js`, `tools/testar_canva_multiprojeto_headless.js` (novo) | Sonnet / médio | ✅ feito (27/08/2026) — `tools/testar_canva_multiprojeto_headless.js` criado, transcrevendo o "Roteiro já validado pro 3.8" abaixo (10 passos, seed atual de 4 núcleos/27 projetos), verde. A checagem 5 do `testar_canva_oficina.js` foi endurecida como o plano avisava: agora marca um projeto NOVO e cria a demanda num canal escolhido manualmente, em vez de reler o caderno já conferido no passo 3 (a seleção persistida fazia o checkbox do passo 2 chegar marcado de novo). `tools/testar_canva.js`, `tools/testar_canva_oficina.js`, `tools/testar_canva_multiprojeto_headless.js` e `tools/validar_site.py` todos verdes. | **Revisão de 27/08 (antes do merge):** a suíte foi submetida a teste de mutação — injetar "remarcar cria caderno vazio" ficou vermelho (bom), mas injetar "os dois blocos compartilham UM caderno" passava verde. Motivo: as checagens do passo 4 olhavam só o DOM, e `patchCartaoEl()` nunca reescreve o value de um input depois de criar o cartão (de propósito — é o que impede um `render()` no meio da digitação de roubar o cursor), então o cartão do bloco B seguia mostrando os campos vazios com que nasceu enquanto o dado dos dois projetos ia pro caderno de um só. Foram acrescentadas 3 checagens no ARMAZENAMENTO (um caderno por projeto marcado; o caderno de A com o que foi digitado nele; o de B sem nada de A) — com a regressão injetada elas ficam vermelhas, como devem. É a rede que faltava justamente pro bug que o teste de aceite deste item nomeia como o mais provável.
| 3.9 | **[humano]** José testa em produção (mobile e desktop) antes de considerar o item fechado | — | José | ✅ FEITO em 28/08/2026 — e **reprovou o desenho**. Achou dois problemas reais, ver "Rodada 3" abaixo. Um novo 3.9 fica em aberto pra rodada 3. |

### O que a reescrita 3.3/3.4 mudou (27/08/2026) — leia antes de mexer em `canva.html`

Os dois sub-itens foram entregues juntos, na mesma branch, porque não separam: o
`renderBlocosProjetos()` do 3.3 chama o `montarBlocoProjeto()` do 3.4 e partir os dois
só produziria um stub descartável. É o que a "Ordem recomendada" abaixo já mandava.

**Modelo de estado (`canva.html`):**

- `let caderno` (o "caderno ativo", 1 só) virou dois `Map`s: `cadernos` (nome do projeto
  → caderno do `DB_CANVA`) e `blocos` (nome do projeto → `{ el, render, destruir }`),
  mais `selecao` (array de nomes marcados, na ordem do checklist).
- Chave dos dois `Map`s é o nome com `trim()` (helper `chaveProjeto()`), o mesmo que
  `DB_CANVA.carregarCaderno()` grava em `caderno.projeto`. É por isso que
  `DB_CANVA.assinar()` consegue achar o bloco certo — se as duas pontas divergissem, o
  bloco simplesmente pararia de se re-renderizar sozinho, sem erro nenhum no console.
- `aoMudarSelecao()` é o **ponto único** por onde a seleção muda: lê o DOM → persiste
  (`DB_CANVA.salvarSelecaoProjetos`, item 3.1) → `renderBlocosProjetos()`. Não existe
  outro caminho, então não existe estado em que a tela mostra um bloco que não está
  marcado (nem o contrário).
- **Desmarcar tira da TELA, nunca do navegador:** sai o `<section>` e sai a entrada dos
  `Map`s; a chave do `localStorage` fica. Remarcar chama `carregarCaderno()` de novo e
  devolve tudo. Não existe nenhuma chamada de "apagar caderno" no arquivo — de propósito.
- Delegação de evento agora é **presa ao bloco** (`miniMatrizEl`/`paineisEl` de cada
  fábrica), não ao documento: ao desmarcar, o `<section>` sai do DOM e leva os ouvintes
  junto, sem ouvinte órfão escrevendo no caderno de um projeto que saiu da tela.

**Ids que deixaram de existir** (eram únicos por página, viraram classe + `data-*` por
bloco): `#cv-mini-matriz` → `.cv-mini-matriz[data-mini]`, `#cv-paineis` →
`.cv-paineis[data-paineis]`, `#cv-resumo` → `.cv-resumo-texto[data-resumo]`, `#cv-baixar`
→ `[data-baixar]`, `#cv-painel-<canal>` → `.cv-painel[data-canal]`, `#cv-projeto-nome` →
`.cv-bloco-nome`, `#cv-nota-projeto-novo` → `[data-nota-novo]`, `#cv-trocar-projeto` →
`.cv-voltar-lista` (um por bloco, agora rotulado "‹ Voltar para a lista de projetos" e
devolvendo o foco no checkbox DAQUELE projeto). `#cv-passo2` continua, agora só como
casca em volta do container novo `#cv-blocos`. `tools/validar_site.py` foi ajustado pra
cobrar `cv-blocos` no lugar dos três ids que sumiram.

**Correções em `js/db-canva.js` que o multiprojeto obrigou** (não estavam previstas no
plano, e são exatamente o tipo de regressão silenciosa que o item avisava):

- `let rodando = false` era **global da página**, não do caderno. Com N cadernos, a fila
  do projeto B voltava calada enquanto a do A estivesse em voo — e ninguém reagendava,
  então a demanda de B ficava "pendente" pra sempre. Virou `Set` de cadernos em voo. O
  motivo original de ser serial (não furar o teto de 20 do banco por corrida) continua
  valendo DENTRO de cada caderno; sessões diferentes não disputam nada entre si.
- `timerRetentativa` era um só, global: o primeiro caderno a cair a rede marcava o timer
  e os outros ficavam offline pra sempre. Virou `Map` caderno → timer.
- `enviarAgora(caderno)` limpava o debounce de **todos** os cadernos (`Object.keys(timers)`
  inteiro), cancelando a digitação que o gestor tinha acabado de fazer em outro projeto
  marcado. Agora limpa só os debounces das demandas daquele caderno.

### Roteiro já validado pro 3.8

Este roteiro rodou em Chrome headless (CDP cru, mesmo padrão dos outros testes do repo)
durante o 3.3/3.4 e passou inteiro — é o esqueleto pronto do
`tools/testar_canva_multiprojeto_headless.js`, com os números reais da seed atual
(4 núcleos, 27 projetos):

1. Checklist montado: 4 `.cv-projeto-grupo`, 27 `.cv-chk-projeto`, 1
   `.cv-chk-todos-grupo` por grupo, 0 `.cv-bloco` e `#cv-passo2` escondido antes de
   marcar qualquer coisa.
2. Marcar o 1º projeto de dois núcleos diferentes → 2 `.cv-bloco`, na ordem do
   checklist, 10 `.cv-linha-canal` em cada.
3. Com `?canal=empresa`: cartão de `empresa` aberto nos DOIS blocos (item 3.5).
4. Preencher a demanda só no bloco A → o cartão de `empresa` do bloco B continua com
   `servico`/`responsavel` **vazios** e selo "incompleta", enquanto o do A fica "salva".
   ⚠️ Atenção ao escrever a asserção: com `?canal=`, TODO bloco nasce com um cartão
   vazio daquele canal, então "B tem 1 demanda em empresa" é o esperado — o que prova
   que não vazou é o cartão de B estar vazio, não a contagem estar zerada.
5. "Selecionar Todos" do 1º núcleo (9 projetos) → 9 marcados, 9+1 blocos, cabeçalho
   `checked` e `indeterminate === false`.
6. Desmarcar 1 do grupo → cabeçalho vira `indeterminate`, bloco some da tela.
7. Remarcar o mesmo → o `.cv-f-servico` volta com o texto preenchido antes (o teste de
   aceite "desmarcar não apaga dado").
8. Escape: `#cv-escape-btn` → digitar no `#cv-projeto-livre` → `#cv-escape-adicionar`
   cria `#cv-projeto-livres`, deixa o checkbox marcado, cria o bloco e limpa o campo.
9. F5 → mesma quantidade de blocos e de checkboxes marcados de antes.
10. `?projeto=<nome>` → aquele projeto chega marcado e com bloco (união com a seleção
    guardada, não substituição).

### Rodada 3 (28/08/2026) — o que o teste em produção derrubou

José testou o item 3 em produção assim que ele foi pra `main` e achou **dois problemas
reais**. O primeiro derruba a premissa das rodadas 1 e 2:

**1. Um formulário por projeto era o modelo errado.** A tela abria uma matriz de 10
canais para CADA projeto marcado. Mas quem marca ALI Academy e ALI Coop vai pedir a
MESMA coisa pro Foco+ — *"criar grupo de clientes com a opção de importação em csv"* —
e não quer digitar duas vezes. Nas palavras do José: *"preciso que existam dois
registros, um do ALI Academy para o Foco+ e outro do ALI Coop para o Foco+"*. Ou seja:
**uma digitação, N registros**. O checklist não é um gerador de formulários, é o
**escopo da demanda**.

Vale registrar de onde veio o erro: o texto do próprio plano dizia *"marca de uma vez
todos os projetos que vai responder, e a tela mostra a matriz de cada um"*, e as
rodadas 3.3/3.4 implementaram exatamente isso. A frase estava lá desde o levantamento e
ninguém — inclusive o José, ao aprovar o plano — reparou que ela dizia a coisa errada.
Fica como lição de processo: *"a tela mostra a matriz de cada um"* descreve UI; o que
precisava estar escrito era o que vai parar no banco.

**2. Não havia botão de enviar, e a tela não dizia o que faltava.** Pior do que parece:
quando faltava responsável ou prazo, `js/db-canva.js` marcava a demanda como
`"incompleta"` e **zerava `d.erro`** — então o cartão mostrava o selo "INCOMPLETA" e
nada na tela dizia o motivo. O gestor preenchia, via "incompleta", e não tinha como
descobrir o que corrigir nem como forçar o envio. Beco sem saída.

**Decisões do José (28/08/2026):**
- Escopo: uma matriz só; a demanda vira um registro por projeto marcado. Pode haver uma
  marcação ligando os registros criados juntos — **opcional**, na palavra dele.
- Envio: botão explícito **somado** ao salvamento automático, não no lugar dele — o
  automático continua como rede de segurança pra WiFi de oficina e aba fechada.

| # | Atividade | Arquivo(s) | Modelo/Esforço | Status |
|---|---|---|---|---|
| 3.10 | `canva.html`: volta a UMA matriz. O cartão vira um "grupo" que escreve nos N cadernos dos projetos marcados — `criarGrupo`/`salvarGrupo`/`estadoDoGrupo`/`removerGrupo`. Continua existindo um caderno por projeto por baixo, porque a RPC recebe um projeto por linha e sessão/fila/retentativa/24h são por projeto em `js/db-canva.js` (que não precisou mudar) | `canva.html` | **Opus / alto** | ✅ feito (28/08/2026) |
| 3.11 | Botão "Enviar demanda" por cartão: envia na hora sem esperar o debounce e, quando não dá, diz o que falta (`DB_CANVA.problemas()`) e leva o foco pro primeiro campo vazio. Cartão mostra "Vira 2 registros — um para cada: X e Y"; resumo separa demanda digitada de registro gerado | `canva.html` | Sonnet / médio | ✅ feito (28/08/2026) |
| 3.12 | Escopo de demanda **não enviada** acompanha o checklist; depois de enviada, congela. Desmarcar nunca leva o cartão a zero projetos | `canva.html` | Sonnet / médio | ✅ feito — **bug pego pelo headless**: como o gestor marca um projeto de cada vez, congelar o escopo na criação deixava o cartão que o `?canal=` abre sozinho preso ao primeiro projeto marcado, e o segundo clique não valia nada |
| 3.13 | Carimbo de origem comum (`grupo_local`): local no `.csv` (coluna "Grupo") e no payload da RPC desde já; a gravação no banco depende da migração | `canva.html`, `js/db-canva.js`, `tools/sql/2026-08_canva_grupo_local.sql` (novo) | Sonnet / médio | ✅ código feito; **SQL aguardando José rodar** |
| 3.14 | **[humano]** Rodar `tools/sql/2026-08_canva_grupo_local.sql` no SQL Editor — OPCIONAL e aditiva. Sem ela o canvas funciona igual (a função ignora a chave extra); com ela o carimbo passa a ser gravado, sem mexer no site depois | — | José | ⏳ não iniciado |
| 3.15 | Testes: `tools/testar_canva_multiprojeto_headless.js` reescrito pro modelo novo (30 checagens, isolamento conferido no `localStorage` e não só no DOM); `tools/testar_canva_oficina.js` reancorado na matriz única; `tools/validar_site.py` volta a cobrar os ids fixos | testes | Sonnet / médio | ✅ feito, verdes |
| 3.16 | **[humano]** José testa a rodada 3 em produção (mobile e desktop) | — | José | ⏳ não iniciado |

**Por que a rodada 3 NÃO exigiu mudança em `js/db-canva.js` (fora o carimbo):** a camada
de dados sempre foi por projeto — uma sessão, um caderno, uma fila, uma regra de 24h por
projeto. O erro das rodadas 1 e 2 foi de TELA, não de dado. Por isso a correção coube
inteira em `canva.html`: o que mudou é quantos cadernos um mesmo cartão escreve.

**Detalhe assumido — reagrupamento depois do F5:** os cadernos voltam do `localStorage`
com as demandas, mas o vínculo "estas três linhas nasceram do mesmo cartão" vive só em
memória. Ao recarregar, a tela reagrupa por **assinatura de conteúdo** (mesmo canal,
mesmos campos, projetos diferentes = digitadas juntas). É heurística, e é honesto que
seja: o vínculo verdadeiro só existe com a coluna `grupo_local` no banco (item 3.14).
Na prática o pior caso é cosmético — duas demandas idênticas de projetos diferentes que
o gestor digitou separadamente aparecem como um cartão só depois de um F5.

**Ordem recomendada:** 3.1 → 3.2 → 3.3+3.4 (o núcleo, tratar como uma unidade só) →
3.5 → 3.6 → 3.7 → 3.8 → push → 3.9. Não pule 3.8 antes do push — é a rede de proteção
contra regressão silenciosa que o 3.3/3.4 pode introduzir.

**Estratégia de branch — leia antes de abrir a sessão de qualquer sub-item 3.2–3.8:**
diferente dos itens 1/2/4 (cada um atômico e seguro sozinho em produção), os
sub-itens 3.2, 3.3 e 3.4 **não funcionam isolados** — o checklist em HTML (3.2) só
funciona junto com a reescrita de estado em JS (3.3/3.4: `caderno` global vira `Map`
de cadernos). Se qualquer um desses for sozinho pra `main`, `canva.html` quebra em
produção — é página pública, sem login, usada ao vivo em oficina via QR Code, com
deploy automático a cada push. Por isso:
- **Todos os sub-itens 3.1–3.8 vivem na MESMA branch** — não crie uma branch nova a
  partir da `main` a cada sessão/sub-item.
- **Branch em uso hoje (27/08/2026): `claude/plano-execucao-item-3-8-mtsarn`.**
  Existem VÁRIAS branches com nome parecido, e isso já confundiu mais de uma sessão: o
  3.1 saiu na `claude/plano-execucao-item-3-1-8redft` (e acabou mesclado na `main`
  sozinho, antes do combinado), o 3.2 ficou só nessa mesma branch, a sessão do 3.3
  mesclou a `...-8redft` dentro da `...-8redft-4u70k2` (que reuniu 3.1→3.6), e a sessão
  do 3.7 mesclou a `...-8redft-4u70k2` dentro da `...-8redft-4u70k2-f7fpvq` (que reuniu
  3.1→3.7). A sessão do 3.8 mesclou a `...-f7fpvq` (fast-forward) dentro da
  `claude/plano-execucao-item-3-8-mtsarn`, então **é esta que tem tudo (3.1→3.8)** —
  continue nela até o 3.9/merge. As branches anteriores da lista estão desatualizadas;
  não trabalhe nelas.
- **Só mescla com a `main` depois do 3.8** (todos os sub-itens prontos + os testes
  headless novos verdes) — nunca no meio do caminho. O merge é 1 só pro item inteiro,
  não 1 por sub-item. **O 3.9 vem DEPOIS do merge, não antes**: o site publica sozinho a
  cada push, então não existe "produção" pro José conferir enquanto o item estiver fora
  da `main`.
- Comando sugerido pra abrir a sessão de cada sub-item (troque só o número):
  > Leia meta-monitor/docs/PLANO_EXECUCAO_MELHORIAS_NAVEGACAO.md, continue na
  > branch `claude/plano-execucao-item-3-8-mtsarn` (não crie uma branch nova a
  > partir da main) e execute o item 3.X. Não dê merge com a main — José revisa o
  > item inteiro (3.1→3.8 testados) antes do merge.

**Teste de aceite:**
- Marcar 2 projetos de núcleos diferentes mostra 2 seções de matriz, cada uma com seus
  próprios 10 canais e contagens independentes (dado do projeto errado no bloco errado
  é o bug mais provável — conferir com atenção).
- "Selecionar Todos" de um núcleo marca/desmarca todos os projetos daquele grupo de
  uma vez.
- Preencher uma demanda no projeto A e desmarcar A não apaga o que foi preenchido
  (remarcar mostra os dados de volta).
- F5 na página restaura os checkboxes marcados antes de recarregar.
- `?projeto=<nome>` (usado pelos QR codes) chega com aquele projeto pré-marcado.
- `?canal=<slug>` (QR de oficina) abre o painel daquele canal em todo bloco marcado.
- `tools/validar_site.py`, `tools/testar_canva.js` (sem navegador, não deveria
  precisar mudar — só a camada de seleção muda) e os dois headless do 3.8 verdes.

---

## Item 5 — Apresentação dos canais → lista com link do diretório — ⏳ NÃO INICIADO

Pedido original: tirar o arquivo/apresentação de slides que está em
`apresentacao_canais.html` hoje, criar uma lista dos canais (lendo o golden record —
`meta_inovacao_canais`/`js/db-canais.js`, já existe) com uma caixa de texto na frente
de cada canal pro link de um diretório externo.

### Decisões já tomadas (27/08/2026)

- **Ponto 1 — o que fazer com a apresentação atual ("Um time momentâneo"):**
  **descartar de vez.** Não precisa continuar acessível em outra URL nem virar PDF —
  fica só no histórico do git.

### Decisão em aberto (bloqueia o desenho do schema)

- **Ponto 2 — o link do diretório é 1 campo fixo por canal (10 campos no total), ou
  pode variar por ciclo/oficina?** Se for fixo por canal: 1 coluna nova em
  `meta_inovacao_canais` resolve. Se variar por ciclo: precisa de uma linha por
  canal+ciclo, não uma coluna — desenho de schema diferente. **Não iniciar este item
  sem essa resposta.**

### Contexto técnico levantado (não refazer esta investigação)

- `apresentacao_canais.html` hoje: 519 linhas de HTML/CSS de slideshow próprio, tema
  "Um time momentâneo", conteúdo dos 8 canais escrito à mão — não lê nenhuma fonte de
  dados.
- `js/db-canais.js` (`window.DB_CANAIS`) já existe, lê `meta_inovacao_canais`
  (Camada 0 do golden record — `meta-monitor/docs/PLANO_EXECUCAO_GOLDEN_RECORD.md`),
  formato `{ slug, nome, nome_completo, formato, pauta, ordem, ativo, db_id }`.
  `DB_CANAIS.salvar(id, campos, usuario)` já existe e já grava por `UPDATE` — um campo
  novo (ex. `link_diretorio`) é gravável por essa MESMA função, sem porta de escrita
  nova.

### Quebra recomendada (a confirmar/ajustar quando o ponto 2 for respondido)

| # | Atividade | Arquivo(s) | Modelo/Esforço | Status |
|---|---|---|---|---|
| 5.1 | **[humano]** José responde o ponto 2 (link fixo por canal ou por ciclo/oficina) | — | José | ⏳ não iniciado — bloqueia os demais |
| 5.2 | Migração SQL: `ALTER meta_inovacao_canais` (+ 1 coluna, se ponto 2 = fixo) OU tabela nova canal×ciclo (se ponto 2 = variável), idempotente, seguindo `tools/sql/PADRAO_TABELA.md` | `tools/sql/2026-08_canais_link_diretorio.sql` (novo) | Sonnet / médio | ⏳ não iniciado |
| 5.3 | **[humano]** Rodar a migração no SQL Editor | — | José | ⏳ não iniciado |
| 5.4 | Reescrever `apresentacao_canais.html` como lista (não mais slideshow), carregada via `DB_CANAIS.carregar()`, ordenada por `ordem`; cada linha = nome do canal + caixa de texto pro link, gravando via `DB_CANAIS.salvar()` | `apresentacao_canais.html` | Sonnet / médio-alto — redesenho completo de 1 tela | ⏳ não iniciado |
| 5.5 | Testes: adaptar/checar `tools/validar_site.py` (a página muda de estrutura) + teste headless novo se fizer sentido | `apresentacao_canais.html`, testes | Sonnet / baixo | ⏳ não iniciado |
| 5.6 | **[humano]** José confere em produção | — | José | ⏳ não iniciado |

---

## Status por item — resumo pra retomar em sessão nova

Se você está começando uma sessão nova pra continuar este trabalho, isto é o que
precisa saber sem reler tudo acima:

1. **Itens 1, 2 e 4 estão 100% em produção**, mesclados via
   [PR #19](https://github.com/juniorapt-source/meta-inovacao-2026/pull/19),
   [PR #20](https://github.com/juniorapt-source/meta-inovacao-2026/pull/20) e
   [PR #21](https://github.com/juniorapt-source/meta-inovacao-2026/pull/21). Não
   precisam de mais trabalho.
2. **Item 3 foi implementado duas vezes (PRs #20 e #21) e REABERTO em 27/08/2026** —
   José quer um modelo diferente (checklist multi-seleção, não "trocar de um projeto
   pro outro"). O redesenho está **em andamento na branch
   `claude/plano-execucao-item-3-8-mtsarn`, fora da `main`**: 3.1 a 3.8 feitos — o
   núcleo (3.3+3.4, a reescrita de `let caderno` → `Map` de cadernos + fábrica de
   bloco por projeto), a limpeza do código morto (3.7) e os dois testes headless
   (3.8: `tools/testar_canva_oficina.js` adaptado + `tools/testar_canva_multiprojeto_headless.js`
   novo) todos verdes. **Falta só 3.9 (José testa em produção).** Antes de mexer em
   `canva.html`, leia a seção "O que a reescrita 3.3/3.4 mudou" — ela lista os ids que
   deixaram de existir e as três correções que o multiprojeto obrigou em
   `js/db-canva.js`. O merge com a `main` é UM só, depois do José validar em produção.
3. **Item 5 tem 1 de 2 decisões tomadas** (descartar a apresentação atual) — falta só
   a segunda (link fixo por canal vs. variável por ciclo) antes de começar qualquer
   código. Não inicie o 5.2 em diante sem essa resposta.
4. Nenhum item desta frente depende de nenhum item do golden record
   (`PLANO_EXECUCAO_GOLDEN_RECORD.md`) — são frentes irmãs, independentes, mas ambas
   tocam `js/db-canais.js`/`meta_inovacao_canais` (item 5 aqui, Camada 0 lá) — conferir
   se o golden record já não fechou algo relevante antes de desenhar a migração do 5.2.
5. Toda migração SQL é rodada manualmente por José no SQL Editor do Supabase —
   nenhuma automação tem acesso de escrita à produção (mesma regra do golden record).
