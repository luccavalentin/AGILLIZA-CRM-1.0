-- =============================================================================
-- Financeiro da matriz (frente a5, pedido do dono de 26/10/2026) — 1/3: base.
-- Diagnóstico e desenho: docs/financeiro-matriz-diagnostico.md.
--
--   · fin_pode(modulo, acao): a matriz de permissões conferida NO BANCO (perfil interno
--     ativo do mesmo correspondente + usuario_tem_permissao);
--   · parâmetros, contas bancárias, fornecedores, anexos e auditoria (só inclusão);
--   · fin_baixas: o livro de TODO recebimento e pagamento efetivo (parcial, estorno com
--     motivo, comprovante). Nada vira "recebido"/"pago" sem uma linha aqui;
--   · colunas novas nas tabelas reaproveitadas (comissoes = comissões dos bancos,
--     comissoes_usuario = corretores e parceiros, financial_payables/receivables);
--   · guarda no banco: pagamento, situação, natureza e rascunho das contas só mudam
--     pelas funções do módulo; conta com pagamento não se apaga;
--   · migração dos dados legados sem perder nem duplicar (ver §2.3 do diagnóstico);
--   · matriz de permissões nova e bucket de comprovantes separado por módulo.
-- Nada aqui chama provedor, webhook ou rede (C45j).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Quem pode o quê (servidor E banco)
-- -----------------------------------------------------------------------------
create or replace function public.fin_corr()
returns uuid language sql stable security definer set search_path = public as $$
  select p.correspondente_id from public.profiles p
   where p.id = (select auth.uid()) and p.ativo and p.deleted_at is null and p.bloqueado_em is null
     and p.acesso_tipo = 'sistema'
$$;

/** A pessoa logada pode a ação no módulo financeiro? (perfil interno, ativo, com correspondente). */
create or replace function public.fin_pode(_modulo text, _acao text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select public.usuario_tem_permissao(p.id, _modulo, _acao)
      from public.profiles p
     where p.id = (select auth.uid()) and p.ativo and p.deleted_at is null and p.bloqueado_em is null
       and p.acesso_tipo = 'sistema' and p.correspondente_id is not null), false)
$$;

/** Igual a fin_pode, mas recusa com mensagem; devolve o correspondente da pessoa. */
create or replace function public.fin_exigir(_modulo text, _acao text)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v uuid;
begin
  if not public.fin_pode(_modulo, _acao) then
    raise exception 'Você não tem permissão para esta ação no financeiro (%: %).',
      replace(_modulo, 'financeiro.', ''), _acao using errcode = '42501';
  end if;
  v := public.fin_corr();
  if v is null then
    raise exception 'Sua conta não está vinculada a um correspondente.' using errcode = '42501';
  end if;
  return v;
end $$;

/** Módulo da matriz responsável por cada natureza de lançamento. */
create or replace function public.fin_modulo_natureza(_natureza text)
returns text language sql immutable set search_path = public as $$
  select case _natureza
    when 'comissao_banco' then 'financeiro.comissoes_bancos'
    when 'repasse_assinante' then 'financeiro.repasses'
    when 'comissao_participante' then 'financeiro.comissoes'
    when 'conta_pagar' then 'financeiro.contas_pagar'
    when 'conta_receber' then 'financeiro.contas_receber'
  end
$$;

/** Pasta do bucket de comprovantes → módulo (`<correspondente>/<pasta>/<arquivo>`). */
create or replace function public.fin_modulo_da_pasta(_pasta text)
returns text language sql immutable set search_path = public as $$
  select case _pasta
    when 'comissoes-bancos' then 'financeiro.comissoes_bancos'
    when 'repasses' then 'financeiro.repasses'
    when 'comissoes' then 'financeiro.comissoes'
    when 'contas-pagar' then 'financeiro.contas_pagar'
    when 'contas-receber' then 'financeiro.contas_receber'
    when 'conciliacao' then 'financeiro.conciliacao'
  end
$$;

/** Contexto da operação: ação e motivo vão para a auditoria; "interno" libera a guarda das contas. */
create or replace function public.fin_ctx(_acao text, _motivo text default null)
returns void language plpgsql volatile set search_path = public as $$
begin
  perform set_config('fin.acao', coalesce(_acao, ''), true);
  perform set_config('fin.motivo', coalesce(_motivo, ''), true);
  perform set_config('fin.interno', 'on', true);
end $$;

create or replace function public.fin_ctx_fim()
returns void language plpgsql volatile set search_path = public as $$
begin
  perform set_config('fin.acao', '', true);
  perform set_config('fin.motivo', '', true);
  perform set_config('fin.interno', 'off', true);
end $$;

-- -----------------------------------------------------------------------------
-- 2. Parâmetros (nada fixo no código), contas bancárias, fornecedores
-- -----------------------------------------------------------------------------
create table if not exists public.fin_parametros (
  correspondente_id            uuid primary key,
  gatilho_comissao_banco       text not null default 'contrato_emitido'
                               check (gatilho_comissao_banco in ('contrato_emitido', 'registrado')),
  dias_previsao_recebimento    integer not null default 30 check (dias_previsao_recebimento between 0 and 365),
  dias_vencimento_comissao     integer not null default 30 check (dias_vencimento_comissao between 0 and 365),
  tolerancia_divergencia       numeric(14, 2) not null default 0.01 check (tolerancia_divergencia between 0 and 1000),
  dias_janela_conciliacao      integer not null default 3 check (dias_janela_conciliacao between 0 and 30),
  atualizado_por               uuid,
  atualizado_em                timestamptz not null default now()
);

create or replace function public.fin_param(_corr uuid)
returns public.fin_parametros language sql stable security definer set search_path = public as $$
  select coalesce(
    (select p from public.fin_parametros p where p.correspondente_id = _corr),
    row(_corr, 'contrato_emitido', 30, 30, 0.01, 3, null, now())::public.fin_parametros)
$$;

