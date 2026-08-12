# Carta de Corso — painel da Unidade de Inovação

> A carta de corso era o documento que legitimava o corsário: mesma tripulação, nova bandeira. Este ambiente é a nossa — o registro permanente de que a Inovação navega dentro das regras do Sebrae. As campanhas passam; a Carta fica.

## O plano vigente: Meta Inovação 2026

Ambiente estático (HTML + CSS + JS puro, sem build e sem backend) para acompanhar o plano de ação Atendimento e Relacionamento da Unidade de Inovação: 47 ações em 5 frentes, caminho crítico de 7 nós, agenda dos ciclos com a URC, matriz de demandas 27 iniciativas × 10 canais e participantes.

## Páginas

| Página | O quê |
|---|---|
| `index.html` | Dashboard: trilho dos 7 nós, KPIs, radar de carga por dia, atrasadas, próximos 7 dias |
| `plano.html` | 47 ações com filtros e busca; cada linha expande com dependências e a solução proposta (como executar, como monitorar, ferramenta) |
| `caminho.html` | Os 7 nós do caminho crítico com estado calculado, fallbacks e gatilhos; SLAs pactuados e janelas de folga |
| `agenda.html` | Ciclos 1 e 2 com a URC e os 20 encontros (10 canais × 2 ciclos; Ciclo 1 já com grade v2, Ciclo 2 "a agendar") |
| `demandas.html` | Matriz 27 iniciativas × 10 canais com o fluxo previsto → oficina → formulário → priorizado → encaminhado |
| `participantes.html` | Pessoas por grupo, com pendências de indicação (CAN-05) e fallback do Nó 2 |
| `projetos.html` | Portfólio de projetos por núcleo, com representantes |
| `plano-acao.html` | Atividades por iniciativa (CRUD via Supabase) |
| `corsario.html` | Adequação de cada iniciativa ao ecossistema oficial (Supabase, somente leitura) — régua de 19 critérios, patente por faixa de % |
| `editor.html` | Modo edição: altera plano, matriz, agenda ou pessoas no navegador e baixa o `data/*.js` atualizado |

## Como os dados funcionam

Todo o conteúdo vive em `data/*.js`, um arquivo por conjunto, sempre no formato:

```js
window.DB = window.DB || {};
window.DB.chave = { ...JSON puro... };
```

Isso permite abrir o site direto do disco (file://) e publicar no Vercel sem fetch, CORS ou build. Datas textuais ("contínuo", "set–out") não entram no cálculo de atraso: viram o selo "janela".

## Publicar no Vercel (uma vez)

Sugestão de nome do projeto/repositório: `cartadecorso` — a URL fica `cartadecorso.vercel.app`.

Caminho recomendado — via GitHub:
1. Crie um repositório vazio no GitHub (ex.: `meta-inovacao-2026`).
2. Neste diretório: `git remote add origin <URL do repo>` e `git push -u origin main --tags`.
3. No Vercel: **Add New → Project → Import** do repositório. Framework preset: **Other**. Sem comando de build, output = raiz. Deploy.

Alternativa sem GitHub: `npm i -g vercel && vercel` na raiz do projeto.

A partir daí, todo `git push` publica sozinho.

## Manutenção do dia a dia (Sandra)

1. Abra `editor.html` (no site publicado ou local), escolha o conjunto, edite e clique em **Gerar e baixar arquivo atualizado**.
2. Substitua o arquivo de mesmo nome em `data/`.
3. Confira e publique:

```bash
python3 tools/validar_dados.py
git add data/
git commit -m "atualiza dados: <o que mudou>"
git push
```

Quem preferir pode editar `data/*.js` direto no editor de texto — o formato é JSON legível.

> Antes do primeiro commit de cada pessoa, ajustar a identidade do Git:
> `git config user.name "Seu Nome"` e `git config user.email "voce@sebrae.com.br"`.

## Testes (os mesmos usados na construção)

```bash
python3 tools/validar_dados.py         # integridade dos dados (47/27/10/7/2/20, dependências)
node tools/testar_calc.js              # cálculos: KPIs, atraso, carga por dia, estado dos nós
python3 tools/validar_site.py          # HTML: referências locais e ids obrigatórios por página
python3 tools/testar_kpis_cruzado.py   # KPIs do Python == KPIs do JS
node tools/testar_editor.js            # roundtrip da serialização do editor
node tools/testar_dashboard_headless.js # dashboard num Chrome/Chromium real via CDP: clique nos
                                        # cards de KPI re-renderiza a lista ao vivo, sem refresh
                                        # (usa o navegador já instalado — sem instalar nada novo)
```

## Estrutura

```
index.html plano.html caminho.html agenda.html demandas.html participantes.html editor.html
css/base.css          identidade visual herdada do painel original
js/calc.js            funções puras de cálculo (testáveis em node)
js/core.js            shell de navegação e utilitários
js/editor_io.js       serialização canônica dos dados (testável em node)
data/*.js             config, plano, nos, canais, agenda, iniciativas, matriz, pessoas, changelog
tools/                geração de dados a partir do xlsx + os 6 testes
docs/                 PLANO_EXECUCAO.md, BUILD_STATUS.md, PENDENCIAS.md (se houver)
```

## Regras editoriais embutidas

- Encontros nascem **a agendar** enquanto o Nó 1 (devolutiva URC) não fecha.
- Núcleos das 27 iniciativas ficam em branco até definição oficial — o painel não inventa dado.
- A matriz de demandas nasce limpa; os estados avançam só com fato registrado.
