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

> **STATUS GERAL (atualizado 26/08/2026): Camadas 0, 1, 2 e 3 concluídas e verificadas em
> produção, incluindo o item 2.5 (rodado por José em 23/08/2026 — ver nota da Camada 2) e
> o item 3.5 (José validou a Matriz de demandas em produção em 26/08/2026, sem
> divergência); **Camada 4
> CONCLUÍDA (26/08/2026)** — os itens 4.1 (`editor.html` "Projetos & Representantes" vira
> seletor de pessoa), 4.2 (`editor.html` "URC — Liderança"/"URC — Responsáveis por canal"
> viram seletor de pessoa/canal), 4.3 (`plano-acao.html`/`minhas-acoes.html`: select de
> "Responsável"/"Ver como" passa a ler pessoas+coletivos do golden record, sem migração —
> ver `js/db-responsaveis.js`) e 4.4 (`js/drawer.js`: painel de iniciativa lê a junção
> `meta_inovacao_projeto_representantes` quando a página carrega os módulos certos, texto
> livre como fallback — ver "Como o 4.4 ficou") estão em `main`. **Camada 5 iniciada
> (26/08/2026)** — o item 5.1 (auditoria final de FK, ponta a ponta) está feito e abriu
> três itens novos, **5.5/5.6/5.7, todos RESOLVIDOS em `main` no mesmo dia:** as 3 FKs
> dos itens 2.1, 2.6 e 2.7 agora são gravadas nas portas de entrada que existem
> (`editor.html`, único lugar que cria projeto/ação/iniciativa nova) — ver "Como o
> 5.5/5.6/5.7 ficaram". O 5.2 (decisão humana de dropar ou manter cada coluna de texto)
> ainda não está maduro — fechar a porta de escrita não é o mesmo que a LEITURA já ter
> migrado nas outras telas, o que virou o item novo **5.9** (formalizado a pedido de José
> em 26/08/2026, ver a tabela da Camada 5), pré-requisito real do 5.2 (ver o "Veredito por
> coluna de texto" em `docs/CAMADA5_AUDITORIA_FK.md`, que precisa de uma nova rodada de
> auditoria — 5.1 não foi re-executado — antes do 5.2 avançar). A rodada em produção
> (26/08) deu 12 de 13 `OK` na
> cobertura, com um `DIVERGE`: `corsario_status.nucleo_id` estava `0/4` — item **5.8,
> RESOLVIDO em produção em 26/08/2026** (José rodou SEÇÃO 1→2→3 de
> `tools/sql/2026-08_corsario_status_nucleo_id_recuperacao.sql`: os 4 núcleos casaram por
> igualdade normalizada, SEÇÃO 3 confirmou 4/4, zero linhas sem correspondente). Ver
> `docs/CAMADA5_AUDITORIA_FK.md`. Se você está
> retomando este trabalho numa sessão nova: leia a seção "Status
> por camada" no fim primeiro — ela lista o que já existe no banco e no repositório, pra
> não repetir trabalho nem presumir algo que ainda não foi feito.

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

## Camada 2 — FK pontual, convivendo com o texto — ✅ CONCLUÍDA (23/08/2026, com o 2.5)

| # | Atividade | Arquivo(s) | Status | Cobertura real |
|---|---|---|---|---|
| 2.1 | `ALTER meta_inovacao_projetos` (+ `nucleo_id`), popular | `tools/sql/2026-08_projetos_nucleo_id.sql` | ✅ | 28/28 |
| 2.2 | `CREATE meta_inovacao_projeto_representantes`, popular (resolução de alias) | `tools/sql/2026-08_projeto_representantes.sql` | ✅ | 34/35 |
| 2.3 | `ALTER meta_inovacao_urc_lideranca` (+ `pessoa_id`), popular | `tools/sql/2026-08_urc_lideranca_pessoa_id.sql` | ✅ | 3/3 |
| 2.4 | Evoluir `meta_inovacao_urc_canais_responsaveis` (+ `canal_id`, `pessoa_id`), popular | `tools/sql/2026-08_urc_canais_fk.sql` | ✅ | 11/11 nos dois FKs |
| 2.5 | `ALTER meta_inovacao_canva_demandas` (+ 4 FK: núcleo, canal, facilitador, responsável), popular, e `cc_canva_gravar`/`cc_canva_editar` passam a gravar as 4 FKs em toda demanda nova | `tools/sql/2026-08_canva_demandas_fk.sql` | ✅ **rodado por José em produção em 23/08/2026** | 1 linha existente ("Embrapii"): `nucleo_id`/`canal_id`/`responsavel_pessoa_id` 3/3 do que tinha texto; `facilitador_pessoa_id` sem texto pra casar (campo nunca preenchido nessa linha) — ver nota |
| 2.6 | `CREATE meta_inovacao_plano_responsaveis`, popular (resolução de alias) | `tools/sql/2026-08_plano_responsaveis.sql` | ✅ | 61/61 |
| 2.7 | `ALTER corsario_status` (+ `projeto_id`, `nucleo_id`), popular | `tools/sql/2026-08_corsario_status_fk.sql` | ✅ | 27/27, zero órfãos |
| 2.8 | **[humano]** Rodar as migrações | — | ✅ feito por José, uma por uma, cada uma conferida antes da próxima (2.5 rodou depois, em 23/08/2026, mesmo processo) | — |
| 2.9 | Auditoria de cobertura: % de FK NULL por tabela | `docs/CAMADA2_COBERTURA_FK.md`, `tools/relatorio_cobertura_fk.js` | ✅ relatório com números reais de produção; 2.5 entrou no relatório em 23/08/2026 (ver nota) | — |

**Sobre o 2.5 — histórico:** achado em 22/08/2026, ao consolidar os dois planos, que o
item estava no plano original mas **não tinha sido executado e não estava registrado
como pendência** — tinha sumido da tabela de acompanhamento, o que fazia a camada
parecer 100% fechada. Ficou registrado como `⏳ NÃO FEITO` até ser endereçado em
23/08/2026:

- `tools/sql/2026-08_canva_demandas_fk.sql` — `ALTER TABLE` (4 colunas nullable,
  convivendo com o texto, que fica), popula o que já existe (`canal_id` por igualdade
  exata de slug; `nucleo_id`/`facilitador_pessoa_id`/`responsavel_pessoa_id` por
  `public.cc_pessoa_normalizar()` — reaproveitada de 2026-08_projeto_representantes.sql,
  sem criar uma segunda régua de nome), e substitui `cc_canva_gravar`/`cc_canva_editar`
  (`CREATE OR REPLACE`, mesma assinatura) pra que **toda demanda nova já nasça com as 4
  FKs preenchidas** — sem isso a cobertura cairia sozinha a cada oficina, e o 2.5 viraria
  um retrato que envelhece.
- Testado antes num Postgres local simulando produção (schema mínimo + dados realistas
  de `data/projetos.js`/`data/canais.js`, com nomes que casam exatamente, com
  acento/caixa diferente, por `nome_completo` em vez do nome curto, e nomes de propósito
  fora do golden record): das 5 linhas semeadas, `canal_id` e `nucleo_id` bateram 100% do
  que tinha texto (5/5 e 4/4), `facilitador_pessoa_id` bateu 2/3 (o nome fora do golden
  record ficou `NULL`, como esperado) e `responsavel_pessoa_id` bateu 4/5 (mesma razão).
  Rodado duas vezes seguidas para confirmar idempotência (segunda rodada: `UPDATE 0` nas
  4 populações). `cc_canva_gravar` testada gravando uma demanda nova com as 4 FKs saindo
  preenchidas; `cc_canva_editar` testada trocando `responsavel`/`facilitador` e
  confirmando que as duas FKs de pessoa são recalculadas (canal/núcleo não mudam, porque
  `canal`/`projeto` continuam imutáveis nessa função).
- **Rodado por José em produção em 23/08/2026.** `meta_inovacao_canva_demandas` tinha só
  1 linha até então (a demanda de teste da "Embrapii", canal "empresa"). Conferência da
  consulta (f) do script: `nucleo_id` casou com "Tecnologias Portadoras de Futuro",
  `canal_id` casou com "empresa", `responsavel_pessoa_id` casou com "Agnaldo" — as 3 FKs
  que tinham texto pra casar bateram 100%. `facilitador_pessoa_id` saiu `NULL`, mas
  porque `facilitador` também é `NULL` nessa linha (campo nunca preenchido nela) — não é
  uma falha de casamento, é ausência de texto. Cobertura real: 3/3 das FKs com texto,
  0 órfãos.
- `tools/relatorio_cobertura_fk.js` ganhou a entrada do 2.5 — com uma ressalva que não
  existe nas outras: a leitura de `meta_inovacao_canva_demandas` não é pública (só
  `authenticated` + `cc_eh_editor()`), então a anon key deste script não mede cobertura
  real aqui; o relatório distingue "RLS fechando" (esperado) de "coluna não existe"
  (migração não rodou) e aponta pra rodar as consultas de verificação do próprio SQL no
  SQL Editor pra ver o número de verdade.

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

