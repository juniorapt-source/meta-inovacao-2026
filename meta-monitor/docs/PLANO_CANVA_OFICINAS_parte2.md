# Plano: canvas das oficinas preenchido direto no site — parte 2

**Status:** só o que falta. Itens 1, 2, 3, 4 e 7 de `docs/PLANO_CANVA_OFICINAS.md` estão prontos
e em produção — não são repetidos aqui. Este documento é só os itens 5 e 6 daquele plano (§12),
detalhados o suficiente pra codar sem precisar reabrir a parte 1 inteira.
**Versão:** v1, 22/08/2026.
**Lê-se com:** `docs/PLANO_CANVA_OFICINAS.md` (parte 1) — §3 (cardinalidade), §5 (modelo de dados),
§6 (segurança), §8 (consolidação) e §9 (regra de promoção) são a base do que vem abaixo. Este
documento não repete o que já está decidido lá, só referencia.

---

## 0. Onde as coisas estão hoje

Referência rápida pra não ter que ir caçar em cinco arquivos — o que os itens 5 e 6 vão
**reaproveitar**, não recriar:

| Peça | Onde | Estado |
|---|---|---|
| Tabela `meta_inovacao_canva_demandas` | `tools/sql/2026-08_canva_demandas.sql` | em produção. Leitura aberta (`cc_select_publico`), escrita só por função |
| `cc_canva_moderar(p jsonb)` | `tools/sql/2026-08_canva_leitura_aberta.sql` | em produção. Ações: `validar`, `descartar`, `reabrir`, `editar`, `vincular_projeto`, `validar_lote`. **Não promove pra matriz** — comentário no próprio script (linha ~139) já reserva isso pro item 5 |
| Tabela `meta_inovacao_matriz_demandas` | pré-existente (antes de `tools/sql/`) | colunas: `id`, `iniciativa` (text, **sem constraint de unicidade conhecida**), `nucleo`, uma coluna text por canal (`cnr`, `assessoria`, `portal`, `loja`, `mkt`, `foco`, `rede`, `dxp`, `empresa`, `contab` — os 10 de `data/canais.js`), `atualizado_em`, `atualizado_por`. **Atenção ao nome da coluna de autoria: `atualizado_por`, não `updated_by`** (única tabela das 4 auditadas com nome diferente — ver `tools/sql/2026-08_auditoria.sql` linhas 17-28) |
| Escrita na matriz | `js/matriz-store.js` | anon tem `GRANT UPDATE`/`INSERT` direto na tabela (padrão das "outras nove tabelas") — **diferente** da tabela do canvas, que é RPC-only. `saveCell(id, campo, valor)` faz UPDATE; `addRow(dados)` faz INSERT quando a iniciativa ainda não tem linha na matriz |
| Taxonomia de status da célula | `js/status.js`, contexto `celula_matriz` | **9 estados**, não os 3 que a §9 da parte 1 nomeia: `vazia`, `previsto`, `oficina_confirmada`, `oficina`, `formulario`, `justificado`, `nao_aplica`, `priorizado`, `encaminhado`. A §9 só fala de `vazia`/`previsto`, `oficina` e `nao_aplica`/`justificado` — ver §2.1 abaixo, é um dos pontos em aberto |
| `demandas.html` | — | tabela 27 iniciativas × 10 canais, célula é um `<select>` que grava direto na matriz. **Nenhuma referência ao canvas hoje** — nem contador, nem link |
| `DRAWER` (painel lateral) | `js/drawer.js` | módulo genérico já usado em várias telas: `mostrar(titulo)`, `bloco(titulo, html)`, `blocoAsync(...)`. `DRAWER.abrirIniciativa(nome)` já existe e já monta um bloco "Matriz de demandas" por iniciativa (função `matrizHtml`) — é o hook mais barato pra pendurar as demandas do canvas, ver §2.4 |
| Exportador `.csv` da consolidação | `canva-consolidado.html`, função `exportarCsv` | **pronto**, com as colunas do canvas original (Projeto, Canal, Serviço, Problema, Bloqueio, Canal próprio, Qual, Responsável, Prazo) + operacionais (Status, Ciclo, Autor, Criado em). Exporta a lista filtrada (inclui filtro por canal, `#cvc-f-canal`) ou por projeto (botão por linha da fila) — "por projeto ou por canal" da §8 já está coberto pro `.csv` |
| Helper de export compartilhado | `js/csv-export.js` | `campo()`, `montar()`, `baixar()` — Blob + `<a download>`. Só CSV hoje |
| `urlCanva(id)` / `?canal=<id>` | `apresentacao_canais.html` (slide de fechamento por canal, adicionado nesta sessão) e `qrcodes/*.png` | mesmo contrato de URL que o item 5 vai reusar no link "abrir canvas desta oficina" de `demandas.html` — `https://www.cartacorso.com.br/canva.html?canal=<id>`, sem ciclo, sem facilitador |

