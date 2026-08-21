# Plano: canvas das oficinas preenchido direto no site

**Status:** especificação aprovada, implementação pendente
**Versão:** v5, 21/08/2026
(v1 tratava o canal como eixo principal, corrigido na v2, ver §2. v3 acertou a leitura para o mundo
pós-v0.30.0, ver §6.5. v4 travou a regra de que este site não tem senha, ver §6.6. v5 corrigiu duas
linhas que a v4 deixou contradizendo a própria regra, na §6.5 e na §8)
**Origem:** hoje o canvas "Agente na sua empresa" circula como `.docx` (exemplo: Embrapii ×
Sebrae na sua empresa, facilitador Cristiano). Cada oficina gera um arquivo solto, que ninguém
consolida.
**Decisão:** o canvas vira uma página do próprio site (`cartacorso.com.br`), gravando no Supabase
que o painel já usa. Nada de Google Forms, Tally ou iframe de terceiro.

---

## 1. Por que uma página nativa e não um formulário embedado

| Alternativa | Por que não |
|---|---|
| Google Forms / Tally em iframe | o dado cai fora do Supabase. Alguém vira o exportador de CSV oficial, todo ciclo. E iframe de terceiro tende a bater na mesma trava de rede corporativa que já bloqueia o site pra parte dos colegas |
| Canva / Miro colaborativo | ótimo pra desenhar, péssimo pra virar dado. Não tem como cruzar com a matriz nem gerar KPI |
| Continuar no `.docx` | é o estado atual. Uma linha preenchida na oficina não chega a lugar nenhum sem alguém digitar de novo |
| **Página `canva.html` no site** | **recomendado.** Mesmo banco, mesma identidade visual, alimenta a matriz de demandas, e é coerente com a tese que a oficina defende: registrar nos meios oficiais |

Ponto retórico que vale mais que o técnico: a coluna 4 do canvas pergunta ao gestor se o serviço
**já existe em canal próprio (pirata)**. Preencher esse canvas num Google Forms seria o próprio
canal pirata em ação. A ferramenta precisa praticar o que a oficina prega.

---

## 2. O eixo é o PROJETO, não o canal

Correção sobre a v1 deste plano. O `.docx` da Embrapii tem "Sebrae na sua empresa" no cabeçalho,
o que dá a impressão de que o canvas é por canal. Não é. Aquele arquivo é **um recorte de uma
oficina de canal**. O objeto real é maior:

> Um projeto pode ter **N demandas para N canais**, e mais de uma demanda **para o mesmo canal**.

A Embrapii, no exemplo, tem 3 linhas só pra "Sebrae na sua empresa" (consumo da base filtrada,
visitação às empresas atendidas, divulgação do produto). Amanhã tem 2 pro Portal e 1 pro CNR.

Isso é exatamente **a linha do projeto na matriz de demandas** (`demandas.html`, tabela
`meta_inovacao_matriz_demandas`), 1 iniciativa × 10 canais. O canvas é a camada de detalhe por
trás de cada célula dessa linha.

```
Embrapii (linha da matriz)
 ├── Foco+                  → 0 demandas   célula "—"
 ├── CNR                    → 1 demanda
 ├── Sebrae na sua empresa  → 3 demandas   ← o .docx que você mandou
 ├── Portal                 → 2 demandas
 └── ...                      (10 canais no total)
```

Duas consequências de projeto que a v1 errava:

1. **A tela abre pelo projeto**, não pelo canal. O gestor entra, vê a linha DELE na matriz, com os
   10 canais, e preenche onde enxerga oportunidade. O canal vira campo da linha, não trava da URL
2. **Canais são fixos, projetos nascem.** Canal pode ser whitelist fechada com validação dura.
   Projeto **não pode**, sob pena de um projeto novo não conseguir preencher nada. Ver §5.2

---

## 3. Cardinalidade, explicitada

| Relação | Cardinalidade |
|---|---|
| Projeto → canais | 1 : N (até 10, os canais fixos) |
| Projeto × canal → demandas (linhas do canvas) | 1 : N. Três linhas pro mesmo canal é o caso normal, não exceção |
| Demanda → responsável e prazo | 1 : 1, ambos obrigatórios |
| Projeto × canal → célula da matriz | 1 : 1. A célula guarda o **status** da relação, as demandas moram na tabela nova |