create table if not exists public.fin_contas_bancarias (
  id                 uuid primary key default gen_random_uuid(),
  correspondente_id  uuid not null,
  apelido            text not null check (length(btrim(apelido)) between 2 and 80),
  banco_codigo       text check (banco_codigo is null or banco_codigo ~ '^\d{3}$'),
  banco_nome         text,
  agencia            text check (agencia is null or length(agencia) <= 10),
  conta              text check (conta is null or length(conta) <= 20),
  ativo              boolean not null default true,
  criado_por         uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create unique index if not exists fin_contas_bancarias_unica
  on public.fin_contas_bancarias (correspondente_id, coalesce(banco_codigo, ''), coalesce(agencia, ''), coalesce(conta, ''))
  where ativo;

create table if not exists public.fin_fornecedores (
  id                 uuid primary key default gen_random_uuid(),
  correspondente_id  uuid not null,
  nome               text not null check (length(btrim(nome)) between 2 and 160),
  documento          text check (documento is null or documento ~ '^(\d{11}|\d{14})$'),
  email              text check (email is null or length(email) <= 160),
  telefone           text check (telefone is null or length(telefone) <= 30),
  categoria_id       uuid references public.financial_categories (id) on delete set null,
  observacao         text check (observacao is null or length(observacao) <= 500),
  ativo              boolean not null default true,
  criado_por         uuid,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create unique index if not exists fin_fornecedores_documento
  on public.fin_fornecedores (correspondente_id, documento) where documento is not null;

-- -----------------------------------------------------------------------------
-- 3. Anexos e auditoria
-- -----------------------------------------------------------------------------
create table if not exists public.fin_anexos (
  id                 uuid primary key default gen_random_uuid(),
  correspondente_id  uuid not null,
  modulo             text not null,
  entidade           text not null,
  entidade_id        uuid,
  caminho            text not null unique,
  nome               text not null check (length(nome) <= 200),
  tipo               text check (tipo is null or length(tipo) <= 120),
  tamanho            bigint check (tamanho is null or tamanho between 0 and 26214400),
  enviado_por        uuid,
  enviado_em         timestamptz not null default now(),
  removido_em        timestamptz,
  removido_por       uuid,
  removido_motivo    text
);
create index if not exists fin_anexos_entidade on public.fin_anexos (entidade, entidade_id);

create table if not exists public.fin_auditoria (
  id                 bigint generated always as identity primary key,
  correspondente_id  uuid,
  entidade           text not null,
  entidade_id        uuid,
  acao               text not null,
  ator_id            uuid,
  antes              jsonb,
  depois             jsonb,
  motivo             text,
  criado_em          timestamptz not null default now()
);
create index if not exists fin_auditoria_entidade on public.fin_auditoria (entidade, entidade_id, criado_em desc);
create index if not exists fin_auditoria_corr on public.fin_auditoria (correspondente_id, criado_em desc);

/** Gatilho de auditoria: antes/depois (só o que mudou), quem, ação e motivo do contexto. */
create or replace function public.fin_tg_auditar()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_old jsonb;
  v_new jsonb;
  a jsonb;
  d jsonb;
  v_corr uuid;
  v_ator uuid;
begin
  if tg_op <> 'INSERT' then v_old := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_new := to_jsonb(new); end if;
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(k, v_old -> k), jsonb_object_agg(k, v_new -> k)
      into a, d
      from jsonb_object_keys(v_new) k
     where k not in ('updated_at') and (v_new -> k) is distinct from (v_old -> k);
    if d is null then return new; end if;
  else
    a := v_old;
    d := v_new;
  end if;
  v_corr := coalesce((coalesce(v_new, v_old) ->> 'correspondente_id')::uuid, null);
  v_ator := coalesce((select auth.uid()), nullif(current_setting('fin.ator', true), '')::uuid);
  insert into public.fin_auditoria (correspondente_id, entidade, entidade_id, acao, ator_id, antes, depois, motivo)
  values (v_corr, tg_table_name, (coalesce(v_new, v_old) ->> 'id')::uuid,
          coalesce(nullif(current_setting('fin.acao', true), ''), lower(tg_op)),
          v_ator, a, d, nullif(current_setting('fin.motivo', true), ''));
  return coalesce(new, old);
end $$;

-- -----------------------------------------------------------------------------
-- 4. Livro de baixas (todo recebimento e pagamento efetivo)
-- -----------------------------------------------------------------------------
create table if not exists public.fin_baixas (
  id                 uuid primary key default gen_random_uuid(),
  correspondente_id  uuid not null,
  natureza           text not null check (natureza in ('comissao_banco', 'repasse_assinante', 'comissao_participante',
                                                       'conta_pagar', 'conta_receber')),
  sentido            text not null check (sentido in ('entrada', 'saida')),
  alvo_id            uuid not null,
  valor              numeric(14, 2) not null check (valor > 0 and valor < 1000000000),
  data               date not null,
  conta_bancaria_id  uuid references public.fin_contas_bancarias (id) on delete set null,
  forma              text check (forma is null or length(forma) <= 60),
  documento          text check (documento is null or length(documento) <= 120),
  observacao         text check (observacao is null or length(observacao) <= 500),
  anexo_id           uuid references public.fin_anexos (id) on delete set null,
  origem             text not null default 'manual' check (origem in ('manual', 'conciliacao', 'migracao')),
  registrado_por     uuid,
  registrado_em      timestamptz not null default now(),
  estornada_em       timestamptz,
  estornada_por      uuid,
  estorno_motivo     text,
  check ((natureza in ('comissao_banco', 'conta_receber') and sentido = 'entrada')
      or (natureza in ('repasse_assinante', 'comissao_participante', 'conta_pagar') and sentido = 'saida')),
  check (estornada_em is null or length(btrim(coalesce(estorno_motivo, ''))) >= 3)
);
create index if not exists fin_baixas_alvo on public.fin_baixas (natureza, alvo_id) where estornada_em is null;
create index if not exists fin_baixas_data on public.fin_baixas (correspondente_id, data);

/** Soma das baixas ativas de um lançamento. */
create or replace function public.fin_total_baixado(_natureza text, _alvo uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(valor), 0)::numeric(14, 2) from public.fin_baixas
   where natureza = _natureza and alvo_id = _alvo and estornada_em is null
$$;

-- -----------------------------------------------------------------------------
-- 5. Colunas novas nas tabelas reaproveitadas
-- -----------------------------------------------------------------------------
alter table public.financial_payables
  add column if not exists natureza text not null default 'operacional',
  add column if not exists fornecedor_id uuid references public.fin_fornecedores (id) on delete set null,
  add column if not exists linha_digitavel text,
  add column if not exists codigo_barras text,
  add column if not exists boleto_tipo text,
  add column if not exists boleto_beneficiario text,
  add column if not exists boleto_documento text,
  add column if not exists rascunho boolean not null default false,
  add column if not exists observacao text,
  add column if not exists cancelado_motivo text,
  add column if not exists cancelado_por uuid,
  add column if not exists cancelado_em timestamptz,
  add column if not exists duplicidade_justificativa text;
alter table public.financial_payables drop constraint if exists financial_payables_natureza_check;
alter table public.financial_payables add constraint financial_payables_natureza_check
  check (natureza in ('operacional', 'comissao_banco', 'comissao_participante'));
alter table public.financial_payables drop constraint if exists financial_payables_boleto_check;
alter table public.financial_payables add constraint financial_payables_boleto_check
  check ((linha_digitavel is null or linha_digitavel ~ '^\d{47,48}$')
     and (codigo_barras is null or codigo_barras ~ '^\d{44}$')
     and (boleto_tipo is null or boleto_tipo in ('bancario', 'arrecadacao')));
create index if not exists fin_pay_linha on public.financial_payables (correspondente_id, linha_digitavel) where linha_digitavel is not null;
create index if not exists fin_pay_codigo on public.financial_payables (correspondente_id, codigo_barras) where codigo_barras is not null;

alter table public.financial_receivables
  add column if not exists natureza text not null default 'operacional',
  add column if not exists origem_tipo text,
  add column if not exists origem_ref text,
  add column if not exists observacao text,
  add column if not exists cancelado_motivo text,
  add column if not exists cancelado_por uuid,
  add column if not exists cancelado_em timestamptz,
  add column if not exists duplicidade_justificativa text;
alter table public.financial_receivables drop constraint if exists financial_receivables_natureza_check;
alter table public.financial_receivables add constraint financial_receivables_natureza_check
  check (natureza in ('operacional', 'comissao_banco'));

-- Comissões recebidas dos bancos (a mesma linha de sempre, com o ciclo completo)
alter table public.comissoes
  add column if not exists situacao text not null default 'previsto',
  add column if not exists valor_informado numeric(14, 2),
  add column if not exists informado_em timestamptz,
  add column if not exists informado_por uuid,
  add column if not exists valor_recebido numeric(14, 2) not null default 0,
  add column if not exists previsao_recebimento date,
  add column if not exists cliente_nome text,
  add column if not exists numero_contrato text,
  add column if not exists origem_calculo jsonb,
  add column if not exists origem text not null default 'gatilho',
  add column if not exists observacao text,
  add column if not exists contestacao_motivo text,
  add column if not exists cancelamento_motivo text,
  add column if not exists encerrado_com_diferenca boolean not null default false,
  add column if not exists encerramento_motivo text,
  add column if not exists criado_por uuid,
  add column if not exists duplicidade_justificativa text;
alter table public.comissoes drop constraint if exists comissoes_situacao_check;
alter table public.comissoes add constraint comissoes_situacao_check
  check (situacao in ('previsto', 'a_receber', 'parcial', 'recebido', 'divergente', 'contestado', 'cancelado'));
alter table public.comissoes drop constraint if exists comissoes_origem_check;
alter table public.comissoes add constraint comissoes_origem_check check (origem in ('gatilho', 'manual', 'migracao'));
alter table public.comissoes drop constraint if exists comissoes_valores_check;
alter table public.comissoes add constraint comissoes_valores_check
  check (valor_bruto >= 0 and (valor_informado is null or valor_informado >= 0) and valor_recebido >= 0);

-- Regras e lançamentos de corretores e parceiros: base passa a texto com os valores novos
alter table public.comissao_regras_usuario alter column base_calculo drop default;
alter table public.comissao_regras_usuario alter column base_calculo type text using base_calculo::text;
alter table public.comissoes_usuario alter column base_calculo drop default;
alter table public.comissoes_usuario alter column base_calculo type text using base_calculo::text;
-- "valor_contrato" das regras antigas sempre usou o valor do financiamento; "percentual_repasse", a comissão do banco.
update public.comissao_regras_usuario
   set base_calculo = case base_calculo when 'valor_contrato' then 'valor_financiado'
                                        when 'percentual_repasse' then 'comissao_banco' else base_calculo end;
update public.comissoes_usuario
   set base_calculo = case base_calculo when 'valor_contrato' then 'valor_financiado'
                                        when 'percentual_repasse' then 'comissao_banco' else base_calculo end;
alter table public.comissao_regras_usuario alter column base_calculo set default 'valor_financiado';
alter table public.comissoes_usuario alter column base_calculo set default 'valor_financiado';

alter table public.comissao_regras_usuario
  add column if not exists tipo_valor text not null default 'percentual',
  add column if not exists valor_fixo numeric(14, 2),
  add column if not exists papel text,
  add column if not exists operacao text,
  add column if not exists exige_recebimento_banco boolean not null default false,
  add column if not exists encerrada_em timestamptz,
  add column if not exists encerrada_por uuid,
  add column if not exists motivo_encerramento text;
-- Regra sem pessoa = regra geral do papel (vale para quem não tem regra individual)
alter table public.comissao_regras_usuario alter column usuario_id drop not null;
alter table public.comissao_regras_usuario drop constraint if exists comissao_regras_usuario_novas_check;
alter table public.comissao_regras_usuario add constraint comissao_regras_usuario_novas_check
  check (base_calculo in ('valor_financiado', 'valor_contrato', 'comissao_banco')
     and tipo_valor in ('percentual', 'fixo')
     and (tipo_valor = 'percentual' or (valor_fixo is not null and valor_fixo > 0))
     and (papel is null or papel in ('originou', 'atendeu', 'participou'))
     and (usuario_id is not null or papel is not null)
     and (vigencia_fim is null or vigencia_inicio is null or vigencia_fim >= vigencia_inicio));

alter table public.comissoes_usuario
  add column if not exists situacao text not null default 'prevista',
  add column if not exists papel text,
  add column if not exists regra_snapshot jsonb,
  add column if not exists valor_pago numeric(14, 2) not null default 0,
  add column if not exists vencimento date,
  add column if not exists aprovado_por uuid,
  add column if not exists aprovado_em timestamptz,
  add column if not exists contestacao_motivo text,
  add column if not exists contestado_por uuid,
  add column if not exists contestado_em timestamptz,
  add column if not exists situacao_antes_contestacao text,
  add column if not exists ajuste_motivo text,
  add column if not exists valor_original numeric(14, 2),
  add column if not exists cancelamento_motivo text,
  add column if not exists comissao_banco_id uuid references public.comissoes (id) on delete set null,
  add column if not exists origem text not null default 'gatilho',
  add column if not exists duplicidade_justificativa text,
  add column if not exists criado_por uuid;
alter table public.comissoes_usuario drop constraint if exists comissoes_usuario_novas_check;
alter table public.comissoes_usuario add constraint comissoes_usuario_novas_check
  check (situacao in ('prevista', 'aguardando_confirmacao', 'aprovada', 'parcial', 'paga', 'contestada', 'ajustada', 'cancelada')
     and (papel is null or papel in ('originou', 'atendeu', 'participou'))
     and base_calculo in ('valor_financiado', 'valor_contrato', 'comissao_banco')
     and origem in ('gatilho', 'manual', 'migracao')
     and valor_comissao >= 0 and valor_pago >= 0);
create index if not exists idx_com_usuario_situacao on public.comissoes_usuario (correspondente_id, situacao);

-- Participantes de cada proposta (originou / atendeu / participou)
create table if not exists public.fin_proposta_participantes (
  id                 uuid primary key default gen_random_uuid(),
  correspondente_id  uuid not null,
  proposta_id        uuid not null references public.propostas (id) on delete cascade,
  pessoa_id          uuid not null references public.profiles (id) on delete cascade,
  papel              text not null check (papel in ('originou', 'atendeu', 'participou')),
  observacao         text check (observacao is null or length(observacao) <= 300),
  criado_por         uuid,
  created_at         timestamptz not null default now(),
  unique (proposta_id, pessoa_id, papel)
);

-- -----------------------------------------------------------------------------
-- 6. Migração dos dados legados (antes de ligar guarda e auditoria)
-- -----------------------------------------------------------------------------
-- 6.1 Contas que eram a MESMA receita/obrigação de uma comissão saem das despesas/receitas
update public.financial_receivables r set natureza = 'comissao_banco'
 where r.natureza = 'operacional'
   and (r.comissao_id is not null or exists (select 1 from public.comissoes c where c.receivable_id = r.id));
update public.financial_payables p set natureza = 'comissao_participante'
 where p.natureza = 'operacional'
   and (p.comissao_id is not null
        or exists (select 1 from public.comissoes c where c.payable_id = p.id)
        or exists (select 1 from public.comissoes_usuario cu where cu.payable_id = p.id));

-- 6.2 O que já foi baixado vira linha no livro (uma por conta; a data é a do pagamento)
insert into public.fin_baixas (correspondente_id, natureza, sentido, alvo_id, valor, data, origem, observacao, registrado_em)
select p.correspondente_id, 'conta_pagar', 'saida', p.id, round(p.valor_pago, 2),
       coalesce(p.data_pagamento, p.updated_at::date), 'migracao', 'Baixa anterior ao módulo novo', p.updated_at
  from public.financial_payables p
 where p.natureza = 'operacional' and coalesce(p.valor_pago, 0) > 0 and not coalesce(p.estornada, false)
   and not exists (select 1 from public.fin_baixas b where b.natureza = 'conta_pagar' and b.alvo_id = p.id);
insert into public.fin_baixas (correspondente_id, natureza, sentido, alvo_id, valor, data, origem, observacao, registrado_em)
select r.correspondente_id, 'conta_receber', 'entrada', r.id, round(r.valor_pago, 2),
       coalesce(r.data_pagamento, r.updated_at::date), 'migracao', 'Baixa anterior ao módulo novo', r.updated_at
  from public.financial_receivables r
 where r.natureza = 'operacional' and coalesce(r.valor_pago, 0) > 0 and not coalesce(r.estornada, false)
   and not exists (select 1 from public.fin_baixas b where b.natureza = 'conta_receber' and b.alvo_id = r.id);

-- 6.3 Comissões dos bancos: situação, regra gravada e recebimentos
update public.comissoes c
   set origem_calculo = coalesce(c.origem_calculo, jsonb_build_object(
         'fonte', 'migracao', 'regra_id', c.regra_id, 'percentual', c.percentual, 'valor_base', c.valor_base,
         'valor_bruto', c.valor_bruto, 'regra', (select to_jsonb(r) - 'created_at' - 'updated_at'
                                                   from public.comissao_regras r where r.id = c.regra_id))),
       origem = 'migracao',
       cliente_nome = coalesce(c.cliente_nome, (select p.nome_cliente from public.propostas p where p.id = c.proposta_id)),
       previsao_recebimento = coalesce(c.previsao_recebimento,
                                       (select r.vencimento from public.financial_receivables r where r.id = c.receivable_id),
                                       c.created_at::date + 30);
insert into public.fin_baixas (correspondente_id, natureza, sentido, alvo_id, valor, data, origem, observacao, registrado_em)
select c.correspondente_id, 'comissao_banco', 'entrada', c.id,
       round(case when coalesce(r.valor_pago, 0) > 0 then r.valor_pago else c.valor_bruto end, 2),
       coalesce(r.data_pagamento, r.updated_at::date, c.updated_at::date), 'migracao',
       'Recebimento anterior ao módulo novo', coalesce(r.updated_at, c.updated_at)
  from public.comissoes c
  left join public.financial_receivables r on r.id = c.receivable_id
 where (coalesce(r.valor_pago, 0) > 0 or c.status in ('recebida', 'paga_parceiro', 'encerrada'))
   and round(case when coalesce(r.valor_pago, 0) > 0 then r.valor_pago else c.valor_bruto end, 2) > 0
   and not exists (select 1 from public.fin_baixas b where b.natureza = 'comissao_banco' and b.alvo_id = c.id);
update public.comissoes c
   set valor_recebido = public.fin_total_baixado('comissao_banco', c.id);
update public.comissoes c
   set situacao = case
         when c.valor_recebido = 0 then 'previsto'
         when c.valor_recebido + 0.01 < c.valor_bruto then 'parcial'
         when c.valor_recebido > c.valor_bruto + 0.01 then 'divergente'
         else 'recebido' end;

-- 6.4 Split do parceiro (conta a pagar da comissão do banco) vira lançamento de participante
insert into public.comissoes_usuario (correspondente_id, proposta_id, usuario_id, regra_id, tipo_vinculo, gatilho,
                                      base_calculo, percentual, valor_base, valor_comissao, banco_nome, produto,
                                      numero_proposta, status, payable_id, papel, origem, comissao_banco_id, created_at)
select c.correspondente_id, c.proposta_id, c.parceiro_id, null, 'parceiro', 'contrato_emitido', 'comissao_banco',
       coalesce((select r.percentual_parceiro from public.comissao_regras r where r.id = c.regra_id), 0),
       c.valor_bruto, c.split_parceiro, c.banco_nome, c.produto,
       (select p.numero_proposta from public.propostas p where p.id = c.proposta_id),
       case when pay.status = 'paga' or c.status in ('paga_parceiro', 'encerrada') then 'paga'::public.comissao_usuario_status
            when pay.status = 'cancelada' then 'cancelada'::public.comissao_usuario_status
            else 'a_pagar'::public.comissao_usuario_status end,
       c.payable_id, 'originou', 'migracao', c.id, c.created_at
  from public.comissoes c
  join public.profiles pr on pr.id = c.parceiro_id
  left join public.financial_payables pay on pay.id = c.payable_id
 where c.split_parceiro > 0 and c.proposta_id is not null
   and not exists (select 1 from public.comissoes_usuario cu
                    where cu.proposta_id = c.proposta_id and cu.usuario_id = c.parceiro_id and cu.comissao_banco_id = c.id);

-- 6.5 Lançamentos de participantes: situação, regra gravada, vencimento e pagamentos
update public.comissoes_usuario cu
   set regra_snapshot = coalesce(cu.regra_snapshot, jsonb_build_object(
         'fonte', 'migracao', 'regra_id', cu.regra_id, 'tipo_valor', 'percentual', 'percentual', cu.percentual,
         'base_calculo', cu.base_calculo, 'valor_base', cu.valor_base, 'gatilho', cu.gatilho,
         'tipo_vinculo', cu.tipo_vinculo)),
       origem = case when cu.origem = 'gatilho' then 'migracao' else cu.origem end,
       vencimento = coalesce(cu.vencimento, (select p.vencimento from public.financial_payables p where p.id = cu.payable_id),
                             cu.created_at::date + 30),
       valor_original = coalesce(cu.valor_original, cu.valor_comissao);
insert into public.fin_baixas (correspondente_id, natureza, sentido, alvo_id, valor, data, origem, observacao, registrado_em)
select cu.correspondente_id, 'comissao_participante', 'saida', cu.id,
       round(case when coalesce(p.valor_pago, 0) > 0 then least(p.valor_pago, cu.valor_comissao) else cu.valor_comissao end, 2),
       coalesce(p.data_pagamento, p.updated_at::date, cu.updated_at::date), 'migracao',
       'Pagamento anterior ao módulo novo', coalesce(p.updated_at, cu.updated_at)
  from public.comissoes_usuario cu
  left join public.financial_payables p on p.id = cu.payable_id
 where (cu.status = 'paga' or coalesce(p.valor_pago, 0) > 0)
   and round(case when coalesce(p.valor_pago, 0) > 0 then least(p.valor_pago, cu.valor_comissao) else cu.valor_comissao end, 2) > 0
   and not exists (select 1 from public.fin_baixas b where b.natureza = 'comissao_participante' and b.alvo_id = cu.id);
update public.comissoes_usuario cu set valor_pago = public.fin_total_baixado('comissao_participante', cu.id);
update public.comissoes_usuario cu
   set situacao = case
         when cu.status = 'cancelada' then 'cancelada'
         when cu.valor_pago > 0 and cu.valor_pago + 0.01 >= cu.valor_comissao then 'paga'
         when cu.valor_pago > 0 then 'parcial'
         else 'prevista' end;

-- 6.6 Repasse de despesas: data de pagamento coerente com o livro (nada muda de valor)
-- (valor_pago das contas continua o mesmo número, agora igual à soma do livro)

-- -----------------------------------------------------------------------------
-- 7. Guarda das contas a pagar/receber (pagamento só pelo livro)
-- -----------------------------------------------------------------------------
create or replace function public.fin_tg_guarda_conta()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  natureza_tab text := case tg_table_name when 'financial_payables' then 'conta_pagar' else 'conta_receber' end;
begin
  if coalesce(current_setting('fin.interno', true), '') = 'on' then
    return coalesce(new, old);
  end if;
  if tg_op = 'INSERT' then
    if coalesce(new.valor_pago, 0) <> 0 or new.status not in ('aberta', 'atrasada') or new.data_pagamento is not null
       or coalesce(new.estornada, false) or new.natureza <> 'operacional' or coalesce(new.valor, 0) < 0 then
      raise exception 'Conta nova nasce em aberto: pagamento e recebimento só pelo registro de baixa.' using errcode = '42501';
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if new.valor_pago is distinct from old.valor_pago
       or new.data_pagamento is distinct from old.data_pagamento
       or new.estornada is distinct from old.estornada
       or new.natureza is distinct from old.natureza
       or new.correspondente_id is distinct from old.correspondente_id
       or (new.status is distinct from old.status
           and not (old.status in ('aberta', 'atrasada') and new.status in ('aberta', 'atrasada')))
       or (old.rascunho and not new.rascunho) then
      raise exception 'Pagamento, situação e conferência da conta só mudam pelas funções do financeiro.' using errcode = '42501';
    end if;
    if old.status in ('paga', 'cancelada', 'estornada')
       and (new.valor is distinct from old.valor or new.vencimento is distinct from old.vencimento) then
      raise exception 'Conta paga ou cancelada não muda de valor nem de vencimento.' using errcode = '42501';
    end if;
    if new.valor < old.valor_pago then
      raise exception 'O valor não pode ficar menor que o já pago.' using errcode = '22023';
    end if;
    return new;
  else
    if exists (select 1 from public.fin_baixas b where b.natureza = natureza_tab and b.alvo_id = old.id and b.estornada_em is null) then
      raise exception 'Conta com pagamento registrado não pode ser excluída: estorne o pagamento antes.' using errcode = '42501';
    end if;
    if old.natureza <> 'operacional' then
      raise exception 'Esta conta pertence a uma comissão e não pode ser excluída por aqui.' using errcode = '42501';
    end if;
    return old;
  end if;
end $$;

drop trigger if exists trg_fin_guarda_pay on public.financial_payables;
create trigger trg_fin_guarda_pay before insert or update or delete on public.financial_payables
  for each row execute function public.fin_tg_guarda_conta();
drop trigger if exists trg_fin_guarda_rec on public.financial_receivables;
create trigger trg_fin_guarda_rec before insert or update or delete on public.financial_receivables
  for each row execute function public.fin_tg_guarda_conta();

-- -----------------------------------------------------------------------------
-- 8. Auditoria ligada em tudo que tem dinheiro ou regra
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['financial_payables', 'financial_receivables', 'comissoes', 'comissao_regras',
                           'comissoes_usuario', 'comissao_regras_usuario', 'fin_baixas', 'fin_anexos',
                           'fin_contas_bancarias', 'fin_fornecedores', 'fin_parametros', 'fin_proposta_participantes',
                           'financial_categories', 'financial_cost_centers', 'financial_payment_methods'] loop
    execute format('drop trigger if exists trg_fin_auditar on public.%I', t);
    execute format('create trigger trg_fin_auditar after insert or update or delete on public.%I
                      for each row execute function public.fin_tg_auditar()', t);
  end loop;
end $$;

drop trigger if exists trg_fin_contas_bancarias_upd on public.fin_contas_bancarias;
create trigger trg_fin_contas_bancarias_upd before update on public.fin_contas_bancarias
  for each row execute function public.update_updated_at_column();
drop trigger if exists trg_fin_fornecedores_upd on public.fin_fornecedores;
create trigger trg_fin_fornecedores_upd before update on public.fin_fornecedores
  for each row execute function public.update_updated_at_column();

-- -----------------------------------------------------------------------------
-- 9. RLS: leitura por permissão; escrita só pelas funções do módulo
-- -----------------------------------------------------------------------------
alter table public.fin_parametros enable row level security;
alter table public.fin_contas_bancarias enable row level security;
alter table public.fin_fornecedores enable row level security;
alter table public.fin_anexos enable row level security;
alter table public.fin_auditoria enable row level security;
alter table public.fin_baixas enable row level security;
alter table public.fin_proposta_participantes enable row level security;

revoke all on public.fin_parametros, public.fin_contas_bancarias, public.fin_fornecedores, public.fin_anexos,
              public.fin_auditoria, public.fin_baixas, public.fin_proposta_participantes from public, anon, authenticated;
grant select on public.fin_parametros, public.fin_contas_bancarias, public.fin_fornecedores, public.fin_anexos,
               public.fin_auditoria, public.fin_baixas, public.fin_proposta_participantes to authenticated;
grant all on public.fin_parametros, public.fin_contas_bancarias, public.fin_fornecedores, public.fin_anexos,
             public.fin_auditoria, public.fin_baixas, public.fin_proposta_participantes to service_role;
revoke update, delete, truncate on public.fin_auditoria from service_role;

drop policy if exists fin_parametros_sel on public.fin_parametros;
create policy fin_parametros_sel on public.fin_parametros for select to authenticated
  using (correspondente_id = public.fin_corr() and public.fin_pode('financeiro.regras', 'view'));
drop policy if exists fin_contas_bancarias_sel on public.fin_contas_bancarias;
create policy fin_contas_bancarias_sel on public.fin_contas_bancarias for select to authenticated
  using (correspondente_id = public.fin_corr()
         and (public.fin_pode('financeiro.regras', 'view') or public.fin_pode('financeiro.conciliacao', 'view')
              or public.fin_pode('financeiro.contas_pagar', 'view') or public.fin_pode('financeiro.contas_receber', 'view')
              or public.fin_pode('financeiro.comissoes_bancos', 'view')));
drop policy if exists fin_fornecedores_sel on public.fin_fornecedores;
create policy fin_fornecedores_sel on public.fin_fornecedores for select to authenticated
  using (correspondente_id = public.fin_corr()
         and (public.fin_pode('financeiro.regras', 'view') or public.fin_pode('financeiro.contas_pagar', 'view')));
drop policy if exists fin_anexos_sel on public.fin_anexos;
create policy fin_anexos_sel on public.fin_anexos for select to authenticated
  using (correspondente_id = public.fin_corr() and public.fin_pode(modulo, 'view'));
drop policy if exists fin_auditoria_sel on public.fin_auditoria;
create policy fin_auditoria_sel on public.fin_auditoria for select to authenticated
  using (correspondente_id = public.fin_corr() and public.fin_pode('financeiro.auditoria', 'view'));
drop policy if exists fin_baixas_sel on public.fin_baixas;
create policy fin_baixas_sel on public.fin_baixas for select to authenticated
  using (correspondente_id = public.fin_corr()
         and (public.fin_pode(public.fin_modulo_natureza(natureza), 'view')
              or public.fin_pode('financeiro.conciliacao', 'view')));
drop policy if exists fin_participantes_sel on public.fin_proposta_participantes;
create policy fin_participantes_sel on public.fin_proposta_participantes for select to authenticated
  using (correspondente_id = public.fin_corr() and public.fin_pode('financeiro.comissoes', 'view'));

-- Comissões dos bancos: lê quem tem a permissão; escrita só pelas funções
drop policy if exists fin_comissoes_sel on public.comissoes;
drop policy if exists fin_comissoes_ins on public.comissoes;
drop policy if exists fin_comissoes_upd on public.comissoes;
drop policy if exists fin_comissoes_del on public.comissoes;
drop policy if exists fin_comissoes_mod on public.comissoes;
create policy fin_comissoes_sel on public.comissoes for select to authenticated
  using (correspondente_id = public.fin_corr() and public.fin_pode('financeiro.comissoes_bancos', 'view'));
revoke insert, update, delete, truncate on public.comissoes from anon, authenticated;

drop policy if exists fin_regras_all on public.comissao_regras;
drop policy if exists fin_regras_sel on public.comissao_regras;
create policy fin_regras_sel on public.comissao_regras for select to authenticated
  using (correspondente_id = public.fin_corr() and public.fin_pode('financeiro.comissoes_bancos', 'view'));
revoke insert, update, delete, truncate on public.comissao_regras from anon, authenticated;

-- Corretores e parceiros: quem tem a permissão vê tudo; a pessoa vê só as próprias
drop policy if exists com_usuario_select on public.comissoes_usuario;
drop policy if exists com_usuario_insert on public.comissoes_usuario;
drop policy if exists com_usuario_update on public.comissoes_usuario;
drop policy if exists com_usuario_delete on public.comissoes_usuario;
create policy com_usuario_select on public.comissoes_usuario for select to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
         and (public.fin_pode('financeiro.comissoes', 'view') or usuario_id = (select auth.uid())));
revoke insert, update, delete, truncate on public.comissoes_usuario from anon, authenticated;

drop policy if exists com_regras_usuario_select on public.comissao_regras_usuario;
drop policy if exists com_regras_usuario_insert on public.comissao_regras_usuario;
drop policy if exists com_regras_usuario_update on public.comissao_regras_usuario;
drop policy if exists com_regras_usuario_delete on public.comissao_regras_usuario;
create policy com_regras_usuario_select on public.comissao_regras_usuario for select to authenticated
  using (correspondente_id = public.fin_corr() and public.fin_pode('financeiro.comissoes', 'view'));
revoke insert, update, delete, truncate on public.comissao_regras_usuario from anon, authenticated;

-- Contas a pagar: matriz de permissões. Exceção estreita: o RH (outra frente) gera e
-- mantém as contas da folha/adiantamentos pelo papel financeiro, como antes.
drop policy if exists fin_pay_all on public.financial_payables;
drop policy if exists fin_pay_sel on public.financial_payables;
drop policy if exists fin_pay_ins on public.financial_payables;
drop policy if exists fin_pay_upd on public.financial_payables;
drop policy if exists fin_pay_del on public.financial_payables;
create policy fin_pay_sel on public.financial_payables for select to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
         and (public.fin_pode('financeiro.contas_pagar', 'view')
              or (origem_tipo like 'rh\_%' and public.usuario_pode_financeiro((select auth.uid())))));
create policy fin_pay_ins on public.financial_payables for insert to authenticated
  with check (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
              and (public.fin_pode('financeiro.contas_pagar', 'create')
                   or public.usuario_pode_financeiro((select auth.uid()))));
create policy fin_pay_upd on public.financial_payables for update to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
         and (public.fin_pode('financeiro.contas_pagar', 'edit')
              or (origem_tipo like 'rh\_%' and public.usuario_pode_financeiro((select auth.uid())))))
  with check (correspondente_id = public.correspondente_do_usuario((select auth.uid())));