---

## 1. Item 5 — Promoção pra `meta_inovacao_matriz_demandas`

### 1.1 A regra (§9 da parte 1) e o que ela não cobria

| Situação da célula | Efeito |
|---|---|
| `vazia` ou `previsto` | vira `formulario` |
| `oficina` (ou `oficina_confirmada`?) | **não rebaixa** — fato mais forte que formulário |
| `nao_aplica` ou `justificado` | não muda sozinha; vira **alerta** na consolidação |

A taxonomia de `celula_matriz` cresceu pra 9 estados desde que a §9 foi escrita (ela só
enumerava vazia/previsto/oficina/formulário/justificado/não_aplica). Faltam três:

- **`oficina_confirmada`** (oficina marcada, ainda não realizada) — é mais fraca que `oficina`
  feita, mas já é mais que `previsto`. Promove pra `formulario` ou fica parada como `oficina`?
- **`priorizado`** e **`encaminhado`** — são estágios **depois** de `formulario` no fluxo
  (`vazia → previsto → oficina → formulario → priorizado → encaminhado`, ver legenda de
  `demandas.html`). Por analogia com a regra de `oficina` (fato mais forte, não rebaixa), a leitura
  óbvia é: **também não rebaixam**, só somam o contador. Mas é leitura minha, não está escrito em
  lugar nenhum — **perguntar antes de codar**.

**Recomendação a confirmar com você:** estender a tabela pra

| Estado atual da célula | Nova demanda validada |
|---|---|
| `vazia`, `previsto` | → `formulario` |
| `oficina_confirmada`, `oficina`, `formulario`, `priorizado`, `encaminhado` | **não muda** — só soma no contador da célula |
| `nao_aplica`, `justificado` | **não muda** — gera alerta na consolidação |

Ou seja: só existe uma transição de estado automática (vazia/previsto → formulário); todo o resto
é "não mexe, só conta". Isso é mais conservador que inventar novas transições (`oficina →
formulario` automático, por exemplo, tiraria de uma pessoa a decisão de quando a oficina "virou"
formulário) — mas é uma escolha, não um fato, e por isso fica marcada como pendente de
confirmação, não como decidida.

### 1.2 Onde a lógica de promoção deveria morar

Duas opções. **Recomendo a B.**

**A. RPC explícita**, chamada pela tela depois de `validar`/`validar_lote` terem sucesso
(`canva-consolidado.html` chama `cc_canva_moderar` e, se `ok`, chama uma segunda RPC
`cc_canva_promover`).

- ✅ mais simples de escrever e de testar isoladamente
- ❌ dois passos client-side que podem ficar dessincronizados: um erro de rede entre a chamada 1 e
  a 2 deixa `validada` gravado sem promover a célula, e nada avisa que aconteceu. `validar_lote`
  piora isso — precisaria de uma promoção em lote também, outro caminho de código

