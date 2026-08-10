ALTER TABLE public.simulacoes ADD COLUMN IF NOT EXISTS compoe_renda_conjuge BOOLEAN DEFAULT TRUE;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulacoes TO authenticated;
GRANT ALL ON public.simulacoes TO service_role;
GRANT SELECT ON public.simulacoes TO anon;