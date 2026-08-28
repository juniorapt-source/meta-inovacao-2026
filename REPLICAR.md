# Replicar este projeto — o que você precisa antes de começar

Este repositório é o painel **Carta de Corso / Meta Inovação 2026** (Unidade de Inovação,
Sebrae Nacional). Ele foi entregue a você para ser **replicado**: aproveitar a estrutura,
os cálculos, o modelo de dados e as telas, trocando o conteúdo pelo do seu contexto.

Você não precisa ler o projeto inteiro para começar. Precisa de três coisas:

1. **Ferramentas locais** (Node e Python — nada mais)
2. **Uma hospedagem** para um site estático
3. **Um projeto Supabase seu**, com as tabelas criadas

O caminho mais rápido é deixar o próprio repositório te dizer o que falta:

```bash
cd meta-monitor
node tools/checar_prerequisitos.js            # diagnóstico local, não usa rede
node tools/checar_prerequisitos.js --rede     # depois de configurar o Supabase: confere tabela a tabela
```

Esse script varre o código, descobre quais tabelas o site consulta, quais scripts SQL
criam cada uma, em que ordem rodar, e o que ainda está apontando para o projeto original.
Ele é a fonte de verdade — este documento é o contexto ao redor dele.

---

## 1. O que este projeto é (e o que ele não é)

**É** um site **100% estático**: HTML, CSS e JavaScript puro. Sem build, sem bundler, sem
framework, sem `node_modules`. Você pode abrir `meta-monitor/index.html` com dois cliques,
direto do disco, e o site funciona — as telas que não dependem do banco aparecem
imediatamente.

**Não é** uma aplicação com servidor. Não existe backend próprio: o único serviço externo
é o **Supabase** (Postgres gerenciado + API REST automática), consultado direto do
navegador com a `anon key`.

Os dados vivem em dois lugares:

| Onde | O quê |
|---|---|
| `meta-monitor/data/*.js` | A maior parte do conteúdo, versionado no Git. Formato `window.DB.chave = {...}` — JSON legível, editável à mão ou pelo `editor.html`. |
| Supabase | Plano de ação, Agenda, Matriz de demandas, Projetos, Pessoas, Corsário e o log de auditoria — o que muda no dia a dia e precisa de várias pessoas editando. |

