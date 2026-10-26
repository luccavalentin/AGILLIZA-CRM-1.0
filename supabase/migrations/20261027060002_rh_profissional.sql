-- =============================================================================
-- Gestão de Pessoas e RH profissional (pedido do dono de 26/10/2026, item C46)
--
-- O RH já tinha quase todas as tabelas, mas a lógica não fechava:
--   · salário, banco e PIX saíam para quem só podia ver a ficha; holerites, alterações
--     e histórico salarial também; ajustes da folha e checklist sem permissão nenhuma;
--   · o catálogo de permissões pedia uma ação e a RLS outra (ninguém fora o admin
--     conseguia lançar ocorrência, adiantamento ou holerite);
--   · INSS, IRRF, salário mínimo e salário-família fixos no código;
--   · "fechar a competência" não travava nada no banco.
--
-- Esta migração:
--   1. Permissões coerentes (catálogo = RLS = servidor): `rh.salarios` (ver/alterar
--      salário e dados bancários) e `rh.folha` (ver, lançar, fechar/reabrir) entram no
--      lugar de `rh.previa_folha`, `rh.holerites`, `rh.adiantamentos`, `rh.descontos` e
--      `rh.salariais` — as linhas de cada nível de acesso são migradas sem perda.
--   2. Colunas sensíveis de `rh_funcionarios` fechadas por privilégio de coluna; leitura só
--      por `rh_dados_sensiveis` (confere `rh.salarios:view` e a empresa) e gravação barrada
--      por gatilho sem `rh.salarios:edit`.
--   3. `rh_lancamentos`: um só lugar para o que entra na competência (horas extras,
--      atraso, adicional noturno, comissão, bônus, descontos…), absorvendo `rh_descontos`
--      e `rh_folha_ajustes` (dados migrados, tabelas removidas).
--   4. `rh_tabelas_fiscais`: INSS, IRRF, salário mínimo, salário-família e FGTS por
--      vigência — padrão do sistema (correspondente nulo) + vigências próprias.
--   5. Competência fechada trava no banco; fechar e reabrir só pelas funções
--      `rh_fechar_competencia` / `rh_reabrir_competencia` (exigem `rh.folha:gerir`).
--   6. `rh_desligamentos` (desligamento guiado), centro de custo na ficha, área do
--      colaborador (`rh_meu_resumo`, holerite da competência fechada visível ao dono).
--   7. Bucket `rh-documentos`: holerite só com `rh.salarios:view` ou para o dono,
--      documento só com `rh.documentos:view`, foto com `rh.funcionarios:view`.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Funções de apoio
-- -----------------------------------------------------------------------------

