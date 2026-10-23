-- Portal do cliente fechado para a chave pública (teste adversarial de 23/10/2026).
--
-- O portal do cliente NÃO usa o login do Supabase: a sessão é um cookie selado e as
-- funções `portal_*` são chamadas só pelo servidor, com o client de serviço
-- (src/lib/portal/portal-db.server.ts). Mas várias delas ficaram com EXECUTE para
-- `anon`/`authenticated` desde 07/2026, e recebem o id do cliente (`_cid`) de quem
-- chama. Com a chave pública (que vai no navegador), qualquer pessoa chamava
-- `POST /rest/v1/rpc/portal_baixar_dados {"_cid": "..."}` e levava os dados pessoais
-- do cliente de QUALQUER conta — sem cookie, sem login. Também dava para apagar o app
-- de um cliente (portal_excluir_app_cliente), abrir pedido LGPD em qualquer conta
-- (portal_solicitar_lgpd) e tentar datas de nascimento sem bloqueio no login
-- (portal_cliente_login com _doc_hash trocado a cada tentativa).
--
-- E o bucket `cliente-documentos` tinha políticas para `anon` (ler e gravar o bucket
-- inteiro): a chave pública listava e baixava documentos de todos os clientes.
--
-- Correção: as `portal_*` do cliente ficam só com o service_role (o servidor). As
-- `portal_time_*` (usadas pela equipe logada, pela RLS) não mudam. As políticas de
-- `anon` no bucket saem; as da equipe logada (`cli_docs_*` para authenticated) ficam.

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname like 'portal\_%'
       and p.proname not like 'portal\_time\_%'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;

drop policy if exists "cli_docs_select_anon" on storage.objects;
drop policy if exists "cli_docs_insert_anon" on storage.objects;