## Camada 3 — Normalizar a matriz de demandas (maior risco do pacote) — ✅ CONCLUÍDA (3.5 validado em 26/08/2026)

| # | Atividade | Arquivo(s) | Status |
|---|---|---|---|
| 3.1 | Migração SQL: `CREATE meta_inovacao_matriz_celulas` + migrar as 10 colunas fixas pra linhas (tabela antiga continua viva em paralelo) | `tools/sql/2026-08_matriz_celulas.sql` | ✅ rodada em produção — 32 células migradas, 32 = 32 conferido linha a linha, zero órfãs |
| 3.2 | Reescrever `demandas.html`: grade dinâmica a partir de `meta_inovacao_canais` × `meta_inovacao_projetos`, ler/gravar em `matriz_celulas` | `demandas.html`, `js/matriz-store.js` | ✅ em `main` — schema real conferido 16/16 no diagnóstico, RLS e upsert testados contra o schema de produção, suíte verde |
| 3.3 | Ajustar a aba "matriz" do `editor.html` (hoje é `snapshot:true`) | `editor.html`, `js/matriz-store.js`, `demandas.html` | ✅ em `main` — a aba lê ao vivo (mesmas 3 fontes de `demandas.html`: `matrizStore` + `DB_PROJETOS` + `DB_CANAIS`), virou só leitura (a edição de verdade continua em `demandas.html`), e o botão exporta o snapshot do modelo ao vivo. Detalhe abaixo. |
| 3.4 | Testes headless da nova grade | `tools/testar_matriz_headless.js` | ✅ veio junto no 3.2 — 11 cenários, verde |
| 3.5 | **[humano]** Validar em produção por um tempo, comparando com a tabela antiga, antes de aposentá-la | — | ✅ **validado em 26/08/2026** — José conferiu a Matriz de demandas em produção, sem divergência encontrada |

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

### Como o 3.3 ficou — histórico da pegadinha do snapshot

Antes do 3.3, a aba "matriz" do `editor.html` era `snapshot:true` em cima de uma cópia de
trabalho ESTÁTICA (`data/matriz.js` copiado pra `W.matriz`, editável ali e reexportado
idêntico) — as colunas vinham de `data/canais.js` fixo, então um canal novo cadastrado em
`meta_inovacao_canais` nunca aparecia nessa tela, e o `<select>` de cada célula oferecia
9 estados (`ESTADOS_CEL`) quando o `CHECK` da tabela só aceita 7 — "oficina_confirmada" e
"nao_aplica" nunca foram aceitos pelo banco, escolhê-los sempre falhou no salvar em
silêncio.

O aviso original alertava que o formato de `data/matriz.js` — `{ iniciativa: { slug_do_
canal: estado } }`, indexado por **slug de canal**, não por `canal_id` — é o *fallback
offline* da `demandas.html`: se mudasse, quebrava o modo offline dela (grade vazia sem
rede, sem ninguém perceber até o Supabase cair de verdade) e o
`tools/testar_status_badges_headless.js` (270 badges vindos justamente desse arquivo).

**O que o 3.3 fez, de fato:**

- A aba passou a ler AO VIVO, pelas mesmas 3 fontes de `demandas.html`: `matrizStore` +
  `DB_PROJETOS` + `DB_CANAIS`. Canal novo cadastrado no catálogo aparece na tela sem
  deploy, igual já acontecia em `demandas.html`.
- A montagem da grade (`montarModelo`) e a tradução pro formato de `data/matriz.js`
  (`paraSnapshot`) saíram de `demandas.html` e viraram funções de `js/matriz-store.js`,
  chamadas dos DOIS lugares — o formato do snapshot não mudou nem 1 caractere, e agora os
  dois exports batem chave a chave POR CONSTRUÇÃO (mesma função), não por promessa entre
  dois arquivos.
- A aba ficou **só leitura** (badges via `CC_STATUS.badge`, sem `<select>`) — a edição de
  verdade continua só em `demandas.html`, que tem upsert e realtime de verdade. A lista
  `ESTADOS_CEL` (9 valores, com os 2 que o banco nunca aceitou) foi removida; se um dia a
  aba precisar voltar a ser editável, a fonte dos 7 valores válidos é `matrizStore.ESTADOS`.
- Testado: `tools/testar_matriz_headless.js` e `tools/testar_status_badges_headless.js`
  seguem verdes (o formato não mudou); e a fiação da própria aba (carregar as 3 fontes,
  renderizar a grade, gerar o snapshot) ganhou teste próprio em
  `tools/testar_matriz_editor_headless.js` — offline e com o mesmo dublê de Supabase de
  `tools/testar_matriz_headless.js`, confirma que a grade sai só leitura e que o snapshot
  exportado pela aba bate byte a byte (e chave a chave) com o que `demandas.html` exporta,
  nos dois modos.

### Como ficou a validação do 3.5

