-- Demandas refeitas (pedido do dono, 26/10/2026 — C36, frente a4).
--
-- "Eu quero PODER vincular UM analista para contas de assinantes, E OU GESTÃO DE FILAS COM
-- DISTRIBUIÇÃO JUSTA PARA OS CORRETORES E PARCEIROS QUE SÃO VINCULADOS AO CORRESPONDENTE
-- TAMBÉM. AQUI DEVE SERVIR PARA DELEGAÇÃO DE DEMANDAS, CONSULTA, GESTÃO E EFETIVAÇÃO DE
-- PROPOSTAS, SIMULAÇÕES E ETC... CRIE UM FLUXO INTELIGENTE."
--
-- A tabela `public.demandas` (com a conversa, os anexos, o histórico e o SLA em horas
-- úteis) continua: ela já é usada pela Central de chats, pelos relatórios e pelo App do
-- Cliente. O que muda é a LÓGICA e as telas:
--
--   * Demanda = unidade de trabalho com tipo (consulta de ficha, simulação, proposta,
--     documentação, matrícula, dúvida, outro), ORIGEM (interno, assinante X, corretor ou
--     parceiro vinculado Y), prazo por tipo configurável, responsável e situação
--     (Nova, Em andamento, Aguardando solicitante, Concluída, Cancelada).
--   * Analista da conta: a carteira do Agilliza Tech (`plataforma.carteira`, 0037/0228)
--     diz quem atende cada conta. Demanda de uma conta com analista cai direto nele
--     (se ele estiver ausente, vai para a fila e o histórico diz por quê).
--   * Fila justa: filas por tipo/origem, com participantes. Quem tem MENOS carga aberta
--     recebe; empate = quem recebeu há mais tempo. Respeita ausência (férias,
--     indisponível) e o limite de carga de cada pessoa. Cada atribuição grava o porquê
--     (histórico com os candidatos e a carga de cada um).
--   * Corrida: a escolha roda com trava por correspondente (pg_advisory_xact_lock) e com a
--     linha da demanda travada (FOR UPDATE); "assumir"/"pegar a próxima" só pegam demanda
--     sem responsável (FOR UPDATE / SKIP LOCKED): duas pessoas nunca ficam com a mesma.
--   * Integração com a fila de propostas dos assinantes: a migração 0320 do Agilliza Tech
--     chama `demanda_de_proposta_assinante` a cada proposta nova/alterada de assinante;
--     a demanda é única por proposta (índice único em ref_tipo + ref_id).
--
-- Escrita só por funções SECURITY DEFINER (conferem sessão, correspondente e permissão);
-- as tabelas novas só têm leitura pela RLS, nada para `anon`.

-- ---------------------------------------------------------------------------
-- 1. Colunas novas da demanda e do histórico
-- ---------------------------------------------------------------------------
alter table public.demandas
  add column if not exists origem_tipo text not null default 'interno',
  add column if not exists conta_id uuid,
  add column if not exists conta_nome text,
  add column if not exists solicitante_nome text,
  add column if not exists ref_tipo text,
  add column if not exists ref_id uuid,
  add column if not exists ref_codigo text,
  add column if not exists ref_status text,
  add column if not exists fila_id uuid,
  add column if not exists atribuicao_motivo text,
  add column if not exists atribuida_em timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'demandas_origem_tipo_chk') then
    alter table public.demandas add constraint demandas_origem_tipo_chk
      check (origem_tipo in ('interno', 'assinante', 'vinculado'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'demandas_ref_tipo_chk') then
    alter table public.demandas add constraint demandas_ref_tipo_chk
      check (ref_tipo is null or ref_tipo in ('proposta_assinante', 'matricula'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'demandas_atribuicao_motivo_chk') then
    alter table public.demandas add constraint demandas_atribuicao_motivo_chk
      check (atribuicao_motivo is null or atribuicao_motivo in
             ('escolhido', 'analista_da_conta', 'fila', 'assumida', 'reatribuida', 'assumida_na_fila_de_propostas'));
  end if;
end $$;

comment on column public.demandas.origem_tipo is
  'interno = equipe do Agilliza; assinante = licença do Agilliza Tech; vinculado = corretor/parceiro vinculado ao correspondente (nucleo.tenants.vinculo_agilliza).';
comment on column public.demandas.conta_id is 'Conta (nucleo.tenants.id) do Agilliza Tech que originou a demanda.';
comment on column public.demandas.ref_id is 'Registro de origem (ex.: operacional.propostas.id do assinante). Único por ref_tipo.';

-- Uma demanda por proposta do assinante (a sincronização faz upsert por aqui).
create unique index if not exists demandas_ref_uniq on public.demandas (ref_tipo, ref_id) where ref_id is not null;
-- Carga aberta de cada pessoa (a fila conta isto a cada escolha).
create index if not exists demandas_carga_idx on public.demandas (responsavel_id)
  where status in ('aberta', 'em_andamento', 'aguardando') and deleted_at is null;
create index if not exists demandas_sem_responsavel_idx on public.demandas (correspondente_id, prioridade, prazo_sla)
  where responsavel_id is null and status = 'aberta' and deleted_at is null;

alter table public.demanda_historico add column if not exists dados jsonb;

-- ---------------------------------------------------------------------------
-- 2. Configuração: tipos (prazo), filas, participantes, disponibilidade
-- ---------------------------------------------------------------------------
create table if not exists public.demanda_config (
  correspondente_id uuid primary key,
  recebe_assinantes boolean not null default false,
  updated_at        timestamptz not null default now(),
  updated_by        uuid
);
comment on table public.demanda_config is
  'Configuração das demandas por correspondente. recebe_assinantes: quem recebe as demandas das contas do Agilliza Tech sem analista (só um correspondente pode).';
create unique index if not exists demanda_config_um_recebe on public.demanda_config ((true)) where recebe_assinantes;

create table if not exists public.demanda_tipos (
  correspondente_id uuid not null,
  codigo            text not null check (codigo ~ '^[a-z][a-z0-9_]{1,39}$'),
  nome              text not null check (length(btrim(nome)) between 2 and 60),
  sla_horas         numeric not null check (sla_horas > 0 and sla_horas <= 720),
  ativo             boolean not null default true,
  ordem             integer not null default 100 check (ordem between 0 and 1000),
  updated_at        timestamptz not null default now(),
  updated_by        uuid,
  primary key (correspondente_id, codigo)
);
comment on table public.demanda_tipos is
  'Ajuste do correspondente sobre os tipos padrão (demanda_tipos_padrao): nome, prazo em horas úteis (prioridade normal), ativo, ordem.';

create table if not exists public.demanda_filas (
  id                uuid primary key default gen_random_uuid(),
  correspondente_id uuid not null,
  nome              text not null check (length(btrim(nome)) between 2 and 60),
  descricao         text check (descricao is null or length(descricao) <= 300),
  tipos             text[] not null default '{}',
  origens           text[] not null default '{}'
                    check (origens <@ array['interno', 'assinante', 'vinculado']::text[]),
  ativa             boolean not null default true,
  ordem             integer not null default 100 check (ordem between 0 and 1000),
  created_at        timestamptz not null default now(),
  created_by        uuid,
  updated_at        timestamptz not null default now()
);
comment on table public.demanda_filas is
  'Fila de distribuição justa. tipos/origens vazios = atende todos. A primeira fila ativa (por ordem) que atende o tipo e a origem recebe a demanda.';
create unique index if not exists demanda_filas_nome_uniq on public.demanda_filas (correspondente_id, lower(btrim(nome)));

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'demandas_fila_id_fkey') then
    alter table public.demandas add constraint demandas_fila_id_fkey
      foreign key (fila_id) references public.demanda_filas (id) on delete set null;
  end if;
end $$;

create table if not exists public.demanda_fila_membros (
  fila_id    uuid not null references public.demanda_filas (id) on delete cascade,
  user_id    uuid not null,
  ativo      boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (fila_id, user_id)
);
create index if not exists demanda_fila_membros_user on public.demanda_fila_membros (user_id);

create table if not exists public.demanda_pessoas (
  user_id              uuid primary key,
  correspondente_id    uuid not null,
  limite_carga         integer check (limite_carga is null or limite_carga between 1 and 500),
  ausente_desde        timestamptz,
  ausente_ate          timestamptz,
  ausencia_motivo      text check (ausencia_motivo is null or length(ausencia_motivo) <= 200),
  ultima_atribuicao_em timestamptz,
  updated_at           timestamptz not null default now(),
  updated_by           uuid,
  check (ausente_ate is null or ausente_desde is null or ausente_ate > ausente_desde)
);
comment on table public.demanda_pessoas is
  'Disponibilidade de cada pessoa para a fila: limite de carga aberta, ausência (de/até) e a última vez que recebeu demanda (desempate).';

-- RLS: leitura do próprio correspondente para quem vê demandas; escrita só por função.
alter table public.demanda_config enable row level security;
alter table public.demanda_tipos enable row level security;
alter table public.demanda_filas enable row level security;
alter table public.demanda_fila_membros enable row level security;
alter table public.demanda_pessoas enable row level security;

revoke all on public.demanda_config, public.demanda_tipos, public.demanda_filas,
              public.demanda_fila_membros, public.demanda_pessoas from anon, authenticated, public;
grant select on public.demanda_config, public.demanda_tipos, public.demanda_filas,
                public.demanda_fila_membros, public.demanda_pessoas to authenticated;
grant all on public.demanda_config, public.demanda_tipos, public.demanda_filas,
             public.demanda_fila_membros, public.demanda_pessoas to service_role;

drop policy if exists "demanda_config leitura" on public.demanda_config;
create policy "demanda_config leitura" on public.demanda_config for select to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
         and public.usuario_tem_permissao((select auth.uid()), 'operacional.demandas', 'view'));
