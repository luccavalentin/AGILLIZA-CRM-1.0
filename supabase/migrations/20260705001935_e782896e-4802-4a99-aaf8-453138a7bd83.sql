
-- ============================================================
-- Portal do Cliente: RPCs SECURITY DEFINER (sem service role)
-- ============================================================

-- Login: verifica tentativas, valida credenciais e registra acesso.
CREATE OR REPLACE FUNCTION public.portal_cliente_login(
  _documento text,
  _tipo text,
  _data_nasc text,
  _doc_hash text,
  _ip text,
  _ua text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  SELECT id, correspondente_id, nome, tipo_pessoa, foto_url, data_nascimento, portal_acesso_ativo, ativo
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
    'cliente', jsonb_build_object(
      'id', v_cli.id, 'nome', v_cli.nome, 'tipo_pessoa', v_cli.tipo_pessoa, 'foto_url', v_cli.foto_url
    )
  );
END;
$$;

-- Sessão: retorna dados públicos se o cliente ainda tem acesso ativo.
CREATE OR REPLACE FUNCTION public.portal_cliente_sessao(_cid uuid)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN c.id IS NULL OR c.ativo IS NOT TRUE OR c.portal_acesso_ativo IS NOT TRUE THEN NULL
    ELSE jsonb_build_object('id', c.id, 'nome', c.nome, 'tipo_pessoa', c.tipo_pessoa, 'foto_url', c.foto_url)
  END
  FROM (SELECT NULL::uuid) z
  LEFT JOIN public.clientes c ON c.id = _cid;
$$;

-- Visão geral completa do processo.
CREATE OR REPLACE FUNCTION public.portal_visao_geral(_cid uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ordem_atual int;
  v_total int;
  v_stage_nome text;
  v_stage_desc text;
  v_ultima timestamptz;
  v_etapas jsonb;
  v_contato jsonb;
  v_props jsonb;
  v_docs jsonb;
  v_msgs int;
  v_notif int;
  v_resp uuid;
BEGIN
  SELECT count(*) INTO v_total FROM public.pipeline_stages;

  SELECT ps.ordem, ps.nome, ps.mensagem_cliente, cp.ultima_atualizacao_em
  INTO v_ordem_atual, v_stage_nome, v_stage_desc, v_ultima
  FROM public.cliente_pipeline cp
  JOIN public.pipeline_stages ps ON ps.id = cp.stage_id
  WHERE cp.cliente_id = _cid;

  IF v_ordem_atual IS NULL THEN
    SELECT ordem, nome, mensagem_cliente INTO v_ordem_atual, v_stage_nome, v_stage_desc
    FROM public.pipeline_stages ORDER BY ordem LIMIT 1;
    v_ordem_atual := COALESCE(v_ordem_atual, 0);
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'ordem', s.ordem,
    'nome', s.nome,
    'descricao_cliente', s.mensagem_cliente,
    'status', CASE WHEN s.ordem < v_ordem_atual THEN 'concluida' WHEN s.ordem = v_ordem_atual THEN 'atual' ELSE 'proxima' END,
    'concluida_em', CASE WHEN s.ordem < v_ordem_atual THEN (
      SELECT min(h.created_at) FROM public.cliente_pipeline_historico h WHERE h.cliente_id = _cid AND h.stage_id = s.id
    ) ELSE NULL END
  ) ORDER BY s.ordem)
  INTO v_etapas
  FROM public.pipeline_stages s;

  SELECT responsavel_id INTO v_resp FROM public.clientes WHERE id = _cid;
  IF v_resp IS NOT NULL THEN
    SELECT jsonb_build_object('nome', p.nome, 'foto_url', p.foto_url) INTO v_contato
    FROM public.profiles p WHERE p.id = v_resp;
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'id', id, 'banco', nome_banco, 'produto', produto, 'valor', valor_financiamento, 'status', status
  ) ORDER BY created_at DESC)
  INTO v_props FROM public.propostas WHERE cliente_id = _cid;

  SELECT jsonb_agg(jsonb_build_object(
    'id', id, 'tipo_documento', tipo_documento, 'nome_arquivo', nome_arquivo, 'status', status
  ))
  INTO v_docs FROM public.cliente_documentos WHERE cliente_id = _cid AND status IN ('pendente','reprovado');

  SELECT count(*) INTO v_msgs FROM public.cliente_app_mensagens
    WHERE cliente_id = _cid AND remetente_tipo = 'time' AND lida_em IS NULL;
  SELECT count(*) INTO v_notif FROM public.cliente_app_notificacoes
    WHERE cliente_id = _cid AND lida = false;

  RETURN jsonb_build_object(
    'ordem_atual', v_ordem_atual,
    'total', v_total,
    'etapa_atual', v_stage_nome,
    'descricao', v_stage_desc,
    'ultima_atualizacao', v_ultima,
    'etapas', COALESCE(v_etapas, '[]'::jsonb),
    'contato', v_contato,
    'propostas', COALESCE(v_props, '[]'::jsonb),
    'documentos_pendentes', COALESCE(v_docs, '[]'::jsonb),
    'mensagens_nao_lidas', v_msgs,
    'notificacoes_nao_lidas', v_notif
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_meus_documentos(_cid uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'tipo_documento', tipo_documento, 'nome_arquivo', nome_arquivo, 'status', status
  ) ORDER BY created_at DESC), '[]'::jsonb)
  FROM public.cliente_documentos WHERE cliente_id = _cid;
$$;

CREATE OR REPLACE FUNCTION public.portal_minhas_propostas(_cid uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'banco', nome_banco, 'produto', produto, 'valor', valor_financiamento, 'status', status
  ) ORDER BY created_at DESC), '[]'::jsonb)
  FROM public.propostas WHERE cliente_id = _cid;