create policy fin_pay_del on public.financial_payables for delete to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
         and (public.fin_pode('financeiro.contas_pagar', 'edit')
              or (origem_tipo like 'rh\_%' and public.usuario_pode_financeiro((select auth.uid())))));

drop policy if exists fin_rec_all on public.financial_receivables;
drop policy if exists fin_rec_sel on public.financial_receivables;
drop policy if exists fin_rec_ins on public.financial_receivables;
drop policy if exists fin_rec_upd on public.financial_receivables;
drop policy if exists fin_rec_del on public.financial_receivables;
create policy fin_rec_sel on public.financial_receivables for select to authenticated
  using (correspondente_id = public.fin_corr() and public.fin_pode('financeiro.contas_receber', 'view'));
create policy fin_rec_ins on public.financial_receivables for insert to authenticated
  with check (correspondente_id = public.fin_corr() and public.fin_pode('financeiro.contas_receber', 'create'));
create policy fin_rec_upd on public.financial_receivables for update to authenticated
  using (correspondente_id = public.fin_corr() and public.fin_pode('financeiro.contas_receber', 'edit'))
  with check (correspondente_id = public.fin_corr());
create policy fin_rec_del on public.financial_receivables for delete to authenticated
  using (correspondente_id = public.fin_corr() and public.fin_pode('financeiro.contas_receber', 'edit'));

