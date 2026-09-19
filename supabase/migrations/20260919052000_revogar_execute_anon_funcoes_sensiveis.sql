-- Funções sensíveis deixam de ser chamáveis sem login.
--
-- O linter do Supabase apontou 12 funções SECURITY DEFINER abertas ao papel
-- `anon`, ou seja, chamáveis por /rest/v1/rpc/... sem nenhuma sessão
-- (QA 19/09/2026). Entre elas estavam apagar/editar mensagem do portal do
-- cliente, transferir o atendimento de um cliente para outro responsável e
-- excluir regra de comissão — todas rodando com os poderes do dono.
--
-- Nenhuma delas é chamada pelo papel anônimo: as `portal_*` rodam pelo
-- cliente administrativo no servidor (portal-db.server.ts) e as demais pelo
-- cliente do usuário logado. Por isso o EXECUTE sai de PUBLIC e de `anon`,
-- e das `portal_*` sai também de `authenticated` — nada no aplicativo as
-- chama com sessão de usuário. `service_role` e `postgres` seguem intactos.

revoke execute on function public.calcular_comissoes_usuario_proposta(uuid, text) from public, anon;
revoke execute on function public.calcular_comissoes_usuario_simulacao(uuid) from public, anon;
revoke execute on function public.cliente_msg_after_insert() from public, anon;
revoke execute on function public.crm_transferir_atendimento(uuid, uuid, text) from public, anon;
revoke execute on function public.eleger_lider_oportunidade(uuid, timestamptz) from public, anon;
revoke execute on function public.excluir_regra_comissao_usuario(uuid) from public, anon;
revoke execute on function public.on_proposta_comissao_usuario_insert() from public, anon;
revoke execute on function public.sincronizar_comissoes_usuario_regra(uuid) from public, anon;
revoke execute on function public.trg_simulacao_comissoes_usuario() from public, anon;

revoke execute on function public.portal_editar_mensagem(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.portal_excluir_mensagem(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.portal_ocultar_conversa(uuid, uuid, boolean) from public, anon, authenticated;
