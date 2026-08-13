/* Cliente Supabase centralizado — window.CC_SUPABASE (item 2.1 do plano de melhorias).
 *
 * Antes deste módulo, cada tela criava seu próprio client Supabase, cada uma com sua
 * própria função local: js/matriz-store.js (SDK clássica via <script> CDN,
 * window.supabase.createClient), plano-acao.html e minhas-acoes.html (SDK via import()
 * dinâmico do pacote ESM, cada uma com sua cópia de iniciarCliente()). As duas formas de
 * carregar a lib continuam existindo (trocar isso tocaria em mais coisa do que o
 * necessário), mas agora passam por AQUI — um lugar só decide como o client é montado e
 * garante que toda escrita carregue o header x-cc-token (RLS por token compartilhado,
 * ver tools/sql/2026-08_protecao_escrita.sql).
 *
 * window.CC_TOKEN é definido por js/gate.js (sempre que a página carrega, com ou sem
 * senha ativa — ver comentário lá) ANTES deste módulo ser usado de verdade (a leitura
 * do token só acontece dentro de obterClienteClassico/obterClienteEsm, chamadas de
 * dentro do script de cada página, que roda depois de gate.js na ordem de <script>).
 */
(function (root) {
  "use strict";

  // item 3.4 (P13) — além do x-cc-token (P3, quem PODE escrever), toda escrita agora
  // também manda x-cc-editor (QUEM escreveu) — lido de window.EDITOR_ATUAL
  // (js/editor_atual.js), se essa página carregar o módulo; páginas só-leitura não
  // precisam dele, e a função continua funcionando normalmente sem o header extra
  // (não é uma dependência obrigatória, só um bônus quando disponível). O nome da
  // função ficou o mesmo (headersComToken) pra não quebrar corsario.html/js/drawer.js,
  // que já chamam ela pros fetches crus de leitura — mandar x-cc-editor ali também é
  // inofensivo (SELECT não olha esse header).
  function headersComToken() {
    const h = {};
    if (root.CC_TOKEN) h["x-cc-token"] = root.CC_TOKEN;
    const nomeEditor = root.EDITOR_ATUAL && root.EDITOR_ATUAL.nomeAtual ? root.EDITOR_ATUAL.nomeAtual() : null;
    if (nomeEditor) h["x-cc-editor"] = nomeEditor;
    return h;
  }

  function exigirConfig() {
    if (!root.APP_CONFIG) throw new Error("js/config.js não carregado — falta window.APP_CONFIG.");
    return root.APP_CONFIG;
  }

  let clienteClassico = null;
  // client via SDK clássica (CDN <script src=".../supabase-js@2">, window.supabase.createClient)
  // — usado por páginas que já carregam o CDN global (demandas.html, via js/matriz-store.js).
  function obterClienteClassico() {
    if (clienteClassico) return clienteClassico;
    if (!root.supabase || !root.supabase.createClient) throw new Error("supabase-js (CDN clássico) não carregado — confira o <script> do CDN.");
    const cfg = exigirConfig();
    clienteClassico = root.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      global: { headers: headersComToken() },
    });
    return clienteClassico;
  }

  let promessaClienteEsm = null;
  // client via SDK ESM (import() dinâmico, sem <script> CDN clássico) — usado por
  // páginas que carregam a lib assim (plano-acao.html, minhas-acoes.html). Continua um
  // import() dentro de <script> clássico (não type="module"), mesmo motivo de sempre:
  // o arquivo permanece testável por node --check junto do resto do site.
  async function obterClienteEsm() {
    if (promessaClienteEsm) return promessaClienteEsm;
    promessaClienteEsm = (async () => {
      const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
      const cfg = exigirConfig();
      return createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
        global: { headers: headersComToken() },
      });
    })();
    return promessaClienteEsm;
  }

  /* ---- erro de escrita amigável (item 2.4) ---- */
  // reconhece o formato de erro de RLS/permissão do PostgREST (RLS bloqueando por
  // token errado/ausente é o único jeito de escrita falhar por permissão hoje — não
  // tem usuário/senha por linha, só o token compartilhado) sem depender de um único
  // campo (status HTTP nem sempre chega até o objeto de erro do client): checa status
  // quando disponível, o código de erro do Postgres (42501 = insufficient_privilege) e,
  // por último, palavras-chave da mensagem que o PostgREST usa pra RLS.
  function ehErroDePermissao(err) {
    if (!err) return false;
    const status = err.status || err.statusCode || (err.originalError && err.originalError.status);
    if (status === 401 || status === 403) return true;
    if (String(err.code || "") === "42501") return true;
    const msg = String(err.message || "").toLowerCase();
    return msg.indexOf("row-level security") !== -1 || msg.indexOf("permission denied") !== -1 || msg.indexOf("jwt") !== -1;
  }

  const MENSAGEM_SEM_PERMISSAO = "Sem permissão de escrita — fale com o JR.";
  // mensagem pronta pra tela quando é erro de permissão; null quando não é (quem chama
  // decide o que fazer com outros tipos de erro — rede fora do ar, etc. — que continuam
  // mostrando o err.message de sempre, informação operacional útil, não um stacktrace).
  function mensagemEscritaAmigavel(err) {
    return ehErroDePermissao(err) ? MENSAGEM_SEM_PERMISSAO : null;
  }

  // item 3.4 (P13) — os dois clients ficam em cache (acima) com os headers já "assados"
  // desde a criação; se o nome do editor trocar no meio da sessão (rodapé "editando
  // como… trocar", js/editor_atual.js), o client em cache continuaria mandando o nome
  // ANTIGO em x-cc-editor. resetarClientes() limpa os dois caches — a próxima chamada a
  // obterClienteClassico()/obterClienteEsm() recria o client do zero, com o header
  // atualizado, sem precisar recarregar a página inteira.
  function resetarClientes() {
    clienteClassico = null;
    promessaClienteEsm = null;
  }

  const CC_SUPABASE = {
    obterClienteClassico: obterClienteClassico,
    obterClienteEsm: obterClienteEsm,
    headersComToken: headersComToken,
    resetarClientes: resetarClientes,
    ehErroDePermissao: ehErroDePermissao,
    mensagemEscritaAmigavel: mensagemEscritaAmigavel,
    MENSAGEM_SEM_PERMISSAO: MENSAGEM_SEM_PERMISSAO,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = CC_SUPABASE;
  else root.CC_SUPABASE = CC_SUPABASE;
})(this);
