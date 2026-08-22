# PLANO DE EXECUÇÃO — Golden record de cadastros de referência

**Regime: pré-autorizado, camada por camada.** Cada camada só começa depois da
anterior estar rodando em produção e validada — mesmo espírito do
`PLANO_EXECUCAO.md` original: teste de aceite manda, protocolo de ajuste corrige,
nada trava o conjunto inteiro por um item.

Fonte do desenho: `meta-monitor/docs/PROPOSTA_ESQUEMA_CADASTROS_REFERENCIA.md`
(esquema completo, decisões já fechadas) e o diagrama publicado em
`https://claude.ai/code/artifact/883d85fb-304d-4ad0-9130-07bfa8f90c9c`. Este
documento não redesenha nada — só quebra a implementação em atividades executáveis.

## Legenda — modelo e esforço por atividade

| Modelo | Quando usar aqui |
|---|---|
| **Haiku** | Cópia de um padrão já existente quase à risca — wrapper JS espelhando um arquivo irmão, atualização de changelog/comentário. Baixa ambiguidade, baixo custo de errar. |
| **Sonnet** | A maioria do pacote — migração SQL seguindo `PADRAO_TABELA.md`, popular FK a partir de texto existente, telas que já têm precedente direto no projeto (a Camada 2 do golden record de *projetos* já fez isso uma vez). |
| **Opus** | As duas atividades de maior risco/ineditismo: reescrever a grade da matriz de demandas (maior tela do site, sai de "colunas fixas" pra "grade dinâmica") e a auditoria final de ponta a ponta. |

| Esforço | Quando usar |
|---|---|
| **baixo** | Mudança pequena e contida, um arquivo, padrão já resolvido antes. |
| **médio** | Várias partes móveis, mas caminho conhecido (padrão documentado ou já feito uma vez no projeto). |
| **alto** | Mexe em lógica de dado e de tela ao mesmo tempo, ou stakes altos (tabela golden, dedupe, resolução de alias). |
| **xhigh** | Reservado pra Camada 3 (reescrita da matriz) e pra auditoria final — vale revisão adversarial, não só uma passada. |

Atividades marcadas **[humano]** não são tarefa de modelo — são decisão ou execução
que só José faz (rodar SQL no dashboard do Supabase, confirmar uma lista de dedupe).
Nenhuma migração roda sozinha contra o Supabase de produção; todo `tools/sql/*.sql`
gerado é pra rodar manualmente no SQL Editor, como já é o padrão do projeto.

---

## Camada 0 — Catálogos-base

> **Status: concluída (inferido)** — não confirmado independentemente aqui, mas a
> Camada 1 (abaixo) já usa seletor de núcleo em `editor.html`, o que depende desta
> camada ter rodado antes.

| # | Atividade | Arquivo(s) | Modelo | Esforço |
|---|---|---|---|---|
| 0.1 | Migração SQL `meta_inovacao_nucleos` (tabela + RLS + trigger + seed dos 5 núcleos) | `tools/sql/2026-XX_nucleos.sql` | Sonnet | médio |
| 0.2 | Migração SQL `meta_inovacao_canais` (unifica `data/canais.js` + `CANAIS_URC`, 10 canais) | `tools/sql/2026-XX_canais.sql` | Sonnet | médio |
| 0.3 | Migração SQL `meta_inovacao_coletivos` (seed: Comitê, URC, Coordenadores, Gestores dos projetos, Soluções) | `tools/sql/2026-XX_coletivos.sql` | Sonnet | baixo |
| 0.4 | **[humano]** Rodar as 3 migrações no SQL Editor, conferir contagens e RLS ativa | — | José | — |
| 0.5 | `js/db-nucleos.js`, `js/db-canais.js`, `js/db-coletivos.js`, espelhando `js/db-projetos.js` | `js/db-*.js` | Haiku | baixo |

**Teste de aceite:** as 3 tabelas existem com RLS ativa; contagens batem (5/10/5); os
3 wrappers carregam sem erro (`node`, mesmo padrão de `tools/testar_calc.js`).

---

## Camada 1 — Golden record de pessoas

