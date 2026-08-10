
-- Vínculo parceiro <-> cliente
CREATE OR REPLACE FUNCTION public.cliente_vinculado_ao_parceiro(_user_id uuid, _cliente_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.cliente_parceiros cp
    WHERE cp.parceiro_id = _user_id AND cp.cliente_id = _cliente_id
  );
$function$;

-- Acesso a cliente: inclui clientes vinculados ao parceiro
CREATE OR REPLACE FUNCTION public.usuario_tem_acesso_cliente(_user_id uuid, _cliente_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = _cliente_id
      AND c.correspondente_id = public.correspondente_do_usuario(_user_id)
      AND (
        public.usuario_escopo_dados(_user_id, 'crm.clientes') IN ('todos','equipe')
        OR c.responsavel_id = _user_id
        OR c.criador_id = _user_id
        OR public.cliente_vinculado_ao_parceiro(_user_id, c.id)
      )
  );
$function$;

-- Acesso a simulação: inclui simulações de clientes vinculados ao parceiro
CREATE OR REPLACE FUNCTION public.usuario_tem_acesso_simulacao(_user_id uuid, _sim_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.simulacoes s
    WHERE s.id = _sim_id
      AND s.correspondente_id = public.correspondente_do_usuario(_user_id)
      AND (
        public.usuario_escopo_dados(_user_id,'operacional.simulacoes') IN ('todos','equipe')
        OR s.usuario_responsavel_id = _user_id
        OR s.usuario_criador_id = _user_id
        OR public.cliente_vinculado_ao_parceiro(_user_id, s.cliente_id)
      )
  );
$function$;

-- Acesso a proposta: inclui propostas de clientes vinculados ao parceiro
CREATE OR REPLACE FUNCTION public.usuario_tem_acesso_proposta(_user_id uuid, _prop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.propostas p
    WHERE p.id = _prop_id
      AND p.correspondente_id = public.correspondente_do_usuario(_user_id)
      AND (
        public.usuario_escopo_dados(_user_id,'operacional.propostas') IN ('todos','equipe')
        OR p.usuario_responsavel_id = _user_id
        OR p.usuario_criador_id = _user_id
        OR public.cliente_vinculado_ao_parceiro(_user_id, p.cliente_id)
      )
  );
$function$;

-- Policy SELECT clientes: incluir vínculo de parceiro no escopo "próprios"
DROP POLICY IF EXISTS "Ver clientes conforme escopo" ON public.clientes;
CREATE POLICY "Ver clientes conforme escopo"
ON public.clientes FOR SELECT TO authenticated
USING (
  correspondente_id = public.correspondente_do_usuario(auth.uid())
  AND (
    public.usuario_escopo_dados(auth.uid(), 'crm.clientes') = ANY (ARRAY['todos'::public.escopo_dados,'equipe'::public.escopo_dados])
    OR responsavel_id = auth.uid()
    OR criador_id = auth.uid()
    OR public.cliente_vinculado_ao_parceiro(auth.uid(), id)
  )
);

-- Policy SELECT simulacoes
DROP POLICY IF EXISTS "Ver simulacoes por escopo" ON public.simulacoes;
CREATE POLICY "Ver simulacoes por escopo"
ON public.simulacoes FOR SELECT TO authenticated
USING (
  correspondente_id = public.correspondente_do_usuario(auth.uid())
  AND (
    public.usuario_escopo_dados(auth.uid(), 'operacional.simulacoes') = ANY (ARRAY['todos'::public.escopo_dados,'equipe'::public.escopo_dados])
    OR usuario_responsavel_id = auth.uid()
    OR usuario_criador_id = auth.uid()
    OR public.cliente_vinculado_ao_parceiro(auth.uid(), cliente_id)
  )
);

-- Policy SELECT propostas
DROP POLICY IF EXISTS "propostas_select" ON public.propostas;
CREATE POLICY "propostas_select"
ON public.propostas FOR SELECT TO authenticated
USING (
  correspondente_id = public.correspondente_do_usuario(auth.uid())
  AND (
    public.usuario_escopo_dados(auth.uid(), 'operacional.propostas') = ANY (ARRAY['todos'::public.escopo_dados,'equipe'::public.escopo_dados])
    OR usuario_responsavel_id = auth.uid()
    OR usuario_criador_id = auth.uid()
    OR public.cliente_vinculado_ao_parceiro(auth.uid(), cliente_id)
  )
);

-- Policy SELECT comissoes: parceiro vê as suas comissões
DROP POLICY IF EXISTS "fin_comissoes_sel" ON public.comissoes;
CREATE POLICY "fin_comissoes_sel"
ON public.comissoes FOR SELECT TO authenticated
USING (
  correspondente_id = public.correspondente_do_usuario(auth.uid())
  AND (
    public.usuario_pode_financeiro(auth.uid())
    OR usuario_responsavel_id = auth.uid()
    OR parceiro_id = auth.uid()
  )
);