Isso separa duas coisas que hoje se confundem: **status da relação** (`previsto`, `oficina feita`,
`formulário ok`, `não se aplica`, os 9 estados de `js/status.js` contexto `celula_matriz`) e
**conteúdo da demanda**. A matriz continua dona do status. O canvas passa a ser dono do conteúdo.

---

## 4. Decisões travadas

| Decisão | Escolha | Motivo |
|---|---|---|
| Eixo da tela | **projeto**, com os 10 canais dentro | é assim que o gestor pensa: "o que eu preciso de cada canal" |
| Acesso | **link aberto, sem código e sem login** | fricção zero na sala. Ninguém instala nada, ninguém cria conta |
| Identidade, onde for necessária | **código de 6 dígitos por e-mail (OTP). Nunca senha** | regra do projeto, ver §6.6. Senha foi a causa raiz da v0.30.0 |
| Proteção | **quarentena**: tudo nasce como `rascunho` | link aberto sem quarentena é convite. Nada preenchido pelo público toca a matriz antes de um editor promover |
| Escrita no banco | via **RPC `SECURITY DEFINER`**, não INSERT direto | com link aberto, o `anon` não deve ter GRANT nenhum na tabela. A função valida e grava |
| Leitura | **não pública** | o canvas tem "por que não funcionaria" com nome e prazo. Não vai ficar legível pra internet inteira |
| Canal | whitelist fechada, validação dura | são fixos, e a matriz depende deles pra casar a célula |
| Projeto | dropdown do golden record **+ escape "meu projeto não está na lista"** | projeto novo nasce a qualquer momento. Não pode ser barrado na porta |
| Layout | mini-matriz do gestor, não formulário chapado | espelha `demandas.html`, que ele vai ver projetada na oficina |
| Menu | `canva.html` **fora** do menu lateral | é página de destino de QR, não de navegação. A consolidação é que entra no menu |

---

## 5. Modelo de dados

Tabela nova: `meta_inovacao_canva_demandas`. **Uma linha por demanda**, ou seja, uma linha por
serviço apresentado. Segue `tools/sql/PADRAO_TABELA.md` (prefixo, RLS, soft delete, `updated_at`),
com a exceção de leitura não pública documentada no topo do script.

| Coluna | Tipo | Origem no `.docx` | Obrigatório |
|---|---|---|---|
| `id` | bigint identity PK | | |
| `projeto` | text | PROJETO | **sim**, nome canônico do golden record quando casa |
| `projeto_digitado` | text | | **sim**, o que a pessoa escolheu ou digitou, cru. Única evidência se o casamento errar o alvo |
| `projeto_id` | bigint FK → `meta_inovacao_projetos` | | não, nulo enquanto o projeto for novo |
| `projeto_novo` | boolean default false | | marca linha que veio pelo escape, aguardando normalização |
| `nucleo` | text | | preenchido pela função quando o projeto é conhecido |
| `canal` | text | CANAL (URC) | **sim**, id de `data/canais.js` |
| `facilitador` | text | FACILITADOR URC | não |
| `ciclo` / `encontro_id` | text | | não |
| `servico` | text | Serviço apresentado | **sim** |
| `problema` | text | Problema do projeto que ele resolve | **sim** |
| `bloqueio` | text | Por que não funcionaria? | não |
| `canal_proprio` | text | Já existe em canal próprio (pirata)? | sim, `sim` / `nao` / `nao_sei` |
| `canal_proprio_qual` | text | qual? | sim se `canal_proprio = 'sim'` |
| `responsavel` | text | Responsável | **sim** |
| `prazo` | date | Prazo | **sim** |
| `status` | text | | `rascunho` no insert, depois `validada` / `descartada` |
| `autor_nome` | text | quem digitou | sim |
| `sessao_id` | uuid | gerado no navegador | sim |
| `criado_em` | timestamptz default now() | | |
| `deleted_at`, `updated_at`, `updated_by` | | padrão do projeto | |

