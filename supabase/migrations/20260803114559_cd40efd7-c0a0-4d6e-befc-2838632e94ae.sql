CREATE POLICY "purchase_requests editar proprio pendente"
ON public.purchase_requests FOR UPDATE TO authenticated
USING (
  correspondente_id = correspondente_do_usuario((SELECT auth.uid()))
  AND solicitante_id = (SELECT auth.uid())
  AND status = 'pendente'
)
WITH CHECK (
  correspondente_id = correspondente_do_usuario((SELECT auth.uid()))
  AND solicitante_id = (SELECT auth.uid())
  AND status = 'pendente'
);

CREATE POLICY "purchase_requests excluir"
ON public.purchase_requests FOR DELETE TO authenticated
USING (
  correspondente_id = correspondente_do_usuario((SELECT auth.uid()))
  AND (
    usuario_pode_admin((SELECT auth.uid()))
    OR (solicitante_id = (SELECT auth.uid()) AND status = 'pendente')
  )
);