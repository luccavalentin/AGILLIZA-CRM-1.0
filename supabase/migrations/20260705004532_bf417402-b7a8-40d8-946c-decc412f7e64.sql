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
  v_doc_existe RECORD;
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

  SELECT id, correspondente_id, nome, tipo_pessoa, foto_url, data_nascimento, portal_acesso_ativo, ativo, lgpd_aceite_em, responsavel_id
  INTO v_cli
  FROM public.clientes
  WHERE documento = _documento AND tipo_pessoa = _tipo::public.tipo_pessoa
  LIMIT 1;

  -- Caso 1: documento + tipo existem e conferem, mas o portal ainda não foi liberado.
  IF v_cli.id IS NOT NULL
     AND v_cli.data_nascimento::text IS NOT DISTINCT FROM _data_nasc
     AND (v_cli.ativo IS NOT TRUE OR v_cli.portal_acesso_ativo IS NOT TRUE) THEN
    INSERT INTO public.cliente_app_acessos (cliente_id, documento_hash, tipo_acesso, sucesso, motivo_bloqueio, ip, user_agent)
    VALUES (v_cli.id, _doc_hash, 'login', false, 'portal_nao_liberado', _ip, _ua);

    PERFORM public.emitir_notificacao(
      v_cli.responsavel_id,
      v_cli.correspondente_id,
      'cliente.login_bloqueado',
      'Cliente tentou acessar o App sem liberação',
      'O cliente ' || COALESCE(v_cli.nome, '') || ' tentou entrar no App do Cliente, mas o acesso ao portal está desativado. Ative o acesso na ficha do cliente.',
      '/crm/clientes/' || v_cli.id
    );

    RETURN jsonb_build_object('ok', false, 'error', 'Seu acesso ainda não foi liberado. Solicite ao seu correspondente a liberação do Portal do Cliente.');
  END IF;

  -- Caso 2: credenciais inválidas (não existe, ou data não confere).
  IF v_cli.id IS NULL
     OR v_cli.ativo IS NOT TRUE
     OR v_cli.portal_acesso_ativo IS NOT TRUE
     OR v_cli.data_nascimento::text IS DISTINCT FROM _data_nasc THEN

    -- Se o documento existe mas a data não confere, avisa o responsável para diagnóstico.
    SELECT id, correspondente_id, nome, responsavel_id
    INTO v_doc_existe
    FROM public.clientes
    WHERE documento = _documento AND tipo_pessoa = _tipo::public.tipo_pessoa
      AND ativo IS TRUE AND portal_acesso_ativo IS TRUE
    LIMIT 1;

    INSERT INTO public.cliente_app_acessos (cliente_id, documento_hash, tipo_acesso, sucesso, motivo_bloqueio, ip, user_agent)
    VALUES (v_doc_existe.id, _doc_hash, 'login', false,
            CASE WHEN v_doc_existe.id IS NOT NULL THEN 'data_incorreta' ELSE 'credenciais_invalidas' END,
            _ip, _ua);

    IF v_doc_existe.id IS NOT NULL THEN
      PERFORM public.emitir_notificacao(
        v_doc_existe.responsavel_id,
        v_doc_existe.correspondente_id,
        'cliente.login_falha',
        'Falha de acesso do cliente ao App',
        'O cliente ' || COALESCE(v_doc_existe.nome, '') || ' tentou acessar o App, mas a data informada não confere com o cadastro. Confira a data de nascimento/abertura na ficha.',
        '/crm/clientes/' || v_doc_existe.id
      );
      RETURN jsonb_build_object('ok', false, 'error', 'A data informada não confere com o seu cadastro. Verifique a data de nascimento e tente novamente.');
    END IF;

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