-- =============================================================================
-- Trocar o e-mail de acesso pela própria pessoa (02/11/2026): encerrar as sessões do Auth.
--
-- Depois que a pessoa confirma o e-mail novo pelo link (0601 do Corretor), TODAS as sessões
-- dela são encerradas: quem estava conectado (inclusive em outro aparelho) entra de novo com o
-- e-mail novo. A API administrativa do Auth não encerra as sessões de outra pessoa sem o token
-- dela; o servidor do Agilliza chama esta função (só a chave de serviço chega aqui). Os tokens
-- de acesso já emitidos deixam de renovar; o servidor confere a sessão a cada chamada.
-- =============================================================================
create or replace function public.encerrar_sessoes_auth(_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v integer;
begin
  if _user_id is null then
    return 0;
  end if;
  delete from auth.sessions where user_id = _user_id;
  get diagnostics v = row_count;
  return v;
end;
$$;

revoke all on function public.encerrar_sessoes_auth(uuid) from public, anon, authenticated;
grant execute on function public.encerrar_sessoes_auth(uuid) to service_role;

comment on function public.encerrar_sessoes_auth(uuid) is
  'Encerra todas as sessões do Auth de uma pessoa (troca do e-mail de acesso, 02/11/2026). Só service_role.';