-- Log livre antigo: ninguém mais insere pelo app (o histórico novo é fin_auditoria)
drop policy if exists fin_audit_ins on public.financial_audit_logs;
revoke insert, update, delete, truncate on public.financial_audit_logs from anon, authenticated;
drop policy if exists fin_hist_all on public.financial_payable_history;
drop policy if exists fin_hist_sel on public.financial_payable_history;
create policy fin_hist_sel on public.financial_payable_history for select to authenticated
  using (correspondente_id = public.fin_corr() and public.fin_pode('financeiro.auditoria', 'view'));
revoke insert, update, delete, truncate on public.financial_payable_history from anon, authenticated;

-- Diário antigo das baixas: substituído pelo livro fin_baixas; fica só para leitura
drop policy if exists fin_fluxo_all on public.fluxo_caixa;
drop policy if exists fin_fluxo_sel on public.fluxo_caixa;
create policy fin_fluxo_sel on public.fluxo_caixa for select to authenticated
  using (correspondente_id = public.fin_corr() and public.fin_pode('financeiro.auditoria', 'view'));
revoke insert, update, delete, truncate on public.fluxo_caixa from anon, authenticated;

-- Cadastros: leitura para quem usa o financeiro; escrita só pelas funções (financeiro.regras)
drop policy if exists fin_cat_all on public.financial_categories;
drop policy if exists fin_cc_all on public.financial_cost_centers;
drop policy if exists fin_pm_all on public.financial_payment_methods;
drop policy if exists fin_cat_sel on public.financial_categories;
drop policy if exists fin_cc_sel on public.financial_cost_centers;
drop policy if exists fin_pm_sel on public.financial_payment_methods;
create policy fin_cat_sel on public.financial_categories for select to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid())) and public.usuario_pode_financeiro((select auth.uid())));
create policy fin_cc_sel on public.financial_cost_centers for select to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid())) and public.usuario_pode_financeiro((select auth.uid())));
create policy fin_pm_sel on public.financial_payment_methods for select to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid())) and public.usuario_pode_financeiro((select auth.uid())));
revoke insert, update, delete, truncate on public.financial_categories, public.financial_cost_centers,
  public.financial_payment_methods from anon, authenticated;

