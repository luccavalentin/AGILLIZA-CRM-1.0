ALTER TABLE public.simulacao_bancos 
ADD COLUMN IF NOT EXISTS renda_minima_banco numeric NULL,
ADD COLUMN IF NOT EXISTS renda_minima_fonte text NULL;

COMMENT ON COLUMN public.simulacao_bancos.renda_minima_fonte IS 'Origem da renda mínima: banco (retornado pela API) ou estimativa (calculado localmente)';