/** A pessoa logada tem a permissão (admin/correspondente sempre têm). */
create or replace function public.rh_pode(_modulo text, _acao text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and public.usuario_tem_permissao(auth.uid(), _modulo, _acao)
$$;

/** Ficha de RH ligada ao usuário logado (área do colaborador). */
create or replace function public.rh_funcionario_do_usuario()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select f.id from public.rh_funcionarios f
   where f.user_id = auth.uid() and f.deletado_em is null
   order by f.created_at desc
   limit 1
$$;

/** Algum mês fechado da empresa toca o intervalo [ini, fim]? */
create or replace function public.rh_mes_fechado_no_intervalo(_corr uuid, _ini date, _fim date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.rh_folha_competencias c
     where c.correspondente_id = _corr and c.status = 'fechada'
       and make_date(c.ano, c.mes, 1) <= coalesce(_fim, _ini)
       and (make_date(c.ano, c.mes, 1) + interval '1 month' - interval '1 day')::date >= _ini)
$$;

revoke all on function public.rh_pode(text, text), public.rh_funcionario_do_usuario(),
  public.rh_mes_fechado_no_intervalo(uuid, date, date) from public, anon;
grant execute on function public.rh_pode(text, text), public.rh_funcionario_do_usuario(),
  public.rh_mes_fechado_no_intervalo(uuid, date, date) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Tabelas novas e colunas
-- -----------------------------------------------------------------------------

alter table public.rh_funcionarios
  add column if not exists centro_custo_id uuid references public.financial_cost_centers(id) on delete set null;
create index if not exists ix_rh_func_centro_custo on public.rh_funcionarios (centro_custo_id) where centro_custo_id is not null;

-- Antes, toda a folha gerava contas a pagar e a marca da ficha não valia nada. Agora a
-- marca manda; todos os atuais ficam marcados para o comportamento não mudar.
alter table public.rh_funcionarios alter column gerar_contas_pagar_automatico set default true;
update public.rh_funcionarios set gerar_contas_pagar_automatico = true where not gerar_contas_pagar_automatico;

create table if not exists public.rh_lancamentos (
  id uuid primary key default gen_random_uuid(),
  correspondente_id uuid not null,
  funcionario_id uuid not null references public.rh_funcionarios(id) on delete cascade,
  mes smallint not null check (mes between 1 and 12),
  ano smallint not null check (ano between 2020 and 2100),
  tipo text not null check (tipo in (
    'hora_extra_50', 'hora_extra_100', 'adicional_noturno', 'atraso',
    'comissao', 'bonus', 'outro_provento',
    'desconto', 'emprestimo_consignado', 'pensao_alimenticia', 'contribuicao_sindical')),
  -- Horas (HE, noturno, atraso). Nos tipos em dinheiro fica nula.
  quantidade numeric(10,2) check (quantidade is null or quantidade between 0 and 744),
  valor numeric(14,2) not null default 0 check (valor >= 0),
  descricao text check (descricao is null or length(descricao) <= 300),
  ativo boolean not null default true,
  criado_por uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rh_lancamentos_horas check (
    tipo not in ('hora_extra_50', 'hora_extra_100', 'adicional_noturno', 'atraso') or quantidade > 0),
  constraint rh_lancamentos_valor check (
    tipo in ('hora_extra_50', 'hora_extra_100', 'adicional_noturno', 'atraso') or valor > 0)
);
create index if not exists ix_rh_lanc_comp on public.rh_lancamentos (correspondente_id, ano, mes);
create index if not exists ix_rh_lanc_func on public.rh_lancamentos (funcionario_id, ano, mes);
comment on table public.rh_lancamentos is
  'O que entra na competência da folha além do salário e dos benefícios: horas extras, atraso, adicional noturno, comissão, bônus e descontos. Faltas/atestados ficam em rh_ocorrencias e adiantamentos em rh_adiantamentos.';

create table if not exists public.rh_tabelas_fiscais (
  id uuid primary key default gen_random_uuid(),
  -- Nulo = tabela padrão do sistema (só por migração). Preenchido = vigência própria.
  correspondente_id uuid,
  vigencia_desde date not null check (extract(day from vigencia_desde) = 1),
  salario_minimo numeric(12,2) not null check (salario_minimo > 0),
  inss_faixas jsonb not null,
  irrf_faixas jsonb not null,
  irrf_dependente numeric(12,2) not null check (irrf_dependente >= 0),
  irrf_desconto_simplificado numeric(12,2) not null check (irrf_desconto_simplificado >= 0),
  irrf_reducao jsonb,
  salario_familia_quota numeric(12,2) not null check (salario_familia_quota >= 0),
  salario_familia_teto numeric(12,2) not null check (salario_familia_teto >= 0),
  fgts_aliquota numeric(6,4) not null default 0.08 check (fgts_aliquota between 0 and 1),
  fonte text check (fonte is null or length(fonte) <= 500),
  criado_por uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rh_tabelas_fiscais_unica unique nulls not distinct (correspondente_id, vigencia_desde)
);
comment on table public.rh_tabelas_fiscais is
  'Parâmetros da folha por vigência (INSS progressivo, IRRF com dedução, dependente, desconto simplificado, redução da Lei 15.270/2025, salário mínimo, salário-família, FGTS). A competência usa a vigência mais recente até ela — a própria do correspondente vence a padrão na mesma data.';

/** Faixas coerentes: INSS [{ate, aliquota}] crescente; IRRF [{ate|null, aliquota, deducao}] com a última aberta. */
create or replace function public.rh_validar_tabela_fiscal()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  f jsonb;
  anterior numeric := 0;
  n int;
  i int := 0;
begin
  if jsonb_typeof(new.inss_faixas) <> 'array' or jsonb_array_length(new.inss_faixas) = 0 then
    raise exception 'Informe as faixas do INSS.' using errcode = '22023';
  end if;
  for f in select * from jsonb_array_elements(new.inss_faixas) loop
    if (f ->> 'ate') is null or (f ->> 'ate')::numeric <= anterior
       or (f ->> 'aliquota') is null or (f ->> 'aliquota')::numeric not between 0 and 1 then
      raise exception 'Faixas do INSS inválidas: limites crescentes e alíquota entre 0 e 1.' using errcode = '22023';
    end if;
    anterior := (f ->> 'ate')::numeric;
  end loop;

  if jsonb_typeof(new.irrf_faixas) <> 'array' or jsonb_array_length(new.irrf_faixas) = 0 then
    raise exception 'Informe as faixas do IRRF.' using errcode = '22023';
  end if;
  n := jsonb_array_length(new.irrf_faixas);
  anterior := -1;
  for f in select * from jsonb_array_elements(new.irrf_faixas) loop
    i := i + 1;
    if (f ->> 'aliquota') is null or (f ->> 'aliquota')::numeric not between 0 and 1
       or coalesce((f ->> 'deducao')::numeric, -1) < 0 then
      raise exception 'Faixas do IRRF inválidas: alíquota entre 0 e 1 e dedução não negativa.' using errcode = '22023';
    end if;
    if i < n then
      if (f ->> 'ate') is null or (f ->> 'ate')::numeric <= anterior then
        raise exception 'Faixas do IRRF inválidas: limites crescentes, só a última sem limite.' using errcode = '22023';
      end if;
      anterior := (f ->> 'ate')::numeric;
    elsif (f ->> 'ate') is not null then
      raise exception 'A última faixa do IRRF não tem limite (deixe "até" vazio).' using errcode = '22023';
    end if;
  end loop;

  if new.irrf_reducao is not null and (
       jsonb_typeof(new.irrf_reducao) <> 'object'
       or (new.irrf_reducao ->> 'isencao_ate') is null or (new.irrf_reducao ->> 'reducao_maxima') is null
       or (new.irrf_reducao ->> 'ate') is null or (new.irrf_reducao ->> 'a') is null
       or (new.irrf_reducao ->> 'b') is null) then
    raise exception 'Redução do IRRF incompleta (isenção até, redução máxima, até, a, b).' using errcode = '22023';
  end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists rh_tabelas_fiscais_validar on public.rh_tabelas_fiscais;
create trigger rh_tabelas_fiscais_validar before insert or update on public.rh_tabelas_fiscais
  for each row execute function public.rh_validar_tabela_fiscal();

-- Padrão do sistema: os mesmos valores que o motor tinha fixos até aqui.
--  · INSS 2026, salário mínimo e salário-família: Portaria Interministerial MPS/MF nº 13, de 09/01/2026.
--  · IRRF: tabela progressiva mensal vigente desde maio/2025, desconto simplificado R$ 607,20 e,
--    a partir de jan/2026, a redução da Lei 15.270/2025 (isenção efetiva até R$ 5.000).
insert into public.rh_tabelas_fiscais (correspondente_id, vigencia_desde, salario_minimo, inss_faixas, irrf_faixas,
  irrf_dependente, irrf_desconto_simplificado, irrf_reducao, salario_familia_quota, salario_familia_teto, fgts_aliquota, fonte)
values
  (null, '2025-01-01', 1518,
   '[{"ate":1518,"aliquota":0.075},{"ate":2793.88,"aliquota":0.09},{"ate":4190.83,"aliquota":0.12},{"ate":8157.41,"aliquota":0.14}]',
   '[{"ate":2428.8,"aliquota":0,"deducao":0},{"ate":2826.65,"aliquota":0.075,"deducao":182.16},{"ate":3751.05,"aliquota":0.15,"deducao":394.16},{"ate":4664.68,"aliquota":0.225,"deducao":675.49},{"ate":null,"aliquota":0.275,"deducao":908.73}]',
   189.59, 607.20, null, 65.00, 1906.04, 0.08,
   'INSS/salário mínimo/salário-família 2025; IRRF mensal vigente desde 05/2025'),
  (null, '2026-01-01', 1621,
   '[{"ate":1621,"aliquota":0.075},{"ate":2902.84,"aliquota":0.09},{"ate":4354.27,"aliquota":0.12},{"ate":8475.55,"aliquota":0.14}]',
   '[{"ate":2428.8,"aliquota":0,"deducao":0},{"ate":2826.65,"aliquota":0.075,"deducao":182.16},{"ate":3751.05,"aliquota":0.15,"deducao":394.16},{"ate":4664.68,"aliquota":0.225,"deducao":675.49},{"ate":null,"aliquota":0.275,"deducao":908.73}]',
   189.59, 607.20,
   '{"isencao_ate":5000,"reducao_maxima":312.89,"ate":7350,"a":978.62,"b":0.133145}',
   67.54, 1980.38, 0.08,
   'Portaria Interministerial MPS/MF nº 13/2026; IRRF mensal + redução da Lei 15.270/2025')
on conflict on constraint rh_tabelas_fiscais_unica do nothing;

create table if not exists public.rh_desligamentos (
  id uuid primary key default gen_random_uuid(),
  correspondente_id uuid not null,
  funcionario_id uuid not null references public.rh_funcionarios(id) on delete cascade,
  tipo text not null check (tipo in ('sem_justa_causa', 'justa_causa', 'pedido_demissao', 'acordo',
                                     'termino_contrato', 'termino_experiencia', 'outro')),
  aviso text not null default 'indenizado' check (aviso in ('trabalhado', 'indenizado', 'dispensado')),
  data_aviso date,
  data_desligamento date not null,
  motivo text check (motivo is null or length(motivo) <= 1000),
  -- [{chave, rotulo, feito, feito_em}] — o modelo vem do código (checklist de saída).
  checklist jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array'),
  status text not null default 'em_andamento' check (status in ('em_andamento', 'concluido', 'cancelado')),
  criado_por uuid,
  concluido_por uuid,
  concluido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rh_desligamentos_datas check (data_aviso is null or data_aviso <= data_desligamento)
);
-- Um desligamento em andamento por funcionário.
create unique index if not exists ux_rh_desl_aberto on public.rh_desligamentos (funcionario_id)
  where status = 'em_andamento';
comment on table public.rh_desligamentos is
  'Desligamento guiado: tipo, aviso prévio, datas e checklist de saída. As verbas rescisórias são estimadas na tela (dependem do salário) e não ficam gravadas aqui.';

-- -----------------------------------------------------------------------------
-- 3. Migração sem perda: descontos e ajustes da folha viram lançamentos
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.rh_descontos') is not null then
    insert into public.rh_lancamentos (id, correspondente_id, funcionario_id, mes, ano, tipo, valor, descricao, ativo,
                                       created_at, updated_at)
    select d.id, d.correspondente_id, d.funcionario_id, d.competencia_mes, d.competencia_ano, 'desconto',
           d.valor, coalesce(nullif(d.motivo, ''), 'Desconto'), d.status <> 'cancelado', d.created_at, d.updated_at
      from public.rh_descontos d
     where d.valor > 0 and d.competencia_mes between 1 and 12 and d.competencia_ano between 2020 and 2100
    on conflict (id) do nothing;
    drop table public.rh_descontos;
  end if;
  if to_regclass('public.rh_folha_ajustes') is not null then
    insert into public.rh_lancamentos (id, correspondente_id, funcionario_id, mes, ano, tipo, valor, descricao,
                                       criado_por, created_at, updated_at)
    select a.id, a.correspondente_id, a.funcionario_id, a.mes, a.ano,
           case when a.tipo = 'provento' then 'outro_provento' else 'desconto' end,
           a.valor, a.descricao, a.criado_por, a.created_at, a.updated_at
      from public.rh_folha_ajustes a
     where a.valor > 0
    on conflict (id) do nothing;
    drop table public.rh_folha_ajustes;
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 4. Permissões: módulos novos, linhas migradas por nível de acesso
-- -----------------------------------------------------------------------------
with mapa(novo_mod, nova_acao, antigos) as (values
  ('rh.folha', 'view', array['rh.previa_folha:view', 'rh.holerites:view', 'rh.adiantamentos:view', 'rh.descontos:view']),
  ('rh.folha', 'edit', array['rh.previa_folha:edit', 'rh.previa_folha:export', 'rh.holerites:create', 'rh.holerites:edit',
                             'rh.adiantamentos:create', 'rh.adiantamentos:edit', 'rh.descontos:create', 'rh.descontos:edit']),
  ('rh.folha', 'gerir', array['rh.previa_folha:edit']),
  ('rh.salarios', 'view', array['rh.salariais:view', 'rh.previa_folha:view', 'rh.holerites:view']),
  ('rh.salarios', 'edit', array['rh.salariais:create', 'rh.salariais:edit']),
  -- A RLS antiga exigia "edit" onde o catálogo dava "create": quem tinha uma ganha a outra.
  ('rh.ocorrencias', 'create', array['rh.ocorrencias:edit']),
  ('rh.ferias', 'create', array['rh.ferias:edit']),
  ('rh.documentos', 'create', array['rh.documentos:edit']),
  ('rh.documentos', 'delete', array['rh.documentos:edit'])
), origem as (
  select p.nivel_acesso_id, m.novo_mod, m.nova_acao, bool_or(p.permitido) as permitido
    from mapa m
    join public.permissions p on (p.modulo || ':' || p.acao) = any (m.antigos)
   group by 1, 2, 3
)
insert into public.permissions (nivel_acesso_id, modulo, acao, permitido)
select nivel_acesso_id, novo_mod, nova_acao, permitido from origem
on conflict (nivel_acesso_id, modulo, acao)
  do update set permitido = public.permissions.permitido or excluded.permitido;

delete from public.permissions
 where modulo in ('rh.previa_folha', 'rh.holerites', 'rh.adiantamentos', 'rh.descontos', 'rh.salariais')
    or (modulo = 'rh.documentos' and acao = 'edit');

-- -----------------------------------------------------------------------------
-- 5. RLS: cada tabela com a permissão certa (mesmas ações do catálogo)
-- -----------------------------------------------------------------------------
alter table public.rh_lancamentos enable row level security;
alter table public.rh_tabelas_fiscais enable row level security;
alter table public.rh_desligamentos enable row level security;
revoke all on public.rh_lancamentos, public.rh_tabelas_fiscais, public.rh_desligamentos from anon;
grant select, insert, update, delete on public.rh_lancamentos, public.rh_tabelas_fiscais, public.rh_desligamentos to authenticated;

do $$
declare
  r record;
begin
  for r in select policyname, tablename from pg_policies
            where schemaname = 'public'
              and tablename in ('rh_alteracoes_salariais', 'rh_adiantamentos', 'rh_dependentes', 'rh_documentos',
                                'rh_documentos_checklist', 'rh_ferias', 'rh_folha_competencias', 'rh_folha_itens',
                                'rh_holerites', 'rh_ocorrencias', 'rh_funcionario_historico', 'rh_lancamentos',
                                'rh_tabelas_fiscais', 'rh_desligamentos')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- Atalho de leitura: empresa da pessoa logada.
-- (correspondente_do_usuario já é SECURITY DEFINER e estável; o "select" vira initplan.)

-- Alterações salariais: só quem vê salário; registrar só quem altera salário.
create policy rh_alt_sal_select on public.rh_alteracoes_salariais for select to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
         and (select public.rh_pode('rh.salarios', 'view')));
