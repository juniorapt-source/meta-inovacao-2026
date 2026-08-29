# PLANO DE EXECUÇÃO — Débitos técnicos (Carta de Corso)

Inventário levantado em **29/08/2026** varrendo o repositório inteiro (código, docs, SQL,
suíte de testes) e rodando tudo que roda sem Chrome e sem rede. É a lista dos débitos
**em ordem de correção por criticidade** — do que já está quebrado hoje ao que só encarece
mudança futura. Cada item traz modelo, esforço e dependências.

Não confundir com as outras duas frentes vivas: `PLANO_EXECUCAO_GOLDEN_RECORD.md` (golden
record de cadastros) e `PLANO_EXECUCAO_MELHORIAS_NAVEGACAO.md` (itens da reunião do José).
Aqui não há funcionalidade nova pedida por ninguém — é manutenção do que já existe.

## Como subir o que for feito aqui

**Autorização permanente do José (29/08/2026), válida pra todo item deste documento: ao
terminar um item, mescle na `main` e dê push. Não abra PR, não espere aprovação, não
pergunte de novo a cada item.** O site publica sozinho a cada push na `main`
(`meta-monitor/README.md`), e este é o fluxo padrão do repositório (`CLAUDE.md`, decisão
de 26/08/2026). Um item por commit, com a suíte verde antes.

### O procedimento, exato

Sessões do Claude Code costumam nascer com uma **branch designada** (`claude/…`) e com a
instrução de não empurrar em outra branch sem permissão — essa instrução ganha do
`CLAUDE.md`, e é por isso que "só dê push na `main`" não basta como orientação. **A
autorização acima é a permissão que faltava**: trabalhe na sua branch designada e, ao
fechar o item, mescle você mesmo na `main`:

```bash
# 1. commit na sua branch designada, como sempre
git push -u origin <sua-branch>

# 2. traga a main mais recente (ela quase sempre andou desde que sua branch nasceu)
git fetch origin main
git checkout -B main origin/main     # -B, não merge: o clone pode ser raso e a main
                                     # local vir com história velha e desconectada

# 3. mescle e publique
git merge <sua-branch>
git push origin main
```

`git checkout -B main origin/main` descarta o que houver na `main` **local** — o que é o
que se quer aqui, já que o trabalho está na sua branch e a verdade está no `origin`. Se o
`git merge` acusar conflito, resolva; se o conflito for no próprio plano (duas sessões
marcando itens diferentes como ✅ ao mesmo tempo), **as duas marcações ficam** — nenhuma
substitui a outra.

Depois do push, confirme que o que você mesclou está lá:
`git ls-tree -r --name-only origin/main | grep <arquivo>`.

### As três exceções, e só elas

1. **Item marcado `[humano]`** — é decisão ou validação do José. Não dá pra "fazer" numa
   sessão; pare, escreva a pergunta e espere.
2. **Item com dependência declarada na tabela** (coluna "Depende de") — não subir antes do
   item de que depende estar na `main`. Subir fora de ordem aqui significa, na prática,
   deixar produção num estado intermediário que ninguém revisou.
3. **Item que muda comportamento de escrita em produção** — o código sobe pela `main` como
   sempre, mas a parte de banco/config só o José executa, e a ordem código × banco está
   escrita no próprio item. Subir o código antes do banco quebra a escrita pra todo mundo
   — foi exatamente o que aconteceu na v0.29.0. Hoje só o **D5.2** cai aqui (o D2 deixou
   de cair quando José escolheu seguir com o token compartilhado: nenhuma policy muda).

Tudo que **não** cai nesses três casos vai pra `main` assim que estiver testado.

## Legenda — modelo e esforço

(Mesma régua das outras duas frentes, de propósito, pra manter os documentos comparáveis.)

