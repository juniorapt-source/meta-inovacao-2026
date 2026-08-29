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
 *
 * MIGRAÇÃO PARCIAL de propósito (item D4.3): as duas tabelas viram dois wrappers da
 * fábrica js/db-base.js (item D4.1), que passam a fornecer a busca e as 6 funções de
 * escrita — é onde estava a duplicação. O `carregar()` continua próprio daqui, porque
 * o que ele devolve não é "uma lista": são duas tabelas lidas em paralelo, combinadas
 * num objeto só (lideranca + canaisFlat + canais agrupado) com um fallback que também
 * é combinado. Forçar isso na fábrica seria dobrar a fábrica pra caber um caso — a
 * mesma razão pela qual db-canva.js/db-canva-consolidado.js/db-responsaveis.js ficam
 * de fora inteiros.
 *
 * PRECISA de js/db-base.js carregado antes.
 */
(function (root) {
  "use strict";

  const BASE = root.DB_BASE || (typeof globalThis !== "undefined" && globalThis.DB_BASE);
  if (!BASE) throw new Error("js/db-urc.js: js/db-base.js precisa ser carregado antes deste arquivo.");

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

  // os dois wrappers da fábrica: cada um cuida da SUA tabela (busca ordenada por
  // `ordem`, escrita com updated_by, soft delete, bloqueio de escrita em modo de teste).
  // O `seed`/`carregar` de cada um não é usado — quem monta a resposta combinada é o
  // carregar() daqui, com o seed combinado logo abaixo.
  const wLideranca = BASE.criarWrapper({
    nome: "db-urc (liderança)", raiz: root, tabela: TABELA_LIDERANCA, ordem: "ordem",
    linhaPara: linhaParaLideranca, paraLinha: liderancaParaLinha,
  });
  const wCanais = BASE.criarWrapper({
    nome: "db-urc (canais)", raiz: root, tabela: TABELA_CANAIS, ordem: "ordem",
    linhaPara: linhaParaResponsavel, paraLinha: responsavelParaLinha,
  });

  async function buscarDoSupabase() {
    const [lideranca, canaisFlat] = await Promise.all([
      wLideranca.buscarDoSupabase(),
      wCanais.buscarDoSupabase(),
    ]);
    return { lideranca: lideranca, canaisFlat: canaisFlat };
  }

  function seedLocal() {
    const lideranca = ((root.DB && root.DB.urc_lideranca) || []).slice().map((p) => Object.assign({ db_id: null }, p));
    const canaisFlat = achatarLocal((root.DB && root.DB.urc_canais) || []);
    return { lideranca: lideranca, canaisFlat: canaisFlat };
  }

  let promessa = null;
  async function carregar(opts) {
    const forcar = (opts && opts.forcar) || wLideranca.emModoTeste();
    if (promessa && !(opts && opts.recarregar)) return promessa;
    promessa = (async () => {
      let dados, usandoFallback = false, motivoFallback = null;
      if (forcar) {
        dados = seedLocal();
        usandoFallback = true;
        motivoFallback = BASE.MOTIVO_MODO_TESTE;
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

  // escrita de canal: o bloqueio de teste vem ANTES do guardrail, como sempre foi —
  // em modo de teste nem se chega a avaliar o guardrail.
  async function salvarResponsavel(id, campos, usuario, liderancaAtual) {
    wCanais.bloquearEscritaEmTeste();
    if ((campos.nome || campos.pessoa_id) && nomeEhLideranca(campos, liderancaAtual)) {
      throw new Error('"' + campos.nome + '" ' + MSG_GUARDRAIL_LIDERANCA);
    }
    return wCanais.salvar(id, campos, usuario);
  }
  async function criarResponsavel(rParcial, usuario, liderancaAtual) {
    wCanais.bloquearEscritaEmTeste();
    if (nomeEhLideranca(rParcial, liderancaAtual)) {
      throw new Error('"' + rParcial.nome + '" ' + MSG_GUARDRAIL_LIDERANCA);
    }
    return wCanais.criar(rParcial, usuario);
  }

  root.DB_URC = {
    TABELA_LIDERANCA: TABELA_LIDERANCA,
    TABELA_CANAIS: TABELA_CANAIS,
    CANAIS_FIXOS: CANAIS_FIXOS,
    carregar: carregar,
    salvarLideranca: wLideranca.salvar,
    criarLideranca: wLideranca.criar,
    removerLiderancaSoft: wLideranca.removerSoft,
    salvarResponsavel: salvarResponsavel,
    criarResponsavel: criarResponsavel,
    removerResponsavelSoft: wCanais.removerSoft,
    nomeEhLideranca: nomeEhLideranca,
    MSG_GUARDRAIL_LIDERANCA: MSG_GUARDRAIL_LIDERANCA,
  };
})(this);
