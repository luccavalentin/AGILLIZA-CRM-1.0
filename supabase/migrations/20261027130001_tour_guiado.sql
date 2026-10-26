-- =============================================================================
-- Tour guiado em todo o Agilliza Correspondente (pedido do dono de 26/10/2026:
-- "INCLUA TOUR EM TODO O SISTEMA COM CAIXAS ENSINANDO AS FUNCIONALIDADES DE CADA TELA").
--
-- O roteiro de cada tela mora no código (src/lib/tour/roteiros.ts); aqui fica só o
-- PROGRESSO de cada pessoa, para o tour não voltar a abrir sozinho em outro aparelho.
-- Mesmas regras do Agilliza Tech (0391 de lá):
--   · uma linha por pessoa e tela: versão do roteiro, estado (andamento, concluido, pulado)
--     e o último passo visto; roteiro com versão nova abre de novo (a tela mudou);
--   · "concluído/pulado" não volta a "andamento" na mesma versão (dois aparelhos abertos);
--     versão antiga não sobrescreve a nova;
--   · a preferência "abrir sozinho na primeira visita" (ligada por padrão);
--   · limite de 600 telas por pessoa (fila por pessoa contra corrida entre abas).
--
-- Dois públicos:
--   · EQUIPE (usuário do Supabase): tabelas com RLS por auth.uid() (só leitura direta da
--     própria linha); gravação só pelas funções tour_*; nada para anon.
--   · CLIENTE do portal (sessão própria em cookie selado, sem usuário do Supabase): funções
--     portal_cliente_tour_* que só o service_role executa, com o id do cliente que o SERVIDOR
--     tirou do cookie (mesma regra das demais portal_cliente_*). Tabelas fechadas.
-- =============================================================================

-- ------------------------------------------------------------------- tabelas ---
create table if not exists public.tour_progresso (
  user_id       uuid not null references auth.users (id) on delete cascade,
  tela          text not null check (tela ~ '^[a-z0-9][a-z0-9._:-]{1,79}$'),
  versao        smallint not null check (versao between 1 and 1000),
  estado        text not null check (estado in ('andamento', 'concluido', 'pulado')),
  passo         smallint not null default 0 check (passo between 0 and 100),
  atualizado_em timestamptz not null default now(),
  primary key (user_id, tela)
);
comment on table public.tour_progresso is
  'Tour guiado: progresso por pessoa da equipe e tela (20261027130001). Roteiros no código.';

create table if not exists public.tour_preferencias (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  automatico    boolean not null default true,
  atualizado_em timestamptz not null default now()
);
comment on table public.tour_preferencias is
  'Tour guiado: "abrir sozinho na primeira visita de cada tela" por pessoa da equipe.';

create table if not exists public.tour_progresso_cliente (
  cliente_id    uuid not null references public.clientes (id) on delete cascade,
  tela          text not null check (tela ~ '^[a-z0-9][a-z0-9._:-]{1,79}$'),
  versao        smallint not null check (versao between 1 and 1000),
  estado        text not null check (estado in ('andamento', 'concluido', 'pulado')),
  passo         smallint not null default 0 check (passo between 0 and 100),
  atualizado_em timestamptz not null default now(),
  primary key (cliente_id, tela)
);
comment on table public.tour_progresso_cliente is
  'Tour guiado do portal do cliente: progresso por cliente e tela (só via portal_cliente_tour_*).';

create table if not exists public.tour_preferencias_cliente (
  cliente_id    uuid primary key references public.clientes (id) on delete cascade,
  automatico    boolean not null default true,
  atualizado_em timestamptz not null default now()
);

alter table public.tour_progresso            enable row level security;
alter table public.tour_preferencias         enable row level security;
alter table public.tour_progresso_cliente    enable row level security;
alter table public.tour_preferencias_cliente enable row level security;

revoke all on public.tour_progresso, public.tour_preferencias,
              public.tour_progresso_cliente, public.tour_preferencias_cliente
  from public, anon, authenticated;
-- A equipe lê só a própria linha (a tela usa as funções; o select direto é só leitura).
grant select on public.tour_progresso, public.tour_preferencias to authenticated;

drop policy if exists "Tour: ver o meu progresso" on public.tour_progresso;
create policy "Tour: ver o meu progresso" on public.tour_progresso
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "Tour: ver a minha preferência" on public.tour_preferencias;
create policy "Tour: ver a minha preferência" on public.tour_preferencias
  for select to authenticated using (user_id = auth.uid());

