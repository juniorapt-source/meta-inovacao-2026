# Camada 1, item 1.1 — Levantamento de dedupe das pessoas físicas

> Status: **relatório para confirmação humana (item 1.2)** — nenhuma tabela foi
> alterada, nenhum SQL foi rodado. Este documento só cruza os dados que já existem
> hoje e propõe uma lista única; José confirma/corrige antes de a Camada 1 seguir
> pro `ALTER`/`CREATE` (item 1.3).

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

## 1) Lista consolidada — pessoas com identidade única resolvida (36)

(Inclui as que ainda precisam de sobrenome/confirmação — sinalizadas na coluna
"Observação" e detalhadas em §3; "sem ambiguidade" aqui significa só que o
casamento entre fontes é 1:1, não que o cadastro já está completo.)

Nome canônico proposto (`nome_completo`), de onde vem, e em que fontes aparece.

| # | Nome completo proposto | Fontes | Observação |
|---|---|---|---|
| 1 | JR. (José Júnior) | pessoas (UI) · representantes (`"Jr."`, ALI Rural, via alias `jr`) | nome de exibição sugerido: "JR." |
| 2 | Anny | pessoas (UI) | só primeiro nome em toda a base — ver §3 se há sobrenome |
| 3 | Gabriel Gil Barreto Barros | pessoas (Comitê + Núcleos, já duplicado lá) · representantes (`"Gabriel"`, Inova Biomas, via alias) | dedupe interno de `meta_inovacao_pessoas` (2 linhas → 1 pessoa) |
| 4 | Hulda Oliveira Giesbrecht | pessoas (Comitê + Núcleos) · representantes (`"Hulda"` ×3, via alias) | dedupe interno + 3 projetos |
| 5 | Lara Chicuta Franco | pessoas (Comitê + Núcleos) | dedupe interno |
| 6 | Marcus Vinicius Lopes Bezerra | pessoas (Comitê + Núcleos) | dedupe interno |
| 7 | Matheus Lopes de Queiroz Campos | pessoas (Comitê + Núcleos) · representantes (`"Matheus"` ×2, via alias) | dedupe interno + 2 projetos |
| 8 | Paulo Puppin Zandonadi | pessoas (Comitê + Núcleos) | dedupe interno |
| 9 | José Mendes de Oliveira Júnior | pessoas (Núcleos, só 1 linha) | **não** confundir com #1 (ver §3, caso já resolvido por alias mas vale confirmar) |
| 10 | Enio | urc_lideranca | só primeiro nome — ver §3 |
| 11 | Milva | urc_lideranca | só primeiro nome — ver §3 |
| 12 | Iuri Barbosa de Andrade | urc_lideranca | tem e-mail (`iuri.andrade@sebrae.com.br`) |
| 13 | Cendie Carvalho Da Costa Barbieri | urc_canais (CNR) | tem e-mail |
| 14 | André Luís M. Chanpan dos Santos | urc_canais (CNR) | tem e-mail |
| 15 | Filipe Medeiros Ferreira | urc_canais (CNR) | tem e-mail — ver §3 (proximidade com #33 "Felipe") |
| 16 | Rafael Rodrigues de Lima | urc_canais (Portal) | tem e-mail |
| 17 | Thaíza Soares Cardoso Lima Kopp | urc_canais (Portal) | tem e-mail |
| 18 | Michelle Carsten Santos | urc_canais (Portal) | tem e-mail |
| 19 | Marcos Paulo de Sousa Santos Soares | urc_canais (Portal) | tem e-mail |
| 20 | Sabrina Mendes Gonçalves | urc_canais (Portal) | tem e-mail |
| 21 | Leandro Pereira de Jesus | urc_canais (Loja) | tem e-mail |
| 22 | Cláudia Schirmbeck Peixoto | urc_canais (Loja) | tem e-mail |
| 23 | Davison da Silva Ferreira | urc_canais (Loja) | tem e-mail |
| 24 | Dario | representantes (Catalisa Gov) | só primeiro nome — ver §3 |
| 25 | Rafa | representantes (Catalisa Gov) | só primeiro nome — ver §3 |
| 26 | Wébia | representantes (Startup NE) | só primeiro nome — ver §3 |
| 27 | Jéssica | representantes (Startup NE) | só primeiro nome — ver §3 |
| 28 | Fernanda | representantes (Startup NE) | só primeiro nome — ver §3 |
| 29 | Agnaldo | representantes (Catalisa ICT, Embrapii) ×2 | só primeiro nome — ver §3 |
| 30 | Valéria | representantes (Inova Biomas) | só primeiro nome — ver §3 |
| 31 | Felipe | representantes (Inova Biomas) | só primeiro nome — ver §3 (proximidade com #15 "Filipe") |
| 32 | Carol | representantes ×4 | só primeiro nome — ver §3 |
| 33 | Fred | representantes | só primeiro nome — ver §3 |
| 34 | Thiago | representantes | só primeiro nome — ver §3 |
| 35 | Raquel | representantes ×4 | só primeiro nome — ver §3 |
| 36 | Cris | representantes ×4 | só primeiro nome — ver §3 |

Não incluídos na lista acima (não são pessoa física — ver §3 pra decisão de como
modelar cada um):
- **Sandra** (pessoas/UI) e **Sandra Chaves Silva Paraíso** (pessoas/Núcleos) —
  tratadas como 2 entradas SEM fundir, porque não dá pra saber sem perguntar se são
  a mesma pessoa (ver §3, é o caso de maior impacto deste levantamento).
- **Pova** — agente de IA, não pessoa física.
- **Gerência UI** — papel institucional, não indivíduo nomeado.
- **"Núcleo de Startups"** — placeholder de "ainda sem representante nomeado" em
  `representantes` (Sebrae Startups), não um nome de pessoa.

## 2) Coletivos — já resolvido, fora do escopo deste relatório

`Comitê`, `URC`, `Coordenadores`, `Gestores dos projetos`, `Soluções` já viraram
`meta_inovacao_coletivos` na Camada 0 (decisão fechada 22/08 — Opção A). Não
entram aqui.

---

## 3) Casos que precisam de confirmação sua (item 1.2)

### 3.1 — Maior impacto: "Sandra" é a mesma pessoa que "Sandra Chaves Silva Paraíso"?

- `meta_inovacao_pessoas` tem **duas linhas** com "Sandra" no nome:
  - `grupo: "UI"`, nome **"Sandra"**, papel *"Assistente do plano: agendas,
    prazos, monitoramento, boletim"*.
  - `grupo: "Núcleos"`, nome **"Sandra Chaves Silva Paraíso"**, núcleo *"Gestão do
    Conhecimento e Processos"*.
- Podem ser (a) a mesma pessoa acumulando os dois papéis, ou (b) duas Sandras
  diferentes por coincidência de primeiro nome — a base atual não tem e-mail nem
  sobrenome na linha "UI" pra decidir.
- **Pergunta:** é a mesma pessoa? Se sim, o registro final vira 1 linha em
  `meta_inovacao_pessoas` com **2 papéis** em `meta_inovacao_pessoa_papeis`
  (`contexto: UI` + `contexto: Nucleo, nucleo_id: Gestão do Conhecimento e
  Processos`). Se não, seguem 2 pessoas — mas aí a "Sandra" da UI provavelmente
  precisa de um sobrenome pra não colidir por nome com a outra na hora de exibir.

### 3.2 — "JR." × "José Mendes de Oliveira Júnior": leitura correta?

- `js/responsaveis.js` já trata como **2 pessoas diferentes**: `jr` = "JR. (José
  Júnior)" (coordenação do plano, grupo UI) e `junior` = "José Mendes de Oliveira
  Júnior" (representante do núcleo Inovação para Competitividade, grupo Núcleos).
- O representante do projeto "ALI Rural" em `meta_inovacao_projetos.representantes`
  é o texto `"Jr."`, que a normalização (remove ponto, minúsculo) casa com o alias
  `jr` → **JR. (José Júnior)**, não com José Mendes.
- **Pergunta:** essa leitura está certa — é o JR. coordenador que representa o
  projeto ALI Rural, e não José Mendes de Oliveira Júnior? Não muda nenhum dado
  (o alias já existe e já decide isso), só confirmando antes de gravar
  `projeto_representantes` na Camada 2.

### 3.3 — Nomes curtos sem sobrenome em nenhuma fonte (13 pessoas)

Nenhuma das fontes disponíveis (`pessoas`, `representantes`, `urc_lideranca`,
`urc_canais_responsaveis`, `window.DB.responsaveis`) tem o nome completo destas
pessoas — só o primeiro nome usado em `representantes` de projeto:

**Carol, Fred, Thiago, Raquel, Dario, Rafa, Cris, Wébia, Jéssica, Fernanda,
Agnaldo, Valéria, Felipe** — mais **Anny, Enio, Milva** (grupo UI/urc_lideranca,
mesmo problema).

**Pergunta, pra cada uma:** nome completo (pra `nome_completo`) e, se tiver,
e-mail — mesmo que fique só `nome_exibicao` = o primeiro nome que já é usado hoje
(não precisa mudar o que aparece na tela, só preencher o campo que faltar).

### 3.4 — "Filipe Medeiros Ferreira" (URC/CNR) × "Felipe" (Inova Biomas)

Grafias diferentes (Filipe/Felipe) em contextos sem sobreposição óbvia (um é
responsável de canal da URC pro CNR, o outro é representante do projeto Inova
Biomas — núcleo Tecnologias Portadoras de Futuro). Provavelmente são pessoas
diferentes, mas a proximidade de nome é grande o bastante pra valer confirmar
**não** são a mesma pessoa antes de tratá-los como 2 registros — nenhuma
automação decidiu isso sozinha.

### 3.5 — Como modelar "Pova" (agente de IA) e "Gerência UI" (papel institucional)

Nenhum dos dois é pessoa física, mas os dois aparecem hoje como se fossem: "Pova"
tem linha em `meta_inovacao_pessoas` e entra em `representantes` de 3 projetos;
"Gerência UI" tem linha em `meta_inovacao_pessoas`. `meta_inovacao_coletivos`
(Camada 0) foi desenhada pra "Comitê"/"URC"/grupos de pessoas, não pra um agente
de IA ou um cargo institucional — não é claramente o mesmo conceito.

**Pergunta:** os dois viram linha em `meta_inovacao_coletivos` mesmo assim (mais
largo do que "grupo de pessoas", mas reaproveita a tabela existente), ou merecem
um terceiro catálogo (`meta_inovacao_papeis_institucionais`/equivalente)? Sem essa
decisão, a Camada 1 não sabe se dedupe "Pova" para pessoa ou pra coletivo.

### 3.6 — "Núcleo de Startups" (placeholder em `representantes`)

Não é nome de pessoa — é o valor usado em "Sebrae Startups" pra dizer "ainda sem
representante indicado". Proposta de tratamento (não é pergunta, é a leitura mais
óbvia, mas registrando pra confirmar): a junção `projeto_representantes` desse
projeto simplesmente **não ganha linha nenhuma** até haver um nome real — o texto
"Núcleo de Startups" não vira `pessoa_id`, fica só como está hoje em
`representantes` (texto) até ser substituído.