-- Comprovantes: pasta por módulo; ninguém altera nem apaga (evidência)
drop policy if exists fin_comprovantes_all on storage.objects;
drop policy if exists fin_comprovantes_sel on storage.objects;
drop policy if exists fin_comprovantes_ins on storage.objects;
create policy fin_comprovantes_sel on storage.objects for select to authenticated
  using (bucket_id = 'financeiro-comprovantes'
         and (storage.foldername(name))[1] = public.fin_corr()::text
         and (case when array_length(storage.foldername(name), 1) >= 2
                   then public.fin_pode(public.fin_modulo_da_pasta((storage.foldername(name))[2]), 'view')
                   else public.fin_pode('financeiro.contas_pagar', 'view') or public.fin_pode('financeiro.contas_receber', 'view')
              end));
create policy fin_comprovantes_ins on storage.objects for insert to authenticated
  with check (bucket_id = 'financeiro-comprovantes'
              and (storage.foldername(name))[1] = public.fin_corr()::text
              and array_length(storage.foldername(name), 1) >= 2
              and public.fin_modulo_da_pasta((storage.foldername(name))[2]) is not null
              and (public.fin_pode(public.fin_modulo_da_pasta((storage.foldername(name))[2]), 'create')
                   or public.fin_pode(public.fin_modulo_da_pasta((storage.foldername(name))[2]), 'edit')
                   or public.fin_pode(public.fin_modulo_da_pasta((storage.foldername(name))[2]), 'baixar')
                   or public.fin_pode(public.fin_modulo_da_pasta((storage.foldername(name))[2]), 'receber')
                   or public.fin_pode(public.fin_modulo_da_pasta((storage.foldername(name))[2]), 'pagar')
                   or public.fin_pode(public.fin_modulo_da_pasta((storage.foldername(name))[2]), 'conciliar')));