| Modelo | Quando usar aqui |
|---|---|
| **Haiku** | Cópia de padrão já existente quase à risca, texto/comentário, apagar arquivo morto. |
| **Sonnet** | A maioria do pacote — causa raiz já mapeada, correção mecânica, sem decisão de arquitetura em aberto. |
| **Opus** | Mudança de modelo de estado/dado ou de segurança com risco real de regressão silenciosa. |

| Esforço | Quando usar |
|---|---|
| **baixo** | Mudança pequena e contida, 1–2 arquivos, padrão já resolvido antes. |
| **médio** | Várias partes móveis, caminho conhecido. |
| **alto** | Mexe em lógica de estado E de tela ao mesmo tempo, ou em várias telas de uma vez. |

Atividades marcadas **[humano]** são decisão ou execução que só José faz.

---

## D1 — Guardrail de FK está vermelho e cego 🔴 CRÍTICO

**Sintoma:** `node tools/auditoria_fk_final.js --check` sai com código 1 acusando 7
"lacunas novas" de escrita de FK (representantes de projeto, liderança da URC,
responsáveis por canal).

**Causa raiz (confirmada, não é chute):** a auditoria faz `grep` dentro de `editor.html`
(`tools/auditoria_fk_final.js:117-231`, entradas `FONTES["editor.html"]`) procurando
`DB_PROJETO_REPRESENTANTES.criar(`, `DB_URC.salvarLideranca(`, `canal_id: canalIdPorNome(`
etc. A refatoração de 28/08 (extração das 8 abas, `BACKLOG.md`) moveu esse código pra
`js/editor-projetos.js` e `js/editor-urc.js`. O código existe e funciona — a ferramenta é
que olha o arquivo errado.

**Por que é o item nº 1:** o mais grave não é o vermelho, é a cegueira. Se alguém quebrar
de verdade a gravação de uma dessas FKs, a saída não muda — já está vermelha. O guardrail
que existia justamente pra proteger a Camada 2/4 do golden record parou de proteger, e o
vermelho permanente treina qualquer sessão nova a ignorar a saída dele.

| # | Atividade | Arquivo(s) | Modelo/Esforço | Depende de | Status |
|---|---|---|---|---|---|
| D1.1 | Apontar as `FONTES` e os `ok:` das entradas 2.2/2.3/2.4 pros arquivos extraídos (`js/editor-projetos.js`, `js/editor-urc.js`), mantendo `editor.html` pras âncoras que continuam lá | `tools/auditoria_fk_final.js` | Sonnet / baixo | — | ✅ feito 29/08/2026 |
| D1.2 | Conferir as demais entradas (2.1, 2.5, 2.6, 2.7) pelo mesmo risco — qualquer âncora que aponte pra `editor.html` precisa ser reconferida contra as 8 abas extraídas | `tools/auditoria_fk_final.js` | Sonnet / baixo | D1.1 | ✅ feito 29/08/2026 — 2.1 e 2.6 também tinham âncora velha (nucleo_id foi pra `js/editor-projetos.js`, a junção de responsáveis do plano pra `js/editor-plano.js`); rótulos de 2.7 também corrigidos (`js/editor-corsario.js`/`js/editor-projetos.js`). 2.5 já estava certo (canva-consolidado.html não fez parte da extração) |
| D1.3 | Provar que o guardrail voltou a guardar: quebrar de propósito uma gravação de FK num dos módulos extraídos, ver o `--check` acusar, desfazer | — | Sonnet / baixo | D1.2 | ✅ feito 29/08/2026 — removida de propósito a atribuição de `patch.nucleo_id` em `js/editor-projetos.js`, `--check` acusou a lacuna nova (2.1), revertido em seguida (sem diff) |

**Teste de aceite:** `node tools/auditoria_fk_final.js --check` sai 0 com `LACUNAS_REGISTRADAS`
vazio, e sai != 0 quando D1.3 quebra a gravação de propósito. Suíte do README verde.
**Sobe direto pra `main`** — não depende de nada nem de ninguém.

---

