CREATE TABLE public.cliente_documento_pastas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  correspondente_id uuid NOT NULL,
  nome text NOT NULL,
  slug text,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_documento_pastas TO authenticated;
GRANT ALL ON public.cliente_documento_pastas TO service_role;

ALTER TABLE public.cliente_documento_pastas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pastas por acesso ao cliente" ON public.cliente_documento_pastas
  FOR ALL TO authenticated
  USING (public.usuario_tem_acesso_cliente(auth.uid(), cliente_id))
  WITH CHECK (public.usuario_tem_acesso_cliente(auth.uid(), cliente_id));

CREATE TRIGGER trg_cliente_documento_pastas_updated
  BEFORE UPDATE ON public.cliente_documento_pastas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_cliente_documento_pastas_cliente ON public.cliente_documento_pastas(cliente_id);

ALTER TABLE public.cliente_documentos
  ADD COLUMN IF NOT EXISTS pasta_id uuid REFERENCES public.cliente_documento_pastas(id) ON DELETE SET NULL;

ALTER TABLE public.admin_audit_logs
  ADD COLUMN IF NOT EXISTS descricao text;