Quando o Supabase está fora do ar ou ainda não foi configurado, as telas caem para a
cópia local de `data/*.js` e mostram um aviso discreto ("dados locais — pode haver
defasagem"). **Ou seja: o site sobe e funciona antes mesmo de você ter banco.** Configure
o Supabase quando quiser edição colaborativa e histórico.

---

## 2. Pré-requisito: ferramentas locais

| Ferramenta | Por quê | Obrigatória? |
|---|---|---|
| **Node 18+** | Roda os testes de cálculo e os testes headless (`tools/testar_*.js`) e o verificador de pré-requisitos | Sim, para desenvolver |
| **Python 3** | Roda `tools/validar_dados.py`, `validar_site.py`, `testar_kpis_cruzado.py` (só biblioteca padrão) | Sim, para desenvolver |
| **Chrome ou Chromium** | Os testes headless abrem um navegador real via CDP | Só para a suíte headless |
| **Git** | Publicação (todo push publica) | Sim |

**Não existe `package.json` nem `requirements.txt` — e isso é de propósito.** O projeto não
tem uma única dependência externa. Nada de `npm install`, nada de `pip install`. Se algum
dia você adicionar uma, terá quebrado a propriedade mais útil deste repositório: ele abre e
roda em qualquer máquina, hoje e daqui a cinco anos.

Se o Chrome estiver em um caminho fora do comum: `export CHROME_PATH=/caminho/pro/chrome`.

---

## 3. Pré-requisito: hospedagem

Qualquer hospedagem de site estático serve, porque não há build nem servidor:
**Vercel**, **Netlify**, **Cloudflare Pages**, **GitHub Pages**, ou até um bucket S3.

O fluxo usado no projeto original é o mais simples que existe:

1. Crie um repositório **seu** no GitHub e suba estes arquivos.
2. No Vercel: **Add New → Project → Import** do seu repositório.
3. Framework preset: **Other**. Sem comando de build. Output = a pasta `meta-monitor`
   (ou mova o conteúdo de `meta-monitor/` para a raiz do seu repositório e deixe output = raiz).
4. Deploy.

A partir daí, **todo `git push` publica sozinho** — não há passo manual de deploy.

> ⚠️ **O site é público por padrão.** Existe um "gate" de senha opcional
> (`meta-monitor/js/gate.js`, ligado por `data/config.js: exigirSenha`), mas ele é
> proteção *client-side leve*: evita que alguém caia na página por acidente, não impede
> quem sabe abrir o DevTools. Se o seu conteúdo for sensível, use a proteção de acesso da
> própria hospedagem (Vercel Password Protection, Cloudflare Access) em vez de confiar no
> gate.

---

## 4. Pré-requisito: banco de dados (Supabase)

### 4.1 Crie o seu projeto

Crie uma conta em [supabase.com](https://supabase.com) e um projeto novo (o plano
gratuito dá conta deste site com folga). Anote, em **Project Settings → API**:

- a **Project URL** (`https://xxxxxxxx.supabase.co`)
- a **anon public key**

### 4.2 Troque a configuração

Em `meta-monitor/js/config.js`, substitua `SUPABASE_URL` e `SUPABASE_ANON_KEY` pelos seus.

**Sobre a anon key ficar versionada no repositório:** é intencional, não um vazamento. Ela
é uma chave *pública* — qualquer visitante do site a vê no código-fonte da página. Quem
protege os dados é a **RLS (Row Level Security)** configurada nas tabelas, não o segredo da
chave. O que você **nunca** pode versionar é a `service_role key` — essa ignora RLS.

Em `meta-monitor/data/config.js` há também um `tokenEscrita` (UUID). Ele é o modelo de
escrita atualmente em produção: a RLS libera `INSERT/UPDATE` para quem manda o header
`x-cc-token` com esse valor. **Gere um UUID novo para a sua cópia** e troque nos dois
lugares que precisam bater 1:1:

- `meta-monitor/data/config.js` → `tokenEscrita`
- `meta-monitor/tools/sql/2026-08_reverte_para_token_compartilhado.sql`

Entenda o que esse modelo significa: o token chega ao navegador em texto puro, então
**qualquer pessoa com o link do site consegue extraí-lo e escrever no banco**. Isso foi uma
decisão consciente do projeto original (equipe pequena, conteúdo interno, conveniência
acima de controle). Existe no repositório um modelo alternativo, com login de verdade
(Supabase Auth + allowlist de editores) — `tools/sql/2026-08_auth_escrita.sql` e o runbook
`docs/SEGURANCA_ESCRITA_AUTH.md`. **Se a sua cópia for para um público maior ou dados
sensíveis, use o modelo de login, não o token.**

### 4.3 Crie as tabelas

Todos os scripts estão em `meta-monitor/tools/sql/` e `meta-monitor/supabase/`. Rode cada
um no **SQL Editor** do dashboard do Supabase (a `anon key` não tem permissão de DDL — não
dá para automatizar isso de fora). Os scripts são idempotentes: rodar de novo não duplica
nada.

Para a lista completa e a ordem:

```bash
node tools/checar_prerequisitos.js
```

Ele calcula a ordem a partir dos cabeçalhos `ORDEM DE EXECUÇÃO: depois de <arquivo>.sql`
que os próprios scripts carregam. **Leia o cabeçalho de cada script antes de rodar** — todos
explicam o que fazem, e alguns têm seções de reversão que você não quer executar por
engano (o verificador marca esses com ⚠).

Três armadilhas que já custaram caro no projeto original:

1. **`GRANT` antes de policy.** No Postgres a RLS é a *segunda* barreira. Sem
   `GRANT SELECT ON <tabela> TO anon, authenticated`, a consulta é negada com
   `42501 permission denied` **antes** da policy sequer ser avaliada — mesmo com a policy
   correta criada. O checklist obrigatório para toda tabela nova está em
   `tools/sql/PADRAO_TABELA.md`. Leia antes de criar qualquer tabela sua.
2. **Três tabelas não têm `CREATE TABLE` versionado** — `plano_acao_atividades`,
   `corsario_criterios` e `corsario_status` foram criadas à mão no Table Editor do projeto
   original, antes deste padrão existir. Numa réplica você precisa criá-las você mesma; as
   colunas esperadas aparecem nos scripts que as *alteram* (procure pelo nome da tabela em
   `tools/sql/`) e nas consultas em `js/db-corsario.js` e `js/drawer.js`. Se não criar, as
   telas Corsário e "Atividades por iniciativa" ficam vazias e o resto do site funciona
   normal.
3. **Prefixo `meta_inovacao_`.** O Supabase original é compartilhado com outros projetos,
   por isso todas as tabelas são prefixadas. No seu projeto, sozinho, o prefixo é
   desnecessário — mas **não renomeie**: o nome está escrito em dezenas de lugares no JS.
   Manter é barato; renomear é uma tarde de trabalho e um bug silencioso.

### 4.4 Popule com dados

Os dados do projeto original vêm junto (é intencional — você pode aproveitá-los como
referência ou como semente). Os scripts SQL de migração já trazem os `INSERT` de seed. Para
regenerar os blocos de seed a partir dos `data/*.js` atuais:

```bash
node tools/gerar_seed_supabase.js
```

Ele imprime os `INSERT` no stdout para você colar no SQL — não escreve nada sozinho, de
propósito, para o SQL continuar revisável por um humano.

### 4.5 Confira

```bash
node tools/checar_prerequisitos.js --rede
```

Vai bater no *seu* Supabase e dizer, tabela a tabela: responde / não existe / existe mas
falta GRANT.

---

## 5. Rode os testes antes de mexer

A suíte inteira é local e rápida. Ela existe porque o projeto não tem tipos nem compilador —
os testes são a única rede de segurança.

```bash
cd meta-monitor
python3 tools/validar_dados.py          # integridade dos dados e das dependências
node    tools/testar_calc.js            # cálculos: KPIs, atraso, carga por dia, estado dos nós
python3 tools/validar_site.py           # HTML: referências locais e ids obrigatórios por página
python3 tools/testar_kpis_cruzado.py    # KPIs do Python == KPIs do JS
node    tools/testar_editor.js          # roundtrip da serialização do editor
```

E os testes headless (precisam do Chrome) — são uns 20, todos com nome
`tools/testar_*_headless.js`. `meta-monitor/README.md` lista o que cada um cobre.

Regra do projeto: **rode a suíte antes de qualquer commit.**

---

## 6. O que fazer nos primeiros 30 minutos

1. `cd meta-monitor && node tools/checar_prerequisitos.js` — veja o que falta na sua máquina.
2. Abra `meta-monitor/index.html` no navegador. O site sobe com os dados locais, sem
   nenhuma configuração. Navegue por todas as telas para entender o que existe.
3. Leia `meta-monitor/README.md` — é o mapa: o que cada página faz, o que cada arquivo de
   `js/` faz, como os dados fluem.
4. Suba no Vercel/Netlify apontando para a sua cópia. Confirme que publica.
5. Só então crie o Supabase e rode os SQL. Essa é a parte demorada, e ela **não bloqueia**
   as anteriores.
6. Comece a trocar o conteúdo por `data/*.js` — é JSON legível, e `editor.html` edita pelo
   navegador e baixa o arquivo atualizado.

---

## 7. Mapa dos documentos (o que ler quando)

| Arquivo | Quando ler |
|---|---|
| `meta-monitor/README.md` | Sempre. É o mapa do projeto. |
| `meta-monitor/tools/sql/PADRAO_TABELA.md` | Antes de criar qualquer tabela nova. |
| `meta-monitor/docs/SEGURANCA_ESCRITA_AUTH.md` | Se você for usar login em vez do token compartilhado. |
| `meta-monitor/docs/IDENTIDADE_VISUAL.md` | Antes de mexer em CSS. |
| `meta-monitor/docs/PLANO_EXECUCAO*.md` | Para entender o histórico e as frentes em aberto. |
| `meta-monitor/CHANGELOG.md` / `BACKLOG.md` | O que já foi feito e o que ficou pendente. |
| `CLAUDE.md` (raiz) | Convenções para sessões de agente neste repositório. |

**Ignore, na sua réplica:** `sync-carta-corso.sh`, `br.com.cartacorso.sync.plist` e
`INSTALAR_SYNC.md` na raiz — é automação de sincronização específica do macOS do autor
original, não faz parte do site.

---

## 8. Uma nota sobre o conteúdo

Os dados que vieram junto são reais: nomes de pessoas, iniciativas, projetos e a agenda da
Unidade de Inovação do Sebrae Nacional. O compartilhamento foi autorizado para que você
aproveite a estrutura e os insights. Ao publicar a sua réplica, **troque o conteúdo pelo
seu** antes de deixar o site aberto — ou mantenha o acesso restrito enquanto os dados
originais estiverem lá. Um site estático publicado é indexável.
