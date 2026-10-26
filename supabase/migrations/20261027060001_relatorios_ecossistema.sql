-- =============================================================================
-- Relatórios gerenciais do ecossistema (frente a6, pedido do dono de 26/10/2026, C47).
--
-- Os relatórios antigos baixavam milhares de linhas pelo PostgREST e somavam no servidor
-- (com teto e erro quando passava). Agora o banco entrega a parte do Agilliza JÁ AGREGADA,
-- num cubo pequeno no mesmo formato que a parte do Agilliza Tech (plataforma.relatorio_ecossistema,
-- migração 0335 de lá); o servidor do Agilliza soma as duas e recorta por mês, conta, banco e
-- usuário (funil, conversão, tempo por etapa, rankings, comparativo e relatórios personalizados).
--
--   public.relatorio_eco_agilliza(p_filtros jsonb)  → {"fatos":[…],"anterior":{…},"gargalos":[…],"escopo":…}
--   public.relatorio_operacional_agilliza(p_filtros jsonb) → SLA de propostas, demandas e tarefas
--
-- Regras do Agilliza (as MESMAS do Painel geral, src/lib/relatorios/producao-ecossistema.functions.ts):
--   · simulações e propostas (fora do rascunho) pela data de criação; crédito aprovado = proposta
--     criada no período com status do grupo "aprovadas" (src/lib/propostas/status-grupos.ts);
--     aguardando contrato = aprovada ainda sem contrato emitido/registrado;
--   · contrato emitido = data de emissão na ficha do cliente (clientes.contrato_emitido_em), só
--     com proposta em contrato emitido/registrado; registrado = alguma registrada; valor = o
--     aprovado (ou pedido) da proposta do contrato, o maior quando houver mais de uma;
--   · tempo por etapa: criação → primeira aprovação (proposta_historico), aprovação → contrato,
--     contrato → registro (contrato_registrado_em). Soma e quantidade, para a média ponderada.
-- Permissão: relatorios.geral (ver). "Geral" e filtro por outra pessoa exigem escopo de equipe
-- ou de todos (can_view_team_reports); sem isso o banco devolve só o que é da própria pessoa
-- (responsável ou criador) e diz isso em "escopo". Empresa sempre a do usuário.
-- =============================================================================

-- Chave do banco a partir do nome gravado na proposta ("Itaú Unibanco" → itau), igual aos ids
-- do Agilliza Tech (operacional.bancos), para o filtro e o recorte por banco valerem nos dois.
create or replace function public.banco_chave(_nome text)
returns text
language sql
immutable
parallel safe
set search_path = pg_catalog
as $$
  select case
    when n is null or n = '' then null
    when n like '%caixa%' or n like '%cef%' then 'caixa'
    when n like '%itau%' then 'itau'
    when n like '%bradesco%' then 'bradesco'
    when n like '%santander%' then 'santander'
    when n like '%inter%' then 'inter'
    when n like '%brasil%' or n = 'bb' then 'bb'
    when n like '%btg%' then 'btg'
    else left(regexp_replace(n, '[^a-z0-9]+', '_', 'g'), 30)
  end
  from (select lower(translate(btrim(coalesce(_nome, '')), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç',
                                                         'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc')) as n) x
$$;
revoke all on function public.banco_chave(text) from public, anon;
grant execute on function public.banco_chave(text) to authenticated;

