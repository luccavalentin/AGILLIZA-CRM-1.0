CREATE TABLE public.cliente_vendedores (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo_pessoa public.tipo_pessoa NOT NULL DEFAULT 'PF',
  nome text NOT NULL,
  documento text,
  documento_secundario text,
  data_nascimento date,
  estado_civil text,
  regime_casamento text,
  mae text,
  pai text,
  sexo text,
  nacionalidade text,
  naturalidade text,
  tipo_documento_identidade text,
  numero_documento text,
  orgao_expedidor text,
  uf_expedicao text,
  data_expedicao date,
  profissao text,
  empresa text,
  banco_conta text,
  agencia text,
  conta_corrente text,
  digito_conta text,
  email text,
  telefone_celular text,
  renda_total_declarada numeric,
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  utiliza_fgts boolean NOT NULL DEFAULT false,
  fg_autorizacao_dados boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_vendedores TO authenticated;
GRANT ALL ON public.cliente_vendedores TO service_role;

ALTER TABLE public.cliente_vendedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendedores por acesso ao cliente"
ON public.cliente_vendedores
FOR ALL
TO authenticated
USING (public.usuario_tem_acesso_cliente(auth.uid(), cliente_id))
WITH CHECK (public.usuario_tem_acesso_cliente(auth.uid(), cliente_id));

CREATE INDEX idx_cliente_vendedores_cliente ON public.cliente_vendedores(cliente_id);

CREATE TRIGGER trg_cliente_vendedores_updated
BEFORE UPDATE ON public.cliente_vendedores
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();