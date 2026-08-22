# PLANO DE EXECUÇÃO — Golden record de cadastros de referência

**Regime: pré-autorizado, camada por camada.** Cada camada só começa depois da
anterior estar rodando em produção e validada — mesmo espírito do
`PLANO_EXECUCAO.md` original: teste de aceite manda, protocolo de ajuste corrige,
nada trava o conjunto inteiro por um item.

Fonte do desenho: `meta-monitor/docs/PROPOSTA_ESQUEMA_CADASTROS_REFERENCIA.md`
(esquema completo, decisões já fechadas) e o diagrama publicado em
`https://claude.ai/code/artifact/883d85fb-304d-4ad0-9130-07bfa8f90c9c`. Este
documento não redesenha nada — só quebra a implementação em atividades executáveis.

> **ESTE É O ÚNICO PLANO DESTA FRENTE.** Até 22/08/2026 existiam duas cópias — esta e
> `PLANO_EXECUCAO_GOLDEN_RECORD já em execução.md`, na raiz do repositório. Em menos de
> um dia elas divergiram: a da raiz tinha tabelas de status ricas nas Camadas 0–2 mas
> dizia que a Camada 3 não tinha começado (quando 3.1 já estava em produção); esta tinha
> a Camada 3 em dia mas nenhum status nas Camadas 0–2. As duas foram fundidas aqui e a
> da raiz foi apagada. **Não recrie a segunda cópia** — se precisar de uma visão de
> acompanhamento, ela mora neste arquivo, na seção "Status por camada" no fim.

> **STATUS GERAL (atualizado 22/08/2026): Camadas 0 e 1 concluídas e verificadas em
> produção; Camada 2 concluída com o item 2.5 em aberto (ver abaixo — não é bloqueio, é
> escopo que ficou de fora sem registro); Camada 3 em andamento — 3.1, 3.2 e 3.4 já em
> `main` e validados, faltam o 3.3 (tem um aviso a ler antes de começar) e o 3.5
> (validação humana, em curso).** Camadas 4 e 5 ainda não iniciadas. Se você está
> retomando este trabalho numa sessão nova: leia a seção "Status por camada" no fim
> primeiro — ela lista o que já existe no banco e no repositório, pra não repetir
> trabalho nem presumir algo que ainda não foi feito.

**Como ler as tabelas:** camada já executada tem coluna **Status** (o que de fato
aconteceu); camada ainda não executada mantém **Modelo/Esforço** (o planejamento
original). Quando uma camada for executada, a coluna troca.

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

`2026-08_canais.sql` preserva o **slug** de `data/canais.js` (`foco`, `cnr`, …) — é o que
permitiu às Camadas 2 e 3 casarem o texto antigo com `canal_id` por igualdade simples,
sem heurística de nome. Continua valendo pra qualquer camada futura.

**Teste de aceite:** ✅ passou — 3 tabelas com RLS ativa; contagens 5/10/5; wrappers
carregam sem erro.

---

## Camada 1 — Golden record de pessoas — ✅ CONCLUÍDA (22/08/2026)

| # | Atividade | Arquivo(s) | Status |
|---|---|---|---|
| 1.1 | Levantar a lista de dedupe das ~40 pessoas (cruzar as 4 fontes, aplicar os aliases de `js/responsaveis.js`, sinalizar todo caso ambíguo em vez de decidir sozinho) | `docs/CAMADA1_DEDUPE_PESSOAS.md` | ✅ relatório pronto |
| 1.2 | **[humano]** José confirma/corrige a lista de dedupe | — | ✅ confirmado 22/08 — decisões abaixo |
| 1.3 | Migração SQL: `ALTER meta_inovacao_pessoas` + `CREATE meta_inovacao_pessoa_papeis` + seed | `tools/sql/2026-08_pessoas_golden.sql`, `tools/sql/2026-08_coletivos_gerencia_ui.sql` | ✅ rodadas em produção |
| 1.4 | **[humano]** Rodar no SQL Editor, conferir contagem | — | ✅ feito por José (47 pessoas, 18 papéis) |
| 1.5 | `js/db-pessoas.js` pro novo formato (pessoa + papéis) | `js/db-pessoas.js`, `js/db-pessoa-papeis.js` (novo) | ✅ feito |
| 1.6 | Aba "Pessoas" do `editor.html`: campos novos + seletor de núcleo | `editor.html` | ✅ feito (CRUD de papéis multi-linha ficou de fora — nota abaixo) |