-- -----------------------------------------------------------------------------
-- Leitura comum dos filtros (datas, escopo, pessoa, banco) com a permissão conferida.
-- -----------------------------------------------------------------------------
create or replace function public._relatorio_contexto(p_filtros jsonb,
  out uid uuid, out corr uuid, out geral boolean, out usuario uuid, out banco text,
  out de date, out ate date, out ant_de date, out ant_ate date)
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  f jsonb := coalesce(p_filtros, '{}');
  v_quer_geral boolean;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'Faça login para ver os relatórios.' using errcode = '42501';
  end if;
  if not public.usuario_tem_permissao(uid, 'relatorios.geral', 'view') then
    raise exception 'Você não tem permissão para ver os relatórios gerenciais.' using errcode = '42501';
  end if;
  corr := public.correspondente_do_usuario(uid);
  if corr is null then
    raise exception 'Seu usuário não está ligado a uma empresa.' using errcode = '42501';
  end if;
  begin
    de := (f ->> 'de')::date;
    ate := (f ->> 'ate')::date;
    ant_de := nullif(f ->> 'anterior_de', '')::date;
    ant_ate := nullif(f ->> 'anterior_ate', '')::date;
    usuario := nullif(f ->> 'usuario', '')::uuid;
  exception when others then
    raise exception 'Filtro inválido.' using errcode = '22023';
  end;
  if de is null or ate is null or de > ate or ate - de > 400 then
    raise exception 'Período inválido (até 400 dias).' using errcode = '22023';
  end if;
  if ant_de is null or ant_ate is null then
    ant_ate := de - 1;
    ant_de := ant_ate - (ate - de);
  end if;
  if ant_de > ant_ate or ant_ate - ant_de > 400 then
    raise exception 'Período anterior inválido.' using errcode = '22023';
  end if;
  banco := nullif(btrim(coalesce(f ->> 'banco', '')), '');
  if banco is not null and banco !~ '^[a-z_]{2,30}$' then
    raise exception 'Banco inválido.' using errcode = '22023';
  end if;
  v_quer_geral := coalesce(f ->> 'escopo', 'minha') = 'geral' or (usuario is not null and usuario <> uid);
  geral := v_quer_geral and public.can_view_team_reports(uid);
  -- Sem permissão de ver os outros: só o que é da pessoa (e nunca o de outra pessoa).
  if not geral and usuario is not null and usuario <> uid then
    usuario := uid;
  end if;
end $$;
revoke all on function public._relatorio_contexto(jsonb) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Produção do Agilliza em cubo (mês × banco × usuário), período atual + totais do anterior.
-- -----------------------------------------------------------------------------
create or replace function public.relatorio_eco_agilliza(p_filtros jsonb default '{}')
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  c record;
  v_aprov constant text[] := array['credito_aprovado','credito_condicionado','checklist_documentacao',
    'cadastro_complementar','dossie_completo','formularios','envio_documentos_banco','vistoria_agendamento',
    'vistoria_concluida','emissao_contrato','contrato_emitido','aguardando_documentos','engenharia_vistoria',
    'analise_juridica','registrado'];
  v_final constant text[] := array['rascunho','registrado','cancelada','credito_recusado'];
  resultado jsonb;
