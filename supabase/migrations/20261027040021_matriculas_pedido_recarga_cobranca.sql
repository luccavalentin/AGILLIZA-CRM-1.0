-- Controle de matrículas ligado a quem pede (pedido do dono, 26/10/2026 — C40).
--
-- "GERALMENTE UM COMERCIAL (CORRETOR, PARCEIROS E ETC) PEDE AO ANALISTA PRA PUXAR A
-- MATRÍCULA > ALGUÉM RECARREGA, O ANALISTA PUXA A MATRÍCULA E QUEM PEDIU PRA TIRAR DEVE
-- PAGAR A AGILLIZA DEPOIS."
--
-- Fluxo em `matricula_solicitacoes` (a tabela de sempre, agora com situação):
--   pedida → em_andamento (o analista assume) → [aguardando_recarga] → concluida (o analista
--   anexa a matrícula e lança o custo) → paga (quem pediu pagou a Agilliza). Ou cancelada.
--
-- Quem pede (`solicitante_tipo`):
--   · usuario   — pessoa do Agilliza (equipe, parceiro, corretor vinculado): `solicitante_user_id`;
--   · assinante — conta do Agilliza Tech, pelo portal dela (migração 0322 do Agilliza Tech):
--                 `solicitante_conta_id` + `origem_ref` (o pedido de lá, sem duplicar);
--   · externo   — só o nome (os registros antigos, digitados à mão).
--
-- Recarga: `matricula_creditos` ganha o serviço/cartório, quem recarregou e o comprovante.
-- Saldo = recargas − custo das matrículas concluídas. Concluir sem saldo é recusado, com trava
-- por correspondente (dois analistas ao mesmo tempo não gastam o mesmo saldo).
--
-- Valor a receber: a visão `matriculas_a_receber` (por solicitante) é o que o financeiro
-- lê (frente a5). Ela respeita a RLS de quem consulta (security_invoker).
--
-- As funções de mudança de situação são SECURITY INVOKER: valem a RLS e a permissão
-- `documentos.matriculas` da própria pessoa (conferida também dentro de cada uma).

-- -----------------------------------------------------------------------------
-- 1. Colunas novas
-- -----------------------------------------------------------------------------
alter table public.matricula_solicitacoes
  -- Registros antigos já eram matrícula tirada: nascem "concluida"; os novos, "pedida".
  add column if not exists status text not null default 'concluida',
  add column if not exists solicitante_tipo text not null default 'externo',
  add column if not exists solicitante_user_id uuid references public.profiles (id) on delete set null,
  add column if not exists solicitante_conta_id uuid,
  add column if not exists solicitante_conta_nome text,
  add column if not exists origem_ref uuid,
  add column if not exists cartorio text,
  add column if not exists cidade_uf text,
  add column if not exists imovel text,
  add column if not exists analista_id uuid references public.profiles (id) on delete set null,
  add column if not exists assumida_em timestamptz,
  add column if not exists concluida_em timestamptz,
  add column if not exists arquivo_path text,
  add column if not exists arquivo_nome text,
  add column if not exists cancelada_motivo text,
  add column if not exists pago_registrado_por uuid;

alter table public.matricula_solicitacoes alter column status set default 'pedida';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'matricula_solicitacoes_status_chk') then
    alter table public.matricula_solicitacoes
      add constraint matricula_solicitacoes_status_chk
        check (status in ('pedida', 'em_andamento', 'aguardando_recarga', 'concluida', 'cancelada')),
      add constraint matricula_solicitacoes_solicitante_tipo_chk
        check (solicitante_tipo in ('usuario', 'assinante', 'externo')),
      add constraint matricula_solicitacoes_valor_chk check (valor >= 0 and valor <= 100000),
      add constraint matricula_solicitacoes_textos_chk check (
        coalesce(length(cartorio), 0) <= 160 and coalesce(length(cidade_uf), 0) <= 80
        and coalesce(length(imovel), 0) <= 300 and coalesce(length(cancelada_motivo), 0) <= 300
        and coalesce(length(arquivo_nome), 0) <= 200 and coalesce(length(solicitante_conta_nome), 0) <= 200),
      add constraint matricula_solicitacoes_pago_chk check (not reembolsado or status = 'concluida');
  end if;