## D2 — Escrita do banco é pública na prática 🔴 CRÍTICO — **decisão tomada (29/08/2026): segue com token compartilhado**

`data/config.js` versiona `tokenEscrita: "a7c11b08-…"` e `js/gate.js` joga isso em
`window.CC_TOKEN` em toda página. Qualquer pessoa com o link abre o DevTools e grava nas 9
tabelas do esquema. **Isso é decisão consciente e documentada** (v0.30.0 reverteu o login
por e-mail/senha porque senha esquecida custava mais caro que a exposição do token) — não
é um bug. O que está aberto é o custo que essa decisão deixou espalhado:

- `js/auth.js` (236 linhas) ficou no repositório como **código morto** — nenhuma tela
  carrega mais; `OPCOES_AUTH`/`clientePrincipal()` em `js/supabase.js` idem;
  `meta_inovacao_editores` existe vazia no banco.
- `js/gate.js` tem `HASH_SENHA = "SUBSTITUIR_PELO_HASH"`. **Se alguém ligar
  `exigirSenha: true` sem gerar o hash, ninguém entra** — nenhuma senha casa com o
  placeholder. É uma bomba armada esperando a primeira pessoa que resolver "proteger o
  site rapidinho".
- O token anterior (`90bb649c-…`) está no histórico do Git; o atual também estará no dia
  em que for trocado.

| # | Atividade | Arquivo(s) | Modelo/Esforço | Depende de | Status |
|---|---|---|---|---|---|
| D2.1 | **[humano]** José decide o rumo da escrita | — | José | — | ✅ **RESPONDIDO 29/08/2026 — caminho (a): segue com token compartilhado.** O risco (qualquer um com o link edita) fica formalmente aceito; nada de login, nada de IP. Só desarmar as bombas abaixo. |
| D2.2 | Desarmar o gate: fazer `js/gate.js` **falhar alto** quando `exigirSenha === true` e `HASH_SENHA` ainda for o placeholder (console + overlay explicando como gerar o hash), em vez de trancar todo mundo em silêncio | `js/gate.js` | Sonnet / baixo | — | ✅ feito 29/08/2026 |
| D2.3 | Apagar `js/auth.js` (236 linhas, nenhum `<script src>` aponta pra ele desde a v0.30.0) | `js/auth.js` | Haiku / baixo | — | ✅ feito 29/08/2026 |
| D2.4 | Corrigir os comentários que ainda afirmam que a escrita passa por sessão do Supabase Auth — `js/supabase.js:12-14,45,79` e `js/db-canva-consolidado.js:19`. Documentação errada no topo do arquivo de escrita é o que faz a próxima sessão desenhar em cima de premissa falsa | `js/supabase.js`, `js/db-canva-consolidado.js` | Sonnet / baixo | D2.3 | ✅ feito 29/08/2026 |
| D2.5 | Registrar no `CHANGELOG.md` que o modelo token-compartilhado é a escolha definitiva do projeto (não um estado transitório pós-reversão), com o risco aceito escrito por extenso | `CHANGELOG.md` | Haiku / baixo | D2.4 | ✅ feito 29/08/2026 |

> **⚠ NÃO REMOVER `clientePrincipal()` NEM `OPCOES_AUTH` de `js/supabase.js`.** A primeira
> versão deste documento (commit `10c81a1`) listava os dois como resíduo morto — **está
> errado, conferido em 29/08/2026**: `js/matriz-store.js:67` chama `clientePrincipal()` em
> produção e 9 testes headless fazem stub dele (`real.clientePrincipal = ...`);
> `OPCOES_AUTH` monta os dois clients (`js/supabase.js:56` e `:71`). Removê-los quebra a
> Matriz de demandas e a suíte. O único arquivo morto de verdade é `js/auth.js`.

