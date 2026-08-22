# PLANO DE EXECUÇÃO — Golden record de cadastros de referência

**Regime: pré-autorizado, camada por camada.** Cada camada só começa depois da
anterior estar rodando em produção e validada — mesmo espírito do
`PLANO_EXECUCAO.md` original: teste de aceite manda, protocolo de ajuste corrige,
nada trava o conjunto inteiro por um item.

Fonte do desenho: `meta-monitor/docs/PROPOSTA_ESQUEMA_CADASTROS_REFERENCIA.md`
(esquema completo, decisões já fechadas) e o diagrama publicado em
`https://claude.ai/code/artifact/883d85fb-304d-4ad0-9130-07bfa8f90c9c`. Este
documento não redesenha nada — só quebra a implementação em atividades executáveis.

> **STATUS GERAL (atualizado 22/08/2026): Camadas 0, 1 e 2 concluídas e
> verificadas em produção; Camada 3 em andamento — 3.1, 3.2 e 3.4 já em `main` e
> validados, faltam o 3.3 (tem um aviso a ler antes de começar) e o 3.5 (validação
> humana, em curso).** Camadas 4 e 5 ainda não iniciadas. Se você está
> retomando este trabalho numa sessão nova: leia a seção "Status por camada"
> abaixo primeiro — ela lista exatamente o que já existe no banco e no
> repositório, pra não repetir trabalho nem presumir algo que ainda não foi
> feito. Os relatórios/decisões de cada camada ficam em arquivos próprios,
> linkados nas seções abaixo.

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

## Camada 0 — Catálogos-base — ✅ CONCLUÍDA (22/08/2026)

| # | Atividade | Arquivo(s) | Status |
|---|---|---|---|
| 0.1 | Migração SQL `meta_inovacao_nucleos` (tabela + RLS + trigger + seed dos 5 núcleos) | `tools/sql/2026-08_nucleos.sql` | ✅ rodada em produção |
| 0.2 | Migração SQL `meta_inovacao_canais` (unifica `data/canais.js` + `CANAIS_URC`, 10 canais) | `tools/sql/2026-08_canais.sql` | ✅ rodada em produção |
| 0.3 | Migração SQL `meta_inovacao_coletivos` (seed: Comitê, URC, Coordenadores, Gestores dos projetos, Soluções) | `tools/sql/2026-08_coletivos.sql` | ✅ rodada em produção |
| 0.4 | **[humano]** Rodar as 3 migrações no SQL Editor, conferir contagens e RLS ativa | — | ✅ feito por José |
| 0.5 | `js/db-nucleos.js`, `js/db-canais.js`, `js/db-coletivos.js`, espelhando `js/db-projetos.js` | `js/db-*.js` | ✅ criados e testados (`tools/testar_catalogos_base.js`) |

**Teste de aceite:** ✅ passou — 3 tabelas com RLS ativa; contagens 5/10/5; wrappers
carregam sem erro.

---

## Camada 1 — Golden record de pessoas — ✅ CONCLUÍDA (22/08/2026)

| # | Atividade | Arquivo(s) | Status |
|---|---|---|---|
| 1.1 | Levantar a lista de dedupe das ~40 pessoas | `docs/CAMADA1_DEDUPE_PESSOAS.md` | ✅ relatório pronto |
| 1.2 | **[humano]** José confirma/corrige a lista de dedupe | — | ✅ confirmado 22/08 — ver decisões abaixo |
| 1.3 | Migração SQL: `ALTER meta_inovacao_pessoas` + `CREATE meta_inovacao_pessoa_papeis` + seed | `tools/sql/2026-08_pessoas_golden.sql`, `tools/sql/2026-08_coletivos_gerencia_ui.sql` | ✅ rodadas em produção |
| 1.4 | **[humano]** Rodar no SQL Editor, conferir contagem | — | ✅ feito por José (47 pessoas, 18 papéis) |
| 1.5 | `js/db-pessoas.js` pro novo formato (pessoa + papéis) | `js/db-pessoas.js`, `js/db-pessoa-papeis.js` (novo) | ✅ feito |
| 1.6 | Aba "Pessoas" do `editor.html`: campos novos + seletor de núcleo | `editor.html` | ✅ feito (CRUD de papéis multi-linha por pessoa ficou de fora — nota abaixo) |