begin
  select * into c from public._relatorio_contexto(p_filtros);

  with janelas(periodo, de, ate) as (
    values ('atual', c.de, c.ate), ('anterior', c.ant_de, c.ant_ate)
  ), sims as (
    select j.periodo, (s.created_at at time zone 'America/Sao_Paulo')::date as dia,
           coalesce(s.usuario_responsavel_id, s.usuario_criador_id) as usuario, s.parceiro_id
      from janelas j
      join public.simulacoes s
        on s.created_at >= j.de::timestamp at time zone 'America/Sao_Paulo'
       and s.created_at < (j.ate + 1)::timestamp at time zone 'America/Sao_Paulo'
     where s.correspondente_id = c.corr and s.deleted_at is null
       and (c.geral or s.usuario_responsavel_id = c.uid or s.usuario_criador_id = c.uid)
       and (c.usuario is null or coalesce(s.usuario_responsavel_id, s.usuario_criador_id) = c.usuario)
       and (c.banco is null or exists (select 1 from public.simulacao_bancos sb
                                        where sb.simulacao_id = s.id and public.banco_chave(sb.nome_banco) = c.banco))
  ), props as (
    select j.periodo, (p.created_at at time zone 'America/Sao_Paulo')::date as dia,
           coalesce(p.usuario_responsavel_id, p.usuario_criador_id) as usuario,
           public.banco_chave(p.nome_banco) as banco, p.status::text as status, p.parceiro_id,
           coalesce(p.valor_financiamento, 0) as valor,
           (select min(h.created_at) from public.proposta_historico h
             where h.proposta_id = p.id and h.status_novo::text = any (v_aprov)) as aprovada_em,
           p.created_at
      from janelas j
      join public.propostas p
        on p.created_at >= j.de::timestamp at time zone 'America/Sao_Paulo'
       and p.created_at < (j.ate + 1)::timestamp at time zone 'America/Sao_Paulo'
     where p.correspondente_id = c.corr and p.deleted_at is null and p.status <> 'rascunho'
       and (c.geral or p.usuario_responsavel_id = c.uid or p.usuario_criador_id = c.uid)
       and (c.usuario is null or coalesce(p.usuario_responsavel_id, p.usuario_criador_id) = c.usuario)
       and (c.banco is null or public.banco_chave(p.nome_banco) = c.banco)
  ), contratos as (
    -- Um contrato por cliente (data da ficha), com a proposta de contrato de maior valor.
    select j.periodo, cl.contrato_emitido_em as dia, coalesce(cl.responsavel_id, cl.criador_id) as usuario,
           k.banco, k.parceiro_id, k.registrado, k.valor, k.aprovada_em, k.emitido_em, k.registrado_em
      from janelas j
      join public.clientes cl
        on cl.contrato_emitido_em between j.de and j.ate
      cross join lateral (
        select public.banco_chave(p.nome_banco) as banco, p.parceiro_id,
               bool_or(p.status = 'registrado') over () as registrado,
               coalesce(p.valor_financiamento_aprovado, p.valor_financiamento, 0) as valor,
               (select min(h.created_at) from public.proposta_historico h
                 where h.proposta_id = p.id and h.status_novo::text = any (v_aprov)) as aprovada_em,
               coalesce(p.contrato_emitido_em, cl.contrato_emitido_em::timestamp at time zone 'America/Sao_Paulo') as emitido_em,
               p.contrato_registrado_em as registrado_em
          from public.propostas p
         where p.cliente_id = cl.id and p.deleted_at is null and p.status in ('contrato_emitido', 'registrado')
         order by coalesce(p.valor_financiamento_aprovado, p.valor_financiamento, 0) desc, p.id
         limit 1) k
     where cl.correspondente_id = c.corr and cl.deleted_at is null
       and (c.geral or cl.responsavel_id = c.uid or cl.criador_id = c.uid)
       and (c.usuario is null or coalesce(cl.responsavel_id, cl.criador_id) = c.usuario)
       and (c.banco is null or k.banco = c.banco)
  ), eventos as (
    select periodo, dia, null::text as banco, usuario, parceiro_id, 1 as simulacoes, 0 as propostas, 0 as aprovadas,
           0 as aguardando_contrato, 0 as recusadas, 0 as canceladas, 0 as contratos, 0 as registrados,
           0::numeric as valor_proposto, 0::numeric as valor_contratado, 0::numeric as h_aprov, 0 as n_aprov,
           0::numeric as h_contrato, 0 as n_contrato, 0::numeric as h_registro, 0 as n_registro
      from sims
    union all
    select periodo, dia, banco, usuario, parceiro_id, 0, 1,
           (status = any (v_aprov))::int,
           (status = any (v_aprov) and status not in ('contrato_emitido', 'registrado'))::int,
           (status = 'credito_recusado')::int, (status = 'cancelada')::int, 0, 0, valor, 0,
           case when status = any (v_aprov) and aprovada_em >= created_at
                then extract(epoch from aprovada_em - created_at) / 3600 else 0 end,
           (status = any (v_aprov) and aprovada_em >= created_at)::int, 0, 0, 0, 0
      from props
    union all
    select periodo, dia, banco, usuario, parceiro_id, 0, 0, 0, 0, 0, 0, 1, registrado::int, 0, valor, 0, 0,
           case when aprovada_em is not null and emitido_em >= aprovada_em
                then extract(epoch from emitido_em - aprovada_em) / 3600 else 0 end,
           (aprovada_em is not null and emitido_em >= aprovada_em)::int,
           case when registrado and registrado_em >= emitido_em
                then extract(epoch from registrado_em - emitido_em) / 3600 else 0 end,
           (registrado and registrado_em >= emitido_em)::int
      from contratos
  ), cubo as (
    select to_char(e.dia, 'YYYY-MM') as mes, 'agilliza'::text as grupo, 'agilliza'::text as conta_id,
           'Agilliza Correspondente'::text as conta_nome, 'correspondente'::text as conta_tipo,
           e.banco, e.usuario as usuario_id, coalesce(pr.nome, 'Sem responsável') as usuario_nome,
           e.parceiro_id, pa.nome as parceiro_nome,
           sum(e.simulacoes)::int as simulacoes, sum(e.propostas)::int as propostas,
           sum(e.aprovadas)::int as aprovadas, sum(e.aguardando_contrato)::int as aguardando_contrato,
           sum(e.recusadas)::int as recusadas, sum(e.canceladas)::int as canceladas,
           sum(e.contratos)::int as contratos, sum(e.registrados)::int as registrados,
           round(sum(e.valor_proposto), 2)::float8 as valor_proposto,
           round(sum(e.valor_contratado), 2)::float8 as valor_contratado,
           round(sum(e.h_aprov), 2)::float8 as h_aprov, sum(e.n_aprov)::int as n_aprov,
           round(sum(e.h_contrato), 2)::float8 as h_contrato, sum(e.n_contrato)::int as n_contrato,
           round(sum(e.h_registro), 2)::float8 as h_registro, sum(e.n_registro)::int as n_registro
      from eventos e
      left join public.profiles pr on pr.id = e.usuario
      left join public.profiles pa on pa.id = e.parceiro_id
     where e.periodo = 'atual'
     group by 1, 6, 7, 8, 9, 10
  ), anterior as (
    select coalesce(sum(simulacoes), 0)::int as simulacoes, coalesce(sum(propostas), 0)::int as propostas,
           coalesce(sum(aprovadas), 0)::int as aprovadas, coalesce(sum(aguardando_contrato), 0)::int as aguardando_contrato,
           coalesce(sum(recusadas), 0)::int as recusadas, coalesce(sum(canceladas), 0)::int as canceladas,
           coalesce(sum(contratos), 0)::int as contratos, coalesce(sum(registrados), 0)::int as registrados,
           round(coalesce(sum(valor_proposto), 0), 2)::float8 as valor_proposto,
           round(coalesce(sum(valor_contratado), 0), 2)::float8 as valor_contratado,
           round(coalesce(sum(h_aprov), 0), 2)::float8 as h_aprov, coalesce(sum(n_aprov), 0)::int as n_aprov,
           round(coalesce(sum(h_contrato), 0), 2)::float8 as h_contrato, coalesce(sum(n_contrato), 0)::int as n_contrato,
           round(coalesce(sum(h_registro), 0), 2)::float8 as h_registro, coalesce(sum(n_registro), 0)::int as n_registro
      from eventos where periodo = 'anterior'
  ), gargalos as (
    -- Retrato de agora: propostas em aberto por etapa e há quanto tempo estão paradas.
    select 'agilliza'::text as grupo, p.status::text as status, count(*)::int as quantidade,
           round(avg(extract(epoch from now() - coalesce(p.status_atualizado_em, p.updated_at, p.created_at)) / 86400)::numeric, 1)::float8
             as dias_parado,
           0 as sla_vencido,
           count(*) filter (where now() - coalesce(p.status_atualizado_em, p.updated_at, p.created_at) > interval '15 days')::int
             as parados_15d
      from public.propostas p
     where p.correspondente_id = c.corr and p.deleted_at is null and p.status::text <> all (v_final)
       and (c.geral or p.usuario_responsavel_id = c.uid or p.usuario_criador_id = c.uid)
       and (c.usuario is null or coalesce(p.usuario_responsavel_id, p.usuario_criador_id) = c.usuario)
       and (c.banco is null or public.banco_chave(p.nome_banco) = c.banco)
     group by p.status
  )
  select jsonb_build_object(
    'fatos', coalesce((select jsonb_agg(to_jsonb(x) order by x.mes, x.usuario_nome) from cubo x), '[]'),
    'anterior', (select to_jsonb(a) from anterior a),
    'gargalos', coalesce((select jsonb_agg(to_jsonb(g) order by g.quantidade desc) from gargalos g), '[]'),
    'escopo', case when c.geral then 'geral' else 'minha' end)
  into resultado;
  return resultado;
