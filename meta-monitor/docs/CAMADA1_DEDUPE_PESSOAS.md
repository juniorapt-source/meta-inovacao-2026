# Camada 1, item 1.1 — Levantamento de dedupe das pessoas físicas

> Status: **4 de 6 pendências do item 1.2 já confirmadas por José (22/08/2026)** —
> ver §3.1/§3.2/§3.4/§3.5-Pova, todas marcadas ✅ RESOLVIDO. Faltam só os 15 nomes
> completos de §3.3 e a decisão sobre "Gerência UI" (§3.5) pra fechar o item 1.2
> por inteiro e a Camada 1 seguir pro `ALTER`/`CREATE` (item 1.3). Nenhuma tabela
> foi alterada, nenhum SQL foi rodado ainda.

## Fonte dos dados e uma limitação a registrar

Cruzei as 4 fontes indicadas em
`PROPOSTA_ESQUEMA_CADASTROS_REFERENCIA.md` §"O problema, com números":
`meta_inovacao_pessoas`, `meta_inovacao_projetos.representantes`,
`meta_inovacao_urc_lideranca`, `meta_inovacao_urc_canais_responsaveis` — mais
`meta_inovacao_plano_acoes.responsavel_id`, que não introduz nome novo (resolve
contra a lista já deduplicada `window.DB.responsaveis`, ver seção final).

**Limitação:** este ambiente não tem rede liberada para `supabase.co` (proxy
bloqueia), então não deu para consultar as tabelas do Supabase de produção
diretamente. Usei os arquivos de fallback locais — `data/pessoas.js`,
`data/projetos.js`, `data/urc.js` — que pelo modelo de governança do projeto
(mesmo padrão do golden record de projetos, `GOVERNANCA_GOLDEN_RECORD.md`) são a
cópia mais recente conhecida do que está no banco. **Antes de rodar a migração do
item 1.3, vale um `SELECT *` rápido nas 4 tabelas no SQL Editor pra confirmar que
as contagens abaixo ainda batem** — mesma cautela do item 0.4.

Contagens batem com o diagnóstico da proposta: 20 linhas em `pessoas` (13 pessoas
distintas), 34 instâncias em `representantes` (13 pessoas sem linha própria +
1 placeholder), 3 em `urc_lideranca`, 11 em `urc_canais_responsaveis` — **13 + 13 +
3 + 11 = 40**, o "~40" da proposta.

## Metodologia

- Casamento por nome normalizado (minúsculas, sem acento, sem pontuação — mesma
  função `RESP.normalizar` de `js/responsaveis.js`) + os aliases que já existem em
  `js/responsaveis.js.ALIASES` (`gabriel`→`gabriel_barreto_barros`,
  `hulda`→`hulda_giesbrecht`, `matheus`→`matheus_queiroz_campos`,
  `junior`→`jose_mendes_junior`, `jr`→`jr`, `ia`/`pova`→`pova`).
- Quando um nome curto (ex.: "Carol") não bate com nenhum nome completo conhecido
  em nenhuma fonte, ele **não** foi resolvido sozinho — entra na lista de pendência
  humana (seção 3), como o próprio texto da proposta já antecipa: *"nomes curtos
  como 'Carol' precisam de confirmação humana de qual 'Carol' é, não dá pra
  automatizar com segurança"*.
- Toda proximidade de nome que **poderia** ser a mesma pessoa mas não bate 100% no
  casamento automático também vai pra pendência (seção 3), mesmo sem alias
  existente sugerindo isso — para não decidir por conta própria.

---

## 1) Lista consolidada — pessoas com identidade única resolvida (37)

(Inclui as que ainda precisam de sobrenome/confirmação — sinalizadas na coluna
"Observação" e detalhadas em §3; "sem ambiguidade" aqui significa só que o
casamento entre fontes é 1:1, não que o cadastro já está completo. Números após
as fusões confirmadas em 22/08 — ver §3.1/§3.2.)

Nome canônico proposto (`nome_completo`), de onde vem, e em que fontes aparece.

