/* Camada de dados dos conjuntos URC — LIDERANÇA e URC — CANAIS ("Correções v0.18.x")
 * — window.DB_URC. Os dois vivem no mesmo arquivo de origem (data/urc.js), mesma
 * lógica de sempre (js/db-plano.js) pra cada um, só que expostos por um módulo só
 * porque um depende do outro pro guardrail (item 4.4: liderança não pode aparecer
 * também como responsável de canal — tools/validar_dados.py, replicado aqui pro
 * caminho Supabase).
 *
 * meta_inovacao_urc_canais_responsaveis é uma tabela ACHATADA (1 linha por
 * canal+responsável) — os 8 canais em si (CANAIS_FIXOS abaixo) continuam uma lista
 * FIXA no client, não uma tabela; não existe "criar canal" na UI, só responsáveis
 * dentro dos 8 que já existem. `carregar()` devolve tanto a lista achatada
 * (`canaisFlat`, cada linha com `db_id` — usada por editor.html pra editar linha a
 * linha) quanto a forma agrupada de sempre (`canais`, mesmo formato de
 * window.DB.urc_canais — usada por participantes.html, que não muda de jeito de ler).
 */
(function (root) {
  "use strict";

  const TABELA_LIDERANCA = "meta_inovacao_urc_lideranca";
  const TABELA_CANAIS = "meta_inovacao_urc_canais_responsaveis";

  // mesma lista de sempre (CANAIS_URC, hardcoded até aqui em editor.html E
  // participantes.html cada um com sua cópia) — agora só um lugar. Não é uma tabela:
  // reservar/remover canal não é uma operação da UI.
  const CANAIS_FIXOS = ["CNR", "Assessoria de Negócios", "Portal", "Loja", "Marketing Cloud", "Foco+", "Rede própria e parceira", "DXP"];

  // pessoa_id (item 2.3) e canal_id/pessoa_id (item 2.4) são as FKs da Camada 2, lidas
  // aqui desde o item 4.2 — editor.html usa pra oferecer seletor de pessoa/canal em vez
  // de texto livre. `nome`/`canal` (texto) continuam sendo lidos/gravados em paralelo,
  // mesmo padrão do item 4.1: participantes.html (agruparPorCanal) e o guardrail de
  // liderança (nomeEhLideranca) ainda comparam pelo texto, não pela FK.
  function linhaParaLideranca(r) {
    return { nome: r.nome, papel: r.papel || null, email: r.email || null, ordem: r.ordem, pessoa_id: r.pessoa_id || null, db_id: r.id };
  }
  function liderancaParaLinha(p) {
    return { nome: p.nome, papel: p.papel || null, email: p.email || null, ordem: p.ordem, pessoa_id: p.pessoa_id || null };
  }

  function linhaParaResponsavel(r) {
    return { canal: r.canal, nome: r.nome, email: r.email || null, ordem: r.ordem, canal_id: r.canal_id || null, pessoa_id: r.pessoa_id || null, db_id: r.id };
  }
  function responsavelParaLinha(r) {
    return { canal: r.canal, nome: r.nome, email: r.email || null, ordem: r.ordem, canal_id: r.canal_id || null, pessoa_id: r.pessoa_id || null };
  }

  // agrupa a lista achatada de volta na forma canônica de sempre (1 objeto por canal,
  // com array de responsaveis) — mesmo formato de window.DB.urc_canais, inclusive os
  // canais sem responsável nenhum (responsaveis: []).
  function agruparPorCanal(linhasFlat) {
    return CANAIS_FIXOS.map((canal) => ({
      canal: canal,
      responsaveis: linhasFlat
        .filter((l) => l.canal === canal)
        .slice()
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
        .map((l) => ({ nome: l.nome, email: l.email })),
    }));
  }

  // achata a forma aninhada (fallback local, data/urc.js) pro mesmo formato de
  // canaisFlat que a leitura do Supabase devolve — sem db_id (não existe fora do
  // Supabase), só pra renderização funcionar igual nos dois casos.
  function achatarLocal(urcCanaisAninhado) {
    const linhas = [];
    (urcCanaisAninhado || []).forEach((c) => {
      (c.responsaveis || []).forEach((r, i) => {
        linhas.push({ canal: c.canal, nome: r.nome, email: r.email || null, ordem: i + 1, db_id: null });
      });
    });
    return linhas;
  }

  function forcarFallback() {
    if (root.CC_FORCAR_FALLBACK) return true;
    try { return new URLSearchParams(root.location.search).get("semrede") === "1"; } catch (e) { return false; }
  }

  async function buscarDoSupabase() {
    if (!root.CC_SUPABASE) throw new Error("js/supabase.js não carregado.");
    const supa = await root.CC_SUPABASE.obterClienteEsm();
    const [liderancaRes, canaisRes] = await Promise.all([
      supa.from(TABELA_LIDERANCA).select("*").is("deleted_at", null).order("ordem", { ascending: true }),
      supa.from(TABELA_CANAIS).select("*").is("deleted_at", null).order("ordem", { ascending: true }),
    ]);
    if (liderancaRes.error) throw liderancaRes.error;
    if (canaisRes.error) throw canaisRes.error;
    const lideranca = (liderancaRes.data || []).map(linhaParaLideranca);
    const canaisFlat = (canaisRes.data || []).map(linhaParaResponsavel);
    return { lideranca: lideranca, canaisFlat: canaisFlat };
  }

  function seedLocal() {
    const lideranca = ((root.DB && root.DB.urc_lideranca) || []).slice().map((p) => Object.assign({ db_id: null }, p));
    const canaisFlat = achatarLocal((root.DB && root.DB.urc_canais) || []);
    return { lideranca: lideranca, canaisFlat: canaisFlat };
  }

  let promessa = null;
  async function carregar(opts) {
    const forcar = (opts && opts.forcar) || forcarFallback();
    if (promessa && !(opts && opts.recarregar)) return promessa;
    promessa = (async () => {
      let dados, usandoFallback = false, motivoFallback = null;
      if (forcar) {
        dados = seedLocal();
        usandoFallback = true;
        motivoFallback = "modo de teste (semrede) — sem tentar rede";
      } else {
        try {
          dados = await buscarDoSupabase();
        } catch (err) {
          console.error("db-urc: falha ao carregar do Supabase, caindo pro seed local (data/urc.js)", err);
          dados = seedLocal();
          usandoFallback = true;
          motivoFallback = (err && err.message) || String(err);
        }
      }
      return {
        lideranca: dados.lideranca,
        canaisFlat: dados.canaisFlat,
        canais: agruparPorCanal(dados.canaisFlat), // forma canônica, pra quem só lê (participantes.html)
        usandoFallback: usandoFallback,
        motivoFallback: motivoFallback,
      };
    })();
    return promessa;
  }

  function bloquearEscritaEmTeste() {
    if (forcarFallback()) throw new Error("modo de teste (semrede) — escrita bloqueada de propósito, pra nunca gravar de verdade durante testes automatizados.");
  }

  // guardrail (item 4.4, herdado de tools/validar_dados.py; item 5.9-1 trocou a régua de
  // comparação de nome/texto pra pessoa_id/FK) — responsável de canal não pode ser a
  // MESMA PESSOA de algum líder (liderança é transversal, não entra em canal
  // específico). Checado no client ANTES de mandar pro Supabase — mais rápido pro
  // usuário do que esperar a volta de uma escrita que ia falhar por outro motivo (aqui
  // não tem RLS nem CHECK constraint impedindo isso — ver comentário no SQL).
  //
  // Compara por pessoa_id quando os dois lados têm a FK preenchida — é a fonte de
  // verdade desde o item 4.2, e o texto sozinho pode divergir sem ser a mesma pessoa
  // (nome curto vs. nome completo, por exemplo). Só cai pro texto (`nome`) quando falta
  // pessoa_id de um dos lados — cadastro antigo sem vínculo, ou seed local
  // (data/urc.js) que nunca teve pessoa_id — pra não perder o guardrail nesses casos.
  function nomeEhLideranca(campos, liderancaAtual) {
    const pessoaId = campos && campos.pessoa_id;
    const nome = campos && campos.nome;
    return (liderancaAtual || []).some((p) => {
      if (pessoaId && p.pessoa_id) return p.pessoa_id === pessoaId;
      return p.nome === nome;
    });
  }
  const MSG_GUARDRAIL_LIDERANCA = "é liderança da URC — liderança é transversal, não entra em canal.";

  async function salvarLideranca(id, campos, usuario) {
    bloquearEscritaEmTeste();
    const supa = await root.CC_SUPABASE.obterClienteEsm();
    const patch = Object.assign({}, campos, { updated_by: usuario || null });
    const { data, error } = await supa.from(TABELA_LIDERANCA).update(patch).eq("id", id).select().single();
    if (error) throw error;
    return linhaParaLideranca(data);
  }
  async function criarLideranca(pParcial, usuario) {
    bloquearEscritaEmTeste();
    const supa = await root.CC_SUPABASE.obterClienteEsm();
    const payload = Object.assign({}, liderancaParaLinha(pParcial), { updated_by: usuario || null });
    const { data, error } = await supa.from(TABELA_LIDERANCA).insert(payload).select().single();
    if (error) throw error;
    return linhaParaLideranca(data);
  }
  async function removerLiderancaSoft(id, usuario) {
    bloquearEscritaEmTeste();
    const supa = await root.CC_SUPABASE.obterClienteEsm();
    const agora = new Date().toISOString();
    const { error } = await supa.from(TABELA_LIDERANCA).update({ deleted_at: agora, updated_by: usuario || null }).eq("id", id);
    if (error) throw error;
  }

  async function salvarResponsavel(id, campos, usuario, liderancaAtual) {
    bloquearEscritaEmTeste();
    if ((campos.nome || campos.pessoa_id) && nomeEhLideranca(campos, liderancaAtual)) {
      throw new Error('"' + campos.nome + '" ' + MSG_GUARDRAIL_LIDERANCA);
    }
    const supa = await root.CC_SUPABASE.obterClienteEsm();
    const patch = Object.assign({}, campos, { updated_by: usuario || null });
    const { data, error } = await supa.from(TABELA_CANAIS).update(patch).eq("id", id).select().single();
    if (error) throw error;
    return linhaParaResponsavel(data);
  }
  async function criarResponsavel(rParcial, usuario, liderancaAtual) {
    bloquearEscritaEmTeste();
    if (nomeEhLideranca(rParcial, liderancaAtual)) {
      throw new Error('"' + rParcial.nome + '" ' + MSG_GUARDRAIL_LIDERANCA);
    }
    const supa = await root.CC_SUPABASE.obterClienteEsm();
    const payload = Object.assign({}, responsavelParaLinha(rParcial), { updated_by: usuario || null });
    const { data, error } = await supa.from(TABELA_CANAIS).insert(payload).select().single();
    if (error) throw error;
    return linhaParaResponsavel(data);
  }
  async function removerResponsavelSoft(id, usuario) {
    bloquearEscritaEmTeste();
    const supa = await root.CC_SUPABASE.obterClienteEsm();
    const agora = new Date().toISOString();
    const { error } = await supa.from(TABELA_CANAIS).update({ deleted_at: agora, updated_by: usuario || null }).eq("id", id);
    if (error) throw error;
  }

  root.DB_URC = {
    TABELA_LIDERANCA: TABELA_LIDERANCA,
    TABELA_CANAIS: TABELA_CANAIS,
    CANAIS_FIXOS: CANAIS_FIXOS,
    carregar: carregar,
    salvarLideranca: salvarLideranca,
    criarLideranca: criarLideranca,
    removerLiderancaSoft: removerLiderancaSoft,
    salvarResponsavel: salvarResponsavel,
    criarResponsavel: criarResponsavel,
    removerResponsavelSoft: removerResponsavelSoft,
    nomeEhLideranca: nomeEhLideranca,
    MSG_GUARDRAIL_LIDERANCA: MSG_GUARDRAIL_LIDERANCA,
  };
})(this);
