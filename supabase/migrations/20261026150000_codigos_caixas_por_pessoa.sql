-- Códigos de acesso: cada pessoa vê só as caixas liberadas para ela
-- (decisão 16 do backtest de 23/10/2026, aprovada pelo dono em 26/10/2026).
--
-- Antes, quem tinha "Códigos de acesso › ver" via os códigos de TODAS as caixas
-- vigiadas. Modelo agora (o mais simples coerente com o que já existe):
--
--   · quem GERE as caixas (`operacional.codigos › editar`; administrador e
--     correspondente sempre) vê todas e escolhe, em cada caixa, quem mais vê;
--   · os demais da equipe interna, com `operacional.codigos › ver`, veem só as
--     caixas em que foram liberados;
--   · parceiro (portal do parceiro), desativado ou bloqueado não vê nenhuma,
--     mesmo liberado (a mesma trava que o servidor já fazia).
--
-- A regra mora no banco: as telas não leem as tabelas, chamam
-- `codigos_caixas_visiveis` / `codigos_recebidos_visiveis` com a pessoa logada, e
-- a liberação só é gravada por `codigos_definir_liberados`, que confere quem libera.
-- Tudo só para o client de serviço (servidor); nada abre para a API do navegador.

create table if not exists public.codigos_caixas_liberadas (
  caixa_id     uuid not null references public.codigos_caixas (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  liberado_por uuid,
  created_at   timestamptz not null default now(),
  primary key (caixa_id, user_id)
);
create index if not exists codigos_caixas_liberadas_user_idx on public.codigos_caixas_liberadas (user_id);

alter table public.codigos_caixas_liberadas enable row level security;
revoke all on public.codigos_caixas_liberadas from anon, authenticated;
grant all on public.codigos_caixas_liberadas to service_role;

/** Equipe interna ativa: parceiro, desativado, bloqueado ou excluído não entra. */
create or replace function public.codigos_equipe_interna(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
     where p.id = _user_id and p.acesso_tipo = 'sistema'
       and coalesce(p.ativo, false) and p.bloqueado_em is null and p.deleted_at is null
  );
$$;

/** Quem gere as caixas vê todas (e libera as outras pessoas). */
create or replace function public.codigos_ve_todas_caixas(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.codigos_equipe_interna(_user_id)
     and public.usuario_tem_permissao(_user_id, 'operacional.codigos', 'edit');
$$;

/** Ids das caixas que a pessoa pode ver: todas (quem gere) ou só as liberadas para ela. */
create or replace function public.codigos_caixas_visiveis(_user_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.id
    from public.codigos_caixas c
   where public.codigos_ve_todas_caixas(_user_id)
      or (public.codigos_equipe_interna(_user_id)
          and public.usuario_tem_permissao(_user_id, 'operacional.codigos', 'view')
          and exists (select 1 from public.codigos_caixas_liberadas l
                       where l.caixa_id = c.id and l.user_id = _user_id));
$$;

/** Códigos recebidos desde `_desde`, só das caixas que a pessoa pode ver. */
create or replace function public.codigos_recebidos_visiveis(_user_id uuid, _desde timestamptz, _limite int default 100)
returns table (
  id uuid,
  recebido_em timestamptz,
  remetente_nome text,
  remetente_email text,
  banco text,
  assunto text,
  trecho text,
  codigo text,
  caixa_email text
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id, r.recebido_em, r.remetente_nome, r.remetente_email, r.banco, r.assunto, r.trecho, r.codigo,
         c.email
    from public.codigos_recebidos r
    join public.codigos_caixas c on c.id = r.caixa_id
   where r.caixa_id in (select public.codigos_caixas_visiveis(_user_id))
     and r.recebido_em >= _desde
   order by r.recebido_em desc
   limit least(greatest(coalesce(_limite, 100), 1), 200);
$$;

/**
 * Define quem (além de quem gere as caixas) vê os códigos de uma caixa. Só quem gere
 * libera, e só pessoas da equipe interna do mesmo correspondente entram na lista.
 */
create or replace function public.codigos_definir_liberados(_caixa uuid, _usuarios uuid[], _por uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_corresp uuid;
  n int;
begin
  if not public.codigos_ve_todas_caixas(_por) then
    raise exception 'Você não tem permissão para liberar caixas.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.codigos_caixas where id = _caixa) then
    raise exception 'Caixa não encontrada.' using errcode = 'P0002';
  end if;
  select correspondente_id into v_corresp from public.profiles where id = _por;
  if exists (
    select 1 from unnest(coalesce(_usuarios, '{}'::uuid[])) u
     where not exists (select 1 from public.profiles p
                        where p.id = u and p.correspondente_id is not distinct from v_corresp)
        or not public.codigos_equipe_interna(u)
  ) then
    raise exception 'Só dá para liberar a caixa para pessoas ativas da equipe interna.' using errcode = '22023';
  end if;

  delete from public.codigos_caixas_liberadas
   where caixa_id = _caixa and user_id <> all (coalesce(_usuarios, '{}'::uuid[]));
  insert into public.codigos_caixas_liberadas (caixa_id, user_id, liberado_por)
  select _caixa, u, _por from unnest(coalesce(_usuarios, '{}'::uuid[])) u
  on conflict (caixa_id, user_id) do nothing;
  select count(*) into n from public.codigos_caixas_liberadas where caixa_id = _caixa;
  return n;
end;
$$;

/**
 * Para a tela de quem gere as caixas: a equipe interna ativa do mesmo correspondente,
 * dizendo quem já vê todas e quem tem "Códigos de acesso › ver" (sem isso, liberar
 * não adianta — a tela fica fechada para a pessoa).
 */
create or replace function public.codigos_pessoas_para_liberar(_por uuid)
returns table (id uuid, nome text, email text, ve_todas boolean, pode_ver boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.nome::text, p.email::text,
         public.codigos_ve_todas_caixas(p.id),
         public.usuario_tem_permissao(p.id, 'operacional.codigos', 'view')
    from public.profiles p
   where public.codigos_ve_todas_caixas(_por)
     and p.correspondente_id is not distinct from (select q.correspondente_id from public.profiles q where q.id = _por)
     and public.codigos_equipe_interna(p.id)
   order by p.nome nulls last;
$$;

revoke all on function public.codigos_equipe_interna(uuid) from public, anon, authenticated;
revoke all on function public.codigos_ve_todas_caixas(uuid) from public, anon, authenticated;
revoke all on function public.codigos_caixas_visiveis(uuid) from public, anon, authenticated;
revoke all on function public.codigos_recebidos_visiveis(uuid, timestamptz, int) from public, anon, authenticated;
revoke all on function public.codigos_definir_liberados(uuid, uuid[], uuid) from public, anon, authenticated;
revoke all on function public.codigos_pessoas_para_liberar(uuid) from public, anon, authenticated;
grant execute on function public.codigos_equipe_interna(uuid) to service_role;
grant execute on function public.codigos_ve_todas_caixas(uuid) to service_role;
grant execute on function public.codigos_caixas_visiveis(uuid) to service_role;
grant execute on function public.codigos_recebidos_visiveis(uuid, timestamptz, int) to service_role;
grant execute on function public.codigos_definir_liberados(uuid, uuid[], uuid) to service_role;
grant execute on function public.codigos_pessoas_para_liberar(uuid) to service_role;