**Tudo aqui sobe direto pra `main`, sem dependência de banco nenhum.** Com o caminho (a),
nada de policy muda: as 9 tabelas seguem no modelo `cc_token_*` que já está em produção
desde a v0.30.0. É só código morto e comentário mentiroso saindo do caminho — nenhuma
mudança de comportamento visível pra quem usa o site.

---

## D3 — Suíte sem runner e sem CI, com deploy automático a cada push 🟠 ALTO

O `README.md` lista ~25 comandos rodados **um a um, à mão**, e a `main` publica sozinha a
cada push. Não existe `package.json`, script `test`, nem `.github/workflows`: nada impede
um push quebrado de ir pro ar, e a única barreira hoje é a disciplina de quem está
commitando.

Pior: **15 testes existem no repositório e não estão no README** — `testar_kanban_headless.js`,
`testar_projetos_headless.js`, `testar_participantes_headless.js`, `testar_canva.js`,
`testar_canva_oficina.js`, `testar_canva_multiprojeto_headless.js`,
`testar_canva_combo_pessoas_headless.js`, `testar_canva_consolidado_golden_headless.js`,
`testar_historico_headless.js`, `testar_supabase_erros.js`, `testar_guardrail_urc_supabase.js`,
`testar_iniciativas_cruzado.js`, `testar_dashboard_golden_headless.js`,
`testar_minhas_acoes_golden_headless.js`, `testar_projetos_golden_headless.js`. Quem segue
o README acha que rodou a suíte e rodou uns 60% dela.

**Estado medido em 29/08/2026** (tudo que roda sem Chrome e sem rede): `validar_dados.py`,
`testar_calc.js`, `validar_site.py`, `testar_kpis_cruzado.py`, `testar_editor.js`,
`gerar_responsavel_id --check`, `testar_responsaveis.js`, `testar_catalogos_base.js` e
`testar_busca_golden.js` **passaram**; só `auditoria_fk_final --check` falhou (é o D1).

