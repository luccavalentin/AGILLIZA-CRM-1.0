-- Servidor de e-mail (C26): cada pessoa vê SÓ as caixas liberadas para ela.
-- Decisão 16 do docs/38 (aprovada pelo dono em 26/10/2026). Teste pgTAP 762 do Agilliza Tech.
--
-- Antes: qualquer pessoa da equipe com "Servidor de e-mail › ver" lia todas as caixas, as
-- mensagens e os códigos de todas — e de TODOS os correspondentes (a caixa nem tinha dono).
--
--   · codigos_caixas.correspondente_id: a caixa é do correspondente de quem a cadastrou
--     (gatilho), e nada atravessa correspondente;
--   · codigos_caixas_pessoas: quem está liberado em cada caixa. Quem cadastra define a lista;
--     a administração do correspondente (papel admin/correspondente) vê e gere todas;
--   · quem VÊ a caixa (caixa, mensagens, códigos, regras): quem cadastrou, as pessoas
--     liberadas e a administração — sempre equipe interna ativa com "Servidor de e-mail › ver";
--   · quem GERE (editar, pausar, testar, remover, liberar pessoas): quem cadastrou (com
--     "editar") e a administração;
--   · o servidor lê e grava pelas funções abaixo (só o client de serviço executa), que
--     conferem a pessoa; as tabelas continuam fechadas para a API do navegador, e a única
--     aberta para leitura (regras) passa a conferir a liberação.

alter table public.codigos_caixas add column if not exists correspondente_id uuid;
create index if not exists codigos_caixas_correspondente_idx on public.codigos_caixas (correspondente_id);

-- Caixas já cadastradas: o correspondente de quem cadastrou; sem autor, e havendo um só
-- correspondente, é dele.
update public.codigos_caixas c set correspondente_id = p.correspondente_id
  from public.profiles p
 where p.id = c.criado_por and c.correspondente_id is null and p.correspondente_id is not null;
update public.codigos_caixas c
   set correspondente_id = (select min(p.correspondente_id::text)::uuid from public.profiles p where p.correspondente_id is not null)
 where c.correspondente_id is null
   and (select count(distinct p.correspondente_id) from public.profiles p where p.correspondente_id is not null) = 1;

create or replace function public.codigos_tg_caixa_correspondente()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if new.correspondente_id is null and new.criado_por is not null then
      new.correspondente_id := public.correspondente_do_usuario(new.criado_por);
    end if;
  elsif new.correspondente_id is distinct from old.correspondente_id or new.criado_por is distinct from old.criado_por then
    -- A caixa não muda de correspondente nem de autor depois de cadastrada.
    new.correspondente_id := old.correspondente_id;
    new.criado_por := old.criado_por;
  end if;
  return new;
end $$;
revoke all on function public.codigos_tg_caixa_correspondente() from public, anon, authenticated;
drop trigger if exists trg_codigos_caixa_correspondente on public.codigos_caixas;
create trigger trg_codigos_caixa_correspondente before insert or update on public.codigos_caixas
  for each row execute function public.codigos_tg_caixa_correspondente();

