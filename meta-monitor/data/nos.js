window.DB = window.DB || {};
window.DB.nos = {
 "nos": [
  {
   "no": 1,
   "data": "04/08",
   "data_iso": "2026-08-04",
   "titulo": "Devolutiva da URC sobre a grade",
   "acoes": [
    "CAN-02"
   ],
   "guardiao": "Gerência",
   "fallback": "Qualquer contraproposta de datas serve, desde que o Ciclo 1 comece até ~18/08 — depois disso a priorização de 11/09 desliza em cadeia.",
   "gatilho": "Silêncio até 12h de 05/08 → ligação gerência-a-gerência no mesmo dia."
  },
  {
   "no": 2,
   "data": "05–07/08",
   "data_iso": "2026-08-07",
   "titulo": "Representantes indicados + locais reservados",
   "acoes": [
    "CAN-05",
    "CAN-06"
   ],
   "guardiao": "Comitê e Sandra",
   "fallback": "Aprovado no rito de 07/08: sem indicação do núcleo, o gestor da iniciativa é o representante; sala indisponível → canal migra para online (pré-acordar com a URC; DXP, de 2h, é candidato natural).",
   "gatilho": "Pendência na sexta 07/08 → aplicar fallback automaticamente."
  },
  {
   "no": 3,
   "data": "12/08",
   "data_iso": "2026-08-12",
   "titulo": "Fechamento do Lote 1 (debates + validação do Comitê)",
   "acoes": [
    "INS-02",
    "INS-06"
   ],
   "guardiao": "JR. e gestores + Comitê",
   "fallback": "Submissão modular — os 3 instrumentos prontos sobem dia 14 como Lote 1A e o restante em 21/08.",
   "gatilho": "Debates de Fomento/Investimento não realizados até 11/08 → acionar fallback."
  },
  {
   "no": 4,
   "data": "14/08",
   "data_iso": "2026-08-14",
   "titulo": "Submissão do Lote 1 às unidades",
   "acoes": [
    "INS-07"
   ],
   "guardiao": "JR./Gerência",
   "fallback": "Compromisso público do deck (slides 10 e 17): não desliza. É a data que os fallbacks do Nó 3 protegem.",
   "gatilho": "14/08 concentra também PTF-01, PTF-02, CAN-09 e CG-03 — distribuir execução com Sandra e Pova."
  },
  {
   "no": 5,
   "data": "11→13/08",
   "data_iso": "2026-08-13",
   "titulo": "Calendário + convites + formulário plano B antes do Ciclo 1",
   "acoes": [
    "CAN-04",
    "CAN-10"
   ],
   "guardiao": "Sandra + gestores",
   "fallback": "Formulário estático com opções estruturadas pronto em 11/08 — o Ciclo 1 abre coberto por ele. O agente de IA (CAN-08/09) fica fora do caminho crítico.",
   "gatilho": "Checkpoint 19/08 (5 dos 8 canais rodados): presença baixa ou formulários travados → coordenador do núcleo age na mesma semana."
  },
  {
   "no": 6,
   "data": "≤04/09",
   "data_iso": "2026-09-04",
   "titulo": "Oficina com a UDT (encadeia Lote 2)",
   "acoes": [
    "INS-04"
   ],
   "guardiao": "Sandra/Anny + JR.",
   "fallback": "O que não depende da UDT (ex.: definições do ALI IG) é antecipado nas agendas do Lote 2. Convite precisou sair até 07/08.",
   "gatilho": "14/08 sem data da oficina → gerência aciona. Hoje o nó mais perigoso: dependência sem data consome folga invisivelmente."
  },
  {
   "no": 7,
   "data": "11/09",
   "data_iso": "2026-09-11",
   "titulo": "Priorização do Ciclo 1 → URC",
   "acoes": [
    "CAN-13",
    "CAN-12"
   ],
   "guardiao": "Comitê",
   "fallback": "Critérios como primeira pauta do Comitê após o início do ciclo — custa zero proteger. Sem critérios prévios, a triagem reabre discussão com demandas já na mesa.",
   "gatilho": "Critérios não aprovados até 21/08 → âmbar no painel e pauta obrigatória."
  }
 ],
 "slas": [
  {
   "id": "SLA-URC",
   "titulo": "Cronograma de entrega das demandas (URC)",
   "acoes": [
    "CAN-17"
   ],
   "acao": "Negociar na própria devolutiva de 04/08: URC devolve cronograma em até 10 d.u. após cada lote priorizado. Sem isso, CAN-17 segue sendo uma linha com dono 'URC' e nada mais."
  },
  {
   "id": "SLA-SOL",
   "titulo": "Pedido das 4 oficinas (Soluções)",
   "acoes": [
    "PTF-01",
    "PTF-02"
   ],
   "acao": "O pedido de 14/08 sai completo: proposta de formato junto e datas propostas de 28/09 a 09/10, fora da colisão com o fim do Ciclo 2."
  }
 ],
 "folga": "Janelas reais: 26/08–04/09 e pós-16/10. Se URC e UDT confirmarem datas até 14/08, o ano fecha com ~2–3 semanas de folga; se qualquer um deslizar para setembro, a régua de dezembro vira 'encaminhamentos claros' em vez de implantação iniciada."
};
