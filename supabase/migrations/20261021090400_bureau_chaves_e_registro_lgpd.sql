-- Bureau de crédito: chaves só no servidor e registro LGPD de cada consulta.
--
-- 1. bureau_credenciais: qualquer usuário interno do ecossistema lia e alterava
--    a linha pela API, inclusive a coluna `credenciais` (as chaves do contrato
--    com o fornecedor). A coluna deixa de ser legível por `authenticated`; as
--    chaves são lidas e gravadas só no servidor, com o client de serviço, depois
--    de conferir admin.integracoes › edit. As políticas ficam como segunda
--    barreira para as demais colunas.
-- 2. bureau_consultas: não havia política de INSERT, então o registro da
--    consulta (quem, quando, documento, finalidade) nunca era gravado. O
--    servidor grava o registro antes de chamar o fornecedor, sem resultado, e o
--    conclui depois com o client de serviço. Pela API ninguém altera nem apaga.

-- ───────────── bureau_credenciais ─────────────
revoke all on public.bureau_credenciais from anon;
revoke select, insert, update, delete on public.bureau_credenciais from authenticated;
grant select (id, correspondente_id, provedor, nome, base_url, ativo, criado_por, created_at, updated_at)
  on public.bureau_credenciais to authenticated;
grant all on public.bureau_credenciais to service_role;

drop policy if exists bureau_credenciais_admin on public.bureau_credenciais;
drop policy if exists bureau_credenciais_leitura on public.bureau_credenciais;
drop policy if exists bureau_credenciais_insert on public.bureau_credenciais;
drop policy if exists bureau_credenciais_update on public.bureau_credenciais;
drop policy if exists bureau_credenciais_delete on public.bureau_credenciais;

create policy bureau_credenciais_leitura on public.bureau_credenciais
  for select to authenticated
  using (
    correspondente_id = public.correspondente_do_usuario((select auth.uid()))
    and public.usuario_tem_permissao((select auth.uid()), 'admin.integracoes', 'view')
  );

create policy bureau_credenciais_insert on public.bureau_credenciais
  for insert to authenticated
  with check (
    correspondente_id = public.correspondente_do_usuario((select auth.uid()))
    and public.usuario_tem_permissao((select auth.uid()), 'admin.integracoes', 'edit')
  );

create policy bureau_credenciais_update on public.bureau_credenciais
  for update to authenticated
  using (
    correspondente_id = public.correspondente_do_usuario((select auth.uid()))
    and public.usuario_tem_permissao((select auth.uid()), 'admin.integracoes', 'edit')
  )
  with check (
    correspondente_id = public.correspondente_do_usuario((select auth.uid()))
    and public.usuario_tem_permissao((select auth.uid()), 'admin.integracoes', 'edit')
  );

create policy bureau_credenciais_delete on public.bureau_credenciais
  for delete to authenticated
  using (
    correspondente_id = public.correspondente_do_usuario((select auth.uid()))
    and public.usuario_tem_permissao((select auth.uid()), 'admin.integracoes', 'edit')
  );

-- ───────────── bureau_consultas ─────────────
revoke all on public.bureau_consultas from anon;
revoke update, delete on public.bureau_consultas from authenticated;
grant select, insert on public.bureau_consultas to authenticated;
grant all on public.bureau_consultas to service_role;

-- O registro nasce sem resultado (sucesso falso, sem ficha), em nome de quem
-- consulta e na conta dele. Só o servidor marca o sucesso e guarda a ficha, para
-- ninguém forjar pela API uma consulta "bem-sucedida".
drop policy if exists bureau_consultas_registro on public.bureau_consultas;
create policy bureau_consultas_registro on public.bureau_consultas
  for insert to authenticated
  with check (
    ator_id = (select auth.uid())
    and correspondente_id = public.correspondente_do_usuario((select auth.uid()))
    and public.is_interno((select auth.uid()))
    and public.usuario_tem_permissao((select auth.uid()), 'crm.clientes', 'view')
    and sucesso = false
    and ficha is null
  );
