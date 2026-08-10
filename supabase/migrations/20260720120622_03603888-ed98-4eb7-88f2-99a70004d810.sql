
-- =========================================================================
-- RH · Fases 2-5 — Documentos, Ocorrências, Férias, Benefícios,
-- Alterações salariais, Adiantamentos, Descontos, Folha e Holerites
-- =========================================================================

-- Enums ------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.rh_ocorrencia_tipo AS ENUM
    ('falta','atestado','advertencia','licenca','suspensao','elogio','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.rh_ferias_status AS ENUM
    ('planejada','aprovada','em_curso','concluida','cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.rh_folha_status AS ENUM
    ('aberta','conferida','fechada','cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.rh_lancamento_status AS ENUM
    ('previsto','descontado','pago','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Helper: standardized RLS predicate expressions are inlined per policy.

-- 1. Documentos ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rh_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id UUID NOT NULL,
  funcionario_id UUID NOT NULL REFERENCES public.rh_funcionarios(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  descricao TEXT,
  arquivo_path TEXT NOT NULL,
  arquivo_nome TEXT NOT NULL,
  mime_type TEXT,
  tamanho_bytes BIGINT,
  validade DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  uploaded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_documentos TO authenticated;
GRANT ALL ON public.rh_documentos TO service_role;
ALTER TABLE public.rh_documentos ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS ix_rh_docs_func ON public.rh_documentos(funcionario_id, created_at DESC);

CREATE POLICY "rh_docs_select" ON public.rh_documentos FOR SELECT TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.documentos','view')
      OR public.usuario_tem_permissao(auth.uid(),'rh.funcionarios','view')));

CREATE POLICY "rh_docs_mutate" ON public.rh_documentos FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.documentos','edit')))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.documentos','edit')));

CREATE TRIGGER rh_docs_updated_at BEFORE UPDATE ON public.rh_documentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Ocorrências ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rh_ocorrencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id UUID NOT NULL,
  funcionario_id UUID NOT NULL REFERENCES public.rh_funcionarios(id) ON DELETE CASCADE,
  tipo public.rh_ocorrencia_tipo NOT NULL,
  data_inicio DATE NOT NULL,
  data_fim DATE,
  dias INTEGER,
  cid TEXT,
  justificativa TEXT,
  abonada BOOLEAN NOT NULL DEFAULT false,
  arquivo_path TEXT,
  arquivo_nome TEXT,
  criado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_ocorrencias TO authenticated;
GRANT ALL ON public.rh_ocorrencias TO service_role;
ALTER TABLE public.rh_ocorrencias ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS ix_rh_ocor_func ON public.rh_ocorrencias(funcionario_id, data_inicio DESC);

CREATE POLICY "rh_ocor_select" ON public.rh_ocorrencias FOR SELECT TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.ocorrencias','view')
      OR public.usuario_tem_permissao(auth.uid(),'rh.funcionarios','view')));

CREATE POLICY "rh_ocor_mutate" ON public.rh_ocorrencias FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.ocorrencias','edit')))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.ocorrencias','edit')));

CREATE TRIGGER rh_ocor_updated_at BEFORE UPDATE ON public.rh_ocorrencias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Férias --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rh_ferias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id UUID NOT NULL,
  funcionario_id UUID NOT NULL REFERENCES public.rh_funcionarios(id) ON DELETE CASCADE,
  periodo_aquisitivo_inicio DATE NOT NULL,
  periodo_aquisitivo_fim DATE NOT NULL,
  data_inicio DATE,
  data_fim DATE,
  dias_gozados INTEGER NOT NULL DEFAULT 30,
  abono_dias INTEGER NOT NULL DEFAULT 0,
  adiantar_13o BOOLEAN NOT NULL DEFAULT false,
  status public.rh_ferias_status NOT NULL DEFAULT 'planejada',
  observacoes TEXT,
  aprovado_por UUID,
  aprovado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_ferias TO authenticated;
GRANT ALL ON public.rh_ferias TO service_role;
ALTER TABLE public.rh_ferias ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS ix_rh_ferias_func ON public.rh_ferias(funcionario_id, periodo_aquisitivo_inicio DESC);

CREATE POLICY "rh_ferias_select" ON public.rh_ferias FOR SELECT TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.ferias','view')
      OR public.usuario_tem_permissao(auth.uid(),'rh.funcionarios','view')));

CREATE POLICY "rh_ferias_mutate" ON public.rh_ferias FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.ferias','edit')))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.ferias','edit')));

CREATE TRIGGER rh_ferias_updated_at BEFORE UPDATE ON public.rh_ferias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Benefícios (tipos) --------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rh_beneficios_tipos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id UUID NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  valor_padrao NUMERIC(14,2) NOT NULL DEFAULT 0,
  desconto_padrao NUMERIC(14,2) NOT NULL DEFAULT 0,
  natureza TEXT NOT NULL DEFAULT 'beneficio',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (correspondente_id, nome)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_beneficios_tipos TO authenticated;
