-- Permitir que usuários com acesso ao cliente possam gerenciar vínculos de atendimento
DROP POLICY IF EXISTS "cliente_parceiros gestao com acesso" ON public.cliente_parceiros;
CREATE POLICY "cliente_parceiros gestao com acesso" ON public.cliente_parceiros
  FOR ALL TO authenticated
  USING (
    correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND public.usuario_tem_acesso_cliente(auth.uid(), cliente_id)
  )
  WITH CHECK (
    correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND public.usuario_tem_acesso_cliente(auth.uid(), cliente_id)
  );