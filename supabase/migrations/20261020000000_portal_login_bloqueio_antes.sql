-- Login do Portal do Cliente (documento + data de nascimento).
--
-- Antes: documento + data corretos entravam mesmo durante o bloqueio por
-- tentativas, e "data não confere" × "dados não encontrados" revelava se o CPF
-- existia. Juntos, permitiam descobrir CPFs e testar datas sem limite real.
-- Agora o bloqueio vale para toda tentativa (inclusive a certa) e a resposta de
-- falha é a mesma para documento inexistente e data errada. O aviso interno ao
-- responsável (data errada / portal não liberado) continua.
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
  v_data_ref date;
  v_data_txt text;
  v_data_confere boolean := false;
  c_falha constant text := 'Documento ou data não conferem. Verifique as informações e tente novamente.';
BEGIN
  v_data_txt := trim(COALESCE(_data_nasc, ''));

  BEGIN
    IF v_data_txt ~ '^\d{4}-\d{2}-\d{2}$' THEN
      v_data_ref := v_data_txt::date;
      IF to_char(v_data_ref, 'YYYY-MM-DD') <> v_data_txt THEN v_data_ref := NULL; END IF;
    ELSIF v_data_txt ~ '^\d{2}/\d{2}/\d{4}$' THEN
      v_data_ref := to_date(v_data_txt, 'DD/MM/YYYY');
      IF to_char(v_data_ref, 'DD/MM/YYYY') <> v_data_txt THEN v_data_ref := NULL; END IF;
    ELSIF v_data_txt ~ '^\d{2}-\d{2}-\d{4}$' THEN
      v_data_ref := to_date(v_data_txt, 'DD-MM-YYYY');
      IF to_char(v_data_ref, 'DD-MM-YYYY') <> v_data_txt THEN v_data_ref := NULL; END IF;
    ELSE
      v_data_ref := NULL;
    END IF;
  EXCEPTION WHEN others THEN
    v_data_ref := NULL;
  END;

  IF v_data_ref IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Informe uma data válida no formato dia, mês e ano.');
  END IF;

  -- 1. Bloqueio por tentativas: vale para QUALQUER tentativa, inclusive a correta.
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
    RETURN jsonb_build_object('ok', false, 'error', 'Muitas tentativas. Aguarde 15 minutos e tente novamente.');
  END IF;

  SELECT id, correspondente_id, nome, tipo_pessoa, foto_url, data_nascimento, portal_acesso_ativo, ativo, lgpd_aceite_em, responsavel_id
  INTO v_cli
  FROM public.clientes
  WHERE documento = regexp_replace(_documento, '\D', '', 'g')
    AND tipo_pessoa = _tipo::public.tipo_pessoa
    AND deleted_at IS NULL
  LIMIT 1;

  v_data_confere := v_cli.id IS NOT NULL AND v_cli.data_nascimento IS NOT DISTINCT FROM v_data_ref;

  -- 2. Sucesso.
  IF v_data_confere AND v_cli.ativo IS TRUE AND v_cli.portal_acesso_ativo IS TRUE THEN
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

  -- 3. Dados certos, portal não liberado: quem acertou a data já é o cliente.
  IF v_data_confere AND (v_cli.ativo IS NOT TRUE OR v_cli.portal_acesso_ativo IS NOT TRUE) THEN
    INSERT INTO public.cliente_app_acessos (cliente_id, documento_hash, tipo_acesso, sucesso, motivo_bloqueio, ip, user_agent)
    VALUES (v_cli.id, _doc_hash, 'login', false, 'portal_nao_liberado', _ip, _ua);
    PERFORM public.emitir_notificacao(
      v_cli.responsavel_id, v_cli.correspondente_id, 'cliente.login_bloqueado',
      'Cliente tentou acessar o App sem liberação',
      'O cliente ' || COALESCE(v_cli.nome, '') || ' tentou entrar no App do Cliente, mas o acesso ao portal está desativado. Ative o acesso na ficha do cliente.',
      '/crm/clientes/' || v_cli.id
    );
    RETURN jsonb_build_object('ok', false, 'error', 'Seu acesso ainda não foi liberado. Solicite ao seu correspondente a liberação do Portal do Cliente.');
  END IF;

  -- 4. Falha: mesma resposta para documento inexistente e data errada.
  INSERT INTO public.cliente_app_acessos (cliente_id, documento_hash, tipo_acesso, sucesso, motivo_bloqueio, ip, user_agent)
  VALUES (v_cli.id, _doc_hash, 'login', false,
          CASE WHEN v_cli.id IS NOT NULL THEN 'data_incorreta' ELSE 'credenciais_invalidas' END,
          _ip, _ua);

  IF v_cli.id IS NOT NULL AND v_cli.portal_acesso_ativo IS TRUE THEN
    PERFORM public.emitir_notificacao(
      v_cli.responsavel_id, v_cli.correspondente_id, 'cliente.login_falha',
      'Falha de acesso do cliente ao App',
      'O cliente ' || COALESCE(v_cli.nome, '') || ' tentou acessar o App, mas a data informada não confere com o cadastro. Confira a data de nascimento/abertura na ficha.',
      '/crm/clientes/' || v_cli.id
    );
  END IF;

  RETURN jsonb_build_object('ok', false, 'error', c_falha);
END;
$function$;
