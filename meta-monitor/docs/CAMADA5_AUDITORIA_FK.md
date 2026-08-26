# Camada 5, item 5.1 — auditoria final de FK das Camadas 2 e 4, ponta a ponta

**Rodada em 26/08/2026.** Entrada do item 5.2 (a decisão humana, tabela a tabela,
de dropar ou manter cada coluna de texto).

> **Veredito em uma linha: nenhuma coluna de texto legado está pronta pro `DROP`
> hoje.** Não por falta de cobertura — a cobertura histórica das Camadas 0–2 é a
> que José confirmou linha a linha em 22–23/08 e continua registrada em
> `CAMADA2_COBERTURA_FK.md`. É por causa das outras duas pontas: **3 das 7 FKs
> não são gravadas por nenhuma tela** (linha nova nasce sem FK) e **4 das 7 não
> são lidas por nenhuma tela** (o site ainda decide tudo pelo texto). Dropar o
> texto dessas trocaria dado velho por dado ausente.

## O que "ponta a ponta" quer dizer aqui

Confirmar cobertura de FK tem três perguntas, não uma. As três precisam fechar
antes do 5.3, e cada uma tem um instrumento próprio:

| Pergunta | Instrumento | Roda onde |
|---|---|---|
| **A.** As linhas que JÁ EXISTEM têm a FK preenchida? | `tools/sql/2026-08_auditoria_fk_final.sql` (só leitura, veredito por FK) | SQL Editor do Supabase, por José |
| **B.** As linhas que AINDA VÃO EXISTIR vão nascer com a FK? | `node tools/auditoria_fk_final.js` | offline, em qualquer máquina — é propriedade do código |
| **C.** Alguma tela LÊ a FK, ou o texto continua sendo a fonte? | o mesmo `node tools/auditoria_fk_final.js` | idem |

A pergunta B é a que o item 2.5 já tinha ensinado a fazer: lá, popular as 4 FKs
sem reescrever `cc_canva_gravar`/`cc_canva_editar` teria produzido um retrato
100% que caía sozinho a cada oficina nova. O mesmo raciocínio, aplicado às outras
6 FKs, é o que esta auditoria acrescenta. A pergunta C é a que decide se o `DROP`
do 5.3 quebra tela: FK completa que ninguém lê não substitui o texto, só convive
com ele.

## A — cobertura das linhas existentes

**Não foi remedida nesta rodada, e não dava pra remedir daqui:** as sessões do
Claude Code não alcançam `supabase.co` (item 7 do "Status por camada" do plano),
e a anon key do `relatorio_cobertura_fk.js` não enxerga
`meta_inovacao_canva_demandas` de jeito nenhum (RLS fecha o SELECT pra `anon` de
propósito). O que existe, e continua valendo como último retrato real:

| Item | FK | Cobertura confirmada em produção | Quando |
|---|---|---|---|
| 2.1 | `meta_inovacao_projetos.nucleo_id` | 28/28 | 22/08 |
| 2.2 | `meta_inovacao_projeto_representantes` | 34/35 (o 1 é o placeholder "Núcleo de Startups") | 22/08 |
| 2.3 | `meta_inovacao_urc_lideranca.pessoa_id` | 3/3 | 22/08 |
| 2.4 | `meta_inovacao_urc_canais_responsaveis.canal_id`/`.pessoa_id` | 11/11 nos dois | 22/08 |
| 2.5 | `meta_inovacao_canva_demandas` (4 FKs) | 3/3 do que tinha texto (`facilitador` era NULL na única linha) | 23/08 |
| 2.6 | `meta_inovacao_plano_responsaveis` | 61/61 | 22/08 |
| 2.7 | `corsario_status.projeto_id`/`.nucleo_id` | 27/27 iniciativas, zero órfãos | 22/08 |

`tools/sql/2026-08_auditoria_fk_final.sql` existe pra transformar essa tabela num
número de hoje, e vai mais longe que o `relatorio_cobertura_fk.js` em três pontos:

1. **Alcança o 2.5** — roda como `postgres` no SQL Editor, então a RLS que cega a
   anon key não se aplica.
2. **Denominador honesto** — conta só as linhas que TÊM o texto de origem. Demanda
   sem `facilitador` preenchido não é buraco de casamento, é ausência de dado;
   somar isso ao denominador produziria um número pessimista e falso.
3. **Checa integridade, não só preenchimento** (CONSULTA B) — FK apontando pra
   linha soft-deleted (a FK do Postgres garante que o id existe, não que a linha
   está viva) e FK que discorda do texto que ela deveria representar. As duas
   coisas precisam ser resolvidas ANTES do 5.3: depois do `DROP` não há mais
   evidência de que discordavam.

