-- Otimização RLS: encapsular auth.uid() em (select auth.uid()) para avaliação única por query (InitPlan).
-- Semântica idêntica às políticas anteriores.

-- notificacoes
DROP POLICY IF EXISTS "Usuario ve suas notificacoes" ON public.notificacoes;
CREATE POLICY "Usuario ve suas notificacoes" ON public.notificacoes
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Usuario atualiza suas notificacoes" ON public.notificacoes;
CREATE POLICY "Usuario atualiza suas notificacoes" ON public.notificacoes
  FOR UPDATE TO authenticated USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Usuario remove suas notificacoes" ON public.notificacoes;
CREATE POLICY "Usuario remove suas notificacoes" ON public.notificacoes
  FOR DELETE TO authenticated USING ((select auth.uid()) = user_id);

-- cliente_historico
DROP POLICY IF EXISTS "Historico ver por acesso" ON public.cliente_historico;
CREATE POLICY "Historico ver por acesso" ON public.cliente_historico
  FOR SELECT TO authenticated USING (public.usuario_tem_acesso_cliente((select auth.uid()), cliente_id));

DROP POLICY IF EXISTS "Historico inserir por acesso" ON public.cliente_historico;
CREATE POLICY "Historico inserir por acesso" ON public.cliente_historico
  FOR INSERT TO authenticated WITH CHECK (public.usuario_tem_acesso_cliente((select auth.uid()), cliente_id));

-- cliente_enderecos
DROP POLICY IF EXISTS "Enderecos por acesso" ON public.cliente_enderecos;
CREATE POLICY "Enderecos por acesso" ON public.cliente_enderecos
  FOR ALL TO authenticated
  USING (public.usuario_tem_acesso_cliente((select auth.uid()), cliente_id))
  WITH CHECK (public.usuario_tem_acesso_cliente((select auth.uid()), cliente_id));

-- proposta_bancos
DROP POLICY IF EXISTS "proposta_bancos_all" ON public.proposta_bancos;
CREATE POLICY "proposta_bancos_all" ON public.proposta_bancos
  FOR ALL TO authenticated
  USING (public.usuario_tem_acesso_proposta((select auth.uid()), proposta_id))
  WITH CHECK (public.usuario_tem_acesso_proposta((select auth.uid()), proposta_id));

-- proposta_historico
DROP POLICY IF EXISTS "proposta_historico_select" ON public.proposta_historico;
CREATE POLICY "proposta_historico_select" ON public.proposta_historico
  FOR SELECT TO authenticated USING (public.usuario_tem_acesso_proposta((select auth.uid()), proposta_id));

DROP POLICY IF EXISTS "proposta_historico_insert" ON public.proposta_historico;
CREATE POLICY "proposta_historico_insert" ON public.proposta_historico
  FOR INSERT TO authenticated WITH CHECK (public.usuario_tem_acesso_proposta((select auth.uid()), proposta_id));

-- simulacao_bancos
DROP POLICY IF EXISTS "Ver bancos da simulacao com acesso" ON public.simulacao_bancos;
CREATE POLICY "Ver bancos da simulacao com acesso" ON public.simulacao_bancos
  FOR SELECT TO authenticated USING (public.usuario_tem_acesso_simulacao((select auth.uid()), simulacao_id));

DROP POLICY IF EXISTS "Gerenciar bancos da simulacao com acesso" ON public.simulacao_bancos;
CREATE POLICY "Gerenciar bancos da simulacao com acesso" ON public.simulacao_bancos
  FOR ALL TO authenticated
  USING (public.usuario_tem_acesso_simulacao((select auth.uid()), simulacao_id))
  WITH CHECK (public.usuario_tem_acesso_simulacao((select auth.uid()), simulacao_id));

-- permissions
DROP POLICY IF EXISTS "permissions_select" ON public.permissions;
CREATE POLICY "permissions_select" ON public.permissions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.access_levels al
    WHERE al.id = permissions.nivel_acesso_id
      AND (al.is_padrao = true OR al.correspondente_id = public.correspondente_do_usuario((select auth.uid())))
  ));

DROP POLICY IF EXISTS "permissions_write" ON public.permissions;
CREATE POLICY "permissions_write" ON public.permissions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.access_levels al
      WHERE al.id = permissions.nivel_acesso_id
        AND al.correspondente_id = public.correspondente_do_usuario((select auth.uid()))
    ) AND public.pode_gerenciar_pessoas((select auth.uid()))
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.access_levels al
      WHERE al.id = permissions.nivel_acesso_id
        AND al.correspondente_id = public.correspondente_do_usuario((select auth.uid()))
    ) AND public.pode_gerenciar_pessoas((select auth.uid()))
  );