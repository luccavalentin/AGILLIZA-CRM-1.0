ALTER TABLE public.simulacao_bancos ADD COLUMN IF NOT EXISTS taxa_cet_ano numeric NULL;

UPDATE public.simulacao_bancos
SET taxa_cet_ano = NULLIF((raw_response->>'taxaCetAnoBanco'), '')::numeric
WHERE (taxa_cet_ano IS NULL OR taxa_cet_ano = 0)
  AND raw_response->>'taxaCetAnoBanco' IS NOT NULL
  AND raw_response->>'taxaCetAnoBanco' != ''
  AND (raw_response->>'taxaCetAnoBanco') ~ '^[0-9]+(\.[0-9]+)?$';