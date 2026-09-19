-- Auditoria: números e opções de filtro vindos do banco.
--
-- A tela contava em cima das 200 linhas que baixava: "Eventos no período"
-- parava em 200 com 5.617 registros no log, e "Usuários envolvidos" e
-- "Operação mais frequente" saíam das mesmas 200 (QA 19/09/2026). As opções
-- de filtro liam `.limit(2000)`, que o PostgREST corta em 1.000.
--
-- Ambas as funções são SECURITY INVOKER: a política de RLS do log
-- (correspondente do usuário) continua valendo, sem nenhum acesso novo.

create or replace function public.admin_auditoria_kpis(
  _ini timestamptz default null,
  _fim timestamptz default null,
  _user uuid default null,
  _acao text default null,
  _entidade text default null,
  _busca text default null
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with filtradas as (
    select l.acao, l.user_id, l.created_at
      from public.admin_audit_logs l
     where (_ini is null or l.created_at >= _ini)
       and (_fim is null or l.created_at <= _fim)
       and (_user is null or l.user_id = _user)
       and (_acao is null or l.acao = _acao)
       and (_entidade is null or l.entidade = _entidade)
       and (
         _busca is null
         or l.acao ilike '%' || _busca || '%'
         or l.descricao ilike '%' || _busca || '%'
         or l.entidade ilike '%' || _busca || '%'
         or l.ip::text ilike '%' || _busca || '%'
       )
  ), topo as (
    select acao, count(*) n from filtradas group by acao order by n desc, acao limit 1
  )
  select jsonb_build_object(
    'total', (select count(*) from filtradas),
    'hoje', (select count(*) from filtradas
              where created_at >= date_trunc('day', now() at time zone 'America/Sao_Paulo')
                                  at time zone 'America/Sao_Paulo'),
    'usuarios', (select count(distinct user_id) from filtradas where user_id is not null),
    'top_acao', (select acao from topo)
  );
$$;

create or replace function public.admin_auditoria_opcoes()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'acoes', coalesce((select jsonb_agg(distinct acao) from public.admin_audit_logs
                        where acao is not null), '[]'::jsonb),
    'entidades', coalesce((select jsonb_agg(distinct entidade) from public.admin_audit_logs
                            where entidade is not null), '[]'::jsonb)
  );
$$;

grant execute on function public.admin_auditoria_kpis(timestamptz, timestamptz, uuid, text, text, text) to authenticated;
grant execute on function public.admin_auditoria_opcoes() to authenticated;