-- ------------------------------------------------------------ regras comuns ---
/** Valida e normaliza a entrada de uma gravação; devolve a chave da tela. */
create or replace function public._tour_validar(p_tela text, p_versao integer, p_estado text, p_passo integer)
returns text
language plpgsql
immutable
set search_path = public, pg_catalog
as $$
declare
  v_tela text := lower(btrim(coalesce(p_tela, '')));
begin
  if v_tela !~ '^[a-z0-9][a-z0-9._:-]{1,79}$' then raise exception 'Tela inválida.' using errcode = '22023'; end if;
  if p_versao is null or p_versao not between 1 and 1000 then raise exception 'Versão inválida.' using errcode = '22023'; end if;
  if p_estado is null or p_estado not in ('andamento', 'concluido', 'pulado') then
    raise exception 'Estado inválido.' using errcode = '22023';
  end if;
  if coalesce(p_passo, 0) not between 0 and 100 then raise exception 'Passo inválido.' using errcode = '22023'; end if;
  return v_tela;
end $$;

/** Lista de telas pedida pela tela aberta: no máximo 40 chaves. */
create or replace function public._tour_telas(p_telas text[])
returns text[]
language plpgsql
immutable
set search_path = public, pg_catalog
as $$
begin
  if coalesce(array_length(p_telas, 1), 0) > 40 then raise exception 'Telas demais.' using errcode = '22023'; end if;
  return coalesce(p_telas, '{}');
end $$;

-- ------------------------------------------------------------------ equipe ---
create or replace function public._tour_eu()
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare v uuid := auth.uid();
begin
  if v is null then raise exception 'Entre de novo para continuar.' using errcode = '42501'; end if;
  return v;
end $$;

/** {automatico, telas: {chave: {versao, estado, passo}}} das telas pedidas (até 40). */
create or replace function public.tour_estado(p_telas text[])
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_eu uuid := public._tour_eu();
  v_telas text[] := public._tour_telas(p_telas);
begin
  return jsonb_build_object(
    'automatico', coalesce((select p.automatico from public.tour_preferencias p where p.user_id = v_eu), true),
    'telas', coalesce((select jsonb_object_agg(t.tela, jsonb_build_object('versao', t.versao, 'estado', t.estado, 'passo', t.passo))
                         from public.tour_progresso t
                        where t.user_id = v_eu and t.tela = any (v_telas)), '{}'::jsonb));
end $$;

/** Marca o tour de uma tela (visto, pulado ou em andamento). Idempotente. */
create or replace function public.tour_registrar(p_tela text, p_versao integer, p_estado text, p_passo integer default 0)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_eu uuid := public._tour_eu();
  v_tela text := public._tour_validar(p_tela, p_versao, p_estado, p_passo);
begin
  -- Fila por pessoa: duas abas gravando ao mesmo tempo não passam do limite juntas.
  perform pg_advisory_xact_lock(hashtextextended('tour:u:' || v_eu::text, 0));
  if not exists (select 1 from public.tour_progresso where user_id = v_eu and tela = v_tela)
     and (select count(*) from public.tour_progresso where user_id = v_eu) >= 600 then
    raise exception 'Limite de telas do tour atingido.' using errcode = '54000';
  end if;

  insert into public.tour_progresso as t (user_id, tela, versao, estado, passo)
  values (v_eu, v_tela, p_versao, p_estado, coalesce(p_passo, 0))
  on conflict (user_id, tela) do update
     set versao = excluded.versao,
         estado = case when t.versao = excluded.versao and t.estado in ('concluido', 'pulado') and excluded.estado = 'andamento'
                       then t.estado else excluded.estado end,
         passo = excluded.passo,
         atualizado_em = now()
   where t.versao <= excluded.versao;
  return jsonb_build_object('gravado', true);
end $$;

/** "Ver os tours de novo": apaga o progresso de uma tela (ou de todas) da própria pessoa. */
create or replace function public.tour_reiniciar(p_tela text default null)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_eu uuid := public._tour_eu();
  n integer;
begin
  delete from public.tour_progresso
   where user_id = v_eu and (p_tela is null or tela = lower(btrim(p_tela)));
  get diagnostics n = row_count;
  return n;
end $$;

/** Liga ou desliga a abertura automática (o botão de ajuda continua abrindo). */
create or replace function public.tour_automatico(p_ligado boolean)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare v_eu uuid := public._tour_eu();
begin
  if p_ligado is null then raise exception 'Informe ligado ou desligado.' using errcode = '22023'; end if;
  insert into public.tour_preferencias (user_id, automatico) values (v_eu, p_ligado)
  on conflict (user_id) do update set automatico = excluded.automatico, atualizado_em = now();
  return p_ligado;