Índices: `(projeto, canal)`, `(status)`, `(projeto_novo) WHERE projeto_novo`.

**Sem constraint de unicidade em `(projeto, canal)`.** É o ponto da §3: três demandas pro mesmo
par é o comportamento esperado.

### A regra do rodapé vira constraint

O `.docx` termina com *"Nenhuma linha sai da mesa sem responsável e prazo"*. Deixa de ser aviso e
vira código, em dois lugares: `CHECK (responsavel <> '' AND prazo IS NOT NULL)` no banco, e botão
desabilitado com o motivo visível ao lado, na tela.

---

## 6. Segurança com link aberto

Sem código de oficina, o link é público de fato. A proteção não é impedir a escrita, é **isolar o
que foi escrito**.

**6.1. `anon` não recebe GRANT na tabela.** Nenhum. Nem SELECT, nem INSERT. A única porta é a
função:

```sql
CREATE FUNCTION public.cc_canva_gravar(p jsonb) RETURNS jsonb
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ ... $$;
GRANT EXECUTE ON FUNCTION public.cc_canva_gravar(jsonb) TO anon;
```

**6.2. Validação assimétrica: canal duro, projeto macio.** A diferença mais importante desta
versão.

- `canal`: precisa estar na whitelist dos 10 canais, dentro da função. Canal desconhecido é erro,
  a linha não grava. Canais são fixos e a matriz depende deles
- `projeto`: **não é rejeitado se não existir**. Se casar com um projeto do golden record, grava
  `projeto_id` e `nucleo`. Se não casar, grava `projeto_novo = true`, `projeto_id = null`, e a
  linha entra normalmente. Projeto novo preenche igual, e a normalização acontece depois, na
  consolidação. Barrar aqui seria mandar embora exatamente o gestor mais novo, que é quem mais
  precisa entrar na matriz

O casamento de nome usa comparação normalizada (minúsculas, sem acento, espaços colapsados), pra
"embrapii", "Embrapii" e "EMBRAPII " caírem no mesmo lugar. Quando casa, `projeto` guarda o **nome
canônico** do golden record, não o que foi digitado, senão o "agrupar por projeto" da consolidação
quebra em dois grupos pela diferença de caixa. O texto cru fica em `projeto_digitado`, que é a
única evidência disponível no dia em que o casamento acertar o projeto errado.

**6.3. Resto da validação.** `servico`, `problema`, `responsavel` não vazios. `prazo` não nulo e
dentro de uma janela sã (hoje menos 30 dias até hoje mais 2 anos). Máximo de 2000 caracteres por
campo. Teto de 20 linhas por `sessao_id` e 40 por dia por projeto. Estourou, devolve erro amigável
em vez de gravar. `status` vem sempre forçado como `rascunho`, ignorando o que vier no payload.

**6.4. Edição da própria linha.** `cc_canva_editar(p jsonb)` aceita `sessao_id` + `id` e só
atualiza se o `sessao_id` bater, a linha tiver menos de 24 horas e ainda estiver como `rascunho`.
Permite corrigir typo sem abrir a porta pra editar o que outro escreveu.

**6.5. Leitura.** `SELECT` na tabela só pra `authenticated` que passe em `cc_eh_editor()`
(`tools/sql/2026-08_auth_escrita_completa.sql`).

**Contexto que mudou depois da v1 deste plano:** a v0.30.0 (20/08) reverteu o site inteiro pro
token compartilhado. `meta_inovacao_editores` ficou vazia e nenhuma tela carrega `js/auth.js`.
Isso **não** rebaixa a leitura desta tabela pra `cc_token_select`: o `tokenEscrita` vive em texto
puro no `data/config.js`, versionado em repositório público e servido a qualquer visitante. Token
público como barreira de leitura é obscuridade, não proteção, e o conteúdo aqui é o gestor
escrevendo por que o canal não funcionaria, com nome e prazo.

