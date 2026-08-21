/* Gate de senha — proteção client-side LEVE contra acesso casual ao site (alguém que abre
   o link sem saber que é conteúdo interno). NÃO é autenticação de verdade: o HTML da página
   continua no DOM por trás do overlay, então quem souber usar o DevTools (ou desligar JS)
   lê o conteúdo mesmo sem digitar a senha. Isto aqui só evita o caso comum de alguém cair na
   página sem querer (link compartilhado por engano, mecanismo de busca, etc.).

   Controlado por DB.config.exigirSenha (data/config.js):
     - false (default) → não cobre a tela com overlay nenhum.
     - true  → se não houver sessionStorage.cc_auth, cobre a tela com um overlay pedindo
       senha antes de deixar o resto da página aparecer.

   window.CC_TOKEN (item 2.1 — proteção de escrita no Supabase, js/supabase.js) também sai
   daqui, sempre, independente da flag acima: é o token compartilhado que a RLS do Supabase
   passa a exigir pra escrita (tools/sql/2026-08_protecao_escrita.sql). Com exigirSenha
   false, o token vem direto de DB.config.tokenEscrita (comportamento de hoje preservado —
   nenhuma barreira nova pra quem já podia editar). Com exigirSenha true, o token só fica
   disponível depois da senha certa, gravado em sessionStorage.cc_token junto do cc_auth —
   assim o token não fica solto em window antes de alguém provar que passou pelo gate.

   A senha nunca fica em texto claro em lugar nenhum do repositório — só o SHA-256 hex dela
   (HASH_SENHA abaixo). Pra gerar o hash de uma senha nova sem expor ela no chat/repo, use
   tools/gerar_hash_senha.html (roda local, no navegador, não manda nada pra lugar nenhum). */
(function () {
  "use strict";

  // SUBSTITUIR_PELO_HASH — placeholder até a ativação. Gere o hash real com
  // tools/gerar_hash_senha.html e cole o resultado aqui (mantendo as aspas).
  const HASH_SENHA = "SUBSTITUIR_PELO_HASH";
  const CHAVE_SESSAO = "cc_auth";
  const CHAVE_TOKEN = "cc_token";

  const cfg = (window.DB && window.DB.config) || {};

  // EXCEÇÃO PERMANENTE: canva.html nunca ganha overlay, nem com exigirSenha ligada.
  // Ela é destino de QR numa sala de oficina — o gestor aponta a câmera e tem que cair
  // direto no formulário (§4 e §6.6 de docs/PLANO_CANVA_OFICINAS.md: "link aberto, sem
  // código e sem login", "nenhuma tela deste projeto pede senha"). Se um dia alguém ligar
  // a flag pro resto do site sem lembrar desta página, o sintoma seria a oficina inteira
  // parada numa caixa de senha que ninguém na sala tem — e a essa altura o slide com o QR
  // já está impresso.
  //
  // Efeito colateral aceito: com exigirSenha ligada, esta página cai no ramo de baixo e
  // fica com o token que houver em cfg.tokenEscrita — possivelmente vazio, que é o ponto
  // de guardar o token atrás da senha. Não quebra nada: o canvas grava pelas RPCs
  // cc_canva_gravar/cc_canva_editar, que são SECURITY DEFINER e não olham o x-cc-token
  // (js/supabase.js só manda o header quando o token existe).
  const SEM_GATE = /(^|\/)canva\.html$/.test(location.pathname);

  if (cfg.exigirSenha !== true || SEM_GATE) {
    // flag desligada — comportamento de hoje, sem overlay; token vem direto do config
    window.CC_TOKEN = cfg.tokenEscrita || "";
    return;
  }

  if (sessionStorage.getItem(CHAVE_SESSAO) === "1") {
    // já autenticado nesta aba — token derivado do sessionStorage (gravado na hora da
    // senha certa, ver montarOverlay abaixo); cai pro config se por algum motivo faltar
    // (sessão antiga de antes deste campo existir, por exemplo)
    window.CC_TOKEN = sessionStorage.getItem(CHAVE_TOKEN) || cfg.tokenEscrita || "";
    return;
  }

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
          sessionStorage.setItem(CHAVE_TOKEN, cfg.tokenEscrita || "");
          window.CC_TOKEN = cfg.tokenEscrita || "";
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