> **Status: concluída e pushada (22/08/2026).** `js/db-pessoas.js` + novo
> `js/db-pessoa-papeis.js` lendo/gravando os campos novos; aba "Pessoas" do
> `editor.html` com seletor de núcleo; `data/pessoas.js` ressincronizado (47 pessoas
> em produção). No caminho, um bug de card duplicado em `participantes.html` (grupos
> "Projetos"/"URC" novos) foi pego e corrigido antes de virar regressão, e o teste
> que deveria ter pegado isso foi ajustado (se autovalidava contra o próprio bug).
> Suíte rodada (roundtrip, participantes, busca, dashboard, iniciativas cruzadas,
> validador Python) verde; `testar_drawer_headless.js` falha, mas **já falhava antes
> desta frente** — não é regressão da Camada 1, só não foi corrigido aqui (relevante
> pra Camada 4, que também mexe em `js/drawer.js`).
>
> **Fora de escopo desta rodada, não bloqueia nada:** UI dedicada em `editor.html`
> pra gerenciar múltiplos papéis por pessoa (adicionar/remover linha em
> `pessoa_papeis`) — as linhas já gravadas estão corretas, só sem tela própria ainda.
>
> **Atenção pra Camada 2:** ficaram ~15 nomes em aberto (dados incompletos,
> preenchíveis pela nova aba "Pessoas"). Não bloqueia começar a Camada 2, mas os
> itens 2.2 e 2.6 resolvem texto livre contra o golden record por nome — quanto mais
> desses 15 estiverem completos antes, menos `NULL` o relatório de 2.9 mostra depois.

| # | Atividade | Arquivo(s) | Modelo | Esforço |
|---|---|---|---|---|
| 1.1 | Levantar a lista de dedupe das ~40 pessoas (cruzar as 4 fontes, aplicar os aliases já existentes em `js/responsaveis.js`, sinalizar todo caso ambíguo em vez de decidir sozinho) | relatório novo | Sonnet | alto |
| 1.2 | **[humano]** José confirma/corrige a lista de dedupe | — | José | — |
| 1.3 | Migração SQL: `ALTER meta_inovacao_pessoas` (+ `nome_completo`, `nome_exibicao`, `email`, `ativo`) + `CREATE meta_inovacao_pessoa_papeis` + seed da lista confirmada em 1.2 | `tools/sql/2026-XX_pessoas_golden.sql` | Sonnet | alto |
| 1.4 | **[humano]** Rodar no SQL Editor, conferir contagem = lista confirmada | — | José | — |
| 1.5 | `js/db-pessoas.js` pro novo formato (pessoa + papéis) | `js/db-pessoas.js` | Sonnet | médio |
| 1.6 | Aba "Pessoas" do `editor.html`: CRUD de pessoa + papéis, seletor de núcleo | `editor.html` | Sonnet | médio |

**Teste de aceite:** contagem de pessoas = lista confirmada em 1.2; toda pessoa tem
pelo menos 1 papel; aba "Pessoas" cria/edita/soft-deleta sem erro (mesmo padrão de
`tools/testar_participantes_headless.js`).

---

## Camada 2 — FK pontual, convivendo com o texto

| # | Atividade | Arquivo(s) | Modelo | Esforço |
|---|---|---|---|---|
| 2.1 | `ALTER meta_inovacao_projetos` (+ `nucleo_id`), popular a partir do texto | sql | Sonnet | médio |
| 2.2 | `CREATE meta_inovacao_projeto_representantes`, popular de `representantes[]` (resolver pelos aliases) | sql | Sonnet | alto |
| 2.3 | `ALTER meta_inovacao_urc_lideranca` (+ `pessoa_id`), popular | sql | Sonnet | baixo |
| 2.4 | Evoluir `meta_inovacao_urc_canais_responsaveis` (+ `canal_id`, + `pessoa_id`), popular | sql | Sonnet | médio |
| 2.5 | `ALTER meta_inovacao_canva_demandas` (+ 4 FK: núcleo, canal, facilitador, responsável), popular | sql | Sonnet | médio |
| 2.6 | `CREATE meta_inovacao_plano_responsaveis`, popular de `responsavel_id[]` (separar pessoa de coletivo) | sql | Sonnet | alto |
| 2.7 | `ALTER corsario_status` (+ `projeto_id`, + `nucleo_id`), popular, checar a linha órfã do 27×28 | sql | Sonnet | médio |
| 2.8 | **[humano]** Rodar as 7 migrações | — | José | — |
| 2.9 | Auditoria de cobertura: % de FK que ficou `NULL` por tabela, relatório pra decidir o que resolver na mão | script node | Sonnet | médio |