end $$;

-- O mesmo pedido do portal do assinante entra uma vez só.
create unique index if not exists matricula_solicitacoes_origem_uniq
  on public.matricula_solicitacoes (origem_ref) where origem_ref is not null;

-- A mesma matrícula do mesmo cartório não fica pedida duas vezes pelo mesmo solicitante.
create unique index if not exists matricula_solicitacoes_aberta_uniq
  on public.matricula_solicitacoes (
    correspondente_id,
    coalesce(solicitante_conta_id, solicitante_user_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(btrim(cartorio)),
    regexp_replace(lower(numero_matricula), '[^0-9a-z]', '', 'g'))
  where status in ('pedida', 'em_andamento', 'aguardando_recarga')
    and cartorio is not null and numero_matricula is not null;

create index if not exists matricula_solicitacoes_status_idx
  on public.matricula_solicitacoes (correspondente_id, status);
create index if not exists matricula_solicitacoes_conta_idx
  on public.matricula_solicitacoes (solicitante_conta_id) where solicitante_conta_id is not null;
create index if not exists matricula_solicitacoes_usuario_idx
  on public.matricula_solicitacoes (solicitante_user_id) where solicitante_user_id is not null;

alter table public.matricula_creditos
  add column if not exists servico text check (servico is null or length(servico) <= 120),
  add column if not exists recarregado_por uuid references public.profiles (id) on delete set null,
  add column if not exists comprovante_path text,
  add column if not exists comprovante_nome text check (comprovante_nome is null or length(comprovante_nome) <= 200);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'matricula_creditos_valor_chk') then
    alter table public.matricula_creditos
      add constraint matricula_creditos_valor_chk check (valor > 0 and valor <= 1000000) not valid;
  end if;
end $$;

alter table public.matricula_config
  -- Correspondente que recebe os pedidos das contas do Agilliza Tech sem analista na carteira.
  add column if not exists recebe_assinantes boolean not null default false,
  -- Quantos pedidos em aberto uma conta assinante pode ter ao mesmo tempo.
  add column if not exists limite_pedidos_assinante integer not null default 10
    check (limite_pedidos_assinante between 1 and 200),
  -- Valor de referência sugerido ao concluir (o custo real é o que o analista lança).
  add column if not exists valor_referencia numeric(12, 2) check (valor_referencia is null or valor_referencia >= 0);

-- -----------------------------------------------------------------------------
-- 2. Guardas (valem para a tela, para a API e para o Agilliza Tech)
-- -----------------------------------------------------------------------------
create or replace function public.matricula_solicitacao_guarda()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if new.correspondente_id is distinct from old.correspondente_id
       or new.solicitante_tipo is distinct from old.solicitante_tipo
       or new.solicitante_conta_id is distinct from old.solicitante_conta_id
       or new.origem_ref is distinct from old.origem_ref then
      raise exception 'A origem do pedido de matrícula não pode ser trocada.' using errcode = '22023';
    end if;
    if old.reembolsado and new.reembolsado and new.valor is distinct from old.valor then
      raise exception 'Matrícula já paga: o valor não muda. Desfaça o pagamento antes.' using errcode = '22023';
    end if;
    if old.status = 'cancelada' and new.status <> 'cancelada' then
      raise exception 'Pedido cancelado não volta. Faça um pedido novo.' using errcode = '22023';
    end if;
  end if;
  if new.reembolsado and new.status <> 'concluida' then
    raise exception 'Só matrícula concluída pode ser marcada como paga.' using errcode = '22023';
  end if;
  if new.status = 'concluida' and new.concluida_em is null then
    new.concluida_em := now();
  end if;
  if new.solicitante_tipo = 'assinante' and new.solicitante_conta_id is null then
    raise exception 'Pedido de assinante sem a conta.' using errcode = '22023';
  end if;
  return new;
end $$;

drop trigger if exists trg_matricula_solicitacao_guarda on public.matricula_solicitacoes;
create trigger trg_matricula_solicitacao_guarda
  before insert or update on public.matricula_solicitacoes
  for each row execute function public.matricula_solicitacao_guarda();

