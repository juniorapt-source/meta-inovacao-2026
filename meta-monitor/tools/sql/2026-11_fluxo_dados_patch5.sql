-- =====================================================================
-- 2026-11_fluxo_dados_patch5.sql
-- Fluxo de dados: sistema "Sistema próprio".
--
-- Cadastra o sistema "Sistema próprio" (slug sistema_proprio, tipo
-- outro) para marcar em "Destino hoje" de uma rota. A tela esconde esse
-- sistema em "Destino alvo" (js/db-fluxo.js, SISTEMAS_SO_HOJE).
-- O id é fixo para casar com o snapshot data/fluxo_dados.js.
--
-- Execução: colar no Supabase SQL Editor. Ordem: depois do patch4.
-- Idempotente: se o slug já existir, não faz nada.
-- =====================================================================

insert into fluxo_dados_sistemas (id, slug, nome, tipo, mantenedor, observacao)
values ('f2f26e37-862e-44b6-900b-bd25bfd2b4a4', 'sistema_proprio', 'Sistema próprio', 'outro', null,
        'Sistema da própria iniciativa. Só aparece como destino de hoje (patch5).')
on conflict (slug) do nothing;

-- conferência: esperado 1 linha
-- select id, slug, nome, tipo, ativo from fluxo_dados_sistemas where slug = 'sistema_proprio';
