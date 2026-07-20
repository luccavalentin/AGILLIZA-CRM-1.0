
DROP POLICY IF EXISTS "rh_alt_sal_select" ON public.rh_alteracoes_salariais;
DROP POLICY IF EXISTS "rh_alt_sal_mutate" ON public.rh_alteracoes_salariais;

CREATE POLICY "rh_alt_sal_select" ON public.rh_alteracoes_salariais FOR SELECT TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.salariais','view')
      OR public.usuario_tem_permissao(auth.uid(),'rh.funcionarios','view')));

CREATE POLICY "rh_alt_sal_mutate" ON public.rh_alteracoes_salariais FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.salariais','create')))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.salariais','create')));
