ALTER TABLE public.dm_mensagens REPLICA IDENTITY FULL;
ALTER TABLE public.demanda_mensagens REPLICA IDENTITY FULL;
ALTER TABLE public.chat_reacoes REPLICA IDENTITY FULL;

-- Garantir que as tabelas de mensagens/reações estão na publicação de realtime (idempotente).
DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_mensagens; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.demanda_mensagens; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_reacoes; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.cliente_app_mensagens; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;