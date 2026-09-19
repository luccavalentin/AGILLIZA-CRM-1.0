-- Trava global para rotinas disparadas por vários lugares ao mesmo tempo.
--
-- /api/public/reconciliar-simulacoes é chamada pelo agendador e pelo navegador
-- de TODO usuário logado (a cada 12 s, enquanto houver banco aguardando). A
-- trava de 10 s do navegador vale só dentro da aba: com N usuários eram N
-- rodadas completas a cada 12 s, com limpezas e consultas repetidas e risco de
-- reenviar a mesma simulação em paralelo (18/09/2026).
--
-- `rotina_reservar(nome, segundos)` reserva a rodada de forma atômica: devolve
-- true para quem conseguiu (a última começou há mais de `segundos`) e null/false
-- para os demais, que respondem na hora sem fazer nada. Só o servidor usa.

create table if not exists public.rotina_execucoes (
  nome text primary key,
  iniciada_em timestamptz not null default now()
);
alter table public.rotina_execucoes enable row level security;

create or replace function public.rotina_reservar(_nome text, _intervalo_segundos integer)
returns boolean
language sql
volatile
security definer
set search_path = public
as $$
  insert into public.rotina_execucoes as r (nome, iniciada_em)
  values (_nome, now())
  on conflict (nome) do update
    set iniciada_em = now()
    where r.iniciada_em < now() - make_interval(secs => _intervalo_segundos)
  returning true;
$$;

revoke all on function public.rotina_reservar(text, integer) from public, anon, authenticated;
grant execute on function public.rotina_reservar(text, integer) to service_role;
