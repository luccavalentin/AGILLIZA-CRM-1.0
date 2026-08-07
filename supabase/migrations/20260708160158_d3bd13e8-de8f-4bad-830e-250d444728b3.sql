-- 1) Suporte a arquivamento de conversas
ALTER TABLE public.crm_chat_meta
  ADD COLUMN IF NOT EXISTS arquivado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS arquivado_em timestamp with time zone;

-- 2) Função de expurgo: exclui o histórico de conversa (mensagens do App do cliente)
--    de clientes cujo contrato foi emitido há mais de 2 meses, liberando espaço.
CREATE OR REPLACE FUNCTION public.purgar_conversas_pos_contrato()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  n int := 0;
BEGIN
  FOR r IN
    SELECT c.id AS cliente_id,
           c.correspondente_id,
           max(p.contrato_emitido_em) AS emitido_em
    FROM public.clientes c
    JOIN public.propostas p ON p.cliente_id = c.id
    WHERE p.status = 'contrato_emitido'
      AND p.contrato_emitido_em IS NOT NULL
    GROUP BY c.id, c.correspondente_id
    HAVING max(p.contrato_emitido_em) < now() - interval '2 months'
       AND EXISTS (SELECT 1 FROM public.cliente_app_mensagens m WHERE m.cliente_id = c.id)
  LOOP
    DELETE FROM public.cliente_app_mensagens WHERE cliente_id = r.cliente_id;

    UPDATE public.crm_chat_meta
      SET arquivado = true, arquivado_em = now(), updated_at = now()
      WHERE cliente_id = r.cliente_id;

    INSERT INTO public.cliente_historico (cliente_id, tipo, descricao, metadata)
    VALUES (
      r.cliente_id,
      'lgpd',
      'Histórico de conversa excluído automaticamente (retenção de 2 meses após a emissão do contrato).',
      jsonb_build_object('emitido_em', r.emitido_em, 'excluido_em', now())
    );

    n := n + 1;
  END LOOP;
  RETURN n;
END;
$$;

-- 3) Agenda diária do expurgo (SQL puro, sem segredos)
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.unschedule('purgar-conversas-pos-contrato')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purgar-conversas-pos-contrato');

SELECT cron.schedule(
  'purgar-conversas-pos-contrato',
  '0 3 * * *',
  $$ SELECT public.purgar_conversas_pos_contrato(); $$
);