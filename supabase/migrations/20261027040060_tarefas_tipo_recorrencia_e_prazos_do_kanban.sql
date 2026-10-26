-- Pedido do dono de 26/10/2026 (frente a4, itens C34 e C35).
--
-- C35 — "Tarefas do correspondente deve ser igual às tarefas dos assinantes": a agenda
-- do Agilliza Tech tem tipo de compromisso (ligação, visita, reunião, documento,
-- lembrete), duração e repetição. As tarefas do Agilliza ganham os mesmos campos:
--   · tasks.tipo, tasks.duracao_min, tasks.recorrencia;
--   · ao concluir uma tarefa repetida, o banco cria a próxima ocorrência UMA vez só
--     (tasks.recorrencia_gerada_id guarda qual foi): reabrir e concluir de novo, ou
--     duas pessoas concluindo ao mesmo tempo, não duplicam a agenda.
--
-- C34 — Kanban de propostas: alerta de "dias parado" por etapa. Os limites não ficam no
-- código: `proposta_etapa_sla` tem o padrão geral (correspondente_id nulo, semeado aqui)
-- e o correspondente pode ajustar os dele pela tela (quem edita propostas).

-- ─────────────────────────── C35: tarefas ───────────────────────────
alter table public.tasks
  add column if not exists tipo text not null default 'lembrete',
  add column if not exists duracao_min integer,
  add column if not exists recorrencia text,
  add column if not exists recorrencia_gerada_id uuid references public.tasks (id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_tipo_valido') then
    alter table public.tasks add constraint tasks_tipo_valido
      check (tipo in ('ligacao', 'visita', 'reuniao', 'documento', 'lembrete', 'outro'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tasks_duracao_valida') then
    alter table public.tasks add constraint tasks_duracao_valida
      check (duracao_min is null or duracao_min between 5 and 1440);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'tasks_recorrencia_valida') then
    alter table public.tasks add constraint tasks_recorrencia_valida
      check (recorrencia is null or recorrencia in ('diaria', 'semanal', 'mensal'));
  end if;
end $$;

comment on column public.tasks.tipo is 'Tipo do compromisso (ligação, visita, reunião, documento, lembrete, outro) — igual às Tarefas do Agilliza Tech.';
comment on column public.tasks.recorrencia is 'Repetição: diaria, semanal ou mensal. Ao concluir, o banco cria a próxima ocorrência (uma vez).';
comment on column public.tasks.recorrencia_gerada_id is 'Próxima ocorrência já criada a partir desta tarefa (trava contra duplicidade).';

/**
 * Próxima ocorrência de uma tarefa repetida, criada ao concluir.
 *
 * BEFORE UPDATE: a nova linha nasce na MESMA transação da conclusão e o id dela já sai
 * gravado em NEW.recorrencia_gerada_id. Duas conclusões simultâneas se enfileiram pela
 * trava da linha; a segunda já enxerga o id gravado e não cria outra.
 */
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
                            responsavel_id, criador_id, origem, tipo, duracao_min, recorrencia)
  values (new.correspondente_id, new.titulo, new.descricao, new.prioridade, v_prazo, new.cliente_id,
          new.responsavel_id, new.criador_id, 'recorrencia', new.tipo, new.duracao_min, new.recorrencia)
  returning id into v_novo;

  insert into public.task_history (task_id, ator_id, acao, detalhe)
  values (v_novo, auth.uid(), 'criada', 'Próxima ocorrência de ' || coalesce(new.numero, 'tarefa repetida'));

  new.recorrencia_gerada_id := v_novo;
  return new;
end $$;

revoke all on function public.task_proxima_ocorrencia() from public, anon, authenticated;

drop trigger if exists trg_task_proxima_ocorrencia on public.tasks;
create trigger trg_task_proxima_ocorrencia
  before update of status on public.tasks
  for each row execute function public.task_proxima_ocorrencia();

-- ─────────────────────────── C34: prazos por etapa do kanban ───────────────────────────
create table if not exists public.proposta_etapa_sla (
  id                uuid primary key default gen_random_uuid(),
  -- nulo = padrão geral (semeado nesta migração); preenchido = ajuste do correspondente.
  correspondente_id uuid,
  etapa             text not null,
  dias_alerta       integer not null,
  dias_critico      integer not null,
  atualizado_por    uuid,
  updated_at        timestamptz not null default now(),
  constraint proposta_etapa_sla_etapa_valida check (etapa in (
    'rascunho', 'enviada_banco', 'credito_aprovado', 'formularios', 'aguardando_documentos',
    'engenharia_vistoria', 'analise_juridica', 'contrato_emitido', 'erro_envio')),
  constraint proposta_etapa_sla_dias_validos check (
    dias_alerta between 1 and 365 and dias_critico between 1 and 365 and dias_alerta < dias_critico)
);

create unique index if not exists proposta_etapa_sla_corr_etapa
  on public.proposta_etapa_sla (correspondente_id, etapa) where correspondente_id is not null;
create unique index if not exists proposta_etapa_sla_padrao_etapa
  on public.proposta_etapa_sla (etapa) where correspondente_id is null;

comment on table public.proposta_etapa_sla is
  'Dias parado na etapa até o alerta (amarelo) e até o crítico (vermelho) no kanban de propostas. Linha sem correspondente = padrão geral.';

insert into public.proposta_etapa_sla (correspondente_id, etapa, dias_alerta, dias_critico) values
  (null, 'rascunho', 3, 7),
  (null, 'enviada_banco', 3, 7),
  (null, 'credito_aprovado', 5, 10),
  (null, 'formularios', 3, 7),
  (null, 'aguardando_documentos', 5, 10),
  (null, 'engenharia_vistoria', 7, 15),
  (null, 'analise_juridica', 7, 15),
  (null, 'contrato_emitido', 15, 30),
  (null, 'erro_envio', 1, 2)
on conflict do nothing;

alter table public.proposta_etapa_sla enable row level security;
revoke all on public.proposta_etapa_sla from anon;
revoke all on public.proposta_etapa_sla from authenticated;
grant select on public.proposta_etapa_sla to authenticated;
grant all on public.proposta_etapa_sla to service_role;

drop policy if exists proposta_etapa_sla_leitura on public.proposta_etapa_sla;
create policy proposta_etapa_sla_leitura on public.proposta_etapa_sla
  for select to authenticated
  using (
    correspondente_id is null
    or correspondente_id = public.correspondente_do_usuario((select auth.uid()))
  );

/**
 * Ajusta (ou volta ao padrão, com p_alerta nulo) o prazo de uma etapa para o
 * correspondente de quem chama. Exige editar propostas. A gravação passa só por aqui:
 * a tabela não aceita escrita direta do navegador.
 */
create or replace function public.definir_prazo_etapa_proposta(p_etapa text, p_alerta integer, p_critico integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_corr uuid;
begin
  if v_uid is null then
    raise exception 'Sessão expirada.' using errcode = '28000';
  end if;
  v_corr := public.correspondente_do_usuario(v_uid);
  if v_corr is null then
    raise exception 'Sua conta não está vinculada a um correspondente.' using errcode = '42501';
  end if;
  if not public.usuario_tem_permissao(v_uid, 'operacional.propostas', 'edit') then
    raise exception 'Você não tem permissão para ajustar os prazos do kanban.' using errcode = '42501';
  end if;
  if p_etapa is null or p_etapa not in ('rascunho', 'enviada_banco', 'credito_aprovado', 'formularios',
      'aguardando_documentos', 'engenharia_vistoria', 'analise_juridica', 'contrato_emitido', 'erro_envio') then
    raise exception 'Etapa inválida.' using errcode = '22023';
  end if;
  if p_alerta is null then
    delete from public.proposta_etapa_sla where correspondente_id = v_corr and etapa = p_etapa;
    return;
  end if;
  if p_critico is null or p_alerta < 1 or p_critico > 365 or p_alerta >= p_critico then
    raise exception 'O alerta vem antes do crítico (de 1 a 365 dias).' using errcode = '22023';
  end if;
  insert into public.proposta_etapa_sla (correspondente_id, etapa, dias_alerta, dias_critico, atualizado_por)
  values (v_corr, p_etapa, p_alerta, p_critico, v_uid)
  on conflict (correspondente_id, etapa) where correspondente_id is not null
  do update set dias_alerta = excluded.dias_alerta, dias_critico = excluded.dias_critico,
                atualizado_por = excluded.atualizado_por, updated_at = now();
end $$;

revoke all on function public.definir_prazo_etapa_proposta(text, integer, integer) from public, anon;
grant execute on function public.definir_prazo_etapa_proposta(text, integer, integer) to authenticated;
