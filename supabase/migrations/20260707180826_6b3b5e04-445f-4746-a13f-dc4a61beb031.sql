CREATE OR REPLACE FUNCTION public.registrar_auditoria(
  _acao text,
  _entidade text DEFAULT NULL::text,
  _entidade_id uuid DEFAULT NULL::uuid,
  _payload_anterior jsonb DEFAULT NULL::jsonb,
  _payload_novo jsonb DEFAULT NULL::jsonb,
  _ip text DEFAULT NULL::text,
  _user_agent text DEFAULT NULL::text,
  _descricao text DEFAULT NULL::text
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_corr uuid;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;
  v_corr := public.correspondente_do_usuario(v_uid);
  IF v_corr IS NULL THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.admin_audit_logs (
    user_id, correspondente_id, acao, entidade, entidade_id, ip, user_agent, payload_anterior, payload_novo, descricao
  ) VALUES (
    v_uid, v_corr, _acao, _entidade, _entidade_id, _ip, _user_agent, _payload_anterior, _payload_novo, _descricao
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$;