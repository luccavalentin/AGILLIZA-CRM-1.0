-- Backfill do número real da proposta no banco a partir do retorno já gravado.
UPDATE public.proposta_bancos
SET numero_proposta_banco = COALESCE(
  raw_response->>'numeroPropostaBanco',
  raw_response->>'numeroProposta',
  raw_response->>'proposalNumber',
  raw_response->>'codigoPropostaBanco',
  raw_response->>'codigoOportunidadeBanco',
  raw_response->>'codigoSimulacaoBanco'
)
WHERE numero_proposta_banco IS NULL
  AND raw_response IS NOT NULL
  AND COALESCE(
    raw_response->>'numeroPropostaBanco',
    raw_response->>'numeroProposta',
    raw_response->>'proposalNumber',
    raw_response->>'codigoPropostaBanco',
    raw_response->>'codigoOportunidadeBanco',
    raw_response->>'codigoSimulacaoBanco'
  ) IS NOT NULL;

-- Espelha na proposta o número do banco escolhido/em análise mais recente.
UPDATE public.propostas p
SET numero_proposta_banco = sub.numero
FROM (
  SELECT DISTINCT ON (proposta_id) proposta_id, numero_proposta_banco AS numero
  FROM public.proposta_bancos
  WHERE numero_proposta_banco IS NOT NULL
  ORDER BY proposta_id, updated_at DESC NULLS LAST
) sub
WHERE p.id = sub.proposta_id
  AND (p.numero_proposta_banco IS NULL OR p.numero_proposta_banco = '');