$$;

CREATE OR REPLACE FUNCTION public.portal_listar_mensagens(_cid uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'remetente_tipo', remetente_tipo, 'mensagem', mensagem,
    'anexo_url', anexo_url, 'lida_em', lida_em, 'criada_em', criada_em
  ) ORDER BY criada_em ASC), '[]'::jsonb)
  FROM (SELECT * FROM public.cliente_app_mensagens WHERE cliente_id = _cid ORDER BY criada_em ASC LIMIT 500) m;
$$;

CREATE OR REPLACE FUNCTION public.portal_enviar_mensagem(_cid uuid, _corr uuid, _msg text, _anexo text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_nova RECORD;
BEGIN
  INSERT INTO public.cliente_app_mensagens (cliente_id, correspondente_id, remetente_tipo, remetente_id, mensagem, anexo_url)
  VALUES (_cid, _corr, 'cliente', _cid, _msg, _anexo)
  RETURNING id, remetente_tipo, mensagem, anexo_url, lida_em, criada_em INTO v_nova;
  RETURN jsonb_build_object(
    'id', v_nova.id, 'remetente_tipo', v_nova.remetente_tipo, 'mensagem', v_nova.mensagem,
    'anexo_url', v_nova.anexo_url, 'lida_em', v_nova.lida_em, 'criada_em', v_nova.criada_em
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_marcar_lida(_cid uuid, _ids uuid[])
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.cliente_app_mensagens SET lida_em = now()
  WHERE cliente_id = _cid AND remetente_tipo = 'time' AND id = ANY(_ids);
$$;

CREATE OR REPLACE FUNCTION public.portal_listar_notificacoes(_cid uuid)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'tipo', tipo, 'titulo', titulo, 'corpo', corpo, 'link', link, 'lida', lida, 'criada_em', criada_em
  ) ORDER BY criada_em DESC), '[]'::jsonb)
  FROM (SELECT * FROM public.cliente_app_notificacoes WHERE cliente_id = _cid ORDER BY criada_em DESC LIMIT 100) n;
$$;

CREATE OR REPLACE FUNCTION public.portal_marcar_notif_lida(_cid uuid, _id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.cliente_app_notificacoes SET lida = true WHERE cliente_id = _cid AND id = _id;
$$;

CREATE OR REPLACE FUNCTION public.portal_registrar_documento(
  _cid uuid, _tipo text, _nome text, _path text, _mime text, _tamanho bigint
) RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.cliente_documentos (cliente_id, categoria, tipo_documento, nome_arquivo, storage_path, mime_type, tamanho_bytes, status)
  VALUES (_cid, 'outros', _tipo, _nome, _path, _mime, _tamanho, 'recebido');
$$;

CREATE OR REPLACE FUNCTION public.portal_baixar_dados(_cid uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cli jsonb; v_docs jsonb; v_msgs jsonb;
BEGIN
  SELECT jsonb_build_object('nome', nome, 'tipo_pessoa', tipo_pessoa, 'email', email,
    'telefone_celular', telefone_celular, 'uf_interesse', uf_interesse, 'created_at', created_at)
  INTO v_cli FROM public.clientes WHERE id = _cid;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('tipo_documento', tipo_documento, 'nome_arquivo', nome_arquivo,
    'status', status, 'created_at', created_at)), '[]'::jsonb)
  INTO v_docs FROM public.cliente_documentos WHERE cliente_id = _cid;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('remetente_tipo', remetente_tipo, 'mensagem', mensagem,
    'criada_em', criada_em)), '[]'::jsonb)
  INTO v_msgs FROM public.cliente_app_mensagens WHERE cliente_id = _cid;

  RETURN jsonb_build_object('cliente', v_cli, 'documentos', v_docs, 'mensagens', v_msgs);
END;
$$;

CREATE OR REPLACE FUNCTION public.portal_solicitar_lgpd(_cid uuid, _corr uuid, _acao text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_cli RECORD; v_corr uuid; v_titulo text;
BEGIN
  SELECT nome, responsavel_id, correspondente_id INTO v_cli FROM public.clientes WHERE id = _cid;
  v_corr := COALESCE(v_cli.correspondente_id, _corr);
  IF v_corr IS NULL THEN RAISE EXCEPTION 'sem correspondente'; END IF;
  v_titulo := CASE WHEN _acao = 'exclusao' THEN 'Solicitação LGPD: exclusão de dados'
    ELSE 'Solicitação LGPD: portabilidade de dados' END;
  INSERT INTO public.demandas (correspondente_id, tipo, prioridade, titulo, descricao, cliente_id, responsavel_id, criador_id, status)
  VALUES (v_corr, 'lgpd', 'p2', v_titulo,
    'Cliente ' || COALESCE(v_cli.nome, _cid::text) || ' solicitou ' ||
      CASE WHEN _acao = 'exclusao' THEN 'a exclusão dos seus dados' ELSE 'a portabilidade (download) dos seus dados' END ||
      ' pelo App do Cliente. Encaminhar ao DPO.',
    _cid, v_cli.responsavel_id, v_cli.responsavel_id, 'aberta');
END;
$$;

-- Permissões: portal usa sessão própria (cookie), então chamadas via chave publishable (anon).
GRANT EXECUTE ON FUNCTION public.portal_cliente_login(text,text,text,text,text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_cliente_sessao(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_visao_geral(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_meus_documentos(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_minhas_propostas(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_listar_mensagens(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_enviar_mensagem(uuid,uuid,text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_marcar_lida(uuid,uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_listar_notificacoes(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_marcar_notif_lida(uuid,uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_registrar_documento(uuid,text,text,text,text,bigint) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_baixar_dados(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_solicitar_lgpd(uuid,uuid,text) TO anon, authenticated;