create policy rh_alt_sal_mutate on public.rh_alteracoes_salariais for all to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
         and (select public.rh_pode('rh.salarios', 'edit')))
  with check (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
              and (select public.rh_pode('rh.salarios', 'edit')));

-- Adiantamentos e lançamentos: folha.
create policy rh_adi_select on public.rh_adiantamentos for select to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
         and (select public.rh_pode('rh.folha', 'view')));
create policy rh_adi_mutate on public.rh_adiantamentos for all to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
         and (select public.rh_pode('rh.folha', 'edit')))
  with check (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
              and (select public.rh_pode('rh.folha', 'edit')));
create policy rh_lanc_select on public.rh_lancamentos for select to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
         and (select public.rh_pode('rh.folha', 'view')));
create policy rh_lanc_mutate on public.rh_lancamentos for all to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
         and (select public.rh_pode('rh.folha', 'edit')))
  with check (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
              and (select public.rh_pode('rh.folha', 'edit')));

-- Dependentes: ver com a ficha; gravar e apagar só com edição (antes "ver" apagava).
create policy rh_dep_select on public.rh_dependentes for select to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
         and (select public.rh_pode('rh.funcionarios', 'view')));
create policy rh_dep_mutate on public.rh_dependentes for all to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
         and (select public.rh_pode('rh.funcionarios', 'edit')))
  with check (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
              and (select public.rh_pode('rh.funcionarios', 'edit')));

