/* Login de editores via Supabase Auth — window.CC_AUTH.
 *
 * Substitui o token compartilhado (antes em data/config.js, público no navegador) por
 * autenticação de verdade: só um usuário logado E presente na allowlist do banco
 * (tabela meta_inovacao_editores / função cc_eh_editor(), ver
 * tools/sql/2026-08_auth_escrita.sql) consegue escrever. A leitura das telas NÃO depende
 * disto — as páginas de visualização não carregam este módulo e seguem públicas.
 *
 * A sessão do Supabase Auth é persistida em localStorage (js/supabase.js configura os
 * clients com persistSession), então o login vale para todas as páginas do mesmo domínio:
 * entrou uma vez, editor.html / plano-acao.html / demandas.html reconhecem a sessão.
 *
 * Este módulo carrega DEPOIS de js/supabase.js (usa CC_SUPABASE.clientePrincipal()).
 */
(function (root) {
  "use strict";

  const _estado = { carregado: false, logado: false, email: null, editor: false };
  const ouvintes = [];

  function estado() { return Object.assign({}, _estado); }
  function podeEditar() { return _estado.logado && _estado.editor; }
  function notificar() { ouvintes.forEach((fn) => { try { fn(estado()); } catch (e) { /* isola ouvinte */ } }); }

  async function cliente() {
    if (!root.CC_SUPABASE || !root.CC_SUPABASE.clientePrincipal) {
      throw new Error("js/supabase.js não carregado — CC_SUPABASE.clientePrincipal ausente.");
    }
    return root.CC_SUPABASE.clientePrincipal();
  }

  async function atualizarEstado() {
    try {
      const c = await cliente();
      const { data: { session } } = await c.auth.getSession();
      if (session && session.user) {
        _estado.logado = true;
        _estado.email = session.user.email || null;
        try {
          const { data, error } = await c.rpc("cc_eh_editor");
          _estado.editor = !error && data === true;
        } catch (e) { _estado.editor = false; }
      } else {
        _estado.logado = false; _estado.email = null; _estado.editor = false;
      }
    } catch (e) {
      _estado.logado = false; _estado.email = null; _estado.editor = false;
    }
    _estado.carregado = true;
    notificar();
  }

  async function entrar(email, senha) {
    const c = await cliente();
    const { error } = await c.auth.signInWithPassword({
      email: String(email || "").trim(),
      password: String(senha || ""),
    });
    if (error) throw error;
    await atualizarEstado();
    return estado();
  }

  async function sair() {
    try { const c = await cliente(); await c.auth.signOut(); } catch (e) { /* segue */ }
    await atualizarEstado();
  }

  function aoMudar(fn) {
    ouvintes.push(fn);
    if (_estado.carregado) { try { fn(estado()); } catch (e) { /* isola */ } }
  }

  /* ---------------------------------------------------------------- estilos */
  function injetarEstilo() {
    if (document.getElementById("cc-auth-estilo")) return;
    const st = document.createElement("style");
    st.id = "cc-auth-estilo";
    st.textContent =
      ".cc-bloqueado{opacity:.5;pointer-events:none;filter:grayscale(.3)}" +
      ".cc-auth-banner{background:#fbf8f0;border:1px solid rgba(43,38,32,.22);border-left:4px solid #8f2d2d;" +
      "padding:12px 14px;margin:0 0 12px;font-size:13.5px;color:#2b2620;display:flex;align-items:center;gap:12px;flex-wrap:wrap}" +
      ".cc-auth-banner button{background:#8f2d2d;color:#fff;border:0;padding:8px 14px;font-weight:700;font-size:12px;" +
      "text-transform:uppercase;letter-spacing:.05em;cursor:pointer;border-radius:2px}" +
      ".cc-auth-banner button:hover{background:#762424}" +
      ".cc-auth-barra{position:fixed;top:10px;right:12px;z-index:9998;background:#fbf8f0;border:1px solid rgba(43,38,32,.22);" +
      "border-radius:3px;padding:6px 10px;font-size:12.5px;color:#2b2620;display:flex;align-items:center;gap:8px;" +
      "box-shadow:0 2px 8px rgba(43,38,32,.12);font-family:'Open Sans','Lato',system-ui,sans-serif;max-width:min(90vw,360px)}" +
      ".cc-auth-barra .cc-auth-eml{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}" +
      ".cc-auth-barra button{background:transparent;border:1px solid #8f2d2d;color:#8f2d2d;padding:4px 9px;font-size:11.5px;" +
      "font-weight:700;text-transform:uppercase;letter-spacing:.04em;cursor:pointer;border-radius:2px}" +
      ".cc-auth-barra button:hover{background:#8f2d2d;color:#fff}" +
      "#cc-auth-overlay{position:fixed;inset:0;z-index:10000;background:rgba(43,38,32,.45);display:flex;align-items:center;" +
      "justify-content:center;padding:20px}" +
      "#cc-auth-overlay .cx{max-width:340px;width:100%;background:#fbf8f0;border:1px solid rgba(43,38,32,.22);padding:30px 26px;" +
      "font-family:'Open Sans','Lato',system-ui,-apple-system,sans-serif}" +
      "#cc-auth-overlay .mc{font-weight:600;font-size:19px;color:#2b2620;margin-bottom:4px}" +
      "#cc-auth-overlay .ms{font-size:12.5px;color:rgba(43,38,32,.7);margin-bottom:18px;line-height:1.5}" +
      "#cc-auth-overlay label{display:block;font-size:11.5px;font-weight:600;color:#2b2620;margin:0 0 4px}" +
      "#cc-auth-overlay input{width:100%;box-sizing:border-box;border:1px solid rgba(43,38,32,.28);padding:9px 10px;" +
      "font-size:14px;margin-bottom:12px;font-family:inherit;background:#fff}" +
      "#cc-auth-overlay input:focus{outline:2px solid #8f2d2d;outline-offset:1px}" +
      "#cc-auth-overlay .row{display:flex;gap:8px;margin-top:4px}" +
      "#cc-auth-overlay .row button{flex:1;border:0;padding:10px;font-weight:700;font-size:12px;text-transform:uppercase;" +
      "letter-spacing:.05em;cursor:pointer;border-radius:2px}" +
      "#cc-auth-overlay .primario{background:#8f2d2d;color:#fff}#cc-auth-overlay .primario:hover{background:#762424}" +
      "#cc-auth-overlay .secundario{background:transparent;color:#2b2620;border:1px solid rgba(43,38,32,.28)!important}" +
      "#cc-auth-overlay .er{color:#8f2d2d;font-size:12.5px;margin-top:10px;min-height:1em}";
    document.head.appendChild(st);
  }

  /* ---------------------------------------------------------------- overlay de login */
  function abrirLogin() {
    injetarEstilo();
    if (document.getElementById("cc-auth-overlay")) return;
    const ov = document.createElement("div");
    ov.id = "cc-auth-overlay";
    ov.innerHTML =
      '<div class="cx">' +
        '<div class="mc">Entrar para editar</div>' +
        '<p class="ms">Acesso de edição restrito aos editores cadastrados.</p>' +
        '<form id="cc-auth-form">' +
          '<label for="cc-auth-eml">E-mail</label>' +
          '<input type="email" id="cc-auth-eml" autocomplete="username" autocapitalize="off" spellcheck="false">' +
          '<label for="cc-auth-pw">Senha</label>' +
          '<input type="password" id="cc-auth-pw" autocomplete="current-password">' +
          '<div class="row">' +
            '<button type="button" class="secundario" id="cc-auth-cancelar">Cancelar</button>' +
            '<button type="submit" class="primario" id="cc-auth-ok">Entrar</button>' +
          '</div>' +
          '<p class="er" id="cc-auth-erro"></p>' +
        '</form>' +
      '</div>';
    document.body.appendChild(ov);

    const form = ov.querySelector("#cc-auth-form");
    const eml = ov.querySelector("#cc-auth-eml");
    const pw = ov.querySelector("#cc-auth-pw");
    const erro = ov.querySelector("#cc-auth-erro");
    const ok = ov.querySelector("#cc-auth-ok");
    eml.focus();

    function fechar() { ov.remove(); }
    ov.querySelector("#cc-auth-cancelar").addEventListener("click", fechar);
    ov.addEventListener("click", (e) => { if (e.target === ov) fechar(); });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      erro.textContent = "";
      ok.disabled = true; ok.textContent = "Entrando…";
      try {
        const est = await entrar(eml.value, pw.value);
        if (!est.editor) {
          erro.textContent = "Login ok, mas esta conta não está autorizada a editar. Fale com o JR.";
          ok.disabled = false; ok.textContent = "Entrar";
          return;
        }
        fechar();
      } catch (err) {
        const m = String((err && err.message) || err || "");
        erro.textContent = /invalid login credentials/i.test(m)
          ? "E-mail ou senha incorretos." : ("Não foi possível entrar: " + m);
        ok.disabled = false; ok.textContent = "Entrar";
      }
    });
  }

  /* ---------------------------------------------------------------- barra de status */
  function montarBarra() {
    injetarEstilo();
    let barra = document.getElementById("cc-auth-barra");
    if (!barra) {
      barra = document.createElement("div");
      barra.id = "cc-auth-barra";
      barra.className = "cc-auth-barra";
      document.body.appendChild(barra);
    }
    function pintar(e) {
      if (!e.carregado) { barra.innerHTML = '<span>verificando acesso…</span>'; return; }
      if (e.logado && e.editor) {
        barra.innerHTML = '<span class="cc-auth-eml" title="' + (e.email || "") + '">✏️ ' + (e.email || "editor") + '</span>' +
          '<button type="button" data-cc-sair>Sair</button>';
      } else if (e.logado && !e.editor) {
        barra.innerHTML = '<span class="cc-auth-eml">conta sem permissão de edição</span>' +
          '<button type="button" data-cc-sair>Sair</button>';
      } else {
        barra.innerHTML = '<span>🔒 somente leitura</span><button type="button" data-cc-entrar>Entrar para editar</button>';
      }
      const bIn = barra.querySelector("[data-cc-entrar]");
      const bOut = barra.querySelector("[data-cc-sair]");
      if (bIn) bIn.addEventListener("click", abrirLogin);
      if (bOut) bOut.addEventListener("click", sair);
    }
    aoMudar(pintar);
  }

  /* ---------------------------------------------------------------- gate de uma região */
  // Bloqueia visualmente `el` (pointer-events off + opacidade) quando o usuário não pode
  // editar, e injeta um banner "Entre para editar" logo acima. Reversível ao logar.
  function gatearRegiao(el, opts) {
    if (!el) return;
    opts = opts || {};
    const banner = document.createElement("div");
    banner.className = "cc-auth-banner";
    banner.innerHTML = '<span>🔒 ' + (opts.mensagem || "Você está em modo somente leitura. Entre com uma conta de editor para alterar os dados.") + '</span>' +
      '<button type="button" data-cc-entrar>Entrar para editar</button>';
    el.parentNode.insertBefore(banner, el);
    banner.querySelector("[data-cc-entrar]").addEventListener("click", abrirLogin);
    // fail-closed: bloqueia até a sessão confirmar um editor autorizado
    el.classList.add("cc-bloqueado");

    aoMudar((e) => {
      const liberado = e.logado && e.editor;
      el.classList.toggle("cc-bloqueado", !liberado);
      banner.style.display = liberado ? "none" : "";
    });
  }

  /* ---------------------------------------------------------------- init */
  function iniciar() {
    montarBarra();
    atualizarEstado();
    // reflete login/logout feito em outra aba/página e a renovação de sessão
    cliente().then((c) => {
      if (c && c.auth && c.auth.onAuthStateChange) c.auth.onAuthStateChange(() => atualizarEstado());
    }).catch(() => { /* sem client — barra fica em "somente leitura" */ });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();

  root.CC_AUTH = {
    estado: estado, podeEditar: podeEditar, entrar: entrar, sair: sair,
    aoMudar: aoMudar, abrirLogin: abrirLogin, gatearRegiao: gatearRegiao, atualizarEstado: atualizarEstado,
  };
})(this);