**Decisões de dedupe fechadas por José (22/08/2026)** — relatório completo em
`docs/CAMADA1_DEDUPE_PESSOAS.md`:

- **Sandra (UI) = Sandra Chaves Silva Paraíso (núcleo)** — mesma pessoa, 3 papéis
  (UI + Comitê + núcleo Gestão do Conhecimento e Processos).
- **JR. = José Mendes de Oliveira Júnior** — mesma pessoa, 2 papéis (coordenação UI +
  núcleo Inovação para Competitividade). Isso contraria o que
  `js/responsaveis.js.ALIASES` assumia (tratava como 2 pessoas): os ids `jr` e
  `jose_mendes_junior`/`junior` de `window.DB.responsaveis` continuam separados de
  propósito (decisão de UX adiada pra Camada 4), mas resolvem pro MESMO `pessoa_id`
  nas tabelas novas.
- **Filipe Medeiros Ferreira (URC/CNR) ≠ Felipe (Inova Biomas)** — pessoas diferentes.
  Felipe (Inova Biomas) é **Philippe Fauguet Figueiredo**.
- **"Pova" não é agente de IA — é pessoa física: Gabriel Silva Povoa.**
- **"Gerência UI"** não é pessoa física (papel institucional) — virou linha em
  `meta_inovacao_coletivos`.
- **15 pessoas ficaram com `nome_completo` em aberto** (só primeiro nome conhecido) —
  decisão de José: deixar assim e completar pelo site (aba "Pessoas" do `editor.html`).

**Achado no caminho:** um bug de card duplicado em `participantes.html` (grupos
"Projetos"/"URC" novos) foi pego e corrigido antes de virar regressão — e o teste que
deveria tê-lo pego foi ajustado, porque se autovalidava contra o próprio bug.

