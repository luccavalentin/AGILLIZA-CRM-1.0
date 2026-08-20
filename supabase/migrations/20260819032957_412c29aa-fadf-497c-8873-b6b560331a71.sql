-- Adiciona colunas para persistir limites operacionais de prazo informados pelos bancos
ALTER TABLE public.simulacao_bancos ADD COLUMN IF NOT EXISTS prazo_min_banco integer;
ALTER TABLE public.simulacao_bancos ADD COLUMN IF NOT EXISTS prazo_max_banco integer;

-- Comentários para documentação
COMMENT ON COLUMN public.simulacao_bancos.prazo_min_banco IS 'Prazo mínimo aceito pelo banco para esta operação específica, extraído de mensagens de erro.';
COMMENT ON COLUMN public.simulacao_bancos.prazo_max_banco IS 'Prazo máximo aceito pelo banco para esta operação específica, extraído de mensagens de erro.';