GRANT ALL ON public.rh_beneficios_tipos TO service_role;
ALTER TABLE public.rh_beneficios_tipos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_ben_tipos_select" ON public.rh_beneficios_tipos FOR SELECT TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.beneficios','view')
      OR public.usuario_tem_permissao(auth.uid(),'rh.funcionarios','view')));

CREATE POLICY "rh_ben_tipos_mutate" ON public.rh_beneficios_tipos FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.beneficios','edit')))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.beneficios','edit')));

CREATE TRIGGER rh_ben_tipos_updated_at BEFORE UPDATE ON public.rh_beneficios_tipos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Benefícios do funcionário -------------------------------------------
CREATE TABLE IF NOT EXISTS public.rh_funcionario_beneficios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id UUID NOT NULL,
  funcionario_id UUID NOT NULL REFERENCES public.rh_funcionarios(id) ON DELETE CASCADE,
  tipo_id UUID NOT NULL REFERENCES public.rh_beneficios_tipos(id) ON DELETE RESTRICT,
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  desconto NUMERIC(14,2) NOT NULL DEFAULT 0,
  vigencia_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  vigencia_fim DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_funcionario_beneficios TO authenticated;
GRANT ALL ON public.rh_funcionario_beneficios TO service_role;
ALTER TABLE public.rh_funcionario_beneficios ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS ix_rh_fben_func ON public.rh_funcionario_beneficios(funcionario_id);

CREATE POLICY "rh_fben_select" ON public.rh_funcionario_beneficios FOR SELECT TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.beneficios','view')
      OR public.usuario_tem_permissao(auth.uid(),'rh.funcionarios','view')));

CREATE POLICY "rh_fben_mutate" ON public.rh_funcionario_beneficios FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.beneficios','edit')))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.beneficios','edit')));

CREATE TRIGGER rh_fben_updated_at BEFORE UPDATE ON public.rh_funcionario_beneficios
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Alterações salariais ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rh_alteracoes_salariais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id UUID NOT NULL,
  funcionario_id UUID NOT NULL REFERENCES public.rh_funcionarios(id) ON DELETE CASCADE,
  salario_anterior NUMERIC(14,2) NOT NULL DEFAULT 0,
  salario_novo NUMERIC(14,2) NOT NULL,
  motivo TEXT,
  tipo TEXT,
  vigencia DATE NOT NULL,
  aprovado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_alteracoes_salariais TO authenticated;
GRANT ALL ON public.rh_alteracoes_salariais TO service_role;
ALTER TABLE public.rh_alteracoes_salariais ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS ix_rh_alt_sal_func ON public.rh_alteracoes_salariais(funcionario_id, vigencia DESC);

CREATE POLICY "rh_alt_sal_select" ON public.rh_alteracoes_salariais FOR SELECT TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.alteracoes_salariais','view')
      OR public.usuario_tem_permissao(auth.uid(),'rh.funcionarios','view')));

CREATE POLICY "rh_alt_sal_mutate" ON public.rh_alteracoes_salariais FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.alteracoes_salariais','edit')))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.alteracoes_salariais','edit')));

CREATE TRIGGER rh_alt_sal_updated_at BEFORE UPDATE ON public.rh_alteracoes_salariais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Adiantamentos -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rh_adiantamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id UUID NOT NULL,
  funcionario_id UUID NOT NULL REFERENCES public.rh_funcionarios(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  valor NUMERIC(14,2) NOT NULL,
  competencia_mes SMALLINT NOT NULL,
  competencia_ano SMALLINT NOT NULL,
  status public.rh_lancamento_status NOT NULL DEFAULT 'previsto',
  descricao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_adiantamentos TO authenticated;
GRANT ALL ON public.rh_adiantamentos TO service_role;
ALTER TABLE public.rh_adiantamentos ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS ix_rh_adi_func ON public.rh_adiantamentos(funcionario_id, competencia_ano DESC, competencia_mes DESC);

CREATE POLICY "rh_adi_select" ON public.rh_adiantamentos FOR SELECT TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.adiantamentos','view')
      OR public.usuario_tem_permissao(auth.uid(),'rh.funcionarios','view')));

CREATE POLICY "rh_adi_mutate" ON public.rh_adiantamentos FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.adiantamentos','edit')))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.adiantamentos','edit')));

CREATE TRIGGER rh_adi_updated_at BEFORE UPDATE ON public.rh_adiantamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 8. Descontos -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rh_descontos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id UUID NOT NULL,
  funcionario_id UUID NOT NULL REFERENCES public.rh_funcionarios(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  valor NUMERIC(14,2) NOT NULL,
  competencia_mes SMALLINT NOT NULL,
  competencia_ano SMALLINT NOT NULL,
  motivo TEXT,
  status public.rh_lancamento_status NOT NULL DEFAULT 'previsto',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_descontos TO authenticated;
GRANT ALL ON public.rh_descontos TO service_role;
ALTER TABLE public.rh_descontos ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS ix_rh_desc_func ON public.rh_descontos(funcionario_id, competencia_ano DESC, competencia_mes DESC);

CREATE POLICY "rh_desc_select" ON public.rh_descontos FOR SELECT TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.descontos','view')
      OR public.usuario_tem_permissao(auth.uid(),'rh.funcionarios','view')));