end $$;

-- ----------------------------------------------------------------- cliente ---
/** O cliente da sessão ainda tem acesso ao portal (acesso revogado no CRM não grava nada). */
create or replace function public._tour_cliente(_cid uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
begin
  if _cid is null or not exists (
    select 1 from public.clientes c
     where c.id = _cid and c.portal_acesso_ativo is true and c.deleted_at is null
  ) then
    raise exception 'Acesso ao portal não encontrado.' using errcode = '42501';
  end if;
  return _cid;
end $$;

create or replace function public.portal_cliente_tour_estado(_cid uuid, p_telas text[])
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_cli uuid := public._tour_cliente(_cid);
  v_telas text[] := public._tour_telas(p_telas);
begin
  return jsonb_build_object(
    'automatico', coalesce((select p.automatico from public.tour_preferencias_cliente p where p.cliente_id = v_cli), true),
    'telas', coalesce((select jsonb_object_agg(t.tela, jsonb_build_object('versao', t.versao, 'estado', t.estado, 'passo', t.passo))
                         from public.tour_progresso_cliente t
                        where t.cliente_id = v_cli and t.tela = any (v_telas)), '{}'::jsonb));
end $$;

create or replace function public.portal_cliente_tour_registrar(
  _cid uuid, p_tela text, p_versao integer, p_estado text, p_passo integer default 0)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_cli uuid := public._tour_cliente(_cid);
  v_tela text := public._tour_validar(p_tela, p_versao, p_estado, p_passo);
begin
  perform pg_advisory_xact_lock(hashtextextended('tour:c:' || v_cli::text, 0));
  if not exists (select 1 from public.tour_progresso_cliente where cliente_id = v_cli and tela = v_tela)
     and (select count(*) from public.tour_progresso_cliente where cliente_id = v_cli) >= 600 then
    raise exception 'Limite de telas do tour atingido.' using errcode = '54000';
  end if;

  insert into public.tour_progresso_cliente as t (cliente_id, tela, versao, estado, passo)
  values (v_cli, v_tela, p_versao, p_estado, coalesce(p_passo, 0))
  on conflict (cliente_id, tela) do update
     set versao = excluded.versao,
         estado = case when t.versao = excluded.versao and t.estado in ('concluido', 'pulado') and excluded.estado = 'andamento'
                       then t.estado else excluded.estado end,
         passo = excluded.passo,
         atualizado_em = now()
   where t.versao <= excluded.versao;
  return jsonb_build_object('gravado', true);
end $$;

create or replace function public.portal_cliente_tour_reiniciar(_cid uuid, p_tela text default null)
returns integer
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_cli uuid := public._tour_cliente(_cid);
  n integer;
begin
  delete from public.tour_progresso_cliente
   where cliente_id = v_cli and (p_tela is null or tela = lower(btrim(p_tela)));
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.portal_cliente_tour_automatico(_cid uuid, p_ligado boolean)
returns boolean
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare v_cli uuid := public._tour_cliente(_cid);
begin
  if p_ligado is null then raise exception 'Informe ligado ou desligado.' using errcode = '22023'; end if;
  insert into public.tour_preferencias_cliente (cliente_id, automatico) values (v_cli, p_ligado)
  on conflict (cliente_id) do update set automatico = excluded.automatico, atualizado_em = now();
  return p_ligado;
end $$;

-- ----------------------------------------------------------------- acessos ---
revoke all on function public._tour_validar(text, integer, text, integer), public._tour_telas(text[]),
                       public._tour_eu(), public._tour_cliente(uuid)
  from public, anon, authenticated;
revoke all on function public.tour_estado(text[]), public.tour_registrar(text, integer, text, integer),
                       public.tour_reiniciar(text), public.tour_automatico(boolean)
  from public, anon;
grant execute on function public.tour_estado(text[]), public.tour_registrar(text, integer, text, integer),
                          public.tour_reiniciar(text), public.tour_automatico(boolean)
  to authenticated;
revoke all on function public.portal_cliente_tour_estado(uuid, text[]),
                       public.portal_cliente_tour_registrar(uuid, text, integer, text, integer),
                       public.portal_cliente_tour_reiniciar(uuid, text),
                       public.portal_cliente_tour_automatico(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.portal_cliente_tour_estado(uuid, text[]),
                          public.portal_cliente_tour_registrar(uuid, text, integer, text, integer),
                          public.portal_cliente_tour_reiniciar(uuid, text),
                          public.portal_cliente_tour_automatico(uuid, boolean)
  to service_role;
