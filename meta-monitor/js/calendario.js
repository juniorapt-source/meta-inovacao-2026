/* Componente de calendário mensal, vanilla JS. Mesmo namespacing dos outros módulos
   (window.CALENDARIO), sem framework. Consome os mesmos dados que a visão de lista de
   agenda.html: DB.agenda (ciclos + encontros), DB.canais, DB.nos. */
(function (root) {
  "use strict";

  const DIAS_SEMANA = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
  const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];
  // COR_NO fica de fora da taxonomia única (js/status.js): é a cor do MARCADOR (bolinha)
  // do dia no calendário, não um badge de "cor + rótulo em texto" — decoração ao lado de
  // um tooltip, não texto por si só, então não é o mesmo tipo de coisa que CC_STATUS.badge
  // padroniza.
  const COR_NO = { ok: "no-ok", risco: "no-risco", atencao: "no-atencao", hoje: "no-hoje", futuro: "" };
  // cor do marcador de encontro no calendário — mesma fonte de CC_STATUS (contexto
  // "encontro", js/status.js) que agenda.html usa na visão Lista, pra nunca mais divergir
  // cor entre as duas visões da mesma página (era um bug real, corrigido na v0.8.0).
  function corEncontro(status) {
    if (!root.CC_STATUS) return "st-janela"; // mesmo fallback de sempre se status.js não carregou
    const chave = root.CC_STATUS.chaveDeEntrada("encontro", status);
    const estado = root.CC_STATUS.ESTADOS[chave];
    return estado ? estado.classe : "st-janela"; // status desconhecido cai em "a agendar" (cor), igual antes
  }

  function pad(n) { return String(n).padStart(2, "0"); }
  function iso(y, m, d) { return y + "-" + pad(m + 1) + "-" + pad(d); }
  function isoParaYMD(s) { const [y, m, d] = s.split("-").map(Number); return { y, m: m - 1, d }; }
  function escLocal(s) { return root.esc ? root.esc(s) : String(s == null ? "" : s); }

  /* monta o calendário dentro de `container`. dados = {ciclos, encontros, canais, nos, plano, hojeISO} */
  function montar(container, dados) {
    const hoje = dados.hojeISO;
    const hojeYMD = isoParaYMD(hoje);
    let ano = hojeYMD.y, mes = hojeYMD.m;
    let diaSelecionado = null;

    const porCanal = Object.fromEntries((dados.canais || []).map((c) => [c.id, c]));

    /* eventos pontuais por dia (nós do caminho crítico + encontros com data) */
    function eventosPorDia() {
      const mapa = {};
      (dados.nos || []).forEach((n) => {
        if (!n.data_iso) return;
        const estado = root.CALC ? root.CALC.estadoNo(n, dados.plano, hoje) : "futuro";
        (mapa[n.data_iso] = mapa[n.data_iso] || []).push({
          tipo: "no", cls: COR_NO[estado] || "", rotulo: "Nó " + n.no, titulo: n.titulo, detalhe: n
        });
      });
      (dados.encontros || []).forEach((e) => {
        if (!e.data) return;
        const c = porCanal[e.canal];
        (mapa[e.data] = mapa[e.data] || []).push({
          tipo: "encontro", cls: corEncontro(e.status),
          rotulo: c ? c.nome : e.canal, titulo: (c ? c.nome : e.canal) + " · " + e.status, detalhe: e
        });
      });
      return mapa;
    }

    /* faixas contínuas (ciclos com ini e fim definidos) */
    function faixas() {
      return (dados.ciclos || [])
        .filter((c) => c.ini && c.fim)
        .map((c, i) => ({ id: c.id, nome: c.nome, ini: c.ini, fim: c.fim, ordem: i }));
    }

    function render() {
      const mapaEventos = eventosPorDia();
      const listaFaixas = faixas();

      const primeiro = new Date(ano, mes, 1);
      const jsDow = primeiro.getDay(); // 0=dom..6=sáb
      const offsetSeg = (jsDow + 6) % 7; // 0=seg..6=dom
      const diasNoMes = new Date(ano, mes + 1, 0).getDate();
      const totalCelulas = Math.ceil((offsetSeg + diasNoMes) / 7) * 7;

      const celulas = [];
      for (let i = 0; i < totalCelulas; i++) {
        const numDia = i - offsetSeg + 1;
        const d = new Date(ano, mes, numDia);
        celulas.push({ isoStr: iso(d.getFullYear(), d.getMonth(), d.getDate()), noMes: d.getMonth() === mes, dia: d.getDate() });
      }

      let html = '<div class="cal-topo">' +
        '<div class="cal-titulo">' + MESES[mes] + " de " + ano + "</div>" +
        '<div class="cal-nav">' +
          '<button type="button" class="btn sec" data-cal-nav="-1" aria-label="Mês anterior">‹</button>' +
          '<button type="button" class="btn sec" data-cal-hoje>Hoje</button>' +
          '<button type="button" class="btn sec" data-cal-nav="1" aria-label="Próximo mês">›</button>' +
        "</div></div>";

      html += '<div class="cal-cabecalho">' + DIAS_SEMANA.map((d) => "<div>" + d + "</div>").join("") + "</div>";

      html += '<div class="cal-grade">';
      for (let semana = 0; semana < celulas.length / 7; semana++) {
        const linha = celulas.slice(semana * 7, semana * 7 + 7);
        html += '<div class="cal-semana">';

        // faixas de ciclo que cruzam esta semana
        listaFaixas.forEach((f) => {
          let colIni = -1, colFim = -1;
          linha.forEach((c, idx) => {
            if (c.isoStr >= f.ini && c.isoStr <= f.fim) { if (colIni === -1) colIni = idx; colFim = idx; }
          });
          if (colIni === -1) return;
          const esquerda = (colIni / 7) * 100, largura = ((colFim - colIni + 1) / 7) * 100;
          /* rótulo só aparece no segmento que carrega o início real da faixa — ou no primeiro
             segmento visível, se a faixa já tiver começado antes do mês em exibição */
          const comecaAntesDoVisivel = semana === 0 && colIni === 0 && f.ini < celulas[0].isoStr;
          const mostrarRotulo = linha[colIni].isoStr === f.ini || comecaAntesDoVisivel;
          html += '<div class="cal-faixa cal-faixa-' + esc(f.id) + '" style="left:' + esquerda + '%;width:' + largura +
            "%;top:" + (22 + f.ordem * 16) + 'px" title="' + escLocal(f.nome) + " (" + escLocal(f.ini) + " a " + escLocal(f.fim) + ')">' +
            (mostrarRotulo ? escLocal(f.nome) : "") + "</div>";
        });

        linha.forEach((c) => {
          const eventos = mapaEventos[c.isoStr] || [];
          const ehHoje = c.isoStr === hoje;
          const cls = ["cal-dia"];
          if (!c.noMes) cls.push("cal-fora");
          if (ehHoje) cls.push("cal-hoje");
          if (eventos.length) cls.push("cal-tem-evento");
          html += '<div class="' + cls.join(" ") + '" data-cal-dia="' + c.isoStr + '">' +
            '<div class="cal-num">' + c.dia + "</div>" +
            '<div class="cal-eventos" style="margin-top:' + (listaFaixas.length ? listaFaixas.length * 16 + 4 : 0) + 'px">' +
            eventos.slice(0, 3).map((ev) => '<span class="chip ' + ev.cls + '" style="display:block;margin:1px 0;font-size:10px">' + escLocal(ev.rotulo) + "</span>").join("") +
            (eventos.length > 3 ? '<span style="font-size:10px;color:var(--grafite)">+' + (eventos.length - 3) + "</span>" : "") +
            "</div></div>";
        });
        html += "</div>";
      }
      html += "</div>";

      html += '<div class="cal-legenda">' +
        '<span><span class="chip no-ok">Nó — ok</span></span>' +
        '<span><span class="chip no-atencao">Nó — atenção</span></span>' +
        '<span><span class="chip no-risco">Nó — risco</span></span>' +
        '<span><span class="chip st-andamento">Encontro confirmado/agendado</span></span>' +
        '<span><span class="chip st-janela">Encontro a agendar</span></span>' +
        '<span><span class="chip st-concluido">Encontro realizado</span></span>' +
        (listaFaixas.length ? listaFaixas.map((f) => '<span><span class="cal-faixa-amostra cal-faixa-' + esc(f.id) + '"></span> ' + escLocal(f.nome) + "</span>").join("") : "") +
        "</div>";

      html += '<div class="cal-detalhe" id="cal-detalhe" style="display:none"></div>';

      container.innerHTML = html;
      wireUp(mapaEventos, listaFaixas);
      if (diaSelecionado) mostrarDetalhe(diaSelecionado, mapaEventos, listaFaixas);
    }

    function mostrarDetalhe(isoStr, mapaEventos, listaFaixas) {
      const el = document.getElementById("cal-detalhe");
      if (!el) return;
      const eventos = mapaEventos[isoStr] || [];
      const faixasNoDia = listaFaixas.filter((f) => isoStr >= f.ini && isoStr <= f.fim);
      if (!eventos.length && !faixasNoDia.length) { el.style.display = "none"; return; }
      diaSelecionado = isoStr;
      el.style.display = "block";
      el.innerHTML = '<h3 style="font-size:14px;margin-bottom:8px">' + escLocal(root.CALC ? root.CALC.fmtBR(isoStr) : isoStr) + "/2026</h3>" +
        faixasNoDia.map((f) => '<div style="padding:4px 0"><span class="chip ' + (f.id === "c1" ? "st-andamento" : "st-janela") + '">' + escLocal(f.nome) + "</span></div>").join("") +
        eventos.map((ev) => '<div style="padding:6px 0;border-top:1px solid var(--linha)"><span class="chip ' + ev.cls + '">' + escLocal(ev.rotulo) + '</span><div style="font-size:12.5px;margin-top:3px">' + escLocal(ev.titulo) + "</div></div>").join("");
    }

    function wireUp() {
      container.querySelectorAll("[data-cal-nav]").forEach((btn) => btn.addEventListener("click", () => {
        const delta = parseInt(btn.dataset.calNav, 10);
        mes += delta;
        if (mes < 0) { mes = 11; ano--; } else if (mes > 11) { mes = 0; ano++; }
        diaSelecionado = null;
        render();
      }));
      const btnHoje = container.querySelector("[data-cal-hoje]");
      if (btnHoje) btnHoje.addEventListener("click", () => { ano = hojeYMD.y; mes = hojeYMD.m; diaSelecionado = null; render(); });
      container.querySelectorAll("[data-cal-dia]").forEach((el) => el.addEventListener("click", () => {
        const isoStr = el.dataset.calDia;
        diaSelecionado = diaSelecionado === isoStr ? null : isoStr;
        render();
      }));
    }

    render();
    return { irPara: (y, m) => { ano = y; mes = m; render(); } };
  }

  root.CALENDARIO = { montar: montar };
})(this);