A saída não é religar o login do site. É o contrário: **`canva-consolidado.html` nasce sendo a
única tela do site que exige identidade.** Nenhuma regressão possível numa página que ainda não
existe, e as 5 telas atuais seguem no token, como estão hoje. `cc_eh_editor()` e
`meta_inovacao_editores` continuam no banco: falta só o INSERT do editor na allowlist, que entra no
script do item 1.

Atenção ao precedente de `tools/sql/2026-08_corrige_escrita_select_autenticado.sql`: já aconteceu
neste projeto de a policy de SELECT pro `authenticated` faltar e a tela quebrar em produção. Criar
SELECT e escrita no mesmo script.

O gestor não lê a tabela: a página guarda o que ele mandou no `localStorage`, sob a chave
`cc_canva_<projeto_slug>_<sessao_id>`, e mostra a partir dali. Consequência pra quem implementar:
**não encadear `.select()`** nas chamadas, o retorno da RPC já traz o `id` gerado.

**Mas essa identidade não é senha.** Ver §6.6, que é regra do projeto e não detalhe desta tela.

---

## 6.6. Regra do projeto: este site não tem senha

**Nenhuma tela deste projeto pede senha, em momento nenhum.** Não é preferência de UX, é a lição
mais cara que este repositório já pagou: a v0.29.0 subiu login por e-mail e senha em 20/08 às
01:41, e a v0.30.0 reverteu o site inteiro às 02:00, dezenove minutos depois, porque a senha se
perdeu. Reintroduzir senha aqui é agendar a mesma reversão.

Onde for preciso saber quem é a pessoa, o mecanismo é **código de 6 dígitos por e-mail**, o OTP do
próprio Supabase Auth. Sem senha pra esquecer, sem cofre pra manter, sem reset pra pedir. Quem tem
acesso ao e-mail entra, e a allowlist `meta_inovacao_editores` continua decidindo quem pode ler.

Como fica, na prática:

1. `js/auth-otp.js`, arquivo novo. **Não mexer no `js/auth.js`**, que hoje não é carregado por
   nenhuma tela: deixá-lo parado é mais barato que reescrevê-lo
2. Pedir o código: `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } })`.
   `shouldCreateUser: false` é obrigatório, senão qualquer e-mail digitado vira usuário novo
3. Conferir o código: `supabase.auth.verifyOtp({ email, token, type: 'email' })`. Sessão criada,
   persistida em `localStorage`, renovada sozinha pelas opções que `js/supabase.js` já usa
4. **Passo de configuração no painel, uma vez:** em Authentication → Email Templates, o modelo
   "Magic Link" precisa conter `{{ .Token }}`. Sem isso o Supabase manda um link em vez de código,
   e o `verifyOtp` fica sem número pra receber
5. `detectSessionInUrl` continua `false`. Código digitado não usa redirect, então o modelo atual de
   `js/supabase.js` fica intacto

Limites que valem saber: um código por minuto por usuário, validade de 1 hora, e o SMTP embutido do
Supabase tem cota baixa. Para um punhado de logins por semana, sobra.

**Fallback que torna o desenho seguro:** mesmo que o e-mail falhe no pior momento, o dono do
projeto no Supabase passa por cima de RLS no SQL Editor. Perde-se a tela, nunca o dado.

**6.7. Honeypot.** Campo escondido por CSS (`empresa_site`). Bot preenche, humano não. Se vier
preenchido, a função responde "ok" e não grava nada.

**6.8. Auditoria.** Trigger `cc_audit()` na tabela, como nas outras tabelas editáveis de verdade.

---

## 7. A página `canva.html`

### URL

```
https://www.cartacorso.com.br/canva.html                      → escolhe o projeto na tela
https://www.cartacorso.com.br/canva.html?projeto=embrapii     → já abre na linha do projeto
https://www.cartacorso.com.br/canva.html?canal=empresa        → abre com o canal pré-marcado
```

O parâmetro `canal` **não trava mais nada**. Ele só pré-seleciona o canal da primeira demanda e
destaca aquele canal na lista, pra usar no QR da oficina daquele canal. O gestor continua livre pra
adicionar demanda pra qualquer outro canal na mesma sessão. Foi o erro da v1: travar o canal
esconderia 9 das 10 oportunidades.

