-- ========== ENUMS ==========
DO $$ BEGIN
  CREATE TYPE public.financial_status AS ENUM ('aberta','parcial','paga','atrasada','cancelada','estornada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.financial_recorrencia AS ENUM ('nenhuma','mensal','anual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.financial_categoria_tipo AS ENUM ('despesa','receita');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.comissao_status AS ENUM ('a_receber','recebida','paga_parceiro','encerrada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.comissao_regra_tipo AS ENUM ('percentual','fixo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.fluxo_tipo AS ENUM ('entrada','saida');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ========== SEQUENCES ==========
CREATE SEQUENCE IF NOT EXISTS public.financial_payable_seq;
CREATE SEQUENCE IF NOT EXISTS public.financial_receivable_seq;

-- ========== HELPER: quem pode gerenciar finanças ==========
CREATE OR REPLACE FUNCTION public.usuario_pode_financeiro(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.has_any_role(_user_id, ARRAY['admin','correspondente','gestor','financeiro']::public.app_role[]);
$$;

-- ========== TABELAS DE CONFIGURAÇÃO ==========
CREATE TABLE public.financial_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid NOT NULL,
  nome text NOT NULL,
  tipo public.financial_categoria_tipo NOT NULL DEFAULT 'despesa',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_categories TO authenticated;
GRANT ALL ON public.financial_categories TO service_role;
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.financial_cost_centers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid NOT NULL,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_cost_centers TO authenticated;
GRANT ALL ON public.financial_cost_centers TO service_role;
ALTER TABLE public.financial_cost_centers ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.financial_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid NOT NULL,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_payment_methods TO authenticated;
GRANT ALL ON public.financial_payment_methods TO service_role;
ALTER TABLE public.financial_payment_methods ENABLE ROW LEVEL SECURITY;

-- ========== REGRAS DE COMISSÃO ==========
CREATE TABLE public.comissao_regras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid NOT NULL,
  banco_codigo text,
  banco_nome text,
  produto text,
  faixa_min numeric NOT NULL DEFAULT 0,
  faixa_max numeric,
  tipo public.comissao_regra_tipo NOT NULL DEFAULT 'percentual',
  valor numeric NOT NULL DEFAULT 0,
  percentual_parceiro numeric NOT NULL DEFAULT 0,
  percentual_interno numeric NOT NULL DEFAULT 100,
  vigencia_inicio date,
  vigencia_fim date,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comissao_regras TO authenticated;
GRANT ALL ON public.comissao_regras TO service_role;
ALTER TABLE public.comissao_regras ENABLE ROW LEVEL SECURITY;

-- ========== COMISSÕES ==========
CREATE TABLE public.comissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid NOT NULL,
  proposta_id uuid REFERENCES public.propostas(id) ON DELETE SET NULL,
  parceiro_id uuid,
  usuario_responsavel_id uuid,
  banco_codigo text,
  banco_nome text,
  produto text,
  valor_base numeric NOT NULL DEFAULT 0,
  percentual numeric NOT NULL DEFAULT 0,
  valor_bruto numeric NOT NULL DEFAULT 0,
  split_parceiro numeric NOT NULL DEFAULT 0,
  split_interno numeric NOT NULL DEFAULT 0,
  status public.comissao_status NOT NULL DEFAULT 'a_receber',
  regra_id uuid REFERENCES public.comissao_regras(id) ON DELETE SET NULL,
  receivable_id uuid,
  payable_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comissoes TO authenticated;
GRANT ALL ON public.comissoes TO service_role;
ALTER TABLE public.comissoes ENABLE ROW LEVEL SECURITY;

-- ========== CONTAS A PAGAR ==========
CREATE TABLE public.financial_payables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid NOT NULL,
  numero text,
  descricao text NOT NULL,
  fornecedor text,
  parceiro_id uuid,
  categoria_id uuid REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  cost_center_id uuid REFERENCES public.financial_cost_centers(id) ON DELETE SET NULL,
  payment_method_id uuid REFERENCES public.financial_payment_methods(id) ON DELETE SET NULL,
  vencimento date NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  valor_pago numeric NOT NULL DEFAULT 0,
  status public.financial_status NOT NULL DEFAULT 'aberta',
  recorrencia public.financial_recorrencia NOT NULL DEFAULT 'nenhuma',
  recorrencia_ate date,
  recorrencia_origem_id uuid,
  comprovante_path text,
  comissao_id uuid,
  data_pagamento date,
  estornada boolean NOT NULL DEFAULT false,
  estorno_motivo text,
  estorno_de uuid,
  aprovado_por uuid,
  aprovado_em timestamptz,
  criador_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_payables TO authenticated;
GRANT ALL ON public.financial_payables TO service_role;
ALTER TABLE public.financial_payables ENABLE ROW LEVEL SECURITY;

-- ========== CONTAS A RECEBER ==========
CREATE TABLE public.financial_receivables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid NOT NULL,
  numero text,
  descricao text NOT NULL,
  pagador text,
  banco_codigo text,
  banco_nome text,
  proposta_id uuid REFERENCES public.propostas(id) ON DELETE SET NULL,
  categoria_id uuid REFERENCES public.financial_categories(id) ON DELETE SET NULL,
  cost_center_id uuid REFERENCES public.financial_cost_centers(id) ON DELETE SET NULL,
  payment_method_id uuid REFERENCES public.financial_payment_methods(id) ON DELETE SET NULL,
  vencimento date NOT NULL,
  valor numeric NOT NULL DEFAULT 0,
  valor_pago numeric NOT NULL DEFAULT 0,
  status public.financial_status NOT NULL DEFAULT 'aberta',
  recorrencia public.financial_recorrencia NOT NULL DEFAULT 'nenhuma',
  recorrencia_ate date,
  recorrencia_origem_id uuid,
  comprovante_path text,
  comissao_id uuid,
  data_pagamento date,
  estornada boolean NOT NULL DEFAULT false,
  estorno_motivo text,
  estorno_de uuid,
  aprovado_por uuid,
  aprovado_em timestamptz,
  criador_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_receivables TO authenticated;
GRANT ALL ON public.financial_receivables TO service_role;
ALTER TABLE public.financial_receivables ENABLE ROW LEVEL SECURITY;

-- ========== HISTÓRICO DE EVENTOS ==========
CREATE TABLE public.financial_payable_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid NOT NULL,
  entidade text NOT NULL DEFAULT 'payable',
  entidade_id uuid NOT NULL,
  evento text NOT NULL,
  descricao text,
  valor numeric,
  ator_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_payable_history TO authenticated;
GRANT ALL ON public.financial_payable_history TO service_role;
ALTER TABLE public.financial_payable_history ENABLE ROW LEVEL SECURITY;

-- ========== LOGS DE AUDITORIA ==========
CREATE TABLE public.financial_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid NOT NULL,
  entidade text NOT NULL,
  entidade_id uuid,
  acao text NOT NULL,
  ator_id uuid,
  dados jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_audit_logs TO authenticated;
GRANT ALL ON public.financial_audit_logs TO service_role;
ALTER TABLE public.financial_audit_logs ENABLE ROW LEVEL SECURITY;

-- ========== FLUXO DE CAIXA ==========
CREATE TABLE public.fluxo_caixa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid NOT NULL,
  data date NOT NULL,
  tipo public.fluxo_tipo NOT NULL,
  origem text,
  ref_id uuid,
  descricao text,
  valor numeric NOT NULL DEFAULT 0,
  realizado boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fluxo_caixa TO authenticated;
GRANT ALL ON public.fluxo_caixa TO service_role;
ALTER TABLE public.fluxo_caixa ENABLE ROW LEVEL SECURITY;

-- ========== POLICIES ==========
-- Config tables: financeiro-privileged full access no correspondente
CREATE POLICY fin_cat_all ON public.financial_categories FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.usuario_pode_financeiro(auth.uid()))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.usuario_pode_financeiro(auth.uid()));
CREATE POLICY fin_cc_all ON public.financial_cost_centers FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.usuario_pode_financeiro(auth.uid()))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.usuario_pode_financeiro(auth.uid()));
CREATE POLICY fin_pm_all ON public.financial_payment_methods FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.usuario_pode_financeiro(auth.uid()))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.usuario_pode_financeiro(auth.uid()));
CREATE POLICY fin_regras_all ON public.comissao_regras FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.usuario_pode_financeiro(auth.uid()))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.usuario_pode_financeiro(auth.uid()));
CREATE POLICY fin_pay_all ON public.financial_payables FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.usuario_pode_financeiro(auth.uid()))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.usuario_pode_financeiro(auth.uid()));
CREATE POLICY fin_rec_all ON public.financial_receivables FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.usuario_pode_financeiro(auth.uid()))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.usuario_pode_financeiro(auth.uid()));
CREATE POLICY fin_hist_all ON public.financial_payable_history FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.usuario_pode_financeiro(auth.uid()))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.usuario_pode_financeiro(auth.uid()));
CREATE POLICY fin_audit_sel ON public.financial_audit_logs FOR SELECT TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.usuario_pode_financeiro(auth.uid()));
CREATE POLICY fin_audit_ins ON public.financial_audit_logs FOR INSERT TO authenticated
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()));
CREATE POLICY fin_fluxo_all ON public.fluxo_caixa FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.usuario_pode_financeiro(auth.uid()))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.usuario_pode_financeiro(auth.uid()));

