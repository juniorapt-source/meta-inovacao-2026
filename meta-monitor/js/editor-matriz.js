/* editor.html — aba "Matriz de demandas" (item 3.3 do plano de melhorias).
 *
 * 2ª aba extraída do inline de editor.html pro próprio arquivo (ver BACKLOG.md,
 * "editor.html grande demais" — sugestão do José, 28/08/2026; js/editor-historico.js foi
 * a 1ª). Escolhida em seguida por ser a outra aba só-leitura: a edição de verdade da
 * matriz é em demandas.html (realtime + upsert); aqui é conferência + gerar a cópia de
 * segurança (data/matriz.js).
 *
 * Item 3.3 do plano — o modelo { colunas, linhas } vem de matrizStore.montarModelo()
 * sobre as MESMAS três fontes que demandas.html usa (matrizStore + DB_PROJETOS +
 * DB_CANAIS) — mesmo padrão de carregar-sob-demanda-e-cachear das outras abas vivas. A
 * exportação (botão "Exportar cópia de segurança", no "spine" de editor.html) usa
 * matrizStore.paraSnapshot() sobre este MESMO modelo — a mesma função que o botão
 * "Exportar matriz" de demandas.html usa, pra os dois exports baterem chave a chave por
 * construção; por isso o "spine" precisa ler o modelo carregado aqui (modeloAtual()).
 *
 * Depende de: esc/CC_STATUS (globais, já carregados antes desta tag), matrizStore/
 * DB_PROJETOS/DB_CANAIS (idem), e dos elementos #ed-area/#ed-conjunto do HTML estático
 * (mesmos que o resto das abas "vivas" usa — cada módulo os busca de novo por conta
 * própria, são só leitura de DOM, sem custo de recriar a referência).
 *
 * API exposta: window.EDITOR_MATRIZ.render() — chamado pelo dispatcher de abas
 * (render(), em editor.html) quando o <select id="ed-conjunto"> está em "matriz".
 * window.EDITOR_MATRIZ.modeloAtual() — usado pelo botão de exportar (também no
 * "spine"), que precisa do modelo carregado pra gerar o snapshot; devolve null
 * enquanto a matriz ainda está carregando ou não foi aberta ainda nesta sessão.
 */
(function () {
  "use strict";

  // item 3.3 do plano — matrizModelo é { colunas, linhas } de matrizStore.montarModelo(),
  // carregado sob demanda na primeira vez que a aba é aberta e cacheado — mesmo padrão
  // das outras abas vivas de editor.html (planoAtual, agendaAtual...), só que sem
  // edição: quem quiser mudar uma célula vai pra demandas.html.
  let matrizModelo = null, matrizFallback = false, matrizCarregando = false;

  async function render() {
    const area = document.getElementById("ed-area");
    const sel = document.getElementById("ed-conjunto");

    if (!matrizModelo && !matrizCarregando) {
      matrizCarregando = true;
      area.innerHTML = '<div class="ed-carregando">Carregando matriz…</div>';
      try {
        const [celulasRes, projRes, canaisRes] = await Promise.all([
          matrizStore.carregar(), DB_PROJETOS.carregar(), DB_CANAIS.carregar()
        ]);
        matrizModelo = matrizStore.montarModelo(projRes.lista, canaisRes.lista, celulasRes.lista);
        matrizFallback = !!(celulasRes.usandoFallback || projRes.usandoFallback || canaisRes.usandoFallback);
      } catch (err) {
        console.error("editor: falha ao carregar a matriz", err);
        matrizCarregando = false;
        area.innerHTML = '<div class="ed-erro-carregar">Não foi possível carregar a matriz agora.</div>';
        return;
      }
      matrizCarregando = false;
    }
    if (sel.value !== "matriz") return; // usuário trocou de conjunto enquanto isso carregava
    if (!matrizModelo) return; // outra chamada concorrente ainda está carregando — ela renderiza quando terminar

    const { linhas, colunas } = matrizModelo;
    let h = '<div class="aviso" style="margin-bottom:12px"><b>A Matriz de demandas é editada ao vivo em ' +
      '<a href="demandas.html">demandas.html</a></b> — aqui é só leitura, pra conferência e pra gerar a ' +
      'cópia de segurança (botão abaixo).</div>';
    if (matrizFallback) h += '<div class="aviso" style="margin-bottom:12px"><b>Dados locais</b> — não foi ' +
      'possível atualizar os dados agora; isto é a última versão salva (data/matriz.js). Gerar a cópia de ' +
      'segurança agora reexportaria o mesmo arquivo que já está publicado.</div>';
    h += '<div class="ed-wrap"><table class="ed-tab ed-matriz"><thead><tr><th class="col-ini">Iniciativa</th>';
    colunas.forEach(c => h += '<th' + (c.nome_completo ? ' title="' + esc(c.nome_completo) + '"' : '') + '>' + esc(c.nome) + '</th>');
    h += '</tr></thead><tbody>';
    linhas.forEach(l => {
      h += '<tr><td class="col-ini">' + esc(l.iniciativa) + '</td>';
      colunas.forEach(c => {
        const cel = l.celulas[c.chave];
        const v = (cel && cel.estado) || "";
        h += '<td>' + CC_STATUS.badge(CC_STATUS.chaveDeEntrada("celula_matriz", v)) + '</td>';
      });
      h += '</tr>';
    });
    area.innerHTML = h + '</tbody></table></div>';
  }

  window.EDITOR_MATRIZ = {
    render: render,
    modeloAtual: function () { return matrizModelo; },
  };
})();
