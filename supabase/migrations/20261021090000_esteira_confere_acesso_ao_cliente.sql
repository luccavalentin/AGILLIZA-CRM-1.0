-- Esteira: as duas funções que movem a etapa do cliente passam a conferir quem chama.
--
-- cliente_pipeline_definir e cliente_pipeline_avancar_para são SECURITY DEFINER,
-- não conferiam o usuário e estavam abertas a PUBLIC/anon: qualquer sessão (até sem
-- login) movia a etapa de qualquer cliente, inclusive de outro correspondente
-- (QA 21/10/2026). Agora:
--   - EXECUTE só para authenticated e service_role;
--   - chamada direta por usuário logado exige usuario_tem_acesso_cliente.
-- Chamadas de dentro de gatilhos (proposta/simulação/endereço/contrato) e do
-- servidor sem sessão (auth.uid() nulo, service_role) seguem como antes: quem
-- disparou já passou pela RLS da tabela de origem.
--
-- Também troca a ação 'update' (que não existe na matriz) por 'edit' em
-- crm_transferir_atendimento e nas políticas de cliente_parceiros: com 'update'
-- a permissão "Editar" de Clientes nunca valia ali.

create or replace function public.cliente_pipeline_definir(_cliente_id uuid, _codigo_destino text, _obs text default null::text)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_dest record;
begin
  if pg_trigger_depth() = 0
     and auth.uid() is not null
     and not public.usuario_tem_acesso_cliente(auth.uid(), _cliente_id) then
    raise exception 'Sem acesso a este cliente.' using errcode = '42501';
  end if;

  select * into v_dest from public.pipeline_stages where codigo = _codigo_destino;
  if not found then return; end if;

  insert into public.cliente_pipeline (cliente_id, stage_id, ultima_atualizacao_em)
  values (_cliente_id, v_dest.id, now())
  on conflict (cliente_id) do update set stage_id = excluded.stage_id, ultima_atualizacao_em = now();

  insert into public.cliente_pipeline_historico (cliente_id, stage_id, acao, observacao, mensagem_cliente, enviar_ao_cliente)
  values (_cliente_id, v_dest.id, 'manual', _obs, v_dest.mensagem_cliente, true);

  insert into public.cliente_historico (cliente_id, tipo, descricao)
  values (_cliente_id, 'etapa', 'Etapa alterada para ' || v_dest.nome);
end;
$function$;

create or replace function public.cliente_pipeline_avancar_para(_cliente_id uuid, _codigo_destino text, _acao text default null, _obs text default null)
 returns void
 language plpgsql
 security definer
 set search_path = public
as $function$
declare
  v_dest record;
  v_ordem_atual int;
begin
  if pg_trigger_depth() = 0
     and auth.uid() is not null
     and not public.usuario_tem_acesso_cliente(auth.uid(), _cliente_id) then
    raise exception 'Sem acesso a este cliente.' using errcode = '42501';
  end if;

  select * into v_dest from public.pipeline_stages where codigo = _codigo_destino;
  if not found then return; end if;
  select ps.ordem into v_ordem_atual
  from public.cliente_pipeline cp join public.pipeline_stages ps on ps.id = cp.stage_id
  where cp.cliente_id = _cliente_id;
  if v_ordem_atual is not null and v_dest.ordem <= v_ordem_atual then
    return;
  end if;
  insert into public.cliente_pipeline (cliente_id, stage_id, ultima_atualizacao_em)
  values (_cliente_id, v_dest.id, now())
  on conflict (cliente_id) do update set stage_id = excluded.stage_id, ultima_atualizacao_em = now();
  insert into public.cliente_pipeline_historico (cliente_id, stage_id, acao, observacao, mensagem_cliente, enviar_ao_cliente)
  values (_cliente_id, v_dest.id, coalesce(_acao,'avanco'), _obs, v_dest.mensagem_cliente, true);
  insert into public.cliente_historico (cliente_id, tipo, descricao)
  values (_cliente_id, 'etapa', 'Etapa alterada para ' || v_dest.nome);
end;
$function$;

revoke execute on function public.cliente_pipeline_definir(uuid, text, text) from public, anon;
revoke execute on function public.cliente_pipeline_avancar_para(uuid, text, text, text) from public, anon;
grant execute on function public.cliente_pipeline_definir(uuid, text, text) to authenticated, service_role;
grant execute on function public.cliente_pipeline_avancar_para(uuid, text, text, text) to authenticated, service_role;

-- Transferir atendimento: 'update' -> 'edit' (corpo igual ao de 20260729142757).
create or replace function public.crm_transferir_atendimento(
  _cliente_id uuid,
  _novo_responsavel uuid,
  _observacao text default null
)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_solicitante uuid := auth.uid();
  v_corr uuid;
  v_atual uuid;
  v_novo_corr uuid;
  v_novo_nome text;
  v_cli_nome text;
