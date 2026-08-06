-- Vínculos de proposta/simulação na demanda
ALTER TABLE public.demandas
  ADD COLUMN IF NOT EXISTS proposta_id  uuid REFERENCES public.propostas(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS simulacao_id uuid REFERENCES public.simulacoes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS demandas_proposta_id_idx  ON public.demandas(proposta_id);
CREATE INDEX IF NOT EXISTS demandas_simulacao_id_idx ON public.demandas(simulacao_id);

-- Realtime para chat e board
DO $$
BEGIN
  PERFORM 1
  FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'demanda_mensagens';
  IF NOT FOUND THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.demanda_mensagens;
  END IF;

  PERFORM 1
  FROM pg_publication_tables
  WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'demandas';
  IF NOT FOUND THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.demandas;
  END IF;
END $$;
