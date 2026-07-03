CREATE TABLE public.homefin_bancos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_banco INTEGER, codigo_banco INTEGER NOT NULL, nome_banco TEXT NOT NULL,
  flag_simulacao TEXT NOT NULL DEFAULT 'S', ativo BOOLEAN NOT NULL DEFAULT false,
  flag_padrao BOOLEAN NOT NULL DEFAULT false, ordem INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (codigo_banco)
);
GRANT SELECT ON public.homefin_bancos TO authenticated;
GRANT ALL ON public.homefin_bancos TO service_role;
ALTER TABLE public.homefin_bancos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Bancos visíveis para internos" ON public.homefin_bancos FOR SELECT TO authenticated USING (public.is_interno(auth.uid()));
CREATE POLICY "Admin gerencia bancos" ON public.homefin_bancos FOR ALL TO authenticated
  USING (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[]))
  WITH CHECK (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[]));
CREATE TRIGGER homefin_bancos_updated BEFORE UPDATE ON public.homefin_bancos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE VIEW public.vw_bancos_ativos AS
  SELECT id, id_banco, codigo_banco, nome_banco, flag_simulacao, flag_padrao, ordem
  FROM public.homefin_bancos WHERE ativo = true ORDER BY ordem, nome_banco;
GRANT SELECT ON public.vw_bancos_ativos TO authenticated;

INSERT INTO public.homefin_bancos (codigo_banco, nome_banco, ativo, flag_padrao, ordem) VALUES
  (237,'Bradesco', true,  true,  10),
  (33, 'Santander',true,  true,  20),
  (341,'Itaú',     true,  true,  30),
  (77, 'Inter',    false, false, 40),
  (104,'Caixa',    false, false, 50);

CREATE TABLE public.homefin_operacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_operacao INTEGER NOT NULL, nome_operacao TEXT NOT NULL, produto_sistema TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (id_operacao)
);
GRANT SELECT ON public.homefin_operacoes TO authenticated;
GRANT ALL ON public.homefin_operacoes TO service_role;
ALTER TABLE public.homefin_operacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Operacoes visíveis para internos" ON public.homefin_operacoes FOR SELECT TO authenticated USING (public.is_interno(auth.uid()));
CREATE TRIGGER homefin_operacoes_updated BEFORE UPDATE ON public.homefin_operacoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.homefin_operacoes (id_operacao, nome_operacao, produto_sistema) VALUES
  (1,'Financiamento Imobiliário','financiamento_imobiliario'),
  (2,'Home Equity','home_equity');

CREATE TABLE public.homefin_auth_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
  id_regional TEXT, id_parceiro TEXT, id_usuario_parceiro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.homefin_auth_cache TO service_role;
ALTER TABLE public.homefin_auth_cache ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.homefin_email_otp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL, token_hash TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
  tentativas INTEGER NOT NULL DEFAULT 0, used_at TIMESTAMPTZ, ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX homefin_email_otp_email_idx ON public.homefin_email_otp (lower(email));
GRANT ALL ON public.homefin_email_otp TO service_role;
ALTER TABLE public.homefin_email_otp ENABLE ROW LEVEL SECURITY;