### Estrutura visual: a mini-matriz do gestor

Reaproveita `css/base.css` e o esqueleto de `docs/IDENTIDADE_VISUAL.md`, **sem** `montarShell()`.
Página de destino de QR não precisa de menu lateral, e menu lateral em oficina só distrai.

**Passo 1, identificação:**

```
┌───────────────────────────────────────────────┐
│ CANVAS DE DEMANDAS                            │
│ Ciclo 1 · oficina do canal Sebrae na sua empresa │
├───────────────────────────────────────────────┤
│ Meu projeto: [ dropdown 27 iniciativas    ▾ ] │
│              ↳ "não encontrei meu projeto"    │
│ Meu nome:    [______________]                 │
└───────────────────────────────────────────────┘
```

O link "não encontrei meu projeto" abre um campo de texto livre e um aviso curto: *"vamos cadastrar
seu projeto depois, pode preencher normalmente"*. Nada bloqueia.

**Passo 2, a linha do gestor na matriz:**

```
┌─────────────────────────────┬──────────────────────────┐
│ Foco+                       │ nenhuma demanda   [ + ]  │
│ CNR                         │ 1 demanda    [ ver ][ + ]│
│ Sebrae na sua empresa   ★   │ 3 demandas   [ ver ][ + ]│
│ Portal                      │ nenhuma demanda   [ + ]  │
│ Marketing Cloud             │ nenhuma demanda   [ + ]  │
│ Loja                        │ nenhuma demanda   [ + ]  │
│ Rede própria e parceira     │ nenhuma demanda   [ + ]  │
│ Assessoria de negócios      │ nenhuma demanda   [ + ]  │
│ DXP                         │ nenhuma demanda   [ + ]  │
│ Contabilidade               │ nenhuma demanda   [ + ]  │
└─────────────────────────────┴──────────────────────────┘
                                       ★ = canal desta oficina
```

O gestor vê os 10 canais de uma vez. É o mesmo desenho de `demandas.html` que ele acabou de ver
projetado, o que reduz a explicação a zero. E os 9 canais vazios são uma pergunta silenciosa.

**Passo 3, a demanda:** clicar `+` abre o cartão com os 6 campos do `.docx`.

```
│  Serviço apresentado ............ [____________]         │
│  Que dor ele endereça hoje ...... [____________]         │
│  Por que não funcionaria ........ [____________]         │
│  Já existe em canal próprio? .... ( )sim ( )não ( )não sei│
│      qual .......................  [____________]        │
│  Responsável .................... [____________]         │
│  Prazo .......................... [__/__/____]           │
```

Desktop: cartão em 2 colunas. Mobile: um campo por linha, ponto de virada em 900px.

### Comportamento

1. Ao abrir, gera `sessao_id` (`crypto.randomUUID()`) no `localStorage`. Se já existir um daquele
   projeto com menos de 24h, reusa e recarrega o que já foi enviado
2. Cada demanda salva sozinha ao fechar o cartão, com debounce de 1,5s. Nada de "enviar tudo" no
   fim, porque alguém vai fechar a aba antes
3. Estados visíveis por demanda: `rascunho local` / `salvando` / `salva` / `erro, tentar de novo`
4. Sem responsável ou sem prazo, fica com selo `incompleta` e **não** é enviada. O selo explica o
   motivo em uma frase
5. Offline ou erro de rede: mantém no `localStorage` e reenfileira. Sala de oficina com WiFi ruim é
   o cenário normal, não a exceção
6. Botão "baixar minha cópia" gera `.csv` do que aquele gestor preencheu, agrupado por canal.
   Comprovante, e mata a ansiedade de quem quer o arquivo na mão
7. Acessibilidade: `label` em todo campo, foco visível, navegação por teclado

---

## 8. Tela de consolidação: `canva-consolidado.html`

Entra no menu, grupo **Execução**, abaixo de "Matriz de demandas". É a **única tela do site que
exige identidade**, por código de 6 dígitos no e-mail (`js/auth-otp.js`, §6.6). Nunca senha, e sem
tocar no `js/auth.js`. Quem pode ler continua sendo decidido pela allowlist `meta_inovacao_editores`.

