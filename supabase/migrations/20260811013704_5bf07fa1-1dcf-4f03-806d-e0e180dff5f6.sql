-- Migração única para backfill de renda_minima_banco e renda_minima_fonte
-- Baseado no comprometimento: Bradesco (237) 30% SAC / 15% PRICE, demais 30% SAC / 30% PRICE.

UPDATE public.simulacao_bancos
SET 
  renda_minima_banco = COALESCE(
    -- 1. Tentar extrair do JSON (Bradesco)
    (raw_response->'descricaoRespostaBanco'->>'valorRendaLiquidaMinimaExigida')::numeric,
    (raw_response->'simulacao'->'descricaoRespostaBanco'->>'valorRendaLiquidaMinimaExigida')::numeric,
    (raw_response->'rendaMinimaExigida')::numeric,
    -- 2. Fallback: calcular valor_parcela / comprometimento
    CASE 
      WHEN valor_parcela IS NOT NULL AND valor_parcela > 0 THEN
        valor_parcela / CASE 
          -- Bradesco (237)
          WHEN (raw_response->>'codigoBanco' = '237' OR nome_banco ILIKE '%Bradesco%') 
               AND (sistema_amortizacao_banco ILIKE 'P%' OR raw_response->'simulacao'->>'codigoSistemaAmortizacaoBanco' = '2') 
               THEN 0.15
          -- Default 30%
          ELSE 0.30
        END
      ELSE NULL
    END
  ),
  renda_minima_fonte = CASE 
    WHEN (raw_response->'descricaoRespostaBanco'->>'valorRendaLiquidaMinimaExigida') IS NOT NULL 
      OR (raw_response->'simulacao'->'descricaoRespostaBanco'->>'valorRendaLiquidaMinimaExigida') IS NOT NULL
      OR (raw_response->'rendaMinimaExigida') IS NOT NULL
      THEN 'banco'
    WHEN valor_parcela IS NOT NULL AND valor_parcela > 0 
      THEN 'estimativa'
    ELSE NULL
  END
WHERE valor_parcela IS NOT NULL 
  AND (renda_minima_fonte IS NULL OR renda_minima_banco IS NULL);
