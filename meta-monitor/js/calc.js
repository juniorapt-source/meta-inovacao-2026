/* Funções puras — sem DOM. Testadas via node (tools/testar_calc.js). */
(function (root) {
  "use strict";
  const C = {};

  C.ehAtrasada = function (acao, hojeISO) {
    return !!(acao.prazo_iso && acao.status !== "Concluído" && acao.prazo_iso < hojeISO);
  };

  C.kpis = function (plano, hojeISO) {
    const k = { total: plano.length, concluido: 0, andamento: 0, nao: 0, atrasadas: 0, prox7: 0, janela: 0 };
    const lim = C.somaDias(hojeISO, 7);
    for (const a of plano) {
      if (a.status === "Concluído") k.concluido++;
      else if (a.status === "Em andamento") k.andamento++;
      else k.nao++;
      if (C.ehAtrasada(a, hojeISO)) k.atrasadas++;
      if (a.prazo_iso && a.status !== "Concluído" && a.prazo_iso >= hojeISO && a.prazo_iso <= lim) k.prox7++;
      if (!a.prazo_iso && a.prazo) k.janela++;
    }
    return k;
  };

  C.cargaPorDia = function (plano) {
    const m = {};
    for (const a of plano) {
      if (!a.prazo_iso || a.status === "Concluído") continue;
      (m[a.prazo_iso] = m[a.prazo_iso] || []).push(a.id);
    }
    return Object.keys(m).sort().map((iso) => ({ iso, ids: m[iso], carga: m[iso].length }));
  };

  C.estadoNo = function (no, plano, hojeISO) {
    const acoes = plano.filter((a) => no.acoes.includes(a.id));
    const todasOk = acoes.length > 0 && acoes.every((a) => a.status === "Concluído");
    if (todasOk) return "ok";
    if (no.data_iso < hojeISO) return "risco";      // venceu sem concluir
    if (no.data_iso === hojeISO) return "hoje";
    const emDia = acoes.some((a) => a.status === "Em andamento");
    return emDia ? "atencao" : "futuro";
  };

  C.somaDias = function (iso, n) {
    const d = new Date(iso + "T12:00:00");
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };

  // Item 2.3 do plano de melhorias — frase de contexto do Dashboard ("o que precisa de
  // atenção hoje"): 3 números que já existiam espalhados por outros cálculos desta página,
  // reunidos aqui numa função só pra não duplicar a regra em index.html.
  //   - atrasadas: mesma regra de C.ehAtrasada.
  //   - nosCriticos: nós em estado "risco" (venceu sem concluir) OU "hoje" (vence hoje) —
  //     os dois estados de C.estadoNo que pedem ação HOJE, diferente de "atencao"/"futuro".
  //   - diasCargaConcentrada: dias de C.cargaPorDia com 2+ entregas, olhando só pra hoje em
  //     diante (mesmo filtro `iso >= hojeISO` que o Radar de carga já aplica na tela).
  C.resumoUrgencia = function (plano, nos, hojeISO) {
    const atrasadas = plano.filter((a) => C.ehAtrasada(a, hojeISO)).length;
    const nosCriticos = nos.filter((n) => {
      const st = C.estadoNo(n, plano, hojeISO);
      return st === "risco" || st === "hoje";
    }).length;
    const diasCargaConcentrada = C.cargaPorDia(plano).filter((c) => c.carga >= 2 && c.iso >= hojeISO).length;
    return { atrasadas, nosCriticos, diasCargaConcentrada };
  };

  C.fmtBR = function (iso) {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return d + "/" + m;
  };

  if (typeof module !== "undefined" && module.exports) module.exports = C;
  else root.CALC = C;
})(this);
