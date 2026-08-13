/* Identificação de quem está editando — window.EDITOR_ATUAL (item 3.4 do plano de
 * melhorias, Prompt 13).
 *
 * Hoje só o JR. edita (padrão "JR." em localStorage.cc_editor), mas a UI de troca já
 * fica pronta pra fase de Expansão (mais gente editando): rodapé "Editando como NOME ·
 * trocar" nas 4 telas de escrita (editor.html, demandas.html, plano-acao.html,
 * plano.html — visão Kanban), com um <select> da lista canônica de responsáveis
 * (data/pessoas.js.responsaveis, P4) + opção "Outro" (texto livre), sem precisar de
 * retrabalho quando a Expansão chegar. O nome escolhido:
 *   - é usado como "usuario" nas chamadas de escrita de cada página (populam
 *     updated_by/atualizado_por conforme a coluna de cada tabela — item 2.3);
 *   - vai também no header x-cc-editor de toda escrita (js/supabase.js, item 2.2), que
 *     o trigger cc_audit() (tools/sql/2026-08_auditoria.sql) usa como autor de último
 *     recurso se a coluna de autoria do próprio registro estiver vazia.
 *
 * Substitui os `nomeEditor()` locais que editor.html/demandas.html/plano.html tinham
 * cada um a sua cópia (window.prompt + localStorage "editor_nome") — um lugar só agora,
 * chave nova ("cc_editor", não reaproveita a antiga de propósito: a UI mudou de "só um
 * prompt na primeira vez" pra "seletor com lista canônica + trocar", então começar do
 * zero evita misturar um nome digitado à mão com um nome da lista por engano).
 */
(function (root) {
  "use strict";

  const CHAVE = "cc_editor";
  const PADRAO = "JR.";

  function esc(s) { return root.esc ? root.esc(s) : String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }

  function nomeAtual() {
    try { return localStorage.getItem(CHAVE) || PADRAO; }
    catch (e) { return PADRAO; } // localStorage indisponível (modo privado restrito etc.)
  }

  function definirNome(nome) {
    const limpo = String(nome || "").trim();
    if (!limpo) return nomeAtual();
    try { localStorage.setItem(CHAVE, limpo); } catch (e) { /* segue só em memória nesta carga */ }
    // client(s) do Supabase em cache mandariam o nome ANTIGO no header x-cc-editor até
    // recarregar a página — reseta pra próxima escrita já sair com o header certo.
    if (root.CC_SUPABASE && root.CC_SUPABASE.resetarClientes) root.CC_SUPABASE.resetarClientes();
    return limpo;
  }

  function html() {
    return '<div class="cc-editor-rodape">' +
      '<span>Editando como <b data-cc-editor-nome></b></span>' +
      '<button type="button" class="cc-editor-link" data-cc-editor-trocar>trocar</button>' +
      '<span class="cc-editor-form" data-cc-editor-form hidden>' +
        '<select data-cc-editor-select aria-label="Escolher quem está editando"></select>' +
        '<input type="text" data-cc-editor-outro placeholder="Nome ou iniciais" hidden aria-label="Nome de quem está editando">' +
        '<button type="button" data-cc-editor-confirmar>Confirmar</button>' +
        '<button type="button" data-cc-editor-cancelar>Cancelar</button>' +
      "</span></div>";
  }

  function opcoesResponsaveis(valorAtual) {
    const lista = (root.DB && root.DB.responsaveis) || [];
    let out = '<option value="">— outro (texto livre) —</option>';
    const grupos = [...new Set(lista.map((p) => p.grupo))];
    grupos.forEach((g) => {
      out += '<optgroup label="' + esc(g) + '">';
      out += lista.filter((p) => p.grupo === g)
        .map((p) => '<option value="' + esc(p.nome) + '"' + (p.nome === valorAtual ? " selected" : "") + ">" + esc(p.nome) + "</option>")
        .join("");
      out += "</optgroup>";
    });
    return out;
  }

  // monta o rodapé dentro de `container` (substitui o conteúdo dele) e liga os
  // eventos. `aoTrocar(novoNome)` é opcional — chamado depois de confirmar uma troca,
  // pra quem montou re-renderizar algo que mostre o nome atual (ex.: uma lista de
  // "Histórico" filtrável por autor).
  function montar(container, aoTrocar) {
    if (!container) return;
    container.innerHTML = html();
    const elNome = container.querySelector("[data-cc-editor-nome]");
    const btnTrocar = container.querySelector("[data-cc-editor-trocar]");
    const form = container.querySelector("[data-cc-editor-form]");
    const select = container.querySelector("[data-cc-editor-select]");
    const outro = container.querySelector("[data-cc-editor-outro]");
    const btnConfirmar = container.querySelector("[data-cc-editor-confirmar]");
    const btnCancelar = container.querySelector("[data-cc-editor-cancelar]");

    function atualizarExibicao() { elNome.textContent = nomeAtual(); }
    atualizarExibicao();

    function abrirForm() {
      select.innerHTML = opcoesResponsaveis(nomeAtual());
      const bateComLista = [...select.options].some((o) => o.value === nomeAtual());
      outro.hidden = bateComLista;
      outro.value = bateComLista ? "" : nomeAtual();
      if (!bateComLista) select.value = "";
      form.hidden = false;
      btnTrocar.hidden = true;
    }
    function fecharForm() {
      form.hidden = true;
      btnTrocar.hidden = false;
    }
    btnTrocar.addEventListener("click", abrirForm);
    btnCancelar.addEventListener("click", fecharForm);
    select.addEventListener("change", () => {
      outro.hidden = select.value !== "";
      if (select.value !== "") outro.value = "";
    });
    btnConfirmar.addEventListener("click", () => {
      const escolhido = select.value || outro.value;
      const novo = definirNome(escolhido);
      atualizarExibicao();
      fecharForm();
      if (typeof aoTrocar === "function") aoTrocar(novo);
    });
  }

  root.EDITOR_ATUAL = {
    CHAVE: CHAVE,
    PADRAO: PADRAO,
    nomeAtual: nomeAtual,
    definirNome: definirNome,
    montar: montar,
  };
})(this);