**B. Trigger em `meta_inovacao_canva_demandas`**, `AFTER UPDATE ... WHEN (NEW.status = 'validada'
AND OLD.status IS DISTINCT FROM 'validada')`, `FOR EACH ROW`.

- ✅ cobre `validar` e `validar_lote` **de graça** — os dois fazem `UPDATE ... SET status =
  'validada' ...` por dentro de `cc_canva_moderar` (ver `tools/sql/2026-08_canva_leitura_aberta.sql`
  linhas 229-233 e 195-203); um trigger por linha dispara nos dois casos sem código especial pra
  lote
- ✅ mesmo padrão que `cc_audit()` já usa nas 4 tabelas editáveis — não é mecanismo novo no
  repositório, é o mesmo raciocínio de novo
- ✅ atômico: "validei" e "a matriz mexeu" acontecem na mesma transação, não tem janela onde um
  aconteceu e o outro não
- ❌ mais difícil de testar sem tocar o Supabase de verdade (os testes deste repo rodam por node,
  sem banco — ver `tools/testar_canva.js`); a lógica de promoção fica sem teste automatizado
  igual às outras funções SQL, que também não têm

O comentário que já existe na função (`tools/sql/2026-08_canva_leitura_aberta.sql:139-142`) diz
"sai em script separado" sem dizer trigger ou RPC — a decisão não estava tomada ainda quando
aquele texto foi escrito.

### 1.3 O problema de achar a linha certa da matriz

`meta_inovacao_canva_demandas.projeto` só é o nome **canônico** do golden record depois que
`projeto_id` está preenchido (por `vincular_projeto`, ou por ter casado automaticamente no
`cc_canva_gravar`, §6.2 da parte 1). Uma demanda com `projeto_novo = true` tem `projeto` = o que
a pessoa digitou, cru — **não dá pra usar isso pra achar a linha da matriz**, o nome pode não
bater com nada.

**Regra proposta:** o trigger (ou a RPC, na opção A) só promove quando `NEW.projeto_id IS NOT
NULL`. Demanda de projeto novo fica represada até alguém da equipe vincular na fila de projetos
novos (§8 da parte 1) — e depois de vincular, `vincular_projeto` já reescreve `projeto` pro nome
canônico, então validar **depois** de vincular passa a promover normalmente. Se a ordem for
inversa (validar antes de vincular), a promoção fica pra trás — vale um aviso na tela nesse caso
("Esta demanda ainda não está ligada a um projeto do cadastro — promova depois de vincular").

Segundo problema, mais chato: **a linha da matriz pode não existir ainda.** `demandas.html`
(`unir()`, linhas 162-183) só cria uma linha real em `meta_inovacao_matriz_demandas` quando
alguém edita a primeira célula daquela iniciativa (`addRow` "sob demanda"); antes disso, a
iniciativa aparece só como linha sintética em memória, com `id: null`. Uma demanda de canvas
validada pra um projeto que **nunca teve nenhuma célula editada na matriz** não tem UPDATE pra
fazer — precisa de um **upsert** (achar por `iniciativa`, se não achar, INSERT com todas as
colunas de canal vazias exceto a que está sendo promovida).

E como não há constraint de unicidade conhecida em `iniciativa`, um upsert por
`INSERT ... ON CONFLICT` não tem em cima do que fazer conflito. **Duas saídas, a decidir:**

1. `SELECT ... FOR UPDATE` por `iniciativa` dentro da função/trigger antes de decidir INSERT vs
   UPDATE (funciona sem constraint nova, mas não impede duas linhas para a mesma iniciativa se
   dois eventos concorrentes passarem pelo SELECT antes de qualquer um commitar — janela pequena,
   raramente vai acontecer com o volume desta equipe, mas existe)