-- Documentos: só quem vê documentos (a ficha sozinha não abre RG, CTPS, exames).
create policy rh_docs_select on public.rh_documentos for select to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
         and (select public.rh_pode('rh.documentos', 'view')));
create policy rh_docs_insert on public.rh_documentos for insert to authenticated
  with check (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
              and (select public.rh_pode('rh.documentos', 'create')));
create policy rh_docs_update on public.rh_documentos for update to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
         and ((select public.rh_pode('rh.documentos', 'create')) or (select public.rh_pode('rh.documentos', 'delete'))))
  with check (correspondente_id = public.correspondente_do_usuario((select auth.uid())));
create policy rh_docs_delete on public.rh_documentos for delete to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
         and (select public.rh_pode('rh.documentos', 'delete')));

-- Checklist de admissão: ver com a ficha ou documentos; marcar com documentos ou edição da ficha.
create policy rh_checklist_select on public.rh_documentos_checklist for select to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
         and ((select public.rh_pode('rh.funcionarios', 'view')) or (select public.rh_pode('rh.documentos', 'view'))));
create policy rh_checklist_mutate on public.rh_documentos_checklist for all to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
         and ((select public.rh_pode('rh.funcionarios', 'edit')) or (select public.rh_pode('rh.documentos', 'create'))))
  with check (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
              and ((select public.rh_pode('rh.funcionarios', 'edit')) or (select public.rh_pode('rh.documentos', 'create'))));

-- Férias: programar = create; aprovar = edit (conferido também no gatilho).
create policy rh_ferias_select on public.rh_ferias for select to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
         and ((select public.rh_pode('rh.ferias', 'view')) or (select public.rh_pode('rh.funcionarios', 'view'))));
create policy rh_ferias_insert on public.rh_ferias for insert to authenticated
  with check (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
              and ((select public.rh_pode('rh.ferias', 'create')) or (select public.rh_pode('rh.ferias', 'edit'))));
create policy rh_ferias_update on public.rh_ferias for update to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
         and ((select public.rh_pode('rh.ferias', 'create')) or (select public.rh_pode('rh.ferias', 'edit'))))
  with check (correspondente_id = public.correspondente_do_usuario((select auth.uid())));
create policy rh_ferias_delete on public.rh_ferias for delete to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
         and (select public.rh_pode('rh.ferias', 'edit')));

-- Competências: totais com "ver folha"; abrir/observar com "lançar"; fechar/reabrir só pelas funções.
create policy rh_folha_select on public.rh_folha_competencias for select to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
         and (select public.rh_pode('rh.folha', 'view')));
create policy rh_folha_mutate on public.rh_folha_competencias for all to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
         and (select public.rh_pode('rh.folha', 'edit')))
  with check (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
              and (select public.rh_pode('rh.folha', 'edit')));

-- Itens da folha: valores por pessoa = salário. Gravação só por rh_fechar_competencia.
create policy rh_folha_it_select on public.rh_folha_itens for select to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
         and (select public.rh_pode('rh.salarios', 'view')));

-- Holerites: quem vê salário, ou o próprio colaborador depois da competência fechada.
create policy rh_hol_select on public.rh_holerites for select to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
         and ((select public.rh_pode('rh.salarios', 'view'))
              or (funcionario_id = (select public.rh_funcionario_do_usuario())
                  and public.rh_mes_fechado_no_intervalo(correspondente_id, make_date(ano, mes, 1), make_date(ano, mes, 1)))));
create policy rh_hol_mutate on public.rh_holerites for all to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
         and (select public.rh_pode('rh.folha', 'edit')) and (select public.rh_pode('rh.salarios', 'view')))
  with check (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
              and (select public.rh_pode('rh.folha', 'edit')) and (select public.rh_pode('rh.salarios', 'view')));

-- Ocorrências (atestado traz CID): só quem vê ocorrências.
create policy rh_ocor_select on public.rh_ocorrencias for select to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
         and (select public.rh_pode('rh.ocorrencias', 'view')));
create policy rh_ocor_mutate on public.rh_ocorrencias for all to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
         and ((select public.rh_pode('rh.ocorrencias', 'create')) or (select public.rh_pode('rh.ocorrencias', 'edit'))))
  with check (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
              and ((select public.rh_pode('rh.ocorrencias', 'create')) or (select public.rh_pode('rh.ocorrencias', 'edit'))));

-- Histórico: linha de campo sensível só para quem vê salário.
create policy rh_hist_select on public.rh_funcionario_historico for select to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
         and (select public.rh_pode('rh.funcionarios', 'view'))
         and (campo not in ('salario_atual', 'salario_desde', 'banco_nome', 'banco_agencia', 'banco_conta',
                            'banco_tipo_conta', 'banco_pix')
              or (select public.rh_pode('rh.salarios', 'view'))));

-- Tabelas fiscais: todos da empresa leem (não é dado pessoal); só a vigência própria é editável.
create policy rh_tab_fisc_select on public.rh_tabelas_fiscais for select to authenticated
  using (correspondente_id is null or correspondente_id = public.correspondente_do_usuario((select auth.uid())));
create policy rh_tab_fisc_mutate on public.rh_tabelas_fiscais for all to authenticated
  using (correspondente_id is not null
         and correspondente_id = public.correspondente_do_usuario((select auth.uid()))
         and (select public.rh_pode('rh.configuracoes', 'edit')))
  with check (correspondente_id is not null
              and correspondente_id = public.correspondente_do_usuario((select auth.uid()))
              and (select public.rh_pode('rh.configuracoes', 'edit')));

-- Desligamentos: com a ficha.
create policy rh_desl_select on public.rh_desligamentos for select to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
         and (select public.rh_pode('rh.funcionarios', 'view')));
create policy rh_desl_mutate on public.rh_desligamentos for all to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
         and (select public.rh_pode('rh.funcionarios', 'edit')))
  with check (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
              and (select public.rh_pode('rh.funcionarios', 'edit')));

-- -----------------------------------------------------------------------------
-- 6. Colunas sensíveis de rh_funcionarios: fora do SELECT direto
-- -----------------------------------------------------------------------------
do $$
declare
  v_cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'rh_funcionarios'
     and column_name not in ('salario_atual', 'salario_desde', 'banco_nome', 'banco_agencia', 'banco_conta',
                             'banco_tipo_conta', 'banco_pix');
  execute 'revoke select on public.rh_funcionarios from authenticated, anon';
  execute format('grant select (%s) on public.rh_funcionarios to authenticated', v_cols);
end $$;
comment on column public.rh_funcionarios.salario_atual is
  'Sensível: fora do SELECT de authenticated. Leitura por rh_dados_sensiveis (rh.salarios:view); gravação exige rh.salarios:edit (gatilho).';

