-- O sistema passa a anotar sozinho quando algo trava.
--
-- O painel de saúde (20/09/2026) mostra o agora, mas alguém precisa abrir a
-- tela. Se uma proposta ficou presa às 3 da manhã e destravou às 7, ninguém
-- fica sabendo. Esta rotina roda de 15 em 15 minutos, compara os sinais com
-- os limites e mantém uma lista de alertas ABERTOS — fechando sozinha quando
-- o problema some, com o horário de início e de fim.
--
-- De propósito, não avisa ninguém ainda: só registra. Ligar notificação para
-- pessoas de verdade é decisão do dono do sistema.

create table if not exists public.sistema_alertas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  titulo text not null,
  valor numeric,
  detectado_em timestamptz not null default now(),
  visto_em timestamptz not null default now(),
  resolvido_em timestamptz
);

create unique index if not exists idx_sistema_alertas_aberto
  on public.sistema_alertas (tipo) where resolvido_em is null;
create index if not exists idx_sistema_alertas_recentes
  on public.sistema_alertas (detectado_em desc);

alter table public.sistema_alertas enable row level security;

drop policy if exists "alertas visíveis para admin" on public.sistema_alertas;
create policy "alertas visíveis para admin" on public.sistema_alertas
  for select to authenticated
  using (public.usuario_pode_admin((select auth.uid())));

create or replace function public.sistema_registrar_alertas()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  abertos int := 0;
  v_tipo text; v_titulo text; v_valor numeric;
begin
  for v_tipo, v_titulo, v_valor in
    select * from (
      values
        ('simulacoes_presas', 'Simulações presas em "enviando" há mais de 30 min',
         (select count(*) from public.simulacoes
           where status = 'enviando' and created_at < now() - interval '30 minutes'
             and deleted_at is null)),
        ('propostas_sem_sincronizar', 'Propostas ativas sem consultar o banco há mais de 3 h',
         (select count(*) from public.propostas p
            left join public.proposta_sync_estado e on e.proposta_id = p.id
           where p.deleted_at is null and p.homefin_id_oportunidade is not null
             and p.status in ('enviada_banco','em_analise_credito','credito_condicionado',
                              'aguardando_documentos','engenharia_vistoria','analise_juridica')
             and coalesce(e.ultima_consulta_em, p.ultima_sincronizacao_em) < now() - interval '3 hours')),
        ('bancos_sem_retorno', 'Bancos sem retorno há mais de 24 h',
         (select count(*) from public.simulacao_bancos sb
            join public.simulacoes s on s.id = sb.simulacao_id
           where sb.status_banco = 'aguardando' and sb.created_at < now() - interval '24 hours'
             and s.deleted_at is null and s.status <> 'rascunho')),
        ('http_falhando', 'Chamadas do agendador falhando na última hora',
         (select count(*) from net._http_response
           where created > now() - interval '1 hour'
             and (status_code is null or status_code >= 400))),
        ('agendador_parado', 'Agendador sem rodar há mais de 15 min',
         (select count(*) from cron.job j
           where j.active and j.schedule = '* * * * *'
             and coalesce((select max(d.start_time) from cron.job_run_details d
                            where d.jobid = j.jobid and d.status = 'succeeded'),
                          '-infinity') < now() - interval '15 minutes'))
    ) t(tipo, titulo, valor)
  loop
    if v_valor > 0 then
      insert into public.sistema_alertas (tipo, titulo, valor)
      values (v_tipo, v_titulo, v_valor)
      on conflict (tipo) where resolvido_em is null
      do update set valor = excluded.valor, visto_em = now(), titulo = excluded.titulo;
      abertos := abertos + 1;
    else
      update public.sistema_alertas
         set resolvido_em = now()
       where tipo = v_tipo and resolvido_em is null;
    end if;
  end loop;

  -- Não guarda história infinita: 90 dias de alertas já fechados bastam.
  delete from public.sistema_alertas
   where resolvido_em is not null and resolvido_em < now() - interval '90 days';

  return abertos;
end;
$$;

revoke execute on function public.sistema_registrar_alertas() from public, anon, authenticated;

select cron.schedule('registrar-alertas-sistema', '*/15 * * * *',
                     $$ select public.sistema_registrar_alertas(); $$);