**Contrato herdado do item 1, obrigatório:** sob esta RLS, sessão ausente ou fora da allowlist
devolve **0 linhas sem erro nenhum**. Na tela, "faça login" e "ninguém preencheu ainda" são a mesma
resposta do banco. A página tem que checar a sessão antes de interpretar a lista vazia, senão vai
anunciar "nenhuma demanda" para um usuário deslogado no dia seguinte à oficina.

- lista as demandas agrupadas por projeto e canal, com filtro por status, ciclo e canal
- por linha: **validar** (`validada`), **descartar** (`descartada`, soft delete), **editar**
- em lote: validar todas as demandas de um projeto de uma vez, depois da oficina
- **fila de projetos novos**: as linhas com `projeto_novo = true` aparecem separadas no topo. Duas
  ações: *casar* com um projeto existente (typo, apelido, "Embrapii" vs "EMBRAPII") ou *cadastrar*
  no golden record via `editor.html › Projetos & Representantes` e vincular. Enquanto não
  normalizado, o dado existe e não se perde, só não entra na matriz
- **promover pra matriz**: ao validar a primeira demanda de um par projeto × canal, a célula
  correspondente de `meta_inovacao_matriz_demandas` muda de status. Ver §9
- exportar `.csv` e `.docx` no formato do canvas original, por projeto ou por canal
- contadores no topo: demandas por canal, projetos que preencheram, **projetos que não
  preencheram**. Essa última é a mais útil das três, é ela que vira cobrança

---

## 9. Integração com `demandas.html`

O ponto de encaixe já existe e não precisa de estado novo. A taxonomia de `js/status.js`, contexto
`celula_matriz`, tem 9 estados, e um deles é **`formulario` ("formulário ok")**. É exatamente esse
o destino de uma célula alimentada pelo canvas.

Regra proposta, a confirmar com você antes de codar:

| Situação da célula | Efeito |
|---|---|
| célula em `vazia` ou `previsto`, e chega demanda validada | vira `formulario` |
| célula já em `oficina` (oficina feita) | **não** rebaixa. A oficina é fato mais forte que o formulário. Só ganha o contador |
| célula em `nao_aplica` ou `justificado` | não muda sozinha. Aparece um alerta na consolidação: alguém pediu demanda num canal marcado como não aplicável. Conflito que merece olho humano, não automação |

Mais duas mudanças pequenas em `demandas.html`:

1. Célula com demandas ganha contador discreto, e o clique abre o painel lateral com as linhas
2. Cabeçalho de cada canal ganha o link "abrir canvas desta oficina", já com o parâmetro certo, pra
   você projetar na sala sem digitar URL

---

## 10. Fluxo da oficina, do ponto de vista do gestor

1. Último slide da apresentação do canal tem QR grande e a URL escrita por extenso, pra quem não
   conseguir ler o QR
2. O gestor aponta a câmera e cai na tela, com o canal da oficina destacado
3. Escolhe o projeto dele, digita o nome, e vê a linha dele com os 10 canais
4. Preenche a demanda do canal que acabou de ser apresentado. Se lembrar de outra pra outro canal,
   preenche ali mesmo, sem esperar a oficina daquele canal
5. Fim da sessão: você projeta a consolidação e mostra quantas demandas entraram e quais projetos
   ficaram em branco. Constrangimento produtivo, ao vivo
6. Depois, com calma, você normaliza os projetos novos, valida e promove pra matriz

---

## 11. Riscos

| Risco | Mitigação |
|---|---|
| **Rede corporativa bloqueando o site.** Hoje parte dos colegas não abre `cartacorso.com.br`. Oficina presencial com todo mundo no WiFi do Sebrae e o canvas ao vivo morre na porta | testar com 2 ou 3 pessoas da sala antes do ciclo. Orientar a usar 4G, que é o caminho natural de quem entra por QR. Manter o `.docx` como plano B da sessão |
| Link aberto usado indevidamente | quarentena de rascunho, tetos por sessão, honeypot, auditoria. Nada entra na matriz sem validação |
| Projeto novo digitado de 5 jeitos diferentes | comparação normalizada no casamento, fila de projetos novos na consolidação, e a decisão final sempre humana |
| Gestor preenche pelo projeto errado | dropdown com os nomes canônicos do golden record. O campo livre é escape, não o caminho padrão. Correção na consolidação |
| Ninguém preenche | o painel de "quem não preencheu" projetado no fim da sessão resolve mais que e-mail depois |
| Duas pessoas do mesmo projeto preenchem | permitido de propósito. A consolidação mostra lado a lado e você funde |

