
-- =========================================================================
-- RH · Fase 1 — Cargos, Departamentos, Funcionários, Dependentes, Histórico
-- =========================================================================

-- 1. Enums --------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.rh_status_funcionario AS ENUM
    ('ativo','experiencia','afastado','ferias','desligado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.rh_tipo_contrato AS ENUM
    ('clt','pj','estagio','autonomo','temporario','aprendiz');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Sequência de numeração --------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.rh_funcionario_seq START 1;

-- 3. Cargos -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rh_cargos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id UUID NOT NULL,
  nome TEXT NOT NULL,
  cbo TEXT,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (correspondente_id, nome)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_cargos TO authenticated;
GRANT ALL ON public.rh_cargos TO service_role;
ALTER TABLE public.rh_cargos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_cargos_select" ON public.rh_cargos FOR SELECT TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
         AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
              OR public.usuario_tem_permissao(auth.uid(),'rh.funcionarios','view')));

CREATE POLICY "rh_cargos_mutate" ON public.rh_cargos FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
         AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
              OR public.usuario_tem_permissao(auth.uid(),'rh.configuracoes','edit')))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid())
         AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
              OR public.usuario_tem_permissao(auth.uid(),'rh.configuracoes','edit')));

CREATE TRIGGER rh_cargos_updated_at BEFORE UPDATE ON public.rh_cargos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Departamentos ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rh_departamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id UUID NOT NULL,
  nome TEXT NOT NULL,
  responsavel_id UUID,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (correspondente_id, nome)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_departamentos TO authenticated;
GRANT ALL ON public.rh_departamentos TO service_role;
ALTER TABLE public.rh_departamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rh_departamentos_select" ON public.rh_departamentos FOR SELECT TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
         AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
              OR public.usuario_tem_permissao(auth.uid(),'rh.funcionarios','view')));

CREATE POLICY "rh_departamentos_mutate" ON public.rh_departamentos FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
         AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
              OR public.usuario_tem_permissao(auth.uid(),'rh.configuracoes','edit')))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid())
         AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
              OR public.usuario_tem_permissao(auth.uid(),'rh.configuracoes','edit')));

CREATE TRIGGER rh_departamentos_updated_at BEFORE UPDATE ON public.rh_departamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Funcionários -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rh_funcionarios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id UUID NOT NULL,
  numero TEXT NOT NULL,
  status public.rh_status_funcionario NOT NULL DEFAULT 'experiencia',

  -- Dados pessoais
  nome TEXT NOT NULL,
  nome_social TEXT,
  cpf TEXT NOT NULL,
  rg TEXT,
  rg_orgao TEXT,
  rg_uf TEXT,
  data_nascimento DATE,
  sexo TEXT,
  estado_civil TEXT,
  nacionalidade TEXT,
  naturalidade TEXT,
  nome_mae TEXT,
  nome_pai TEXT,
  email_pessoal TEXT,
  telefone TEXT,
  foto_url TEXT,

  -- Endereço (denormalizado para simplicidade)
  cep TEXT,
  logradouro TEXT,
  numero_endereco TEXT,
  complemento TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,

  -- Dados profissionais
  cargo_id UUID REFERENCES public.rh_cargos(id) ON DELETE SET NULL,
  departamento_id UUID REFERENCES public.rh_departamentos(id) ON DELETE SET NULL,
  gestor_id UUID,
  tipo_contrato public.rh_tipo_contrato NOT NULL DEFAULT 'clt',
  matricula TEXT,
  ctps_numero TEXT,
  ctps_serie TEXT,
  ctps_uf TEXT,
  pis TEXT,
  data_admissao DATE NOT NULL,
  fim_experiencia DATE,
  data_demissao DATE,
  motivo_demissao TEXT,
  jornada_horas_semanais NUMERIC(5,2),
  jornada_descricao TEXT,
  email_corporativo TEXT,

  -- Salário atual (histórico completo em rh_alteracoes_salariais — Fase 3)
  salario_atual NUMERIC(14,2) NOT NULL DEFAULT 0,
  salario_desde DATE,

  -- Dados bancários
  banco_nome TEXT,
  banco_agencia TEXT,
  banco_conta TEXT,
  banco_tipo_conta TEXT,
  banco_pix TEXT,

  observacoes TEXT,
  criador_id UUID,
  ativo BOOLEAN NOT NULL DEFAULT true,
  deletado_em TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (correspondente_id, numero)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_funcionarios TO authenticated;
GRANT ALL ON public.rh_funcionarios TO service_role;
ALTER TABLE public.rh_funcionarios ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ix_rh_func_corr ON public.rh_funcionarios(correspondente_id);
CREATE INDEX IF NOT EXISTS ix_rh_func_status ON public.rh_funcionarios(correspondente_id, status) WHERE deletado_em IS NULL;
CREATE INDEX IF NOT EXISTS ix_rh_func_cpf ON public.rh_funcionarios(correspondente_id, cpf);
CREATE INDEX IF NOT EXISTS ix_rh_func_dept ON public.rh_funcionarios(departamento_id);

CREATE POLICY "rh_func_select" ON public.rh_funcionarios FOR SELECT TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
         AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
              OR public.usuario_tem_permissao(auth.uid(),'rh.funcionarios','view')));

CREATE POLICY "rh_func_insert" ON public.rh_funcionarios FOR INSERT TO authenticated
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid())
         AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
              OR public.usuario_tem_permissao(auth.uid(),'rh.funcionarios','create')));

