CREATE TYPE public.tipo_pessoa AS ENUM ('PF','PJ');
CREATE TYPE public.cliente_estado_civil AS ENUM ('solteiro','casado','uniao_estavel','divorciado','viuvo');
CREATE TYPE public.regime_casamento AS ENUM ('comunhao_parcial','comunhao_universal','separacao_total','participacao_final','nao_aplicavel');
CREATE TYPE public.cliente_origem AS ENUM ('direto','parceiro','indicacao','importacao');
CREATE TYPE public.doc_categoria AS ENUM ('comprador','conjuge','vendedor','imovel','outros');
CREATE TYPE public.doc_status AS ENUM ('pendente','recebido','aprovado','reprovado','expirado');
CREATE TYPE public.interacao_canal AS ENUM ('ligacao','whatsapp','email','reuniao','presencial','followup','outro');

CREATE SEQUENCE public.cliente_numero_seq START 1;

CREATE TABLE public.pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ordem INT NOT NULL UNIQUE,
  codigo TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  mensagem_cliente TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pipeline_stages TO authenticated, anon;
GRANT ALL ON public.pipeline_stages TO service_role;
ALTER TABLE public.pipeline_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Etapas visiveis a autenticados" ON public.pipeline_stages FOR SELECT TO authenticated USING (true);

INSERT INTO public.pipeline_stages (ordem, codigo, nome, mensagem_cliente) VALUES
(1,'cadastro_basico','Cadastro Básico','Seu cadastro inicial foi recebido. Em breve daremos continuidade.'),
(2,'simulacao','Simulação','Estamos realizando/atualizando sua simulação de crédito.'),
(3,'aprovacao','Aprovação','Sua proposta está em análise para aprovação.'),
(4,'cadastro_completo','Cadastro Completo','Seu cadastro foi atualizado e está completo.'),
(5,'documentacao_completa','Documentação Completa','Sua documentação foi recebida e está completa.'),
(6,'formularios_1','Formulários — 1ª fase','Iniciamos a primeira fase de formulários.'),
(7,'formularios_2','Formulários — 2ª fase','A segunda fase de formulários está em andamento.'),
(8,'banco_remessa_1','Enviado ao Banco — 1ª remessa','Documentação enviada ao banco (1ª remessa).'),
(9,'banco_remessa_2','Enviado ao Banco — 2ª remessa','Nova remessa enviada com informações complementares.'),
(10,'vistoria_agendada','Vistoria Agendada','A vistoria do imóvel foi agendada.'),
(11,'analise_juridica','Análise Jurídica','Seu processo está em análise jurídica.'),
(12,'contrato_emitido','Contrato Emitido','Contrato emitido.');

CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id UUID NOT NULL,
  numero_cliente TEXT NOT NULL UNIQUE,
  tipo_pessoa public.tipo_pessoa NOT NULL DEFAULT 'PF',
  nome TEXT NOT NULL,
  documento TEXT NOT NULL,
  documento_secundario TEXT,
  data_nascimento DATE,
  estado_civil public.cliente_estado_civil,
  regime_casamento public.regime_casamento,
  mae TEXT,
  email TEXT,
  telefone_celular TEXT,
  renda_total_declarada NUMERIC(14,2),
  uf_interesse CHAR(2),
  foto_url TEXT,
  origem public.cliente_origem NOT NULL DEFAULT 'direto',
  responsavel_id UUID REFERENCES public.profiles(id),
  criador_id UUID REFERENCES public.profiles(id),
  portal_acesso_ativo BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX clientes_doc_unico ON public.clientes (correspondente_id, tipo_pessoa, documento) WHERE ativo;
