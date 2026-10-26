-- Lembrete de tarefa antes do prazo (pendência C35 da frente a4, 26/10/2026).
--
-- Cada tarefa pode ter um lembrete: N minutos antes do prazo (0 = na hora; até 7 dias).
-- Uma rotina de minuto em minuto avisa o responsável (ou quem criou, sem responsável) pela
-- notificação de sempre (emitir_notificacao), UMA vez: a marca `lembrete_enviado_em` é
-- gravada na mesma instrução que escolhe as tarefas (FOR UPDATE SKIP LOCKED), então duas
-- rodadas ao mesmo tempo não avisam em dobro. Mudou o prazo ou a antecedência: a marca é
-- limpa e o lembrete vale de novo. Tarefa concluída, cancelada ou excluída não avisa; tarefa
-- cujo prazo já passou há mais de 1 hora também não (não acorda lembrete velho).

alter table public.tasks
  add column if not exists lembrete_minutos integer,
  add column if not exists lembrete_enviado_em timestamptz;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_lembrete_minutos_chk') then
    alter table public.tasks add constraint tasks_lembrete_minutos_chk
      check (lembrete_minutos is null or lembrete_minutos between 0 and 10080);
  end if;
end $$;
comment on column public.tasks.lembrete_minutos is 'Antecedência do lembrete em minutos (null = sem lembrete).';

create index if not exists tasks_lembrete_pendente_idx on public.tasks (prazo)
  where lembrete_minutos is not null and lembrete_enviado_em is null and deleted_at is null;

/** Prazo ou antecedência mudou: o lembrete vale de novo. */
create or replace function public.task_lembrete_rearmar()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.prazo is distinct from old.prazo or new.lembrete_minutos is distinct from old.lembrete_minutos then
    new.lembrete_enviado_em := null;
  end if;
  return new;
end $$;

drop trigger if exists trg_task_lembrete_rearmar on public.tasks;
create trigger trg_task_lembrete_rearmar
  before update of prazo, lembrete_minutos on public.tasks
  for each row execute function public.task_lembrete_rearmar();

/** Rotina: avisa as tarefas cujo lembrete chegou. Devolve quantas avisou. */
create or replace function public.tarefas_enviar_lembretes()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n integer := 0;
begin
  for r in
    with alvo as (
      select t.id from public.tasks t
       where t.lembrete_minutos is not null and t.lembrete_enviado_em is null
         and t.prazo is not null and t.deleted_at is null
         and t.status in ('aberta', 'em_andamento')
         and t.prazo - make_interval(mins => t.lembrete_minutos) <= now()
         and t.prazo > now() - interval '1 hour'
       order by t.prazo
       limit 500
       for update skip locked
    )
    update public.tasks t set lembrete_enviado_em = now()
      from alvo where t.id = alvo.id
    returning t.id, t.titulo, t.prazo, t.correspondente_id, coalesce(t.responsavel_id, t.criador_id) as quem
  loop
    perform public.emitir_notificacao(
      r.quem, r.correspondente_id, 'tarefa.lembrete',
      'Lembrete: ' || r.titulo,
      case when r.prazo <= now() then 'O prazo é agora.'
           else 'Vence ' || to_char(r.prazo at time zone 'America/Sao_Paulo', '"em" DD/MM "às" HH24:MI') || '.' end,
      '/operacional/tarefas?tarefa=' || r.id);
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.task_lembrete_rearmar() from public, anon, authenticated;
revoke all on function public.tarefas_enviar_lembretes() from public, anon, authenticated;
grant execute on function public.tarefas_enviar_lembretes() to service_role;

-- Função existente (gatilho da tarefa repetida, 20261027040060): a próxima ocorrência herda
-- a antecedência do lembrete. Única mudança: a coluna lembrete_minutos no insert.
create or replace function public.task_proxima_ocorrencia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_passo interval;
  v_prazo timestamptz;
  v_novo uuid;
  v_voltas integer := 0;
begin
  if new.status <> 'concluida' or old.status = 'concluida' or new.recorrencia is null
     or new.recorrencia_gerada_id is not null or new.deleted_at is not null then
    return new;
  end if;
  v_passo := case new.recorrencia when 'diaria' then interval '1 day'
                                  when 'semanal' then interval '7 days'
                                  else interval '1 month' end;
  v_prazo := coalesce(new.prazo, now()) + v_passo;
  -- Concluída com atraso: a próxima cai no próximo ciclo ainda por vir, não no passado.
  while v_prazo <= now() and v_voltas < 800 loop
    v_prazo := v_prazo + v_passo;
    v_voltas := v_voltas + 1;
  end loop;

  insert into public.tasks (correspondente_id, titulo, descricao, prioridade, prazo, cliente_id,
                            responsavel_id, criador_id, origem, tipo, duracao_min, recorrencia, lembrete_minutos)
  values (new.correspondente_id, new.titulo, new.descricao, new.prioridade, v_prazo, new.cliente_id,
          new.responsavel_id, new.criador_id, 'recorrencia', new.tipo, new.duracao_min, new.recorrencia,
          new.lembrete_minutos)
  returning id into v_novo;

  insert into public.task_history (task_id, ator_id, acao, detalhe)
  values (v_novo, auth.uid(), 'criada', 'Próxima ocorrência de ' || coalesce(new.numero, 'tarefa repetida'));

  new.recorrencia_gerada_id := v_novo;
  return new;
end $$;

select cron.unschedule('tarefas-lembretes')
 where exists (select 1 from cron.job where jobname = 'tarefas-lembretes');
select cron.schedule('tarefas-lembretes', '* * * * *', $$ select public.tarefas_enviar_lembretes(); $$);
