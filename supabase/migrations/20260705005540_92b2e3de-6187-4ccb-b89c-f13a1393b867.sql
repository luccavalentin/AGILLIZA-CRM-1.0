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
  v_data_ref date;
  v_data_txt text;
  v_data_confere boolean := false;
BEGIN
  v_data_txt := trim(COALESCE(_data_nasc, ''));

  BEGIN
    IF v_data_txt ~ '^\d{4}-\d{2}-\d{2}$' THEN
      v_data_ref := v_data_txt::date;
      IF to_char(v_data_ref, 'YYYY-MM-DD') <> v_data_txt THEN
        v_data_ref := NULL;
      END IF;
    ELSIF v_data_txt ~ '^\d{2}/\d{2}/\d{4}$' THEN
      v_data_ref := to_date(v_data_txt, 'DD/MM/YYYY');
      IF to_char(v_data_ref, 'DD/MM/YYYY') <> v_data_txt THEN
        v_data_ref := NULL;
      END IF;
    ELSIF v_data_txt ~ '^\d{2}-\d{2}-\d{4}$' THEN
      v_data_ref := to_date(v_data_txt, 'DD-MM-YYYY');
      IF to_char(v_data_ref, 'DD-MM-YYYY') <> v_data_txt THEN
        v_data_ref := NULL;
      END IF;
    ELSE
      v_data_ref := NULL;
    END IF;
  EXCEPTION WHEN others THEN
    v_data_ref := NULL;
  END;

  SELECT id, correspondente_id, nome, tipo_pessoa, foto_url, data_nascimento, portal_acesso_ativo, ativo, lgpd_aceite_em, responsavel_id
  INTO v_cli
  FROM public.clientes
  WHERE documento = regexp_replace(_documento, '\D', '', 'g')
    AND tipo_pessoa = _tipo::public.tipo_pessoa
  LIMIT 1;

  v_data_confere := v_cli.id IS NOT NULL AND v_cli.data_nascimento IS NOT DISTINCT FROM v_data_ref;

  -- Documento + data corretos entram mesmo se houve erro anterior; evita bloquear cliente legítimo após digitação errada.
  IF v_cli.id IS NOT NULL
     AND v_data_confere
     AND v_cli.ativo IS TRUE
     AND v_cli.portal_acesso_ativo IS TRUE THEN
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
  END IF;

  SELECT
    count(*) FILTER (WHERE sucesso = false AND created_at >= now() - interval '24 hours'),
    count(*) FILTER (WHERE sucesso = false AND created_at >= now() - interval '15 minutes')
  INTO v_falhas24h, v_falhas15m
  FROM public.cliente_app_acessos
  WHERE documento_hash = _doc_hash;

  IF v_falhas24h >= 10 THEN
    INSERT INTO public.cliente_app_acessos (cliente_id, documento_hash, tipo_acesso, sucesso, motivo_bloqueio, ip, user_agent)
    VALUES (v_cli.id, _doc_hash, 'login', false, 'bloqueio_24h', _ip, _ua);
    RETURN jsonb_build_object('ok', false, 'error', 'Acesso temporariamente bloqueado. Tente novamente mais tarde.');
  END IF;

  IF v_falhas15m >= 5 THEN
    INSERT INTO public.cliente_app_acessos (cliente_id, documento_hash, tipo_acesso, sucesso, motivo_bloqueio, ip, user_agent)
    VALUES (v_cli.id, _doc_hash, 'login', false, 'rate_limit_15m', _ip, _ua);
    RETURN jsonb_build_object('ok', false, 'error', 'Muitas tentativas. Aguarde alguns minutos e tente novamente.');
  END IF;

  IF v_cli.id IS NOT NULL AND v_data_confere AND (v_cli.ativo IS NOT TRUE OR v_cli.portal_acesso_ativo IS NOT TRUE) THEN
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

  SELECT id, correspondente_id, nome, responsavel_id
  INTO v_doc_existe
  FROM public.clientes
  WHERE documento = regexp_replace(_documento, '\D', '', 'g')
    AND tipo_pessoa = _tipo::public.tipo_pessoa
    AND ativo IS TRUE
    AND portal_acesso_ativo IS TRUE
  LIMIT 1;

  INSERT INTO public.cliente_app_acessos (cliente_id, documento_hash, tipo_acesso, sucesso, motivo_bloqueio, ip, user_agent)
  VALUES (v_doc_existe.id, _doc_hash, 'login', false,
          CASE
            WHEN v_data_ref IS NULL THEN 'data_invalida'
            WHEN v_doc_existe.id IS NOT NULL THEN 'data_incorreta'
            ELSE 'credenciais_invalidas'
          END,
          _ip, _ua);

  IF v_data_ref IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Informe uma data válida no formato dia, mês e ano.');
  END IF;

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
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.portal_cliente_login(text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_cliente_login(text, text, text, text, text, text) TO anon, authenticated;