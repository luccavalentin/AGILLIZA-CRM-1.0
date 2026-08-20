
UPDATE public.proposta_bancos pb
SET status_banco = 'enviada', 
    situacao_banco = 'em_analise',
    updated_at = now()
FROM public.proposta_logs_homefin log
WHERE pb.proposta_id = log.proposta_id
  AND pb.status_banco = 'erro'
  AND log.endpoint LIKE '%/incluir-proposta-integracao'
  AND log.status_http >= 200 AND log.status_http < 300;

UPDATE public.propostas p
SET status = 'enviada_banco', 
    ultimo_erro = NULL,
    updated_at = now()
WHERE status = 'erro_envio'
  AND EXISTS (
    SELECT 1 FROM public.proposta_logs_homefin log
    WHERE log.proposta_id = p.id
      AND log.endpoint LIKE '%/incluir-proposta-integracao'
      AND log.status_http >= 200 AND log.status_http < 300
  );
