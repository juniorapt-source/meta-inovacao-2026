-- 2026-10_fluxo_dados_patch1.sql
-- Correção da view fluxo_dados_rotas_lacunas: "indefinido" passa a contar
-- como lacuna (antes, dois "a_definir" ou dois vazios davam "sem lacuna").
-- Só troca a view. Não mexe em tabelas nem em dados. Pode rodar uma vez.

create or replace view fluxo_dados_rotas_lacunas
with (security_invoker = true) as
select
  r.id,
  r.iniciativa,
  r.tipo_dado,
  r.descricao,
  so.nome  as origem,
  sdh.nome as destino_hoje,
  sda.nome as destino_alvo,
  gh.nome  as golden_hoje,
  ga.nome  as golden_alvo,
  r.quem_envia_hoje,
  r.quem_deveria_enviar,
  r.mecanismo_hoje,
  r.mecanismo_alvo,
  r.chega_completo,
  r.status,
  (r.sistema_destino_alvo_id is not null
     and r.golden_alvo_id is not null
     and r.quem_deveria_enviar is not null
     and r.mecanismo_alvo <> 'a_definir')                            as alvo_definido,
  (r.sistema_destino_hoje_id is distinct from r.sistema_destino_alvo_id) as lacuna_destino,
  (r.golden_hoje_id          is distinct from r.golden_alvo_id)          as lacuna_golden,
  (r.mecanismo_hoje is distinct from r.mecanismo_alvo
     or r.mecanismo_alvo = 'a_definir')                              as lacuna_mecanismo,
  (r.quem_deveria_enviar is null
     or r.quem_envia_hoje is distinct from r.quem_deveria_enviar)    as lacuna_remetente
from fluxo_dados_rotas r
left join fluxo_dados_sistemas so  on so.id  = r.sistema_origem_id
left join fluxo_dados_sistemas sdh on sdh.id = r.sistema_destino_hoje_id
left join fluxo_dados_sistemas sda on sda.id = r.sistema_destino_alvo_id
left join fluxo_dados_sistemas gh  on gh.id  = r.golden_hoje_id
left join fluxo_dados_sistemas ga  on ga.id  = r.golden_alvo_id
where r.ativo;

grant select on fluxo_dados_rotas_lacunas to anon, authenticated;
