-- Auditoria adversarial rodada 2 (eco-aud2). Teste pgTAP 763 do Agilliza Tech.
--
--   1. Arquivos: quem só tinha "ver" subia objeto no bucket (a política de envio pedia 'view'):
--      o arquivo nunca era registrado (arquivos_registrar exige criar) e ficava órfão. Agora o
--      envio exige "Arquivos › criar".
--   2. Demanda criada à mão com conta do Agilliza Tech: devolvia nome/tipo/vínculo de QUALQUER
--      conta pelo id. Agora passa pela versão de plataforma.conta_para_demanda que confere a pessoa.
-- Funções existentes alteradas: public.demanda_criar (uma linha). Política: "Arquivos storage:
-- enviar na pasta do correspondente".

drop policy if exists "Arquivos storage: enviar na pasta do correspondente" on storage.objects;
create policy "Arquivos storage: enviar na pasta do correspondente" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'arquivos'
              and (storage.foldername(name))[1] = public.correspondente_do_usuario((select auth.uid()))::text
              and public.usuario_tem_permissao((select auth.uid()), 'documentos.arquivos', 'create'));

/** Nome e vínculo de uma conta do Agilliza Tech, só se a pessoa pode vê-la. */
create or replace function public._demanda_conta_da_pessoa(p_conta uuid, p_auth uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v jsonb;
begin
  if p_conta is null or p_auth is null or to_regprocedure('plataforma.conta_para_demanda(uuid,uuid)') is null then
    return null;
  end if;
  begin
    execute 'select plataforma.conta_para_demanda($1, $2)' into v using p_conta, p_auth;
  exception when others then
    return null;
  end;
  return v;
end $$;
revoke all on function public._demanda_conta_da_pessoa(uuid, uuid) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.demanda_criar(p jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  s record;
  v_tipo text := nullif(btrim(p ->> 'tipo'), '');
  v_titulo text := btrim(coalesce(p ->> 'titulo', ''));
  v_desc text := nullif(btrim(coalesce(p ->> 'descricao', '')), '');
  v_prio text := coalesce(nullif(p ->> 'prioridade', ''), 'p2');
  v_cliente uuid := nullif(p ->> 'cliente_id', '')::uuid;
  v_proposta uuid := nullif(p ->> 'proposta_id', '')::uuid;
  v_simulacao uuid := nullif(p ->> 'simulacao_id', '')::uuid;
  v_resp uuid := nullif(p ->> 'responsavel_id', '')::uuid;
  v_fila uuid := nullif(p ->> 'fila_id', '')::uuid;
  v_conta uuid := nullif(p ->> 'conta_id', '')::uuid;
  v_conta_info jsonb;
  v_origem text := 'interno';
  v_conta_nome text;
  v_part uuid[];
  v_id uuid;
begin
  select * into s from public._demanda_sessao();
  if not public.usuario_tem_permissao(s.u, 'operacional.demandas', 'create') then
    raise exception 'Você não tem permissão para criar demandas.' using errcode = '42501';
  end if;
  if v_tipo is null or not exists (select 1 from public.demanda_tipos_do_correspondente(s.corr) t
                                    where t.codigo = v_tipo and t.ativo) then
    raise exception 'Escolha um tipo de demanda ativo.' using errcode = '22023';
  end if;
  if length(v_titulo) < 2 or length(v_titulo) > 160 then
    raise exception 'O título vai de 2 a 160 letras.' using errcode = '22023';
  end if;
  if v_desc is not null and length(v_desc) > 4000 then
    raise exception 'A descrição passa de 4.000 letras.' using errcode = '22023';
  end if;
  if v_prio not in ('p1', 'p2', 'p3') then
    raise exception 'Prioridade inválida.' using errcode = '22023';
  end if;
  if v_cliente is not null and not exists (select 1 from public.clientes where id = v_cliente and correspondente_id = s.corr) then
    raise exception 'Cliente fora do seu ecossistema.' using errcode = '42501';
  end if;
  if v_proposta is not null and not exists (select 1 from public.propostas where id = v_proposta and correspondente_id = s.corr) then
    raise exception 'Proposta fora do seu ecossistema.' using errcode = '42501';
  end if;
  if v_simulacao is not null and not exists (select 1 from public.simulacoes where id = v_simulacao and correspondente_id = s.corr) then
    raise exception 'Simulação fora do seu ecossistema.' using errcode = '42501';
  end if;
  if v_resp is not null and not public._demanda_pessoa_ativa(v_resp, s.corr) then
    raise exception 'Responsável fora do seu ecossistema.' using errcode = '42501';
  end if;
  if v_fila is not null and not exists (select 1 from public.demanda_filas where id = v_fila and correspondente_id = s.corr and ativa) then
    raise exception 'Fila inválida.' using errcode = '22023';
  end if;
  if v_conta is not null then
    -- 20261027120003: a conta só aparece para quem pode vê-la (plataforma.conta_para_demanda com a pessoa).
    v_conta_info := public._demanda_conta_da_pessoa(v_conta, s.u);
    if v_conta_info is null then
      raise exception 'Conta do Agilliza Tech não encontrada.' using errcode = '22023';
    end if;
    v_origem := case when coalesce((v_conta_info ->> 'vinculo')::boolean, false) then 'vinculado' else 'assinante' end;
    v_conta_nome := left(v_conta_info ->> 'nome', 200);
  end if;
  select coalesce(array_agg(distinct x::uuid), '{}') into v_part
    from jsonb_array_elements_text(coalesce(p -> 'participantes', '[]'::jsonb)) x;
  if cardinality(v_part) > 20 then
    raise exception 'No máximo 20 participantes.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_part) x where not public._demanda_pessoa_ativa(x, s.corr)) then
    raise exception 'Há participantes fora do seu ecossistema.' using errcode = '42501';
  end if;

  insert into public.demandas (correspondente_id, tipo, titulo, descricao, prioridade, cliente_id, proposta_id,
                               simulacao_id, responsavel_id, criador_id, origem, origem_tipo, conta_id, conta_nome,
                               fila_id, atribuicao_motivo, atribuida_em)
  values (s.corr, v_tipo, v_titulo, v_desc, v_prio::public.prioridade_op, v_cliente, v_proposta, v_simulacao,
          v_resp, s.u, 'manual', v_origem, v_conta, v_conta_nome, v_fila,
          case when v_resp is not null then 'escolhido' end, case when v_resp is not null then now() end)
  returning id into v_id;

  insert into public.demanda_participantes (demanda_id, user_id)
  select v_id, x from unnest(v_part) x where x <> s.u and x is distinct from v_resp;

  if v_resp is not null then
    insert into public.demanda_pessoas (user_id, correspondente_id, ultima_atribuicao_em)
    values (v_resp, s.corr, now())
    on conflict (user_id) do update set ultima_atribuicao_em = now();
  else
    perform public.demanda_distribuir(v_id, null, s.u);
  end if;
  return v_id;
end $function$
;