/** Salário e dados bancários de funcionários da empresa — só com rh.salarios:view. */
create or replace function public.rh_dados_sensiveis(p_ids uuid[])
returns table (funcionario_id uuid, salario_atual numeric, salario_desde date, banco_nome text,
               banco_agencia text, banco_conta text, banco_tipo_conta text, banco_pix text)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.rh_pode('rh.salarios', 'view') then
    raise exception 'Você não tem permissão para ver salários e dados bancários.' using errcode = '42501';
  end if;
  if coalesce(cardinality(p_ids), 0) > 5000 then
    raise exception 'Peça no máximo 5.000 funcionários por vez.' using errcode = '22023';
  end if;
  return query
    select f.id, f.salario_atual, f.salario_desde, f.banco_nome, f.banco_agencia, f.banco_conta,
           f.banco_tipo_conta, f.banco_pix
      from public.rh_funcionarios f
     where f.id = any (p_ids)
       and f.correspondente_id = public.correspondente_do_usuario(auth.uid());
end $$;
revoke all on function public.rh_dados_sensiveis(uuid[]) from public, anon;
grant execute on function public.rh_dados_sensiveis(uuid[]) to authenticated;

-- -----------------------------------------------------------------------------
-- 7. Gatilhos: dado sensível, competência fechada, aprovação de férias, empresa
-- -----------------------------------------------------------------------------

/** Salário e banco só mudam com rh.salarios:edit (sistema sem usuário passa). */
create or replace function public.rh_funcionario_guardar_sensivel()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is null or public.rh_pode('rh.salarios', 'edit') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if coalesce(new.salario_atual, 0) <> 0 or nullif(btrim(coalesce(new.banco_nome, '')), '') is not null
       or nullif(btrim(coalesce(new.banco_agencia, '')), '') is not null
       or nullif(btrim(coalesce(new.banco_conta, '')), '') is not null
       or nullif(btrim(coalesce(new.banco_pix, '')), '') is not null then
      raise exception 'Você não tem permissão para informar salário ou dados bancários.' using errcode = '42501';
    end if;
  elsif new.salario_atual is distinct from old.salario_atual
     or new.salario_desde is distinct from old.salario_desde
     or new.banco_nome is distinct from old.banco_nome
     or new.banco_agencia is distinct from old.banco_agencia
     or new.banco_conta is distinct from old.banco_conta
     or new.banco_tipo_conta is distinct from old.banco_tipo_conta
     or new.banco_pix is distinct from old.banco_pix then
    raise exception 'Você não tem permissão para alterar salário ou dados bancários.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists rh_funcionario_guardar_sensivel on public.rh_funcionarios;
create trigger rh_funcionario_guardar_sensivel before insert or update on public.rh_funcionarios
  for each row execute function public.rh_funcionario_guardar_sensivel();

/** Lançamento e desligamento só para funcionário da mesma empresa da linha. */
create or replace function public.rh_conferir_empresa_funcionario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.rh_funcionarios f
                  where f.id = new.funcionario_id and f.correspondente_id = new.correspondente_id) then
    raise exception 'Funcionário não encontrado nesta empresa.' using errcode = '23503';
  end if;
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists rh_lanc_empresa on public.rh_lancamentos;
create trigger rh_lanc_empresa before insert or update on public.rh_lancamentos
  for each row execute function public.rh_conferir_empresa_funcionario();
drop trigger if exists rh_desl_empresa on public.rh_desligamentos;
create trigger rh_desl_empresa before insert or update on public.rh_desligamentos
  for each row execute function public.rh_conferir_empresa_funcionario();

/** Competência fechada é imutável (só as funções de fechar/reabrir mexem, com a marca da transação). */
create or replace function public.rh_travar_competencia_fechada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_msg constant text := 'A competência %s está fechada. Reabra a competência para alterar.';
  v_corr uuid;
  v_ini date;
  v_fim date;
begin
  if current_setting('rh.folha_rpc', true) = 'on' then
    return coalesce(new, old);
  end if;

  if tg_table_name = 'rh_lancamentos' then
    if tg_op <> 'INSERT' and public.rh_mes_fechado_no_intervalo(old.correspondente_id, make_date(old.ano, old.mes, 1), make_date(old.ano, old.mes, 1)) then
      raise exception using message = format(v_msg, lpad(old.mes::text, 2, '0') || '/' || old.ano), errcode = '55000';
    end if;
    if tg_op <> 'DELETE' and public.rh_mes_fechado_no_intervalo(new.correspondente_id, make_date(new.ano, new.mes, 1), make_date(new.ano, new.mes, 1)) then
      raise exception using message = format(v_msg, lpad(new.mes::text, 2, '0') || '/' || new.ano), errcode = '55000';
    end if;

  elsif tg_table_name = 'rh_adiantamentos' then
    -- Mudar só a situação (pago, descontado) depois do fechamento continua possível.
    if tg_op = 'UPDATE' and new.valor is not distinct from old.valor
       and new.competencia_mes is not distinct from old.competencia_mes
       and new.competencia_ano is not distinct from old.competencia_ano
       and new.funcionario_id is not distinct from old.funcionario_id then
      return new;
    end if;
    if tg_op <> 'INSERT' and public.rh_mes_fechado_no_intervalo(old.correspondente_id, make_date(old.competencia_ano, old.competencia_mes, 1), make_date(old.competencia_ano, old.competencia_mes, 1)) then
      raise exception using message = format(v_msg, lpad(old.competencia_mes::text, 2, '0') || '/' || old.competencia_ano), errcode = '55000';
    end if;
    if tg_op <> 'DELETE' and public.rh_mes_fechado_no_intervalo(new.correspondente_id, make_date(new.competencia_ano, new.competencia_mes, 1), make_date(new.competencia_ano, new.competencia_mes, 1)) then
      raise exception using message = format(v_msg, lpad(new.competencia_mes::text, 2, '0') || '/' || new.competencia_ano), errcode = '55000';
    end if;

  elsif tg_table_name = 'rh_ocorrencias' then
    -- Só as que mexem na folha (falta e atestado); advertência e elogio não travam.
    if tg_op <> 'INSERT' and old.tipo in ('falta', 'atestado')
       and public.rh_mes_fechado_no_intervalo(old.correspondente_id, old.data_inicio, coalesce(old.data_fim, old.data_inicio)) then
      raise exception using message = format(v_msg, to_char(old.data_inicio, 'MM/YYYY')), errcode = '55000';
    end if;
    if tg_op <> 'DELETE' and new.tipo in ('falta', 'atestado')
       and public.rh_mes_fechado_no_intervalo(new.correspondente_id, new.data_inicio, coalesce(new.data_fim, new.data_inicio)) then
      raise exception using message = format(v_msg, to_char(new.data_inicio, 'MM/YYYY')), errcode = '55000';
    end if;

  elsif tg_table_name = 'rh_folha_itens' then
    select c.correspondente_id into v_corr from public.rh_folha_competencias c
     where c.id = coalesce(new.competencia_id, old.competencia_id) and c.status = 'fechada';
    if v_corr is not null then
      raise exception 'Os itens de uma competência fechada não mudam. Reabra a competência.' using errcode = '55000';
    end if;
    if tg_op = 'UPDATE' and old.competencia_id is distinct from new.competencia_id
       and exists (select 1 from public.rh_folha_competencias c where c.id = old.competencia_id and c.status = 'fechada') then
      raise exception 'Os itens de uma competência fechada não mudam. Reabra a competência.' using errcode = '55000';
    end if;

  elsif tg_table_name = 'rh_folha_competencias' then
    if tg_op = 'DELETE' then
      if old.status = 'fechada' then
        raise exception 'Uma competência fechada não pode ser apagada.' using errcode = '55000';
      end if;
    elsif tg_op = 'INSERT' then
      if new.status = 'fechada' then
        raise exception 'Para fechar a competência use "Fechar competência".' using errcode = '55000';
      end if;
    elsif old.status = 'fechada' or new.status = 'fechada' then
      raise exception 'Fechar e reabrir a competência só por "Fechar competência" e "Reabrir" (permissão RH · Folha · fechar).' using errcode = '55000';
    end if;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists rh_lanc_travar on public.rh_lancamentos;
