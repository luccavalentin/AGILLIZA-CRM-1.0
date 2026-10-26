-- Pedido de matrícula vira Demanda "Matrícula" e o assinante baixa a matrícula pronta
-- (pendências C36/C40 da frente a4, 26/10/2026).
--
-- 1. Cada pedido de matrícula (Agilliza, ou do assinante pelo portal) gera UMA demanda do tipo
--    "matrícula" (índice único ref_tipo + ref_id): ela passa pelo analista da conta ou pela
--    fila justa. Quem assume a matrícula vira o responsável da demanda; matrícula concluída
--    conclui a demanda; cancelada cancela. Falha na demanda nunca trava a matrícula.
-- 2. Download pelo portal do assinante: o Agilliza Tech pede um "vale" de uso único (2 min)
--    para a matrícula concluída de um pedido da conta (função do Agilliza Tech 0323 confere
--    quem pediu). O servidor do Agilliza troca o vale por uma URL assinada de 60 s do bucket
--    privado `matriculas`. O vale não serve para outra matrícula, vence e não se reusa.

-- ---------------------------------------------------------------------------
-- 1. Matrícula → demanda
-- ---------------------------------------------------------------------------
create or replace function public._matricula_para_demanda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.demandas%rowtype;
  v_id uuid;
  v_conta jsonb;
  v_origem text := 'interno';
  v_alvo text;
begin
  -- Registro antigo lançado já concluído (sem pedido): não vira demanda.
  if tg_op = 'INSERT' and new.status in ('concluida', 'cancelada') then
    return null;
  end if;
  begin
    select * into d from public.demandas where ref_tipo = 'matricula' and ref_id = new.id for update;
    if not found then
      if new.status in ('concluida', 'cancelada') then return null; end if;
      if new.solicitante_tipo = 'assinante' then
        v_conta := public._demanda_conta(new.solicitante_conta_id);
        v_origem := case when coalesce((v_conta ->> 'vinculo')::boolean, false) then 'vinculado' else 'assinante' end;
      end if;
      insert into public.demandas (correspondente_id, tipo, titulo, descricao, prioridade, criador_id, origem,
                                   origem_tipo, conta_id, conta_nome, solicitante_nome, ref_tipo, ref_id,
                                   ref_codigo, ref_status)
      values (new.correspondente_id, 'matricula',
              left('Matrícula ' || coalesce(new.numero_matricula, 's/ número') || ' — ' || coalesce(new.cartorio, 'cartório'), 160),
              concat_ws(E'\n',
                'Pedido de ' || coalesce(new.solicitante_conta_nome, new.solicitante, 'solicitante') || '.',
                case when new.imovel is not null then 'Imóvel: ' || new.imovel end,
                case when new.cidade_uf is not null then 'Cidade: ' || new.cidade_uf end,
                case when new.cliente is not null then 'Cliente: ' || new.cliente end,
                new.observacao),
              'p2', new.criado_por, 'matricula', v_origem,
              case when new.solicitante_tipo = 'assinante' then new.solicitante_conta_id end,
              case when new.solicitante_tipo = 'assinante' then new.solicitante_conta_nome end,
              left(coalesce(new.solicitante_conta_nome, new.solicitante), 200),
              'matricula', new.id, left(new.numero_matricula, 40), new.status)
      on conflict (ref_tipo, ref_id) where ref_id is not null do nothing
      returning id into v_id;
      if v_id is null then
        select * into d from public.demandas where ref_tipo = 'matricula' and ref_id = new.id for update;
      else
        if new.analista_id is not null and public._demanda_pessoa_ativa(new.analista_id, new.correspondente_id) then
          perform public._demanda_atribuir(v_id, new.analista_id, 'assumida', new.analista_id,
                                           'Assumiu o pedido de matrícula.', null);
          update public.demandas set status = 'em_andamento' where id = v_id and status = 'aberta';
        else
          perform public.demanda_distribuir(v_id, null, null);
        end if;
        return null;
      end if;
    end if;
    if d.deleted_at is not null then return null; end if;

    update public.demandas set ref_status = new.status where id = d.id and ref_status is distinct from new.status;
    -- Quem assumiu a matrícula é quem atende a demanda.
    if new.analista_id is not null and new.analista_id is distinct from d.responsavel_id
       and d.status not in ('concluida', 'cancelada')
       and public._demanda_pessoa_ativa(new.analista_id, d.correspondente_id) then
      perform public._demanda_atribuir(d.id, new.analista_id, 'assumida', new.analista_id,
                                       'Assumiu o pedido de matrícula.', null);
    end if;
    v_alvo := case new.status when 'concluida' then 'concluida' when 'cancelada' then 'cancelada'
                              when 'em_andamento' then 'em_andamento' when 'aguardando_recarga' then 'em_andamento' end;
    select * into d from public.demandas where id = d.id;
    if v_alvo is not null and v_alvo <> d.status::text and public.demanda_transicao_permitida(d.status::text, v_alvo) then
      update public.demandas
         set status = v_alvo::public.demanda_status,
             concluida_em = case when v_alvo = 'concluida' then now() else concluida_em end
       where id = d.id;
      insert into public.demanda_historico (demanda_id, ator_id, acao, detalhe, dados)
      values (d.id, new.analista_id, 'status', v_alvo,
              jsonb_build_object('origem', 'matricula', 'status_matricula', new.status));
      if v_alvo in ('concluida', 'cancelada') then
        perform public.demanda_distribuir_pendentes(d.correspondente_id);
      end if;
    end if;
  exception when others then
    raise warning 'Demanda da matrícula % não acompanhou: %', new.id, sqlerrm;
  end;
  return null;
