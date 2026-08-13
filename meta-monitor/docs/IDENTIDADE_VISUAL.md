# Identidade visual — Carta Náutica

Referência para qualquer tela nova do painel (Carta de Corso). Implementada em
`css/base.css` a partir da v0.5.0. Regra geral: **uma página nova bem-formada
não precisa de quase nenhum CSS de cor ou fonte — só precisa importar o que já
existe.**

## 1. Esqueleto obrigatório de toda página nova

`<head>`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Spectral:ital,wght@0,300;0,400;0,600;1,400;1,600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/base.css">
```

`<body>`:
```html
<div class="shell">
  <nav class="nav" aria-label="Navegação do painel"></nav>
  <main class="conteudo">
    <h1 class="pagina-titulo">Título da página</h1>
    <p class="pagina-sub">Frase descritiva do que a página mostra.</p>
    <!-- conteúdo -->
  </main>
</div>
```

Antes de `</body>`, depois dos `data/*.js` que a página usar:
```html
<script src="js/calc.js"></script>
<script src="js/core.js"></script>
<script>montarShell("nome-da-pagina.html");</script>
```

Fazendo isso, a página ganha **de graça, sem escrever CSS nenhum**: nav lateral
já no tema, marca + rodapé versionado, grade náutica de fundo, rosa dos ventos,
caveira-easter-egg, coordenada `lat/lon` no cabeçalho, e toda a paleta/tipografia
abaixo. Se a página deve aparecer no menu, adicionar a linha em `PAGINAS` no
topo de `js/core.js`.

## 2. Paleta — sempre `var()`, nunca hex cru

| Token | Uso |
|---|---|
| `var(--bg)` | fundo geral (`body`, já aplicado) |
| `var(--branco)` (= `--surface`) | fundo de cards, inputs, superfícies |
| `var(--tinta)` (= `--ink`) | texto principal |
| `var(--grafite)` (= `--ink-2`) | texto secundário/legendas |
| `var(--ink-3)` | texto terciário/desabilitado |
| `var(--azul)` (= `--accent`) | **acento único** — nav ativo, eyebrows, botão primário, alertas. Usar com moderação, nunca como segunda cor de marca |
| `var(--linha)` (= `--border`) | borda de containers |
| `var(--border-soft)` | divisores internos (linhas de tabela, separadores leves) |

Família de status — já cobre os casos comuns, **não inventar cor nova para
status**:

| Situação | Token |
|---|---|
| Concluído / positivo | `var(--verde)` / `var(--ok)` |
| Em andamento / hoje | `var(--azul-claro)` / `var(--prog)` |
| Pendente / janela / aguardando | `var(--ambar)` / `var(--warn)` |
| Atrasado / erro / crítico | `var(--critico)` / `var(--crit)` |
| Caminho crítico | `var(--laranja)` / `var(--cc)` |
| SLA | `var(--sla)` |
| Neutro/vazio | `var(--grafite-w)` (fundo) |

Nunca escrever `#fff`/`white` cru — usar `var(--branco)`.

## 3. Tipografia — três papéis fixos

- **Spectral** (`Georgia,serif` fallback) — títulos (`h1/h2/h3` já vêm assim
  globalmente), números grandes de KPI, texto de corpo/prosa: parágrafos,
  itens de lista, células de tabela "de leitura". Itálico para legendas
  pequenas e ênfase.
- **DM Sans** — tudo que é interface: nav, botões, labels, `select`/`input`,
  cabeçalho de tabela (`th`), chips/badges. Nesses casos, sempre
  `text-transform:uppercase` + `letter-spacing` (~0.05–0.12em conforme o
  tamanho do texto).
- **IBM Plex Mono** (classe `.mono` já existe) — datas, IDs, coordenadas,
  qualquer dado técnico/tabular.

Não usar Archivo nem Inter em lugar nenhum — não estão mais carregados.

## 4. Componentes prontos — reusar, não recriar

`.card` · `.grid.kpis` + `.kpi` · `.chip` (`.st-concluido` `.st-andamento`
`.st-atrasada` `.st-janela` `.st-nao` `.cc` `.sla` `.pessoa`) · `.btn` /
`.btn.sec` · `table`/`th`/`td` · `.aviso` · `.filtros select,input` ·
`.trilho`/`.no-item` (trilho de nós, se a página tiver algo parecido com
etapas/marcos).

## 5. Regras de acabamento

- `border-radius: 0` em tudo, sempre — cartas náuticas não têm cantos
  arredondados. Se copiar um componente de outro projeto, zerar o radius.
- Sombra só a `var(--sombra)` já definida — não criar `box-shadow` novo.
- CSS local (`<style>` na própria página) deve resolver só **layout**
  (grid/flex, larguras, espaçamento específico da tela). Cor e fonte sempre
  pelos tokens/papéis acima.

## 6. Fora do escopo desta identidade

`apresentacao_canais.html` (deck de slides dos canais URC) mantém identidade
cromática própria por canal — não aplicar Carta Náutica ali, é intencional.

---
*Criado na v0.5.0 (reskin completo do painel). Manter atualizado se novos
tokens/componentes entrarem em `css/base.css`.*
