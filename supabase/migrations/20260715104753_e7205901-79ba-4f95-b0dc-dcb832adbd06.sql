
-- Unifica policies de cliente_parceiros para respeitar a matriz de permissões
DROP POLICY IF EXISTS "cliente_parceiros gestao admin" ON public.cliente_parceiros;
DROP POLICY IF EXISTS "cliente_parceiros gestao com acesso" ON public.cliente_parceiros;
DROP POLICY IF EXISTS "cliente_parceiros leitura" ON public.cliente_parceiros;

-- Leitura: mesmo correspondente E (é o próprio parceiro vinculado OU tem acesso ao cliente OU tem permissão em crm.clientes/view OU admin)
CREATE POLICY "cliente_parceiros select"
ON public.cliente_parceiros
FOR SELECT
TO authenticated
USING (
  correspondente_id = public.correspondente_do_usuario(auth.uid())
  AND (
    parceiro_id = auth.uid()
    OR public.usuario_pode_admin(auth.uid())
    OR public.usuario_tem_acesso_cliente(auth.uid(), cliente_id)
    OR public.usuario_tem_permissao(auth.uid(), 'crm.clientes', 'view')
  )
);

-- Escrita (INSERT/UPDATE/DELETE): mesmo correspondente E tem permissão de edição de clientes na matriz
CREATE POLICY "cliente_parceiros write"
ON public.cliente_parceiros
FOR ALL
TO authenticated
USING (
  correspondente_id = public.correspondente_do_usuario(auth.uid())
  AND (
    public.usuario_pode_admin(auth.uid())
    OR public.usuario_tem_permissao(auth.uid(), 'crm.clientes', 'update')
    OR public.usuario_tem_permissao(auth.uid(), 'crm.clientes', 'create')
    OR public.usuario_tem_acesso_cliente(auth.uid(), cliente_id)
  )
)
WITH CHECK (
  correspondente_id = public.correspondente_do_usuario(auth.uid())
  AND (
    public.usuario_pode_admin(auth.uid())
    OR public.usuario_tem_permissao(auth.uid(), 'crm.clientes', 'update')
    OR public.usuario_tem_permissao(auth.uid(), 'crm.clientes', 'create')
    OR public.usuario_tem_acesso_cliente(auth.uid(), cliente_id)
  )
);