create trigger rh_lanc_travar before insert or update or delete on public.rh_lancamentos
  for each row execute function public.rh_travar_competencia_fechada();
drop trigger if exists rh_adi_travar on public.rh_adiantamentos;
create trigger rh_adi_travar before insert or update or delete on public.rh_adiantamentos
  for each row execute function public.rh_travar_competencia_fechada();
drop trigger if exists rh_ocor_travar on public.rh_ocorrencias;
create trigger rh_ocor_travar before insert or update or delete on public.rh_ocorrencias
  for each row execute function public.rh_travar_competencia_fechada();
drop trigger if exists rh_folha_it_travar on public.rh_folha_itens;
create trigger rh_folha_it_travar before insert or update or delete on public.rh_folha_itens
  for each row execute function public.rh_travar_competencia_fechada();
drop trigger if exists rh_folha_comp_travar on public.rh_folha_competencias;
create trigger rh_folha_comp_travar before insert or update or delete on public.rh_folha_competencias
  for each row execute function public.rh_travar_competencia_fechada();

/** Aprovar (ou pôr em curso/concluir) férias exige rh.ferias:edit; registra quem aprovou. */
create or replace function public.rh_ferias_conferir_aprovacao()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status in ('aprovada', 'em_curso', 'concluida')
     and (tg_op = 'INSERT' or old.status is distinct from new.status)
     and auth.uid() is not null then
    if not public.rh_pode('rh.ferias', 'edit') then
      raise exception 'Só quem aprova férias (RH · Férias · aprovar) pode mudar para "%".', new.status using errcode = '42501';
    end if;
    if new.status = 'aprovada' then
      new.aprovado_por := auth.uid();
      new.aprovado_em := now();
    end if;
  end if;
  if tg_op = 'UPDATE' and old.status in ('aprovada', 'em_curso', 'concluida') and auth.uid() is not null
     and not public.rh_pode('rh.ferias', 'edit')
     and (new.data_inicio is distinct from old.data_inicio or new.data_fim is distinct from old.data_fim
          or new.dias_gozados is distinct from old.dias_gozados or new.abono_dias is distinct from old.abono_dias) then
    raise exception 'Férias aprovadas só mudam com a permissão de aprovar.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists rh_ferias_aprovacao on public.rh_ferias;
create trigger rh_ferias_aprovacao before insert or update on public.rh_ferias
  for each row execute function public.rh_ferias_conferir_aprovacao();

-- -----------------------------------------------------------------------------
-- 8. Fechar e reabrir a competência (atômico, no banco)
-- -----------------------------------------------------------------------------

/**
 * Fecha a competência com os itens calculados pelo motor da folha (servidor): grava os
 * itens, os totais, a situação "fechada" e as contas a pagar de quem tem a marca na ficha —
 * tudo ou nada. Exige rh.folha:gerir e rh.salarios:view.
 */
create or replace function public.rh_fechar_competencia(p_ano integer, p_mes integer, p_itens jsonb,
                                                        p_vencimento date, p_observacoes text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_corr uuid := public.correspondente_do_usuario(auth.uid());
  v_comp public.rh_folha_competencias%rowtype;
  v_qtd int;
  v_contas int := 0;
  v_tot record;
begin
  if not public.rh_pode('rh.folha', 'gerir') or not public.rh_pode('rh.salarios', 'view') then
    raise exception 'Fechar a competência exige as permissões RH · Folha · fechar e RH · Salários · ver.' using errcode = '42501';
  end if;
  if v_corr is null then
    raise exception 'Seu usuário não está vinculado a uma empresa.' using errcode = '42501';
  end if;
  if p_mes not between 1 and 12 or p_ano not between 2020 and 2100 then
    raise exception 'Competência inválida.' using errcode = '22023';
  end if;
  if p_vencimento is null then
    raise exception 'Informe o vencimento das contas da folha.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Não há funcionários para fechar nesta competência.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_itens) > 5000 then
    raise exception 'Itens demais para uma competência.' using errcode = '22023';
  end if;

  -- Cada item: funcionário desta empresa, uma vez só, valores numéricos e não negativos.
  select count(*) into v_qtd
    from jsonb_array_elements(p_itens) i
    left join public.rh_funcionarios f
      on f.id = (i ->> 'funcionario_id')::uuid and f.correspondente_id = v_corr and f.deletado_em is null
   where f.id is null;
  if v_qtd > 0 then
    raise exception 'Há funcionário que não é desta empresa na folha.' using errcode = '42501';
  end if;
  if (select count(distinct i ->> 'funcionario_id') from jsonb_array_elements(p_itens) i) <> jsonb_array_length(p_itens) then
    raise exception 'Funcionário repetido na folha.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_array_elements(p_itens) i
              where coalesce((i ->> 'salario_base')::numeric, -1) < 0
                 or coalesce((i ->> 'proventos')::numeric, -1) < 0
                 or coalesce((i ->> 'descontos')::numeric, -1) < 0
                 or (i ->> 'liquido') is null) then
    raise exception 'Valores inválidos na folha.' using errcode = '22023';
  end if;

  perform set_config('rh.folha_rpc', 'on', true);

  insert into public.rh_folha_competencias (correspondente_id, mes, ano, status)
  values (v_corr, p_mes, p_ano, 'aberta')
  on conflict (correspondente_id, ano, mes) do nothing;
  select * into v_comp from public.rh_folha_competencias
   where correspondente_id = v_corr and ano = p_ano and mes = p_mes
   for update;
  if v_comp.status = 'fechada' then
    perform set_config('rh.folha_rpc', '', true);
    raise exception 'A competência %/% já está fechada.', lpad(p_mes::text, 2, '0'), p_ano using errcode = '55000';
  end if;

  delete from public.rh_folha_itens where competencia_id = v_comp.id;
  insert into public.rh_folha_itens (correspondente_id, competencia_id, funcionario_id, salario_base,
                                     total_beneficios, total_descontos, total_adiantamentos, liquido, detalhamento)
  select v_corr, v_comp.id, (i ->> 'funcionario_id')::uuid,
         round((i ->> 'salario_base')::numeric, 2),
         round(coalesce((i ->> 'total_beneficios')::numeric, 0), 2),
         round(coalesce((i ->> 'descontos')::numeric, 0), 2),
         round(coalesce((i ->> 'total_adiantamentos')::numeric, 0), 2),
         round((i ->> 'liquido')::numeric, 2),
         coalesce(i -> 'detalhamento', '{}'::jsonb)
    from jsonb_array_elements(p_itens) i;

  select round(coalesce(sum((i ->> 'proventos')::numeric), 0), 2) as proventos,
         round(coalesce(sum((i ->> 'descontos')::numeric), 0), 2) as descontos,
         round(coalesce(sum((i ->> 'liquido')::numeric), 0), 2) as liquido
    into v_tot
    from jsonb_array_elements(p_itens) i;

  update public.rh_folha_competencias
     set status = 'fechada', total_proventos = v_tot.proventos, total_descontos = v_tot.descontos,
         total_liquido = v_tot.liquido, observacoes = coalesce(nullif(btrim(p_observacoes), ''), observacoes),
         fechada_por = auth.uid(), fechada_em = now(), updated_at = now()
   where id = v_comp.id;

  insert into public.financial_payables (correspondente_id, descricao, fornecedor, vencimento, valor, status,
                                         origem_tipo, origem_ref, criador_id)
  select v_corr, format('Folha %s/%s · %s', lpad(p_mes::text, 2, '0'), p_ano, f.nome), f.nome, p_vencimento,
         round((i ->> 'liquido')::numeric, 2), 'aberta', 'rh_folha', v_comp.id::text, auth.uid()
    from jsonb_array_elements(p_itens) i
    join public.rh_funcionarios f on f.id = (i ->> 'funcionario_id')::uuid
   where (i ->> 'liquido')::numeric > 0 and f.gerar_contas_pagar_automatico;
  get diagnostics v_contas = row_count;

  perform set_config('rh.folha_rpc', '', true);
  return jsonb_build_object('competencia_id', v_comp.id, 'total', v_tot.liquido, 'contas', v_contas,
                            'itens', jsonb_array_length(p_itens));
