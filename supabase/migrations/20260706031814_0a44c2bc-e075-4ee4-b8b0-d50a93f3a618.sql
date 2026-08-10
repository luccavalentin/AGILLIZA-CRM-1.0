
-- Configuração (Pix da empresa) por correspondente
CREATE TABLE public.matricula_config (
  correspondente_id uuid PRIMARY KEY,
  pix_chave text,
  pix_titular text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.matricula_config TO authenticated;
GRANT ALL ON public.matricula_config TO service_role;
ALTER TABLE public.matricula_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Interno ve config matricula" ON public.matricula_config
  FOR SELECT USING (public.is_interno(auth.uid()) AND correspondente_id = public.correspondente_do_usuario(auth.uid()));
CREATE POLICY "Interno cria config matricula" ON public.matricula_config
  FOR INSERT WITH CHECK (public.is_interno(auth.uid()) AND correspondente_id = public.correspondente_do_usuario(auth.uid()));
CREATE POLICY "Interno edita config matricula" ON public.matricula_config
  FOR UPDATE USING (public.is_interno(auth.uid()) AND correspondente_id = public.correspondente_do_usuario(auth.uid()))
  WITH CHECK (public.is_interno(auth.uid()) AND correspondente_id = public.correspondente_do_usuario(auth.uid()));

-- Compras de crédito
CREATE TABLE public.matricula_creditos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid NOT NULL,
  data date NOT NULL DEFAULT current_date,
  valor numeric(14,2) NOT NULL DEFAULT 0,
  descricao text,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.matricula_creditos TO authenticated;
GRANT ALL ON public.matricula_creditos TO service_role;
ALTER TABLE public.matricula_creditos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Interno ve creditos matricula" ON public.matricula_creditos
  FOR SELECT USING (public.is_interno(auth.uid()) AND correspondente_id = public.correspondente_do_usuario(auth.uid()));
CREATE POLICY "Interno cria creditos matricula" ON public.matricula_creditos
  FOR INSERT WITH CHECK (public.is_interno(auth.uid()) AND correspondente_id = public.correspondente_do_usuario(auth.uid()));
CREATE POLICY "Interno edita creditos matricula" ON public.matricula_creditos
  FOR UPDATE USING (public.is_interno(auth.uid()) AND correspondente_id = public.correspondente_do_usuario(auth.uid()))
  WITH CHECK (public.is_interno(auth.uid()) AND correspondente_id = public.correspondente_do_usuario(auth.uid()));
CREATE POLICY "Interno exclui creditos matricula" ON public.matricula_creditos
  FOR DELETE USING (public.is_interno(auth.uid()) AND correspondente_id = public.correspondente_do_usuario(auth.uid()));

-- Solicitações de matrícula
CREATE TABLE public.matricula_solicitacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid NOT NULL,
  data_solicitacao date NOT NULL DEFAULT current_date,
  solicitante text NOT NULL,
  numero_matricula text,
  valor numeric(14,2) NOT NULL DEFAULT 0,
  reembolsado boolean NOT NULL DEFAULT false,
  reembolsado_em timestamptz,
  observacao text,
  criado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.matricula_solicitacoes TO authenticated;
GRANT ALL ON public.matricula_solicitacoes TO service_role;
ALTER TABLE public.matricula_solicitacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Interno ve solicitacoes matricula" ON public.matricula_solicitacoes
  FOR SELECT USING (public.is_interno(auth.uid()) AND correspondente_id = public.correspondente_do_usuario(auth.uid()));
CREATE POLICY "Interno cria solicitacoes matricula" ON public.matricula_solicitacoes
  FOR INSERT WITH CHECK (public.is_interno(auth.uid()) AND correspondente_id = public.correspondente_do_usuario(auth.uid()));
CREATE POLICY "Interno edita solicitacoes matricula" ON public.matricula_solicitacoes
  FOR UPDATE USING (public.is_interno(auth.uid()) AND correspondente_id = public.correspondente_do_usuario(auth.uid()))
  WITH CHECK (public.is_interno(auth.uid()) AND correspondente_id = public.correspondente_do_usuario(auth.uid()));
CREATE POLICY "Interno exclui solicitacoes matricula" ON public.matricula_solicitacoes
  FOR DELETE USING (public.is_interno(auth.uid()) AND correspondente_id = public.correspondente_do_usuario(auth.uid()));

CREATE TRIGGER trg_matricula_config_updated BEFORE UPDATE ON public.matricula_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_matricula_creditos_updated BEFORE UPDATE ON public.matricula_creditos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_matricula_solicitacoes_updated BEFORE UPDATE ON public.matricula_solicitacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
