/* Taxonomia única de status (item 2.4 do plano de melhorias) — window.CC_STATUS.
 *
 * Um dicionário só, consumido por todas as páginas, pra acabar com cada tela tendo seu
 * próprio jeito de guardar {classe CSS, rótulo} pro mesmo tipo de estado. NÃO muda o
 * significado de nenhum estado existente — só junta numa fonte única o que já existia
 * espalhado (stClass em js/core.js, NOME/CLS de caminho.html, classeEncontro de
 * agenda.html, ROTULO de demandas.html, STATUS_OPCOES de plano-acao.html).
 *
 * Cada estado tem: chave (snake_case, estável), rotulo (texto de exibição), classe
 * (nome da classe CSS que já existe em css/base.css — é ela que referencia as variáveis
 * de cor; este arquivo não duplica nenhum valor de cor em hex/var()), contexto
 * (acao | no_critico | encontro | celula_matriz | atividade).
 *
 * Os 4 contextos do prompt original são acao/no_critico/encontro/celula_matriz. Um 5º,
 * "atividade", foi adicionado por auditoria: plano-acao.html/minhas-acoes.html usam um
 * vocabulário de status PRÓPRIO (Supabase, tabela plano_acao_atividades — nao_iniciado/
 * em_execucao/atrasado) que não é nem o de "acao" (5 estados, palavras diferentes:
 * em_andamento/atrasada) nem nenhum dos outros 3 — sem essa 5ª categoria, os 3 estados
 * de atividade ficariam sem casa neste dicionário. As chaves de "atividade" levam o
 * prefixo "atividade_" de propósito: evita colisão com "acao" no mesmo namespace plano
 * (ex.: "atrasado" de atividade vs. "atrasada" de ação já são palavras diferentes, mas
 * "nao_iniciado" seria SETIC igual em ambos os contextos sem o prefixo).
 *
 * Por que "no_critico" tem 5 estados e não os 3 do pedido original (venceu_sem_concluir/
 * vence_hoje/a_frente): auditoria em caminho.html achou 2 a mais em uso real —
 * "cumprido" (nó com todas as ações concluídas) e "em andamento" (nó com folga, mas com
 * ação já em curso) — sem eles, dois estados reais de nó ficariam sem representação
 * canônica. Prefixo "no_" nos 5 pelo mesmo motivo do "atividade_" acima.
 *
 * Por que "celula_matriz" tem 9 estados e não os 6 do pedido: auditoria em demandas.html
 * (ORDEM/ROTULO + css/base.css .cel-*) achou "vazia", "oficina_confirmada" e
 * "nao_aplica" em uso real (os dois últimos adicionados na v0.7.0, depois do prompt
 * original ter sido escrito).
 */
