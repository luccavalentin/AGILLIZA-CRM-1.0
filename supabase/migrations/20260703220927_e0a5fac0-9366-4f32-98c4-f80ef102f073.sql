
-- ===== Enums =====
CREATE TYPE public.proposta_status AS ENUM (
  'rascunho','enviada_banco','em_analise_credito','credito_aprovado','credito_recusado',
  'aguardando_documentos','engenharia_vistoria','analise_juridica','contrato_emitido',
  'registrado','erro_envio','cancelada'
);
CREATE TYPE public.proposta_doc_status AS ENUM ('pendente','enviado','aprovado','reprovado','expirado');

CREATE SEQUENCE public.proposta_numero_seq START 1;

-- ===== propostas =====
CREATE TABLE public.propostas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id UUID NOT NULL,
  numero_proposta TEXT NOT NULL UNIQUE,
  status public.proposta_status NOT NULL DEFAULT 'rascunho',
  simulacao_id UUID REFERENCES public.simulacoes(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  banco_id UUID,
  nome_banco TEXT,
  produto TEXT,
  -- snapshot cliente
  cpf_cnpj TEXT,
  nome_cliente TEXT,
  email TEXT,
  celular TEXT,
  data_nascimento DATE,
  renda_total NUMERIC,
  estado_civil TEXT,
  possui_conjuge BOOLEAN DEFAULT false,
  compoe_renda BOOLEAN DEFAULT false,
  utiliza_fgts BOOLEAN DEFAULT false,
  -- snapshot imóvel/financiamento
  id_operacao_homefin INTEGER,
  tipo_imovel TEXT,
  uso_imovel TEXT,
  situacao_imovel TEXT,
  uf TEXT,
  cep_imovel TEXT,
  endereco_imovel TEXT,
  numero_imovel TEXT,
  complemento_imovel TEXT,
  bairro_imovel TEXT,
  cidade_imovel TEXT,
  valor_imovel NUMERIC,
  valor_financiamento NUMERIC,
  prazo INTEGER,
  sistema_amortizacao TEXT,
  financia_despesas_cartorarias BOOLEAN DEFAULT false,
  -- dados operação
  regional_nome TEXT DEFAULT 'AGILLIZA CRED',
  parceiro_nome TEXT DEFAULT 'AGILLIZA CRED',
  usuario_parceiro_id UUID,
  consultor_nome TEXT,
  analista_nome TEXT,
  -- dados bancários da proposta
  numero_proposta_banco TEXT,
  agencia TEXT,
  conta_corrente TEXT,
  digito_conta TEXT,
  -- IQ
  iq_nome TEXT,
  iq_comentario TEXT,
  -- avaliação/contato imóvel
  contato_avaliacao_nome TEXT,
  contato_avaliacao_telefone TEXT,
  -- HomeFin
  homefin_id_oportunidade TEXT,
  homefin_id_simulacao TEXT,
  codigo_oportunidade_homefin TEXT,
  enviada_em TIMESTAMPTZ,
  contrato_emitido_em TIMESTAMPTZ,
  -- retorno banco
  valor_parcela_aprovado NUMERIC,
  taxa_juros_ano_aprovado NUMERIC,
  prazo_aprovado INTEGER,
  valor_financiamento_aprovado NUMERIC,
  sistema_amortizacao_aprovado TEXT,
  codigo_indexador_aprovado TEXT,
  valor_iof_aprovado NUMERIC,
  -- escopo/pessoas
  usuario_criador_id UUID,
  usuario_responsavel_id UUID,
  analista_id UUID,
  comercial_id UUID,
  parceiro_id UUID,
  -- financeiro
  valor_comissao_calculada NUMERIC,
  comissao_status TEXT,
  regra_comissao_id UUID,
  -- consentimento
  consentimento_lgpd BOOLEAN DEFAULT false,
  consentimento_scr BOOLEAN DEFAULT false,
  ip_consentimento TEXT,
  -- controle
  detalhe_status_atual TEXT,
  motivo_cancelamento TEXT,
  ultimo_erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== proposta_bancos =====
CREATE TABLE public.proposta_bancos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id UUID NOT NULL REFERENCES public.propostas(id) ON DELETE CASCADE,
  banco_id UUID,
  homefin_id_banco INTEGER,
  codigo_banco INTEGER,
  nome_banco TEXT,
  simulacao_banco_id UUID REFERENCES public.simulacao_bancos(id) ON DELETE SET NULL,
  homefin_id_simulacao_banco TEXT,
  selecionado BOOLEAN DEFAULT false,
  numero_proposta_banco TEXT,
  agencia TEXT,
  conta_corrente TEXT,
  digito_conta TEXT,
  status_banco TEXT DEFAULT 'aguardando',
  mensagem_banco TEXT,
  valor_parcela NUMERIC,
  taxa_juros_ano NUMERIC,
  prazo_pagamento_max INTEGER,
  valor_financiamento_max NUMERIC,
  codigo_indexador TEXT,
  valor_iof NUMERIC,
  sistema_amortizacao_banco TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== proposta_documentos =====
CREATE TABLE public.proposta_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id UUID NOT NULL REFERENCES public.propostas(id) ON DELETE CASCADE,
  correspondente_id UUID NOT NULL,
  simulacao_id UUID,
  homefin_id_oportunidade TEXT,
  homefin_id_simulacao TEXT,
  homefin_id_documento TEXT,
  nome_documento TEXT NOT NULL,
  tipo_documento TEXT,
  parte TEXT,
  arquivo_url TEXT,
  storage_path TEXT,
  mime_type TEXT,
  tamanho_bytes BIGINT,
  status public.proposta_doc_status NOT NULL DEFAULT 'pendente',
  situacao_integracao TEXT DEFAULT 'na',
  obrigatorio BOOLEAN DEFAULT false,
  versao INTEGER DEFAULT 1,
  expira_em DATE,
  enviado_em TIMESTAMPTZ,
  enviado_por UUID,
  integrado_em TIMESTAMPTZ,
  erro_integracao TEXT,
  request_payload JSONB,
  response_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== proposta_envolvidos =====
CREATE TABLE public.proposta_envolvidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id UUID NOT NULL REFERENCES public.propostas(id) ON DELETE CASCADE,
  cliente_id UUID,
  homefin_id_participante TEXT,
  tipo_qualificacao TEXT NOT NULL DEFAULT 'CO', -- CO comprador / VD vendedor
  tipo_pessoa TEXT DEFAULT 'F', -- F/J
  nome TEXT,
  cpf_cnpj TEXT,
  data_nascimento DATE,
  nome_mae TEXT,
  tipo_sexo TEXT,
  estado_civil TEXT,
  regime_casamento TEXT,
  tipo_documento_identidade TEXT,
  numero_documento TEXT,
  data_expedicao DATE,
  orgao_expedidor TEXT,
  uf_expedicao TEXT,
  profissao TEXT,
  empresa TEXT,
  renda NUMERIC,
  banco_id_conta INTEGER,
  agencia TEXT,
  conta_corrente TEXT,
  digito_conta TEXT,
  email TEXT,
  celular TEXT,
  cep TEXT,
  logradouro TEXT,
  numero_logradouro TEXT,
  complemento TEXT,
  bairro TEXT,
  municipio TEXT,
  uf TEXT,
  dados JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== proposta_followups =====
CREATE TABLE public.proposta_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id UUID NOT NULL REFERENCES public.propostas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'interno', -- interno/externo
  titulo TEXT,
  comentario TEXT NOT NULL,
  data_previsao DATE,
  responsavel_id UUID,
  autor_id UUID,
  homefin_enviado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== proposta_historico =====
CREATE TABLE public.proposta_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id UUID NOT NULL REFERENCES public.propostas(id) ON DELETE CASCADE,
  tipo_evento TEXT NOT NULL,
  descricao TEXT,
  status_anterior public.proposta_status,
  status_novo public.proposta_status,
  ator_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== proposta_logs_homefin =====
CREATE TABLE public.proposta_logs_homefin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id UUID REFERENCES public.propostas(id) ON DELETE CASCADE,
  correspondente_id UUID,
  endpoint TEXT NOT NULL,
  metodo TEXT NOT NULL,
  status_http INTEGER,
  request_masked JSONB,
  response JSONB,
  erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== proposta_pdfs =====
CREATE TABLE public.proposta_pdfs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id UUID NOT NULL REFERENCES public.propostas(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  gerado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===== GRANTS =====
GRANT SELECT, INSERT, UPDATE, DELETE ON public.propostas TO authenticated;
GRANT ALL ON public.propostas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposta_bancos TO authenticated;
GRANT ALL ON public.proposta_bancos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposta_documentos TO authenticated;
GRANT ALL ON public.proposta_documentos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposta_envolvidos TO authenticated;
GRANT ALL ON public.proposta_envolvidos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposta_followups TO authenticated;
GRANT ALL ON public.proposta_followups TO service_role;
GRANT SELECT, INSERT ON public.proposta_historico TO authenticated;
GRANT ALL ON public.proposta_historico TO service_role;
GRANT SELECT ON public.proposta_logs_homefin TO authenticated;
GRANT ALL ON public.proposta_logs_homefin TO service_role;
GRANT SELECT, INSERT ON public.proposta_pdfs TO authenticated;
GRANT ALL ON public.proposta_pdfs TO service_role;

-- ===== Helper de acesso =====
CREATE OR REPLACE FUNCTION public.usuario_tem_acesso_proposta(_user_id uuid, _prop_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.propostas p
    WHERE p.id = _prop_id
      AND p.correspondente_id = public.correspondente_do_usuario(_user_id)
      AND (
        public.usuario_escopo_dados(_user_id,'operacional.propostas') IN ('todos','equipe')
        OR p.usuario_responsavel_id = _user_id
        OR p.usuario_criador_id = _user_id
      )
  );
$$;

-- ===== RLS =====
ALTER TABLE public.propostas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "propostas_select" ON public.propostas FOR SELECT TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND (public.usuario_escopo_dados(auth.uid(),'operacional.propostas') IN ('todos','equipe')
      OR usuario_responsavel_id = auth.uid() OR usuario_criador_id = auth.uid()));
CREATE POLICY "propostas_insert" ON public.propostas FOR INSERT TO authenticated
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()));
CREATE POLICY "propostas_update" ON public.propostas FOR UPDATE TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()));
CREATE POLICY "propostas_delete" ON public.propostas FOR DELETE TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[]));

