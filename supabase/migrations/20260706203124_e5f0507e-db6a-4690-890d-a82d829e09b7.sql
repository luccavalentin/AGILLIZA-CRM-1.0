ALTER TABLE public.cliente_pipeline REPLICA IDENTITY FULL;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'cliente_pipeline'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cliente_pipeline;
  END IF;
END $$;