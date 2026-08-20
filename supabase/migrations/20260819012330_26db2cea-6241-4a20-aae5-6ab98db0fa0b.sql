UPDATE public.simulacao_bancos
SET 
  taxa_juros_ano = (raw_response->>'taxaJurosAnoBanco')::numeric,
  taxa_cet_ano = (raw_response->>'taxaCetAnoBanco')::numeric,
  mensagem_banco = NULL
WHERE status_banco = 'simulada' 
  AND (taxa_juros_ano IS NULL OR taxa_juros_ano = 0 OR taxa_cet_ano IS NULL)
  AND (raw_response->>'taxaJurosAnoBanco') IS NOT NULL;