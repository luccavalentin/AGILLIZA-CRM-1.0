-- Lixeira de Arquivos esvazia sozinha (pendência C38 da frente a4, 26/10/2026).
--
-- Item na lixeira há mais de N dias (N por correspondente, padrão 30, de 1 a 365; o dono ou
-- um administrador muda em Arquivos › Armazenamento) é excluído para sempre por uma rotina
-- diária. Na mesma transação some do banco (e, com isso, do acesso: o bucket só entrega
-- objeto de item visível) e libera a cota; os bytes do bucket entram numa fila que o
-- servidor do Agilliza apaga do storage (a API do storage não roda dentro do banco).

alter table public.arquivos_cotas
  add column if not exists lixeira_dias integer not null default 30;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'arquivos_cotas_lixeira_dias_chk') then
    alter table public.arquivos_cotas add constraint arquivos_cotas_lixeira_dias_chk check (lixeira_dias between 1 and 365);
  end if;
end $$;
comment on column public.arquivos_cotas.lixeira_dias is 'Dias na lixeira até a exclusão definitiva automática.';

create table if not exists public.arquivos_objetos_apagar (
  caminho   text primary key,
  criado_em timestamptz not null default now()
);
comment on table public.arquivos_objetos_apagar is
  'Objetos do bucket `arquivos` cujo item já foi excluído para sempre: o servidor apaga do storage e tira daqui.';
alter table public.arquivos_objetos_apagar enable row level security;
revoke all on public.arquivos_objetos_apagar from public, anon, authenticated;
grant all on public.arquivos_objetos_apagar to service_role;

-- Função existente (gerada de pg_get_functiondef): acrescentado só `lixeira_dias`.
create or replace function public.arquivos_armazenamento()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_corr uuid := public._arquivos_corr(auth.uid());
begin
  return jsonb_build_object(
    'usado', coalesce((select sum(v.tamanho) from public.arquivos_versoes v
                        join public.arquivos_nos n on n.id = v.no_id
                       where n.correspondente_id = v_corr), 0),
    'na_lixeira', coalesce((select sum(v.tamanho) from public.arquivos_versoes v
                             join public.arquivos_nos n on n.id = v.no_id
                            where n.correspondente_id = v_corr and n.excluido_em is not null), 0),
    'limite', coalesce((select c.limite_bytes from public.arquivos_cotas c where c.correspondente_id = v_corr),
                       10737418240),
    'lixeira_dias', coalesce((select c.lixeira_dias from public.arquivos_cotas c where c.correspondente_id = v_corr), 30),
    'pode_alterar', public.has_any_role(auth.uid(), array['admin','correspondente']::public.app_role[]));
end $$;

/** Dono/admin muda o prazo da lixeira (1 a 365 dias). */
create or replace function public.arquivos_definir_lixeira_dias(p_dias integer)
returns void language plpgsql security definer set search_path = public as $$
declare v_corr uuid := public._arquivos_corr(auth.uid());
begin
  if v_corr is null or not public.has_any_role(auth.uid(), array['admin','correspondente']::public.app_role[]) then
    raise exception 'Só o dono ou um administrador muda o prazo da lixeira.' using errcode = '42501';
  end if;
  if p_dias is null or p_dias < 1 or p_dias > 365 then
    raise exception 'Informe de 1 a 365 dias.' using errcode = '22023';
  end if;
  insert into public.arquivos_cotas (correspondente_id, lixeira_dias, alterado_por)
  values (v_corr, p_dias, auth.uid())
  on conflict (correspondente_id) do update
     set lixeira_dias = excluded.lixeira_dias, alterado_por = excluded.alterado_por, updated_at = now();
end $$;

/**
 * Rotina diária: exclui para sempre o que está na lixeira há mais que o prazo do
 * correspondente. Devolve quantos itens (raízes) saíram. Objetos sem uso vão para a fila.
 * SKIP LOCKED: duas rodadas ao mesmo tempo não brigam pelo mesmo item.
 */
create or replace function public.arquivos_esvaziar_lixeira_vencida()
returns integer language plpgsql security definer set search_path = public as $$
declare
  r record;
  n integer := 0;
  v_caminhos text[];
begin
  for r in
    select x.id from public.arquivos_nos x
      left join public.arquivos_cotas c on c.correspondente_id = x.correspondente_id
     where x.excluido_raiz and x.excluido_em is not null
       and x.excluido_em < now() - make_interval(days => coalesce(c.lixeira_dias, 30))
     order by x.excluido_em
     limit 1000
     for update of x skip locked
  loop
    with recursive abaixo as (
      select a.id, 0 as prof from public.arquivos_nos a where a.id = r.id
      union all
      select f.id, b.prof + 1 from public.arquivos_nos f join abaixo b on f.parent_id = b.id where b.prof < 100
    ), caminhos as (
      select v.storage_path from public.arquivos_versoes v join abaixo b on b.id = v.no_id
      union
      select a.storage_path from public.arquivos_nos a join abaixo b on b.id = a.id where a.storage_path is not null
    )
    select coalesce(array_agg(distinct cm.storage_path), '{}') into v_caminhos from caminhos cm;
    delete from public.arquivos_nos where id = r.id;   -- filhos e versões em cascata
    insert into public.arquivos_objetos_apagar (caminho)
    select x from unnest(v_caminhos) x
     where x is not null
       and not exists (select 1 from public.arquivos_versoes v where v.storage_path = x)
       and not exists (select 1 from public.arquivos_nos a where a.storage_path = x)
    on conflict (caminho) do nothing;
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.arquivos_definir_lixeira_dias(integer) from public, anon;
grant execute on function public.arquivos_definir_lixeira_dias(integer) to authenticated, service_role;
revoke all on function public.arquivos_esvaziar_lixeira_vencida() from public, anon, authenticated;
grant execute on function public.arquivos_esvaziar_lixeira_vencida() to service_role;

select cron.unschedule('arquivos-esvaziar-lixeira')
 where exists (select 1 from cron.job where jobname = 'arquivos-esvaziar-lixeira');
select cron.schedule('arquivos-esvaziar-lixeira', '40 3 * * *',
                     $$ select public.arquivos_esvaziar_lixeira_vencida(); $$);