CREATE POLICY "rh_desc_mutate" ON public.rh_descontos FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.descontos','edit')))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.descontos','edit')));

CREATE TRIGGER rh_desc_updated_at BEFORE UPDATE ON public.rh_descontos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 9. Folha — Competências ------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rh_folha_competencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id UUID NOT NULL,
  mes SMALLINT NOT NULL,
  ano SMALLINT NOT NULL,
  status public.rh_folha_status NOT NULL DEFAULT 'aberta',
  total_proventos NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_descontos NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_liquido NUMERIC(14,2) NOT NULL DEFAULT 0,
  observacoes TEXT,
  fechada_por UUID,
  fechada_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (correspondente_id, ano, mes)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_folha_competencias TO authenticated;
GRANT ALL ON public.rh_folha_competencias TO service_role;
ALTER TABLE public.rh_folha_competencias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_folha_select" ON public.rh_folha_competencias FOR SELECT TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.previa_folha','view')
      OR public.usuario_tem_permissao(auth.uid(),'rh.holerites','view')));

CREATE POLICY "rh_folha_mutate" ON public.rh_folha_competencias FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.previa_folha','edit')))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.previa_folha','edit')));

CREATE TRIGGER rh_folha_updated_at BEFORE UPDATE ON public.rh_folha_competencias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 10. Folha — Itens ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rh_folha_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id UUID NOT NULL,
  competencia_id UUID NOT NULL REFERENCES public.rh_folha_competencias(id) ON DELETE CASCADE,
  funcionario_id UUID NOT NULL REFERENCES public.rh_funcionarios(id) ON DELETE CASCADE,
  salario_base NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_beneficios NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_descontos NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_adiantamentos NUMERIC(14,2) NOT NULL DEFAULT 0,
  outras_provisoes NUMERIC(14,2) NOT NULL DEFAULT 0,
  liquido NUMERIC(14,2) NOT NULL DEFAULT 0,
  observacoes TEXT,
  detalhamento JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (competencia_id, funcionario_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_folha_itens TO authenticated;
GRANT ALL ON public.rh_folha_itens TO service_role;
ALTER TABLE public.rh_folha_itens ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS ix_rh_folha_it_comp ON public.rh_folha_itens(competencia_id);

CREATE POLICY "rh_folha_it_select" ON public.rh_folha_itens FOR SELECT TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.previa_folha','view')
      OR public.usuario_tem_permissao(auth.uid(),'rh.holerites','view')));

CREATE POLICY "rh_folha_it_mutate" ON public.rh_folha_itens FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.previa_folha','edit')))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.previa_folha','edit')));

CREATE TRIGGER rh_folha_it_updated_at BEFORE UPDATE ON public.rh_folha_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 11. Holerites ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rh_holerites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id UUID NOT NULL,
  funcionario_id UUID NOT NULL REFERENCES public.rh_funcionarios(id) ON DELETE CASCADE,
  competencia_id UUID REFERENCES public.rh_folha_competencias(id) ON DELETE SET NULL,
  mes SMALLINT NOT NULL,
  ano SMALLINT NOT NULL,
  arquivo_path TEXT NOT NULL,
  arquivo_nome TEXT NOT NULL,
  valor_liquido NUMERIC(14,2),
  gerado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (funcionario_id, ano, mes)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_holerites TO authenticated;
GRANT ALL ON public.rh_holerites TO service_role;
ALTER TABLE public.rh_holerites ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS ix_rh_hol_func ON public.rh_holerites(funcionario_id, ano DESC, mes DESC);

CREATE POLICY "rh_hol_select" ON public.rh_holerites FOR SELECT TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.holerites','view')
      OR public.usuario_tem_permissao(auth.uid(),'rh.funcionarios','view')));

CREATE POLICY "rh_hol_mutate" ON public.rh_holerites FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.holerites','edit')))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.holerites','edit')));

CREATE TRIGGER rh_hol_updated_at BEFORE UPDATE ON public.rh_holerites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 12. Trigger para propagar salário quando uma alteração salarial é criada
CREATE OR REPLACE FUNCTION public.rh_aplicar_alteracao_salarial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.vigencia <= CURRENT_DATE THEN
    UPDATE public.rh_funcionarios
       SET salario_atual = NEW.salario_novo,
           salario_desde = NEW.vigencia,
           updated_at = now()
     WHERE id = NEW.funcionario_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS rh_alt_sal_apply ON public.rh_alteracoes_salariais;
CREATE TRIGGER rh_alt_sal_apply
  AFTER INSERT ON public.rh_alteracoes_salariais
  FOR EACH ROW EXECUTE FUNCTION public.rh_aplicar_alteracao_salarial();