create table if not exists public.codigos_caixas_pessoas (
  caixa_id     uuid not null references public.codigos_caixas (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  liberado_por uuid,
  created_at   timestamptz not null default now(),
  primary key (caixa_id, user_id)
);
create index if not exists codigos_caixas_pessoas_user_idx on public.codigos_caixas_pessoas (user_id);
alter table public.codigos_caixas_pessoas enable row level security;
revoke all on public.codigos_caixas_pessoas from anon, authenticated;
grant all on public.codigos_caixas_pessoas to service_role;

/** Equipe interna ativa com "Servidor de e-mail › ver" (o portal do parceiro nunca). */
create or replace function public.codigos_pessoa_ok(p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user is not null
     and exists (select 1 from public.profiles p
                  where p.id = p_user and p.acesso_tipo = 'sistema' and coalesce(p.ativo, false)
                    and p.bloqueado_em is null and p.deleted_at is null)
     and public.usuario_tem_permissao(p_user, 'operacional.codigos', 'view')
$$;

/** Administração do correspondente da caixa. */
create or replace function public.codigos_e_admin(p_user uuid, p_corr uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select p_user is not null
     and public.has_any_role(p_user, array['admin', 'correspondente']::public.app_role[])
     and (p_corr is null or public.correspondente_do_usuario(p_user) = p_corr)
$$;

create or replace function public.codigos_pode_ver_caixa(p_caixa uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.codigos_pessoa_ok(p_user)
     and exists (select 1 from public.codigos_caixas c
                  where c.id = p_caixa
                    and (public.codigos_e_admin(p_user, c.correspondente_id)
                         or (c.correspondente_id is not distinct from public.correspondente_do_usuario(p_user)
                             and (c.criado_por = p_user
                                  or exists (select 1 from public.codigos_caixas_pessoas x
                                              where x.caixa_id = c.id and x.user_id = p_user)))))
$$;

create or replace function public.codigos_pode_gerir_caixa(p_caixa uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.codigos_pessoa_ok(p_user)
     and public.usuario_tem_permissao(p_user, 'operacional.codigos', 'edit')
     and exists (select 1 from public.codigos_caixas c
                  where c.id = p_caixa
                    and (public.codigos_e_admin(p_user, c.correspondente_id)
                         or (c.criado_por = p_user
                             and c.correspondente_id is not distinct from public.correspondente_do_usuario(p_user))))
$$;

/** Caixas que a pessoa vê, e se gere cada uma (o servidor monta a tela com isto). */
create or replace function public.codigos_caixas_visiveis(p_user uuid)
returns table (caixa_id uuid, pode_gerir boolean)
language sql stable security definer set search_path = public as $$
  select c.id, public.codigos_pode_gerir_caixa(c.id, p_user)
    from public.codigos_caixas c
   where public.codigos_pode_ver_caixa(c.id, p_user)
$$;

/** Mensagens capturadas das caixas que a pessoa vê (o filtro de busca é o da tela). */
create or replace function public.codigos_mensagens(p_user uuid, p_caixa uuid, p_desde timestamptz, p_so_codigos boolean,
                                                    p_busca text, p_limite integer)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(to_jsonb(x) order by x.recebido_em desc), '[]'::jsonb)
    from (select r.id, r.caixa_id, r.recebido_em, r.remetente_nome, r.remetente_email, r.banco, r.assunto, r.trecho,
                 r.codigo, r.motivo, c.email as caixa_email, c.nome as caixa_nome
            from public.codigos_recebidos r
            join public.codigos_caixas c on c.id = r.caixa_id
           where public.codigos_pode_ver_caixa(c.id, p_user)
             and (p_caixa is null or r.caixa_id = p_caixa)
             and r.recebido_em >= coalesce(p_desde, now() - interval '1 day')
             and (not coalesce(p_so_codigos, false) or r.codigo is not null)
             and (nullif(btrim(coalesce(p_busca, '')), '') is null
                  or concat_ws(' ', r.assunto, r.remetente_email, r.remetente_nome, r.banco, r.codigo)
                     ilike '%' || replace(replace(replace(btrim(p_busca), '\', '\\'), '%', '\%'), '_', '\_') || '%')
           order by r.recebido_em desc
           limit greatest(1, least(coalesce(p_limite, 100), 300))) x
$$;

/** Pessoas que podem ser liberadas: equipe interna ativa do correspondente de quem pergunta. */
create or replace function public.codigos_pessoas_disponiveis(p_user uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nome', coalesce(nullif(btrim(p.nome), ''), p.email, 'Sem nome'))
                            order by coalesce(nullif(btrim(p.nome), ''), p.email)), '[]'::jsonb)
    from public.profiles p
   where public.codigos_pessoa_ok(p_user)
     and p.correspondente_id = public.correspondente_do_usuario(p_user)
     and p.acesso_tipo = 'sistema' and coalesce(p.ativo, false) and p.bloqueado_em is null and p.deleted_at is null
$$;

/** Troca a lista de pessoas liberadas na caixa (quem gere). Devolve quantas ficaram. */
create or replace function public.codigos_definir_pessoas(p_caixa uuid, p_pessoas uuid[], p_autor uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_corr uuid;
  n integer;
begin
  select correspondente_id into v_corr from public.codigos_caixas where id = p_caixa for update;
  if not found then raise exception 'Caixa não encontrada.' using errcode = 'P0002'; end if;
  if not public.codigos_pode_gerir_caixa(p_caixa, p_autor) then
    raise exception 'Só quem cadastrou a caixa ou a administração define quem a vê.' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_pessoas), 0) > 200 then raise exception 'No máximo 200 pessoas por caixa.' using errcode = '22023'; end if;
  if exists (select 1 from unnest(coalesce(p_pessoas, '{}')) u
              where not exists (select 1 from public.profiles p
                                 where p.id = u and p.correspondente_id is not distinct from v_corr
                                   and p.acesso_tipo = 'sistema' and coalesce(p.ativo, false)
                                   and p.bloqueado_em is null and p.deleted_at is null)) then
    raise exception 'Só dá para liberar a caixa para pessoas ativas da equipe do correspondente.' using errcode = '22023';
  end if;
  delete from public.codigos_caixas_pessoas where caixa_id = p_caixa and user_id <> all (coalesce(p_pessoas, '{}'));
  insert into public.codigos_caixas_pessoas (caixa_id, user_id, liberado_por)
  select distinct p_caixa, u, p_autor from unnest(coalesce(p_pessoas, '{}')) u
  on conflict do nothing;
  select count(*) into n from public.codigos_caixas_pessoas where caixa_id = p_caixa;
  return n;
end $$;

revoke all on function public.codigos_pessoa_ok(uuid), public.codigos_e_admin(uuid, uuid),
  public.codigos_pode_ver_caixa(uuid, uuid), public.codigos_pode_gerir_caixa(uuid, uuid),
  public.codigos_caixas_visiveis(uuid), public.codigos_mensagens(uuid, uuid, timestamptz, boolean, text, integer),
  public.codigos_pessoas_disponiveis(uuid), public.codigos_definir_pessoas(uuid, uuid[], uuid)
  from public, anon, authenticated;
grant execute on function public.codigos_pode_ver_caixa(uuid, uuid), public.codigos_pode_gerir_caixa(uuid, uuid),
  public.codigos_caixas_visiveis(uuid), public.codigos_mensagens(uuid, uuid, timestamptz, boolean, text, integer),
  public.codigos_pessoas_disponiveis(uuid), public.codigos_definir_pessoas(uuid, uuid[], uuid)
  to service_role;

/** Para as políticas: a pessoa do token vê a caixa? (só sobre ela mesma; não consulta terceiros). */
create or replace function public.codigos_eu_vejo_caixa(p_caixa uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.codigos_pode_ver_caixa(p_caixa, (select auth.uid()))
$$;
revoke all on function public.codigos_eu_vejo_caixa(uuid) from public, anon;
grant execute on function public.codigos_eu_vejo_caixa(uuid) to authenticated, service_role;

-- A única tabela lida pela API (regras) passa a conferir a liberação da caixa. As demais
-- continuam sem privilégio para o navegador; as políticas abaixo valem como segunda trava.
drop policy if exists "codigos_filtros leitura interna" on public.codigos_filtros;
create policy "codigos_filtros leitura interna" on public.codigos_filtros
  for select to authenticated
  using (public.is_interno((select auth.uid()))
         and public.codigos_eu_vejo_caixa(caixa_id));
drop policy if exists "codigos_caixas so liberadas" on public.codigos_caixas;
create policy "codigos_caixas so liberadas" on public.codigos_caixas
  for select to authenticated using (public.codigos_eu_vejo_caixa(id));
drop policy if exists "codigos_recebidos so liberadas" on public.codigos_recebidos;
create policy "codigos_recebidos so liberadas" on public.codigos_recebidos
  for select to authenticated using (public.codigos_eu_vejo_caixa(caixa_id));
drop policy if exists "codigos_caixas_pessoas so liberadas" on public.codigos_caixas_pessoas;
create policy "codigos_caixas_pessoas so liberadas" on public.codigos_caixas_pessoas
  for select to authenticated using (public.codigos_eu_vejo_caixa(caixa_id));
