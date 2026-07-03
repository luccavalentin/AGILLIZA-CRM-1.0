
-- ============ Helper: quem pode administrar ============
CREATE OR REPLACE FUNCTION public.usuario_pode_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT public.has_any_role(_user_id, ARRAY['admin','correspondente','gestor']::public.app_role[]); $$;

-- ============ profiles: novas colunas ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS documento text,
  ADD COLUMN IF NOT EXISTS ultima_atividade timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- ============ parceiro_detalhes ============
CREATE TABLE public.parceiro_detalhes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  correspondente_id uuid NOT NULL,
  creci text,
  razao_social text,
  tipo_pessoa text NOT NULL DEFAULT 'pf',
  logo_url text,
  percentual_comissao numeric NOT NULL DEFAULT 0,
  imobiliaria_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parceiro_detalhes TO authenticated;
GRANT ALL ON public.parceiro_detalhes TO service_role;
ALTER TABLE public.parceiro_detalhes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parceiro_detalhes leitura ecossistema" ON public.parceiro_detalhes
  FOR SELECT TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()));
CREATE POLICY "parceiro_detalhes gestao admin" ON public.parceiro_detalhes
  FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.usuario_pode_admin(auth.uid()))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.usuario_pode_admin(auth.uid()));
CREATE TRIGGER trg_parceiro_detalhes_updated BEFORE UPDATE ON public.parceiro_detalhes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ cliente_parceiros ============
CREATE TABLE public.cliente_parceiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid NOT NULL,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  parceiro_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, parceiro_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_parceiros TO authenticated;
GRANT ALL ON public.cliente_parceiros TO service_role;
ALTER TABLE public.cliente_parceiros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cliente_parceiros leitura" ON public.cliente_parceiros
  FOR SELECT TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
     AND (parceiro_id = auth.uid() OR public.usuario_pode_admin(auth.uid())
          OR public.usuario_tem_acesso_cliente(auth.uid(), cliente_id)));
CREATE POLICY "cliente_parceiros gestao admin" ON public.cliente_parceiros
  FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.usuario_pode_admin(auth.uid()))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.usuario_pode_admin(auth.uid()));

-- ============ homefin_bancos: novas colunas ============
ALTER TABLE public.homefin_bancos
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS produtos text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS contatos jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS codigo_agencia_padrao text,
  ADD COLUMN IF NOT EXISTS codigo_parceiro text;

-- ============ banco_credenciais (apenas NOMES de secrets) ============
CREATE TABLE public.banco_credenciais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid NOT NULL,
  banco_id uuid REFERENCES public.homefin_bancos(id) ON DELETE CASCADE,
  ambiente text NOT NULL DEFAULT 'homolog',
  base_url text,
  client_id_secret_name text,
  client_secret_name text,
  ativo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (banco_id, ambiente)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.banco_credenciais TO authenticated;
GRANT ALL ON public.banco_credenciais TO service_role;
ALTER TABLE public.banco_credenciais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "banco_credenciais admin" ON public.banco_credenciais
  FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.usuario_pode_admin(auth.uid()))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.usuario_pode_admin(auth.uid()));
CREATE TRIGGER trg_banco_cred_updated BEFORE UPDATE ON public.banco_credenciais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ admin_api_integrations ============
CREATE TABLE public.admin_api_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid NOT NULL,
  chave text NOT NULL,
  nome text NOT NULL,
  base_url text,
  secret_names jsonb NOT NULL DEFAULT '[]'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'desconhecido',
  ultimo_ping_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (correspondente_id, chave)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_api_integrations TO authenticated;
GRANT ALL ON public.admin_api_integrations TO service_role;
ALTER TABLE public.admin_api_integrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_api_integrations admin" ON public.admin_api_integrations
  FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.usuario_pode_admin(auth.uid()))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.usuario_pode_admin(auth.uid()));
CREATE TRIGGER trg_admin_api_updated BEFORE UPDATE ON public.admin_api_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ parametros_globais ============
CREATE TABLE public.parametros_globais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid NOT NULL UNIQUE,
  nome_empresa text,
  cnpj text,
  logo_url text,
  cor_primaria text,
  endereco text,
  telefone_sac text,
  politica_lgpd text,
  politica_privacidade text,
  email_dpo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parametros_globais TO authenticated;
GRANT ALL ON public.parametros_globais TO service_role;
ALTER TABLE public.parametros_globais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "parametros leitura ecossistema" ON public.parametros_globais
  FOR SELECT TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()));
CREATE POLICY "parametros gestao admin" ON public.parametros_globais
  FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.usuario_pode_admin(auth.uid()))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.usuario_pode_admin(auth.uid()));
