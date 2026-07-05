UPDATE public.simulacao_bancos sb
SET prazo_pagamento_max = coalesce(
  (raw_response->>'prazoPagamentoBancoMax')::int,
  (raw_response->>'prazoPagamentoBanco')::int,
  (raw_response->>'prazoPagamentoSimulacao')::int,
  s.prazo
)
FROM public.simulacoes s
WHERE sb.simulacao_id = s.id
  AND sb.prazo_pagamento_max IS NULL
  AND sb.raw_response IS NOT NULL;

UPDATE public.proposta_bancos pb
SET prazo_pagamento_max = sb.prazo_pagamento_max
FROM public.simulacao_bancos sb
WHERE pb.prazo_pagamento_max IS NULL
  AND sb.prazo_pagamento_max IS NOT NULL
  AND pb.banco_id = sb.banco_id
  AND pb.simulacao_banco_id = sb.id;