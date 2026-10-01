-- Contador exato de chamadas à HomeFin, por dia e por rota.
--
-- O log (`proposta_logs_homefin`) não guarda a consulta de acompanhamento que
-- volta igual à anterior, então não serve para dizer quantas chamadas saíram.
-- Em 01/10/2026 a HomeFin apontou 14 mil registros num dia e só dava para
-- responder com estimativa. Aqui fica o número fechado, para comparar com o
-- deles. Uma linha por dia (Brasília) + método + rota (ids trocados por `{id}`).

create table if not exists public.homefin_chamadas_dia (
  dia date not null,
  metodo text not null,
  rota text not null,
  total integer not null default 0,
  primary key (dia, metodo, rota)
);
alter table public.homefin_chamadas_dia enable row level security;

create or replace function public.homefin_contar_chamada(_metodo text, _endpoint text, _qtd integer default 1)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  insert into public.homefin_chamadas_dia as c (dia, metodo, rota, total)
  values (
    (now() at time zone 'America/Sao_Paulo')::date,
    upper(_metodo),
    regexp_replace(split_part(_endpoint, '?', 1), '/[0-9]+', '/{id}', 'g'),
    greatest(coalesce(_qtd, 1), 1)
  )
  on conflict (dia, metodo, rota) do update set total = c.total + excluded.total;
$$;

revoke all on function public.homefin_contar_chamada(text, text, integer) from public, anon, authenticated;
grant execute on function public.homefin_contar_chamada(text, text, integer) to service_role;
