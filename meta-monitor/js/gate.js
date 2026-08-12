/* Gate de senha — proteção client-side LEVE contra acesso casual ao site (alguém que abre
   o link sem saber que é conteúdo interno). NÃO é autenticação de verdade: o HTML da página
   continua no DOM por trás do overlay, então quem souber usar o DevTools (ou desligar JS)
   lê o conteúdo mesmo sem digitar a senha. Autenticação real de fato é o item 2.1 do plano
   de melhorias — ainda não implementado. Isto aqui só evita o caso comum de alguém cair na
   página sem querer (link compartilhado por engano, mecanismo de busca, etc.).

   Controlado por DB.config.exigirSenha (data/config.js):
     - false (default) → este arquivo não faz nada, silenciosamente.
     - true  → se não houver sessionStorage.cc_auth, cobre a tela com um overlay pedindo
       senha antes de deixar o resto da página aparecer.

   A senha nunca fica em texto claro em lugar nenhum do repositório — só o SHA-256 hex dela
   (HASH_SENHA abaixo). Pra gerar o hash de uma senha nova sem expor ela no chat/repo, use
   tools/gerar_hash_senha.html (roda local, no navegador, não manda nada pra lugar nenhum). */
(function () {
  "use strict";

  // SUBSTITUIR_PELO_HASH — placeholder até a ativação. Gere o hash real com
  // tools/gerar_hash_senha.html e cole o resultado aqui (mantendo as aspas).
  const HASH_SENHA = "SUBSTITUIR_PELO_HASH";
  const CHAVE_SESSAO = "cc_auth";

  const cfg = (window.DB && window.DB.config) || {};
  if (cfg.exigirSenha !== true) return; // flag desligada — comportamento de hoje, sem overlay

  if (sessionStorage.getItem(CHAVE_SESSAO) === "1") return; // já autenticado nesta aba

  async function sha256Hex(texto) {
    const dados = new TextEncoder().encode(texto);
    const buffer = await crypto.subtle.digest("SHA-256", dados);
    return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // cores hardcoded (não var(--x)) de propósito: o gate precisa se sustentar sozinho mesmo
  // se css/base.css ainda não tiver terminado de carregar — valores batem 1:1 com os tokens
  // de css/base.css (--bg, --surface, --border, --ink, --accent, --accent-hover) hoje.
  function injetarEstilo() {
    const style = document.createElement("style");
    style.textContent =
      "#cc-gate-overlay{position:fixed;inset:0;z-index:9999;background:#f4efe4;" +
      "display:flex;align-items:center;justify-content:center;padding:20px}" +
      "#cc-gate-overlay .cc-gate-caixa{max-width:340px;width:100%;background:#fbf8f0;" +
      "border:1px solid rgba(43,38,32,.22);padding:34px 28px;text-align:center;" +
      "font-family:'Open Sans','Lato',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}" +
      "#cc-gate-overlay .cc-gate-marca{font-weight:600;font-size:21px;color:#2b2620;margin-bottom:8px}" +
      "#cc-gate-overlay .cc-gate-msg{font-size:13px;color:rgba(43,38,32,.72);margin-bottom:20px;line-height:1.5}" +
      "#cc-gate-overlay input{width:100%;box-sizing:border-box;border:1px solid rgba(43,38,32,.28);" +
      "padding:10px 11px;font-size:14px;margin-bottom:12px;font-family:inherit;background:#fff}" +
      "#cc-gate-overlay input:focus{outline:2px solid #8f2d2d;outline-offset:1px}" +
      "#cc-gate-overlay button{width:100%;background:#8f2d2d;color:#fff;border:0;padding:11px;" +
      "font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.06em;cursor:pointer}" +
      "#cc-gate-overlay button:hover{background:#762424}" +
      "#cc-gate-overlay .cc-gate-erro{color:#8f2d2d;font-size:12.5px;margin-top:12px}";
    document.head.appendChild(style);
  }

  function montarOverlay() {
    const overlay = document.createElement("div");
    overlay.id = "cc-gate-overlay";
    overlay.innerHTML =
      '<div class="cc-gate-caixa">' +
        '<div class="cc-gate-marca">Carta de Corso</div>' +
        '<p class="cc-gate-msg">Acesso restrito. Digite a senha pra continuar.</p>' +
        '<form id="cc-gate-form">' +
          '<input type="password" id="cc-gate-senha" placeholder="Senha" autocomplete="current-password">' +
          '<button type="submit">Entrar</button>' +
        '</form>' +
        '<p class="cc-gate-erro" id="cc-gate-erro" hidden>Senha incorreta.</p>' +
      '</div>';
    document.body.appendChild(overlay);

    const form = document.getElementById("cc-gate-form");
    const campo = document.getElementById("cc-gate-senha");
    const erro = document.getElementById("cc-gate-erro");
    campo.focus();

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      sha256Hex(campo.value).then(function (hash) {
        if (hash === HASH_SENHA) {
          sessionStorage.setItem(CHAVE_SESSAO, "1");
          overlay.remove();
        } else {
          erro.hidden = false;
          campo.value = "";
          campo.focus();
        }
      });
    });
  }

  function iniciar() {
    injetarEstilo();
    montarOverlay();
  }

  if (document.body) iniciar();
  else document.addEventListener("DOMContentLoaded", iniciar);
})();
