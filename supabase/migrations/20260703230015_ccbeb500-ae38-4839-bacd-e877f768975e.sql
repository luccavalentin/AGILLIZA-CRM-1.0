-- ============ Funções de escopo de relatórios ============
CREATE OR REPLACE FUNCTION public.can_view_global_reports(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.usuario_escopo_dados(_user_id, 'relatorios.geral') = 'todos';
$$;

CREATE OR REPLACE FUNCTION public.can_view_team_reports(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.usuario_escopo_dados(_user_id, 'relatorios.geral') IN ('todos','equipe');
$$;

-- ============ report_definitions (catálogo) ============
CREATE TABLE public.report_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  titulo text NOT NULL,
  descricao text,
  modulo text NOT NULL,
  view_base text,
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.report_definitions TO authenticated;
GRANT ALL ON public.report_definitions TO service_role;
ALTER TABLE public.report_definitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autenticados leem definicoes de relatorio"
  ON public.report_definitions FOR SELECT TO authenticated USING (true);

-- ============ report_saved_filters ============
CREATE TABLE public.report_saved_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid NOT NULL,
  user_id uuid NOT NULL,
  report_codigo text NOT NULL,
  nome text NOT NULL,
  filtros jsonb NOT NULL DEFAULT '{}'::jsonb,
  colunas jsonb,
  grafico text,
  view_base text,
  visibilidade text NOT NULL DEFAULT 'private',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_saved_filters TO authenticated;
GRANT ALL ON public.report_saved_filters TO service_role;
ALTER TABLE public.report_saved_filters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver filtros proprios ou compartilhados da equipe"
  ON public.report_saved_filters FOR SELECT TO authenticated
  USING (
    correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (user_id = auth.uid() OR visibilidade = 'shared_team')
  );
CREATE POLICY "Gerenciar filtros proprios"
  ON public.report_saved_filters FOR ALL TO authenticated
  USING (user_id = auth.uid() AND correspondente_id = public.correspondente_do_usuario(auth.uid()))
  WITH CHECK (user_id = auth.uid() AND correspondente_id = public.correspondente_do_usuario(auth.uid()));

-- ============ report_exports ============
CREATE TABLE public.report_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid NOT NULL,
  user_id uuid NOT NULL,
  report_codigo text NOT NULL,
  formato text NOT NULL,
  filtros jsonb NOT NULL DEFAULT '{}'::jsonb,
  registros int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'concluido',
  arquivo_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_exports TO authenticated;
GRANT ALL ON public.report_exports TO service_role;
ALTER TABLE public.report_exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver exportacoes do correspondente por escopo"
  ON public.report_exports FOR SELECT TO authenticated
  USING (
    correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.can_view_team_reports(auth.uid()) OR user_id = auth.uid())
  );
CREATE POLICY "Registrar proprias exportacoes"
  ON public.report_exports FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND correspondente_id = public.correspondente_do_usuario(auth.uid()));

-- ============ report_audit_logs ============
CREATE TABLE public.report_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid NOT NULL,
  user_id uuid NOT NULL,
  report_codigo text NOT NULL,
  acao text NOT NULL,
  formato text,
  filtros jsonb NOT NULL DEFAULT '{}'::jsonb,
  registros int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.report_audit_logs TO authenticated;
GRANT ALL ON public.report_audit_logs TO service_role;
ALTER TABLE public.report_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver auditoria de relatorios do correspondente (global/equipe)"
  ON public.report_audit_logs FOR SELECT TO authenticated
  USING (
    correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.can_view_global_reports(auth.uid()) OR user_id = auth.uid())
  );
CREATE POLICY "Registrar propria auditoria de relatorios"
  ON public.report_audit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND correspondente_id = public.correspondente_do_usuario(auth.uid()));