| # | Nome completo proposto | Fontes | Observação |
|---|---|---|---|
| 1 | José Mendes de Oliveira Júnior | pessoas (UI, como "JR.") · pessoas (Núcleos, "José Mendes de Oliveira Júnior") · representantes (`"Jr."`, ALI Rural) | ✅ RESOLVIDO §3.2 — mesma pessoa, 2 papéis (coordenação UI + núcleo Inovação p/ Competitividade). `nome_exibicao`: "JR." |
| 2 | Sandra Chaves Silva Paraíso | pessoas (UI, como "Sandra") · pessoas (Núcleos, "Sandra Chaves Silva Paraíso") | ✅ RESOLVIDO §3.1 — mesma pessoa, 2 papéis (assistente do plano + núcleo Gestão do Conhecimento e Processos). `nome_exibicao`: "Sandra" |
| 3 | Gabriel Silva Povoa | pessoas (UI, como "Pova") · representantes (`"Pova"` ×3) | ✅ RESOLVIDO §3.5 — pessoa física, não agente de IA. `nome_exibicao`: "Pova". Papel atual em `data/pessoas.js` ("Agente de IA de apoio ao formulário") precisa de revisão no item 1.3/1.6 — descreve uma função, não o que a pessoa é |
| 4 | Anny | pessoas (UI) | só primeiro nome em toda a base — ver §3.3 se há sobrenome |
| 5 | Gabriel Gil Barreto Barros | pessoas (Comitê + Núcleos, já duplicado lá) · representantes (`"Gabriel"`, Inova Biomas, via alias) | dedupe interno de `meta_inovacao_pessoas` (2 linhas → 1 pessoa) |
| 6 | Hulda Oliveira Giesbrecht | pessoas (Comitê + Núcleos) · representantes (`"Hulda"` ×3, via alias) | dedupe interno + 3 projetos |
| 7 | Lara Chicuta Franco | pessoas (Comitê + Núcleos) | dedupe interno |
| 8 | Marcus Vinicius Lopes Bezerra | pessoas (Comitê + Núcleos) | dedupe interno |
| 9 | Matheus Lopes de Queiroz Campos | pessoas (Comitê + Núcleos) · representantes (`"Matheus"` ×2, via alias) | dedupe interno + 2 projetos |
| 10 | Paulo Puppin Zandonadi | pessoas (Comitê + Núcleos) | dedupe interno |
| 11 | Enio | urc_lideranca | só primeiro nome — ver §3.3 |
| 12 | Milva | urc_lideranca | só primeiro nome — ver §3.3 |
| 13 | Iuri Barbosa de Andrade | urc_lideranca | tem e-mail (`iuri.andrade@sebrae.com.br`) |
| 14 | Cendie Carvalho Da Costa Barbieri | urc_canais (CNR) | tem e-mail |
| 15 | André Luís M. Chanpan dos Santos | urc_canais (CNR) | tem e-mail |
| 16 | Filipe Medeiros Ferreira | urc_canais (CNR) | tem e-mail — ✅ RESOLVIDO §3.4, pessoa diferente de #29 |
| 17 | Rafael Rodrigues de Lima | urc_canais (Portal) | tem e-mail |
| 18 | Thaíza Soares Cardoso Lima Kopp | urc_canais (Portal) | tem e-mail |
| 19 | Michelle Carsten Santos | urc_canais (Portal) | tem e-mail |
| 20 | Marcos Paulo de Sousa Santos Soares | urc_canais (Portal) | tem e-mail |
| 21 | Sabrina Mendes Gonçalves | urc_canais (Portal) | tem e-mail |
| 22 | Leandro Pereira de Jesus | urc_canais (Loja) | tem e-mail |
| 23 | Cláudia Schirmbeck Peixoto | urc_canais (Loja) | tem e-mail |
| 24 | Davison da Silva Ferreira | urc_canais (Loja) | tem e-mail |
| 25 | Dario | representantes (Catalisa Gov) | só primeiro nome — ver §3.3 |
| 26 | Rafa | representantes (Catalisa Gov) | só primeiro nome — ver §3.3 |
| 27 | Wébia | representantes (Startup NE) | só primeiro nome — ver §3.3 |
| 28 | Jéssica | representantes (Startup NE) | só primeiro nome — ver §3.3 |
| 29 | Philippe Fauguet Figueiredo | representantes (`"Felipe"`, Inova Biomas) | ✅ RESOLVIDO §3.4 — nome completo confirmado por José, pessoa diferente de #16. `nome_exibicao`: "Felipe" (o que já é usado hoje) |
| 30 | Fernanda | representantes (Startup NE) | só primeiro nome — ver §3.3 |
| 31 | Agnaldo | representantes (Catalisa ICT, Embrapii) ×2 | só primeiro nome — ver §3.3 |
| 32 | Valéria | representantes (Inova Biomas) | só primeiro nome — ver §3.3 |
| 33 | Carol | representantes ×4 | só primeiro nome — ver §3.3 |
| 34 | Fred | representantes | só primeiro nome — ver §3.3 |
| 35 | Thiago | representantes | só primeiro nome — ver §3.3 |
| 36 | Raquel | representantes ×4 | só primeiro nome — ver §3.3 |
| 37 | Cris | representantes ×4 | só primeiro nome — ver §3.3 |