CREATE INDEX clientes_responsavel_idx ON public.clientes (responsavel_id);
CREATE INDEX clientes_correspondente_idx ON public.clientes (correspondente_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.cliente_enderecos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  cep TEXT, logradouro TEXT, numero TEXT, complemento TEXT, bairro TEXT, cidade TEXT, uf CHAR(2),
  principal BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX cliente_enderecos_cliente_idx ON public.cliente_enderecos (cliente_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_enderecos TO authenticated;
GRANT ALL ON public.cliente_enderecos TO service_role;
ALTER TABLE public.cliente_enderecos ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.cliente_imoveis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo TEXT, uso TEXT, logradouro TEXT, cidade TEXT, uf CHAR(2), valor NUMERIC(14,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX cliente_imoveis_cliente_idx ON public.cliente_imoveis (cliente_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_imoveis TO authenticated;
GRANT ALL ON public.cliente_imoveis TO service_role;
ALTER TABLE public.cliente_imoveis ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.cliente_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  categoria public.doc_categoria NOT NULL DEFAULT 'outros',
  tipo_documento TEXT NOT NULL,
  nome_arquivo TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  tamanho_bytes BIGINT,
  versao INT NOT NULL DEFAULT 1,
  status public.doc_status NOT NULL DEFAULT 'recebido',
  expira_em DATE,
  aprovado_por UUID REFERENCES public.profiles(id),
  aprovado_em TIMESTAMPTZ,
  enviado_por UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX cliente_documentos_cliente_idx ON public.cliente_documentos (cliente_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_documentos TO authenticated;
GRANT ALL ON public.cliente_documentos TO service_role;
ALTER TABLE public.cliente_documentos ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.cliente_interacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  canal public.interacao_canal NOT NULL,
  ocorrido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  responsavel_id UUID REFERENCES public.profiles(id),
  resultado TEXT,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX cliente_interacoes_cliente_idx ON public.cliente_interacoes (cliente_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_interacoes TO authenticated;
GRANT ALL ON public.cliente_interacoes TO service_role;
ALTER TABLE public.cliente_interacoes ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.cliente_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  ator_id UUID,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX cliente_historico_cliente_idx ON public.cliente_historico (cliente_id, created_at DESC);
GRANT SELECT, INSERT ON public.cliente_historico TO authenticated;
GRANT ALL ON public.cliente_historico TO service_role;
ALTER TABLE public.cliente_historico ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.cliente_portal_acessos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL UNIQUE REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo_pessoa public.tipo_pessoa NOT NULL,
  documento_hash TEXT NOT NULL,
  data_referencia DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  habilitado_por UUID,
  habilitado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  revogado_por UUID,
  revogado_em TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_portal_acessos TO authenticated;
GRANT ALL ON public.cliente_portal_acessos TO service_role;
ALTER TABLE public.cliente_portal_acessos ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.cliente_pipeline (
  cliente_id UUID PRIMARY KEY REFERENCES public.clientes(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES public.pipeline_stages(id),
  ultima_atualizacao_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_pipeline TO authenticated;
GRANT ALL ON public.cliente_pipeline TO service_role;
ALTER TABLE public.cliente_pipeline ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.cliente_pipeline_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  stage_id UUID NOT NULL REFERENCES public.pipeline_stages(id),
  acao TEXT,
  observacao TEXT,
  mensagem_cliente TEXT,
  enviar_ao_cliente BOOLEAN NOT NULL DEFAULT true,
  ator_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX cliente_pipeline_hist_cliente_idx ON public.cliente_pipeline_historico (cliente_id, created_at DESC);
GRANT SELECT, INSERT ON public.cliente_pipeline_historico TO authenticated;
GRANT ALL ON public.cliente_pipeline_historico TO service_role;
ALTER TABLE public.cliente_pipeline_historico ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.usuario_tem_acesso_cliente(_user_id UUID, _cliente_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = _cliente_id
      AND c.correspondente_id = public.correspondente_do_usuario(_user_id)
      AND (
        public.usuario_escopo_dados(_user_id, 'crm.clientes') IN ('todos','equipe')
        OR c.responsavel_id = _user_id
        OR c.criador_id = _user_id
      )
  );
$$;

CREATE POLICY "Ver clientes conforme escopo" ON public.clientes FOR SELECT TO authenticated
USING (
  correspondente_id = public.correspondente_do_usuario(auth.uid())
  AND (
    public.usuario_escopo_dados(auth.uid(), 'crm.clientes') IN ('todos','equipe')
    OR responsavel_id = auth.uid()
    OR criador_id = auth.uid()
  )
);
CREATE POLICY "Criar cliente no ecossistema" ON public.clientes FOR INSERT TO authenticated
WITH CHECK (
  correspondente_id = public.correspondente_do_usuario(auth.uid())
  AND public.usuario_tem_permissao(auth.uid(), 'crm.clientes', 'create')
);
CREATE POLICY "Editar cliente com acesso" ON public.clientes FOR UPDATE TO authenticated
USING (public.usuario_tem_acesso_cliente(auth.uid(), id))
WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()));
CREATE POLICY "Excluir cliente admin" ON public.clientes FOR DELETE TO authenticated
USING (
  correspondente_id = public.correspondente_do_usuario(auth.uid())
  AND public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
);

CREATE POLICY "Enderecos por acesso" ON public.cliente_enderecos FOR ALL TO authenticated
USING (public.usuario_tem_acesso_cliente(auth.uid(), cliente_id))
WITH CHECK (public.usuario_tem_acesso_cliente(auth.uid(), cliente_id));
CREATE POLICY "Imoveis por acesso" ON public.cliente_imoveis FOR ALL TO authenticated
USING (public.usuario_tem_acesso_cliente(auth.uid(), cliente_id))
WITH CHECK (public.usuario_tem_acesso_cliente(auth.uid(), cliente_id));
CREATE POLICY "Documentos por acesso" ON public.cliente_documentos FOR ALL TO authenticated
USING (public.usuario_tem_acesso_cliente(auth.uid(), cliente_id))
WITH CHECK (public.usuario_tem_acesso_cliente(auth.uid(), cliente_id));
CREATE POLICY "Interacoes por acesso" ON public.cliente_interacoes FOR ALL TO authenticated
USING (public.usuario_tem_acesso_cliente(auth.uid(), cliente_id))
WITH CHECK (public.usuario_tem_acesso_cliente(auth.uid(), cliente_id));
CREATE POLICY "Historico ver por acesso" ON public.cliente_historico FOR SELECT TO authenticated
USING (public.usuario_tem_acesso_cliente(auth.uid(), cliente_id));
CREATE POLICY "Historico inserir por acesso" ON public.cliente_historico FOR INSERT TO authenticated
WITH CHECK (public.usuario_tem_acesso_cliente(auth.uid(), cliente_id));
CREATE POLICY "Portal acessos por acesso" ON public.cliente_portal_acessos FOR ALL TO authenticated
USING (public.usuario_tem_acesso_cliente(auth.uid(), cliente_id))
WITH CHECK (public.usuario_tem_acesso_cliente(auth.uid(), cliente_id));
CREATE POLICY "Pipeline ver por acesso" ON public.cliente_pipeline FOR SELECT TO authenticated
USING (public.usuario_tem_acesso_cliente(auth.uid(), cliente_id));
CREATE POLICY "Pipeline alterar por acesso" ON public.cliente_pipeline FOR ALL TO authenticated
USING (public.usuario_tem_acesso_cliente(auth.uid(), cliente_id))
WITH CHECK (public.usuario_tem_acesso_cliente(auth.uid(), cliente_id));
CREATE POLICY "Pipeline hist ver por acesso" ON public.cliente_pipeline_historico FOR SELECT TO authenticated
USING (public.usuario_tem_acesso_cliente(auth.uid(), cliente_id));
CREATE POLICY "Pipeline hist inserir por acesso" ON public.cliente_pipeline_historico FOR INSERT TO authenticated
WITH CHECK (public.usuario_tem_acesso_cliente(auth.uid(), cliente_id));

CREATE TRIGGER trg_clientes_updated BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cli_end_updated BEFORE UPDATE ON public.cliente_enderecos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cli_imv_updated BEFORE UPDATE ON public.cliente_imoveis FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cli_doc_updated BEFORE UPDATE ON public.cliente_documentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.crm_normalize_documento()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.documento IS NOT NULL THEN
    NEW.documento := regexp_replace(NEW.documento, '\D', '', 'g');
  END IF;
  IF NEW.documento_secundario IS NOT NULL THEN
    NEW.documento_secundario := regexp_replace(NEW.documento_secundario, '\D', '', 'g');
  END IF;
  IF TG_OP = 'INSERT' AND (NEW.numero_cliente IS NULL OR NEW.numero_cliente = '') THEN
    NEW.numero_cliente := 'CLI-' || lpad(nextval('public.cliente_numero_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_crm_normalize_documento BEFORE INSERT OR UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.crm_normalize_documento();

CREATE OR REPLACE FUNCTION public.cliente_pipeline_avancar_para(_cliente_id UUID, _codigo_destino TEXT, _acao TEXT DEFAULT NULL, _obs TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_dest RECORD;
  v_ordem_atual INT;
BEGIN
  SELECT * INTO v_dest FROM public.pipeline_stages WHERE codigo = _codigo_destino;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT ps.ordem INTO v_ordem_atual
  FROM public.cliente_pipeline cp JOIN public.pipeline_stages ps ON ps.id = cp.stage_id
  WHERE cp.cliente_id = _cliente_id;
  IF v_ordem_atual IS NOT NULL AND v_dest.ordem <= v_ordem_atual THEN
    RETURN;
  END IF;
  INSERT INTO public.cliente_pipeline (cliente_id, stage_id, ultima_atualizacao_em)
  VALUES (_cliente_id, v_dest.id, now())
  ON CONFLICT (cliente_id) DO UPDATE SET stage_id = EXCLUDED.stage_id, ultima_atualizacao_em = now();
  INSERT INTO public.cliente_pipeline_historico (cliente_id, stage_id, acao, observacao, mensagem_cliente, enviar_ao_cliente)
  VALUES (_cliente_id, v_dest.id, COALESCE(_acao,'avanco'), _obs, v_dest.mensagem_cliente, true);
  INSERT INTO public.cliente_historico (cliente_id, tipo, descricao)
  VALUES (_cliente_id, 'etapa', 'Etapa alterada para ' || v_dest.nome);
END;
$$;

CREATE OR REPLACE FUNCTION public.crm_seed_cliente_pipeline()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_stage UUID;
BEGIN
  SELECT id INTO v_stage FROM public.pipeline_stages WHERE codigo = 'cadastro_basico';
  INSERT INTO public.cliente_pipeline (cliente_id, stage_id) VALUES (NEW.id, v_stage)
  ON CONFLICT (cliente_id) DO NOTHING;
  INSERT INTO public.cliente_pipeline_historico (cliente_id, stage_id, acao, mensagem_cliente)
  SELECT NEW.id, id, 'cadastro', mensagem_cliente FROM public.pipeline_stages WHERE codigo = 'cadastro_basico';
  INSERT INTO public.cliente_historico (cliente_id, tipo, descricao, ator_id)
  VALUES (NEW.id, 'cadastro', 'Cliente cadastrado', NEW.criador_id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_crm_seed_pipeline AFTER INSERT ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.crm_seed_cliente_pipeline();

CREATE OR REPLACE FUNCTION public.cliente_endereco_sincronizar_esteira()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.cep IS NOT NULL AND length(regexp_replace(NEW.cep, '\D', '', 'g')) = 8 THEN
    PERFORM public.cliente_pipeline_avancar_para(NEW.cliente_id, 'cadastro_completo', 'endereco');
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_cli_end_esteira AFTER INSERT OR UPDATE ON public.cliente_enderecos
FOR EACH ROW EXECUTE FUNCTION public.cliente_endereco_sincronizar_esteira();