update storage.buckets set file_size_limit = 15728640 where id = 'financeiro-comprovantes' and file_size_limit is null;

-- -----------------------------------------------------------------------------
-- 10. Matriz de permissões nova (níveis existentes herdam o que já podiam)
-- -----------------------------------------------------------------------------
with mapa(de_modulo, de_acao, para_modulo, para_acao) as (values
  ('financeiro.comissoes', 'view', 'financeiro.comissoes_bancos', 'view'),
  ('financeiro.comissoes', 'view', 'financeiro.repasses', 'view'),
  ('financeiro.comissoes', 'edit', 'financeiro.comissoes_bancos', 'create'),
  ('financeiro.comissoes', 'edit', 'financeiro.comissoes_bancos', 'edit'),
  ('financeiro.comissoes', 'edit', 'financeiro.comissoes_bancos', 'regras'),
  ('financeiro.comissoes', 'edit', 'financeiro.comissoes_bancos', 'receber'),
  ('financeiro.comissoes', 'edit', 'financeiro.repasses', 'regras'),
  ('financeiro.comissoes', 'edit', 'financeiro.repasses', 'aprovar'),
  ('financeiro.comissoes', 'edit', 'financeiro.repasses', 'pagar'),
  ('financeiro.comissoes', 'edit', 'financeiro.repasses', 'edit'),
  ('financeiro.comissoes', 'edit', 'financeiro.comissoes', 'create'),
  ('financeiro.comissoes', 'edit', 'financeiro.comissoes', 'regras'),
  ('financeiro.comissoes', 'edit', 'financeiro.comissoes', 'aprovar'),
  ('financeiro.comissoes', 'edit', 'financeiro.comissoes', 'pagar'),
  ('financeiro.contas_pagar', 'view', 'financeiro.conciliacao', 'view'),
  ('financeiro.contas_receber', 'view', 'financeiro.conciliacao', 'view'),
  ('financeiro.contas_pagar', 'create', 'financeiro.conciliacao', 'create'),
  ('financeiro.contas_receber', 'create', 'financeiro.conciliacao', 'create'),
  ('financeiro.contas_pagar', 'baixar', 'financeiro.conciliacao', 'conciliar'),
  ('financeiro.contas_receber', 'baixar', 'financeiro.conciliacao', 'conciliar'),
  ('financeiro.painel', 'view', 'financeiro.regras', 'view'),
  ('financeiro.painel', 'view', 'financeiro.auditoria', 'view'),
  ('financeiro.contas_pagar', 'edit', 'financeiro.regras', 'edit'),
  ('financeiro.contas_receber', 'edit', 'financeiro.regras', 'edit'),
  ('financeiro.fluxo_caixa', 'view', 'financeiro.painel', 'export'))
