ALTER VIEW public.vw_bancos_ativos SET (security_invoker = on);

CREATE TABLE public.simulacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id UUID NOT NULL,
  numero_simulacao TEXT NOT NULL UNIQUE,
  tipo_simulacao public.simulacao_tipo NOT NULL DEFAULT 'completa',
  status public.simulacao_status NOT NULL DEFAULT 'rascunho',
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  cpf_cnpj TEXT, nome_cliente TEXT, email TEXT, celular TEXT,
  data_nascimento DATE, renda_total NUMERIC(15,2), estado_civil TEXT,
  possui_conjuge BOOLEAN NOT NULL DEFAULT false,
  compoe_renda BOOLEAN NOT NULL DEFAULT false,
  nome_conjuge TEXT, cpf_conjuge TEXT, data_nascimento_conjuge DATE,
  email_conjuge TEXT, celular_conjuge TEXT, renda_conjuge NUMERIC(15,2),
  estado_civil_conjuge TEXT, regime_casamento TEXT,
  produto TEXT, id_operacao_homefin INTEGER,
  tipo_imovel TEXT, uso_imovel TEXT, situacao_imovel TEXT, uf TEXT, cep_imovel TEXT,
  valor_imovel NUMERIC(15,2), valor_entrada NUMERIC(15,2), valor_financiamento NUMERIC(15,2),
  prazo INTEGER, prazo_anos INTEGER, possui_imovel_escolhido BOOLEAN,
  utiliza_fgts TEXT, fg_financiar_despesas BOOLEAN DEFAULT false,
  percentual_despesas NUMERIC(6,2), sistema_amortizacao TEXT,
  email_verificado_em TIMESTAMPTZ, email_verificado_por TEXT,
  consentimento_lgpd BOOLEAN NOT NULL DEFAULT false,
  consentimento_scr BOOLEAN NOT NULL DEFAULT false,
  consentimento_ip TEXT, consentimento_em TIMESTAMPTZ,
  homefin_id_oportunidade TEXT, codigo_oportunidade_homefin TEXT,
  ultimo_envio_em TIMESTAMPTZ, ultimo_erro TEXT,
  usuario_criador_id UUID NOT NULL,
  usuario_responsavel_id UUID, analista_id UUID, comercial_id UUID, parceiro_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX simulacoes_correspondente_idx ON public.simulacoes (correspondente_id);
CREATE INDEX simulacoes_cliente_idx ON public.simulacoes (cliente_id);
CREATE INDEX simulacoes_status_idx ON public.simulacoes (status);
CREATE INDEX simulacoes_criador_idx ON public.simulacoes (usuario_criador_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulacoes TO authenticated;
GRANT ALL ON public.simulacoes TO service_role;

CREATE OR REPLACE FUNCTION public.usuario_tem_acesso_simulacao(_user_id uuid, _sim_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.simulacoes s
    WHERE s.id = _sim_id
      AND s.correspondente_id = public.correspondente_do_usuario(_user_id)
      AND (
        public.usuario_escopo_dados(_user_id,'operacional.simulacoes') IN ('todos','equipe')
        OR s.usuario_responsavel_id = _user_id
        OR s.usuario_criador_id = _user_id
      )
  );
$$;

ALTER TABLE public.simulacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver simulacoes por escopo" ON public.simulacoes
  FOR SELECT TO authenticated USING (
    correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (
      public.usuario_escopo_dados(auth.uid(),'operacional.simulacoes') IN ('todos','equipe')
      OR usuario_responsavel_id = auth.uid()
      OR usuario_criador_id = auth.uid()
    )
  );
CREATE POLICY "Criar simulacoes no proprio correspondente" ON public.simulacoes
  FOR INSERT TO authenticated WITH CHECK (
    correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND usuario_criador_id = auth.uid()
  );
CREATE POLICY "Atualizar simulacoes com acesso" ON public.simulacoes
  FOR UPDATE TO authenticated USING (public.usuario_tem_acesso_simulacao(auth.uid(), id));
CREATE POLICY "Excluir simulacoes admin" ON public.simulacoes
  FOR DELETE TO authenticated USING (
    correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
  );

CREATE OR REPLACE FUNCTION public.simulacao_before_write()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP='INSERT' AND (NEW.numero_simulacao IS NULL OR NEW.numero_simulacao='') THEN
    NEW.numero_simulacao := 'SIM-' || lpad(nextval('public.simulacao_numero_seq')::text, 6, '0');
  END IF;
  IF NEW.cpf_cnpj IS NOT NULL THEN NEW.cpf_cnpj := regexp_replace(NEW.cpf_cnpj,'\D','','g'); END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;$$;
CREATE TRIGGER simulacao_before_write_trg BEFORE INSERT OR UPDATE ON public.simulacoes
  FOR EACH ROW EXECUTE FUNCTION public.simulacao_before_write();