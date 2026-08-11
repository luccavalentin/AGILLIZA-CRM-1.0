-- Enum de resultado da conciliação
DO $$ BEGIN
  CREATE TYPE public.conciliacao_resultado AS ENUM ('conferido','divergente','ausente_no_sistema','ausente_no_banco');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Lotes de conciliação (um por upload)
CREATE TABLE IF NOT EXISTS public.conciliacao_lotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  correspondente_id UUID NOT NULL,
  banco_nome TEXT NOT NULL,
  periodo_referencia DATE NOT NULL,
  nome_arquivo TEXT NOT NULL,
  enviado_por UUID,
  enviado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_linhas INT NOT NULL DEFAULT 0,
  total_conferidas INT NOT NULL DEFAULT 0,
  total_divergentes INT NOT NULL DEFAULT 0,
  total_ausentes_sistema INT NOT NULL DEFAULT 0,
  total_ausentes_banco INT NOT NULL DEFAULT 0,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conciliacao_lotes_corr_periodo_idx
  ON public.conciliacao_lotes (correspondente_id, periodo_referencia DESC, banco_nome);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conciliacao_lotes TO authenticated;
GRANT ALL ON public.conciliacao_lotes TO service_role;

ALTER TABLE public.conciliacao_lotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conciliacao_lotes_select" ON public.conciliacao_lotes
  FOR SELECT TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()));

CREATE POLICY "conciliacao_lotes_insert" ON public.conciliacao_lotes
  FOR INSERT TO authenticated
  WITH CHECK (
    correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND public.is_interno(auth.uid())
  );

CREATE POLICY "conciliacao_lotes_update" ON public.conciliacao_lotes
  FOR UPDATE TO authenticated
  USING (
    correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND public.usuario_pode_admin(auth.uid())
  );

CREATE POLICY "conciliacao_lotes_delete" ON public.conciliacao_lotes
  FOR DELETE TO authenticated
  USING (
    correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND public.usuario_pode_admin(auth.uid())
  );

CREATE TRIGGER trg_conciliacao_lotes_updated
  BEFORE UPDATE ON public.conciliacao_lotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Itens de conciliação (uma linha por linha do relatório do banco ou proposta ausente)
CREATE TABLE IF NOT EXISTS public.conciliacao_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lote_id UUID NOT NULL REFERENCES public.conciliacao_lotes(id) ON DELETE CASCADE,
  numero_proposta_banco TEXT,
  nome_cliente_banco TEXT,
  cpf_banco TEXT, -- armazenado mascarado (ex.: 394***988**)
  status_banco TEXT,
  valor_financiamento_banco NUMERIC(14,2),
  data_envio_banco DATE,
  data_emissao_banco DATE,
  data_assinatura_banco DATE,
  produto_banco TEXT,
  proposta_id UUID REFERENCES public.propostas(id) ON DELETE SET NULL,
  proposta_banco_id UUID REFERENCES public.proposta_bancos(id) ON DELETE SET NULL,
  status_sistema TEXT,
  valor_financiamento_sistema NUMERIC(14,2),
  numero_proposta_sistema TEXT,
  resultado public.conciliacao_resultado NOT NULL,
  detalhe_divergencia TEXT,
  extras JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conciliacao_itens_lote_idx
  ON public.conciliacao_itens (lote_id, resultado);
CREATE INDEX IF NOT EXISTS conciliacao_itens_proposta_idx
  ON public.conciliacao_itens (proposta_id) WHERE proposta_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conciliacao_itens TO authenticated;
GRANT ALL ON public.conciliacao_itens TO service_role;

ALTER TABLE public.conciliacao_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conciliacao_itens_select" ON public.conciliacao_itens
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conciliacao_lotes l
    WHERE l.id = conciliacao_itens.lote_id
      AND l.correspondente_id = public.correspondente_do_usuario(auth.uid())
  ));

CREATE POLICY "conciliacao_itens_insert" ON public.conciliacao_itens
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.conciliacao_lotes l
    WHERE l.id = conciliacao_itens.lote_id
      AND l.correspondente_id = public.correspondente_do_usuario(auth.uid())
      AND public.is_interno(auth.uid())
  ));

CREATE POLICY "conciliacao_itens_update" ON public.conciliacao_itens
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conciliacao_lotes l
    WHERE l.id = conciliacao_itens.lote_id
      AND l.correspondente_id = public.correspondente_do_usuario(auth.uid())
      AND public.usuario_pode_admin(auth.uid())
  ));

CREATE POLICY "conciliacao_itens_delete" ON public.conciliacao_itens
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.conciliacao_lotes l
    WHERE l.id = conciliacao_itens.lote_id
      AND l.correspondente_id = public.correspondente_do_usuario(auth.uid())
      AND public.usuario_pode_admin(auth.uid())
  ));