| # | Atividade | Arquivo(s) | Modelo/Esforço | Depende de | Status |
|---|---|---|---|---|---|
| D3.1 | `tools/rodar_testes.sh` (novo): roda a suíte na ordem certa, separa os que precisam de Chrome dos que não precisam, para no primeiro vermelho, resumo final por teste | `tools/rodar_testes.sh` | Sonnet / médio | D1 (senão nasce vermelho) | ✅ feito 29/08/2026 — `--sem-chrome` (10 testes) verde; os 12 `--com-chrome` passam individualmente, menos `testar_drawer_headless.js` (falha por falta de rede real pro Supabase **deste ambiente**, o mesmo limite já registrado no D7 — não é regressão; roda verde com Chrome + rede de verdade, ex.: GitHub Actions no D3.3) |
| D3.2 | Reconciliar README × testes existentes: os 15 órfãos entram no runner e no README, ou são apagados se estiverem obsoletos (decidir um a um, rodando cada um) | `README.md`, `tools/testar_*.js` | Sonnet / médio | D3.1 | ✅ feito 29/08/2026 — os 15 rodados um a um: nenhum obsoleto, todos passaram (2 deles — `testar_iniciativas_cruzado.js`/`testar_guardrail_urc_supabase.js` — falam com produção mas saem 0 sem rede, mesmo padrão de graceful-skip de `testar_rede_real_headless.js`). Os 15 entraram no README e em `tools/rodar_testes.sh` (11 no lote `--com-chrome`, 4 no `--sem-chrome`) |
| D3.3 | GitHub Actions rodando D3.1 a cada push na `main` (Chromium disponível no runner; `testar_rede_real_headless.js` fica de fora — exige `--confirmar` e produção) | `.github/workflows/testes.yml` (novo) | Sonnet / médio | D3.1 | ✅ feito 29/08/2026 — workflow na raiz do repositório (GitHub só lê `.github/workflows/` na raiz; `working-directory: meta-monitor` em todos os passos), roda `tools/rodar_testes.sh` inteiro (D3.1+D3.2, `testar_rede_real_headless.js` de fora por não estar na lista do runner) em `push`/`pull_request` pra `main` + `workflow_dispatch` manual. `ubuntu-latest` já traz Chrome; um passo confere isso antes da suíte pra falhar cedo e com mensagem clara se a imagem do runner mudar |
| D3.4 | **[humano]** José confere que o badge/resultado do Actions aparece e que um push quebrado de propósito fica vermelho | — | José | D3.3 | ⏳ metade respondida sozinha: o push do D3.3 já disparou o workflow de verdade (run [#1](https://github.com/juniorapt-source/meta-inovacao-2026/actions/runs/33261269530)) e ele **saiu vermelho** — mas por um motivo alheio ao D3.3, ver nota abaixo. Falta só José confirmar que o badge aparece pra ele na UI do GitHub |

> **Nota sobre o primeiro run (29/08/2026):** saiu vermelho em `testar_drawer_headless.js`,
> não pela suíte/workflow em si — os 22 testes antes dele passaram, inclusive os 4 órfãos
> que só o D3.3 pôde provar com rede de verdade (`testar_iniciativas_cruzado.js` e
> `testar_guardrail_urc_supabase.js` saíram OK de verdade, não só "puladas por falta de
> rede" como neste ambiente sem egress). O motivo é um dos dois cenários que o próprio
> `testar_drawer_headless.js` documenta como dependente de rede real (comentário no topo
> do arquivo): a régua do Corsário pra Sebraetec, hardcoded no teste como "~49,5% ·
> Marujo" desde que foi escrito, hoje está em produção como "52,6% · Timoneiro" — alguém
> avançou os critérios do Corsário da Sebraetec desde então, e o teste nunca tinha rodado
> contra o Supabase de verdade antes (este ambiente sempre bateu 403 nesse fetch). Isso é
> um teste fixado num valor de produção que muda com o tempo, não uma regressão de D1/D3 —
> mas com o D3.3 no ar, vai continuar vermelho até alguém atualizar o valor esperado (ou
> trocar a asserção por algo que não fixe um número de produção). Fora do escopo de
> D3.1/D3.2/D3.3 (é conteúdo do Corsário, não runner/CI) — sugerido como tarefa separada.

**Sobe direto pra `main` item a item** — D3.1 antes de D3.2/D3.3, que dependem dele.

---

## D4 — Duplicação estrutural nos 13 wrappers `js/db-*.js` 🟠 ALTO

13 arquivos, 2.424 linhas, todos com o mesmo esqueleto copiado: `forcarFallback()` lendo
`?semrede=1`/`CC_FORCAR_FALLBACK`, `buscarDoSupabase()`, `seedLocal()`, memoização em
`promessa`, flag `usandoFallback`. Não existe `js/db-base.js`.

**Custo real, não estético:** mudar a política de fallback, o tratamento de erro ou o
header de escrita significa editar 13 arquivos e lembrar dos 13. Foi assim que o GRANT
esquecido do P10 passou (só apareceu em produção) e assim que a v0.29.0 quebrou 5 tabelas
de uma vez.

| # | Atividade | Arquivo(s) | Modelo/Esforço | Depende de | Status |
|---|---|---|---|---|---|
| D4.1 | `js/db-base.js` (novo): fábrica que recebe `{ tabela, linhaPara, paraLinha, ordem }` e devolve `{ carregar, salvar, criar, removerSoft, usandoFallback }` — mesmo comportamento observável de hoje, zero mudança de API pras telas | `js/db-base.js` | Opus / médio | D3.1 (precisa da suíte num comando só) | ⏳ não iniciado |
| D4.2 | Migrar 2 wrappers simples primeiro (`db-nucleos.js`, `db-coletivos.js`), rodar a suíte inteira, só então seguir | `js/db-nucleos.js`, `js/db-coletivos.js` | Sonnet / baixo | D4.1 | ⏳ não iniciado |
| D4.3 | Migrar os demais, um commit por wrapper, suíte completa entre cada um. `db-canva.js`/`db-canva-consolidado.js`/`db-responsaveis.js` **ficam de fora** — não seguem este padrão (RPC/derivado) | `js/db-*.js` | Sonnet / alto | D4.2 | ⏳ não iniciado |

**Sobe direto pra `main`, um wrapper por commit** — a granularidade é a rede de segurança:
se uma tela quebrar, o `git revert` é de um arquivo só. Lição da etapa 8 do `BACKLOG.md`
vale aqui inteira: rodar a suíte **completa** depois de cada wrapper, não só o teste da
tela que mudou.

---

## D5 — Convivência "FK golden × texto legado" espalhada por 17 arquivos 🟡 MÉDIO

O desenho "FK primeiro, texto legado como fallback, nunca quebra" foi a escolha certa pra
migrar sem downtime — e em boa parte é **desenho final, não débito** (assim está registrado
no golden record). O que é débito é o que ficou meio migrado esperando decisão:

- **C1 (decisão do José em aberto desde 26/08):** `js/matriz-store.js.carregarLegado()` e o
  painel "Conferência com a tabela antiga" de `demandas.html` nasceram pra validar uma
  migração que **já terminou**. Continuam como rede de segurança permanente ou saem?
- A aposentadoria de `meta_inovacao_matriz_demandas` está travada nessa mesma resposta: dos
  4 consumidores, só `js/drawer.js` foi migrado; `editor.html` (aba Histórico) nunca será
  candidato (só rotula auditoria antiga); sobram os dois do C1.
- Uma nova rodada da CONSULTA A/C em produção, pedida ao José em 26/08 pra confirmar que a
  escrita fechada não deixou linha sem FK, **continua pendente**.

| # | Atividade | Arquivo(s) | Modelo/Esforço | Depende de | Status |
|---|---|---|---|---|---|
| D5.1 | **[humano]** José responde o C1: painel de conferência sai ou fica permanente? | — | José | — | ⏳ não iniciado — **bloqueia D5.2** |
| D5.2 | Se "sai": remover o painel de `demandas.html`, `carregarLegado()` de `js/matriz-store.js` e a leitura restante de `meta_inovacao_matriz_demandas`; script SQL de `drop` da tabela antiga pro José rodar | `demandas.html`, `js/matriz-store.js`, `tools/sql/` (novo) | Opus / médio | D5.1 | ⏳ não iniciado |
| D5.3 | **[humano]** José roda a CONSULTA A/C em produção e devolve o resultado (checklist enviado em 26/08) | — | José | — | ⏳ não iniciado |

**D5.2 não sobe sem D5.1** — é remoção de rede de segurança, não dá pra "testar em
produção e ver no que dá".

---

## D6 — Telas grandes com JS/CSS inline (o que sobrou do `editor.html`) 🟡 MÉDIO

`editor.html` foi de 1744 → 519 linhas nas 8 etapas de extração. O mesmo padrão continua
em três telas: **`canva.html` (1156 linhas)**, **`corsario.html` (1017)** e
**`canva-consolidado.html` (813)**, cada uma com `<style>` inline próprio.

E a extração deixou um resíduo já registrado no `BACKLOG.md`: `opts`, `avisoFallback`,
`marcarLinhaStatus`, `marcarCelulaStatus`, `detErro`, `nucleosPorNome`,
`projetoIdPorIniciativa`, `normalizarNomePessoa`, `nomeExibicaoPessoa`, `NUCLEOS_VALIDOS`,
`pessoasAtual`/`pessoasFallback` ainda moram em `editor.html` expostos via `window.X` —
**sem nenhum consumidor dentro do próprio arquivo**. Os 8 módulos os leem por variável
global.

| # | Atividade | Arquivo(s) | Modelo/Esforço | Depende de | Status |
|---|---|---|---|---|---|
| D6.1 | `js/editor-shared.js` (novo): mover os 10 helpers + `EDITOR_PESSOAS_CACHE` pra lá, `editor.html` só carrega. Fecha o círculo das 8 etapas | `editor.html`, `js/editor-shared.js` | Sonnet / médio | D3.1 | ⏳ não iniciado |
| D6.2 | **[humano]** José decide se `canva.html` entra na fila agora — está com o item 3 da frente de navegação em redesenho numa branch fora da `main`; extrair antes do merge cria conflito garantido | — | José | item 3 da nav | ⏳ não iniciado |
| D6.3 | Extrair o JS inline de `corsario.html` pra `js/corsario.js` (é a maior das três sem trabalho concorrente) — uma etapa só, com teste headless antes e depois | `corsario.html`, `js/corsario.js` | Sonnet / alto | D6.1 | ⏳ não iniciado |

**D6.1 e D6.3 sobem direto pra `main`. D6.2 é bloqueio real** — `canva.html` tem
redesenho em andamento fora da `main` (item 3 de `PLANO_EXECUCAO_MELHORIAS_NAVEGACAO.md`);
mexer nele agora significa resolver conflito em 1156 linhas.

---

## D7 — `drawer.js` e `busca.js` mostram dado congelado 🟡 MÉDIO

`js/drawer.js:339` e `js/busca.js:54` leem `DB.plano` — o seed síncrono de
`data/plano.js` — em vez de `DB_PLANO.carregar()`. Limitação registrada no CHANGELOG
v0.17.0 ("fora do escopo desta leva") e nunca resolvida.

**Efeito visível pro usuário:** o painel de Pessoa e a busca global mostram status e prazos
do último commit, não o que está no Supabase. Alguém que marcou uma ação como concluída
pelo Plano de ação continua vendo "não iniciado" na busca — sem nenhum aviso de defasagem,
diferente do resto do site, que mostra o aviso de fallback.

| # | Atividade | Arquivo(s) | Modelo/Esforço | Depende de | Status |
|---|---|---|---|---|---|
| D7.1 | Migrar `js/drawer.js` e `js/busca.js` pra `DB_PLANO.carregar()`, com o mesmo fallback pro seed e o mesmo aviso discreto das outras telas | `js/drawer.js`, `js/busca.js` | Opus / médio | D4 (se D4 já tiver rodado, é bem mais barato) | ⏳ não iniciado |
| D7.2 | Estender `tools/testar_drawer_headless.js` e `tools/testar_busca_headless.js` pra cobrir "dado ao vivo diferente do seed" com dublê de Supabase | testes | Sonnet / médio | D7.1 | ⏳ não iniciado |

**Sobe direto pra `main`.** Atenção ao que o golden record já registrou: num ambiente sem
rede pro Supabase, 2 asserções do drawer falham por isso e só por isso.

---

## D8 — Higiene acumulada (itens pequenos, um commit só) 🟢 BAIXO ✅ CONCLUÍDO (29/08/2026)

Todos pequenos, nenhum bloqueia nada, nenhum depende de decisão. Vão juntos num commit
("higiene: documentação e arquivos obsoletos") ou em commits pequenos seguidos.

| # | Item | O que fazer | Arquivo(s) | Modelo/Esforço | Status |
|---|---|---|---|---|---|
| D8.1 | `PLANO_EXECUCAO.md` está **duplicado byte a byte** na raiz e em `meta-monitor/docs/` | Manter um, apagar o outro, corrigir os links que apontarem pro apagado | `PLANO_EXECUCAO.md`, `docs/PLANO_EXECUCAO.md` | Haiku / baixo | ✅ feito — apagado o da raiz, mantido `docs/PLANO_EXECUCAO.md`; nenhum link apontava pro caminho da raiz |
| D8.2 | `docs/CAMADA5_AUDITORIA_FK.md` documenta o estado de *antes* dos itens 5.5–5.9 | Ou atualizar, ou marcar no topo como documento histórico congelado (o plano já avisa que está velho — falta o aviso no próprio arquivo) | `docs/CAMADA5_AUDITORIA_FK.md` | Haiku / baixo | ✅ feito — aviso de "documento histórico congelado" adicionado no topo, apontando pro golden record |
| D8.3 | `docs/_to_delete/PROPOSTA_GOLDEN_RECORD_PESSOAS.md` — pasta com nome de "apagar depois", versionada | Apagar (o conteúdo vivo está em `PROPOSTA_ESQUEMA_CADASTROS_REFERENCIA.md`) | `docs/_to_delete/` | Haiku / baixo | ✅ feito — pasta apagada |
| D8.4 | `docs/BUILD_STATUS.md` — log de build da madrugada da v0.1.0, fóssil | Apagar | `docs/BUILD_STATUS.md` | Haiku / baixo | ✅ feito — apagado; as 2 menções soltas em `README.md`/`README_deploy.md` (diagrama de árvore de diretório) corrigidas |
| D8.5 | 40 scripts em `tools/sql/`, vários sendo correção de correção (`corrige_escrita_*`, `reverte_para_token_compartilhado`, `auth_escrita_completa`) — a única fonte de verdade de "o que já rodou em produção" é o CHANGELOG em prosa | `tools/sql/APLICADOS.md` (novo): uma linha por script, data em que José rodou, estado atual (aplicado / revertido / nunca rodado). Não é migration tooling, é um índice — proporcional ao projeto | `tools/sql/APLICADOS.md` | Sonnet / médio | ✅ feito — 33 scripts indexados, cronológico, reconstruído do `CHANGELOG.md` + planos de execução. 2 diagnósticos (`auditoria_fk_final.sql`, `matriz_celulas_diagnostico.sql`) marcados à parte, por não serem migração |
| D8.6 | `BACKLOG.md` registra a extração do `editor.html` como concluída, mas não registra os débitos que ela deixou (D1 e D6.1) | Uma linha em cada, apontando pra este documento | `BACKLOG.md` | Haiku / baixo | ✅ feito |

**Sobe direto pra `main`.** D8.5 é o único que dá algum trabalho — exige ler o CHANGELOG
inteiro pra reconstruir o que foi rodado quando; se ficar duvidoso em algum script, marcar
"⚠ confirmar com José" em vez de chutar.

---

## Status por item — resumo pra retomar em sessão nova

Se você está começando uma sessão nova pra continuar este trabalho, isto é o que precisa
saber sem reler tudo acima:

1. **Ordem sugerida de ataque:** D1 → D3.1/D3.2 → D8 (barato, tira ruído) → D4 → D6.1 →
   D7 → D3.3. D2 e D5 andam em paralelo assim que José responder D2.1 e D5.1.
2. **D1 é o único item que eu classificaria como "conserta hoje"** — é contido, tem teste
   próprio, não toca comportamento do site e devolve um guardrail que hoje não guarda nada.
3. **Duas perguntas ainda travam trabalho e estão com José:** D5.1 (o painel de
   conferência sai ou fica) e D6.2 (`canva.html` entra na fila de extração antes ou depois
   do merge do item 3 da navegação). **D2.1 foi respondida em 29/08/2026** — segue com
   token compartilhado, D2.2 a D2.5 liberados.
4. **Nada aqui foi iniciado até 29/08/2026** — este documento é o levantamento, não um
   registro de baixa. Ao concluir um item, mude o status na tabela dele **no mesmo commit**
   da correção, como as outras duas frentes fazem.
5. **Não existe item aqui que peça migração SQL de escrita**, exceto D5.2 (`drop` da tabela
   antiga) e um eventual caminho (b) do D2.3. Vale a regra de sempre: José roda tudo à mão
   no SQL Editor, nenhuma automação tem acesso de escrita à produção.
