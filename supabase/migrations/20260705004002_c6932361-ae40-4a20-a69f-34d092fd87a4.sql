ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS lgpd_aceite_em timestamptz,
  ADD COLUMN IF NOT EXISTS lgpd_aceite_ip text,
  ADD COLUMN IF NOT EXISTS lgpd_aceite_versao text;

CREATE OR REPLACE FUNCTION public.portal_registrar_consentimento_lgpd(
  _cid uuid,
  _versao text,
  _ip text,
  _ua text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cli RECORD;
BEGIN
  SELECT id, nome, correspondente_id, responsavel_id, lgpd_aceite_em
  INTO v_cli
  FROM public.clientes
  WHERE id = _cid;

  IF v_cli.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Cliente não encontrado.');
  END IF;

  IF v_cli.lgpd_aceite_em IS NULL THEN
    UPDATE public.clientes
    SET lgpd_aceite_em = now(),
        lgpd_aceite_ip = _ip,
        lgpd_aceite_versao = COALESCE(_versao, 'v1')
    WHERE id = _cid;

    INSERT INTO public.cliente_app_acessos (cliente_id, documento_hash, tipo_acesso, sucesso, ip, user_agent)
    VALUES (_cid, '', 'consentimento_lgpd', true, _ip, _ua);

    INSERT INTO public.cliente_historico (cliente_id, tipo, descricao, metadata)
    VALUES (
      _cid,
      'lgpd',
      'Cliente aceitou o Termo de Consentimento LGPD no primeiro acesso ao App do Cliente.',
      jsonb_build_object('versao', COALESCE(_versao, 'v1'), 'ip', _ip)
    );

    INSERT INTO public.admin_audit_logs (correspondente_id, acao, entidade, entidade_id, ip, user_agent, payload_novo)
    VALUES (
      v_cli.correspondente_id,
      'cliente.consentimento_lgpd',
      'cliente',
      _cid,
      _ip,
      _ua,
      jsonb_build_object(
        'cliente', v_cli.nome,
        'versao', COALESCE(_versao, 'v1'),
        'aceito_em', now()
      )
    );

    PERFORM public.emitir_notificacao(
      v_cli.responsavel_id,
      v_cli.correspondente_id,
      'cliente.lgpd',
      'Consentimento LGPD registrado',
      'O cliente ' || COALESCE(v_cli.nome, '') || ' aceitou o termo LGPD no primeiro acesso.',
      '/crm/clientes/' || _cid
    );
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.portal_registrar_consentimento_lgpd(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_registrar_consentimento_lgpd(uuid, text, text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.portal_cliente_login(_documento text, _tipo text, _data_nasc text, _doc_hash text, _ip text, _ua text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_falhas24h int;
  v_falhas15m int;
  v_cli RECORD;
BEGIN
  SELECT
    count(*) FILTER (WHERE sucesso = false AND created_at >= now() - interval '24 hours'),
    count(*) FILTER (WHERE sucesso = false AND created_at >= now() - interval '15 minutes')
  INTO v_falhas24h, v_falhas15m
  FROM public.cliente_app_acessos
  WHERE documento_hash = _doc_hash;

  IF v_falhas24h >= 10 THEN
    INSERT INTO public.cliente_app_acessos (cliente_id, documento_hash, tipo_acesso, sucesso, motivo_bloqueio, ip, user_agent)
    VALUES (NULL, _doc_hash, 'login', false, 'bloqueio_24h', _ip, _ua);
    RETURN jsonb_build_object('ok', false, 'error', 'Acesso temporariamente bloqueado. Tente novamente mais tarde.');
  END IF;

  IF v_falhas15m >= 5 THEN
    INSERT INTO public.cliente_app_acessos (cliente_id, documento_hash, tipo_acesso, sucesso, motivo_bloqueio, ip, user_agent)
    VALUES (NULL, _doc_hash, 'login', false, 'rate_limit_15m', _ip, _ua);
    RETURN jsonb_build_object('ok', false, 'error', 'Muitas tentativas. Aguarde alguns minutos e tente novamente.');
  END IF;

  SELECT id, correspondente_id, nome, tipo_pessoa, foto_url, data_nascimento, portal_acesso_ativo, ativo, lgpd_aceite_em
  INTO v_cli
  FROM public.clientes
  WHERE documento = _documento AND tipo_pessoa = _tipo::public.tipo_pessoa
  LIMIT 1;

  IF v_cli.id IS NULL
     OR v_cli.ativo IS NOT TRUE
     OR v_cli.portal_acesso_ativo IS NOT TRUE
     OR v_cli.data_nascimento::text IS DISTINCT FROM _data_nasc THEN
    INSERT INTO public.cliente_app_acessos (cliente_id, documento_hash, tipo_acesso, sucesso, motivo_bloqueio, ip, user_agent)
    VALUES (v_cli.id, _doc_hash, 'login', false, 'credenciais_invalidas', _ip, _ua);
    RETURN jsonb_build_object('ok', false, 'error', 'Dados não encontrados. Verifique as informações e tente novamente.');
  END IF;

  INSERT INTO public.cliente_app_acessos (cliente_id, documento_hash, tipo_acesso, sucesso, ip, user_agent)
  VALUES (v_cli.id, _doc_hash, 'login', true, _ip, _ua);

  RETURN jsonb_build_object(
    'ok', true,
    'cid', v_cli.id,
    'corr', v_cli.correspondente_id,
    'lgpd_aceito', v_cli.lgpd_aceite_em IS NOT NULL,
    'cliente', jsonb_build_object(
      'id', v_cli.id, 'nome', v_cli.nome, 'tipo_pessoa', v_cli.tipo_pessoa, 'foto_url', v_cli.foto_url
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.portal_cliente_sessao(_cid uuid)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN c.id IS NULL OR c.ativo IS NOT TRUE OR c.portal_acesso_ativo IS NOT TRUE THEN NULL
    ELSE jsonb_build_object(
      'id', c.id, 'nome', c.nome, 'tipo_pessoa', c.tipo_pessoa, 'foto_url', c.foto_url,
      'lgpd_aceito', c.lgpd_aceite_em IS NOT NULL
    )
  END
  FROM (SELECT NULL::uuid) z
  LEFT JOIN public.clientes c ON c.id = _cid;
$function$;

REVOKE EXECUTE ON FUNCTION public.portal_cliente_login(text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_cliente_login(text, text, text, text, text, text) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.portal_cliente_sessao(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_cliente_sessao(uuid) TO anon, authenticated;