O arquivo foi testado num Postgres 16 local com um schema mínimo espelhando
produção, em dois estados: (a) estado saudável — todos os vereditos `OK`, e a
única linha da CONSULTA C é o placeholder "Núcleo de Startups", igual produção;
(b) estado degradado de propósito, semeando exatamente as lacunas de escrita da
seção B abaixo (projeto novo sem `nucleo_id`, iniciativa nova do corsário sem
FK, ação nova sem vínculo, pessoa desligada ainda apontada pela liderança, nome
de texto envelhecido em relação à FK, facilitador fora do golden record) — cada
uma virou `DIVERGE`/`ATENÇÃO` na linha certa e apareceu nominalmente na
CONSULTA C.

## B — caminho de escrita: as linhas novas nascem com FK?

Saída de `node tools/auditoria_fk_final.js` em 26/08/2026. **6 lacunas, em 3 das
7 FKs.**

| Item | FK | Nasce com FK? | Porta de entrada |
|---|---|---|---|
| 2.1 | `projetos.nucleo_id` | ❌ **não** | `editor.html` → `DB_PROJETOS.criar` (única porta de projeto novo no site) e `DB_PROJETOS.salvar` (troca de núcleo na grade) gravam `nucleo` (texto) e só |
| 2.2 | `projeto_representantes` | ✅ sim | item 4.1: chip + `<select>` gravam a junção; projeto novo vincula cada pessoa escolhida; X do chip faz soft delete |
| 2.3 | `urc_lideranca.pessoa_id` | ✅ sim | item 4.2: trocar a pessoa grava `pessoa_id` + `nome` no mesmo patch |
| 2.4 | `urc_canais.canal_id`/`.pessoa_id` | ✅ sim | item 4.2: trocar pessoa, trocar canal e "+ Adicionar responsável" gravam as FKs junto com o texto |
| 2.5 | `canva_demandas` (4 FKs) | ✅ sim | item 2.5: `cc_canva_gravar`/`cc_canva_editar` calculam as 4; nenhuma escrita direta escapa da RPC |
| 2.6 | `plano_responsaveis` | ❌ **não** | nenhum arquivo do site sequer menciona a tabela: ação nova e troca de responsável gravam `responsavel_id` (`text[]`) e só |
| 2.7 | `corsario_status.projeto_id`/`.nucleo_id` | ❌ **não** | `DB_CORSARIO.criar` (primeira avaliação de um critério) e `DB_CORSARIO.criarIniciativa` ("+ Nova iniciativa", 19 linhas de uma vez) não montam as FKs no payload |

Consequência prática: **2.1, 2.6 e 2.7 estão em deriva desde 22/08.** Todo projeto
novo, toda ação nova e toda iniciativa nova avaliada no corsário desde então
entrou sem FK. Os números de produção da seção A já não são mais os de hoje —
quanto derivou é justamente o que a CONSULTA A vai mostrar.

Note que as 3 FKs em deriva são exatamente as 3 que a Camada 4 **não** tocou: os
itens 4.1–4.4 migraram as telas de representantes, URC e responsável de ação, e
o 2.5 se resolveu sozinho na RPC. Não é coincidência nem esquecimento da Camada
4 — o plano dela nunca listou `nucleo_id` de projeto nem `corsario_status`, e o
4.3 mudou de onde o `<select>` de responsável tira a LISTA (golden record) sem
mudar o que ele GRAVA (`responsavel_id`, texto, "sem migração", como está escrito
na própria tabela do item). A auditoria não contradiz a Camada 4; ela mostra o
que sobrou fora do escopo dela.

## C — quem lê cada FK hoje

| Item | FK | Lida por |
|---|---|---|
| 2.1 | `projetos.nucleo_id` | **ninguém** — `linhaParaProjeto()` nem expõe a coluna; o site inteiro lê `nucleo` (texto) |
| 2.2 | `projeto_representantes` | `editor.html` (chips, item 4.1) e `js/drawer.js` (painel de iniciativa, item 4.4) |
| 2.3 | `urc_lideranca.pessoa_id` | `js/db-urc.js` + `editor.html` (`<select>` pré-selecionado, item 4.2) |
| 2.4 | `urc_canais.canal_id`/`.pessoa_id` | `js/db-urc.js` + `editor.html` (item 4.2) |
| 2.5 | `canva_demandas` (4 FKs) | **ninguém** — as telas do canva leem os 4 textos |
| 2.6 | `plano_responsaveis` | **ninguém** |
| 2.7 | `corsario_status.projeto_id`/`.nucleo_id` | **ninguém** |