drop policy if exists "demanda_tipos leitura" on public.demanda_tipos;
create policy "demanda_tipos leitura" on public.demanda_tipos for select to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
         and public.usuario_tem_permissao((select auth.uid()), 'operacional.demandas', 'view'));
drop policy if exists "demanda_filas leitura" on public.demanda_filas;
create policy "demanda_filas leitura" on public.demanda_filas for select to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
         and public.usuario_tem_permissao((select auth.uid()), 'operacional.demandas', 'view'));
drop policy if exists "demanda_fila_membros leitura" on public.demanda_fila_membros;
create policy "demanda_fila_membros leitura" on public.demanda_fila_membros for select to authenticated
  using (exists (select 1 from public.demanda_filas f
                  where f.id = fila_id
                    and f.correspondente_id = public.correspondente_do_usuario((select auth.uid())))
         and public.usuario_tem_permissao((select auth.uid()), 'operacional.demandas', 'view'));
drop policy if exists "demanda_pessoas leitura" on public.demanda_pessoas;
create policy "demanda_pessoas leitura" on public.demanda_pessoas for select to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
         and public.usuario_tem_permissao((select auth.uid()), 'operacional.demandas', 'view'));

-- ---------------------------------------------------------------------------
-- 3. Tipos padrão e prazo
-- ---------------------------------------------------------------------------
create or replace function public.demanda_tipos_padrao()
returns table (codigo text, nome text, sla_horas numeric, ordem integer)
language sql
immutable
set search_path = public
as $$
  values ('consulta_ficha', 'Consulta de ficha', 4::numeric, 10),
         ('simulacao', 'Simulação', 4::numeric, 20),
         ('proposta', 'Proposta', 8::numeric, 30),
         ('documentacao', 'Documentação', 8::numeric, 40),
         ('matricula', 'Matrícula', 24::numeric, 50),
         ('duvida', 'Dúvida', 4::numeric, 60),
         ('outro', 'Outro', 8::numeric, 70)
$$;

/** Tipos do correspondente: os padrões com o ajuste dele + os tipos próprios. */
create or replace function public.demanda_tipos_do_correspondente(p_corr uuid)
returns table (codigo text, nome text, sla_horas numeric, ativo boolean, ordem integer, padrao boolean)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(t.codigo, p.codigo), coalesce(t.nome, p.nome), coalesce(t.sla_horas, p.sla_horas),
         coalesce(t.ativo, true), coalesce(t.ordem, p.ordem), p.codigo is not null
    from public.demanda_tipos_padrao() p
    full join (select * from public.demanda_tipos where correspondente_id = p_corr) t on t.codigo = p.codigo
   order by 5, 2
$$;

/**
 * Prazo (horas úteis) de uma demanda: a regra de SLA de Configurações (sla_configuracoes,
 * tipo + prioridade) vence; senão o prazo do tipo, ajustado pela prioridade (urgente = metade,
 * baixa = dobro); senão o padrão antigo por prioridade (4/8/24).
 */
create or replace function public._demanda_sla(p_corr uuid, p_tipo text, p_prioridade text)
returns numeric
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v numeric;
begin
  select horas_uteis into v from public.sla_configuracoes
   where correspondente_id = p_corr and tipo = p_tipo and prioridade = p_prioridade and ativo
   limit 1;
  if v is not null then return v; end if;
  select t.sla_horas into v from public.demanda_tipos_do_correspondente(p_corr) t where t.codigo = p_tipo;
  if v is not null then
    return round(v * case p_prioridade when 'p1' then 0.5 when 'p3' then 2 else 1 end, 2);
  end if;
  return case p_prioridade when 'p1' then 4 when 'p2' then 8 else 24 end;
end $$;

-- Gatilho existente (gerado de pg_get_functiondef): só o cálculo do SLA passa por _demanda_sla.
CREATE OR REPLACE FUNCTION public.demanda_before_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP='INSERT' THEN
    IF NEW.numero IS NULL OR NEW.numero='' THEN
      NEW.numero := 'DEM-' || lpad(nextval('public.demanda_numero_seq')::text, 6, '0');
    END IF;
    IF NEW.sla_inicio IS NULL THEN NEW.sla_inicio := now(); END IF;
    IF NEW.sla_horas IS NULL THEN
      NEW.sla_horas := public._demanda_sla(NEW.correspondente_id, NEW.tipo, NEW.prioridade::text);
    END IF;
    IF NEW.prazo_sla IS NULL THEN
      NEW.prazo_sla := public.add_horas_uteis(NEW.correspondente_id, NEW.sla_inicio, NEW.sla_horas);
    END IF;
  END IF;
  IF NEW.status='concluida' AND NEW.concluida_em IS NULL THEN NEW.concluida_em := now(); END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $function$;

-- ---------------------------------------------------------------------------
-- 4. Peças da distribuição
-- ---------------------------------------------------------------------------

/** Carga aberta da pessoa: demandas dela em Nova, Em andamento ou Aguardando. */
create or replace function public.demanda_carga(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from public.demandas
   where responsavel_id = p_user and status in ('aberta', 'em_andamento', 'aguardando') and deleted_at is null
$$;

/** Pessoa ausente agora (férias/indisponível com data de/até). */
create or replace function public._demanda_ausente(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select dp.ausente_desde is not null and dp.ausente_desde <= now()
                          and (dp.ausente_ate is null or dp.ausente_ate > now())
                     from public.demanda_pessoas dp where dp.user_id = p_user), false)
$$;

/** Pessoa ativa do correspondente (pode receber demanda). */
create or replace function public._demanda_pessoa_ativa(p_user uuid, p_corr uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles p
                  where p.id = p_user and p.correspondente_id = p_corr
                    and coalesce(p.ativo, true) and p.bloqueado_em is null and p.deleted_at is null)
$$;