CREATE POLICY "rh_func_update" ON public.rh_funcionarios FOR UPDATE TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
         AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
              OR public.usuario_tem_permissao(auth.uid(),'rh.funcionarios','edit')))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()));

CREATE POLICY "rh_func_delete" ON public.rh_funcionarios FOR DELETE TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
         AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
              OR public.usuario_tem_permissao(auth.uid(),'rh.funcionarios','delete')));

-- 6. Dependentes -------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.rh_dependentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id UUID NOT NULL REFERENCES public.rh_funcionarios(id) ON DELETE CASCADE,
  correspondente_id UUID NOT NULL,
  nome TEXT NOT NULL,
  cpf TEXT,
  data_nascimento DATE,
  parentesco TEXT NOT NULL,
  ir BOOLEAN NOT NULL DEFAULT false,
  plano_saude BOOLEAN NOT NULL DEFAULT false,
  salario_familia BOOLEAN NOT NULL DEFAULT false,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_dependentes TO authenticated;
GRANT ALL ON public.rh_dependentes TO service_role;
ALTER TABLE public.rh_dependentes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ix_rh_dep_func ON public.rh_dependentes(funcionario_id);

CREATE POLICY "rh_dep_all" ON public.rh_dependentes FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
         AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
              OR public.usuario_tem_permissao(auth.uid(),'rh.funcionarios','view')))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid())
         AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
              OR public.usuario_tem_permissao(auth.uid(),'rh.funcionarios','edit')));

CREATE TRIGGER rh_dep_updated_at BEFORE UPDATE ON public.rh_dependentes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Histórico do funcionário ------------------------------------------
CREATE TABLE IF NOT EXISTS public.rh_funcionario_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id UUID NOT NULL REFERENCES public.rh_funcionarios(id) ON DELETE CASCADE,
  correspondente_id UUID NOT NULL,
  campo TEXT NOT NULL,
  valor_anterior TEXT,
  valor_novo TEXT,
  ator_id UUID,
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.rh_funcionario_historico TO authenticated;
GRANT ALL ON public.rh_funcionario_historico TO service_role;
ALTER TABLE public.rh_funcionario_historico ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS ix_rh_hist_func ON public.rh_funcionario_historico(funcionario_id, created_at DESC);

CREATE POLICY "rh_hist_select" ON public.rh_funcionario_historico FOR SELECT TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
         AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
              OR public.usuario_tem_permissao(auth.uid(),'rh.funcionarios','view')));

-- Inserção só via trigger (SECURITY DEFINER); bloqueia INSERT direto do cliente.

-- 8. Trigger de numeração + updated_at ---------------------------------
CREATE OR REPLACE FUNCTION public.rh_funcionario_before_write()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $fn$
BEGIN
  IF TG_OP = 'INSERT' AND (NEW.numero IS NULL OR NEW.numero = '') THEN
    NEW.numero := 'FUN-' || lpad(nextval('public.rh_funcionario_seq')::text, 6, '0');
  END IF;
  IF NEW.cpf IS NOT NULL THEN
    NEW.cpf := regexp_replace(NEW.cpf, '\D', '', 'g');
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $fn$;

CREATE TRIGGER rh_funcionario_before_write
  BEFORE INSERT OR UPDATE ON public.rh_funcionarios
  FOR EACH ROW EXECUTE FUNCTION public.rh_funcionario_before_write();

-- 9. Trigger que grava histórico automaticamente -----------------------
CREATE OR REPLACE FUNCTION public.rh_funcionario_log_changes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
DECLARE
  v_ator UUID := auth.uid();
  v_campos TEXT[] := ARRAY[
    'status','nome','cpf','data_nascimento','estado_civil','telefone','email_pessoal',
    'cargo_id','departamento_id','gestor_id','tipo_contrato','data_admissao',
    'fim_experiencia','data_demissao','motivo_demissao','jornada_horas_semanais',
    'salario_atual','salario_desde','banco_nome','banco_agencia','banco_conta','banco_pix',
    'cep','logradouro','numero_endereco','bairro','cidade','uf'
  ];
  v_campo TEXT;
  v_ant TEXT;
  v_nov TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.rh_funcionario_historico
      (funcionario_id, correspondente_id, campo, valor_anterior, valor_novo, ator_id, motivo)
    VALUES (NEW.id, NEW.correspondente_id, '__criacao__', NULL, NEW.numero || ' · ' || NEW.nome, v_ator, 'Admissão');
    RETURN NEW;
  END IF;

  FOREACH v_campo IN ARRAY v_campos LOOP
    EXECUTE format('SELECT ($1).%I::text, ($2).%I::text', v_campo, v_campo)
      INTO v_ant, v_nov USING OLD, NEW;
    IF v_ant IS DISTINCT FROM v_nov THEN
      INSERT INTO public.rh_funcionario_historico
        (funcionario_id, correspondente_id, campo, valor_anterior, valor_novo, ator_id)
      VALUES (NEW.id, NEW.correspondente_id, v_campo, v_ant, v_nov, v_ator);
    END IF;
  END LOOP;
  RETURN NEW;
END; $fn$;

CREATE TRIGGER rh_funcionario_log_changes
  AFTER INSERT OR UPDATE ON public.rh_funcionarios
  FOR EACH ROW EXECUTE FUNCTION public.rh_funcionario_log_changes();