(function (root) {
  "use strict";

  // ESTADOS: chave -> {rotulo, classe, contexto}. "classe" é o nome da classe CSS já
  // existente em css/base.css (.chip.<classe> ou .cel.<classe>, dependendo do contexto).
  const ESTADOS = {
    // ---- acao (plano.html, index.html, caminho.html — via js/core.js stClass) ----
    nao_iniciado: { rotulo: "Não iniciado", classe: "st-nao", contexto: "acao" },
    em_andamento: { rotulo: "Em andamento", classe: "st-andamento", contexto: "acao" },
    concluida: { rotulo: "Concluído", classe: "st-concluido", contexto: "acao" },
    atrasada: { rotulo: "Atrasada", classe: "st-atrasada", contexto: "acao" },
    janela: { rotulo: "Não iniciado · janela", classe: "st-janela", contexto: "acao" },

    // ---- no_critico (caminho.html, minhas-acoes.html) ----
    no_cumprido: { rotulo: "cumprido", classe: "st-concluido", contexto: "no_critico" },
    no_vence_hoje: { rotulo: "vence hoje", classe: "st-andamento", contexto: "no_critico" },
    no_venceu_sem_concluir: { rotulo: "venceu sem concluir", classe: "st-atrasada", contexto: "no_critico" },
    no_em_andamento: { rotulo: "em andamento", classe: "st-janela", contexto: "no_critico" },
    no_a_frente: { rotulo: "à frente", classe: "st-nao", contexto: "no_critico" },

    // ---- encontro (agenda.html) ----
    encontro_agendado: { rotulo: "Agendado", classe: "st-andamento", contexto: "encontro" },
    encontro_confirmado: { rotulo: "Confirmado", classe: "st-andamento", contexto: "encontro" },
    encontro_a_agendar: { rotulo: "A agendar", classe: "st-janela", contexto: "encontro" },
    encontro_realizado: { rotulo: "Realizado", classe: "st-concluido", contexto: "encontro" },

    // ---- celula_matriz (demandas.html) ----
    vazia: { rotulo: "—", classe: "cel-vazia", contexto: "celula_matriz" },
    previsto: { rotulo: "previsto", classe: "cel-previsto", contexto: "celula_matriz" },
    oficina_confirmada: { rotulo: "Oficina confirmada", classe: "cel-oficina_confirmada", contexto: "celula_matriz" },
    oficina: { rotulo: "oficina feita", classe: "cel-oficina", contexto: "celula_matriz" },
    formulario: { rotulo: "formulário ok", classe: "cel-formulario", contexto: "celula_matriz" },
    justificado: { rotulo: "justificado", classe: "cel-justificado", contexto: "celula_matriz" },
    nao_aplica: { rotulo: "Não se aplica o uso", classe: "cel-nao_aplica", contexto: "celula_matriz" },
    priorizado: { rotulo: "priorizado", classe: "cel-priorizado", contexto: "celula_matriz" },
    encaminhado: { rotulo: "encaminhado", classe: "cel-encaminhado", contexto: "celula_matriz" },

    // ---- atividade (plano-acao.html, minhas-acoes.html — Supabase) ----
    atividade_nao_iniciado: { rotulo: "Não iniciado", classe: "st-nao", contexto: "atividade" },
    atividade_em_execucao: { rotulo: "Em execução", classe: "st-andamento", contexto: "atividade" },
    atividade_atrasado: { rotulo: "Atrasado", classe: "st-atrasada", contexto: "atividade" },
  };

  // wrapper HTML por contexto: célula da matriz usa <span class="cel ...">, os outros 4
  // contextos usam o <span class="chip ..."> padrão do resto do site.
  const WRAPPER_POR_CONTEXTO = { celula_matriz: "cel" };
  function wrapperDe(contexto) { return WRAPPER_POR_CONTEXTO[contexto] || "chip"; }

  // mapaEntrada: contexto -> {valor bruto já usado em data/*.js ou no Supabase -> chave
  // canônica}. Existe pra centralizar a tradução "dado antigo → chave nova" num lugar só;
  // os arquivos de dado em si NÃO mudam de formato (Sandra continua editando do jeito que
  // já conhece). Estados derivados (calculados, não guardados como string em lugar nenhum
  // — "atrasada"/"janela" de ação e os 5 estados de nó) não entram aqui: eles nunca foram
  // "um valor bruto", sempre foram calculados (CALC.ehAtrasada/CALC.estadoNo).
  const mapaEntrada = {
    acao: { "Concluído": "concluida", "Em andamento": "em_andamento", "Não iniciado": "nao_iniciado" },
    encontro: { "agendado": "encontro_agendado", "confirmado": "encontro_confirmado", "a agendar": "encontro_a_agendar", "realizado": "encontro_realizado" },
    celula_matriz: { "": "vazia", "previsto": "previsto", "oficina_confirmada": "oficina_confirmada", "oficina": "oficina", "formulario": "formulario", "justificado": "justificado", "nao_aplica": "nao_aplica", "priorizado": "priorizado", "encaminhado": "encaminhado" },
    atividade: { "nao_iniciado": "atividade_nao_iniciado", "em_execucao": "atividade_em_execucao", "atrasado": "atividade_atrasado" },
  };

  // chaveDeEntrada: traduz um valor bruto pro chave canônico do contexto informado. Sem
  // mapeamento conhecido, devolve o próprio valor bruto (degrada bem — nunca esconde um
  // status novo/desconhecido, só deixa de colorir/rotular ele "no padrão").
  function chaveDeEntrada(contexto, valorBruto) {
    const mapa = mapaEntrada[contexto] || {};
    return Object.prototype.hasOwnProperty.call(mapa, valorBruto) ? mapa[valorBruto] : valorBruto;
  }

  function estadoDe(chave) {
    return ESTADOS[chave] || null;
  }

  function rotulo(chave) {
    const e = estadoDe(chave);
    return e ? e.rotulo : String(chave);
  }

  function classeCss(chave) {
    const e = estadoDe(chave);
    return e ? e.classe : "st-nao"; // fallback neutro — nunca deixa a UI sem classe
  }

  // par: [classeCss, rotulo] — mesmo formato de retorno que window.stClass (js/core.js)
  // já usava antes deste módulo existir; ajuda quem só quer montar o HTML na mão.
  function par(chave) {
    return [classeCss(chave), rotulo(chave)];
  }

  // badge: HTML do badge padronizado — cor (classe CSS) + rótulo em TEXTO, nunca cor
  // sozinha (acessibilidade: daltonismo/leitor de tela não dependem de diferenciar cor).
  function badge(chave) {
    const e = estadoDe(chave);
    if (!e) {
      if (typeof console !== "undefined" && console.warn) console.warn("CC_STATUS.badge: chave desconhecida", chave);
      return '<span class="chip st-nao">' + escLocal(String(chave)) + "</span>";
    }
    const w = wrapperDe(e.contexto);
    return '<span class="' + w + " " + e.classe + '">' + escLocal(e.rotulo) + "</span>";
  }

  // escape local — este módulo carrega antes de js/core.js em algumas páginas (ordem
  // ainda não fixada por página), então não pode depender de window.esc existir ainda.
  function escLocal(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  const CC_STATUS = {
    ESTADOS: ESTADOS,
    chaveDeEntrada: chaveDeEntrada,
    rotulo: rotulo,
    classeCss: classeCss,
    par: par,
    badge: badge,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = CC_STATUS;
  else root.CC_STATUS = CC_STATUS;
})(this);