-- -----------------------------------------------------------------------------
-- 3. RLS por permissão (as políticas antigas só olhavam "é interno")
-- -----------------------------------------------------------------------------
revoke all on public.matricula_solicitacoes, public.matricula_creditos, public.matricula_config from anon;
grant select, insert, update, delete on public.matricula_solicitacoes, public.matricula_creditos,
  public.matricula_config to authenticated;
-- TRUNCATE passa por cima da RLS: ninguém da API precisa dele.
revoke truncate, references, trigger on public.matricula_solicitacoes, public.matricula_creditos,
  public.matricula_config from authenticated;

drop policy if exists "Interno ve solicitacoes matricula" on public.matricula_solicitacoes;
drop policy if exists "Interno cria solicitacoes matricula" on public.matricula_solicitacoes;
drop policy if exists "Interno edita solicitacoes matricula" on public.matricula_solicitacoes;
drop policy if exists "Interno exclui solicitacoes matricula" on public.matricula_solicitacoes;
drop policy if exists "Interno ve creditos matricula" on public.matricula_creditos;
drop policy if exists "Interno cria creditos matricula" on public.matricula_creditos;
drop policy if exists "Interno edita creditos matricula" on public.matricula_creditos;
drop policy if exists "Interno exclui creditos matricula" on public.matricula_creditos;
drop policy if exists "Interno ve config matricula" on public.matricula_config;
drop policy if exists "Interno cria config matricula" on public.matricula_config;
drop policy if exists "Interno edita config matricula" on public.matricula_config;

create or replace function public.matricula_pode(_acao text, _correspondente uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select public.is_interno((select auth.uid()))
     and _correspondente = public.correspondente_do_usuario((select auth.uid()))
     and public.usuario_tem_permissao((select auth.uid()), 'documentos.matriculas', _acao)
$$;
revoke all on function public.matricula_pode(text, uuid) from public, anon;
grant execute on function public.matricula_pode(text, uuid) to authenticated, service_role;

drop policy if exists "matriculas ver" on public.matricula_solicitacoes;
create policy "matriculas ver" on public.matricula_solicitacoes for select to authenticated
  using (public.matricula_pode('view', correspondente_id)
         -- Quem pediu (parceiro, corretor) acompanha o próprio pedido.
         or solicitante_user_id = (select auth.uid()));
drop policy if exists "matriculas criar" on public.matricula_solicitacoes;
create policy "matriculas criar" on public.matricula_solicitacoes for insert to authenticated
  with check (public.matricula_pode('create', correspondente_id) and solicitante_tipo <> 'assinante');
drop policy if exists "matriculas editar" on public.matricula_solicitacoes;
create policy "matriculas editar" on public.matricula_solicitacoes for update to authenticated
  using (public.matricula_pode('edit', correspondente_id))
  with check (public.matricula_pode('edit', correspondente_id));
drop policy if exists "matriculas excluir" on public.matricula_solicitacoes;
create policy "matriculas excluir" on public.matricula_solicitacoes for delete to authenticated
  -- Pedido de assinante não some: cancela (a conta acompanha pelo portal).
  using (public.matricula_pode('edit', correspondente_id) and solicitante_tipo <> 'assinante');

drop policy if exists "matricula creditos ver" on public.matricula_creditos;
create policy "matricula creditos ver" on public.matricula_creditos for select to authenticated
  using (public.matricula_pode('view', correspondente_id));
drop policy if exists "matricula creditos gravar" on public.matricula_creditos;
create policy "matricula creditos gravar" on public.matricula_creditos for all to authenticated
  using (public.matricula_pode('edit', correspondente_id))
  with check (public.matricula_pode('edit', correspondente_id));

drop policy if exists "matricula config ver" on public.matricula_config;
create policy "matricula config ver" on public.matricula_config for select to authenticated
  using (public.matricula_pode('view', correspondente_id));
drop policy if exists "matricula config gravar" on public.matricula_config;
create policy "matricula config gravar" on public.matricula_config for all to authenticated
  using (public.matricula_pode('edit', correspondente_id))
  with check (public.matricula_pode('edit', correspondente_id));

-- -----------------------------------------------------------------------------
-- 4. Mudanças de situação (SECURITY INVOKER: RLS + permissão da pessoa)
-- -----------------------------------------------------------------------------

/** Saldo de crédito do correspondente: recargas − custo das matrículas concluídas. */
create or replace function public.matricula_saldo(_correspondente uuid)
returns numeric
language sql
stable
set search_path = public
as $$
  select coalesce((select sum(valor) from public.matricula_creditos where correspondente_id = _correspondente), 0)
       - coalesce((select sum(valor) from public.matricula_solicitacoes
                    where correspondente_id = _correspondente and status = 'concluida'), 0)
$$;

/** Pedido feito por alguém do Agilliza (para si ou para um parceiro/corretor da casa). */
create or replace function public.matricula_pedir(
  p_solicitante_user uuid, p_solicitante_nome text, p_cartorio text, p_cidade_uf text,
  p_numero text, p_imovel text, p_cliente text, p_observacao text)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_corr uuid := public.correspondente_do_usuario((select auth.uid()));
  v_nome text;
  v_id uuid;
begin
  if v_corr is null or not public.matricula_pode('create', v_corr) then
    raise exception 'Você não tem permissão para pedir matrícula.' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_cartorio, ''))) < 2 then
    raise exception 'Informe o cartório.' using errcode = '22023';
  end if;
  if p_solicitante_user is not null then
    select nome into v_nome from public.profiles
     where id = p_solicitante_user and correspondente_id = v_corr;
    if not found then
      raise exception 'Solicitante não encontrado entre os usuários do correspondente.' using errcode = '22023';
    end if;
  else
    v_nome := nullif(btrim(p_solicitante_nome), '');
    if v_nome is null then raise exception 'Diga quem pediu a matrícula.' using errcode = '22023'; end if;
  end if;
  insert into public.matricula_solicitacoes (
    correspondente_id, data_solicitacao, solicitante, solicitante_tipo, solicitante_user_id,
    cartorio, cidade_uf, numero_matricula, imovel, cliente, observacao, valor, status, criado_por)
  values (v_corr, current_date, left(coalesce(v_nome, 'Solicitante'), 200),
          case when p_solicitante_user is null then 'externo' else 'usuario' end, p_solicitante_user,
          left(btrim(p_cartorio), 160), left(nullif(btrim(p_cidade_uf), ''), 80),
          left(nullif(btrim(p_numero), ''), 100), left(nullif(btrim(p_imovel), ''), 300),
          left(nullif(btrim(p_cliente), ''), 200), left(nullif(btrim(p_observacao), ''), 500),
          0, 'pedida', (select auth.uid()))
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'Já existe um pedido em aberto desta matrícula para este solicitante.' using errcode = 'P0001';
end $$;

