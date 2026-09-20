-- Portal do cliente deixa de mostrar proposta excluída.
--
-- `portal_acompanhamento` montava o "Resumo do status" com a proposta mais
-- recente do cliente sem olhar `deleted_at`, e `portal_visao_geral` listava as
-- propostas ativas do mesmo jeito: 1 dos 4 clientes com portal ligado via no
-- app uma proposta que já estava na lixeira (QA 19/09/2026). Mesma correção já
-- feita nos relatórios e nos seletores (34e646c2).
--
-- As trocas são pontuais e a migração se recusa a rodar se o texto esperado
-- não estiver lá — o resto do corpo das funções fica idêntico.

do $$
declare d text; antes int; depois int;
begin
  -- portal_acompanhamento: resumo do status
  d := pg_get_functiondef('public.portal_acompanhamento(uuid)'::regprocedure);
  antes := (length(d) - length(replace(d, 'deleted_at', '')))/10;
  d := replace(d,
    'WHERE pr.cliente_id = _cid
  ORDER BY pr.created_at DESC
  LIMIT 1;',
    'WHERE pr.cliente_id = _cid AND pr.deleted_at IS NULL
  ORDER BY pr.created_at DESC
  LIMIT 1;');
  depois := (length(d) - length(replace(d, 'deleted_at', '')))/10;
  if depois <> antes + 1 then
    raise exception 'portal_acompanhamento: troca não aplicada (% -> %)', antes, depois;
  end if;
  execute d;

  -- portal_visao_geral: propostas ativas e responsável pelo atendimento
  d := pg_get_functiondef('public.portal_visao_geral(uuid)'::regprocedure);
  antes := (length(d) - length(replace(d, 'deleted_at', '')))/10;
  d := replace(d,
    'INTO v_props FROM public.propostas
  WHERE cliente_id = _cid
    AND status IN (',
    'INTO v_props FROM public.propostas
  WHERE cliente_id = _cid
    AND deleted_at IS NULL
    AND status IN (');
  d := replace(d,
    'FROM public.propostas pr
  WHERE pr.cliente_id = _cid
    AND COALESCE(pr.usuario_responsavel_id, pr.usuario_criador_id) IS NOT NULL',
    'FROM public.propostas pr
  WHERE pr.cliente_id = _cid
    AND pr.deleted_at IS NULL
    AND COALESCE(pr.usuario_responsavel_id, pr.usuario_criador_id) IS NOT NULL');
  depois := (length(d) - length(replace(d, 'deleted_at', '')))/10;
  if depois <> antes + 2 then
    raise exception 'portal_visao_geral: trocas não aplicadas (% -> %)', antes, depois;
  end if;
  execute d;
end $$;
