-- Saúde do sistema num lugar só.
--
-- O relatório contou errado por meses e nenhum alarme tocou: não existe nada
-- que olhe para o sistema e diga "isto aqui está parado" (QA 19/09/2026).
-- Esta função reúne os sinais que hoje só dá para ver abrindo o banco: se os
-- agendadores rodaram, se há envio preso, se alguma proposta parou de
-- sincronizar, se as chamadas HTTP estão falhando e quanto o banco ocupa.
--
-- SECURITY DEFINER porque lê os agendamentos (schema cron) e as respostas
-- HTTP (schema net), fora do alcance do papel do usuário; por isso ela mesma
-- confere se quem chamou é administrador, e devolve só contagens — nenhum
-- dado de cliente.

create or replace function public.sistema_saude()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare r jsonb;
begin
  if not public.usuario_pode_admin(auth.uid()) then
    raise exception 'sem permissão';
  end if;

  select jsonb_build_object(
    'agendadores', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'nome', case j.jobid when 2 then 'sincronizar propostas'
                             when 5 then 'reconciliar simulações'
                             when 7 then 'limpar logs'
                             when 3 then 'limpar conversas'
                             else 'job ' || j.jobid end,
        'ultima_em', u.ultima,
        'minutos_atras', round(extract(epoch from (now() - u.ultima))/60),
        'falhas_24h', u.falhas
      ) order by u.ultima desc nulls last), '[]'::jsonb)
      from cron.job j
      join lateral (
        select max(d.start_time) filter (where d.status = 'succeeded') ultima,
               count(*) filter (where d.status <> 'succeeded'
                                 and d.start_time > now() - interval '24 hours') falhas
        from cron.job_run_details d where d.jobid = j.jobid
      ) u on true
      where j.active
    ),
    'http_falhas_1h', (
      select count(*) from net._http_response
      where created > now() - interval '1 hour' and (status_code is null or status_code >= 400)
    ),
    'simulacoes_presas', (
      select count(*) from public.simulacoes
      where status = 'enviando' and created_at < now() - interval '30 minutes'
        and deleted_at is null
    ),
    'locks_vencidos', (
      select count(*) from public.simulacoes
      where oportunidade_lock_em < now() - interval '2 minutes'
    ),
    'bancos_sem_retorno_24h', (
      select count(*) from public.simulacao_bancos sb
      join public.simulacoes s on s.id = sb.simulacao_id
      where sb.status_banco = 'aguardando' and sb.created_at < now() - interval '24 hours'
        and s.deleted_at is null and s.status <> 'rascunho'
    ),
    'propostas_sem_sincronizar_2h', (
      select count(*) from public.propostas p
      left join public.proposta_sync_estado e on e.proposta_id = p.id
      where p.deleted_at is null and p.homefin_id_oportunidade is not null
        and p.status in ('enviada_banco','em_analise_credito','credito_condicionado',
                         'aguardando_documentos','engenharia_vistoria','analise_juridica')
        and coalesce(e.ultima_consulta_em, p.ultima_sincronizacao_em) < now() - interval '2 hours'
    ),
    'banco_mb', round(pg_database_size(current_database())/1024.0/1024.0),
    'logs_mb', round((pg_total_relation_size('public.proposta_logs_homefin')
                    + pg_total_relation_size('public.simulacao_logs_homefin'))/1024.0/1024.0),
    'medido_em', now()
  ) into r;

  return r;
end;
$$;

revoke execute on function public.sistema_saude() from public, anon;
grant execute on function public.sistema_saude() to authenticated;