end $$;
revoke all on function public.relatorio_eco_agilliza(jsonb) from public, anon;
grant execute on function public.relatorio_eco_agilliza(jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- Operação: SLA de propostas (até o envio ao banco), demandas e tarefas, por responsável.
-- -----------------------------------------------------------------------------
create or replace function public.relatorio_operacional_agilliza(p_filtros jsonb default '{}')
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  c record;
  v_ini timestamptz;
  v_fim timestamptz;
  resultado jsonb;
begin
  select * into c from public._relatorio_contexto(p_filtros);
  v_ini := c.de::timestamp at time zone 'America/Sao_Paulo';
  v_fim := (c.ate + 1)::timestamp at time zone 'America/Sao_Paulo';

  with dem as (
    select d.responsavel_id, d.status::text as status, d.prazo_sla, d.concluida_em, d.created_at
      from public.demandas d
     where d.correspondente_id = c.corr and d.deleted_at is null
       and d.created_at >= v_ini and d.created_at < v_fim
       and (c.geral or d.responsavel_id = c.uid or d.criador_id = c.uid)
       and (c.usuario is null or d.responsavel_id = c.usuario)
  ), tar as (
    select t.responsavel_id, t.status::text as status, t.prazo, t.concluida_em, t.created_at
      from public.tasks t
     where t.correspondente_id = c.corr and t.deleted_at is null
       and t.created_at >= v_ini and t.created_at < v_fim
       and (c.geral or t.responsavel_id = c.uid or t.criador_id = c.uid)
       and (c.usuario is null or t.responsavel_id = c.usuario)
  ), prop as (
    select coalesce(p.usuario_responsavel_id, p.usuario_criador_id) as responsavel_id, p.created_at, p.enviada_em
      from public.propostas p
     where p.correspondente_id = c.corr and p.deleted_at is null and p.status <> 'rascunho'
       and p.created_at >= v_ini and p.created_at < v_fim
       and (c.geral or p.usuario_responsavel_id = c.uid or p.usuario_criador_id = c.uid)
       and (c.usuario is null or coalesce(p.usuario_responsavel_id, p.usuario_criador_id) = c.usuario)
       and (c.banco is null or public.banco_chave(p.nome_banco) = c.banco)
  ), pessoas as (
    select responsavel_id from dem union select responsavel_id from tar union select responsavel_id from prop
  ), por_pessoa as (
    select pe.responsavel_id as id, coalesce(pr.nome, 'Sem responsável') as nome,
           (select count(*) from dem d where d.responsavel_id is not distinct from pe.responsavel_id)::int as demandas,
           (select count(*) from dem d where d.responsavel_id is not distinct from pe.responsavel_id
               and d.status = 'concluida')::int as demandas_concluidas,
           (select count(*) from dem d where d.responsavel_id is not distinct from pe.responsavel_id
               and d.status = 'concluida' and (d.prazo_sla is null or d.concluida_em <= d.prazo_sla))::int as demandas_no_prazo,
           (select count(*) from dem d where d.responsavel_id is not distinct from pe.responsavel_id
               and d.status not in ('concluida', 'cancelada') and d.prazo_sla < now())::int as demandas_vencidas,
           (select count(*) from tar t where t.responsavel_id is not distinct from pe.responsavel_id)::int as tarefas,
           (select count(*) from tar t where t.responsavel_id is not distinct from pe.responsavel_id
               and t.status = 'concluida')::int as tarefas_concluidas,
           (select count(*) from tar t where t.responsavel_id is not distinct from pe.responsavel_id
               and t.status = 'concluida' and (t.prazo is null or t.concluida_em <= t.prazo))::int as tarefas_no_prazo,
           (select count(*) from tar t where t.responsavel_id is not distinct from pe.responsavel_id
               and t.status not in ('concluida', 'cancelada') and t.prazo < now())::int as tarefas_atrasadas,
           (select count(*) from prop p where p.responsavel_id is not distinct from pe.responsavel_id)::int as propostas,
           (select count(*) from prop p where p.responsavel_id is not distinct from pe.responsavel_id
               and p.enviada_em is not null)::int as propostas_enviadas,
           (select round(coalesce(avg(extract(epoch from p.enviada_em - p.created_at) / 3600), 0)::numeric, 1)
              from prop p where p.responsavel_id is not distinct from pe.responsavel_id
               and p.enviada_em >= p.created_at)::float8 as horas_ate_envio
      from pessoas pe
      left join public.profiles pr on pr.id = pe.responsavel_id
  )
  select jsonb_build_object(
    'demandas', (select jsonb_build_object(
        'total', count(*), 'concluidas', count(*) filter (where status = 'concluida'),
        'no_prazo', count(*) filter (where status = 'concluida' and (prazo_sla is null or concluida_em <= prazo_sla)),
        'vencidas_abertas', count(*) filter (where status not in ('concluida', 'cancelada') and prazo_sla < now()),
        'abertas', count(*) filter (where status not in ('concluida', 'cancelada')),
        'horas_conclusao', round(coalesce(avg(extract(epoch from concluida_em - created_at) / 3600)
                                   filter (where status = 'concluida' and concluida_em >= created_at), 0)::numeric, 1))
        from dem),
    'tarefas', (select jsonb_build_object(
        'total', count(*), 'concluidas', count(*) filter (where status = 'concluida'),
        'no_prazo', count(*) filter (where status = 'concluida' and (prazo is null or concluida_em <= prazo)),
        'atrasadas_abertas', count(*) filter (where status not in ('concluida', 'cancelada') and prazo < now()),
        'abertas', count(*) filter (where status not in ('concluida', 'cancelada')),
        'horas_conclusao', round(coalesce(avg(extract(epoch from concluida_em - created_at) / 3600)
                                   filter (where status = 'concluida' and concluida_em >= created_at), 0)::numeric, 1))
        from tar),
    'propostas', (select jsonb_build_object(
        'total', count(*), 'enviadas', count(*) filter (where enviada_em is not null),
        'enviadas_24h', count(*) filter (where enviada_em is not null and enviada_em - created_at <= interval '24 hours'),
        'horas_ate_envio', round(coalesce(avg(extract(epoch from enviada_em - created_at) / 3600)
                                   filter (where enviada_em >= created_at), 0)::numeric, 1))
        from prop),
    'por_pessoa', coalesce((select jsonb_agg(to_jsonb(x) order by x.demandas + x.tarefas + x.propostas desc, x.nome)
                              from por_pessoa x), '[]'),
    'escopo', case when c.geral then 'geral' else 'minha' end)
  into resultado;
  return resultado;
end $$;
revoke all on function public.relatorio_operacional_agilliza(jsonb) from public, anon;
grant execute on function public.relatorio_operacional_agilliza(jsonb) to authenticated;

-- Índices para as leituras por período (as tabelas já filtram por empresa).
create index if not exists clientes_contrato_emitido_corr
  on public.clientes (correspondente_id, contrato_emitido_em) where contrato_emitido_em is not null and deleted_at is null;
create index if not exists propostas_corr_criacao
  on public.propostas (correspondente_id, created_at) where deleted_at is null;
create index if not exists simulacoes_corr_criacao
  on public.simulacoes (correspondente_id, created_at) where deleted_at is null;
