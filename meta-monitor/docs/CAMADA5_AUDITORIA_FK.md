# Camada 5, item 5.1 — auditoria final de FK das Camadas 2 e 4, ponta a ponta

**Rodada em 26/08/2026.** Entrada do item 5.2 (a decisão humana, tabela a tabela,
de dropar ou manter cada coluna de texto).

> **Atualização (26/08/2026, mesmo dia):** as 6 lacunas de escrita da seção B abaixo
> (itens 5.5, 5.6, 5.7) e o achado de dado da seção seguinte (item 5.8) **foram
> resolvidos** — `node tools/auditoria_fk_final.js --check` já roda limpo (0 lacunas
> registradas, 0 encontradas). O relatório abaixo não foi reescrito porque documenta
> um retrato histórico válido (o que a auditoria encontrou e por quê); o estado atual
> está em `docs/PLANO_EXECUCAO_GOLDEN_RECORD.md`, seção da Camada 5 ("Como o 5.5/5.6/5.7
> ficaram"). **O veredito do 5.2 abaixo ("nenhuma coluna pronta pro DROP") ainda vale**
> — fechar a porta de ESCRITA não resolve a ponta da LEITURA (seção C/veredito abaixo),
> que continua sem migrar nas telas fora do escopo dos itens 4.1–4.4/5.5–5.7. Uma nova
> rodada da CONSULTA A/C em produção ainda não foi pedida — os números de cobertura
> abaixo são de ANTES do 5.5/5.6/5.7 fecharem a escrita.

> **Veredito em uma linha: nenhuma coluna de texto legado está pronta pro `DROP`
> hoje.** Não por falta de cobertura — a CONSULTA A rodada em produção em
> 26/08/2026 deu `OK` em 12 das 13 checagens. É por causa das outras duas pontas:
> **3 das 7 FKs não são gravadas por nenhuma tela** (linha nova nasce sem FK) e
> **4 das 7 não são lidas por nenhuma tela** (o site ainda decide tudo pelo
> texto). Dropar o texto dessas trocaria dado velho por dado ausente.
>
> **E um achado de dado, esse sim pra agora:** `corsario_status.nucleo_id` está
> **0/4 — vazia em todas as linhas**, embora `projeto_id`, criada pelo mesmo
> `ALTER TABLE` e populada pelo `UPDATE` seguinte, esteja 27/27. Script de
> recuperação pronto: `tools/sql/2026-08_corsario_status_nucleo_id_recuperacao.sql`
> (item 5.8).

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

**Medida em produção em 26/08/2026**, com José rodando
`tools/sql/2026-08_auditoria_fk_final.sql` no SQL Editor (as sessões do Claude Code
não alcançam `supabase.co`, e a anon key do `relatorio_cobertura_fk.js` não
enxerga `meta_inovacao_canva_demandas` — a RLS fecha o SELECT pra `anon` de
propósito). CONSULTA 0: as 13 colunas/tabelas existem, todas `OK` — nenhuma
migração ficou pra trás.

| Item | FK | 26/08/2026 | Veredito |
|---|---|---|---|
| 2.1 | `meta_inovacao_projetos.nucleo_id` | 28/28 | OK |
| 2.2 | `meta_inovacao_projeto_representantes` (vínculos) | 34/34 | OK |
| 2.2 | `representantes[]` sem pessoa no golden record | 1 — só o placeholder "Núcleo de Startups" | OK |
| 2.3 | `meta_inovacao_urc_lideranca.pessoa_id` | 3/3 | OK |
| 2.4 | `meta_inovacao_urc_canais_responsaveis.canal_id` | 11/11 | OK |
| 2.4 | `meta_inovacao_urc_canais_responsaveis.pessoa_id` | 11/11 | OK |
| 2.5 | `canva_demandas.nucleo_id` | 1/1 | OK |
| 2.5 | `canva_demandas.canal_id` | 1/1 | OK |
| 2.5 | `canva_demandas.facilitador_pessoa_id` | 0/0 (nenhuma demanda tem facilitador em texto) | OK |
| 2.5 | `canva_demandas.responsavel_pessoa_id` | 1/1 | OK |
| 2.6 | `meta_inovacao_plano_responsaveis` (vínculos) | 61/61 | OK |
| 2.7 | `corsario_status.projeto_id` (por iniciativa) | 27/27 | OK |
| 2.7 | `corsario_status.nucleo_id` (por núcleo) | **0/4** | **DIVERGE** |

CONSULTA B (integridade): **10 de 10 `OK`** — nenhuma FK apontando pra linha
soft-deleted, e nenhum texto discordando da FK que deveria representá-lo.

### O que os números dizem

**Os de 22–23/08 se sustentaram.** 28/28, 34 vínculos, 3/3, 11/11, 61/61, 27/27 —
os mesmos de quando as migrações rodaram. Isso confirma uma coisa e desmente
outra: confirma que a resolução por texto das Camadas 0–2 aguentou; e desmente a
suposição de que as 3 lacunas de escrita (seção B) já tivessem derrubado a
cobertura. Não derrubaram **ainda** — simplesmente não entrou projeto, ação nem
iniciativa nova desde 22/08. A porta continua aberta; a próxima linha nova é que
cai fora.

### O DIVERGE do 2.7 — `corsario_status.nucleo_id` está 0/4

Zero de 4, não "quase". Não é deriva de linha nova (essa seria parcial): **nenhuma**
linha tem `nucleo_id`, embora `projeto_id` esteja 27/27 na mesma tabela, a coluna
exista (`bigint`, CONSULTA 0 `OK`) e as duas tenham sido criadas pelo mesmo
`ALTER TABLE` e populadas por dois `UPDATE` seguidos no mesmo arquivo
(`tools/sql/2026-08_corsario_status_fk.sql`). Um pegou tudo, o outro pegou nada.

Essa é exatamente a única linha hedgeada de `CAMADA2_COBERTURA_FK.md`:

> | 2.7 | `corsario_status.nucleo_id` (por núcleo) | — (não quebrado por núcleo na conferência, mas a checagem "sem FK" veio vazia) | — |

A verificação (b) daquele script é `SELECT DISTINCT nucleo … WHERE nucleo_id IS
NULL`. Se `nucleo` estivesse NULL nas linhas quando ela rodou, o retorno seria UMA
linha com a célula vazia — fácil de ler como "veio vazia" no SQL Editor. É a
explicação mais provável, e é hipótese: o script de recuperação não depende dela.
Lição registrada: **checagem cujo "vazio" é ambíguo não é checagem** — por isso a
CONSULTA A conta numerador/denominador em vez de listar o que falta, e a CONSULTA C
é que dá os nomes.

`tools/sql/2026-08_corsario_status_nucleo_id_recuperacao.sql` (item 5.8) resolve:
diagnostica primeiro (por texto distinto, dizendo se casa exato, casa normalizado
ou não existe no catálogo), popula por igualdade exata e depois por igualdade
normalizada, e reverifica. Idempotente. **Não fecha a porta de escrita** — isso é o
item 5.7; enquanto ele não for feito, a recuperação vai precisar ser repetida.

### Um falso positivo que a primeira rodada produziu — e o que ele ensinou

A primeira versão desta auditoria acusou **8** tokens de `representantes[]` sem
pessoa no golden record (Hulda, Matheus, Gabriel, Jr., …) e um "34/27" sem sentido.
Não era dado ruim: era a auditoria usando uma régua de casamento **mais estrita que
a da migração**. O item 2.2 casa por `nome` OU `nome_exibicao`, mais o alias
"Júnior" → "JR."; a auditoria comparava só `nome`, e todos esses 8 casaram por
`nome_exibicao`. Corrigido — a CONSULTA A e a CONSULTA C agora reusam a régua da
verificação (a) de `2026-08_projeto_representantes.sql`, literalmente.

O número real é **34 vínculos / 34 instâncias casáveis**, com 1 placeholder
("Núcleo de Startups", Sebrae Startups) — os mesmos 34/35 de 22/08, escritos com o
denominador certo. Regra que fica: **régua de casamento só serve pra auditar se for
a MESMA que populou** — auditoria com régua própria mede a régua, não o dado.

### Por que este SQL e não o `relatorio_cobertura_fk.js`

Ele vai mais longe que o relatório existente em três pontos:

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

Consequência prática: **2.1, 2.6 e 2.7 estão com a porta aberta desde 22/08** —
todo projeto novo, toda ação nova e toda iniciativa nova avaliada no corsário nasce
sem FK. A CONSULTA A de 26/08 mostrou que a deriva ainda **não se materializou**
(28/28, 61/61, 27/27 seguem intactos): é que não entrou linha nova nessas três
tabelas desde então. Isso é sorte de calendário, não garantia — a primeira
iniciativa nova do corsário ou o primeiro projeto novo no `editor.html` já derruba
o número, sem aviso e sem erro na tela.

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

- **5.8** — **[humano]** rodar
  `tools/sql/2026-08_corsario_status_nucleo_id_recuperacao.sql` no SQL Editor, pra
  fechar o `0/4` de `corsario_status.nucleo_id`. Único item desta lista que mexe em
  dado, e o único que precisa do José. Rode a SEÇÃO 1 (diagnóstico, só leitura)
  antes da SEÇÃO 2.

As três primeiras não são migração de banco: as colunas existem e estão populadas.
É só fechar a porta de entrada — e enquanto ela não fecha, a cobertura que as
Camadas 0–2 conquistaram fica dependendo de ninguém cadastrar nada.

## Como reconferir

```bash
node tools/auditoria_fk_final.js          # B e C: caminho de escrita e leitores
node tools/auditoria_fk_final.js --check  # o mesmo, pra suíte: sai != 0 se o
                                          # conjunto de lacunas MUDOU (nos dois
                                          # sentidos — lacuna nova, ou lacuna
                                          # registrada que sumiu sem baixa)
node tools/relatorio_cobertura_fk.js      # A, no que é público (precisa de rede)
```

E, no SQL Editor do Supabase, um bloco por vez, como manda o cabeçalho de cada
arquivo:

- `tools/sql/2026-08_auditoria_fk_final.sql` — CONSULTA 0 → A → B → C.
- `tools/sql/2026-08_corsario_status_nucleo_id_recuperacao.sql` — SEÇÃO 1
  (diagnóstico) → 2 (popular) → 3 (verificar), enquanto o item 5.8 não estiver feito.

Os dois foram testados num Postgres 16 local espelhando o estado real de produção
de 26/08 (`corsario_status` com `projeto_id` cheio e `nucleo_id` vazio, pessoas com
`nome_exibicao` curto): a auditoria acusa o `0/4`, a recuperação popula, a auditoria
volta a 13/13 `OK`. A recuperação roda duas vezes seguidas com `UPDATE 0` na
segunda, e os três vereditos do diagnóstico (casa exato, casa normalizado, sem
correspondente) foram exercitados um a um.