**Teste de aceite:** relatório de cobertura existe e foi visto por José — não precisa
ser 100%, mas precisa estar visível (mesmo espírito de "sinalizar discrepância, não
esconder" do golden record de projetos).

---

## Camada 3 — Normalizar a matriz de demandas (maior risco do pacote)

> **Status: 3.1 e 3.2 em produção (22/08/2026); 3.3/3.4/3.5 abertos.**
> `demandas.html` monta a grade em runtime: linhas = `meta_inovacao_projetos`, colunas =
> `meta_inovacao_canais` na ordem de `ordem`, células = `meta_inovacao_matriz_celulas`
> (`js/matriz-store.js` reescrito). Célula ausente = célula vazia; a escrita é um
> **upsert no par `(projeto_id, canal_id)`** — não um update por id de linha — pra duas
> pessoas na mesma célula ao mesmo tempo não virarem `23505`.
>
> **O teste de aceite virou parte da tela.** `demandas.html` lê também a tabela ANTIGA
> (só leitura) e mostra um painel "Conferência com a tabela antiga" com a comparação
> célula a célula, aberto durante toda a janela do item 3.5. Fora do navegador, o mesmo
> retrato sai em `node tools/conferir_matriz_celulas.js` (lê produção, não escreve nada).
>
> **A tabela antiga congela na virada.** Não há escrita dupla: `meta_inovacao_matriz_demandas`
> fica exatamente como a migração do 3.1 a deixou, servindo de rede de rollback e de base
> de comparação. Consequência a ter em mente no 3.5: toda edição feita na grade nova depois
> da virada aparece como divergência no painel — isso é o esperado; divergência que
> ninguém reconhece como edição própria é que é sinal de erro de migração. Se em algum
> momento fizer mais sentido manter as duas tabelas vivas de verdade (escrita dupla), é
> uma decisão nova, não algo que o 3.2 tenha deixado pela metade.
>
> **`tools/sql/2026-08_matriz_celulas.sql` estava faltando no repositório** — a migração
> do 3.1 tinha rodado em produção mas o arquivo nunca foi commitado, então não havia como
> recriar a tabela nem conferir o schema. Reconstruído aqui, idempotente, e **executado de
> ponta a ponta num Postgres 16 local** com os dados reais de `data/projetos.js`/
> `data/matriz.js`: migra 67 células, roda 2× sem duplicar, conferência célula a célula dá
> 270 conferem / 0 divergem. As policies também foram exercitadas com `SET ROLE anon`: os
> dois caminhos do upsert (INSERT e ON CONFLICT DO UPDATE) passam com o `x-cc-token` certo
> e são recusados sem ele. Rodar no SQL Editor é seguro (não sobrescreve edição feita
> depois da virada), mas **só é necessário se o schema em produção divergir do arquivo** —
> e quem responde isso é `tools/sql/2026-08_matriz_celulas_diagnostico.sql` (só leitura,
> 17 checagens com veredito, roda no SQL Editor).
>
> **Correção de rota achada no caminho:** o `<select>` da Matriz oferecia 9 estados, mas o
> `CHECK` da tabela (antiga e nova) só aceita 7 — escolher "Oficina confirmada" ou "Não se
> aplica o uso" sempre falhou no salvar, em silêncio, desde a v0.7.0 (confirmado contra o
> Postgres local: `violates check constraint`). O `<select>` agora oferece só os 7 que o
> banco aceita. Pra reabilitar os outros dois, entram primeiro no `CHECK`, depois na lista
> de `js/matriz-store.js` — nessa ordem. `js/status.js` e `css/base.css` mantêm os 9, que
> continuam servindo pra EXIBIR um valor herdado, se algum dia existir.
>
> **Pendências conhecidas, não bloqueantes:** (a) `meta_inovacao_matriz_celulas` pode não
> estar na publicação `supabase_realtime` — sem isso a grade não se atualiza sozinha quando
> outra pessoa edita (a página funciona igual, só sem o "atualizado por … agora"). A
> checagem 16 do diagnóstico diz se está ou não; o bloco 5 do SQL da migração adiciona. (b) a aba "matriz" do `editor.html` continua no snapshot antigo — é o
> item 3.3, de propósito.