insert into public.permissions (nivel_acesso_id, modulo, acao, escopo_dados, permitido)
select distinct on (p.nivel_acesso_id, m.para_modulo, m.para_acao)
       p.nivel_acesso_id, m.para_modulo, m.para_acao, p.escopo_dados, true
  from public.permissions p
  join mapa m on m.de_modulo = p.modulo and m.de_acao = p.acao
 where p.permitido
on conflict (nivel_acesso_id, modulo, acao) do nothing;

-- -----------------------------------------------------------------------------
-- 11. Execução das funções: nada para PUBLIC/anon; internas só para o próprio banco
-- -----------------------------------------------------------------------------
revoke all on function public.fin_corr(), public.fin_pode(text, text), public.fin_exigir(text, text),
  public.fin_modulo_natureza(text), public.fin_modulo_da_pasta(text), public.fin_param(uuid),
  public.fin_total_baixado(text, uuid) from public, anon;
grant execute on function public.fin_corr(), public.fin_pode(text, text), public.fin_modulo_natureza(text),
  public.fin_modulo_da_pasta(text) to authenticated;
revoke all on function public.fin_ctx(text, text), public.fin_ctx_fim(), public.fin_tg_auditar(),
  public.fin_tg_guarda_conta() from public, anon, authenticated;
