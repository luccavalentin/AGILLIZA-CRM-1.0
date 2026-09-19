-- auth.uid() avaliado uma vez por consulta nas políticas apontadas pelo
-- advisor do Supabase (auth_rls_initplan, 18 avisos em 18/09/2026).
--
-- Troca mecânica: `auth.uid()` → `(select auth.uid())`. O valor é o mesmo
-- durante toda a consulta; muda só que o Postgres calcula uma vez em vez de
-- uma por linha. ALTER POLICY mantém nome, comando, papéis e tipo. Comandos
-- gerados a partir do texto atual de pg_policies (sem digitação manual).
-- Autorizado pelo Lucca em 18/09/2026.

alter policy "estado conversa cliente proprio" on public.cliente_app_conversas_estado using ((cliente_id = (select auth.uid()))) with check ((cliente_id = (select auth.uid())));
alter policy conciliacao_itens_delete on public.conciliacao_itens using ((EXISTS ( SELECT 1
   FROM conciliacao_lotes l
  WHERE ((l.id = conciliacao_itens.lote_id) AND (l.correspondente_id = correspondente_do_usuario((select auth.uid()))) AND usuario_pode_admin((select auth.uid()))))));
alter policy conciliacao_itens_insert on public.conciliacao_itens with check ((EXISTS ( SELECT 1
   FROM conciliacao_lotes l
  WHERE ((l.id = conciliacao_itens.lote_id) AND (l.correspondente_id = correspondente_do_usuario((select auth.uid()))) AND is_interno((select auth.uid()))))));
alter policy conciliacao_itens_select on public.conciliacao_itens using ((EXISTS ( SELECT 1
   FROM conciliacao_lotes l
  WHERE ((l.id = conciliacao_itens.lote_id) AND (l.correspondente_id = correspondente_do_usuario((select auth.uid())))))));
alter policy conciliacao_itens_update on public.conciliacao_itens using ((EXISTS ( SELECT 1
   FROM conciliacao_lotes l
  WHERE ((l.id = conciliacao_itens.lote_id) AND (l.correspondente_id = correspondente_do_usuario((select auth.uid()))) AND usuario_pode_admin((select auth.uid()))))));
alter policy conciliacao_lotes_delete on public.conciliacao_lotes using (((correspondente_id = correspondente_do_usuario((select auth.uid()))) AND usuario_pode_admin((select auth.uid()))));
alter policy conciliacao_lotes_insert on public.conciliacao_lotes with check (((correspondente_id = correspondente_do_usuario((select auth.uid()))) AND is_interno((select auth.uid()))));
alter policy conciliacao_lotes_select on public.conciliacao_lotes using ((correspondente_id = correspondente_do_usuario((select auth.uid()))));
alter policy conciliacao_lotes_update on public.conciliacao_lotes using (((correspondente_id = correspondente_do_usuario((select auth.uid()))) AND usuario_pode_admin((select auth.uid()))));
alter policy base_admin_delete on public.consultor_ia_base using (has_any_role((select auth.uid()), ARRAY['admin'::app_role, 'correspondente'::app_role]));
alter policy base_admin_insert on public.consultor_ia_base with check (has_any_role((select auth.uid()), ARRAY['admin'::app_role, 'correspondente'::app_role]));
alter policy base_admin_update on public.consultor_ia_base using (has_any_role((select auth.uid()), ARRAY['admin'::app_role, 'correspondente'::app_role])) with check (has_any_role((select auth.uid()), ARRAY['admin'::app_role, 'correspondente'::app_role]));
alter policy base_select_interno on public.consultor_ia_base using (((correspondente_id IS NULL) OR (correspondente_id = ( SELECT p.correspondente_id
   FROM profiles p
  WHERE (p.id = (select auth.uid()))))));
alter policy conversas_proprias on public.consultor_ia_conversas using ((usuario_id = (select auth.uid()))) with check ((usuario_id = (select auth.uid())));
alter policy mensagens_proprias on public.consultor_ia_mensagens using ((EXISTS ( SELECT 1
   FROM consultor_ia_conversas c
  WHERE ((c.id = consultor_ia_mensagens.conversa_id) AND (c.usuario_id = (select auth.uid())))))) with check ((EXISTS ( SELECT 1
   FROM consultor_ia_conversas c
  WHERE ((c.id = consultor_ia_mensagens.conversa_id) AND (c.usuario_id = (select auth.uid()))))));
alter policy sugestoes_admin_update on public.consultor_ia_sugestoes using (has_any_role((select auth.uid()), ARRAY['admin'::app_role, 'correspondente'::app_role])) with check (has_any_role((select auth.uid()), ARRAY['admin'::app_role, 'correspondente'::app_role]));
alter policy sugestoes_insert on public.consultor_ia_sugestoes with check ((usuario_id = (select auth.uid())));
alter policy sugestoes_select on public.consultor_ia_sugestoes using (((usuario_id = (select auth.uid())) OR has_any_role((select auth.uid()), ARRAY['admin'::app_role, 'correspondente'::app_role])));