---

## 12. Ordem de implementação

Cada item é um commit pequeno e testável.

1. `tools/sql/2026-08_canva_demandas.sql`: tabela, índices, RLS sem GRANT pro `anon`, funções
   `cc_canva_gravar` e `cc_canva_editar` (com a validação assimétrica da §6.2), trigger de
   auditoria, `NOTIFY pgrst`
2. `js/db-canva.js`: camada de acesso no padrão dos outros `js/db-*.js`. Chama as RPC, cuida da
   fila offline e do `localStorage`
3. `canva.html`: identificação, mini-matriz do gestor, cartão de demanda
4. `canva-consolidado.html` + linha no `GRUPOS` de `js/core.js`, incluindo a fila de projetos novos
5. Promoção pra `meta_inovacao_matriz_demandas` com a regra da §9, e ajustes em `demandas.html`
6. Exportadores `.csv` e `.docx`
7. QR codes por canal, gerados uma vez e colados no último slide de cada apresentação

**Checkpoint entre o item 1 e o item 3.** O item 1 não está pronto quando o script existe, e sim
quando ele **rodou em produção** e o `anon` foi testado contra o endpoint real. Enquanto o SQL não
rodou, o desenho da tabela é de graça: mudar coluna é editar um arquivo. Depois que rodar, toda
mudança vira `ALTER TABLE` + `NOTIFY pgrst`. Todo acerto de esquema tem que acontecer antes desse
ponto.

**`NOTIFY pgrst, 'reload schema';` no fim do script**, mesmo sendo tabela nova. O
`PADRAO_TABELA.md` dispensa o NOTIFY em `CREATE TABLE`, e está certo quanto à tabela. Mas este
script também cria **funções** (`cc_canva_gravar`, `cc_canva_editar`), e função nova fora do cache
do PostgREST devolve `PGRST202: Could not find the function ... in the schema cache`, que na tela
parece bug do JavaScript. Custa uma linha e evita uma tarde de depuração no lugar errado.

**Antes de cada sessão:** `git pull`. O repositório andou duas vezes em 20/08 (v0.30.0 e o script
da reversão) sem que a cópia local acompanhasse. Sessão que começa de uma cópia velha reintroduz o
que já foi revertido.

Antes de subir: rodar `tools/validar_dados.py`. A whitelist de canais dentro da função SQL é um
quarto lugar onde os canais aparecem, junto de `data/canais.js`, `data/matriz.js` e o dropdown de
`demandas.html`. Se um canal novo nascer algum dia, é preciso bater nos quatro.

---

## 13. O que fica de fora, de propósito

- **Login pros gestores.** Decisão consciente. Fricção de cadastro mata preenchimento em oficina
- **Senha, em qualquer tela.** Regra do projeto, §6.6. Onde precisar de identidade, é código por
  e-mail. Um pedido futuro de "coloca uma senha aqui" deve ser recusado com esta linha
- **Cadastro automático de projeto novo no golden record.** O escape grava a intenção, não cria o
  projeto. Golden record com cadastro automático deixa de ser golden record
- **Edição colaborativa em tempo real.** Duas pessoas no mesmo canvas é problema que ainda não
  existe. Se aparecer, o realtime do Supabase já está em uso em `js/matriz-store.js`
- **Anexos e upload.** O canvas é texto curto. Arquivo abre uma frente de storage que não paga o
  que custa
- **Notificação automática pro responsável.** Tentador, mas responsável e prazo digitados numa
  oficina são compromisso de mesa, não tarefa atribuída. Vira ação no plano depois de você validar,
  e o plano já sabe notificar
