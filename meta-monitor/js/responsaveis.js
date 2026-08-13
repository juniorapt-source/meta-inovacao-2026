/* Funções puras sobre window.DB.responsaveis (data/pessoas.js) — sem DOM, testáveis via
 * node (mesmo padrão de js/calc.js). Resolve textos livres de responsável ("JR. e Pova",
 * "Comitê e Sandra") para ids estáveis da lista canônica, na ordem em que aparecem.
 *
 * Por que um módulo à parte de data/pessoas.js: data/*.js é dado puro (JSON-em-JS, formato
 * que a Sandra edita direto); a lógica de tokenizar/casar texto é comportamento, não dado —
 * mora em js/ como o resto das funções testáveis do site.
 */
(function (root) {
  "use strict";
  const RESP = {};

  // aliases pra formas curtas/variantes que não batem literalmente com o "nome" canônico
  // (o próprio "nome" de cada responsável também vira chave normalizada automaticamente —
  // isso aqui cobre só o que sobra: sigla/abreviação, apelido de projeto, sinônimo).
  const ALIASES = {
    ia: "pova", // "IA" no texto do plano é sempre o agente Pova (data/pessoas.js já descreve o papel)
    gabriel: "gabriel_barreto_barros",
    hulda: "hulda_giesbrecht",
    matheus: "matheus_queiroz_campos",
    junior: "jose_mendes_junior", // "Júnior" (representante de projeto) — diferente de "JR." (coordenação)
    // formas curtas usadas em data/plano.js ("resp") e data/nos.js ("guardiao") — o "nome"
    // canônico é descritivo ("JR. (José Júnior)", "Pova (agente de IA)"...) e não bate
    // literalmente com o token curto do texto livre
    jr: "jr",
    pova: "pova",
    gerencia: "gerencia",
    gestores: "gestores",
  };

  RESP.normalizar = function (s) {
    return String(s == null ? "" : s)
      .normalize("NFD").replace(/[̀-ͯ]/g, "") // remove acentos
      .toLowerCase()
      .replace(/\./g, "") // "Jr." e "JR" precisam bater
      .trim();
  };

  function construirIndice(lista) {
    const idx = {};
    (lista || []).forEach((p) => { idx[RESP.normalizar(p.nome)] = p.id; });
    Object.keys(ALIASES).forEach((k) => { idx[k] = ALIASES[k]; });
    return idx;
  }

  RESP.porId = function (lista, id) {
    return (lista || []).find((p) => p.id === id) || null;
  };

  // separa "A e B", "A/B", "A + B", "A, B" nas partes A e B; cada parte normalizada é
  // casada contra o índice (nome canônico ou alias). Retorna ids na ordem de aparição
  // (sem duplicar) + as partes que não bateram com ninguém (naoMapeados), pro relatório.
  RESP.mapearTexto = function (lista, texto) {
    const idx = construirIndice(lista);
    const partes = String(texto == null ? "" : texto)
      .split(/\s+e\s+|\/|\+|,/i)
      .map((s) => s.trim())
      .filter(Boolean);
    const ids = [];
    const naoMapeados = [];
    partes.forEach((parte) => {
      const chave = RESP.normalizar(parte);
      const id = idx[chave];
      if (id) { if (ids.indexOf(id) === -1) ids.push(id); }
      else naoMapeados.push(parte);
    });
    return { ids: ids, naoMapeados: naoMapeados };
  };

  RESP.rotulo = function (lista, ids) {
    return (ids || [])
      .map((id) => { const p = RESP.porId(lista, id); return p ? p.nome : id; })
      .join(" e ");
  };

  if (typeof module !== "undefined" && module.exports) module.exports = RESP;
  else root.RESP = RESP;
})(this);