/** O analista assume o pedido (só um: quem assumiu antes ganha). */
create or replace function public.matricula_assumir(p_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  r public.matricula_solicitacoes%rowtype;
  eu uuid := (select auth.uid());
begin
  select * into r from public.matricula_solicitacoes where id = p_id for update;
  if not found or not public.matricula_pode('edit', r.correspondente_id) then
    raise exception 'Pedido de matrícula não encontrado.' using errcode = 'P0002';
  end if;
  if r.status not in ('pedida', 'aguardando_recarga', 'em_andamento') then
    raise exception 'Este pedido já foi encerrado.' using errcode = '22023';
  end if;
  if r.analista_id is not null and r.analista_id <> eu then
    raise exception 'Outro analista já assumiu este pedido.' using errcode = 'P0001';
  end if;
  update public.matricula_solicitacoes
     set analista_id = eu, assumida_em = coalesce(assumida_em, now()),
         status = case when status = 'pedida' then 'em_andamento' else status end
   where id = p_id;
end $$;

/** Sem saldo para puxar: o pedido espera a recarga. */
create or replace function public.matricula_aguardar_recarga(p_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare r public.matricula_solicitacoes%rowtype;
begin
  select * into r from public.matricula_solicitacoes where id = p_id for update;
  if not found or not public.matricula_pode('edit', r.correspondente_id) then
    raise exception 'Pedido de matrícula não encontrado.' using errcode = 'P0002';
  end if;
  if r.status not in ('pedida', 'em_andamento') then
    raise exception 'Só pedido em aberto pode esperar a recarga.' using errcode = '22023';
  end if;
  update public.matricula_solicitacoes set status = 'aguardando_recarga' where id = p_id;
end $$;

/**
 * O analista puxou a matrícula: lança o custo (valor a receber de quem pediu), o número e o
 * arquivo. Recusa sem saldo. Trava por correspondente: dois analistas concluindo ao mesmo
 * tempo não gastam o mesmo saldo.
 */
create or replace function public.matricula_concluir(
  p_id uuid, p_valor numeric, p_numero text, p_arquivo_path text, p_arquivo_nome text)
returns void
language plpgsql
set search_path = public
as $$
declare
  r public.matricula_solicitacoes%rowtype;
  v_saldo numeric;
begin
  select * into r from public.matricula_solicitacoes where id = p_id;
  if not found or not public.matricula_pode('edit', r.correspondente_id) then
    raise exception 'Pedido de matrícula não encontrado.' using errcode = 'P0002';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('matriculas:' || r.correspondente_id::text, 0));
  select * into r from public.matricula_solicitacoes where id = p_id for update;
  if r.status not in ('pedida', 'em_andamento', 'aguardando_recarga') then
    raise exception 'Este pedido já foi encerrado.' using errcode = '22023';
  end if;
  if r.analista_id is not null and r.analista_id <> (select auth.uid()) then
    raise exception 'Outro analista assumiu este pedido.' using errcode = 'P0001';
  end if;
  if p_valor is null or p_valor <= 0 or p_valor > 100000 then
    raise exception 'Informe o custo da matrícula (maior que zero).' using errcode = '22023';
  end if;
  if coalesce(nullif(btrim(p_numero), ''), r.numero_matricula) is null then
    raise exception 'Informe o número da matrícula.' using errcode = '22023';
  end if;
  if p_arquivo_path is not null and p_arquivo_path not like r.correspondente_id::text || '/%' then
    raise exception 'Arquivo inválido.' using errcode = '22023';
  end if;
  v_saldo := public.matricula_saldo(r.correspondente_id);
  if v_saldo < p_valor then
    raise exception 'Saldo de crédito insuficiente (saldo: R$ %). Registre a recarga antes de concluir.',
      replace(to_char(v_saldo, 'FM999999990.00'), '.', ',') using errcode = 'P0001';
  end if;
  update public.matricula_solicitacoes
     set status = 'concluida', valor = round(p_valor, 2),
         numero_matricula = coalesce(left(nullif(btrim(p_numero), ''), 100), numero_matricula),
         arquivo_path = coalesce(p_arquivo_path, arquivo_path),
         arquivo_nome = coalesce(left(p_arquivo_nome, 200), arquivo_nome),
         analista_id = coalesce(analista_id, (select auth.uid())),
         assumida_em = coalesce(assumida_em, now()),
         concluida_em = now()
   where id = p_id;
end $$;

/** Quem pediu pagou a Agilliza (uma vez só). */
create or replace function public.matricula_marcar_paga(p_id uuid, p_data date)
returns void
language plpgsql
set search_path = public
as $$
declare r public.matricula_solicitacoes%rowtype;
begin
  select * into r from public.matricula_solicitacoes where id = p_id for update;
  if not found or not public.matricula_pode('edit', r.correspondente_id) then
    raise exception 'Pedido de matrícula não encontrado.' using errcode = 'P0002';
  end if;
  if r.status <> 'concluida' then
    raise exception 'Só matrícula concluída pode ser marcada como paga.' using errcode = '22023';
  end if;
  if r.reembolsado then
    raise exception 'Esta matrícula já está marcada como paga.' using errcode = 'P0001';
  end if;
  if p_data is not null and p_data > current_date then
    raise exception 'A data do pagamento não pode ser futura.' using errcode = '22023';
  end if;
  update public.matricula_solicitacoes
     set reembolsado = true, reembolsado_em = now(), data_pagto_reembolso = coalesce(p_data, current_date),
         pago_registrado_por = (select auth.uid())
   where id = p_id;
end $$;

create or replace function public.matricula_desfazer_pagamento(p_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare r public.matricula_solicitacoes%rowtype;
begin
  select * into r from public.matricula_solicitacoes where id = p_id for update;
  if not found or not public.matricula_pode('edit', r.correspondente_id) then
    raise exception 'Pedido de matrícula não encontrado.' using errcode = 'P0002';
  end if;
  if not r.reembolsado then
    raise exception 'Esta matrícula não está marcada como paga.' using errcode = 'P0001';
  end if;
  update public.matricula_solicitacoes
     set reembolsado = false, reembolsado_em = null, data_pagto_reembolso = null, pago_registrado_por = null
   where id = p_id;
end $$;

create or replace function public.matricula_cancelar(p_id uuid, p_motivo text)
returns void
language plpgsql
set search_path = public
as $$
declare r public.matricula_solicitacoes%rowtype;
begin
  select * into r from public.matricula_solicitacoes where id = p_id for update;
  if not found or not public.matricula_pode('edit', r.correspondente_id) then
    raise exception 'Pedido de matrícula não encontrado.' using errcode = 'P0002';
  end if;
  if r.status in ('concluida', 'cancelada') then
    raise exception 'Matrícula concluída ou já cancelada não pode ser cancelada.' using errcode = '22023';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Diga o motivo do cancelamento.' using errcode = '22023';
  end if;
  update public.matricula_solicitacoes
     set status = 'cancelada', cancelada_motivo = left(btrim(p_motivo), 300)
   where id = p_id;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.matricula_saldo(uuid)',
    'public.matricula_pedir(uuid, text, text, text, text, text, text, text)',
    'public.matricula_assumir(uuid)',
    'public.matricula_aguardar_recarga(uuid)',
    'public.matricula_concluir(uuid, numeric, text, text, text)',
    'public.matricula_marcar_paga(uuid, date)',
    'public.matricula_desfazer_pagamento(uuid)',
    'public.matricula_cancelar(uuid, text)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 5. Valor a receber por solicitante (para o financeiro — frente a5)
-- -----------------------------------------------------------------------------
create or replace view public.matriculas_a_receber
with (security_invoker = true) as
select s.correspondente_id,
       s.solicitante_tipo,
       -- Registro antigo (externo): quem pediu está em `corretor` ("Solicitante" na tela antiga);
       -- `solicitante` era quem registrou.
       coalesce(s.solicitante_conta_id::text, s.solicitante_user_id::text,
                'nome:' || lower(btrim(coalesce(nullif(btrim(s.corretor), ''), s.solicitante)))) as solicitante_chave,
       s.solicitante_user_id,
       s.solicitante_conta_id,
       max(case s.solicitante_tipo when 'assinante' then s.solicitante_conta_nome
                                   when 'usuario' then s.solicitante
                                   else coalesce(nullif(btrim(s.corretor), ''), s.solicitante) end) as solicitante_nome,
       count(*)::int as matriculas,
       count(*) filter (where not s.reembolsado)::int as matriculas_em_aberto,
       sum(s.valor) as valor_total,
       coalesce(sum(s.valor) filter (where s.reembolsado), 0) as valor_pago,
       coalesce(sum(s.valor) filter (where not s.reembolsado), 0) as valor_em_aberto,
       min(coalesce(s.concluida_em::date, s.data_solicitacao)) filter (where not s.reembolsado) as em_aberto_desde,
       max(s.data_pagto_reembolso) as ultimo_pagamento
  from public.matricula_solicitacoes s
 where s.status = 'concluida'
 group by s.correspondente_id, s.solicitante_tipo,
          coalesce(s.solicitante_conta_id::text, s.solicitante_user_id::text,
                   'nome:' || lower(btrim(coalesce(nullif(btrim(s.corretor), ''), s.solicitante)))),
          s.solicitante_user_id, s.solicitante_conta_id;

comment on view public.matriculas_a_receber is
  'Matrículas concluídas por quem pediu: total, pago e em aberto (valor a receber pela Agilliza). Respeita a RLS de quem consulta.';
revoke all on public.matriculas_a_receber from anon, public;
grant select on public.matriculas_a_receber to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 6. Arquivos (matrícula puxada e comprovante de recarga): bucket privado, só pelo servidor
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('matriculas', 'matriculas', false, 20971520,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
