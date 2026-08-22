# QR codes por canal — item 7 do plano do canvas das oficinas

Um `.png` por canal de `data/canais.js` (10 arquivos, nome = id do canal), pronto pra colar no
último slide da apresentação daquele canal. Cada arquivo já traz, na própria imagem: o QR, o
nome do canal e a URL escrita por extenso — não precisa montar nada a mais no slide, só colar a
imagem.

| Arquivo | Canal | URL |
|---|---|---|
| `foco.png` | Foco+ | `https://www.cartacorso.com.br/canva.html?canal=foco` |
| `cnr.png` | CNR | `https://www.cartacorso.com.br/canva.html?canal=cnr` |
| `empresa.png` | Sebrae na sua empresa | `https://www.cartacorso.com.br/canva.html?canal=empresa` |
| `portal.png` | Portal | `https://www.cartacorso.com.br/canva.html?canal=portal` |
| `mkt.png` | Marketing Cloud | `https://www.cartacorso.com.br/canva.html?canal=mkt` |
| `loja.png` | Loja | `https://www.cartacorso.com.br/canva.html?canal=loja` |
| `rede.png` | Rede própria e parceira | `https://www.cartacorso.com.br/canva.html?canal=rede` |
| `assessoria.png` | Assessoria de Negócios | `https://www.cartacorso.com.br/canva.html?canal=assessoria` |
| `dxp.png` | DXP | `https://www.cartacorso.com.br/canva.html?canal=dxp` |
| `contab.png` | Contabilizações e instrumentos | `https://www.cartacorso.com.br/canva.html?canal=contab` |

**De propósito, a URL não tem `ciclo` nem `facilitador`** — só `?canal=<id>`. `canva.html` deriva
os dois de `data/agenda.js`, cruzando o canal do QR com a data de hoje (§5 do plano). O QR sai
impresso/projetado antes de cada sessão e não tem como corrigir depois: se ele carregasse o
ciclo, um encontro remarcado gravaria o ciclo errado pra sempre.

## Como foram gerados

`node tools/gerar_qrcodes_canais.js` — lê `data/canais.js` (mesma fonte que `canva.html` e a
matriz usam, não duplica a whitelist de canais), gera a matriz do QR com o encoder vendorizado
em `tools/vendor/`, monta um cartão HTML por canal e tira um screenshot dele no Chromium já
instalado, via CDP cru — sem Playwright, sem nenhuma dependência nova além do encoder (ver
`tools/vendor/README.md`).

Nível de correção de erro **H** (o mais alto), de propósito: o QR vai projetado numa tela ou
impresso num slide e lido por celular a alguma distância, às vezes com reflexo — 30% de
capacidade de recuperação é a margem certa pra isso, e a URL é curta o bastante pra não pesar no
tamanho do QR mesmo em H.

## Quando regerar

Só se um canal for renomeado ou a lista de `data/canais.js` mudar (não deveria — canais são
whitelist fechada, §4 do plano). Se acontecer: `node tools/gerar_qrcodes_canais.js` de novo e
publicar os `.png` atualizados; os arquivos velhos com nome de canal que não existe mais devem
ser apagados manualmente (o script não limpa a pasta sozinho).