---

## Resumo executivo pra decisão rápida

| Bloco | Qtde | Ação |
|---|---|---|
| Nome completo já conhecido, sem flag nenhum (linhas 1,3–8,12–14,16–23 da tabela §1) | 18 | segue direto pro seed do item 1.3 |
| Só primeiro nome, precisa de sobrenome/confirmação (§3.3 — Anny, Enio, Milva + 13 de `representantes`, inclui #15/#31 que também caem em §3.4) | 16 | preencher nome completo (pode ficar em aberto = `pendente: true`, não bloqueia) |
| Ambiguidade de identidade a mais, além da falta de sobrenome (§3.2 José Mendes, §3.4 Filipe×Felipe) | 2 casos, já contados na linha acima | decisão binária cada um |
| Não estão na tabela §1: ambiguidade de identidade (§3.1 — Sandra × Sandra Chaves Silva Paraíso) | 2 | decisão binária: 1 pessoa ou 2 |
| Não estão na tabela §1: não é pessoa física, decidir onde entra (§3.5) | 2 (Pova, Gerência UI) | decisão de modelagem |
| Placeholder, não vira pessoa (§3.6) | 1 (Núcleo de Startups, fora da conta dos 40) | confirmar leitura, sem ação |

**Total: 18 prontos + 16 com flag de nome incompleto (dentro da tabela de 36) + 4
fora da tabela (Sandra ×2, Pova, Gerência UI) = 40**, batendo com o "~40" da
proposta original (13 pessoas + 13 representantes novos + 3 urc_lideranca + 11
urc_canais).