## Veredito por coluna de texto — a entrada do item 5.2

| Coluna de texto | FK | Escreve | Lê | Pronta pro `DROP` (5.3)? |
|---|---|---|---|---|
| `meta_inovacao_projetos.nucleo` | `nucleo_id` | ❌ | ❌ | **Não.** Nenhuma das duas pontas existe. Dropar quebraria portfólio, busca e a própria grade do editor. |
| `meta_inovacao_projetos.representantes` (`text[]`) | junção 2.2 | ✅ (em paralelo) | parcial | **Não — candidata a "manter como cache".** A junção é a fonte em `editor.html` e no drawer de `participantes.html`, mas `projetos.html`, `index.html`, `js/busca.js` e o drawer das demais páginas ainda leem só o texto. |
| `meta_inovacao_urc_lideranca.nome` | `pessoa_id` | ✅ | ✅ (editor) | **Não ainda.** `participantes.html` e o guardrail `nomeEhLideranca()` comparam por nome. Vira "sim" quando esses dois passarem a casar por `pessoa_id`. |
| `meta_inovacao_urc_canais_responsaveis.canal`/`.nome` | `canal_id`/`pessoa_id` | ✅ | ✅ (editor) | **Não ainda.** Mesmo motivo: `agruparPorCanal()` monta a tela de participantes pelo texto do canal. |
| `meta_inovacao_canva_demandas.nucleo`/`canal`/`facilitador`/`responsavel` | 4 FKs | ✅ (RPC) | ❌ | **Não.** A escrita está resolvida, a leitura não: as telas do canva ainda são inteiramente de texto. |
| `meta_inovacao_plano_acoes.responsavel_id` (`text[]`) | junção 2.6 | ❌ | ❌ | **Não.** A junção está congelada desde 22/08 — nasceu populada e nunca mais recebeu escrita. |
| `corsario_status.iniciativa`/`.nucleo` | `projeto_id`/`nucleo_id` | ❌ | ❌ | **Não.** Mesma situação do 2.1. |

**O que isso significa pro 5.2:** a decisão "dropa ou mantém como cache" ainda não
está madura pra nenhuma das colunas — o que está maduro é a decisão anterior,
"fecha a porta de escrita ou aceita a deriva". Enquanto 2.1/2.6/2.7 não gravarem
FK, o `DROP` do 5.3 nessas três é destrutivo, e a alternativa "mantém como cache"
é enganosa: cache pressupõe que a fonte de verdade está em dia, e nessas três a
FK é que está atrasada em relação ao texto, não o contrário.

## Pendências que esta auditoria abre

Registradas como itens na tabela da Camada 5 do plano (nunca como linha removida —
corolário do 2.5) e no baseline `LACUNAS_REGISTRADAS` de
`tools/auditoria_fk_final.js`:

- **5.5** — `editor.html`/`js/db-projetos.js` passam a gravar `nucleo_id` junto com
  `nucleo` (projeto novo e troca de núcleo na grade). Mesmo padrão de
  "select-com-sincronia-de-texto" que o item 4.2 criou pra URC.
- **5.6** — `plano-acao.html`/`minhas-acoes.html`/`editor.html` passam a gravar
  `meta_inovacao_plano_responsaveis` junto com `responsavel_id` (`text[]`).
  `js/db-responsaveis.js` (item 4.3) já sabe traduzir id antigo → pessoa/coletivo
  golden, que é a parte difícil.
- **5.7** — `js/db-corsario.js` passa a gravar `projeto_id`/`nucleo_id` em
  `criar()` e `criarIniciativa()`. As duas já recebem `iniciativa`/`nucleo` como
  texto vindo do `dataset` do editor — resolver o id é uma consulta ao portfólio
  já carregado em memória.

Nenhuma delas é migração de banco: as colunas existem e estão populadas. É só
fechar a porta de entrada — e enquanto ela não fecha, cada semana derruba um
pouco mais a cobertura que as Camadas 0–2 conquistaram.

## Como reconferir

```bash
node tools/auditoria_fk_final.js          # B e C: caminho de escrita e leitores
node tools/auditoria_fk_final.js --check  # o mesmo, pra suíte: sai != 0 se o
                                          # conjunto de lacunas MUDOU (nos dois
                                          # sentidos — lacuna nova, ou lacuna
                                          # registrada que sumiu sem baixa)
node tools/relatorio_cobertura_fk.js      # A, no que é público (precisa de rede)
```

E, no SQL Editor do Supabase, `tools/sql/2026-08_auditoria_fk_final.sql` — um
bloco por vez (CONSULTA 0 → A → B → C), como manda o cabeçalho do arquivo.
