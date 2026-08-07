
-- 1. Novos campos em rh_funcionarios
ALTER TABLE public.rh_funcionarios
  ADD COLUMN IF NOT EXISTS dia_pagamento_salario int DEFAULT 5 CHECK (dia_pagamento_salario BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS dia_pagamento_adiantamento int CHECK (dia_pagamento_adiantamento BETWEEN 1 AND 31),
  ADD COLUMN IF NOT EXISTS gerar_contas_pagar_automatico boolean NOT NULL DEFAULT false;

-- 2. Novos campos em financial_payables para idempotência
ALTER TABLE public.financial_payables
  ADD COLUMN IF NOT EXISTS origem_tipo text,
  ADD COLUMN IF NOT EXISTS origem_ref text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_payables_origem
  ON public.financial_payables (correspondente_id, origem_tipo, origem_ref)
  WHERE origem_tipo IS NOT NULL AND origem_ref IS NOT NULL;

-- 3. Checklist de documentos CLT
CREATE TABLE IF NOT EXISTS public.rh_documentos_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid NOT NULL,
  funcionario_id uuid NOT NULL REFERENCES public.rh_funcionarios(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  rotulo text NOT NULL,
  obrigatorio boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','entregue','vencido','nao_aplicavel')),
  documento_id uuid REFERENCES public.rh_documentos(id) ON DELETE SET NULL,
  validade date,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (funcionario_id, tipo)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_documentos_checklist TO authenticated;
GRANT ALL ON public.rh_documentos_checklist TO service_role;

ALTER TABLE public.rh_documentos_checklist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_checklist_tenant" ON public.rh_documentos_checklist
  FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()));

CREATE TRIGGER trg_rh_checklist_updated_at
  BEFORE UPDATE ON public.rh_documentos_checklist
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Semear checklist CLT
CREATE OR REPLACE FUNCTION public.rh_semear_checklist_clt(_func_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_corr uuid;
  v_sexo text;
  itens text[][] := ARRAY[
    ARRAY['rg','RG ou CNH','true'],
    ARRAY['cpf','CPF','true'],
    ARRAY['ctps','CTPS (Carteira de Trabalho)','true'],
    ARRAY['pis','PIS/PASEP','true'],
    ARRAY['titulo_eleitor','Título de eleitor','true'],
    ARRAY['comprovante_residencia','Comprovante de residência','true'],
    ARRAY['certidao_nasc_casamento','Certidão de nascimento ou casamento','true'],
    ARRAY['foto_3x4','Foto 3x4','true'],
    ARRAY['aso_admissional','Exame admissional (ASO)','true'],
    ARRAY['contrato_trabalho','Contrato de trabalho','true'],
    ARRAY['termo_experiencia','Termo de experiência','true'],
    ARRAY['vale_transporte','Opção / termo de vale-transporte','false'],
    ARRAY['ficha_dependentes','Ficha de dependentes','false'],
    ARRAY['reservista','Certificado de reservista','false']
  ];
  it text[];
BEGIN
  SELECT correspondente_id, sexo INTO v_corr, v_sexo FROM public.rh_funcionarios WHERE id = _func_id;
  IF v_corr IS NULL THEN RETURN; END IF;

  FOREACH it SLICE 1 IN ARRAY itens LOOP
    -- reservista só para masculino
    IF it[1] = 'reservista' AND (v_sexo IS NULL OR upper(v_sexo) NOT IN ('M','MASCULINO')) THEN
      CONTINUE;
    END IF;
    INSERT INTO public.rh_documentos_checklist (correspondente_id, funcionario_id, tipo, rotulo, obrigatorio)
    VALUES (v_corr, _func_id, it[1], it[2], it[3]::boolean)
    ON CONFLICT (funcionario_id, tipo) DO NOTHING;
  END LOOP;
END;
$$;

-- 5. Trigger AFTER INSERT em rh_funcionarios: fim_experiencia + checklist + período aquisitivo
CREATE OR REPLACE FUNCTION public.rh_funcionario_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.fim_experiencia IS NULL AND NEW.data_admissao IS NOT NULL THEN
    NEW.fim_experiencia := NEW.data_admissao + INTERVAL '90 days';
  END IF;
  IF NEW.status IS NULL OR NEW.status::text = '' THEN
    NEW.status := 'experiencia';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rh_func_before_insert ON public.rh_funcionarios;
CREATE TRIGGER trg_rh_func_before_insert
  BEFORE INSERT ON public.rh_funcionarios
  FOR EACH ROW EXECUTE FUNCTION public.rh_funcionario_before_insert();

CREATE OR REPLACE FUNCTION public.rh_funcionario_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.rh_semear_checklist_clt(NEW.id);
  -- Período aquisitivo inicial
  INSERT INTO public.rh_ferias (correspondente_id, funcionario_id, periodo_aquisitivo_inicio, periodo_aquisitivo_fim, status)
  VALUES (NEW.correspondente_id, NEW.id, NEW.data_admissao, NEW.data_admissao + INTERVAL '1 year' - INTERVAL '1 day', 'programada')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rh_func_after_insert ON public.rh_funcionarios;
CREATE TRIGGER trg_rh_func_after_insert
  AFTER INSERT ON public.rh_funcionarios
  FOR EACH ROW EXECUTE FUNCTION public.rh_funcionario_after_insert();

-- 6. Atualização diária do status por experiência
CREATE OR REPLACE FUNCTION public.rh_atualizar_status_experiencia()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int := 0;
BEGIN
  UPDATE public.rh_funcionarios
     SET status = 'ativo'
   WHERE status = 'experiencia'
     AND fim_experiencia IS NOT NULL
     AND fim_experiencia < CURRENT_DATE
     AND data_demissao IS NULL
     AND deletado_em IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- 7. Sincronizar checklist quando um documento rh_documentos é adicionado com "tipo" batendo
CREATE OR REPLACE FUNCTION public.rh_documento_sync_checklist()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.rh_documentos_checklist
     SET status = 'entregue',
         documento_id = NEW.id,
         validade = COALESCE(NEW.validade, validade),
         updated_at = now()
   WHERE funcionario_id = NEW.funcionario_id
     AND tipo = NEW.tipo;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rh_doc_sync_checklist ON public.rh_documentos;
CREATE TRIGGER trg_rh_doc_sync_checklist
  AFTER INSERT ON public.rh_documentos
  FOR EACH ROW EXECUTE FUNCTION public.rh_documento_sync_checklist();

-- 8. Backfill: para funcionários existentes, semear checklist e período aquisitivo se ausentes
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id, correspondente_id, data_admissao FROM public.rh_funcionarios WHERE deletado_em IS NULL LOOP
    PERFORM public.rh_semear_checklist_clt(r.id);
    INSERT INTO public.rh_ferias (correspondente_id, funcionario_id, periodo_aquisitivo_inicio, periodo_aquisitivo_fim, status)
    SELECT r.correspondente_id, r.id, r.data_admissao, r.data_admissao + INTERVAL '1 year' - INTERVAL '1 day', 'programada'
    WHERE NOT EXISTS (SELECT 1 FROM public.rh_ferias f WHERE f.funcionario_id = r.id);
  END LOOP;
END $$;