end $$;

revoke all on function public._matricula_para_demanda() from public, anon, authenticated;

drop trigger if exists trg_matricula_vira_demanda on public.matricula_solicitacoes;
create trigger trg_matricula_vira_demanda
  after insert or update of status, analista_id on public.matricula_solicitacoes
  for each row execute function public._matricula_para_demanda();

-- Pedidos em aberto que já existiam ganham a demanda agora (uma vez: o índice único segura).
do $$
declare r record;
begin
  for r in select id from public.matricula_solicitacoes
            where status in ('pedida', 'em_andamento', 'aguardando_recarga')
              and not exists (select 1 from public.demandas d where d.ref_tipo = 'matricula'
                                                               and d.ref_id = matricula_solicitacoes.id)
  loop
    -- "update of status" dispara mesmo sem mudança de valor; a demanda nasce uma vez (índice único).
    update public.matricula_solicitacoes set status = status where id = r.id;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Vale de download da matrícula concluída (portal do assinante)
-- ---------------------------------------------------------------------------
create table if not exists public.matricula_downloads (
  token          text primary key,
  solicitacao_id uuid not null references public.matricula_solicitacoes (id) on delete cascade,
  criado_em      timestamptz not null default now(),
  expira_em      timestamptz not null,
  usado_em       timestamptz
);
comment on table public.matricula_downloads is
  'Vale de uso único (2 min) para baixar a matrícula concluída pelo portal do assinante. Só funções.';
create index if not exists matricula_downloads_expira on public.matricula_downloads (expira_em);
alter table public.matricula_downloads enable row level security;
revoke all on public.matricula_downloads from public, anon, authenticated;
grant all on public.matricula_downloads to service_role;

/**
 * Emite o vale para a matrícula concluída (com arquivo) de uma solicitação. Quem chama é a
 * função do Agilliza Tech (0323), que já conferiu que o pedido é da conta e de quem pediu.
 */
create or replace function public.matricula_emitir_download(p_solicitacao uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.matricula_solicitacoes%rowtype;
  v_token text;
begin
  select * into r from public.matricula_solicitacoes where id = p_solicitacao;
  if not found or r.solicitante_tipo <> 'assinante' then
    raise exception 'Matrícula não encontrada.' using errcode = 'P0002';
  end if;
  if r.status <> 'concluida' or r.arquivo_path is null then
    raise exception 'A matrícula ainda não está pronta para baixar.' using errcode = '55000';
  end if;
  -- Limpa vales vencidos (a tabela não cresce).
  delete from public.matricula_downloads where expira_em < now() - interval '1 day';
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.matricula_downloads (token, solicitacao_id, expira_em)
  values (v_token, p_solicitacao, now() + interval '2 minutes');
  return v_token;
end $$;

/** O servidor do Agilliza troca o vale (uma vez só) pelo caminho do arquivo. */
create or replace function public.matricula_resgatar_download(p_token text)
returns table (caminho text, nome text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sol uuid;
begin
  if p_token is null or p_token !~ '^[0-9a-f]{48}$' then
    return;
  end if;
  update public.matricula_downloads
     set usado_em = now()
   where token = p_token and usado_em is null and expira_em > now()
  returning solicitacao_id into v_sol;
  if v_sol is null then return; end if;
  return query
  select s.arquivo_path, coalesce(s.arquivo_nome, 'matricula-' || coalesce(s.numero_matricula, s.id::text) || '.pdf')
    from public.matricula_solicitacoes s
   where s.id = v_sol and s.status = 'concluida' and s.arquivo_path is not null;
end $$;

revoke all on function public.matricula_emitir_download(uuid) from public, anon, authenticated;
revoke all on function public.matricula_resgatar_download(text) from public, anon, authenticated;
grant execute on function public.matricula_emitir_download(uuid) to service_role;
grant execute on function public.matricula_resgatar_download(text) to service_role;