ALTER TABLE public.proposta_bancos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proposta_bancos_all" ON public.proposta_bancos FOR ALL TO authenticated
  USING (public.usuario_tem_acesso_proposta(auth.uid(), proposta_id))
  WITH CHECK (public.usuario_tem_acesso_proposta(auth.uid(), proposta_id));

ALTER TABLE public.proposta_documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proposta_documentos_all" ON public.proposta_documentos FOR ALL TO authenticated
  USING (public.usuario_tem_acesso_proposta(auth.uid(), proposta_id))
  WITH CHECK (public.usuario_tem_acesso_proposta(auth.uid(), proposta_id));

ALTER TABLE public.proposta_envolvidos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proposta_envolvidos_all" ON public.proposta_envolvidos FOR ALL TO authenticated
  USING (public.usuario_tem_acesso_proposta(auth.uid(), proposta_id))
  WITH CHECK (public.usuario_tem_acesso_proposta(auth.uid(), proposta_id));

ALTER TABLE public.proposta_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proposta_followups_all" ON public.proposta_followups FOR ALL TO authenticated
  USING (public.usuario_tem_acesso_proposta(auth.uid(), proposta_id))
  WITH CHECK (public.usuario_tem_acesso_proposta(auth.uid(), proposta_id));

ALTER TABLE public.proposta_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proposta_historico_select" ON public.proposta_historico FOR SELECT TO authenticated
  USING (public.usuario_tem_acesso_proposta(auth.uid(), proposta_id));