2. Adicionar `CREATE UNIQUE INDEX ... ON meta_inovacao_matriz_demandas (iniciativa)` antes do
   item 5, e usar `INSERT ... ON CONFLICT (iniciativa) DO UPDATE` de verdade (mais robusto, mas é
   uma migração na tabela existente, fora do escopo original do item 5 — vale confirmar que não
   quebra nada em `js/matriz-store.js` primeiro, particularmente `addRow`, que hoje não trata
   conflito nenhum)

Recomendo (2), rodando como script prévio pequeno e isolado, exatamente como o item 5 pede pra
ser "commit pequeno e testável" — mas é acréscimo ao escopo original do plano, por isso citado
separado.

### 1.4 O alerta de conflito (`nao_aplica` / `justificado`)

A §9 da parte 1 diz "aparece um alerta na consolidação", sem especificar onde. Não existe hoje
nenhuma tabela de alertas nem lugar na tela pra isso. Duas formas simples, sem tabela nova:

- **A.** O trigger não muda a célula, mas grava uma nota, por exemplo aproveitando alguma coluna
  livre de auditoria — não há coluna própria pra isso hoje, precisaria de uma (`meta_inovacao_matriz_demandas.alerta_canvas text`, por exemplo)
- **B.** Nenhuma coluna nova: `canva-consolidado.html`, ao carregar, cruza as demandas validadas
  (client-side) com o estado atual da matriz (que ela já teria que buscar pra saber se promoveu)
  e mostra o alerta computado na hora, sem persistir nada. Mais simples, não precisa de migração,
  mas o alerta não sobrevive a um refresh de outra forma que não seja recalculado — o que é
  aceitável, o alerta é "ainda não resolvido", não um evento histórico

Recomendo **B** — é reversível, não pede coluna nova, e o `USING (true)` sem filtro que a matriz
e o canvas já têm tornam esse cruzamento client-side barato (não precisa de RPC nova, só um
`SELECT` a mais).

### 1.5 Mudanças em `demandas.html`

Duas peças, ambas na §9 da parte 1:

1. **Célula com demandas ganha contador discreto.** Precisa de uma contagem por (iniciativa,
   canal) das demandas do canvas (`meta_inovacao_canva_demandas`, filtrando `deleted_at is null`)
   — um `GROUP BY projeto, canal` client-side em cima do que `carregar()` de
   `js/db-canva-consolidado.js` já devolve (ou uma cópia mais enxuta da mesma query, sem os campos
   de texto longo, se a tabela crescer o bastante pra pesar trazer tudo pra `demandas.html` só
   pra contar).
