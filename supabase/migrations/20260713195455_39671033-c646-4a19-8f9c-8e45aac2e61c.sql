-- Permitir que o próprio criador exclua seus registros (além de admin/correspondente)

DROP POLICY IF EXISTS "Excluir simulacoes admin" ON public.simulacoes;
CREATE POLICY "Excluir simulacoes admin" ON public.simulacoes
FOR DELETE TO authenticated
USING (
  correspondente_id = public.correspondente_do_usuario((SELECT auth.uid()))
  AND (
    public.has_any_role((SELECT auth.uid()), ARRAY['admin','correspondente','gestor']::public.app_role[])
    OR usuario_criador_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "Excluir cliente admin" ON public.clientes;
CREATE POLICY "Excluir cliente admin" ON public.clientes
FOR DELETE TO authenticated
USING (
  correspondente_id = public.correspondente_do_usuario((SELECT auth.uid()))
  AND (
    public.has_any_role((SELECT auth.uid()), ARRAY['admin','correspondente','gestor']::public.app_role[])
    OR criador_id = (SELECT auth.uid())
  )
);

DROP POLICY IF EXISTS "propostas_delete" ON public.propostas;
CREATE POLICY "propostas_delete" ON public.propostas
FOR DELETE TO authenticated
USING (
  correspondente_id = public.correspondente_do_usuario((SELECT auth.uid()))
  AND (
    public.has_any_role((SELECT auth.uid()), ARRAY['admin','correspondente','gestor']::public.app_role[])
    OR usuario_criador_id = (SELECT auth.uid())
  )
);