| # | Atividade | Arquivo(s) | Modelo | Esforço |
|---|---|---|---|---|
| 3.1 | Migração SQL: `CREATE meta_inovacao_matriz_celulas` + migrar as 10 colunas fixas pra linhas (tabela antiga continua viva em paralelo) | sql | Sonnet | alto |
| 3.2 | Reescrever `demandas.html`: grade dinâmica a partir de `meta_inovacao_canais` × `meta_inovacao_projetos`, ler/gravar em `matriz_celulas` | `demandas.html` | **Opus** | **xhigh** |
| 3.3 | Ajustar a aba "matriz" do `editor.html` (hoje é `snapshot:true`) | `editor.html` | Sonnet | baixo |
| 3.4 | Testes headless da nova grade — `tools/testar_matriz_headless.js` **já existe e está verde** (adiantado no 3.2, 11 cenários); sobra aqui o que o 3.3 mexer no `editor.html` | tools | Sonnet | baixo |
| 3.5 | **[humano]** Validar em produção por um tempo, comparando com a tabela antiga, antes de aposentá-la | — | José | — |

**Teste de aceite:** grade nova mostra os mesmos estados que a tabela antiga, célula a
célula; cadastrar um canal novo em `meta_inovacao_canais` faz a coluna aparecer sem
deploy nem `ALTER TABLE`.

---

## Camada 4 — Telas migram pra seletor

| # | Atividade | Arquivo(s) | Modelo | Esforço |
|---|---|---|---|---|
| 4.1 | `editor.html` "Projetos & Representantes": campo vira seletor de pessoa | `editor.html` | Sonnet | médio |
| 4.2 | `editor.html` "URC — Liderança" / "URC — Responsáveis por canal": seletor de pessoa/canal | `editor.html` | Sonnet | médio |
| 4.3 | `plano-acao.html` / `minhas-acoes.html`: select de responsável lê pessoas + coletivos, aposenta parsing de `js/responsaveis.js` | `plano-acao.html`, `minhas-acoes.html` | Sonnet | alto |
| 4.4 | `participantes.html` / `js/drawer.js`: exibição via join, não mais array de string | `participantes.html`, `js/drawer.js` | Sonnet | médio |

**Teste de aceite:** nenhuma das 4 telas tem mais campo de texto livre pra nome de
pessoa; os testes headless existentes (`testar_participantes_headless.js`,
`testar_drawer_headless.js`, `testar_minhas_acoes_headless.js`) continuam verdes.

---

## Camada 5 — Aposentar texto livre

| # | Atividade | Arquivo(s) | Modelo | Esforço |
|---|---|---|---|---|
| 5.1 | Auditoria final: confirmar cobertura de FK das Camadas 2 e 4, ponta a ponta | script | **Opus** | alto |
| 5.2 | **[humano]** Decidir, tabela a tabela, se dropa a coluna de texto ou mantém como cache | — | José | — |
| 5.3 | Migrações de `DROP COLUMN` onde decidido em 5.2 | sql | Sonnet | baixo |
| 5.4 | Atualizar `PADRAO_TABELA.md`/`GOVERNANCA_GOLDEN_RECORD.md` com o novo estado; aposentar `js/responsaveis.js` se não sobrar uso | docs, js | Haiku | baixo |

**Teste de aceite:** suíte de testes headless inteira verde; nenhuma tela lê mais
coluna de texto que foi dropada em 5.3.

---

## Protocolo de ajuste (mesmo do `PLANO_EXECUCAO.md` original)

1. Teste de aceite da camada falhou → registrar a causa (num `BUILD_STATUS.md` novo
   pra esta frente, ou anexado ao existente).
2. Corrigir. Reexecutar o teste (máx. 3 tentativas).
3. Persistindo, isolar o item, registrar como pendência e **seguir com o resto da
   camada** — uma atividade travada não trava a camada inteira, e uma camada
   travada não trava as anteriores (que já estão em produção).

## Ordem — por que não pular camada

Camada 3 (matriz) é deliberadamente a mais tardia entre as mudanças de dado, não a
primeira: é a de maior ineditismo técnico (única tabela redesenhada, não só
FK nova) e mexe na tela mais usada do site. Rodar as Camadas 0–2 primeiro dá o
golden record de pessoas/núcleos/canais já estável — inclusive testável — antes de
arriscar a peça mais delicada.
