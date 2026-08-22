# tools/vendor/

Única exceção ao "sem dependência nova" que o resto do repositório segue à risca (ver o
comentário de `tools/testar_dashboard_headless.js` sobre CDP cru em vez de Playwright).

| Arquivo | Origem | Por quê |
|---|---|---|
| `qrcode-generator.js` | npm `qrcode-generator@2.0.4` (Kazuhiko Arase, MIT), `dist/qrcode.js` sem modificação | encoder de QR code correto é a parte que não vale a pena reescrever: envolve Reed-Solomon sobre GF(256), tabela de padrões de alinhamento por versão e pontuação dos 8 padrões de máscara — um bug sutil aqui não aparece testando no navegador do desenvolvedor, só aparece na sala, com o QR impresso e sem como corrigir. Preferível vendorizar a implementação de referência mais usada em produção a arriscar um encoder próprio sem decoder pra validar contra |

**Não é carregado por nenhuma página do site** (`canva.html`, `canva-consolidado.html` ou
qualquer outra) — só por `tools/gerar_qrcodes_canais.js`, em tempo de geração. Não entra em
`package.json` nenhum porque este repositório não tem um: é um arquivo de origem copiado, não
uma dependência instalada.

Pra atualizar: baixar `qrcode-generator` mais novo do npm, copiar `dist/qrcode.js` por cima
mantendo o comentário de proveniência no topo.