CREATE TRIGGER trg_parametros_updated BEFORE UPDATE ON public.parametros_globais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ purchase_requests ============
CREATE SEQUENCE IF NOT EXISTS public.purchase_request_seq;
CREATE TABLE public.purchase_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid NOT NULL,
  numero text,
  descricao text NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  categoria text,
  solicitante_id uuid NOT NULL,
  aprovador_id uuid,
  status text NOT NULL DEFAULT 'pendente',
  payable_id uuid REFERENCES public.financial_payables(id) ON DELETE SET NULL,
  aprovado_em timestamptz,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_requests TO authenticated;
GRANT ALL ON public.purchase_requests TO service_role;
ALTER TABLE public.purchase_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_requests leitura" ON public.purchase_requests
  FOR SELECT TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
     AND (solicitante_id = auth.uid() OR public.usuario_pode_admin(auth.uid())));
CREATE POLICY "purchase_requests inserir" ON public.purchase_requests
  FOR INSERT TO authenticated
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND solicitante_id = auth.uid());
CREATE POLICY "purchase_requests gestao admin" ON public.purchase_requests
  FOR UPDATE TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.usuario_pode_admin(auth.uid()))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.usuario_pode_admin(auth.uid()));
CREATE OR REPLACE FUNCTION public.purchase_request_before_write()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP='INSERT' AND (NEW.numero IS NULL OR NEW.numero='') THEN
    NEW.numero := 'COM-' || lpad(nextval('public.purchase_request_seq')::text, 6, '0');
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_purchase_request_write BEFORE INSERT OR UPDATE ON public.purchase_requests
  FOR EACH ROW EXECUTE FUNCTION public.purchase_request_before_write();

-- ============ scan_ia_leituras ============
CREATE TABLE public.scan_ia_leituras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid NOT NULL,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  proposta_id uuid REFERENCES public.propostas(id) ON DELETE SET NULL,
  arquivo_url text NOT NULL,
  tipo_documento text,
  status text NOT NULL DEFAULT 'processando',
  erro text,
  criador_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scan_ia_leituras TO authenticated;
GRANT ALL ON public.scan_ia_leituras TO service_role;
ALTER TABLE public.scan_ia_leituras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scan_ia_leituras ecossistema" ON public.scan_ia_leituras
  FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()));
CREATE TRIGGER trg_scan_leitura_updated BEFORE UPDATE ON public.scan_ia_leituras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ scan_ia_campos_extraidos ============
CREATE TABLE public.scan_ia_campos_extraidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leitura_id uuid NOT NULL REFERENCES public.scan_ia_leituras(id) ON DELETE CASCADE,
  campo text NOT NULL,
  valor text,
  confianca numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scan_ia_campos_extraidos TO authenticated;
GRANT ALL ON public.scan_ia_campos_extraidos TO service_role;
ALTER TABLE public.scan_ia_campos_extraidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scan_campos ecossistema" ON public.scan_ia_campos_extraidos
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.scan_ia_leituras l WHERE l.id=leitura_id AND l.correspondente_id = public.correspondente_do_usuario(auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.scan_ia_leituras l WHERE l.id=leitura_id AND l.correspondente_id = public.correspondente_do_usuario(auth.uid())));

-- ============ scan_ia_auditoria (append-only) ============
CREATE TABLE public.scan_ia_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid NOT NULL,
  leitura_id uuid,
  ator_id uuid,
  acao text NOT NULL,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.scan_ia_auditoria TO authenticated;
GRANT ALL ON public.scan_ia_auditoria TO service_role;
ALTER TABLE public.scan_ia_auditoria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "scan_auditoria leitura admin" ON public.scan_ia_auditoria
  FOR SELECT TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.usuario_pode_admin(auth.uid()));
CREATE POLICY "scan_auditoria inserir" ON public.scan_ia_auditoria
  FOR INSERT TO authenticated
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()));

-- ============ backup_jobs ============
CREATE TABLE public.backup_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'executando',
  tamanho_bytes bigint,
  manifesto jsonb NOT NULL DEFAULT '{}'::jsonb,
  erro text,
  criador_id uuid,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.backup_jobs TO authenticated;
GRANT ALL ON public.backup_jobs TO service_role;
ALTER TABLE public.backup_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "backup_jobs admin" ON public.backup_jobs
  FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.usuario_pode_admin(auth.uid()))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.usuario_pode_admin(auth.uid()));

-- ============ integracao_health_checks ============
CREATE TABLE public.integracao_health_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid NOT NULL,
  integracao text NOT NULL,
  sucesso boolean NOT NULL,
  latencia_ms integer,
  detalhe text,
  ator_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.integracao_health_checks TO authenticated;
GRANT ALL ON public.integracao_health_checks TO service_role;
ALTER TABLE public.integracao_health_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "health_checks leitura admin" ON public.integracao_health_checks
  FOR SELECT TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.usuario_pode_admin(auth.uid()));
CREATE POLICY "health_checks inserir" ON public.integracao_health_checks
  FOR INSERT TO authenticated
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()));
