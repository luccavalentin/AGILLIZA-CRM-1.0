ALTER PUBLICATION supabase_realtime ADD TABLE public.clientes;
ALTER TABLE public.clientes REPLICA IDENTITY FULL;