**Decisões de dedupe fechadas por José (22/08/2026)** — ver
`docs/CAMADA1_DEDUPE_PESSOAS.md` pro relatório completo:
- **Sandra (UI) = Sandra Chaves Silva Paraíso (núcleo)** — mesma pessoa, 3 papéis
  (UI + Comitê + núcleo Gestão do Conhecimento e Processos).
- **JR. = José Mendes de Oliveira Júnior** — mesma pessoa, 2 papéis (coordenação
  UI + núcleo Inovação para Competitividade). Importante: isso contraria o que
  `js/responsaveis.js.ALIASES` assumia (tratava como 2 pessoas) — os ids `jr` e
  `jose_mendes_junior`/`junior` de `window.DB.responsaveis` continuam separados
  de propósito (decisão de UX adiada pra Camada 4), mas resolvem pro MESMO
  `pessoa_id` nas tabelas novas.
- **Filipe Medeiros Ferreira (URC/CNR) ≠ Felipe (Inova Biomas)** — confirmado
  como pessoas diferentes. Felipe (Inova Biomas) tem nome completo: **Philippe
  Fauguet Figueiredo**.
- **"Pova" não é agente de IA — é pessoa física: Gabriel Silva Povoa.**
- **"Gerência UI"** não é pessoa física (papel institucional) — vira linha em
  `meta_inovacao_coletivos`.
- **15 pessoas ficaram com `nome_completo` em aberto** (só primeiro nome
  conhecido) — decisão de José: deixar assim, ele edita depois direto no site
  (aba "Pessoas" do `editor.html`, campo "Nome completo").

**Pendência conhecida, não bloqueante:** não existe ainda uma UI em
`editor.html` pra gerenciar múltiplos papéis por pessoa (adicionar/remover
linha em `meta_inovacao_pessoa_papeis`) — as 18 linhas já gravadas no item 1.3
estão corretas, só não têm tela própria de edição ainda. Se for necessário
antes da Camada 4, é um item novo, não coberto por este plano original.

**Teste de aceite:** ✅ passou.

---

## Camada 2 — FK pontual, convivendo com o texto — ✅ CONCLUÍDA (22/08/2026)

| # | Atividade | Arquivo(s) | Status | Cobertura real |
|---|---|---|---|---|
| 2.1 | `ALTER meta_inovacao_projetos` (+ `nucleo_id`), popular | `tools/sql/2026-08_projetos_nucleo_id.sql` | ✅ | 28/28 |
| 2.3 | `ALTER meta_inovacao_urc_lideranca` (+ `pessoa_id`), popular | `tools/sql/2026-08_urc_lideranca_pessoa_id.sql` | ✅ | 3/3 |
| 2.4 | Evoluir `meta_inovacao_urc_canais_responsaveis` (+ `canal_id`, `pessoa_id`), popular | `tools/sql/2026-08_urc_canais_fk.sql` | ✅ | 11/11 nos dois FKs |
| 2.7 | `ALTER corsario_status` (+ `projeto_id`, `nucleo_id`), popular | `tools/sql/2026-08_corsario_status_fk.sql` | ✅ | 27/27, zero órfãos |
| 2.2 | `CREATE meta_inovacao_projeto_representantes`, popular (resolução de alias) | `tools/sql/2026-08_projeto_representantes.sql` | ✅ | 34/35 |
| 2.6 | `CREATE meta_inovacao_plano_responsaveis`, popular (resolução de alias) | `tools/sql/2026-08_plano_responsaveis.sql` | ✅ | 61/61 |
| 2.8 | **[humano]** Rodar as 6 migrações | — | ✅ feito por José, uma por uma, cada uma conferida antes da próxima |
| 2.9 | Auditoria de cobertura: relatório de % de FK NULL por tabela | `docs/CAMADA2_COBERTURA_FK.md`, `tools/relatorio_cobertura_fk.js` | ✅ relatório com números reais de produção |

