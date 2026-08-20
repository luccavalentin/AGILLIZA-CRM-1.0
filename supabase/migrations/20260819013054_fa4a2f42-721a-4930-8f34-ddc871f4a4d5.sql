-- Backfill de taxas para registros simulados com sucesso que ficaram zerados
UPDATE public.simulacao_bancos
SET 
  taxa_juros_ano = (raw_response->>'taxaJurosAnoBanco')::numeric,
  taxa_cet_ano = (raw_response->>'taxaCetAnoBanco')::numeric,
  mensagem_banco = NULL
WHERE status_banco = 'simulada' 
  AND (taxa_juros_ano IS NULL OR taxa_juros_ano = 0 OR taxa_cet_ano IS NULL)
  AND (raw_response->>'taxaJurosAnoBanco') IS NOT NULL;

-- Limpeza de mensagens travadas em bancos já simulados
UPDATE public.simulacao_bancos
SET mensagem_banco = NULL
WHERE status_banco = 'simulada' AND mensagem_banco IS NOT NULL;

-- Backfill do status global das simulações usando apenas valores válidos do enum
WITH stats AS (
  SELECT 
    simulacao_id,
    COUNT(*) FILTER (WHERE status_banco = 'simulada') as simulados,
    COUNT(*) FILTER (WHERE status_banco = 'aguardando') as aguardando,
    COUNT(*) as total
  FROM public.simulacao_bancos
  WHERE selecionado = true
  GROUP BY simulacao_id
)
UPDATE public.simulacoes s
SET status = CASE 
    WHEN st.aguardando > 0 AND st.simulados > 0 THEN 'parcialmente_simulada'::simulacao_status
    WHEN st.aguardando > 0 THEN 'enviando'::simulacao_status
    WHEN st.simulados = st.total THEN 'simulada'::simulacao_status
    ELSE s.status
  END
FROM stats st
WHERE s.id = st.simulacao_id
AND s.status IN ('enviando', 'rascunho')
AND s.created_at >= now() - interval '24 hours';