Não incluído na lista acima (não é pessoa física — segue em aberto, §3.5):
- **Gerência UI** — papel institucional, não indivíduo nomeado.
- **"Núcleo de Startups"** — placeholder de "ainda sem representante nomeado" em
  `representantes` (Sebrae Startups), não um nome de pessoa.

## 2) Coletivos — já resolvido, fora do escopo deste relatório

`Comitê`, `URC`, `Coordenadores`, `Gestores dos projetos`, `Soluções` já viraram
`meta_inovacao_coletivos` na Camada 0 (decisão fechada 22/08 — Opção A). Não
entram aqui.

---

## 3) Casos que precisam de confirmação sua (item 1.2)

### 3.1 — ✅ RESOLVIDO (José, 22/08) — "Sandra" é a mesma pessoa que "Sandra Chaves Silva Paraíso"

**Confirmado: mesma pessoa, acumulando os dois papéis.** Nome completo:
**Sandra Chaves Silva Paraíso**. O registro final vira **1 linha** em
`meta_inovacao_pessoas` com **2 papéis** em `meta_inovacao_pessoa_papeis`:
`contexto: UI` (assistente do plano) + `contexto: Nucleo, nucleo_id: Gestão do
Conhecimento e Processos`. `nome_exibicao` continua "Sandra" (o que já é usado
hoje nas telas que só mostram o grupo UI).

### 3.2 — ✅ RESOLVIDO (José, 22/08) — "JR." × "José Mendes de Oliveira Júnior"

**Confirmado: mesma pessoa, acumulando os dois papéis** — não são 2 pessoas
diferentes, ao contrário do que `js/responsaveis.js.ALIASES` assumia até aqui
(`jr` e `junior` apontando pra 2 ids distintos). Nome completo: **José Mendes de
Oliveira Júnior**. Registro final: **1 linha** em `meta_inovacao_pessoas` com
**2 papéis**: `contexto: UI` (coordenação do plano) + `contexto: Nucleo,
nucleo_id: Inovação para Competitividade`. `nome_exibicao`: "JR.".

⚠️ Isso muda o que a Camada 2 precisa fazer com `js/responsaveis.js`: os ids `jr`
e `junior` de `window.DB.responsaveis` hoje apontam pra 2 pessoas — depois desta
migração, os dois vão resolver pra **1** `pessoa_id` só (mas continuam válidos
como 2 entradas de `responsavel_id` se o caso de uso for "por qual papel" e não
"por qual pessoa" — decisão de UX pra Camada 4, não deste relatório).

### 3.3 — Nomes curtos sem sobrenome em nenhuma fonte (15 pessoas, pendente)

Nenhuma das fontes disponíveis (`pessoas`, `representantes`, `urc_lideranca`,
`urc_canais_responsaveis`, `window.DB.responsaveis`) tem o nome completo destas
pessoas — só o primeiro nome usado em `representantes` de projeto:

**Carol, Fred, Thiago, Raquel, Dario, Rafa, Cris, Wébia, Jéssica, Fernanda,
Agnaldo, Valéria** — mais **Anny, Enio, Milva** (grupo UI/urc_lideranca, mesmo
problema). ("Felipe" saiu desta lista — resolvido em §3.4 como Philippe Fauguet
Figueiredo.)