**Addendum (22/08/2026, depois desta rodada — PR #10):** as duas falhas permanentes da
suíte headless que esta camada deixou registradas como herdadas
(`testar_status_badges_headless.js` e `testar_drawer_headless.js`) **foram corrigidas**.
Nenhuma era regressão de página: a do badges era um número travado que envelheceu (a
contagem de `index.html` depende de "hoje" em tempo real e o valor tinha sido capturado
em 13/08); a do drawer era uma condição de corrida na navegação do próprio teste — o
`TypeError: Cannot read properties of null` estourava antes de qualquer asserção rodar.
Duas asserções do drawer (régua da Sebraetec e `corsario.html#cards`) continuam
dependendo de rede de saída real pro Supabase — não são cobertas por
`CC_FORCAR_FALLBACK`/`?semrede=1` — e falham em ambiente sem esse acesso; está
documentado no cabeçalho do próprio teste. Não é regressão, é rede.

**Pendência conhecida, não bloqueante:** não existe UI em `editor.html` pra gerenciar
múltiplos papéis por pessoa (adicionar/remover linha em `meta_inovacao_pessoa_papeis`) —
as 18 linhas gravadas no 1.3 estão corretas, só sem tela própria de edição. Se for
necessário antes da Camada 4, é item novo, não coberto por este plano.

**Teste de aceite:** ✅ passou.

---

## Camada 2 — FK pontual, convivendo com o texto — ✅ CONCLUÍDA (22/08/2026), com o 2.5 em aberto

| # | Atividade | Arquivo(s) | Status | Cobertura real |
|---|---|---|---|---|
| 2.1 | `ALTER meta_inovacao_projetos` (+ `nucleo_id`), popular | `tools/sql/2026-08_projetos_nucleo_id.sql` | ✅ | 28/28 |
| 2.2 | `CREATE meta_inovacao_projeto_representantes`, popular (resolução de alias) | `tools/sql/2026-08_projeto_representantes.sql` | ✅ | 34/35 |
| 2.3 | `ALTER meta_inovacao_urc_lideranca` (+ `pessoa_id`), popular | `tools/sql/2026-08_urc_lideranca_pessoa_id.sql` | ✅ | 3/3 |
| 2.4 | Evoluir `meta_inovacao_urc_canais_responsaveis` (+ `canal_id`, `pessoa_id`), popular | `tools/sql/2026-08_urc_canais_fk.sql` | ✅ | 11/11 nos dois FKs |
| 2.5 | `ALTER meta_inovacao_canva_demandas` (+ 4 FK: núcleo, canal, facilitador, responsável), popular | — | ⏳ **NÃO FEITO** — ver nota | — |
| 2.6 | `CREATE meta_inovacao_plano_responsaveis`, popular (resolução de alias) | `tools/sql/2026-08_plano_responsaveis.sql` | ✅ | 61/61 |
| 2.7 | `ALTER corsario_status` (+ `projeto_id`, `nucleo_id`), popular | `tools/sql/2026-08_corsario_status_fk.sql` | ✅ | 27/27, zero órfãos |
| 2.8 | **[humano]** Rodar as migrações | — | ✅ feito por José, uma por uma, cada uma conferida antes da próxima | — |
| 2.9 | Auditoria de cobertura: % de FK NULL por tabela | `docs/CAMADA2_COBERTURA_FK.md`, `tools/relatorio_cobertura_fk.js` | ✅ relatório com números reais de produção | — |

**Sobre o 2.5 (achado em 22/08/2026, ao consolidar os dois planos):** o item estava no
plano original mas **não foi executado e não estava registrado como pendência** — sumiu
da tabela de acompanhamento, o que fazia a camada parecer 100% fechada. Confirmado:
não existe migração de FK pra `meta_inovacao_canva_demandas`, ela não aparece em
`docs/CAMADA2_COBERTURA_FK.md` nem em `tools/relatorio_cobertura_fk.js`. Não bloqueia
nada hoje — `meta_inovacao_canva_demandas` já guarda `projeto_id` e o texto cru, e as
telas do canvas funcionam. **Decisão pendente de José:** executar o 2.5 agora, adiar
pra Camada 4 (quando as telas de oficina virarem seletor) ou tirar do escopo. Enquanto
não decidir, fica aqui, visível.

**Único "faltando" esperado (não é problema):** `Sebrae Startups` → representante
`"Núcleo de Startups"` (placeholder de "aguarda indicação nominal") não vira vínculo em
`meta_inovacao_projeto_representantes` — investigado e documentado como não-órfão
(`GOVERNANCA_GOLDEN_RECORD.md`).

**Descobertas ao rodar em produção** (o dado tinha mudado desde os testes locais; as
duas absorvidas sem tocar nos scripts, porque a resolução é por texto e não por lista
fixa): o portfólio cresceu pra 28 projetos ("Startup Summit" novo) e "Consult" trocou de
representante. Detalhes em `docs/CAMADA2_COBERTURA_FK.md`.

**Teste de aceite:** ✅ passou — relatório de cobertura existe, visto por José.

---

## Camada 3 — Normalizar a matriz de demandas (maior risco do pacote) — ⏳ EM ANDAMENTO (3.1, 3.2 e 3.4 concluídos)

| # | Atividade | Arquivo(s) | Status |
|---|---|---|---|
| 3.1 | Migração SQL: `CREATE meta_inovacao_matriz_celulas` + migrar as 10 colunas fixas pra linhas (tabela antiga continua viva em paralelo) | `tools/sql/2026-08_matriz_celulas.sql` | ✅ rodada em produção — 32 células migradas, 32 = 32 conferido linha a linha, zero órfãs |
| 3.2 | Reescrever `demandas.html`: grade dinâmica a partir de `meta_inovacao_canais` × `meta_inovacao_projetos`, ler/gravar em `matriz_celulas` | `demandas.html`, `js/matriz-store.js` | ✅ em `main` — schema real conferido 16/16 no diagnóstico, RLS e upsert testados contra o schema de produção, suíte verde |
| 3.3 | Ajustar a aba "matriz" do `editor.html` (hoje é `snapshot:true`) | `editor.html` | ⏳ **não iniciado — LEIA O AVISO ABAIXO ANTES DE COMEÇAR** |
| 3.4 | Testes headless da nova grade | `tools/testar_matriz_headless.js` | ✅ veio junto no 3.2 — 11 cenários, verde |
| 3.5 | **[humano]** Validar em produção por um tempo, comparando com a tabela antiga, antes de aposentá-la | — | ⏳ em andamento por José |

Único ponto informativo do 3.1: **"Startup Summit"** é projeto criado depois do último
snapshot da matriz — nasce sem histórico de células, não é erro.

Como o 3.2 ficou: célula ausente = célula vazia, e a escrita é um **upsert no par
`(projeto_id, canal_id)`** — não um update por id de linha — pra duas pessoas na mesma
célula ao mesmo tempo não virarem `23505`. O upsert casa pela **lista de colunas**, não
pelo nome da constraint, então não depende de a UNIQUE se chamar
`cc_matriz_celulas_projeto_canal_unico`.

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

A tabela antiga **congelou na virada do 3.2** — não recebe mais escrita (não há escrita
dupla; ela é rede de rollback e base de comparação). Logo, toda edição feita na grade
nova a partir de agora aparece como divergência, e isso é o esperado. Divergência que
ninguém reconhece como edição própria é que é sinal de erro de migração.

Estado do banco (schema, RLS, publicação `supabase_realtime`, conferência) se checa com
`tools/sql/2026-08_matriz_celulas_diagnostico.sql` — só leitura, 17 checagens com
veredito `OK`/`DIVERGE`/`ATENÇÃO`. **O `ALTER PUBLICATION` do realtime não está na
migração** (foi passo manual em produção): um ambiente recriado só pelo `.sql` nasce sem
realtime, e é a checagem 16 que denuncia.

**Pendência de decisão (não bloqueia nada):** "Oficina confirmada" e "Não se aplica o
uso" existem em `js/status.js`/`css/base.css` desde a v0.7.0 mas **nunca** estiveram no
`CHECK` da tabela — escolher esses valores sempre falhou no salvar, em silêncio. O
`<select>` agora oferece só os 7 que o banco aceita. Pra reabilitar: primeiro `ALTER` no
`CHECK`, depois a lista `ESTADOS` de `js/matriz-store.js` — nessa ordem.

---

## Camada 4 — Telas migram pra seletor — ⏳ NÃO INICIADA

| # | Atividade | Arquivo(s) | Modelo | Esforço |
|---|---|---|---|---|
| 4.1 | `editor.html` "Projetos & Representantes": campo vira seletor de pessoa | `editor.html` | Sonnet | médio |
| 4.2 | `editor.html` "URC — Liderança" / "URC — Responsáveis por canal": seletor de pessoa/canal | `editor.html` | Sonnet | médio |
| 4.3 | `plano-acao.html` / `minhas-acoes.html`: select de responsável lê pessoas + coletivos, aposenta parsing de `js/responsaveis.js` | `plano-acao.html`, `minhas-acoes.html` | Sonnet | alto |
| 4.4 | `participantes.html` / `js/drawer.js`: exibição via join, não mais array de string | `participantes.html`, `js/drawer.js` | Sonnet | médio |

**Notas pra quando chegar aqui:**

- É o momento certo de decidir a UX dos ids duplicados `jr`/`jose_mendes_junior` e
  `sandra`/`sandra_chaves_paraiso` em `window.DB.responsaveis` (ver Camada 1) — hoje
  resolvem pro mesmo `pessoa_id`, mas a lista ainda mostra 2 entradas pro mesmo humano.
- O item 2.5 (FKs de `meta_inovacao_canva_demandas`) pode ser absorvido aqui, se a
  decisão for adiá-lo — ver nota da Camada 2.
- `tools/testar_drawer_headless.js` foi consertado em 22/08 (PR #10) e é a rede de
  proteção do 4.4, que mexe justamente em `js/drawer.js` — rode ANTES e DEPOIS de tocar
  nesse arquivo. Só lembre que 2 asserções dele precisam de rede real pro Supabase: num
  ambiente sem esse acesso elas falham sozinhas, e isso não é regressão sua.

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

A aposentadoria de `meta_inovacao_matriz_demandas` (decidida no 3.5) entra aqui.

**Teste de aceite:** suíte de testes headless inteira verde; nenhuma tela lê mais
coluna de texto que foi dropada em 5.3.

---

## Protocolo de ajuste (mesmo do `PLANO_EXECUCAO.md` original)

1. Teste de aceite da camada falhou → registrar a causa (num `BUILD_STATUS.md` novo
   pra esta frente, ou anexado ao existente).
2. Corrigir. Reexecutar o teste (máx. 3 tentativas).
3. Persistindo, isolar o item, registrar como pendência e **seguir com o resto da
   camada** — uma atividade travada não trava a camada inteira, e uma camada travada
   não trava as anteriores (que já estão em produção).

**Corolário aprendido no 2.5:** item que ficou pra trás vira **linha com status
`⏳ NÃO FEITO` na tabela da camada**, nunca linha removida. Sumir da tabela é o mesmo
que nunca ter sido planejado.

## Ordem — por que não pular camada

Camada 3 (matriz) é deliberadamente a mais tardia entre as mudanças de dado, não a
primeira: é a de maior ineditismo técnico (única tabela redesenhada, não só FK nova) e
mexe na tela mais usada do site. Rodar as Camadas 0–2 primeiro dá o golden record de
pessoas/núcleos/canais já estável — inclusive testável — antes de arriscar a peça mais
delicada.

---

## Status por camada — resumo pra retomar em sessão nova

Se você está começando uma sessão nova pra continuar este trabalho, isto é o que
precisa saber sem reler tudo acima:

1. **Camadas 0 e 1 estão 100% em produção**, testadas e confirmadas linha a linha por
   José no SQL Editor. **Camada 2 idem, exceto o item 2.5**, que nunca foi executado
   (ver nota na Camada 2 — decisão pendente, não bloqueia). Todos os scripts SQL estão
   em `meta-monitor/tools/sql/2026-08_*.sql`. Não precisam rodar de novo.
2. **Camada 3 está em andamento:** 3.1 (tabela + migração), 3.2 (grade dinâmica) e 3.4
   (testes headless) estão em `main` e validados em produção. **O próximo passo é o
   3.3** — e ele tem um aviso próprio, na seção da Camada 3, que precisa ser lido antes
   de encostar no `editor.html`. Em paralelo corre o 3.5, que é validação humana.
3. Documentos de apoio já existentes, não precisam ser refeitos:
   - `docs/CAMADA1_DEDUPE_PESSOAS.md` — decisões de identidade de pessoas.
   - `docs/CAMADA2_COBERTURA_FK.md` — cobertura real de cada FK da Camada 2.
   - `docs/PROPOSTA_ESQUEMA_CADASTROS_REFERENCIA.md` — desenho original completo.
   - `docs/GOVERNANCA_GOLDEN_RECORD.md` — governança do golden record de *projetos*
     (frente irmã, concluída antes desta).
4. Ferramentas desta frente que já existem — use em vez de reinventar:
   - `tools/relatorio_cobertura_fk.js` — cobertura de FK da Camada 2, contra produção.
   - `tools/conferir_matriz_celulas.js` — matriz nova × antiga, célula a célula.
   - `tools/sql/2026-08_matriz_celulas_diagnostico.sql` — schema/RLS/realtime da
     Camada 3, só leitura, com veredito por checagem.
   - `tools/testar_matriz_headless.js` — 11 cenários da grade dinâmica.
5. **Pendências não bloqueantes acumuladas:** UI de múltiplos papéis por pessoa em
   `editor.html` (Camada 1); item 2.5 (Camada 2); "Oficina confirmada"/"Não se aplica o
   uso" fora do `CHECK` (Camada 3). **As duas falhas antigas da suíte
   (`testar_status_badges_headless.js` e `testar_drawer_headless.js`) foram corrigidas em
   22/08 (PR #10)** — a suíte do README está verde. Num ambiente sem rede de saída pro
   Supabase, 2 asserções do drawer falham por isso e só por isso.
6. **Toda migração SQL é rodada manualmente por José no SQL Editor do Supabase** —
   nenhuma automação tem acesso de escrita à produção. As sessões do Claude Code também
   **não conseguem LER** o Supabase de produção (rede bloqueada pra `supabase.co`): todo
   teste de migração é feito num Postgres local simulando o estado de produção antes de
   entregar o script pra José rodar de verdade. Quando precisar saber algo do banco real,
   o caminho é gerar uma consulta pra José rodar — como o diagnóstico da Camada 3 — e não
   supor.