begin
  if v_solicitante is null then
    raise exception 'Sessão inválida.';
  end if;

  select correspondente_id, responsavel_id, nome
    into v_corr, v_atual, v_cli_nome
    from public.clientes where id = _cliente_id;
  if v_corr is null then
    raise exception 'Cliente não encontrado.';
  end if;

  if v_corr <> public.correspondente_do_usuario(v_solicitante) then
    raise exception 'Sem permissão para este cliente.';
  end if;

  if not (
    public.has_any_role(v_solicitante, array['admin','correspondente','gestor']::public.app_role[])
    or public.usuario_tem_permissao(v_solicitante, 'crm.clientes', 'edit')
  ) then
    raise exception 'Sem permissão para transferir atendimento.';
  end if;

  select correspondente_id, nome into v_novo_corr, v_novo_nome
    from public.profiles where id = _novo_responsavel;
  if v_novo_corr is null or v_novo_corr <> v_corr then
    raise exception 'Usuário destino inválido.';
  end if;

  if v_atual = _novo_responsavel then
    return jsonb_build_object('ok', true, 'inalterado', true);
  end if;

  update public.clientes
     set responsavel_id = _novo_responsavel,
         updated_at = now()
   where id = _cliente_id;

  insert into public.cliente_historico (cliente_id, tipo, descricao, ator_id, metadata)
  values (
    _cliente_id,
    'transferencia',
    'Atendimento transferido para ' || coalesce(v_novo_nome,'usuário') ||
      case when _observacao is not null and length(trim(_observacao))>0
           then ' — ' || _observacao else '' end,
    v_solicitante,
    jsonb_build_object('responsavel_anterior', v_atual, 'responsavel_novo', _novo_responsavel)
  );

  perform public.emitir_notificacao(
    _novo_responsavel, v_corr, 'cliente.transferido',
    'Novo atendimento atribuído a você',
    'Você recebeu o atendimento do cliente ' || coalesce(v_cli_nome, ''),
    '/crm/clientes/' || _cliente_id
  );

  return jsonb_build_object('ok', true, 'responsavel_id', _novo_responsavel);
end;
$function$;

revoke execute on function public.crm_transferir_atendimento(uuid, uuid, text) from public, anon;
grant execute on function public.crm_transferir_atendimento(uuid, uuid, text) to authenticated;

-- cliente_parceiros: mesmas políticas de 20260919070000, com 'edit' no lugar de 'update'.
drop policy if exists "cliente_parceiros insert" on public.cliente_parceiros;
drop policy if exists "cliente_parceiros update" on public.cliente_parceiros;
drop policy if exists "cliente_parceiros delete" on public.cliente_parceiros;
create policy "cliente_parceiros insert" on public.cliente_parceiros
  for insert to public with check (
    correspondente_id = correspondente_do_usuario((select auth.uid()))
    and (usuario_pode_admin((select auth.uid()))
         or usuario_tem_permissao((select auth.uid()), 'crm.clientes', 'edit')
         or usuario_tem_permissao((select auth.uid()), 'crm.clientes', 'create')
         or usuario_tem_acesso_cliente((select auth.uid()), cliente_id)));
create policy "cliente_parceiros update" on public.cliente_parceiros
  for update to public using (
    correspondente_id = correspondente_do_usuario((select auth.uid()))
    and (usuario_pode_admin((select auth.uid()))
         or usuario_tem_permissao((select auth.uid()), 'crm.clientes', 'edit')
         or usuario_tem_permissao((select auth.uid()), 'crm.clientes', 'create')
         or usuario_tem_acesso_cliente((select auth.uid()), cliente_id)))
  with check (
    correspondente_id = correspondente_do_usuario((select auth.uid()))
    and (usuario_pode_admin((select auth.uid()))
         or usuario_tem_permissao((select auth.uid()), 'crm.clientes', 'edit')
         or usuario_tem_permissao((select auth.uid()), 'crm.clientes', 'create')
         or usuario_tem_acesso_cliente((select auth.uid()), cliente_id)));
create policy "cliente_parceiros delete" on public.cliente_parceiros
  for delete to public using (
    correspondente_id = correspondente_do_usuario((select auth.uid()))
    and (usuario_pode_admin((select auth.uid()))
         or usuario_tem_permissao((select auth.uid()), 'crm.clientes', 'edit')
         or usuario_tem_permissao((select auth.uid()), 'crm.clientes', 'create')
         or usuario_tem_acesso_cliente((select auth.uid()), cliente_id)));
