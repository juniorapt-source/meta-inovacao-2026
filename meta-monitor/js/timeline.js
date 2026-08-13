/* Terceira visão de agenda.html (item 2.7 do plano de melhorias) — uma linha por canal,
 * eixo horizontal de datas, marcador por encontro. Mesmo namespacing/padrão de
 * js/calendario.js (window.TIMELINE, sem framework, consome DB.agenda + DB.canais).
 *
 * Layout em CSS grid puro (sem SVG): uma coluna fixa (nome do canal, sticky à esquerda),
 * N colunas de dia (largura fixa) e 1 coluna final "a definir" pros encontros sem data —
 * o grid inteiro fica mais largo que o container, então .tl-outer{overflow-x:auto} vira
 * a rolagem horizontal pedida pro mobile "de graça", sem precisar de layout mobile à
 * parte. Todas as larguras são fixas em px (não 1fr) de propósito: assim a posição da
 * linha vertical de "hoje" é aritmética simples em JS, sem medir DOM.
 */
(function (root) {
  "use strict";

  const CANAL_COL_W = 168, DIA_COL_W = 40, ADEFINIR_COL_W = 100;

  // cor SÓLIDA do marcador — não é um badge "cor + texto" (esses continuam via
  // CC_STATUS.badge nas visões Lista/Calendário); aqui é um pontinho de 12px com
  // tooltip nativo (title=) carregando o texto, mesmo padrão que COR_NO de
  // js/calendario.js já usa pros marcadores de nó no calendário mensal. As cores
  // referenciam os MESMOS tokens da classe .chip.<x> de css/base.css (mesma família,
  // versão "sólida" em vez de "fundo claro + texto escuro").
  const COR_SOLIDA = {
    "st-concluido": "var(--ok)",
    "st-andamento": "var(--prog)",
    "st-janela": "var(--warn)",
    "st-atrasada": "var(--crit)",
    "st-nao": "var(--ink-3)",
  };

  function pad(n) { return String(n).padStart(2, "0"); }
  function escLocal(s) { return root.esc ? root.esc(s) : String(s == null ? "" : s); }
  function fmtBR(iso) { return root.CALC ? root.CALC.fmtBR(iso) : iso; }
  const DIAS_SEMANA_ABREV = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  function diaSemanaAbrev(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return DIAS_SEMANA_ABREV[new Date(y, m - 1, d).getDay()];
  }

  function diasEntre(iniISO, fimISO) {
    const dias = [];
    const [yi, mi, di] = iniISO.split("-").map(Number);
    const [yf, mf, df] = fimISO.split("-").map(Number);
    const cursor = new Date(yi, mi - 1, di);
    const fim = new Date(yf, mf - 1, df);
    while (cursor <= fim) {
      dias.push(cursor.getFullYear() + "-" + pad(cursor.getMonth() + 1) + "-" + pad(cursor.getDate()));
      cursor.setDate(cursor.getDate() + 1);
    }
    return dias;
  }

  // janela do eixo: início do Ciclo 1 até o fim do último ciclo — se o último ciclo
  // ainda não tem "fim" definido (Ciclo 2 "a definir", situação de hoje), cai pro maior
  // valor conhecido entre o fim do Ciclo 1 e as datas já marcadas de qualquer encontro,
  // garantindo que todo encontro COM data caiba dentro do eixo (nunca corta um marcador
  // pra fora por falta de fim de ciclo).
  function janelaDatas(ciclos, encontros) {
    const datas = encontros.filter((e) => e.data).map((e) => e.data);
    const c1 = ciclos.find((c) => c.id === "c1") || ciclos[0] || null;
    const ultimo = ciclos.length ? ciclos[ciclos.length - 1] : null;
    const ini = (c1 && c1.ini) || (datas.length ? datas.slice().sort()[0] : null);
    let fim = (ultimo && ultimo.fim) || null;
    if (!fim) {
      const candidatos = [c1 && c1.fim].concat(datas).filter(Boolean);
      fim = candidatos.length ? candidatos.slice().sort().slice(-1)[0] : ini;
    }
    return { ini: ini, fim: fim };
  }

  function tooltip(e) {
    const partes = [fmtBR(e.data) + "/2026", e.turno || null, e.local || e.modo || "modo a definir",
      e.convidados ? e.confirmados + "/" + e.convidados + " confirmados" : "sem confirmações"];
    return partes.filter(Boolean).join(" · ");
  }

  function marcador(e) {
    const chave = root.CC_STATUS ? root.CC_STATUS.chaveDeEntrada("encontro", e.status) : e.status;
    const cls = root.CC_STATUS ? root.CC_STATUS.classeCss(chave) : "st-janela";
    const cor = COR_SOLIDA[cls] || "var(--ink-3)";
    return '<span class="tl-marcador" data-encontro-id="' + escLocal(e.id) + '" style="background:' + cor +
      '" title="' + escLocal(tooltip(e)) + '"></span>';
  }

  /* monta a timeline dentro de `container`. dados = {ciclos, encontros, canais, hojeISO} */
  function montar(container, dados) {
    const canais = dados.canais || [];
    const encontros = dados.encontros || [];
    const { ini, fim } = janelaDatas(dados.ciclos || [], encontros);
    const dias = ini && fim ? diasEntre(ini, fim) : [];
    const idxHoje = dias.indexOf(dados.hojeISO);

    const porCanalDia = {};
    const porCanalSemData = {};
    canais.forEach((c) => { porCanalDia[c.id] = {}; porCanalSemData[c.id] = []; });
    encontros.forEach((e) => {
      if (!Object.prototype.hasOwnProperty.call(porCanalDia, e.canal)) return; // canal fora de data/canais.js — não deveria acontecer
      if (e.data) (porCanalDia[e.canal][e.data] = porCanalDia[e.canal][e.data] || []).push(e);
      else porCanalSemData[e.canal].push(e);
    });

    let html = '<div class="tl-outer"><div class="tl-grid" id="tl-grid" style="grid-template-columns:' +
      CANAL_COL_W + "px repeat(" + dias.length + "," + DIA_COL_W + "px) " + ADEFINIR_COL_W + 'px">';

    html += '<div class="tl-canal-cab"></div>';
    html += dias.map((d) => '<div class="tl-dia-cab">' + escLocal(fmtBR(d)) + "<br>" + diaSemanaAbrev(d) + "</div>").join("");
    html += '<div class="tl-adefinir-cab">A definir</div>';

    canais.forEach((c) => {
      html += '<div class="tl-canal" title="' + escLocal(c.completo || c.nome) + '">' + escLocal(c.nome) + "</div>";
      html += dias.map((d) => {
        const lista = porCanalDia[c.id][d] || [];
        return '<div class="tl-cel" data-canal="' + escLocal(c.id) + '" data-dia="' + d + '">' + lista.map(marcador).join("") + "</div>";
      }).join("");
      html += '<div class="tl-cel tl-adefinir" data-canal="' + escLocal(c.id) + '">' + porCanalSemData[c.id].map(marcador).join("") + "</div>";
    });

    html += "</div>";
    if (idxHoje >= 0) html += '<div class="tl-hoje" id="tl-hoje" title="Hoje"></div>';
    html += "</div>";

    container.innerHTML = html;

    if (idxHoje >= 0) {
      const linha = container.querySelector("#tl-hoje");
      const grade = container.querySelector("#tl-grid");
      if (linha && grade) {
        linha.style.left = (CANAL_COL_W + idxHoje * DIA_COL_W + DIA_COL_W / 2) + "px";
        linha.style.height = grade.scrollHeight + "px";
      }
    }
  }

  root.TIMELINE = { montar: montar };
})(this);