2. **O clique abre o painel lateral com as linhas.** Duas rotas:
   - **B1 (mais barata):** o clique na célula chama `DRAWER.abrirIniciativa(iniciativa)`, que já
     existe e já mostra a Matriz de demandas daquela iniciativa (`matrizHtml`) — só falta
     acrescentar um `blocoAsync` novo ali dentro, "Demandas do canvas", com
     `supaBuscar("meta_inovacao_canva_demandas", "projeto=eq." + nome + "&deleted_at=is.null")`.
     Mostra **todas** as demandas da iniciativa, nos 10 canais — não só as do canal daquela
     célula.
   - **B2 (mais fiel ao texto da §9, "o clique abre... com as linhas" da célula):** painel novo,
     escopado a (iniciativa, canal), reaproveitando só as primitivas `mostrar`/`bloco` de
     `js/drawer.js`, não a função `abrirIniciativa` inteira.

   Recomendo **B1** pra uma primeira versão — é reaproveitamento de verdade (a diferença entre
   "reusar o drawer" e "escrever um painel novo que por acaso também usa `mostrar()`), e quem
   está olhando a matriz normalmente já clica no nome da iniciativa pra ver o resto do contexto
   dela. B2 fica como refinamento se, na prática, "ver as 10 demandas da iniciativa inteira" for
   informação demais pra quem só queria ver "as 2 do canal Portal".
3. **Cabeçalho de cada canal ganha o link "abrir canvas desta oficina".** Direto: trocar a linha
   58-59 de `demandas.html`
   (`document.getElementById("cab").innerHTML = "<tr><th>Iniciativa</th>" + CANAIS.map(...)`)
   pra incluir `<a href="canva.html?canal=' + c.id + '">↗</a>` (ou ícone equivalente) dentro de
   cada `<th>`. Mesma URL que `apresentacao_canais.html` já usa nos slides de QR — sem ciclo, sem
   facilitador, só `?canal=<id>`.

### 1.6 Checklist de implementação (item 5)

- [ ] **Confirmar com você:** a tabela estendida do §1.1 (o que fazer com `oficina_confirmada`,
      `priorizado`, `encaminhado`) — sem isso, qualquer código escrito faz uma suposição sozinha
- [ ] **Confirmar com você:** opção A ou B do §1.2 (RPC explícita vs. trigger)
- [ ] Se for adicionar `UNIQUE INDEX (iniciativa)` (§1.3, opção 2): script isolado, testado contra
      `js/matriz-store.js` antes de seguir
- [ ] Função/trigger de promoção, cobrindo `validar` e `validar_lote`, respeitando `projeto_id IS
      NOT NULL` como pré-condição
- [ ] `demandas.html`: contador por célula + integração com `DRAWER.abrirIniciativa` (§1.5.2) +
      link "abrir canvas desta oficina" no cabeçalho (§1.5.3)
- [ ] `canva-consolidado.html`: alerta client-side de conflito (§1.4)
- [ ] Rodar `tools/validar_site.py` e `tools/validar_dados.py`
- [ ] Testar contra o endpoint real (não só SQL Editor) — mesma lição de sempre deste projeto:
      GRANT sem policy, ou policy sem GRANT, só aparece batendo na API de verdade

---

## 2. Item 6 — Exportador `.docx`

### 2.1 O que já está pronto

O `.csv` (§0 acima): colunas do canvas original, exportável com filtro por canal ou por projeto.
**Não precisa de trabalho novo pro `.csv`** — o item 6 é só o `.docx`.

### 2.2 Abordagem recomendada: sem dependência nova

Seguindo a mesma filosofia que já decidiu `tools/vendor/` pro QR code — este repositório evita
dependência nova, e abre exceção só quando a peça que falta é algoritmicamente arriscada de
reescrever (Reed-Solomon do QR, não um "gerador de docx" genérico). Um `.docx` é um `.zip` com
XML dentro (formato OOXML/WordprocessingML); construir esse zip à mão é inteiramente viável sem
nenhuma lib:

- **Compressão STORE (sem DEFLATE), não é preciso comprimir.** Um `.docx` com entradas
  armazenadas sem compressão é um ZIP válido — Word abre normalmente, só fica um pouco maior.
  Isso elimina a única parte de um encoder de ZIP que dá trabalho de verdade (o algoritmo de
  compressão)
- **CRC32 é obrigatório mesmo em STORE** (é parte do cabeçalho de cada entrada do ZIP,
  independente de compressão) — mas é um algoritmo pequeno e bem conhecido (~20 linhas com tabela
  de 256 entradas), dá pra escrever e testar contra o vetor de teste padrão
  (`crc32("123456789") == 0xCBF43926`) sem vendorizar nada
- **Partes mínimas de um `.docx` válido:** `[Content_Types].xml`, `_rels/.rels`,
  `word/document.xml`, `docProps/core.xml`. Um documento com título + uma tabela por demanda
  (ou por projeto/canal, replicando o layout do `.docx` original descrito na origem do plano —
  PROJETO, CANAL, FACILITADOR, Serviço, Problema, Bloqueio, Canal próprio, Responsável, Prazo)
  não precisa de mais que isso — sem estilos elaborados, sem imagem, sem cabeçalho/rodapé

**Novo módulo `js/docx-export.js`**, no mesmo espírito de `js/csv-export.js` (Blob + `<a
download>`, sem servidor):

```
window.DOCX_EXPORT = {
  zip(arquivos)              // [{nome, conteudo:Uint8Array}] → Uint8Array de um .zip válido (STORE)
  documentoXml(titulo, grupos)  // grupos: [{titulo, linhas:[{rotulo,valor}...]}] → word/document.xml
  gerar(nomeArquivo, titulo, grupos)  // monta o zip completo e dispara o download
}
```

`canva-consolidado.html` chamaria `DOCX_EXPORT.gerar(...)` do mesmo jeito que já chama
`CSV_EXPORT.baixar(...)` hoje — ao lado do botão "Exportar .csv", um "Exportar .docx", tanto no
topo (lista filtrada) quanto por linha da fila de projetos (mesmo padrão do botão
`data-exportar-projeto` que já existe pro CSV).

### 2.3 Teste, sem depender do Word estar instalado

`tools/testar_docx_export.js` (mesmo padrão dos outros `tools/testar_*.js` — roda por node, sem
navegador):

- CRC32 contra o vetor de teste conhecido
- Estrutura do ZIP gerado: cabeçalho local (`PK\x03\x04`) de cada entrada, fim do diretório
  central (`PK\x05\x06`) presente e com os offsets batendo — dá pra verificar isso lendo os bytes
  na mão, sem precisar de uma lib de unzip
- `word/document.xml` é XML bem formado (mesmo truque que `validar_site.py` já usa em outro
  contexto: um parser de XML/HTML rejeitando tag não fechada é o teste mais barato que existe)

Verificação manual (não automatizável no CI deste projeto): abrir um `.docx` gerado de verdade no
Word (ou LibreOffice) pelo menos uma vez antes de considerar pronto — mesmo espírito da
verificação por OpenCV que os QR codes do item 7 já tiveram (§12 da parte 1: "decodificado de
volta contra a URL esperada antes de considerar pronto").

### 2.4 Checklist de implementação (item 6)

- [ ] `js/docx-export.js`: `zip()`, CRC32, `documentoXml()`, `gerar()`
- [ ] `tools/testar_docx_export.js`: CRC32 contra vetor conhecido + estrutura do ZIP
- [ ] Botão "Exportar .docx" em `canva-consolidado.html`, ao lado do "Exportar .csv" existente
      (lista filtrada e por projeto — mesmos dois pontos que o `.csv` já cobre)
- [ ] Abrir pelo menos um arquivo gerado num Word/LibreOffice de verdade antes de dar por pronto
- [ ] Rodar `tools/validar_site.py` e `tools/validar_dados.py`

---

## 3. Perguntas em aberto — não decidi sozinho, preciso da sua palavra antes de codar

1. **§1.1** — o que promover automaticamente além de `vazia`/`previsto → formulario`?
   `oficina_confirmada`, `priorizado` e `encaminhado` também "não rebaixam, só contam" como
   `oficina`? É a leitura óbvia por analogia, mas a §9 original não fala deles.
2. **§1.2** — trigger (promoção automática e atômica, mas sem teste automatizado) ou RPC explícita
   chamada pela tela (mais simples de testar, mas dois passos que podem dessincronizar)? Recomendo
   trigger.
3. **§1.3** — vale adicionar `UNIQUE INDEX (iniciativa)` em `meta_inovacao_matriz_demandas` como
   pré-requisito do item 5, ou prefere que a promoção conviva com o risco pequeno de corrida sem
   mexer no schema existente?
4. **§1.5.2** — o clique na célula abre o drawer da **iniciativa inteira** (B1, reaproveita
   `DRAWER.abrirIniciativa`, mostra os 10 canais) ou um painel novo **escopado só ao par
   (iniciativa, canal)** da célula clicada (B2, mais fiel ao texto da §9, mais código novo)?
   Recomendo B1 pra uma primeira versão.
