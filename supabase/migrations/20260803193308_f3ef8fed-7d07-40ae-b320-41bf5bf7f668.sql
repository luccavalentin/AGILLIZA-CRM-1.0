INSERT INTO public.permissions (nivel_acesso_id, modulo, acao, permitido, escopo_dados)
SELECT al.id, m.modulo, a.acao, TRUE, 'proprios'::escopo_dados
FROM public.access_levels al
CROSS JOIN (VALUES ('operacional.chats'), ('crm.chat')) AS m(modulo)
CROSS JOIN (VALUES ('view'), ('create')) AS a(acao)
ON CONFLICT (nivel_acesso_id, modulo, acao) DO NOTHING;