end $$;

/** Reabre a competência (rh.folha:gerir): apaga os itens e as contas da folha ainda não pagas. */
create or replace function public.rh_reabrir_competencia(p_ano integer, p_mes integer, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_corr uuid := public.correspondente_do_usuario(auth.uid());
  v_comp public.rh_folha_competencias%rowtype;
  v_contas int;
begin
  if not public.rh_pode('rh.folha', 'gerir') then
    raise exception 'Reabrir a competência exige a permissão RH · Folha · fechar.' using errcode = '42501';
  end if;
  if nullif(btrim(coalesce(p_motivo, '')), '') is null or length(btrim(p_motivo)) < 5 then
    raise exception 'Diga o motivo da reabertura (mínimo 5 letras).' using errcode = '22023';
  end if;
  select * into v_comp from public.rh_folha_competencias
   where correspondente_id = v_corr and ano = p_ano and mes = p_mes
   for update;
  if v_comp.id is null or v_comp.status <> 'fechada' then
    raise exception 'A competência %/% não está fechada.', lpad(p_mes::text, 2, '0'), p_ano using errcode = '55000';
  end if;
  if exists (select 1 from public.financial_payables p
              where p.origem_tipo = 'rh_folha' and p.origem_ref = v_comp.id::text
                and (p.status in ('paga', 'parcial') or coalesce(p.valor_pago, 0) > 0)) then
    raise exception 'Há salário desta folha já pago no Financeiro. Estorne o pagamento antes de reabrir.' using errcode = '55000';
  end if;

  perform set_config('rh.folha_rpc', 'on', true);
  delete from public.financial_payables p where p.origem_tipo = 'rh_folha' and p.origem_ref = v_comp.id::text;
  get diagnostics v_contas = row_count;
  delete from public.rh_folha_itens where competencia_id = v_comp.id;
  update public.rh_folha_competencias
     set status = 'aberta', fechada_por = null, fechada_em = null, updated_at = now(),
         observacoes = left(concat_ws(E'\n', observacoes,
                         format('Reaberta em %s: %s', to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'), btrim(p_motivo))), 2000)
   where id = v_comp.id;
  perform set_config('rh.folha_rpc', '', true);
  return jsonb_build_object('competencia_id', v_comp.id, 'contas_removidas', v_contas);
end $$;

revoke all on function public.rh_fechar_competencia(integer, integer, jsonb, date, text),
  public.rh_reabrir_competencia(integer, integer, text) from public, anon;
grant execute on function public.rh_fechar_competencia(integer, integer, jsonb, date, text),
  public.rh_reabrir_competencia(integer, integer, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 9. Área do colaborador
-- -----------------------------------------------------------------------------

/** "Meu RH": a própria ficha (sem dados de terceiros), holerites publicados e férias. */
create or replace function public.rh_meu_resumo()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_func uuid := public.rh_funcionario_do_usuario();
  v jsonb;
begin
  if auth.uid() is null then
    raise exception 'Entre para ver o seu RH.' using errcode = '42501';
  end if;
  if v_func is null then
    return jsonb_build_object('funcionario', null, 'holerites', '[]'::jsonb, 'ferias', '[]'::jsonb, 'faltas', '[]'::jsonb);
  end if;
  select jsonb_build_object(
    'funcionario', (
      select jsonb_build_object('id', f.id, 'numero', f.numero, 'nome', f.nome, 'status', f.status,
               'tipo_contrato', f.tipo_contrato, 'data_admissao', f.data_admissao, 'data_demissao', f.data_demissao,
               'email_corporativo', f.email_corporativo, 'jornada_descricao', f.jornada_descricao,
               'cargo', c.nome, 'departamento', d.nome, 'foto_url', f.foto_url)
        from public.rh_funcionarios f
        left join public.rh_cargos c on c.id = f.cargo_id
        left join public.rh_departamentos d on d.id = f.departamento_id
       where f.id = v_func),
    'holerites', coalesce((
      select jsonb_agg(jsonb_build_object('id', h.id, 'mes', h.mes, 'ano', h.ano, 'valor_liquido', h.valor_liquido,
                         'arquivo_path', h.arquivo_path, 'arquivo_nome', h.arquivo_nome) order by h.ano desc, h.mes desc)
        from public.rh_holerites h
       where h.funcionario_id = v_func
         and public.rh_mes_fechado_no_intervalo(h.correspondente_id, make_date(h.ano, h.mes, 1), make_date(h.ano, h.mes, 1))), '[]'::jsonb),
    'ferias', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'periodo_aquisitivo_inicio', r.periodo_aquisitivo_inicio,
                         'periodo_aquisitivo_fim', r.periodo_aquisitivo_fim, 'data_inicio', r.data_inicio,
                         'data_fim', r.data_fim, 'dias_gozados', r.dias_gozados, 'abono_dias', r.abono_dias,
                         'status', r.status) order by r.periodo_aquisitivo_inicio desc)
        from public.rh_ferias r where r.funcionario_id = v_func), '[]'::jsonb),
    'faltas', coalesce((
      select jsonb_agg(jsonb_build_object('data_inicio', o.data_inicio, 'dias', o.dias, 'abonada', o.abonada))
        from public.rh_ocorrencias o where o.funcionario_id = v_func and o.tipo = 'falta'), '[]'::jsonb))
  into v;
  return v;
end $$;

/** O arquivo é o holerite publicado do próprio usuário? (política do bucket) */
create or replace function public.rh_holerite_do_usuario(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.rh_holerites h
      join public.rh_funcionarios f on f.id = h.funcionario_id
     where h.arquivo_path = p_path and f.user_id = auth.uid() and f.deletado_em is null
       and public.rh_mes_fechado_no_intervalo(h.correspondente_id, make_date(h.ano, h.mes, 1), make_date(h.ano, h.mes, 1)))
$$;

/**
 * Faltas para o saldo de férias (CLT art. 130): só data, dias e abono — sem CID nem
 * justificativa. Quem vê férias ou a ficha precisa delas sem abrir as ocorrências.
 */
create or replace function public.rh_faltas_para_ferias(p_ids uuid[])
returns table (funcionario_id uuid, data_inicio date, dias integer, abonada boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.rh_pode('rh.ferias', 'view') or public.rh_pode('rh.funcionarios', 'view')
          or public.rh_pode('rh.ocorrencias', 'view')) then
    raise exception 'Você não tem permissão para ver férias.' using errcode = '42501';
  end if;
  return query
    select o.funcionario_id, o.data_inicio, o.dias, o.abonada
      from public.rh_ocorrencias o
     where o.funcionario_id = any (p_ids) and o.tipo = 'falta'
       and o.correspondente_id = public.correspondente_do_usuario(auth.uid());
end $$;

/**
 * Contagens do painel de RH (só números da empresa, nenhum dado de pessoa): dias de falta e
 * de atestado no intervalo (absenteísmo) e documentos vencidos/vencendo em 30 dias.
 */
create or replace function public.rh_painel_contagens(p_ini date, p_fim date)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_corr uuid := public.correspondente_do_usuario(auth.uid());
begin
  if not public.rh_pode('rh.dashboard', 'view') then
    raise exception 'Você não tem permissão para o painel de RH.' using errcode = '42501';
  end if;
  if p_ini is null or p_fim is null or p_fim < p_ini or p_fim - p_ini > 400 then
    raise exception 'Intervalo inválido.' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'faltas_dias', coalesce((
      select sum(least(coalesce(o.data_fim, o.data_inicio), p_fim) - greatest(o.data_inicio, p_ini) + 1)
        from public.rh_ocorrencias o
       where o.correspondente_id = v_corr and o.tipo = 'falta' and not o.abonada
         and o.data_inicio <= p_fim and coalesce(o.data_fim, o.data_inicio) >= p_ini), 0),
    'atestados_dias', coalesce((
      select sum(least(coalesce(o.data_fim, o.data_inicio), p_fim) - greatest(o.data_inicio, p_ini) + 1)
        from public.rh_ocorrencias o
       where o.correspondente_id = v_corr and o.tipo = 'atestado'
         and o.data_inicio <= p_fim and coalesce(o.data_fim, o.data_inicio) >= p_ini), 0),
    'documentos_vencidos', (
      select count(*) from public.rh_documentos d
       where d.correspondente_id = v_corr and d.ativo and d.validade < current_date),
    'documentos_vencendo', (
      select count(*) from public.rh_documentos d
       where d.correspondente_id = v_corr and d.ativo
         and d.validade between current_date and current_date + 30),
    'checklist_pendentes', (
      select count(*) from public.rh_documentos_checklist c
        join public.rh_funcionarios f on f.id = c.funcionario_id and f.deletado_em is null and f.status <> 'desligado'
       where c.correspondente_id = v_corr and c.obrigatorio and c.status <> 'entregue'));