/** Quem gere demandas (configura filas, tipos e disponibilidade dos outros). */
create or replace function public._demanda_pode_gerir(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_any_role(p_user, array['admin', 'correspondente', 'gestor']::public.app_role[])
      or public.usuario_tem_permissao(p_user, 'admin.sla', 'edit')
$$;

/**
 * Analista da conta do Agilliza Tech (carteira). A função do Agilliza Tech
 * (`plataforma.analista_da_conta_auth`, migração 0320) pode não existir — banco sem o
 * Agilliza Tech, ou antes da migração: então não há analista de conta.
 */
create or replace function public._demanda_analista_da_conta(p_conta uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v uuid;
begin
  if p_conta is null or to_regprocedure('plataforma.analista_da_conta_auth(uuid)') is null then
    return null;
  end if;
  begin
    execute 'select plataforma.analista_da_conta_auth($1)' into v using p_conta;
  exception when others then
    return null;
  end;
  return v;
end $$;

/** Nome e vínculo de uma conta do Agilliza Tech (para demanda criada à mão com origem externa). */
create or replace function public._demanda_conta(p_conta uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v jsonb;
begin
  if p_conta is null or to_regprocedure('plataforma.conta_para_demanda(uuid)') is null then
    return null;
  end if;
  begin
    execute 'select plataforma.conta_para_demanda($1)' into v using p_conta;
  exception when others then
    return null;
  end;
  return v;
end $$;

/** Primeira fila ativa (por ordem) que atende o tipo e a origem. */
create or replace function public._demanda_fila_para(p_corr uuid, p_tipo text, p_origem text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select f.id from public.demanda_filas f
   where f.correspondente_id = p_corr and f.ativa
     and (cardinality(f.tipos) = 0 or p_tipo = any (f.tipos))
     and (cardinality(f.origens) = 0 or p_origem = any (f.origens))
   order by f.ordem, f.created_at, f.id
   limit 1
$$;

/**
 * Candidatos de uma fila, já na ordem justa: disponíveis primeiro, menor carga aberta,
 * quem recebeu há mais tempo (nunca recebeu = primeiro), id (determinístico).
 */
create or replace function public.demanda_candidatos(p_fila uuid, p_excluir uuid[] default null)
returns table (user_id uuid, nome text, carga integer, limite integer, ausente boolean,
               ultima_atribuicao_em timestamptz, disponivel boolean)
language sql
stable
security definer
set search_path = public
as $$
  with m as (
    select mm.user_id, coalesce(nullif(btrim(p.nome), ''), p.email) as nome,
           public.demanda_carga(mm.user_id) as carga, dp.limite_carga as limite,
           public._demanda_ausente(mm.user_id) as ausente, dp.ultima_atribuicao_em
      from public.demanda_fila_membros mm
      join public.demanda_filas f on f.id = mm.fila_id
      join public.profiles p on p.id = mm.user_id and p.correspondente_id = f.correspondente_id
       and coalesce(p.ativo, true) and p.bloqueado_em is null and p.deleted_at is null
      left join public.demanda_pessoas dp on dp.user_id = mm.user_id
     where mm.fila_id = p_fila and mm.ativo
       and not (mm.user_id = any (coalesce(p_excluir, '{}'::uuid[])))
  )
  select m.user_id, m.nome, m.carga, m.limite, m.ausente, m.ultima_atribuicao_em,
         (not m.ausente and (m.limite is null or m.carga < m.limite)) as disponivel
    from m
   order by (not m.ausente and (m.limite is null or m.carga < m.limite)) desc,
            m.carga, m.ultima_atribuicao_em nulls first, m.user_id
$$;

/** Grava a atribuição: demanda, desempate da pessoa, histórico com o porquê, aviso. */
create or replace function public._demanda_atribuir(
  p_dem uuid, p_para uuid, p_motivo text, p_ator uuid, p_detalhe text, p_dados jsonb default null,
  p_acao text default 'atribuida', p_motivo_texto text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.demandas%rowtype;
begin
  select * into d from public.demandas where id = p_dem;
  update public.demandas
     set responsavel_id = p_para,
         atribuicao_motivo = case when p_para is null then null else p_motivo end,
         atribuida_em = case when p_para is null then null else now() end
   where id = p_dem;
  if p_para is not null then
    insert into public.demanda_pessoas (user_id, correspondente_id, ultima_atribuicao_em)
    values (p_para, d.correspondente_id, now())
    on conflict (user_id) do update set ultima_atribuicao_em = now();
  end if;
  insert into public.demanda_historico (demanda_id, ator_id, acao, responsavel_anterior_id, responsavel_novo_id,
                                        motivo, detalhe, dados)
  values (p_dem, p_ator, p_acao, d.responsavel_id, p_para, p_motivo_texto, p_detalhe,
          coalesce(p_dados, '{}'::jsonb) || jsonb_build_object('motivo', p_motivo));
  if p_para is not null and p_para is distinct from p_ator then
    perform public.emitir_notificacao(p_para, d.correspondente_id, 'demanda.atribuida',
      'Demanda para você: ' || d.titulo, coalesce(p_detalhe, ''), '/operacional/demandas/' || d.id);
  end if;
end $$;

/**
 * Distribui uma demanda sem responsável:
 *   1. conta com analista (carteira) → o analista, se estiver ativo e não ausente;
 *   2. senão a fila da demanda (ou a primeira que atende tipo + origem) → candidato justo;
 *   3. ninguém disponível → fica "sem responsável" na fila, com o motivo no histórico.
 * Trava: linha da demanda (FOR UPDATE) + trava do correspondente durante a escolha.
 * Uso interno (gatilho, criação, devolução, redistribuição); não é exposta à API.
 */
create or replace function public.demanda_distribuir(p_dem uuid, p_excluir uuid[] default null, p_ator uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.demandas%rowtype;
  v_analista uuid;
  v_nota text;
  v_fila uuid;
  v_fila_nome text;
  esc record;
  v_cand jsonb;
  v_ultimo text;
begin
  select * into d from public.demandas where id = p_dem for update;
  if not found or d.deleted_at is not null then
    return jsonb_build_object('ok', false, 'motivo', 'nao_encontrada');
  end if;
  if d.responsavel_id is not null then
    return jsonb_build_object('ok', false, 'motivo', 'ja_tem_responsavel', 'responsavel_id', d.responsavel_id);
  end if;
  if d.status in ('concluida', 'cancelada') then
    return jsonb_build_object('ok', false, 'motivo', 'encerrada');
  end if;

  -- Uma escolha por vez em cada correspondente: duas demandas simultâneas não "veem" a
  -- mesma carga e não caem as duas na mesma pessoa.
  perform pg_advisory_xact_lock(hashtextextended('demandas:fila:' || d.correspondente_id::text, 0));

  -- 1. Analista da conta
  if d.conta_id is not null then
    v_analista := public._demanda_analista_da_conta(d.conta_id);
    if v_analista is not null then
      if not public._demanda_pessoa_ativa(v_analista, d.correspondente_id) then
        v_nota := 'O analista da conta não é uma pessoa ativa deste correspondente.';
      elsif v_analista = any (coalesce(p_excluir, '{}'::uuid[])) then
        v_nota := 'O analista da conta devolveu a demanda.';
      elsif public._demanda_ausente(v_analista) then
        v_nota := 'O analista da conta está ausente.';
      else
        perform public._demanda_atribuir(p_dem, v_analista, 'analista_da_conta', p_ator,
          'Analista responsável pela conta ' || coalesce(d.conta_nome, '') || '.',
          jsonb_build_object('conta_id', d.conta_id));
        return jsonb_build_object('ok', true, 'responsavel_id', v_analista, 'motivo', 'analista_da_conta');
      end if;
    end if;
  end if;

  -- 2. Fila
  if d.fila_id is not null and exists (select 1 from public.demanda_filas f where f.id = d.fila_id and f.ativa
                                                                         and f.correspondente_id = d.correspondente_id) then
    v_fila := d.fila_id;
  else
    v_fila := public._demanda_fila_para(d.correspondente_id, d.tipo, d.origem_tipo);
  end if;
  if v_fila is null then
    update public.demandas set fila_id = null where id = p_dem and fila_id is not null;
    select acao into v_ultimo from public.demanda_historico where demanda_id = p_dem order by created_at desc, id desc limit 1;
    if v_ultimo is distinct from 'sem_fila' then
      insert into public.demanda_historico (demanda_id, ator_id, acao, detalhe, dados)
      values (p_dem, p_ator, 'sem_fila', concat_ws(' ', v_nota,
              'Nenhuma fila ativa atende este tipo e esta origem: a demanda fica sem responsável.'),
              jsonb_build_object('tipo', d.tipo, 'origem', d.origem_tipo));
    end if;
    return jsonb_build_object('ok', false, 'motivo', 'sem_fila');
  end if;
  select nome into v_fila_nome from public.demanda_filas where id = v_fila;
  update public.demandas set fila_id = v_fila where id = p_dem and fila_id is distinct from v_fila;

  select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) into v_cand from public.demanda_candidatos(v_fila, p_excluir) c;
  select * into esc from public.demanda_candidatos(v_fila, p_excluir) c where c.disponivel limit 1;
  if esc.user_id is null then
    select acao into v_ultimo from public.demanda_historico where demanda_id = p_dem order by created_at desc, id desc limit 1;
    if v_ultimo is distinct from 'aguardando_fila' then
      insert into public.demanda_historico (demanda_id, ator_id, acao, detalhe, dados)
      values (p_dem, p_ator, 'aguardando_fila',
              concat_ws(' ', v_nota, 'Fila ' || v_fila_nome || ': ninguém disponível agora ('
                || (select count(*) from jsonb_array_elements(v_cand) x where (x ->> 'ausente')::boolean) || ' ausente(s), '
                || (select count(*) from jsonb_array_elements(v_cand) x
                     where not (x ->> 'ausente')::boolean and not (x ->> 'disponivel')::boolean) || ' no limite de carga).'
                || ' A demanda entra para a primeira pessoa que ficar livre.'),
              jsonb_build_object('fila_id', v_fila, 'candidatos', v_cand));
    end if;
    return jsonb_build_object('ok', false, 'motivo', 'ninguem_disponivel', 'fila_id', v_fila);
  end if;

  perform public._demanda_atribuir(p_dem, esc.user_id, 'fila', p_ator,
    concat_ws(' ', v_nota, 'Fila ' || v_fila_nome || ': ' || esc.nome || ' tinha a menor carga aberta ('
      || esc.carga || case when esc.limite is not null then ' de ' || esc.limite else '' end || ')'
      || case when (select count(*) from jsonb_array_elements(v_cand) x
                     where (x ->> 'disponivel')::boolean and (x ->> 'carga')::int = esc.carga) > 1
              then '; no empate, recebeu há mais tempo.' else '.' end),
    jsonb_build_object('fila_id', v_fila, 'candidatos', v_cand));
  return jsonb_build_object('ok', true, 'responsavel_id', esc.user_id, 'motivo', 'fila', 'fila_id', v_fila);
end $$;

/** Redistribui as demandas sem responsável (alguém voltou, entrou na fila, liberou carga). */
create or replace function public.demanda_distribuir_pendentes(p_corr uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  n integer := 0;
  res jsonb;
begin
  for r in
    select id from public.demandas
     where correspondente_id = p_corr and responsavel_id is null and status = 'aberta' and deleted_at is null
     order by prioridade, prazo_sla nulls last, created_at
     limit 200
  loop
    res := public.demanda_distribuir(r.id, null, null);
    if (res ->> 'ok')::boolean then n := n + 1; end if;
  end loop;
  return n;
end $$;

create or replace function public.demanda_distribuir_pendentes_todos()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  c uuid;
  n integer := 0;
begin
  for c in select distinct correspondente_id from public.demandas
            where responsavel_id is null and status = 'aberta' and deleted_at is null
  loop
    n := n + public.demanda_distribuir_pendentes(c);
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Acesso: quem participa da fila enxerga a demanda sem responsável dela.
--    Função existente (gerada de pg_get_functiondef): acrescentada só a última condição.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.usuario_tem_acesso_demanda(_user_id uuid, _dem_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.demandas d
    WHERE d.id=_dem_id
      AND d.correspondente_id = public.correspondente_do_usuario(_user_id)
      AND (
        public.usuario_escopo_dados(_user_id,'operacional.demandas') IN ('todos','equipe')
        OR d.responsavel_id=_user_id OR d.criador_id=_user_id
        OR EXISTS (SELECT 1 FROM public.demanda_participantes dp WHERE dp.demanda_id=d.id AND dp.user_id=_user_id)
        OR (d.cliente_id IS NOT NULL AND public.cliente_vinculado_ao_parceiro(_user_id, d.cliente_id))
        OR (public.usuario_escopo_dados(_user_id,'operacional.demandas') = 'personalizado'
            AND (public.usuario_escopo_inclui_dono(_user_id,'operacional.demandas', d.responsavel_id)
              OR public.usuario_escopo_inclui_dono(_user_id,'operacional.demandas', d.criador_id)))
        -- C36: demanda sem responsável aparece para quem participa da fila dela.
        OR (d.responsavel_id IS NULL AND d.fila_id IS NOT NULL
            AND EXISTS (SELECT 1 FROM public.demanda_fila_membros m
                         WHERE m.fila_id = d.fila_id AND m.user_id = _user_id AND m.ativo))
      )
  );
$function$;

-- ---------------------------------------------------------------------------
-- 6. Ações das telas (sessão do Supabase: auth.uid())
-- ---------------------------------------------------------------------------

/** Sessão + correspondente da pessoa (erro legível se faltar). */
create or replace function public._demanda_sessao()
returns table (u uuid, corr uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_u uuid := auth.uid();
  v_c uuid;
begin
  if v_u is null then
    raise exception 'Sua sessão expirou. Entre de novo.' using errcode = '28000';
  end if;
  v_c := public.correspondente_do_usuario(v_u);
  if v_c is null then
    raise exception 'Sua conta ainda não está vinculada a um correspondente.' using errcode = '42501';
  end if;
  return query select v_u, v_c;
end $$;

/**
 * Cria a demanda. Sem responsável escolhido, a distribuição decide (analista da conta ou
 * fila justa). Tudo na mesma transação: a demanda nunca nasce pela metade.
 */
create or replace function public.demanda_criar(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  v_tipo text := nullif(btrim(p ->> 'tipo'), '');
  v_titulo text := btrim(coalesce(p ->> 'titulo', ''));
  v_desc text := nullif(btrim(coalesce(p ->> 'descricao', '')), '');
  v_prio text := coalesce(nullif(p ->> 'prioridade', ''), 'p2');
  v_cliente uuid := nullif(p ->> 'cliente_id', '')::uuid;
  v_proposta uuid := nullif(p ->> 'proposta_id', '')::uuid;
  v_simulacao uuid := nullif(p ->> 'simulacao_id', '')::uuid;
  v_resp uuid := nullif(p ->> 'responsavel_id', '')::uuid;
  v_fila uuid := nullif(p ->> 'fila_id', '')::uuid;
  v_conta uuid := nullif(p ->> 'conta_id', '')::uuid;
  v_conta_info jsonb;
  v_origem text := 'interno';
  v_conta_nome text;
  v_part uuid[];
  v_id uuid;
begin
  select * into s from public._demanda_sessao();
  if not public.usuario_tem_permissao(s.u, 'operacional.demandas', 'create') then
    raise exception 'Você não tem permissão para criar demandas.' using errcode = '42501';
  end if;
  if v_tipo is null or not exists (select 1 from public.demanda_tipos_do_correspondente(s.corr) t
                                    where t.codigo = v_tipo and t.ativo) then
    raise exception 'Escolha um tipo de demanda ativo.' using errcode = '22023';
  end if;
  if length(v_titulo) < 2 or length(v_titulo) > 160 then
    raise exception 'O título vai de 2 a 160 letras.' using errcode = '22023';
  end if;
  if v_desc is not null and length(v_desc) > 4000 then
    raise exception 'A descrição passa de 4.000 letras.' using errcode = '22023';
  end if;
  if v_prio not in ('p1', 'p2', 'p3') then
    raise exception 'Prioridade inválida.' using errcode = '22023';
  end if;
  if v_cliente is not null and not exists (select 1 from public.clientes where id = v_cliente and correspondente_id = s.corr) then
    raise exception 'Cliente fora do seu ecossistema.' using errcode = '42501';
  end if;
  if v_proposta is not null and not exists (select 1 from public.propostas where id = v_proposta and correspondente_id = s.corr) then
    raise exception 'Proposta fora do seu ecossistema.' using errcode = '42501';
  end if;
  if v_simulacao is not null and not exists (select 1 from public.simulacoes where id = v_simulacao and correspondente_id = s.corr) then
    raise exception 'Simulação fora do seu ecossistema.' using errcode = '42501';
  end if;
  if v_resp is not null and not public._demanda_pessoa_ativa(v_resp, s.corr) then
    raise exception 'Responsável fora do seu ecossistema.' using errcode = '42501';
  end if;
  if v_fila is not null and not exists (select 1 from public.demanda_filas where id = v_fila and correspondente_id = s.corr and ativa) then
    raise exception 'Fila inválida.' using errcode = '22023';
  end if;
  if v_conta is not null then
    v_conta_info := public._demanda_conta(v_conta);
    if v_conta_info is null then
      raise exception 'Conta do Agilliza Tech não encontrada.' using errcode = '22023';
    end if;
    v_origem := case when coalesce((v_conta_info ->> 'vinculo')::boolean, false) then 'vinculado' else 'assinante' end;
    v_conta_nome := left(v_conta_info ->> 'nome', 200);
  end if;
  select coalesce(array_agg(distinct x::uuid), '{}') into v_part
    from jsonb_array_elements_text(coalesce(p -> 'participantes', '[]'::jsonb)) x;
  if cardinality(v_part) > 20 then
    raise exception 'No máximo 20 participantes.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_part) x where not public._demanda_pessoa_ativa(x, s.corr)) then
    raise exception 'Há participantes fora do seu ecossistema.' using errcode = '42501';
  end if;

  insert into public.demandas (correspondente_id, tipo, titulo, descricao, prioridade, cliente_id, proposta_id,
                               simulacao_id, responsavel_id, criador_id, origem, origem_tipo, conta_id, conta_nome,
                               fila_id, atribuicao_motivo, atribuida_em)
  values (s.corr, v_tipo, v_titulo, v_desc, v_prio::public.prioridade_op, v_cliente, v_proposta, v_simulacao,
          v_resp, s.u, 'manual', v_origem, v_conta, v_conta_nome, v_fila,
          case when v_resp is not null then 'escolhido' end, case when v_resp is not null then now() end)
  returning id into v_id;

  insert into public.demanda_participantes (demanda_id, user_id)
  select v_id, x from unnest(v_part) x where x <> s.u and x is distinct from v_resp;

  if v_resp is not null then
    insert into public.demanda_pessoas (user_id, correspondente_id, ultima_atribuicao_em)
    values (v_resp, s.corr, now())
    on conflict (user_id) do update set ultima_atribuicao_em = now();
  else
    perform public.demanda_distribuir(v_id, null, s.u);
  end if;
  return v_id;
end $$;

/** Pode pegar demanda sem responsável desta fila (participa, vê a equipe toda, transfere ou gere). */
create or replace function public._demanda_pode_pegar(p_user uuid, p_fila uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (p_fila is not null and exists (select 1 from public.demanda_fila_membros m
                                          where m.fila_id = p_fila and m.user_id = p_user and m.ativo))
      or public.usuario_escopo_dados(p_user, 'operacional.demandas') in ('todos', 'equipe')
      or public.usuario_tem_permissao(p_user, 'operacional.demandas', 'transferir')
      or public._demanda_pode_gerir(p_user)
$$;

/** Assume uma demanda SEM responsável. Corrida: a segunda pessoa recebe "já está com fulano". */
create or replace function public.demanda_assumir(p_dem uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  d public.demandas%rowtype;
  v_lim integer;
  v_nome text;
begin
  select * into s from public._demanda_sessao();
  select * into d from public.demandas where id = p_dem and deleted_at is null for update;
  if not found or d.correspondente_id <> s.corr then
    raise exception 'Demanda não encontrada.' using errcode = 'P0002';
  end if;
  if d.status in ('concluida', 'cancelada') then
    raise exception 'Demanda encerrada não pode ser assumida.' using errcode = '55000';
  end if;
  if d.responsavel_id = s.u then return; end if;
  if d.responsavel_id is not null then
    select coalesce(nullif(btrim(nome), ''), 'outra pessoa') into v_nome from public.profiles where id = d.responsavel_id;
    raise exception 'Esta demanda já está com %.', coalesce(v_nome, 'outra pessoa') using errcode = '55000';
  end if;
  if not public._demanda_pode_pegar(s.u, d.fila_id) then
    raise exception 'Você não participa da fila desta demanda.' using errcode = '42501';
  end if;
  select limite_carga into v_lim from public.demanda_pessoas where user_id = s.u;
  if v_lim is not null and public.demanda_carga(s.u) >= v_lim then
    raise exception 'Você está no seu limite de carga (% demandas abertas).', v_lim using errcode = '55000';
  end if;
  perform public._demanda_atribuir(p_dem, s.u, 'assumida', s.u, 'Assumiu a demanda.', null);
  if d.status = 'aberta' then
    update public.demandas set status = 'em_andamento' where id = p_dem;
  end if;
end $$;

/** "Pegar a próxima": a demanda sem responsável mais urgente das filas da pessoa. */
create or replace function public.demanda_pegar_proxima()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  v_id uuid;
  v_lim integer;
begin
  select * into s from public._demanda_sessao();
  select limite_carga into v_lim from public.demanda_pessoas where user_id = s.u;
  if v_lim is not null and public.demanda_carga(s.u) >= v_lim then
    raise exception 'Você está no seu limite de carga (% demandas abertas).', v_lim using errcode = '55000';
  end if;
  select d.id into v_id
    from public.demandas d
   where d.correspondente_id = s.corr and d.responsavel_id is null and d.status = 'aberta' and d.deleted_at is null
     -- Das filas da pessoa; demanda sem fila só para quem gere ou vê a equipe toda.
     and ((d.fila_id is not null and exists (select 1 from public.demanda_fila_membros m
                                              where m.fila_id = d.fila_id and m.user_id = s.u and m.ativo))
          or (d.fila_id is null and (public._demanda_pode_gerir(s.u)
                                     or public.usuario_escopo_dados(s.u, 'operacional.demandas') in ('todos', 'equipe'))))
   order by d.prioridade, d.prazo_sla nulls last, d.created_at, d.id
   limit 1
   for update skip locked;
  if v_id is null then return null; end if;
  perform public._demanda_atribuir(v_id, s.u, 'assumida', s.u, 'Pegou a próxima da fila.', null);
  update public.demandas set status = 'em_andamento' where id = v_id and status = 'aberta';
  return v_id;
end $$;

/**
 * Reatribuição manual com motivo. Destino nulo = devolver à fila (a distribuição escolhe
 * outra pessoa, sem a atual). Quem pode: quem gere, ou responsável/criador com a ação
 * "transferir" da matriz de permissões.
 */
create or replace function public.demanda_reatribuir(p_dem uuid, p_para uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  d public.demandas%rowtype;
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_nome text;
  res jsonb;
begin
  select * into s from public._demanda_sessao();
  if length(v_motivo) < 5 or length(v_motivo) > 500 then
    raise exception 'Explique o motivo (de 5 a 500 letras).' using errcode = '22023';
  end if;
  select * into d from public.demandas where id = p_dem and deleted_at is null for update;
  if not found or d.correspondente_id <> s.corr then
    raise exception 'Demanda não encontrada.' using errcode = 'P0002';
  end if;
  if d.status in ('concluida', 'cancelada') then
    raise exception 'Demanda encerrada não pode ser reatribuída.' using errcode = '55000';
  end if;
  if not (public._demanda_pode_gerir(s.u)
          or ((d.responsavel_id = s.u or d.criador_id = s.u)
              and public.usuario_tem_permissao(s.u, 'operacional.demandas', 'transferir'))) then
    raise exception 'Você não pode reatribuir esta demanda.' using errcode = '42501';
  end if;
  if p_para is not null then
    if not public._demanda_pessoa_ativa(p_para, s.corr) then
      raise exception 'Responsável fora do seu ecossistema.' using errcode = '42501';
    end if;
    if p_para is not distinct from d.responsavel_id then
      raise exception 'A demanda já está com esta pessoa.' using errcode = '22023';
    end if;
    select coalesce(nullif(btrim(nome), ''), email) into v_nome from public.profiles where id = p_para;
    perform public._demanda_atribuir(p_dem, p_para, 'reatribuida', s.u, 'Reatribuída para ' || v_nome || '.',
                                     null, 'transferida', v_motivo);
    return jsonb_build_object('ok', true, 'responsavel_id', p_para);
  end if;
  if d.responsavel_id is null then
    raise exception 'A demanda já está na fila, sem responsável.' using errcode = '22023';
  end if;
  perform public._demanda_atribuir(p_dem, null, null, s.u, 'Devolvida à fila.', null, 'devolvida', v_motivo);
  update public.demandas set status = 'aberta' where id = p_dem and status = 'em_andamento';
  res := public.demanda_distribuir(p_dem, array[d.responsavel_id], s.u);
  return res;
end $$;

/** Transições permitidas da situação (as telas usam a mesma tabela: demandas-regras.ts). */
create or replace function public.demanda_transicao_permitida(p_de text, p_para text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select p_de = p_para or (p_de, p_para) in (
    ('aberta', 'em_andamento'), ('aberta', 'aguardando'), ('aberta', 'concluida'), ('aberta', 'cancelada'),
    ('em_andamento', 'aguardando'), ('em_andamento', 'concluida'), ('em_andamento', 'cancelada'),
    ('aguardando', 'em_andamento'), ('aguardando', 'concluida'), ('aguardando', 'cancelada'),
    ('concluida', 'em_andamento'),
    ('cancelada', 'aberta'))
$$;

/**
 * Muda a situação. Valida a transição, exige a ação "encerrar" para concluir/cancelar e
 * motivo para cancelar. Colocar "em andamento" uma demanda sem responsável = assumir.
 */
create or replace function public.demanda_mudar_status(p_dem uuid, p_status text, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  d public.demandas%rowtype;
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_dest uuid;
  v_rot text;
begin
  select * into s from public._demanda_sessao();
  if p_status is null or p_status not in ('aberta', 'em_andamento', 'aguardando', 'concluida', 'cancelada') then
    raise exception 'Situação inválida.' using errcode = '22023';
  end if;
  select * into d from public.demandas where id = p_dem and deleted_at is null for update;
  if not found or not public.usuario_tem_acesso_demanda(s.u, p_dem) then
    raise exception 'Demanda não encontrada.' using errcode = 'P0002';
  end if;
  if d.status::text = p_status then return; end if;
  if not public.demanda_transicao_permitida(d.status::text, p_status) then
    raise exception 'Esta mudança de situação não é permitida.' using errcode = '22023';
  end if;
  if p_status in ('concluida', 'cancelada')
     and not public.usuario_tem_permissao(s.u, 'operacional.demandas', 'encerrar') then
    raise exception 'Você não tem permissão para encerrar demandas.' using errcode = '42501';
  end if;
  if p_status = 'cancelada' and (v_motivo is null or length(v_motivo) < 3) then
    raise exception 'Diga o motivo do cancelamento.' using errcode = '22023';
  end if;
  if p_status = 'em_andamento' and d.responsavel_id is null then
    perform public.demanda_assumir(p_dem);
    return;
  end if;
  if not (d.responsavel_id = s.u or d.criador_id = s.u or public._demanda_pode_gerir(s.u)
          or exists (select 1 from public.demanda_participantes dp where dp.demanda_id = p_dem and dp.user_id = s.u)
          or public.usuario_escopo_dados(s.u, 'operacional.demandas') in ('todos', 'equipe')) then
    raise exception 'Só quem participa da demanda muda a situação.' using errcode = '42501';
  end if;

  update public.demandas
     set status = p_status::public.demanda_status,
         concluida_em = case when p_status = 'concluida' then now() when d.status = 'concluida' then null else concluida_em end
   where id = p_dem;
  insert into public.demanda_historico (demanda_id, ator_id, acao, detalhe, motivo)
  values (p_dem, s.u, 'status', p_status, v_motivo);

  v_rot := case p_status when 'aberta' then 'Nova' when 'em_andamento' then 'Em andamento'
                         when 'aguardando' then 'Aguardando solicitante' when 'concluida' then 'Concluída'
                         else 'Cancelada' end;
  for v_dest in
    select x from (select d.criador_id x union select d.responsavel_id
                   union select dp.user_id from public.demanda_participantes dp where dp.demanda_id = p_dem) t
     where x is not null and x <> s.u
  loop
    perform public.emitir_notificacao(v_dest, d.correspondente_id, 'demanda.status',
      'Demanda atualizada: ' || d.titulo, 'Situação: ' || v_rot, '/operacional/demandas/' || d.id);
  end loop;

  -- Encerrou: abriu carga — as pendentes da fila podem andar.
  if p_status in ('concluida', 'cancelada') then
    perform public.demanda_distribuir_pendentes(d.correspondente_id);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 7. Integração com a fila de propostas dos assinantes (Agilliza Tech, 0320)
-- ---------------------------------------------------------------------------

/** Correspondente que recebe as demandas das contas: o do analista; senão o configurado; senão o único. */
create or replace function public._demanda_correspondente_assinantes(p_analista uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v uuid;
  n integer;
begin
  if p_analista is not null then
    select correspondente_id into v from public.profiles where id = p_analista;
    if v is not null then return v; end if;
  end if;
  select correspondente_id into v from public.demanda_config where recebe_assinantes;
  if v is not null then return v; end if;
  select count(distinct correspondente_id), (array_agg(distinct correspondente_id))[1] into n, v
    from public.profiles where correspondente_id is not null and acesso_tipo::text = 'sistema';
  if n = 1 then return v; end if;
  return null;
end $$;

/**
 * Proposta de assinante nova ou alterada → demanda (cria uma vez; depois só acompanha).
 * Chamada pelo gatilho do Agilliza Tech (0320) com:
 *   {proposta_id, codigo, tenant_id, conta, vinculo, status, assumida, analista_auth,
 *    carteira (bool: analista veio da carteira), solicitante, cliente, banco, valor}
 * Situação da proposta → situação da demanda:
 *   cancelada → Cancelada; recusada/registrado → Concluída; aguardando_documentos/condicionada →
 *   Aguardando solicitante; assumida (demais) → Em andamento. Pendente não mexe.
 * Quem assumiu na fila de propostas vira o responsável (o trabalho real manda).
 */
create or replace function public.demanda_de_proposta_assinante(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prop uuid := nullif(p ->> 'proposta_id', '')::uuid;
  v_status text := p ->> 'status';
  v_assumida boolean := coalesce((p ->> 'assumida')::boolean, false);
  v_analista uuid := nullif(p ->> 'analista_auth', '')::uuid;
  v_corr uuid;
  v_alvo text;
  d public.demandas%rowtype;
  v_id uuid;
  v_valor numeric := nullif(p ->> 'valor', '')::numeric;
  v_desc text;
begin
  if v_prop is null then return null; end if;
  v_alvo := case
    when v_status = 'cancelada' then 'cancelada'
    when v_status in ('recusada', 'registrado') then 'concluida'
    when v_status in ('aguardando_documentos', 'condicionada') then 'aguardando'
    when v_assumida then 'em_andamento'
    else null end;

  select * into d from public.demandas where ref_tipo = 'proposta_assinante' and ref_id = v_prop for update;
  if not found then
    -- Só nasce demanda de proposta viva (a carga inicial não traz o arquivo morto).
    if v_status in ('cancelada', 'recusada', 'registrado') then return null; end if;
    v_corr := public._demanda_correspondente_assinantes(v_analista);
    if v_corr is null then return null; end if;
    if v_analista is not null and not public._demanda_pessoa_ativa(v_analista, v_corr) then
      v_analista := null;
    end if;
    v_desc := concat_ws(E'\n',
      'Proposta ' || coalesce(p ->> 'codigo', '') || ' enviada por ' || coalesce(nullif(p ->> 'solicitante', ''), 'assinante')
        || ' (' || coalesce(p ->> 'conta', 'conta') || ').',
      case when nullif(p ->> 'banco', '') is not null then 'Banco: ' || (p ->> 'banco') end,
      case when v_valor is not null then 'Valor financiado: ' || to_char(v_valor, 'FM"R$ "999G999G999G990D00') end);
    begin
      insert into public.demandas (correspondente_id, tipo, titulo, descricao, prioridade, origem, origem_tipo,
                                   conta_id, conta_nome, solicitante_nome, ref_tipo, ref_id, ref_codigo, ref_status,
                                   status)
      values (v_corr, 'proposta',
              left('Proposta ' || coalesce(p ->> 'codigo', '') || ' — ' || coalesce(nullif(p ->> 'cliente', ''), 'cliente'), 160),
              v_desc, 'p2', 'proposta_assinante',
              case when coalesce((p ->> 'vinculo')::boolean, false) then 'vinculado' else 'assinante' end,
              nullif(p ->> 'tenant_id', '')::uuid, left(p ->> 'conta', 200), left(p ->> 'solicitante', 200),
              'proposta_assinante', v_prop, left(p ->> 'codigo', 40), v_status,
              coalesce(v_alvo, 'aberta')::public.demanda_status)
      returning id into v_id;
    exception when unique_violation then
      -- Duas mudanças da mesma proposta ao mesmo tempo: a outra criou; segue como atualização.
      select * into d from public.demandas where ref_tipo = 'proposta_assinante' and ref_id = v_prop for update;
      v_id := null;
    end;
    if v_id is not null then
      if v_analista is not null and (v_assumida or coalesce((p ->> 'carteira')::boolean, false))
         and not public._demanda_ausente(v_analista) then
        perform public._demanda_atribuir(v_id, v_analista,
          case when v_assumida then 'assumida_na_fila_de_propostas' else 'analista_da_conta' end, null,
          case when v_assumida then 'Assumiu a proposta na fila de propostas dos assinantes.'
               else 'Analista responsável pela conta ' || coalesce(p ->> 'conta', '') || '.' end,
          jsonb_build_object('conta_id', p ->> 'tenant_id'));
      else
        perform public.demanda_distribuir(v_id, null, null);
      end if;
      return v_id;
    end if;
  end if;

  -- Já existe: acompanha a proposta (nunca ressuscita demanda apagada).
  if d.deleted_at is not null then return d.id; end if;
  update public.demandas
     set ref_status = v_status,
         conta_nome = coalesce(left(p ->> 'conta', 200), conta_nome)
   where id = d.id and ref_status is distinct from v_status;
  if v_alvo is not null and v_alvo <> d.status::text
     and public.demanda_transicao_permitida(d.status::text, v_alvo) then
    update public.demandas set status = v_alvo::public.demanda_status,
                               concluida_em = case when v_alvo = 'concluida' then now() else concluida_em end
     where id = d.id;
    insert into public.demanda_historico (demanda_id, ator_id, acao, detalhe, dados)
    values (d.id, null, 'status', v_alvo,
            jsonb_build_object('origem', 'proposta_assinante', 'status_proposta', v_status));
  end if;
  if v_assumida and v_analista is not null and v_analista is distinct from d.responsavel_id
     and public._demanda_pessoa_ativa(v_analista, d.correspondente_id)
     and d.status not in ('concluida', 'cancelada') then
    perform public._demanda_atribuir(d.id, v_analista, 'assumida_na_fila_de_propostas', null,
      'Assumiu a proposta na fila de propostas dos assinantes.', null);
  end if;
  return d.id;
end $$;

-- ---------------------------------------------------------------------------
-- 8. Central (lista + indicadores) e configuração
-- ---------------------------------------------------------------------------

/**
 * Lista da Central e do Kanban, só com o que a pessoa enxerga (usuario_tem_acesso_demanda).
 * Filtros: escopo (minhas | criadas | equipe | sem_responsavel), status[], tipo, origem,
 * prioridade, responsavel_id, fila_id, sla (atrasadas | vencendo | no_prazo), termo,
 * encerradas_dias (encerradas dos últimos N dias; padrão 7).
 */
create or replace function public.demanda_central(p jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s record;
  v_escopo text := coalesce(nullif(p ->> 'escopo', ''), 'minhas');
  v_status text[] := (select array_agg(x) from jsonb_array_elements_text(coalesce(p -> 'status', '[]'::jsonb)) x);
  v_termo text := nullif(btrim(coalesce(p ->> 'termo', '')), '');
  v_dias integer := least(greatest(coalesce(nullif(p ->> 'encerradas_dias', '')::integer, 7), 0), 90);
  r jsonb;
begin
  select * into s from public._demanda_sessao();
  if not public.usuario_tem_permissao(s.u, 'operacional.demandas', 'view') then
    raise exception 'Você não tem permissão para ver demandas.' using errcode = '42501';
  end if;
  if v_escopo not in ('minhas', 'criadas', 'equipe', 'sem_responsavel') then
    raise exception 'Escopo inválido.' using errcode = '22023';
  end if;
  if v_termo is not null and length(v_termo) > 120 then v_termo := left(v_termo, 120); end if;

  with vis as materialized (
    select d.* from public.demandas d
     where d.correspondente_id = s.corr and d.deleted_at is null
       and (d.status in ('aberta', 'em_andamento', 'aguardando')
            or coalesce(d.concluida_em, d.updated_at) >= now() - make_interval(days => v_dias))
       and public.usuario_tem_acesso_demanda(s.u, d.id)
  ), cont as (
    select count(*) filter (where responsavel_id = s.u and status in ('aberta', 'em_andamento', 'aguardando')) minhas,
           count(*) filter (where criador_id = s.u and status in ('aberta', 'em_andamento', 'aguardando')) criadas,
           count(*) filter (where status in ('aberta', 'em_andamento', 'aguardando')) equipe,
           count(*) filter (where responsavel_id is null and status = 'aberta') sem_responsavel,
           count(*) filter (where status in ('aberta', 'em_andamento', 'aguardando') and prazo_sla < now()) atrasadas,
           count(*) filter (where status in ('aberta', 'em_andamento', 'aguardando')
                              and prazo_sla >= now() and prazo_sla < now() + interval '4 hours') vencendo,
           count(*) filter (where status = 'aguardando') aguardando,
           count(*) filter (where status = 'concluida' and concluida_em >= date_trunc('day', now())) concluidas_hoje
      from vis
  ), filtrada as (
    select v.* from vis v
     where (v_escopo = 'equipe'
            or (v_escopo = 'minhas' and v.responsavel_id = s.u)
            or (v_escopo = 'criadas' and v.criador_id = s.u)
            or (v_escopo = 'sem_responsavel' and v.responsavel_id is null and v.status = 'aberta'))
       and (v_status is null or v.status::text = any (v_status))
       and (nullif(p ->> 'tipo', '') is null or v.tipo = p ->> 'tipo')
       and (nullif(p ->> 'origem', '') is null or v.origem_tipo = p ->> 'origem')
       and (nullif(p ->> 'prioridade', '') is null or v.prioridade::text = p ->> 'prioridade')
       and (nullif(p ->> 'responsavel_id', '') is null or v.responsavel_id = (p ->> 'responsavel_id')::uuid)
       and (nullif(p ->> 'fila_id', '') is null or v.fila_id = (p ->> 'fila_id')::uuid)
       and (nullif(p ->> 'sla', '') is null
            or (p ->> 'sla' = 'atrasadas' and v.prazo_sla < now() and v.status in ('aberta', 'em_andamento', 'aguardando'))
            or (p ->> 'sla' = 'vencendo' and v.prazo_sla >= now() and v.prazo_sla < now() + interval '4 hours'
                and v.status in ('aberta', 'em_andamento', 'aguardando'))
            or (p ->> 'sla' = 'no_prazo' and (v.prazo_sla is null or v.prazo_sla >= now() + interval '4 hours')))
       and (v_termo is null
            or (coalesce(v.numero, '') || ' ' || v.titulo || ' ' || coalesce(v.conta_nome, '') || ' '
                || coalesce(v.ref_codigo, '') || ' ' || coalesce(v.solicitante_nome, '')) ilike '%' || v_termo || '%'
            or exists (select 1 from public.clientes c where c.id = v.cliente_id and c.nome ilike '%' || v_termo || '%'))
     order by case v.status when 'aberta' then 0 when 'em_andamento' then 1 when 'aguardando' then 2 else 3 end,
              v.prioridade, v.prazo_sla nulls last, v.created_at desc
     limit 300
  )
  select jsonb_build_object(
    'contadores', (select to_jsonb(c) from cont c),
    'itens', coalesce((select jsonb_agg(jsonb_build_object(
        'id', f.id, 'numero', f.numero, 'tipo', f.tipo, 'titulo', f.titulo, 'status', f.status,
        'prioridade', f.prioridade, 'origem_tipo', f.origem_tipo, 'conta_id', f.conta_id, 'conta_nome', f.conta_nome,
        'solicitante_nome', f.solicitante_nome, 'ref_tipo', f.ref_tipo, 'ref_id', f.ref_id, 'ref_codigo', f.ref_codigo,
        'ref_status', f.ref_status,
        'cliente_id', f.cliente_id, 'nome_cliente', (select c.nome from public.clientes c where c.id = f.cliente_id),
        'proposta_id', f.proposta_id, 'simulacao_id', f.simulacao_id,
        'responsavel_id', f.responsavel_id,
        'nome_responsavel', (select coalesce(nullif(btrim(pr.nome), ''), pr.email) from public.profiles pr where pr.id = f.responsavel_id),
        'criador_id', f.criador_id,
        'nome_criador', (select coalesce(nullif(btrim(pr.nome), ''), pr.email) from public.profiles pr where pr.id = f.criador_id),
        'fila_id', f.fila_id, 'nome_fila', (select fl.nome from public.demanda_filas fl where fl.id = f.fila_id),
        'atribuicao_motivo', f.atribuicao_motivo, 'atribuida_em', f.atribuida_em,
        'prazo_sla', f.prazo_sla, 'sla_inicio', f.sla_inicio, 'sla_horas', f.sla_horas,
        'concluida_em', f.concluida_em, 'created_at', f.created_at, 'updated_at', f.updated_at,
        'nao_lidas', (select count(*) from public.demanda_mensagens m
                       where m.demanda_id = f.id and m.autor_id is distinct from s.u and m.excluida_em is null
                         and m.created_at > coalesce((select l.lida_em from public.demanda_leituras l
                                                       where l.demanda_id = f.id and l.user_id = s.u), '-infinity'::timestamptz)),
        'ultima_mensagem_em', (select max(m.created_at) from public.demanda_mensagens m where m.demanda_id = f.id)
      )) from filtrada f), '[]'::jsonb),
    'eu', s.u,
    'pode_gerir', public._demanda_pode_gerir(s.u),
    'minha_carga', public.demanda_carga(s.u),
    'meu_limite', (select limite_carga from public.demanda_pessoas where user_id = s.u),
    'estou_ausente', public._demanda_ausente(s.u)
  ) into r;
  return r;
end $$;

/** Tudo da tela de configuração: tipos, filas (com participantes e carga), pessoas. */
create or replace function public.demanda_config_ler()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s record;
begin
  select * into s from public._demanda_sessao();
  if not public.usuario_tem_permissao(s.u, 'operacional.demandas', 'view') then
    raise exception 'Você não tem permissão para ver demandas.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'pode_gerir', public._demanda_pode_gerir(s.u),
    'eu', s.u,
    'recebe_assinantes', coalesce((select recebe_assinantes from public.demanda_config where correspondente_id = s.corr), false),
    'outro_recebe', exists (select 1 from public.demanda_config where recebe_assinantes and correspondente_id <> s.corr),
    'tipos', coalesce((select jsonb_agg(to_jsonb(t) order by t.ordem, t.nome) from public.demanda_tipos_do_correspondente(s.corr) t), '[]'::jsonb),
    'filas', coalesce((select jsonb_agg(jsonb_build_object(
        'id', f.id, 'nome', f.nome, 'descricao', f.descricao, 'tipos', f.tipos, 'origens', f.origens,
        'ativa', f.ativa, 'ordem', f.ordem,
        'pendentes', (select count(*) from public.demandas d where d.fila_id = f.id and d.responsavel_id is null
                        and d.status = 'aberta' and d.deleted_at is null),
        'membros', coalesce((select jsonb_agg(to_jsonb(c)) from public.demanda_candidatos(f.id) c), '[]'::jsonb),
        'inativos', coalesce((select jsonb_agg(m.user_id) from public.demanda_fila_membros m where m.fila_id = f.id and not m.ativo), '[]'::jsonb)
      ) order by f.ordem, f.nome) from public.demanda_filas f where f.correspondente_id = s.corr), '[]'::jsonb),
    'pessoas', coalesce((select jsonb_agg(jsonb_build_object(
        'user_id', p.id, 'nome', coalesce(nullif(btrim(p.nome), ''), p.email), 'acesso_tipo', p.acesso_tipo,
        'papeis', coalesce((select jsonb_agg(distinct r.role::text) from public.user_roles r where r.user_id = p.id), '[]'::jsonb),
        'carga', public.demanda_carga(p.id), 'limite', dp.limite_carga,
        'ausente', public._demanda_ausente(p.id), 'ausente_desde', dp.ausente_desde, 'ausente_ate', dp.ausente_ate,
        'ausencia_motivo', dp.ausencia_motivo, 'ultima_atribuicao_em', dp.ultima_atribuicao_em
      ) order by coalesce(nullif(btrim(p.nome), ''), p.email))
        from public.profiles p left join public.demanda_pessoas dp on dp.user_id = p.id
       where p.correspondente_id = s.corr and coalesce(p.ativo, true) and p.bloqueado_em is null and p.deleted_at is null), '[]'::jsonb)
  );
end $$;

create or replace function public._demanda_exigir_gerir()
returns table (u uuid, corr uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  s record;
begin
  select * into s from public._demanda_sessao() x;
  if not public._demanda_pode_gerir(s.u) then
    raise exception 'Só quem gere as demandas muda a configuração.' using errcode = '42501';
  end if;
  return query select s.u, s.corr;
end $$;

/** Ajuste de um tipo (nome, prazo, ativo, ordem) ou tipo próprio novo. */
create or replace function public.demanda_tipo_salvar(p_codigo text, p_nome text, p_sla_horas numeric, p_ativo boolean, p_ordem integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  v_cod text := lower(btrim(coalesce(p_codigo, '')));
begin
  select * into s from public._demanda_exigir_gerir();
  if v_cod !~ '^[a-z][a-z0-9_]{1,39}$' then
    raise exception 'Código do tipo inválido (letras minúsculas, números e _).' using errcode = '22023';
  end if;
  if p_sla_horas is null or p_sla_horas <= 0 or p_sla_horas > 720 then
    raise exception 'O prazo vai de 0,5 a 720 horas úteis.' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_nome, ''))) not between 2 and 60 then
    raise exception 'O nome do tipo vai de 2 a 60 letras.' using errcode = '22023';
  end if;
  insert into public.demanda_tipos (correspondente_id, codigo, nome, sla_horas, ativo, ordem, updated_by)
  values (s.corr, v_cod, btrim(p_nome), p_sla_horas, coalesce(p_ativo, true), coalesce(p_ordem, 100), s.u)
  on conflict (correspondente_id, codigo) do update
     set nome = excluded.nome, sla_horas = excluded.sla_horas, ativo = excluded.ativo, ordem = excluded.ordem,
         updated_at = now(), updated_by = excluded.updated_by;
end $$;

/** Cria/edita uma fila e define os participantes (lista completa). Devolve o id. */
create or replace function public.demanda_fila_salvar(p jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  v_id uuid := nullif(p ->> 'id', '')::uuid;
  v_nome text := btrim(coalesce(p ->> 'nome', ''));
  v_tipos text[] := coalesce((select array_agg(distinct x) from jsonb_array_elements_text(coalesce(p -> 'tipos', '[]'::jsonb)) x), '{}');
  v_origens text[] := coalesce((select array_agg(distinct x) from jsonb_array_elements_text(coalesce(p -> 'origens', '[]'::jsonb)) x), '{}');
  v_membros uuid[] := coalesce((select array_agg(distinct x::uuid) from jsonb_array_elements_text(coalesce(p -> 'membros', '[]'::jsonb)) x), '{}');
begin
  select * into s from public._demanda_exigir_gerir();
  if length(v_nome) not between 2 and 60 then
    raise exception 'O nome da fila vai de 2 a 60 letras.' using errcode = '22023';
  end if;
  if not v_origens <@ array['interno', 'assinante', 'vinculado']::text[] then
    raise exception 'Origem inválida.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_tipos) x
              where not exists (select 1 from public.demanda_tipos_do_correspondente(s.corr) t where t.codigo = x)) then
    raise exception 'Há tipo de demanda inválido na fila.' using errcode = '22023';
  end if;
  if cardinality(v_membros) > 200 then
    raise exception 'No máximo 200 participantes por fila.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_membros) x where not public._demanda_pessoa_ativa(x, s.corr)) then
    raise exception 'Há participantes fora do seu ecossistema.' using errcode = '42501';
  end if;
  if v_id is null then
    insert into public.demanda_filas (correspondente_id, nome, descricao, tipos, origens, ativa, ordem, created_by)
    values (s.corr, v_nome, nullif(btrim(coalesce(p ->> 'descricao', '')), ''), v_tipos, v_origens,
            coalesce((p ->> 'ativa')::boolean, true), coalesce(nullif(p ->> 'ordem', '')::integer, 100), s.u)
    returning id into v_id;
  else
    update public.demanda_filas
       set nome = v_nome, descricao = nullif(btrim(coalesce(p ->> 'descricao', '')), ''), tipos = v_tipos,
           origens = v_origens, ativa = coalesce((p ->> 'ativa')::boolean, ativa),
           ordem = coalesce(nullif(p ->> 'ordem', '')::integer, ordem), updated_at = now()
     where id = v_id and correspondente_id = s.corr;
    if not found then
      raise exception 'Fila não encontrada.' using errcode = 'P0002';
    end if;
  end if;
  -- Participantes: quem saiu fica inativo (a demanda dele continua com ele); quem entrou, ativo.
  update public.demanda_fila_membros set ativo = false where fila_id = v_id and not (user_id = any (v_membros)) and ativo;
  insert into public.demanda_fila_membros (fila_id, user_id, ativo)
  select v_id, x, true from unnest(v_membros) x
  on conflict (fila_id, user_id) do update set ativo = true;
  perform public.demanda_distribuir_pendentes(s.corr);
  return v_id;
end $$;

/** Exclui a fila: as demandas dela ficam sem fila (e são redistribuídas pelas outras). */
create or replace function public.demanda_fila_excluir(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
begin
  select * into s from public._demanda_exigir_gerir();
  delete from public.demanda_filas where id = p_id and correspondente_id = s.corr;
  if not found then
    raise exception 'Fila não encontrada.' using errcode = 'P0002';
  end if;
  perform public.demanda_distribuir_pendentes(s.corr);
end $$;

/** Disponibilidade da pessoa: limite de carga e ausência. A própria pessoa marca a ausência dela. */
create or replace function public.demanda_pessoa_salvar(p_user uuid, p_limite integer, p_ausente_desde timestamptz,
                                                        p_ausente_ate timestamptz, p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
  v_gere boolean;
  atual public.demanda_pessoas%rowtype;
begin
  select * into s from public._demanda_sessao();
  v_gere := public._demanda_pode_gerir(s.u);
  if p_user is null or not public._demanda_pessoa_ativa(p_user, s.corr) then
    raise exception 'Pessoa fora do seu ecossistema.' using errcode = '42501';
  end if;
  if p_user <> s.u and not v_gere then
    raise exception 'Só quem gere as demandas muda a disponibilidade dos outros.' using errcode = '42501';
  end if;
  select * into atual from public.demanda_pessoas where user_id = p_user;
  -- O limite de carga é decisão de quem gere (a própria pessoa não aumenta o seu).
  if not v_gere and p_limite is distinct from atual.limite_carga then
    raise exception 'Só quem gere as demandas muda o limite de carga.' using errcode = '42501';
  end if;
  if p_limite is not null and (p_limite < 1 or p_limite > 500) then
    raise exception 'O limite de carga vai de 1 a 500.' using errcode = '22023';
  end if;
  if p_ausente_ate is not null and p_ausente_desde is not null and p_ausente_ate <= p_ausente_desde then
    raise exception 'A volta precisa ser depois do início da ausência.' using errcode = '22023';
  end if;
  if p_ausente_ate is not null and p_ausente_desde is null then
    raise exception 'Informe quando a ausência começa.' using errcode = '22023';
  end if;
  insert into public.demanda_pessoas (user_id, correspondente_id, limite_carga, ausente_desde, ausente_ate,
                                      ausencia_motivo, updated_by)
  values (p_user, s.corr, p_limite, p_ausente_desde, p_ausente_ate, nullif(left(btrim(coalesce(p_motivo, '')), 200), ''), s.u)
  on conflict (user_id) do update
     set limite_carga = excluded.limite_carga, ausente_desde = excluded.ausente_desde,
         ausente_ate = excluded.ausente_ate, ausencia_motivo = excluded.ausencia_motivo,
         updated_at = now(), updated_by = excluded.updated_by;
  perform public.demanda_distribuir_pendentes(s.corr);
end $$;

/** Este correspondente recebe (ou não) as demandas das contas sem analista. */
create or replace function public.demanda_config_salvar(p_recebe_assinantes boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
begin
  select * into s from public._demanda_exigir_gerir();
  if coalesce(p_recebe_assinantes, false)
     and exists (select 1 from public.demanda_config where recebe_assinantes and correspondente_id <> s.corr) then
    raise exception 'Outro correspondente já recebe as demandas dos assinantes.' using errcode = '23505';
  end if;
  insert into public.demanda_config (correspondente_id, recebe_assinantes, updated_by)
  values (s.corr, coalesce(p_recebe_assinantes, false), s.u)
  on conflict (correspondente_id) do update
     set recebe_assinantes = excluded.recebe_assinantes, updated_at = now(), updated_by = excluded.updated_by;
end $$;

/** "Distribuir agora" (quem gere): roda a fila nas demandas sem responsável. */
create or replace function public.demanda_redistribuir_agora()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  s record;
begin
  select * into s from public._demanda_exigir_gerir();
  return public.demanda_distribuir_pendentes(s.corr);
end $$;

-- ---------------------------------------------------------------------------
-- 9. Permissões das funções
-- ---------------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.demanda_tipos_padrao()',
    'public.demanda_tipos_do_correspondente(uuid)',
    'public._demanda_sla(uuid, text, text)',
    'public.demanda_carga(uuid)',
    'public._demanda_ausente(uuid)',
    'public._demanda_pessoa_ativa(uuid, uuid)',
    'public._demanda_pode_gerir(uuid)',
    'public._demanda_analista_da_conta(uuid)',
    'public._demanda_conta(uuid)',
    'public._demanda_fila_para(uuid, text, text)',
    'public.demanda_candidatos(uuid, uuid[])',
    'public._demanda_atribuir(uuid, uuid, text, uuid, text, jsonb, text, text)',
    'public.demanda_distribuir(uuid, uuid[], uuid)',
    'public.demanda_distribuir_pendentes(uuid)',
    'public.demanda_distribuir_pendentes_todos()',
    'public._demanda_sessao()',
    'public.demanda_criar(jsonb)',
    'public._demanda_pode_pegar(uuid, uuid)',
    'public.demanda_assumir(uuid)',
    'public.demanda_pegar_proxima()',
    'public.demanda_reatribuir(uuid, uuid, text)',
    'public.demanda_transicao_permitida(text, text)',
    'public.demanda_mudar_status(uuid, text, text)',
    'public._demanda_correspondente_assinantes(uuid)',
    'public.demanda_de_proposta_assinante(jsonb)',
    'public.demanda_central(jsonb)',
    'public.demanda_config_ler()',
    'public._demanda_exigir_gerir()',
    'public.demanda_tipo_salvar(text, text, numeric, boolean, integer)',
    'public.demanda_fila_salvar(jsonb)',
    'public.demanda_fila_excluir(uuid)',
    'public.demanda_pessoa_salvar(uuid, integer, timestamptz, timestamptz, text)',
    'public.demanda_config_salvar(boolean)',
    'public.demanda_redistribuir_agora()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
  -- Só as ações das telas (cada uma confere sessão, correspondente e permissão).
  foreach f in array array[
    'public.demanda_criar(jsonb)',
    'public.demanda_assumir(uuid)',
    'public.demanda_pegar_proxima()',
    'public.demanda_reatribuir(uuid, uuid, text)',
    'public.demanda_mudar_status(uuid, text, text)',
    'public.demanda_transicao_permitida(text, text)',
    'public.demanda_central(jsonb)',
    'public.demanda_config_ler()',
    'public.demanda_tipo_salvar(text, text, numeric, boolean, integer)',
    'public.demanda_fila_salvar(jsonb)',
    'public.demanda_fila_excluir(uuid)',
    'public.demanda_pessoa_salvar(uuid, integer, timestamptz, timestamptz, text)',
    'public.demanda_config_salvar(boolean)',
    'public.demanda_redistribuir_agora()'
  ] loop
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 10. A fila anda sozinha: quem voltou de férias ou liberou carga recebe as pendentes.
-- ---------------------------------------------------------------------------
select cron.unschedule('demandas-distribuir-pendentes')
 where exists (select 1 from cron.job where jobname = 'demandas-distribuir-pendentes');
select cron.schedule('demandas-distribuir-pendentes', '*/5 * * * *',
                     $$ select public.demanda_distribuir_pendentes_todos(); $$);
