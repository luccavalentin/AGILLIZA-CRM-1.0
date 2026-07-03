CREATE TABLE public.simulacao_bancos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulacao_id UUID NOT NULL REFERENCES public.simulacoes(id) ON DELETE CASCADE,
  banco_id UUID REFERENCES public.homefin_bancos(id),
  homefin_id_banco INTEGER, codigo_banco INTEGER, nome_banco TEXT,
  selecionado BOOLEAN NOT NULL DEFAULT true, flag_simulacao TEXT DEFAULT 'S',
  homefin_id_simulacao_banco TEXT,
  valor_parcela NUMERIC(15,2), taxa_juros_ano NUMERIC(8,4),
  prazo_pagamento_max INTEGER, valor_financiamento_max NUMERIC(15,2),
  valor_parcela_max NUMERIC(15,2), codigo_indexador TEXT, valor_iof NUMERIC(15,2),
  sistema_amortizacao_banco TEXT,
  status_banco public.simulacao_banco_status NOT NULL DEFAULT 'aguardando',
  mensagem_banco TEXT, raw_request JSONB, raw_response JSONB, simulado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX simulacao_bancos_sim_idx ON public.simulacao_bancos (simulacao_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulacao_bancos TO authenticated;
GRANT ALL ON public.simulacao_bancos TO service_role;
ALTER TABLE public.simulacao_bancos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver bancos da simulacao com acesso" ON public.simulacao_bancos FOR SELECT TO authenticated USING (public.usuario_tem_acesso_simulacao(auth.uid(), simulacao_id));
CREATE POLICY "Gerenciar bancos da simulacao com acesso" ON public.simulacao_bancos FOR ALL TO authenticated
  USING (public.usuario_tem_acesso_simulacao(auth.uid(), simulacao_id))
  WITH CHECK (public.usuario_tem_acesso_simulacao(auth.uid(), simulacao_id));
CREATE TRIGGER simulacao_bancos_updated BEFORE UPDATE ON public.simulacao_bancos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.simulacao_participantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulacao_id UUID NOT NULL REFERENCES public.simulacoes(id) ON DELETE CASCADE,
  tipo_qualificacao TEXT, tipo_pessoa TEXT, nome TEXT, cpf_cnpj TEXT,
  data_nascimento DATE, renda NUMERIC(15,2), estado_civil TEXT, dados JSONB,
  homefin_id_participante TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX simulacao_participantes_sim_idx ON public.simulacao_participantes (simulacao_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulacao_participantes TO authenticated;
GRANT ALL ON public.simulacao_participantes TO service_role;
ALTER TABLE public.simulacao_participantes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Gerenciar participantes com acesso" ON public.simulacao_participantes FOR ALL TO authenticated
  USING (public.usuario_tem_acesso_simulacao(auth.uid(), simulacao_id))
  WITH CHECK (public.usuario_tem_acesso_simulacao(auth.uid(), simulacao_id));
CREATE TRIGGER simulacao_participantes_updated BEFORE UPDATE ON public.simulacao_participantes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.simulacao_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulacao_id UUID NOT NULL REFERENCES public.simulacoes(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL, descricao TEXT NOT NULL, ator_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX simulacao_historico_sim_idx ON public.simulacao_historico (simulacao_id);
GRANT SELECT, INSERT ON public.simulacao_historico TO authenticated;
GRANT ALL ON public.simulacao_historico TO service_role;
ALTER TABLE public.simulacao_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver historico com acesso" ON public.simulacao_historico FOR SELECT TO authenticated USING (public.usuario_tem_acesso_simulacao(auth.uid(), simulacao_id));
CREATE POLICY "Inserir historico com acesso" ON public.simulacao_historico FOR INSERT TO authenticated WITH CHECK (public.usuario_tem_acesso_simulacao(auth.uid(), simulacao_id));

CREATE TABLE public.simulacao_pdfs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulacao_id UUID NOT NULL REFERENCES public.simulacoes(id) ON DELETE CASCADE,
  banco_id UUID, storage_path TEXT NOT NULL, gerado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX simulacao_pdfs_sim_idx ON public.simulacao_pdfs (simulacao_id);
GRANT SELECT, INSERT, DELETE ON public.simulacao_pdfs TO authenticated;
GRANT ALL ON public.simulacao_pdfs TO service_role;
ALTER TABLE public.simulacao_pdfs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver pdfs com acesso" ON public.simulacao_pdfs FOR SELECT TO authenticated USING (public.usuario_tem_acesso_simulacao(auth.uid(), simulacao_id));
CREATE POLICY "Inserir pdfs com acesso" ON public.simulacao_pdfs FOR INSERT TO authenticated WITH CHECK (public.usuario_tem_acesso_simulacao(auth.uid(), simulacao_id));

CREATE TABLE public.simulacao_logs_homefin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  simulacao_id UUID REFERENCES public.simulacoes(id) ON DELETE SET NULL,
  correspondente_id UUID, endpoint TEXT NOT NULL, metodo TEXT NOT NULL,
  status_http INTEGER, request_masked JSONB, response JSONB, erro TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX simulacao_logs_sim_idx ON public.simulacao_logs_homefin (simulacao_id);
GRANT SELECT ON public.simulacao_logs_homefin TO authenticated;
GRANT ALL ON public.simulacao_logs_homefin TO service_role;
ALTER TABLE public.simulacao_logs_homefin ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Ver logs para auditoria" ON public.simulacao_logs_homefin FOR SELECT TO authenticated USING (
  correspondente_id = public.correspondente_do_usuario(auth.uid())
  AND public.usuario_tem_permissao(auth.uid(),'admin.auditoria','view')
);

CREATE OR REPLACE FUNCTION public.simulacao_sincronizar_esteira()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.cliente_id IS NOT NULL AND NEW.status IN ('simulada','parcialmente_simulada')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.cliente_pipeline_avancar_para(NEW.cliente_id, 'simulacao', 'simulacao');
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER simulacao_sincronizar_esteira_trg AFTER UPDATE ON public.simulacoes
  FOR EACH ROW EXECUTE FUNCTION public.simulacao_sincronizar_esteira();

ALTER TABLE public.simulacao_bancos REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.simulacao_bancos;