-- Comissões: privilegiados veem tudo; demais só as próprias (responsável)
CREATE POLICY fin_comissoes_sel ON public.comissoes FOR SELECT TO authenticated
  USING (
    correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.usuario_pode_financeiro(auth.uid()) OR usuario_responsavel_id = auth.uid())
  );
CREATE POLICY fin_comissoes_mod ON public.comissoes FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.usuario_pode_financeiro(auth.uid()))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()) AND public.usuario_pode_financeiro(auth.uid()));

-- ========== TRIGGERS updated_at ==========
CREATE TRIGGER trg_fin_cat_upd BEFORE UPDATE ON public.financial_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fin_cc_upd BEFORE UPDATE ON public.financial_cost_centers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fin_pm_upd BEFORE UPDATE ON public.financial_payment_methods FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fin_regras_upd BEFORE UPDATE ON public.comissao_regras FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fin_comissoes_upd BEFORE UPDATE ON public.comissoes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fin_pay_upd BEFORE UPDATE ON public.financial_payables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fin_rec_upd BEFORE UPDATE ON public.financial_receivables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========== NUMERAÇÃO ==========
CREATE OR REPLACE FUNCTION public.financial_payable_before_write()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' AND (NEW.numero IS NULL OR NEW.numero='') THEN
    NEW.numero := 'CP-' || lpad(nextval('public.financial_payable_seq')::text, 6, '0');
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_fin_pay_num BEFORE INSERT ON public.financial_payables FOR EACH ROW EXECUTE FUNCTION public.financial_payable_before_write();