CREATE POLICY "proposta_historico_insert" ON public.proposta_historico FOR INSERT TO authenticated
  WITH CHECK (public.usuario_tem_acesso_proposta(auth.uid(), proposta_id));

ALTER TABLE public.proposta_logs_homefin ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proposta_logs_select" ON public.proposta_logs_homefin FOR SELECT TO authenticated
  USING (proposta_id IS NOT NULL AND public.usuario_tem_acesso_proposta(auth.uid(), proposta_id));

ALTER TABLE public.proposta_pdfs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proposta_pdfs_all" ON public.proposta_pdfs FOR ALL TO authenticated
  USING (public.usuario_tem_acesso_proposta(auth.uid(), proposta_id))
  WITH CHECK (public.usuario_tem_acesso_proposta(auth.uid(), proposta_id));

-- ===== Triggers =====
CREATE OR REPLACE FUNCTION public.proposta_before_write()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP='INSERT' AND (NEW.numero_proposta IS NULL OR NEW.numero_proposta='') THEN
    NEW.numero_proposta := 'PRO-' || lpad(nextval('public.proposta_numero_seq')::text, 6, '0');
  END IF;
  IF NEW.cpf_cnpj IS NOT NULL THEN NEW.cpf_cnpj := regexp_replace(NEW.cpf_cnpj,'\D','','g'); END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_proposta_before_write BEFORE INSERT OR UPDATE ON public.propostas
  FOR EACH ROW EXECUTE FUNCTION public.proposta_before_write();

CREATE TRIGGER trg_proposta_bancos_updated BEFORE UPDATE ON public.proposta_bancos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_proposta_documentos_updated BEFORE UPDATE ON public.proposta_documentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_proposta_envolvidos_updated BEFORE UPDATE ON public.proposta_envolvidos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.proposta_sincronizar_esteira()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.cliente_id IS NULL THEN RETURN NEW; END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'enviada_banco' THEN
      PERFORM public.cliente_pipeline_avancar_para(NEW.cliente_id, 'banco_remessa_1', 'proposta');
    ELSIF NEW.status = 'aguardando_documentos' THEN
      PERFORM public.cliente_pipeline_avancar_para(NEW.cliente_id, 'banco_remessa_2', 'proposta');
    ELSIF NEW.status = 'engenharia_vistoria' THEN
      PERFORM public.cliente_pipeline_avancar_para(NEW.cliente_id, 'vistoria_agendada', 'proposta');
    ELSIF NEW.status = 'analise_juridica' THEN
      PERFORM public.cliente_pipeline_avancar_para(NEW.cliente_id, 'analise_juridica', 'proposta');
    ELSIF NEW.status = 'contrato_emitido' THEN
      PERFORM public.cliente_pipeline_avancar_para(NEW.cliente_id, 'contrato_emitido', 'proposta');
    END IF;
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_proposta_sincronizar_esteira AFTER UPDATE ON public.propostas
  FOR EACH ROW EXECUTE FUNCTION public.proposta_sincronizar_esteira();

-- realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.propostas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.proposta_bancos;