**Concluída em 26/08/2026** — José validou a Matriz de demandas em produção, sem
divergência. A tabela antiga (`meta_inovacao_matriz_demandas`) pode ser considerada
congelada e candidata a aposentadoria (decisão que entra na Camada 5, junto com as
demais colunas de texto legado — ver "A aposentadoria de `meta_inovacao_matriz_demandas`
entra aqui" no fim da seção da Camada 5).

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

**Ponta solta resolvida junto com o 3.3:** a aba "Histórico" do `editor.html` (auditoria)
só filtrava por `meta_inovacao_matriz_demandas` — a tabela antiga, que congelou na virada
do 3.2. As edições feitas depois disso na grade nova ficavam invisíveis nesse filtro. O
trigger de auditoria pra tabela sucessora (`cc_audit_matriz_celulas`) já existia desde o
item 3.1 (criado junto com a tabela em `tools/sql/2026-08_matriz_celulas.sql`, reusando
`cc_audit()` de `tools/sql/2026-08_auditoria.sql`), então bastou acrescentar
`meta_inovacao_matriz_celulas` como opção nova no filtro — a tabela antiga ficou como
opção separada ("histórico anterior ao 3.2"), pro que já foi gravado nela não sumir da
tela.

---

## Camada 4 — Telas migram pra seletor — ✅ CONCLUÍDA (26/08/2026)

| # | Atividade | Arquivo(s) | Status |
|---|---|---|---|
| 4.1 | `editor.html` "Projetos & Representantes": campo vira seletor de pessoa | `editor.html`, `js/db-projeto-representantes.js` | ✅ em `main` — chip removível (junção `meta_inovacao_projeto_representantes`, item 2.2) + `<select>` de pessoas ativas, no lugar do texto livre "Representantes (vírgula)". Detalhe abaixo. |
| 4.2 | `editor.html` "URC — Liderança" / "URC — Responsáveis por canal": seletor de pessoa/canal | `editor.html`, `js/db-urc.js` | ✅ em `main` — "Nome" (nas duas abas) virou `<select>` de pessoa (golden record, `pessoa_id` dos itens 2.3/2.4), pré-selecionado por FK; o `<select>` de canal (já existia, sobre `CANAIS_FIXOS`) passou a manter `canal_id` em sincronia; "+ Adicionar responsável" trocou o `prompt()` de nome livre por 2 `<select>` (canal + pessoa). Detalhe abaixo. |
| 4.3 | `plano-acao.html` / `minhas-acoes.html`: select de responsável lê pessoas + coletivos, aposenta parsing de `js/responsaveis.js` | `plano-acao.html`, `minhas-acoes.html`, `js/db-responsaveis.js` (novo) | ✅ em `main` — o `<select>` de "Responsável"/"Ver como" agora é montado a partir de `DB_PESSOAS`+`DB_COLETIVOS` (golden record), não mais da lista estática `window.DB.responsaveis`; os ~32 ids já gravados no Supabase são preservados exatamente, sem migração. Detalhe abaixo. |
| 4.4 | `participantes.html` / `js/drawer.js`: exibição via join, não mais array de string | `participantes.html`, `js/drawer.js` | ✅ em `main` — o painel de INICIATIVA do drawer ("Núcleo e representante(s)") passa a ler `meta_inovacao_projeto_representantes` (item 2.2) + `meta_inovacao_pessoas`, com `proj.representantes` (text[]) só como fallback. Detalhe abaixo. |

### Como o 4.1 ficou

- A célula de "Representantes" deixou de ser um `<input type="text">` com nomes
  separados por vírgula. Cada projeto agora mostra um **chip removível** por
  representante já vinculado (`.chip.pessoa`, o mesmo estilo de `js/drawer.js`) e um
  `<select>` "+ adicionar…" com as pessoas **ativas** de `meta_inovacao_pessoas` que
  ainda não estão vinculadas àquele projeto — `js/db-projeto-representantes.js` (novo,
  mesmo padrão de `js/db-pessoa-papeis.js`) lê/grava a junção
  `meta_inovacao_projeto_representantes` criada no item 2.2.
- `meta_inovacao_projetos.representantes` (`text[]`) **continua sendo gravado em
  paralelo** — a Camada 5 é quem decide se ele é aposentado, e `projetos.html`,
  `index.html`, `js/drawer.js` e `js/busca.js` ainda leem só o array. Adicionar/remover
  pelo seletor novo sincroniza o array (nome curto da pessoa) best-effort: se o vínculo
  grava mas a sincronia do texto falhar, fica só um aviso no console — o vínculo (fonte
  nova) não é desfeito por isso.
- Projeto sem vínculo pra nenhum representante (ainda não migrado, ou o placeholder
  intencional "Núcleo de Startups"/"Núcleo de X" — ver nota do item 2.2) continua
  mostrando o texto puro de `representantes[]`, sem quebrar; o `<select>` de adicionar
  aparece do mesmo jeito, pra dar o próximo passo quando a indicação nominal vier.
- "+ Novo projeto" trocou o campo de texto por chips + `<select>` também — as pessoas
  escolhidas viram vínculo assim que o projeto é criado (mesma chamada em sequência,
  1 por representante); um campo de texto opcional cobre só o placeholder de
  "indicação pendente" (não vira vínculo, mesmo padrão do "Núcleo de Startups").
- Testado offline (`?semrede=1`: sem tabela de vínculo pra ler, cai pro texto puro,
  controles desabilitados — nunca uma escrita de verdade em teste) e online (dublê de
  Supabase in-memory, sem tocar rede de verdade): vínculo existente vira chip, pessoa já
  vinculada some do `<select>`, pessoa inativa nunca aparece nele, adicionar grava o
  vínculo e sincroniza o texto, remover desfaz as duas coisas — ver
  `tools/testar_projetos_editor_representantes_headless.js`.

### Como o 4.2 ficou

- **"URC — Liderança":** a célula "Nome" deixou de ser um `<input type="text">` e virou
  um `<select>` de pessoa (golden record, `meta_inovacao_pessoas`), pré-selecionado pelo
  `pessoa_id` já gravado no item 2.3 (cobertura esperada 100% — as 3 linhas de liderança
  já vieram casadas na migração). Papel e e-mail continuam texto livre — não têm por que
  ser os mesmos do cadastro golden de pessoas (o "papel" aqui é o cargo NA URC, e o
  e-mail pode ser um contato diferente). Trocar a pessoa grava as duas colunas juntas
  num único `UPDATE`: `pessoa_id` (a FK) e `nome` (texto legado que
  `participantes.html`/o guardrail de liderança ainda leem) — mesmo padrão de sincronia
  best-effort do item 4.1, só que aqui as duas colunas vivem na mesma linha, não numa
  junção à parte.
- **"URC — Responsáveis por canal":** mesma troca de "Nome" por `<select>` de pessoa. O
  `<select>` de "Canal" **já existia** (sobre `DB_URC.CANAIS_FIXOS`, texto) — o 4.2 não
  mudou a LISTA de opções, só passou a manter `canal_id` (item 2.4) em sincronia sempre
  que o canal muda, resolvendo por igualdade exata de nome contra
  `meta_inovacao_canais` (mesma régua da migração `2026-08_urc_canais_fk.sql`). A lista
  continua restrita aos 8 canais de `CANAIS_FIXOS`, não os 10 do catálogo inteiro
  (`meta_inovacao_canais`) — "Sebrae na sua empresa" e "Contabilizações e instrumentos"
  ainda não têm responsável indicado, e `agruparPorCanal()` (`js/db-urc.js`), que
  `participantes.html` usa pra montar o card de cada canal, só conhece esses 8; abrir a
  lista pros 10 sem tocar naquela função faria um responsável cadastrado num canal novo
  desaparecer silenciosamente de lá. Fica registrado como ponta solta pra quando alguém
  decidir cobrir os 2 canais que faltam (não é bloqueante — ver nota abaixo).
- **"+ Adicionar responsável"** trocou o `prompt()` de nome livre por 2 `<select>` no
  topo da tabela (canal + pessoa golden, pessoas ativas). Escolher a pessoa e clicar
  "Adicionar" grava `canal`/`canal_id`/`nome`/`pessoa_id` de uma vez — e-mail sai vazio
  (editável na própria linha depois, mesmo fluxo de sempre).
- **Guardrail (item 4.4, herdado de `tools/validar_dados.py`)** continua valendo:
  `DB_URC.salvarResponsavel`/`criarResponsavel` recebem a lista de liderança e recusam
  (throw) se o `nome` do patch bater com algum líder — agora disparado pelo `<select>` de
  pessoa em vez do `<input>` de texto de antes, mesma mensagem de erro.
- Testado offline (`?semrede=1`: DB_URC/DB_PESSOAS/DB_CANAIS caem pro seed local,
  `<select>` desabilitados, nunca uma escrita de verdade em teste) e online (dublê de
  Supabase in-memory, sem tocar rede de verdade): pessoa vinculada pré-selecionada nas
  duas abas, pessoa inativa nunca aparece nas opções, trocar de pessoa grava `pessoa_id`
  + `nome`, trocar de canal grava `canal_id` sem mexer no vínculo de pessoa, o guardrail
  continua bloqueando, e "+ Adicionar responsável" grava as 4 colunas a partir dos 2
  `<select>` do topo — ver `tools/testar_urc_editor_headless.js`.

### Como o 4.3 ficou

- **Novo módulo `js/db-responsaveis.js`** (`window.DB_RESPONSAVEIS`) — função pura (sem
  rede, sem DOM, testável via node como `js/calc.js`/`js/responsaveis.js`) que MONTA a
  lista de responsáveis (pessoa OU coletivo) a partir de `DB_PESSOAS.carregar()` +
  `DB_COLETIVOS.carregar()` já resolvidos, substituindo a lista estática
  `window.DB.responsaveis` (`data/pessoas.js`) como fonte dos `<select>` de "Responsável"
  (`plano-acao.html`) e "Ver como" (`minhas-acoes.html`). Não é um wrapper de tabela
  Supabase — não existe `meta_inovacao_responsaveis` — é derivado em memória a partir dos
  dois catálogos que já existem.
- **Compatibilidade com o já gravado, sem migração nenhuma:** `plano_acao_atividades.
  responsavel` e `meta_inovacao_plano_acoes.responsavel_id` guardam os ~32 ids antigos de
  `window.DB.responsaveis` ("jr", "comite", "gabriel_barreto_barros"...) — preservados
  EXATAMENTE em `js/db-responsaveis.js.LEGADO` (mesma tradução id→pessoa/coletivo já usada
  e confirmada em produção pelo item 2.6, `tools/sql/2026-08_plano_responsaveis.sql`).
  Nenhum `ALTER TABLE` foi necessário — dado antigo continua resolvendo certo.
- **Decisão da UX dos ids duplicados (adiada da Camada 1 pra esta, como as notas abaixo já
  antecipavam):** `jr`/`jose_mendes_junior` e `sandra`/`sandra_chaves_paraiso` — que já
  resolviam pro mesmo `pessoa_id` desde o item 2.6 — agora colapsam numa ÚNICA opção
  visível no `<select>` ("JR."/"Sandra", grupo Coordenação), com o id "extra" guardado em
  `aliasIds` só pra reconhecer dado já gravado com o outro id (pré-seleciona certo; a
  própria renderização do `<select>` já normaliza pro id canônico, sem precisar trocar
  nada na linha pra isso acontecer).
- **"Cadastra e aparece sozinho" pra responsável de plano de ação, de verdade:** pessoa ou
  coletivo golden que NÃO está entre os 32 ids do LEGADO (por exemplo, qualquer pessoa do
  grupo URC — liderança/canais, que nunca esteve na lista estática) ganha um id novo
  ("pessoa:<id>"/"coletivo:<id>", a chave primária do golden record) e aparece na lista
  sozinho, sem editar `js/db-responsaveis.js`. Isso amplia o universo de quem pode ser
  responsável de uma atividade/ação (antes limitado aos 32 nomes curados à mão) — não é
  regressão, é a lista ficando tão completa quanto o golden record de pessoas.
- **`plano-acao.html`:** removido o `<script src="js/responsaveis.js">` (não sobrava
  nenhum uso direto de `RESP` nesta página) e trocada a linha estática
  `const RESPONSAVEIS = window.DB.responsaveis` por uma carregada no bootstrap
  (`DB_PESSOAS.carregar()` + `DB_COLETIVOS.carregar()` em paralelo, antes do 1º render).
  `opcoesResponsavel()` passou a usar `DB_RESPONSAVEIS.encontrar()` pra decidir a opção
  selecionada (bate por id canônico OU por `aliasIds`) — o mecanismo de opção "legada"
  (⚠, `.pa-legado`) pra texto que não bate com NADA continua exatamente como antes.
- **`minhas-acoes.html`:** mesma troca pro select "Ver como"; `js/responsaveis.js`
  **continua carregado** — `nosDaPessoa()` segue usando `RESP.mapearTexto` pra resolver o
  texto livre de verdade `n.guardiao` (`data/nos.js`, ex. "JR. e gestores + Comitê"), que
  é narrativo e está fora do escopo deste item (ver
  `docs/PROPOSTA_ESQUEMA_CADASTROS_REFERENCIA.md`) — só que agora contra a lista golden, o
  que também deixa pessoas do grupo URC reconhecíveis ali se um dia entrarem numa frase de
  guardião. `acoesDaPessoa()`/`atividadesDaPessoa()` passaram a comparar contra
  `DB_RESPONSAVEIS.idsEquivalentes()` (id canônico + `aliasIds`) em vez de só o id
  selecionado, pra uma ação/atividade gravada com o id "extra" antes desta unificação não
  sumir da guarda de ninguém.
- `js/responsaveis.js` **não foi alterado** — nenhum dos seus `ALIASES` referencia um id
  que deixou de existir na lista nova (todos os 32 ids do LEGADO continuam válidos), e o
  módulo segue com seu uso original (resolver `n.guardiao`) em `minhas-acoes.html`.
- Testado: `tools/testar_responsaveis.js` (puro — seed local `data/pessoas.js`/
  `data/coletivos.js` + uma fixture fabricada com pessoa/coletivo fora do LEGADO, pessoa
  inativa e pessoa sem `nome_exibicao`) e `tools/testar_plano_acao_responsavel_headless.js`
  (dublê de Supabase in-memory, sem rede real: id antigo pré-seleciona certo, apelido
  antigo cai na mesma opção sem duplicar, texto sem tradução vira "legado", pessoa golden
  fora da lista estática aparece agrupada em "URC", trocar grava o id golden novo).
  `tools/testar_minhas_acoes_headless.js` (já existente, sem alterações) continua verde —
  confere que a contagem de nós/ações da pessoa "sandra" não mudou com a troca de fonte.

**Pendência não bloqueante aberta pelo 4.2, ainda válida:** o `<select>` de canal de
"URC — Responsáveis por canal" continua restrito aos 8 `CANAIS_FIXOS`, não aos 10 canais
do catálogo golden — cobrir "Sebrae na sua empresa"/"Contabilizações e instrumentos"
exige primeiro ajustar `agruparPorCanal()` (`js/db-urc.js`) pra não depender de uma lista
fixa, senão um responsável cadastrado num canal novo sumiria de `participantes.html` sem
ninguém perceber.

### Como o 4.4 ficou

- O bloco "Núcleo e representante(s)" do painel de **iniciativa** (`js/drawer.js`,
  `abrirIniciativa`) virou bloco assíncrono (mesmo padrão de "Posição na régua do
  Corsário"): `representantesHtml(proj)` tenta primeiro a junção
  `meta_inovacao_projeto_representantes` (item 2.2) + `meta_inovacao_pessoas` — via
  `carregarJuncaoRepresentantes()`, memoizada, só ativa quando a página carrega os dois
  módulos (`js/db-projeto-representantes.js` + `js/db-pessoas.js`; hoje só
  `participantes.html`, que ganhou o primeiro script nesta rodada — o segundo já estava
  lá desde a Camada 1). Cada pessoa do vínculo vira `spanPessoaGolden()`: span clicável
  com o id LEGADO de 32 curados quando o nome bate (é o caso comum — o grupo "Projetos"
  do golden record nasceu exatamente desses nomes), texto plano sem bater, igual
  `spanPessoa()` sempre fez pra nome sem id conhecido.
- **Convivendo, não substituindo** (mesmo espírito do 2.5/4.1/4.2): sem os dois módulos
  carregados (`plano.html`, `demandas.html`, `corsario.html`, `projetos.html`, `index.html`
  — nenhum tocado por este item) ou sem vínculo ainda pra aquele projeto (não migrado, ou
  placeholder tipo "Núcleo de Startups"), cai pro texto livre `proj.representantes` de
  sempre — nunca quebra, nunca mostra painel vazio.
- **Fora do escopo, de propósito:** a lista "Representante de X" no painel de **pessoa**
  (`papeisHtml`, direção pessoa→projetos) continua casando por texto — ver o comentário
  no próprio `js/drawer.js` pra por quê (a tradução id LEGADO→`pessoa_id` golden exigiria
  carregar `js/db-responsaveis.js`/`js/db-coletivos.js` também, só pra alimentar um
  casamento que ainda seria por nome nos dois lados; o ganho de correção do 2.2 está no
  sentido projeto→representante, que é o que este item resolve). `projetos.html`,
  `index.html` e `js/busca.js` também ficam de fora — nenhum foi citado no item 4.4.
- Testado offline (`?semrede=1`, `tools/testar_drawer_headless.js` — nenhum dos dois
  módulos novos carrega em `plano.html`, então exercita o fallback de texto de sempre;
  os 3 cenários sem dependência de rede real continuam verdes, sem regressão) e o
  `tools/testar_participantes_headless.js` (não toca no drawer, mas confirma que o
  script novo não quebrou o carregamento da página).

**Teste de aceite:** nenhuma das 4 telas do 4.1–4.3 tem mais campo de texto livre pra
nome de pessoa; os testes headless existentes (`testar_participantes_headless.js`,
`testar_drawer_headless.js`, `testar_minhas_acoes_headless.js`) continuam verdes. Os
itens 4.1, 4.2 e 4.3 já passam nesse critério —
`testar_projetos_editor_representantes_headless.js`, `testar_urc_editor_headless.js`,
`testar_responsaveis.js` e `testar_plano_acao_responsavel_headless.js` são a rede de
proteção nova de cada um. O 4.4 (painel de iniciativa via junção, com fallback de texto)
passa nos mesmos dois testes headless — sem asserção nova, porque o comportamento visível
não muda quando os dois módulos não estão carregados (a maioria das páginas), e
`participantes.html` (a única que ganhou o módulo novo) não abre painel de iniciativa
hoje.

---

## Camada 5 — Aposentar texto livre — ⏳ EM ANDAMENTO (5.1 concluído em 26/08/2026)

| # | Atividade | Arquivo(s) | Modelo/Esforço | Status |
|---|---|---|---|---|
| 5.1 | Auditoria final: confirmar cobertura de FK das Camadas 2 e 4, ponta a ponta | `tools/auditoria_fk_final.js`, `tools/sql/2026-08_auditoria_fk_final.sql`, `docs/CAMADA5_AUDITORIA_FK.md` | Opus / alto | ✅ **feita em 26/08/2026** — achou 6 lacunas de caminho de escrita em 3 das 7 FKs; ver "Como o 5.1 ficou" |
| 5.2 | **[humano]** Decidir, tabela a tabela, se dropa a coluna de texto ou mantém como cache | — | José | ✅ **DECIDIDO em 26/08/2026: manter as 7 colunas como cópia, nenhum `DROP`.** Condição explícita: o site deve funcionar 100% pela estrutura nova (FK) — a coluna de texto vira histórico congelado, nunca mais fonte de verdade. Confirmado com a CONSULTA 0/A/B/C rodada em produção depois do 5.5/5.6/5.7: 13/13, 13/13, 0 órfãos, só o placeholder já conhecido. Ver nota no topo de `docs/CAMADA5_AUDITORIA_FK.md`. |
| 5.3 | Migrações de `DROP COLUMN` onde decidido em 5.2 | sql | — | ⛔ **SEM EFEITO — decisão do 5.2 foi manter, não dropar.** Não é "adiado", não vai acontecer (a menos que uma decisão nova troque a de 26/08/2026). |
| 5.4 | Atualizar `PADRAO_TABELA.md`/`GOVERNANCA_GOLDEN_RECORD.md` com o novo estado; aposentar `js/responsaveis.js` se não sobrar uso | docs, js | Haiku / baixo | ⏳ não feito — depende do 5.9 fechar primeiro (é só depois que dá pra dizer se `js/responsaveis.js` ainda tem uso: `minhas-acoes.html` ainda usa `RESP.mapearTexto` pro texto livre de `n.guardiao`, fora do escopo de qualquer item numerado até aqui) |
| 5.5 | **Fechar a porta de escrita do 2.1:** `editor.html`/`js/db-projetos.js` gravam `nucleo_id` junto com `nucleo` (projeto novo e troca de núcleo na grade) | `editor.html`, `js/db-projetos.js` | — | ✅ em `main` — trocar núcleo na grade e "+ Novo projeto" gravam `nucleo_id` (resolvido pelo golden record `meta_inovacao_nucleos`, item 0.5) junto com o texto. Detalhe abaixo. |
| 5.6 | **Fechar a porta de escrita do 2.6:** ação nova em `editor.html` grava `meta_inovacao_plano_responsaveis` junto com `responsavel_id` (`text[]`) | `editor.html`, `js/db-plano-responsaveis.js` (novo) | — | ✅ em `main` — escopo real era menor que os 4 arquivos listados originalmente (ver nota abaixo); `responsavel_id` nascia sempre `[]` em "Nova atividade", agora resolve o texto digitado contra a lista canônica e grava a junção. `plano-acao.html`/`minhas-acoes.html`/`js/db-plano.js` não tinham porta de escrita pra fechar. |
| 5.7 | **Fechar a porta de escrita do 2.7:** `js/db-corsario.js` grava `projeto_id`/`nucleo_id` em `criar()` e `criarIniciativa()` | `js/db-corsario.js`, `editor.html` | — | ✅ em `main` — as 3 portas de escrita do Corsário ("+ Nova iniciativa" própria, criar linha de status faltante, e a semeadura automática que "+ Novo projeto" dispara) agora resolvem e gravam as duas FKs. Detalhe abaixo. |
| 5.8 | **[humano]** Rodar a recuperação de `corsario_status.nucleo_id` (estava `0/4` em produção) | `tools/sql/2026-08_corsario_status_nucleo_id_recuperacao.sql` | José | ✅ **RODADO em produção em 26/08/2026** — SEÇÃO 1 (diagnóstico): os 4 núcleos do corsário casaram por igualdade normalizada (acento/caixa — ex. "startups" → "Startups"), nenhum "SEM CORRESPONDENTE"; SEÇÃO 2 populou; SEÇÃO 3 confirmou 4/4, zero linhas sem correspondente no catálogo. Ver nota abaixo. |
| 5.9 | **Migrar TODA a leitura que ainda decide por texto pra ler pela FK/golden record** — deixou de ser "pré-requisito do 5.2" e virou o objetivo real da Camada 5, por decisão do 5.2 (26/08/2026: nunca dropar, mas o site tem que rodar 100% pela estrutura nova). 7 partes, Modelo/Esforço PRÓPRIO de cada uma — ver "Quebra recomendada do 5.9" abaixo, não é um item único. | `js/db-urc.js` (guardrail), `projetos.html`, `index.html`, `js/busca.js`, `js/drawer.js` (fora de `participantes.html`), telas do canva (`canva-*.html`), tela(s) a definir pro item 7 | ver quebra por parte abaixo — as 7 partes já têm Modelo/Esforço definido (26/08/2026); só o escopo exato da parte 7 (qual tela) ainda falta confirmar antes de codar | 🔄 **EM ANDAMENTO** — partes 1 (guardrail `nomeEhLideranca()`), 2 (`projetos.html`), 3 (`index.html`) e 4 (`js/drawer.js` nas demais páginas) ✅ em 26/08/2026 (PRs #17/#18); partes 6 (`js/busca.js`, Opção A) e 7 (`plano_responsaveis`, construir) **decididas** mas ainda `⏳ NÃO CODADAS`; falta a parte 5 (telas do canva), maior escopo da lista |

### Como o 5.5 ficou

- `js/db-projetos.js`: `linhaParaProjeto`/`projetoParaLinha` passam a carregar/gravar
  `nucleo_id`, mesmo padrão de passthrough dos demais módulos `js/db-*.js` com FK
  (`pessoa_id` em `js/db-urc.js`, item 4.2).
- `editor.html` ganhou `js/db-nucleos.js` (não estava carregado antes — `NUCLEOS_VALIDOS`
  era só um array de texto fixo, sem tabela por trás nesta tela) e um helper
  `nucleosPorNome()`, memoizado, reaproveitado pelo 5.7 também. Trocar o `<select>` de
  núcleo de um projeto existente grava `nucleo`+`nucleo_id` no mesmo patch (padrão
  "select-com-sincronia-de-texto" do item 4.2); "+ Novo projeto" grava os dois desde a
  criação.
- Como `NUCLEOS_VALIDOS` é o mesmo texto exato de `meta_inovacao_nucleos.nome`
  (confirmado pela CONSULTA 0 do 5.1 — nenhuma migração ficou pra trás), a resolução é
  igualdade simples, sem régua de normalização.

### Como o 5.7 ficou

- `js/db-corsario.js`: `linhaParaStatus` passa a ler `projeto_id`/`nucleo_id`; `criar()`
  e `criarIniciativa()` ganham os dois campos no payload, ambos OPCIONAIS de propósito —
  nem toda linha de `corsario_status` corresponde a um projeto do golden record (o botão
  "+ Nova iniciativa" do próprio conjunto Corsário cria iniciativa livre, sem exigir
  vínculo com `meta_inovacao_projetos`), então uma FK não resolvida nasce `null`, nunca
  errada.
- `editor.html` ganhou `projetoIdPorIniciativa()` (resolve por igualdade exata de
  `iniciativa`, mesma régua do `UPDATE` original de
  `tools/sql/2026-08_corsario_status_fk.sql`, reaproveitando o MESMO cache global
  `projetosAtual` que a aba "Projetos & Representantes" usa) — as 3 portas de escrita do
  Corsário passam a resolver as 2 FKs antes de gravar:
  1. "+ Nova iniciativa" (conjunto Corsário) — resolve por nome, pode dar `null` se a
     iniciativa não existir no golden record.
  2. Criar linha de status faltante (1ª avaliação de um critério numa iniciativa já
     existente) — mesma resolução por nome; a iniciativa já existe no Corsário, então
     tende a bater com o golden record (era 27/27 na CONSULTA A do 5.1).
  3. A semeadura automática que "+ Novo projeto" dispara (`criarProjeto()`, já existia
     desde antes do 4.1) — não precisa resolver nada por nome: o projeto acabou de
     nascer, `criado.db_id`/`criado.nucleo_id` (este já gravado pelo 5.5) vão direto.

### Como o 5.6 ficou — escopo menor que o listado originalmente

A auditoria do 5.1 registrou 4 arquivos (`plano-acao.html`, `minhas-acoes.html`,
`editor.html`, `js/db-plano.js`). Investigando pra implementar, nenhum dos dois
primeiros GRAVA `responsavel_id` — o `<select>` de "Responsável" de `plano-acao.html`
escreve em `plano_acao_atividades.responsavel` (texto, outra tabela, atividades DENTRO
de uma iniciativa) e `minhas-acoes.html` é só leitura ("Ver como"). A única porta de
escrita de `meta_inovacao_plano_acoes.responsavel_id` no site inteiro é "Nova atividade"
em `editor.html` — e ela gravava `responsavel_id: []` fixo, **mesmo quando o campo
"Responsável" (texto livre) vinha preenchido**: os dois já nasciam desacoplados antes
mesmo de chegar em `meta_inovacao_plano_responsaveis`. Fechar essa porta é o que o 5.6
resolve; não existe "troca de responsável" pra fechar nas outras telas porque essa
funcionalidade não existe hoje (fica pra quando/se for criada).

- `js/db-plano-responsaveis.js` (novo) — CRUD da junção `meta_inovacao_plano_responsaveis`
  (item 2.6), mesmo padrão de `js/db-projeto-representantes.js`: `carregar`/`criar`/
  `removerSoft`/`porPlanoAcao`, sem seed local (a tabela nasceu na Camada 2).
- `editor.html`: "Nova atividade" resolve o texto digitado em "Responsável" contra
  `window.DB.responsaveis` via `RESP.mapearTexto()` (mesma função que `js/drawer.js` já
  usa) e grava o resultado em `responsavel_id` — antes disto ficava sempre `[]`. Depois
  de criar a ação, `gravarPlanoResponsaveis()` traduz cada id (antigo OU
  `pessoa:<id>`/`coletivo:<id>`, os dois já resolvem desde o item 4.3) pro par
  pessoa_id/coletivo_id via `DB_RESPONSAVEIS.encontrar()` (`js/db-responsaveis.js`, que
  "já sabe traduzir id antigo → pessoa/coletivo golden" — não precisou de lógica nova) e
  grava um vínculo por responsável, best-effort por id (mesmo padrão de sincronia dos
  itens 4.1/4.2: uma falha num vínculo não desfaz a ação já criada).
- `editor.html` ganhou `js/db-coletivos.js` e `js/db-responsaveis.js` (não estavam
  carregados antes nesta tela).
- `plano-acao.html`/`minhas-acoes.html`/`js/db-plano.js` **não precisaram de nenhuma
  mudança** — `js/db-plano.js` já lia/gravava `responsavel_id` como passthrough desde
  antes (o campo nunca foi removido do payload, só nascia vazio no único lugar que cria
  ação nova).

Testado: `node --check` nos 3 arquivos `.js` tocados/novos; smoke test num Chromium
headless local (`editor.html?semrede=1`, alterna entre os conjuntos "projetos",
"corsario" e "plano", abre "Nova atividade" e preenche) sem exceção JS nenhuma; suíte
existente que toca `editor.html` continua verde
(`testar_editor.js`, `testar_projetos_editor_representantes_headless.js`,
`testar_urc_editor_headless.js`, `testar_drawer_headless.js` — mesmos 2 cenários de
rede real já documentados como falha esperada sem egress). **Não existe teste headless
dedicado pras abas "Projetos"/"Corsário"/"Nova atividade" do editor.html** (era lacuna
antes deste item também) — ponta solta não bloqueante, mesmo padrão de outras já
registradas neste plano.

### Quebra recomendada do 5.9 — uma tela por vez, mesmo padrão dos itens 4.1–4.4

Não numerada individualmente de propósito (evita já fixar um escopo que pode mudar
quando alguém for mexer de verdade) — é um roteiro, não um contrato. Ordem sugerida,
do mais contido pro mais espalhado. **Modelo/Esforço por parte (26/08/2026, a pedido —
mesma régua da legenda do topo do documento):**

- **Haiku / baixo** — parte 4: mecânico, zero lógica nova (o código já existe, só falta
  ativá-lo).
- **Sonnet / baixo** — partes 1 e 6: 1 arquivo, escopo contido. A parte 1 porque o dado
  que falta já existe desde o item 4.2; a parte 6 (`js/busca.js`) porque José decidiu a
  Opção A (26/08/2026) — só troca o link do resultado, não a lógica de busca.
- **Sonnet / médio** — partes 2, 3 e 7: mexem em tela + dado junto. As partes 2/3
  reaproveitam o mesmo padrão de junção já resolvido em 4.1/4.4, não inventam nada
  novo; a parte 7 (`meta_inovacao_plano_responsaveis`) José decidiu construir
  (26/08/2026), mas o escopo exato — qual tela, qual mudança visível — ainda não foi
  definido (ver "Nota de escopo — item 7" logo abaixo da lista).
- **Sonnet / alto** — parte 5: maior escopo, território que nenhum item anterior
  percorreu (nenhuma tela lê essas 4 FKs hoje, não tem padrão pronto pra copiar).

1. **Guardrail `nomeEhLideranca()` (`js/db-urc.js`, item 2.3/2.4)** — `Sonnet / baixo`.
   Hoje compara nome de texto contra a lista de liderança; trocar pra comparar
   `pessoa_id` fecha a última ponta solta que o item 4.2 deixou registrada. Menor
   escopo, 1 arquivo. **✅ em 26/08/2026** — `nomeEhLideranca(campos, liderancaAtual)`
   agora recebe o objeto de campos inteiro (não só `nome`) e compara `pessoa_id` quando
   os dois lados (o patch e a linha de liderança) têm a FK preenchida; só cai pro texto
   (`nome`) quando falta `pessoa_id` de um dos lados (cadastro antigo sem vínculo, ou o
   seed local de `data/urc.js`, que nunca teve `pessoa_id`) — assim o guardrail não
   deixa passar o caso de nome curto/completo divergirem pra mesma pessoa (`nome` da
   liderança vs. `nome` do responsável de canal podem ser textos diferentes mesmo sendo
   o mesmo `pessoa_id`). `salvarResponsavel`/`criarResponsavel` (ambos em
   `js/db-urc.js`) passaram a chamar `nomeEhLideranca` com `campos`/`rParcial` inteiro
   em vez de só `.nome`. Testado: `node --check js/db-urc.js`;
   `tools/testar_urc_editor_headless.js` (guardrail continua bloqueando, cenário 4) e
   `tools/auditoria_fk_final.js` (2.3/2.4 continuam `OK`, zero lacuna nova) verdes.
2. **`projetos.html`** — `Sonnet / médio`. Hoje mostra núcleo e representantes de cada
   projeto lendo só `p.nucleo`/`p.representantes` (texto). Passa a ler `DB_PROJETOS` (já
   expõe `nucleo_id` desde o 5.5) + `DB_PROJETO_REPRESENTANTES`/`DB_PESSOAS` (mesma
   junção que `editor.html`/`js/drawer.js` já usam desde 4.1/4.4) — reaproveita padrão
   pronto, não inventa nada novo. **✅ em 26/08/2026** — `projetos.html` ganhou
   `js/db-nucleos.js`, `js/db-projeto-representantes.js`, `js/db-pessoas.js` e
   `data/nucleos.js` (nenhum carregado antes nesta tela). Duas funções novas,
   `nucleoNome(p)` e `representantesDoProjeto(p)`: a primeira resolve `p.nucleo_id` em
   `meta_inovacao_nucleos` e cai pro texto `p.nucleo` quando a FK não resolve; a segunda
   resolve a junção `meta_inovacao_projeto_representantes` → `meta_inovacao_pessoas`
   (nome `nome_exibicao || nome`) por `p.db_id` e cai pro texto `p.representantes`
   quando não há vínculo golden — mesmo princípio de "convivendo" de
   `representantesHtml()` em `js/drawer.js` (item 4.4). Agrupamento por núcleo, filtro,
   busca e a contagem "Pessoas envolvidas" (que já excluía o placeholder "Núcleo de X")
   passam a usar as duas funções em vez de ler `p.nucleo`/`p.representantes` direto.
   Testado: `tools/testar_projetos_headless.js` (cenário offline, sem regressão — segue
   lendo o texto, porque o seed local não tem `nucleo_id`/`db_id`) e o novo
   `tools/testar_projetos_golden_headless.js` (cenário online com dublê de Supabase:
   projeto com `nucleo_id`/vínculo mostra o núcleo/representante golden, não o texto
   legado propositalmente diferente do cenário; projeto sem FK/vínculo continua no
   texto legado) verdes; `tools/auditoria_fk_final.js` continua `OK`, zero lacuna nova.
3. **`index.html`** — `Sonnet / médio` (tende a ser mais raso que a parte 2 — só núcleo,
   não representantes — mas fica no mesmo grupo por semelhança de trabalho). KPIs/
   agrupamentos que citam núcleo por projeto; mesma migração do item 2 acima, olhando
   onde ele lê `projetos.js`/`window.DB.projetos`. **✅ em 26/08/2026** — `index.html`
   ganhou `js/db-nucleos.js` e `data/nucleos.js` (nenhum carregado antes nesta tela).
   A seção "Composição do portfólio" (`nucleosProj`/`porNucleo`, mini-breakdown "núcleo
   — N projetos") passa a usar `nucleoNome(p)` (mesma função de `projetos.html`, parte
   2: resolve `p.nucleo_id` em `meta_inovacao_nucleos` via `DB_NUCLEOS`, cai pro texto
   `p.nucleo` quando a FK não resolve) em vez de ler `p.nucleo` direto — escopo
   deliberadamente menor que a parte 2: representantes/"Gestores de projetos"/
   pendências (que também leem `p.representantes`) ficam de fora, como já registrado
   acima. Testado: `tools/testar_dashboard_headless.js` (cenário offline, sem
   regressão — o seed local não tem `nucleo_id`) e o novo
   `tools/testar_dashboard_golden_headless.js` (cenário online com dublê de Supabase:
   projeto com `nucleo_id` mostra o núcleo golden na composição do portfólio, não o
   texto legado propositalmente diferente do cenário; projeto sem `nucleo_id` continua
   no texto legado) verdes; `tools/auditoria_fk_final.js` continua `OK`, zero lacuna
   nova.
4. **`js/drawer.js` fora de `participantes.html`** — `Haiku / baixo`. O item 4.4 só
   carregou os módulos novos nessa página; os demais lugares que abrem o painel de
   iniciativa (`plano.html`, `demandas.html`, `corsario.html`, `projetos.html`)
   continuam no fallback de texto por falta dos scripts, não por limitação do código —
   só carregar `js/db-projeto-representantes.js`+`js/db-pessoas.js` nessas páginas já
   ativa o join que o 4.4 escreveu. Literalmente 2 linhas de `<script>` por página.
   **✅ em 26/08/2026** — `plano.html`, `demandas.html` e `corsario.html` agora têm os
   dois módulos carregados. `projetos.html` já tinha (adicionado na parte 2). O painel
   de iniciativa funciona em todas essas páginas ao abrir o drawer: mostra representantes
   do golden record quando há vínculo, cai pro texto legado quando não há. PR #18 merged.
5. **Telas do canva (`canva-*.html`)** — `Sonnet / alto`. As 4 FKs do item 2.5
   (`nucleo_id`, `canal_id`, `facilitador_pessoa_id`, `responsavel_pessoa_id`) já são
   gravadas pelas RPCs desde a Camada 2, só não são lidas por ninguém ainda — maior
   escopo desta lista, telas inteiras de exibição pra revisar.
6. **`js/busca.js`** — `Sonnet / baixo`. **Decidido por José (26/08/2026): Opção A.** A
   lógica de busca NÃO muda — continua comparando o texto digitado com o texto salvo
   (é assim que busca deveria funcionar mesmo). O que muda é só o link/clique do
   resultado: quando o item encontrado tiver uma FK correspondente disponível (ex.:
   representante de projeto com `pessoa_id` resolvido), o link passa a apontar por ela
   em vez de depender do texto puro — mesmo espírito de `spanPessoaGolden()`/
   `representantesHtml()` que o item 4.4 já criou em `js/drawer.js`, possivelmente
   reaproveitável aqui. Risco baixo, ganho pequeno, por decisão explícita — não é pra
   crescer escopo tentando "resolver" a busca em si.
7. **`meta_inovacao_plano_responsaveis` (2.6)** — `Sonnet / médio`. **Decidido por José
   (26/08/2026): construir.** Escopo exato (que tela mostra o quê, a partir da junção)
   ainda não foi definido em detalhe — próxima sessão que pegar este item deve validar
   com José o que exibir antes de codar, não presumir. Ver "Nota de escopo — item 7"
   logo abaixo de propósito, pra registro do que ficou combinado até aqui.

**Nota de escopo — item 7 (aberta em 26/08/2026):** José decidiu construir a leitura de
`meta_inovacao_plano_responsaveis`, mas ainda não definiu ONDE/O QUÊ mostrar. Antes de
codar, a sessão que pegar este item deve confirmar com José algo do tipo: "qual tela e
qual mudança visível" — por exemplo, `plano-acao.html`/`minhas-acoes.html` passarem a
ler a junção em vez do texto `responsavel_id` (mesmo requisito de leitura-pela-FK dos
outros itens do 5.9, sem tela nova) OU uma visão nova (ex. "carga por responsável golden"
em `minhas-acoes.html`/`index.html`). Não presumir qual das duas.

A aposentadoria de `meta_inovacao_matriz_demandas` (decidida no 3.5) entra aqui.

**Teste de aceite:** suíte de testes headless inteira verde; nenhuma tela lê mais
texto legado como fonte de verdade — a coluna continua existindo (decisão do 5.2:
manter como cópia, nunca `DROP`), só não é mais consultada por código nenhum.

### Como o 5.1 ficou

Relatório completo em `docs/CAMADA5_AUDITORIA_FK.md`. O resumo:

**"Ponta a ponta" virou três perguntas, não uma** — e só a primeira era sobre o
banco:

- **A. as linhas que já existem têm a FK?** Retrato do banco. Não dá pra medir
  daqui (sem rede pro Supabase) nem pela anon key (a RLS de
  `meta_inovacao_canva_demandas` fecha o SELECT de propósito). Virou
  `tools/sql/2026-08_auditoria_fk_final.sql`: só leitura, 4 blocos (existência das
  colunas → cobertura por FK → integridade → a lista nominal do que ficou sem FK),
  veredito `OK`/`DIVERGE`/`ATENÇÃO` linha a linha, no mesmo formato do diagnóstico
  da Camada 3. Pra José rodar no SQL Editor.
- **B. as linhas que ainda vão existir vão NASCER com a FK?** Isso é propriedade do
  CÓDIGO, não do banco — dá pra medir offline, e é o que
  `node tools/auditoria_fk_final.js` faz: percorre toda porta de entrada de linha
  nova de cada uma das 7 FKs e confere se a FK entra na escrita.
- **C. alguma tela LÊ a FK?** Se não lê, a coluna de texto continua sendo a fonte
  de verdade do site, por mais completa que a FK esteja — e o `DROP` do 5.3
  quebraria tela.

**O que a auditoria achou:** 6 lacunas de escrita, em 3 das 7 FKs — `2.1`
(`projetos.nucleo_id`), `2.6` (`plano_responsaveis`) e `2.7` (`corsario_status`).
Nenhuma tela grava essas três, então **elas derivam desde 22/08**: todo projeto
novo, toda ação nova e toda iniciativa nova do corsário nasce sem FK. As outras 4
(2.2, 2.3, 2.4, 2.5) estão fechadas — as três primeiras pelos itens 4.1/4.2, a
última pela reescrita de `cc_canva_gravar`/`cc_canva_editar` no próprio 2.5.

Não é contradição com a Camada 4: as 3 FKs em deriva são exatamente as que ela
nunca listou. O item 4.3, em particular, mudou de onde o `<select>` de responsável
tira a LISTA (golden record), sem mudar o que ele GRAVA (`responsavel_id`, texto) —
está escrito "sem migração" na própria linha dele. A auditoria só mostra o que
sobrou fora do escopo.

**Por que o 5.2 não começou:** o veredito é que **nenhuma** coluna de texto está
pronta pro `DROP`. Nas três em deriva, porque a FK está atrasada em relação ao
texto — chamar o texto de "cache" seria inverter quem é fonte de verdade. Nas
outras quatro, porque a leitura ainda não migrou: `participantes.html`,
`projetos.html`, `index.html`, `js/busca.js`, o guardrail `nomeEhLideranca()` e as
telas do canva continuam decidindo por texto. A decisão madura hoje não é "dropa
ou mantém", é "fecha a porta ou aceita a deriva" — daí os itens 5.5, 5.6 e 5.7.
Nenhum dos três é migração de banco: as colunas existem e estão populadas.

**O `--check` é o que impede a auditoria de envelhecer:** ele não falha por causa
das 6 lacunas conhecidas (elas estão registradas em `LACUNAS_REGISTRADAS`, no
próprio script) — falha quando o CONJUNTO muda, nos dois sentidos: lacuna nova
(uma tela regrediu, ou nasceu uma porta de entrada sem FK) ou lacuna registrada
que sumiu sem ninguém dar baixa aqui e no relatório. É o corolário do 2.5 aplicado
a código: item que ficou pra trás vira linha com status, nunca linha removida.

O SQL foi testado num Postgres 16 local com schema mínimo espelhando produção, em
dois estados: saudável (todos `OK`, e a única linha da lista nominal é o
placeholder "Núcleo de Startups", igual produção) e degradado de propósito com as
6 lacunas semeadas (cada uma virou `DIVERGE`/`ATENÇÃO` na linha certa).

### O que a rodada em produção devolveu (26/08/2026)

José rodou as 4 consultas no SQL Editor no mesmo dia. Números completos em
`docs/CAMADA5_AUDITORIA_FK.md`; o que muda o plano:

- **CONSULTA 0: 13/13 `OK`** — nenhuma migração das Camadas 2/4 ficou pra trás.
- **CONSULTA A: 12 de 13 `OK`.** Os números de 22–23/08 se sustentaram (28/28,
  34 vínculos, 3/3, 11/11, 61/61, 27/27). Ou seja: as 3 lacunas de escrita ainda
  **não** derrubaram a cobertura — não entrou projeto, ação nem iniciativa nova
  desde 22/08. A porta segue aberta; a próxima linha nova é que cai fora.
- **CONSULTA A, o único `DIVERGE`: `corsario_status.nucleo_id` está `0/4`** — vazia
  em todas as linhas, embora `projeto_id` esteja 27/27 na mesma tabela e as duas
  colunas tenham vindo do mesmo `ALTER TABLE`. É a única linha hedgeada de
  `CAMADA2_COBERTURA_FK.md` cobrando o hedge: a verificação (b) do script original
  devolvia "vazio" ambíguo (uma linha com célula em branco lê-se como nenhuma
  linha). Virou o item **5.8**, com script de recuperação pronto e testado — **rodado
  em produção no mesmo dia (26/08/2026): SEÇÃO 1 achou os 4 núcleos por igualdade
  normalizada (nenhum "SEM CORRESPONDENTE", não era cadastro faltando), SEÇÃO 2/3
  confirmaram 4/4.** Item fechado, ver a linha do 5.8 na tabela da Camada 5.
- **CONSULTA B: 10/10 `OK`** — nenhuma FK apontando pra linha soft-deleted, nenhum
  texto discordando da FK.

**Um falso positivo da primeira versão, corrigido:** a auditoria acusou 8 tokens de
`representantes[]` sem pessoa golden (e um "34/27" sem sentido) porque comparava só
`nome`, enquanto a migração 2.2 casa por `nome` OU `nome_exibicao` mais o alias
"Júnior" → "JR.". Os 8 tinham casado por `nome_exibicao`. A CONSULTA A e a
CONSULTA C agora reusam literalmente a régua da verificação (a) de
`2026-08_projeto_representantes.sql`. A regra que fica: **régua de casamento só
serve pra auditar se for a MESMA que populou** — com régua própria, a auditoria
mede a régua, não o dado.

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

1. **Camadas 0, 1 e 2 estão 100% em produção**, testadas e confirmadas linha a linha por
   José no SQL Editor — incluindo o item 2.5 (`tools/sql/2026-08_canva_demandas_fk.sql`),
   rodado em 23/08/2026, ver nota na Camada 2 pros números reais. Todos os scripts SQL
   estão em `meta-monitor/tools/sql/2026-08_*.sql` e não precisam rodar de novo.
2. **Camada 3 está 100% concluída:** 3.1 (tabela + migração), 3.2 (grade dinâmica), 3.3
   (aba "matriz" do `editor.html` lendo ao vivo, só leitura, com snapshot gerado do
   mesmo modelo de `demandas.html`), 3.4 (testes headless) e **3.5 (validação humana em
   produção por José, concluída em 26/08/2026, sem divergência)** — ver "Como ficou a
   validação do 3.5" na seção da Camada 3. `meta_inovacao_matriz_demandas` (tabela
   antiga) pode ser considerada congelada; sua aposentadoria formal entra na Camada 5.
3. **Camada 4 concluída (26/08/2026):** o item 4.1 (`editor.html` "Projetos & Representantes" —
   texto livre virou seletor de pessoa, chip + `<select>`, sobre a junção
   `meta_inovacao_projeto_representantes` do item 2.2), o item 4.2 (`editor.html`
   "URC — Liderança"/"URC — Responsáveis por canal" — texto livre virou `<select>` de
   pessoa golden, `pessoa_id` dos itens 2.3/2.4, e o `<select>` de canal já existente
   passou a manter `canal_id` em sincronia), o item 4.3 (`plano-acao.html`/
   `minhas-acoes.html` — select de "Responsável"/"Ver como" passa a ler
   `DB_PESSOAS`+`DB_COLETIVOS`, `js/db-responsaveis.js` novo, sem migração — os ~32 ids já
   gravados no Supabase são preservados exatamente) e o item 4.4 (`js/drawer.js`: painel de
   iniciativa lê a mesma junção do 2.2 em vez de `proj.representantes` (text[]) quando a
   página carrega os módulos certos — hoje só `participantes.html`; nas demais páginas cai
   pro texto livre de sempre, sem quebrar) estão em `main`. Ver "Como o 4.1 ficou", "Como o
   4.2 ficou", "Como o 4.3 ficou" e "Como o 4.4 ficou" na seção da Camada 4 — os padrões de
   chip+select, select-com-sincronia-de-texto, lista-derivada-do-golden-record e
   bloco-assíncrono-com-fallback-de-texto criados ali servem de referência pra Camada 5.
4. **Camada 5 em andamento (26/08/2026) — 5.1, 5.5, 5.6, 5.7 e 5.8 feitos, 5.2 ainda
   não maduro:** o item 5.1 (auditoria final) está feito —
   `tools/auditoria_fk_final.js` (caminho de escrita + leitores, offline),
   `tools/sql/2026-08_auditoria_fk_final.sql` (cobertura real, pra José rodar no SQL
   Editor) e `docs/CAMADA5_AUDITORIA_FK.md` (o relatório, com o veredito de 26/08 — não
   inclui os itens 5.5/5.6/5.7 já fechados depois, então uma releitura literal do
   relatório soa mais pessimista do que o estado atual). O que ele achou: as FKs de
   `meta_inovacao_projetos.nucleo_id` (2.1), `meta_inovacao_plano_responsaveis` (2.6) e
   `corsario_status` (2.7) não eram gravadas por nenhuma tela — cada projeto/ação/
   iniciativa nova desde 22/08 nascia sem elas. Fechar essas três portas virou os itens
   **5.5, 5.6 e 5.7, todos RESOLVIDOS em `main` no mesmo dia** (ver "Como o 5.5 ficou",
   "Como o 5.7 ficou" e "Como o 5.6 ficou" na seção da Camada 5) — `editor.html` agora
   grava `nucleo_id` (projeto novo/troca de núcleo), `projeto_id`/`nucleo_id`
   (Corsário: 3 portas de escrita) e `meta_inovacao_plano_responsaveis` (ação nova).
   O `DIVERGE` que a rodada em produção achou (`corsario_status.nucleo_id` `0/4`) virou
   o item **5.8, também RESOLVIDO** (`tools/sql/2026-08_corsario_status_nucleo_id_recuperacao.sql`,
   rodado por José em 26/08/2026, SEÇÃO 3 confirmou 4/4).
   **O que falta pra Camada 5:** 5.2 continua travado, agora esperando o item **5.9**
   (novo, aberto 26/08/2026) — fechar a porta de ESCRITA (5.5/5.6/5.7, já feitos) não é o
   mesmo que a LEITURA já ter migrado nas outras telas (`participantes.html`,
   `projetos.html`, `index.html`, `js/busca.js`, o guardrail `nomeEhLideranca()`, as telas
   do canva — ver o "Veredito por coluna de texto" em `docs/CAMADA5_AUDITORIA_FK.md`, que
   ainda reflete o estado de ANTES do 5.5/5.6/5.7). Uma nova rodada da CONSULTA A/C em
   produção (pedida ao José pra confirmar que a escrita fechada não deixou nada pra trás)
   também está pendente — ver checklist enviado a ele em 26/08/2026.
5. Documentos de apoio já existentes, não precisam ser refeitos:
   - `docs/CAMADA1_DEDUPE_PESSOAS.md` — decisões de identidade de pessoas.
   - `docs/CAMADA2_COBERTURA_FK.md` — cobertura real de cada FK da Camada 2.
   - `docs/CAMADA5_AUDITORIA_FK.md` — auditoria final de FK (item 5.1): cobertura,
     caminho de escrita, quem lê cada FK e o veredito por coluna de texto pro 5.2.
   - `docs/PROPOSTA_ESQUEMA_CADASTROS_REFERENCIA.md` — desenho original completo.
   - `docs/GOVERNANCA_GOLDEN_RECORD.md` — governança do golden record de *projetos*
     (frente irmã, concluída antes desta).
6. Ferramentas desta frente que já existem — use em vez de reinventar:
   - `tools/auditoria_fk_final.js` — auditoria final (item 5.1): por FK das Camadas 2/4,
     se toda porta de entrada de linha nova grava a FK e quem lê a FK hoje. Offline;
     `--check` sai != 0 quando o conjunto de lacunas muda (nos dois sentidos).
   - `tools/sql/2026-08_auditoria_fk_final.sql` — a outra metade do item 5.1: cobertura
     real das linhas existentes, integridade (FK apontando pra linha soft-deleted, FK
     que discorda do texto) e a lista nominal do que ficou sem FK. Só leitura, 4 blocos,
     veredito por linha.
   - `tools/relatorio_cobertura_fk.js` — cobertura de FK da Camada 2, contra produção.
   - `tools/conferir_matriz_celulas.js` — matriz nova × antiga, célula a célula.
   - `tools/sql/2026-08_matriz_celulas_diagnostico.sql` — schema/RLS/realtime da
     Camada 3, só leitura, com veredito por checagem.
   - `tools/testar_matriz_headless.js` — 11 cenários da grade dinâmica.
   - `tools/testar_matriz_editor_headless.js` — fiação da aba "matriz" do `editor.html`:
     carrega ao vivo, coluna por `ordem`, canal novo, só leitura, e o snapshot batendo
     chave a chave com o de `demandas.html`.
   - `tools/testar_projetos_editor_representantes_headless.js` — aba "Projetos &
     Representantes" do `editor.html` (item 4.1): vínculo vira chip, adicionar/remover
     grava o vínculo e sincroniza `representantes[]` (texto legado), offline e online
     (dublê de Supabase).
   - `tools/testar_urc_editor_headless.js` — abas "URC — Liderança"/"URC —
     Responsáveis por canal" do `editor.html` (item 4.2): `<select>` de pessoa
     pré-selecionado pelo `pessoa_id`, trocar grava `pessoa_id`+`nome` (texto legado),
     trocar canal grava `canal_id`, guardrail do item 4.4 continua valendo, "+ Adicionar
     responsável" grava as 4 colunas a partir dos 2 `<select>` do topo — offline e online
     (dublê de Supabase).
   - `tools/testar_responsaveis.js` — `js/db-responsaveis.js` (item 4.3): puro, sem DOM;
     monta a lista de responsáveis a partir do golden record, ids antigos (LEGADO)
     preservados, jr/jose_mendes_junior e sandra/sandra_chaves_paraiso colapsados, pessoa/
     coletivo golden fora do LEGADO ganha id novo.
   - `tools/testar_plano_acao_responsavel_headless.js` — `plano-acao.html` (item 4.3):
     `<select>` de "Responsável" lendo pessoas+coletivos do golden record, id antigo e
     apelido antigo pré-selecionam a mesma opção, texto sem tradução vira "legado", pessoa
     fora da lista estática aparece — dublê de Supabase, sem rede real.
7. **Pendências não bloqueantes acumuladas:** UI de múltiplos papéis por pessoa em
   `editor.html` (Camada 1); "Oficina confirmada"/"Não se aplica o
   uso" fora do `CHECK` (Camada 3). **As duas falhas antigas da suíte
   (`testar_status_badges_headless.js` e `testar_drawer_headless.js`) foram corrigidas em
   22/08 (PR #10)** — a suíte do README está verde. Num ambiente sem rede de saída pro
   Supabase, 2 asserções do drawer falham por isso e só por isso.
8. **Toda migração SQL é rodada manualmente por José no SQL Editor do Supabase** —
   nenhuma automação tem acesso de escrita à produção. As sessões do Claude Code também
   **não conseguem LER** o Supabase de produção (rede bloqueada pra `supabase.co`): todo
   teste de migração é feito num Postgres local simulando o estado de produção antes de
   entregar o script pra José rodar de verdade. Quando precisar saber algo do banco real,
   o caminho é gerar uma consulta pra José rodar — como o diagnóstico da Camada 3 — e não
   supor.