**Único "faltando" esperado (não é problema):** `Sebrae Startups` →
representante `"Núcleo de Startups"` (placeholder de "aguarda indicação
nominal") não vira vínculo em `meta_inovacao_projeto_representantes` — já
investigado e documentado como não-órfão (`GOVERNANCA_GOLDEN_RECORD.md`,
Camada 4 de outra frente).

**Descobertas ao rodar em produção** (dado tinha mudado desde os testes
locais, ambas absorvidas sem tocar nos scripts — resolução é por texto, não
lista fixa): o portfólio cresceu pra 28 projetos ("Startup Summit" novo) e
"Consult" trocou de representante. Ver `docs/CAMADA2_COBERTURA_FK.md` pros
detalhes completos.

**Teste de aceite:** ✅ passou — relatório de cobertura existe, visto por José.

---

## Camada 3 — Normalizar a matriz de demandas (maior risco do pacote) — ⏳ EM ANDAMENTO (3.1, 3.2 e 3.4 concluídos)

| # | Atividade | Arquivo(s) | Status |
|---|---|---|---|
| 3.1 | Migração SQL: `CREATE meta_inovacao_matriz_celulas` + migrar as 10 colunas fixas pra linhas (tabela antiga continua viva em paralelo) | `tools/sql/2026-08_matriz_celulas.sql` | ✅ rodada em produção — 32 células migradas, 32 = 32 conferido linha a linha, zero órfãs |
| 3.2 | Reescrever `demandas.html`: grade dinâmica a partir de `meta_inovacao_canais` × `meta_inovacao_projetos`, ler/gravar em `matriz_celulas` | `demandas.html`, `js/matriz-store.js` | ✅ em main — schema real conferido 16/16 no diagnóstico, RLS e upsert testados contra o schema de produção, suíte verde |
| 3.3 | Ajustar a aba "matriz" do `editor.html` (hoje é `snapshot:true`) | `editor.html` | ⏳ **não iniciado — LEIA O AVISO ABAIXO ANTES DE COMEÇAR** |
| 3.4 | Testes headless da nova grade | `tools/testar_matriz_headless.js` | ✅ veio junto no 3.2 — 11 cenários, verde |
| 3.5 | **[humano]** Validar em produção por um tempo, comparando com a tabela antiga, antes de aposentá-la | — | ⏳ em andamento por José |

**Teste de aceite:** ✅ passou nas duas metades — a grade nova mostra os mesmos estados
que a tabela antiga célula a célula (conferência automática, ver abaixo), e cadastrar um
canal novo em `meta_inovacao_canais` faz a coluna aparecer sem deploy nem `ALTER TABLE`
(coberto por cenário do `tools/testar_matriz_headless.js`).

### ⚠️ Antes de executar o 3.3 — a pegadinha do snapshot

A aba "matriz" do `editor.html` é `snapshot:true` e serve pra gerar `data/matriz.js`.
Esse arquivo **não é decorativo**: é o *fallback offline* da `demandas.html`. Quando o
Supabase não responde, é dele que a Matriz inteira é montada.

O formato é `{ iniciativa: { slug_do_canal: estado } }` — indexado por **slug de canal**,
não por `canal_id`. A `demandas.html` continua exportando exatamente nesse formato (botão
"Exportar matriz"), de propósito, mesmo agora que ela lê por id.

**Se o 3.3 mudar o formato do snapshot, quebra duas coisas de uma vez:**

1. o modo offline da `demandas.html` (a grade aparece vazia sem rede — e ninguém percebe
   até o dia em que o Supabase cair);
2. o `tools/testar_status_badges_headless.js`, que conta 270 badges (27 iniciativas × 10
   canais) vindos justamente desse arquivo.

Então: ou o 3.3 **mantém o formato** de `data/matriz.js` intacto, ou muda os três lugares
juntos — snapshot, `seedLocal()` de `js/matriz-store.js` e `seedCelulas()` da
`demandas.html`. Rodar `node tools/testar_matriz_headless.js` (cenário "offline") e
`node tools/testar_status_badges_headless.js` fecha a conta nos dois casos.

### Como está a validação do 3.5

`demandas.html` tem um painel **"Conferência com a tabela antiga"** que compara célula a
célula, ao vivo, e se atualiza a cada edição. O mesmo retrato sai por fora com
`node tools/conferir_matriz_celulas.js`.

A tabela antiga **congelou na virada do 3.2** — não recebe mais escrita. Logo, toda edição
feita na grade nova a partir de agora aparece como divergência, e isso é o esperado.
Divergência que ninguém reconhece como edição própria é que é sinal de erro de migração.

Estado do banco (schema, RLS, publicação `supabase_realtime`, conferência) se checa com
`tools/sql/2026-08_matriz_celulas_diagnostico.sql` — só leitura, 17 checagens com veredito.
**O `ALTER PUBLICATION` do realtime não está na migração** (foi passo manual em produção):
um ambiente recriado só pelo `.sql` nasce sem realtime, e é a checagem 16 que denuncia.

**Pendência de decisão (não bloqueia nada):** "Oficina confirmada" e "Não se aplica o uso"
existem em `js/status.js`/`css/base.css` desde a v0.7.0 mas **nunca** estiveram no `CHECK`
da tabela — escolher esses valores sempre falhou no salvar, em silêncio. O `<select>` agora
oferece só os 7 que o banco aceita. Pra reabilitar: primeiro `ALTER` no `CHECK`, depois a
lista `ESTADOS` de `js/matriz-store.js` — nessa ordem.

---

## Camada 4 — Telas migram pra seletor — ⏳ NÃO INICIADA

| # | Atividade | Arquivo(s) | Modelo | Esforço |
|---|---|---|---|---|
| 4.1 | `editor.html` "Projetos & Representantes": campo vira seletor de pessoa | `editor.html` | Sonnet | médio |
| 4.2 | `editor.html` "URC — Liderança" / "URC — Responsáveis por canal": seletor de pessoa/canal | `editor.html` | Sonnet | médio |
| 4.3 | `plano-acao.html` / `minhas-acoes.html`: select de responsável lê pessoas + coletivos, aposenta parsing de `js/responsaveis.js` | `plano-acao.html`, `minhas-acoes.html` | Sonnet | alto |
| 4.4 | `participantes.html` / `js/drawer.js`: exibição via join, não mais array de string | `participantes.html`, `js/drawer.js` | Sonnet | médio |

**Nota pra quando chegar aqui:** este é o momento certo de decidir a UX dos
ids duplicados `jr`/`jose_mendes_junior` e `sandra`/`sandra_chaves_paraiso` em
`window.DB.responsaveis` (ver Camada 1 acima) — hoje resolvem pro mesmo
`pessoa_id`, mas a lista ainda mostra 2 entradas pro mesmo humano.

**Teste de aceite:** nenhuma das 4 telas tem mais campo de texto livre pra nome de
pessoa; os testes headless existentes (`testar_participantes_headless.js`,
`testar_drawer_headless.js`, `testar_minhas_acoes_headless.js`) continuam verdes.

---

## Camada 5 — Aposentar texto livre — ⏳ NÃO INICIADA

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

---

## Status por camada — resumo pra retomar em sessão nova

Se você está começando uma sessão nova pra continuar este trabalho, isto é o
que precisa saber sem reler tudo acima:

1. **Camadas 0, 1 e 2 estão 100% em produção**, testadas e confirmadas linha a
   linha por José no SQL Editor. Todos os scripts SQL estão em
   `meta-monitor/tools/sql/2026-08_*.sql` (nomes descritivos, ver tabelas
   acima). Não precisam rodar de novo.
2. **Próximo passo pendente: Camada 3** (normalizar a matriz de demandas) —
   ainda não começou. É a mais arriscada do pacote inteiro (reescreve
   `demandas.html`, a maior tela do site).
3. Documentos de apoio já existentes, não precisam ser refeitos:
   - `docs/CAMADA1_DEDUPE_PESSOAS.md` — decisões de identidade de pessoas.
   - `docs/CAMADA2_COBERTURA_FK.md` — cobertura real de cada FK da Camada 2.
   - `docs/PROPOSTA_ESQUEMA_CADASTROS_REFERENCIA.md` — desenho original
     completo (todas as decisões de schema já fechadas).
   - `docs/GOVERNANCA_GOLDEN_RECORD.md` — governança do golden record de
     *projetos* (frente irmã, já concluída antes desta).
4. **Pendência não bloqueante:** falta UI em `editor.html` pra CRUD completo
   de `meta_inovacao_pessoa_papeis` (múltiplos papéis por pessoa) — mencionada
   na Camada 1 acima.
5. **Toda migração SQL é rodada manualmente por José no SQL Editor do
   Supabase** — nenhuma automação tem acesso de escrita à produção. O
   ambiente de desenvolvimento (sessões do Claude Code aqui) também não
   consegue LER o Supabase de produção (rede bloqueada pra `supabase.co`) —
   todo teste de migração é feito num Postgres local simulando o estado de
   produção antes de entregar o script pra José rodar de verdade.
