CREATE TABLE IF NOT EXISTS public.cliente_app_conversas_estado (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid NOT NULL,
  atendente_id uuid NOT NULL,
  oculto_em timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cliente_id, atendente_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_app_conversas_estado TO authenticated;
GRANT ALL ON public.cliente_app_conversas_estado TO service_role;

ALTER TABLE public.cliente_app_conversas_estado ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "estado conversa cliente proprio" ON public.cliente_app_conversas_estado;
CREATE POLICY "estado conversa cliente proprio"
ON public.cliente_app_conversas_estado
FOR ALL
TO authenticated
USING (cliente_id = auth.uid())
WITH CHECK (cliente_id = auth.uid());

CREATE OR REPLACE FUNCTION public.portal_ocultar_conversa(_cid uuid, _atendente uuid, _ocultar boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF _cid IS NULL OR _atendente IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Conversa inválida.');
  END IF;

  INSERT INTO public.cliente_app_conversas_estado (cliente_id, atendente_id, oculto_em, updated_at)
  VALUES (_cid, _atendente, CASE WHEN _ocultar THEN now() ELSE NULL END, now())
  ON CONFLICT (cliente_id, atendente_id)
  DO UPDATE SET oculto_em = CASE WHEN _ocultar THEN now() ELSE NULL END, updated_at = now();

  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.portal_listar_atendentes(_cid uuid)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT m.atendente_id,
           max(m.criada_em) AS ultima_em,
           (array_agg(CASE WHEN m.excluida_em IS NOT NULL THEN '' ELSE m.mensagem END ORDER BY m.criada_em DESC))[1] AS ultima_mensagem,
           count(*) FILTER (WHERE m.remetente_tipo = 'time' AND m.lida_em IS NULL) AS nao_lidas
      FROM public.cliente_app_mensagens m
     WHERE m.cliente_id = _cid AND m.atendente_id IS NOT NULL
     GROUP BY m.atendente_id
  ),
  analista_proposta AS (
    SELECT COALESCE(pr.usuario_responsavel_id, pr.usuario_criador_id) AS atendente_id
      FROM public.propostas pr
     WHERE pr.cliente_id = _cid
       AND COALESCE(pr.usuario_responsavel_id, pr.usuario_criador_id) IS NOT NULL
       AND COALESCE(pr.usuario_responsavel_id, pr.usuario_criador_id) <> _cid
     ORDER BY CASE WHEN pr.enviada_em IS NOT NULL THEN 0 ELSE 1 END,
              COALESCE(pr.enviada_em, pr.created_at) DESC
     LIMIT 1
  ),
  resp AS (
    SELECT c.responsavel_id AS atendente_id
      FROM public.clientes c
      JOIN public.profiles p ON p.id = c.responsavel_id
     WHERE c.id = _cid
       AND c.responsavel_id IS NOT NULL
       AND c.responsavel_id <> c.id
  ),
  todos AS (
    SELECT atendente_id FROM base
    UNION
    SELECT atendente_id FROM analista_proposta
    UNION
    SELECT atendente_id FROM resp
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'atendente_id', t.atendente_id,
    'nome', COALESCE(p.nome, 'Equipe'),
    'foto_url', p.foto_url,
    'ultima_em', b.ultima_em,
    'ultima_mensagem', b.ultima_mensagem,
    'nao_lidas', COALESCE(b.nao_lidas, 0)
  ) ORDER BY b.ultima_em DESC NULLS LAST), '[]'::jsonb)
  FROM todos t
  LEFT JOIN base b ON b.atendente_id = t.atendente_id
  LEFT JOIN public.profiles p ON p.id = t.atendente_id
  LEFT JOIN public.cliente_app_conversas_estado e
         ON e.cliente_id = _cid AND e.atendente_id = t.atendente_id
  WHERE t.atendente_id IS NOT NULL
    AND t.atendente_id <> _cid
    AND (e.oculto_em IS NULL OR (b.ultima_em IS NOT NULL AND b.ultima_em > e.oculto_em));
$function$;