CREATE OR REPLACE FUNCTION public.financial_receivable_before_write()
RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' AND (NEW.numero IS NULL OR NEW.numero='') THEN
    NEW.numero := 'CR-' || lpad(nextval('public.financial_receivable_seq')::text, 6, '0');
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_fin_rec_num BEFORE INSERT ON public.financial_receivables FOR EACH ROW EXECUTE FUNCTION public.financial_receivable_before_write();

-- ========== CÁLCULO DE COMISSÃO ==========
CREATE OR REPLACE FUNCTION public.calcular_comissao_proposta(_prop_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  p RECORD;
  r RECORD;
  v_base numeric;
  v_bruto numeric;
  v_split_parc numeric;
  v_split_int numeric;
  v_pct numeric;
  v_com_id uuid;
  v_rec_id uuid;
  v_pay_id uuid;
BEGIN
  SELECT * INTO p FROM public.propostas WHERE id = _prop_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- evita duplicidade
  SELECT id INTO v_com_id FROM public.comissoes WHERE proposta_id = _prop_id LIMIT 1;
  IF v_com_id IS NOT NULL THEN RETURN v_com_id; END IF;

  v_base := COALESCE(p.valor_financiamento, 0);

  SELECT * INTO r FROM public.comissao_regras cr
  WHERE cr.correspondente_id = p.correspondente_id
    AND cr.ativo = true
    AND (cr.produto IS NULL OR cr.produto = p.produto)
    AND (cr.banco_nome IS NULL OR cr.banco_nome = p.nome_banco)
    AND cr.faixa_min <= v_base
    AND (cr.faixa_max IS NULL OR cr.faixa_max >= v_base)
    AND (cr.vigencia_inicio IS NULL OR cr.vigencia_inicio <= CURRENT_DATE)
    AND (cr.vigencia_fim IS NULL OR cr.vigencia_fim >= CURRENT_DATE)
  ORDER BY (cr.produto IS NOT NULL) DESC, (cr.banco_nome IS NOT NULL) DESC, cr.faixa_min DESC
  LIMIT 1;

  IF FOUND THEN
    IF r.tipo = 'percentual' THEN
      v_pct := r.valor;
      v_bruto := round(v_base * r.valor / 100.0, 2);
    ELSE
      v_pct := CASE WHEN v_base > 0 THEN round(r.valor / v_base * 100.0, 4) ELSE 0 END;
      v_bruto := r.valor;
    END IF;
    v_split_parc := round(v_bruto * COALESCE(r.percentual_parceiro,0) / 100.0, 2);
    v_split_int := v_bruto - v_split_parc;
  ELSE
    v_pct := 0; v_bruto := 0; v_split_parc := 0; v_split_int := 0;
  END IF;

  INSERT INTO public.comissoes (
    correspondente_id, proposta_id, parceiro_id, usuario_responsavel_id,
    banco_codigo, banco_nome, produto, valor_base, percentual, valor_bruto,
    split_parceiro, split_interno, status, regra_id
  ) VALUES (
    p.correspondente_id, _prop_id, p.parceiro_id, p.usuario_responsavel_id,
    NULL, p.nome_banco, p.produto, v_base, v_pct, v_bruto,
    v_split_parc, v_split_int, 'a_receber', (CASE WHEN r.id IS NOT NULL THEN r.id ELSE NULL END)
  ) RETURNING id INTO v_com_id;

  -- Conta a receber (banco -> correspondente): valor bruto
  INSERT INTO public.financial_receivables (
    correspondente_id, descricao, pagador, banco_nome, proposta_id,
    vencimento, valor, status, comissao_id, criador_id
  ) VALUES (
    p.correspondente_id, 'Comissão proposta ' || COALESCE(p.numero_proposta,''), p.nome_banco, p.nome_banco, _prop_id,
    CURRENT_DATE + 30, v_bruto, 'aberta', v_com_id, p.usuario_responsavel_id
  ) RETURNING id INTO v_rec_id;

  -- Conta a pagar ao parceiro (split parceiro), se houver
  IF v_split_parc > 0 AND p.parceiro_id IS NOT NULL THEN
    INSERT INTO public.financial_payables (
      correspondente_id, descricao, parceiro_id, vencimento, valor, status, comissao_id, criador_id
    ) VALUES (
      p.correspondente_id, 'Repasse comissão proposta ' || COALESCE(p.numero_proposta,''), p.parceiro_id,
      CURRENT_DATE + 35, v_split_parc, 'aberta', v_com_id, p.usuario_responsavel_id
    ) RETURNING id INTO v_pay_id;
  END IF;

  UPDATE public.comissoes SET receivable_id = v_rec_id, payable_id = v_pay_id WHERE id = v_com_id;

  INSERT INTO public.financial_audit_logs (correspondente_id, entidade, entidade_id, acao, dados)
  VALUES (p.correspondente_id, 'comissao', v_com_id, 'calculada',
          jsonb_build_object('valor_bruto', v_bruto, 'split_parceiro', v_split_parc, 'split_interno', v_split_int));

  RETURN v_com_id;
END;$$;

-- ========== TRIGGER on contrato_emitido ==========
CREATE OR REPLACE FUNCTION public.on_proposta_contrato_emitido()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.status = 'contrato_emitido' AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.calcular_comissao_proposta(NEW.id);
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_proposta_contrato_emitido AFTER UPDATE ON public.propostas FOR EACH ROW EXECUTE FUNCTION public.on_proposta_contrato_emitido();

-- ========== REALTIME ==========
ALTER PUBLICATION supabase_realtime ADD TABLE public.financial_payables;
ALTER PUBLICATION supabase_realtime ADD TABLE public.financial_receivables;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comissoes;