-- ============================================================================
-- Cadastro do primeiro editor na allowlist (tools/sql/2026-08_auth_escrita.sql)
-- ============================================================================
-- meta_inovacao_editores existia mas estava VAZIA — nenhum usuário conseguia passar
-- em cc_eh_editor(), nem o JR., mesmo depois de logar. Este script cadastra o JR.
-- (usuário criado em Authentication > Users, e-mail juniorapt@gmail.com).
--
-- Idempotente: rodar de novo só atualiza o nome, não duplica linha (user_id é PK).
-- ============================================================================

INSERT INTO public.meta_inovacao_editores (user_id, nome)
VALUES ('5afe68ad-4fa5-4959-b62f-3fb1bbf65a2b', 'JR.')
ON CONFLICT (user_id) DO UPDATE SET nome = EXCLUDED.nome;

-- Verificação — deve trazer 1 linha, JR.:
SELECT user_id, nome, criado_em FROM public.meta_inovacao_editores;