**Pergunta, pra cada uma:** nome completo (pra `nome_completo`) e, se tiver,
e-mail — mesmo que fique só `nome_exibicao` = o primeiro nome que já é usado hoje
(não precisa mudar o que aparece na tela, só preencher o campo que faltar).

### 3.4 — ✅ RESOLVIDO (José, 22/08) — "Filipe Medeiros Ferreira" (URC/CNR) × "Felipe" (Inova Biomas)

**Confirmado: são pessoas diferentes.** O representante de Inova Biomas, hoje só
"Felipe" em `representantes`, tem nome completo **Philippe Fauguet Figueiredo**
(`nome_exibicao` continua "Felipe"). "Filipe Medeiros Ferreira" (responsável de
canal da URC pro CNR) não muda.

### 3.5 — "Pova" (✅ RESOLVIDO, é pessoa) e "Gerência UI" (pendente)

**Pova — ✅ RESOLVIDO (José, 22/08):** não é agente de IA, é pessoa física —
**Gabriel Silva Povoa** (`nome_exibicao`: "Pova"). O `papel` atual em
`data/pessoas.js` ("Agente de IA de apoio ao formulário (CAN-08/09)") descreve
uma função que essa pessoa exerce, não o que ela é — revisar o texto do papel no
item 1.3/1.6 pra não induzir o próximo leitor ao mesmo engano deste relatório.

**Gerência UI — ainda pendente.** Não é indivíduo nomeado, é papel institucional.
`meta_inovacao_coletivos` (Camada 0) foi desenhada pra "Comitê"/"URC"/grupos de
pessoas — não é claramente o mesmo conceito que um cargo.

**Pergunta:** "Gerência UI" vira linha em `meta_inovacao_coletivos` mesmo assim
(mais largo do que "grupo de pessoas", mas reaproveita a tabela existente), ou
merece um terceiro catálogo (`meta_inovacao_papeis_institucionais`/equivalente)?

### 3.6 — "Núcleo de Startups" (placeholder em `representantes`)

Não é nome de pessoa — é o valor usado em "Sebrae Startups" pra dizer "ainda sem
representante indicado". Proposta de tratamento (não é pergunta, é a leitura mais
óbvia, mas registrando pra confirmar): a junção `projeto_representantes` desse
projeto simplesmente **não ganha linha nenhuma** até haver um nome real — o texto
"Núcleo de Startups" não vira `pessoa_id`, fica só como está hoje em
`representantes` (texto) até ser substituído.

---

## Resumo executivo pra decisão rápida

| Bloco | Qtde | Status |
|---|---|---|
| Identidade e nome completo já prontos (tabela §1, exceto as 15 de §3.3) | 22 | ✅ prontas pro seed do item 1.3 |
| ✅ Ambiguidades de identidade — todas resolvidas por José em 22/08 | 4 casos (§3.1 Sandra, §3.2 JR./José Mendes, §3.4 Filipe×Felipe, §3.5 Pova) | ✅ RESOLVIDO |
| Só primeiro nome, falta nome completo (§3.3) | 15 | ⏳ pendente — preencher nome completo (pode ficar `pendente: true`, não bloqueia o resto) |
| Não é pessoa física, falta decidir onde entra (§3.5 — Gerência UI) | 1 | ⏳ pendente |
| Placeholder, não vira pessoa (§3.6) | 1 (Núcleo de Startups, fora da conta) | confirmado, sem ação |

**Total de pessoas físicas distintas após as fusões confirmadas: 37** (era "~40"
na proposta original — os 3 a menos são as 2 fusões, Sandra e JR./José Mendes, e
"Pova" que já estava contado nas 13 de `meta_inovacao_pessoas` e só mudou de
"não pessoa" pra pessoa, sem alterar a contagem total de linhas cruzadas).

**Falta só isto pra fechar o item 1.2 e liberar o item 1.3 (migração):**
1. Nome completo de: Carol, Fred, Thiago, Raquel, Dario, Rafa, Cris, Wébia,
   Jéssica, Fernanda, Agnaldo, Valéria, Anny, Enio, Milva (§3.3).
2. Onde "Gerência UI" entra: `meta_inovacao_coletivos` ou catálogo novo (§3.5).