end $$;

revoke all on function public.rh_meu_resumo(), public.rh_holerite_do_usuario(text),
  public.rh_faltas_para_ferias(uuid[]), public.rh_painel_contagens(date, date) from public, anon;
grant execute on function public.rh_meu_resumo(), public.rh_holerite_do_usuario(text),
  public.rh_faltas_para_ferias(uuid[]), public.rh_painel_contagens(date, date) to authenticated;

-- -----------------------------------------------------------------------------
-- 10. Bucket rh-documentos: cada pasta com a sua permissão
--     <empresa>/holerites/…  → rh.salarios:view (ou o dono, competência fechada)
--     <empresa>/fotos/…      → rh.funcionarios
--     <empresa>/<func>/…     → rh.documentos
-- -----------------------------------------------------------------------------
drop policy if exists rh_docs_bucket_select on storage.objects;
drop policy if exists rh_docs_bucket_insert on storage.objects;
drop policy if exists rh_docs_bucket_update on storage.objects;
drop policy if exists rh_docs_bucket_delete on storage.objects;

create policy rh_docs_bucket_select on storage.objects for select to authenticated
  using (bucket_id = 'rh-documentos'
         and (storage.foldername(name))[1] = public.correspondente_do_usuario(auth.uid())::text
         and case (storage.foldername(name))[2]
               when 'holerites' then public.rh_pode('rh.salarios', 'view') or public.rh_holerite_do_usuario(name)
               when 'fotos' then public.rh_pode('rh.funcionarios', 'view')
               else public.rh_pode('rh.documentos', 'view')
             end);
create policy rh_docs_bucket_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'rh-documentos'
              and (storage.foldername(name))[1] = public.correspondente_do_usuario(auth.uid())::text
              and case (storage.foldername(name))[2]
                    when 'holerites' then public.rh_pode('rh.folha', 'edit') and public.rh_pode('rh.salarios', 'view')
                    when 'fotos' then public.rh_pode('rh.funcionarios', 'edit') or public.rh_pode('rh.funcionarios', 'create')
                    else public.rh_pode('rh.documentos', 'create')
                  end);
create policy rh_docs_bucket_update on storage.objects for update to authenticated
  using (bucket_id = 'rh-documentos'
         and (storage.foldername(name))[1] = public.correspondente_do_usuario(auth.uid())::text
         and case (storage.foldername(name))[2]
               when 'holerites' then public.rh_pode('rh.folha', 'edit') and public.rh_pode('rh.salarios', 'view')
               when 'fotos' then public.rh_pode('rh.funcionarios', 'edit')
               else public.rh_pode('rh.documentos', 'create')
             end);
create policy rh_docs_bucket_delete on storage.objects for delete to authenticated
  using (bucket_id = 'rh-documentos'
         and (storage.foldername(name))[1] = public.correspondente_do_usuario(auth.uid())::text
         and case (storage.foldername(name))[2]
               when 'holerites' then public.rh_pode('rh.folha', 'edit') and public.rh_pode('rh.salarios', 'view')
               when 'fotos' then public.rh_pode('rh.funcionarios', 'edit')
               else public.rh_pode('rh.documentos', 'delete')
             end);
