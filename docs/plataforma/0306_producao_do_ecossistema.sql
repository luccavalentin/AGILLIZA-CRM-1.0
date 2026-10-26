-- =============================================================================
-- 0306 — Produção do ecossistema para o Painel geral do correspondente (frente a1,
-- pedido do dono de 26/10/2026, itens C04–C06).
--
-- PROPOSTA para a sessão principal aplicar no repositório do Agilliza Tech
-- (packages/db/migracoes/0306_producao_do_ecossistema.sql). O Agilliza já usa esta função
-- se ela existir (src/lib/relatorios/producao-ecossistema.server.ts, `to_regprocedure`);
-- sem ela, soma as listas paginadas de consultar_simulacoes/consultar_propostas, com teto
-- de 4.000 linhas por tipo e período e contratos dos assinantes pela data de criação.
--
-- Uma chamada devolve o período e o anterior já somados, a série e os dois rankings:
--   {"atual":{...},"anterior":{...},"serie":[...],"rankingUsuarios":[...],"rankingContas":[...]}
-- com os totais {simulacoes, propostas, aprovadas, contratos, registrados, valor}.
--
-- Filtros (jsonb): base ('sua_base' | 'assinantes' | 'assinante'), licenca (uuid, com
-- 'assinante'), minha (boolean: só contas na carteira da pessoa), usuario (uuid do Tech),
-- de, ate, anterior_de, anterior_ate (date, dia de Brasília).
--
-- Regras (as mesmas do correspondente):
--   · Sua base = conta da plataforma + contas com nucleo.tenants.vinculo_agilliza (0305);
--     Assinantes = as demais licenças; proposta já trazida ao Agilliza (cópia por baixo,
--     plataforma.propostas_no_agilliza com proposta_agilliza_id) NÃO conta na Sua base —
--     ela já conta no Agilliza.
--   · simulações e propostas pela data de criação; crédito aprovado = status aprovado ainda
--     sem contrato; contrato emitido pela data `contrato_emitido_em`; registrado = dos
--     emitidos no período, os com status 'registrado'; valor financiado = valor_aprovado da
--     proposta (ou o financiamento da simulação).
-- Leitura só: SECURITY DEFINER com search_path fixo, permissão conferida no banco, sem
-- dado pessoal (só nome de usuário e de conta, como usuarios_da_licenca).
-- =============================================================================

create or replace function plataforma.producao_do_ecossistema(p_filtros jsonb default '{}')
returns jsonb language plpgsql stable security definer
set search_path = plataforma, operacional, nucleo, acesso, seguranca, pg_catalog
as $$
declare
  f jsonb := coalesce(p_filtros, '{}');
  v_base text := coalesce(nullif(f ->> 'base', ''), 'assinantes');
  v_licenca uuid := nullif(f ->> 'licenca', '')::uuid;
  v_minha boolean := coalesce((f ->> 'minha')::boolean, false);
  v_usuario uuid := nullif(f ->> 'usuario', '')::uuid;
  v_de date := (f ->> 'de')::date;
  v_ate date := (f ->> 'ate')::date;
  v_ant_de date := (f ->> 'anterior_de')::date;
  v_ant_ate date := (f ->> 'anterior_ate')::date;
  v_mensal boolean;
  v_eu uuid := seguranca.auth_usuario_id();
  resultado jsonb;
begin
  if not (seguranca.auth_e_plataforma('propostas.operar') or seguranca.auth_e_plataforma('simulacoes.operar')
          or seguranca.auth_e_plataforma('fila.acompanhar')) then
    raise exception 'Sem permissão para ver a produção do ecossistema.' using errcode = '42501';
  end if;
  if v_base not in ('sua_base', 'assinantes', 'assinante') then
    raise exception 'Base inválida.' using errcode = '22023';
  end if;
  if v_base = 'assinante' and v_licenca is null then
    raise exception 'Escolha o assinante.' using errcode = '22023';
  end if;
  if v_de is null or v_ate is null or v_ant_de is null or v_ant_ate is null
     or v_de > v_ate or v_ant_de > v_ant_ate then
    raise exception 'Período inválido.' using errcode = '22023';
  end if;
  if v_ate - v_de > 400 then
    raise exception 'O período vai até 400 dias.' using errcode = '22023';
  end if;
  v_mensal := v_ate - v_de + 1 > 62;

  with contas as materialized (
    select t.id, t.nome, t.tipo::text as tipo
      from nucleo.tenants t
     where t.deleted_at is null
       and case v_base
             when 'sua_base' then t.tipo = 'plataforma' or t.vinculo_agilliza
             when 'assinantes' then t.tipo <> 'plataforma' and not t.vinculo_agilliza
             else t.id = v_licenca
           end
       and (not v_minha or exists (select 1 from plataforma.carteira c
                                    where c.tenant_id = t.id and c.analista_id = v_eu))
  ), janelas(periodo, de, ate) as (
    values ('atual', v_de, v_ate), ('anterior', v_ant_de, v_ant_ate)
  ), fatos as (
    -- simulações (data de criação)
    select j.periodo, 'simulacao'::text as tipo,
           (s.criado_em at time zone 'America/Sao_Paulo')::date as dia,
           coalesce(s.responsavel_id, s.criado_por) as usuario, s.tenant_id,
           false as registrado, 0::numeric as valor
      from janelas j
      join operacional.simulacoes s
        on s.criado_em >= j.de::timestamp at time zone 'America/Sao_Paulo'
       and s.criado_em < (j.ate + 1)::timestamp at time zone 'America/Sao_Paulo'
      join contas c on c.id = s.tenant_id
     where s.deleted_at is null
       and (v_usuario is null or coalesce(s.responsavel_id, s.criado_por) = v_usuario)
    union all
    -- propostas enviadas e crédito aprovado (data de criação)
    select j.periodo, x.tipo, (p.criado_em at time zone 'America/Sao_Paulo')::date,
           coalesce(p.responsavel_id, p.criado_por), p.tenant_id, false, 0
      from janelas j
      join operacional.propostas p
        on p.criado_em >= j.de::timestamp at time zone 'America/Sao_Paulo'
       and p.criado_em < (j.ate + 1)::timestamp at time zone 'America/Sao_Paulo'
      join contas c on c.id = p.tenant_id
      cross join lateral (values ('proposta'::text), ('aprovada'::text)) x(tipo)
     where (x.tipo = 'proposta'
            or p.status in ('aprovada','condicionada','formularios','aguardando_documentos',
                            'engenharia_vistoria','analise_juridica'))
       and (v_usuario is null or coalesce(p.responsavel_id, p.criado_por) = v_usuario)
       and (v_base <> 'sua_base' or not exists (
             select 1 from plataforma.propostas_no_agilliza pa
              where pa.proposta_id = p.id and pa.proposta_agilliza_id is not null))
    union all
    -- contratos emitidos (data de emissão) e registrados entre eles
    select j.periodo, 'contrato', (p.contrato_emitido_em at time zone 'America/Sao_Paulo')::date,
           coalesce(p.responsavel_id, p.criado_por), p.tenant_id,
           p.status = 'registrado', coalesce(p.valor_aprovado, s.valor_financiamento, 0)
      from janelas j
      join operacional.propostas p
        on p.contrato_emitido_em >= j.de::timestamp at time zone 'America/Sao_Paulo'
       and p.contrato_emitido_em < (j.ate + 1)::timestamp at time zone 'America/Sao_Paulo'
      join contas c on c.id = p.tenant_id
      left join operacional.simulacoes s on s.id = p.simulacao_id
     where p.status in ('contrato', 'registrado')
       and (v_usuario is null or coalesce(p.responsavel_id, p.criado_por) = v_usuario)
       and (v_base <> 'sua_base' or not exists (
             select 1 from plataforma.propostas_no_agilliza pa
              where pa.proposta_id = p.id and pa.proposta_agilliza_id is not null))
  ), totais as (
    select periodo,
           count(*) filter (where tipo = 'simulacao') as simulacoes,
           count(*) filter (where tipo = 'proposta') as propostas,
           count(*) filter (where tipo = 'aprovada') as aprovadas,
           count(*) filter (where tipo = 'contrato') as contratos,
           count(*) filter (where tipo = 'contrato' and registrado) as registrados,
           coalesce(sum(valor) filter (where tipo = 'contrato'), 0)::float8 as valor
      from fatos group by periodo
  ), chaves as (
    select case when v_mensal then to_char(d, 'YYYY-MM') else to_char(d, 'YYYY-MM-DD') end as chave,
           min(d) as d
      from generate_series(v_de, v_ate, interval '1 day') g(d)
     group by 1
  ), serie as (
    select k.chave,
           case when v_mensal
                then (array['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'])
                       [extract(month from k.d)::int] || '/' || to_char(k.d, 'YY')
                else to_char(k.d, 'DD/MM') end as rotulo,
           count(x.*) filter (where x.tipo = 'simulacao') as simulacoes,
           count(x.*) filter (where x.tipo = 'proposta') as propostas,
           count(x.*) filter (where x.tipo = 'contrato') as contratos
      from chaves k
      left join fatos x on x.periodo = 'atual'
       and (case when v_mensal then to_char(x.dia, 'YYYY-MM') else to_char(x.dia, 'YYYY-MM-DD') end) = k.chave
     group by k.chave, k.d
  ), por_usuario as (
    select 't:' || x.usuario::text as id, coalesce(u.nome, 'Sem nome') as nome,
           (array_agg(c.nome order by c.nome))[1] as detalhe,
           count(*) filter (where x.tipo = 'simulacao') as simulacoes,
           count(*) filter (where x.tipo = 'proposta') as propostas,
           count(*) filter (where x.tipo = 'aprovada') as aprovadas,
           count(*) filter (where x.tipo = 'contrato') as contratos,
           count(*) filter (where x.tipo = 'contrato' and x.registrado) as registrados,
           coalesce(sum(x.valor) filter (where x.tipo = 'contrato'), 0)::float8 as valor
      from fatos x
      join contas c on c.id = x.tenant_id
      left join acesso.usuarios u on u.id = x.usuario
     where x.periodo = 'atual' and x.usuario is not null
     group by x.usuario, u.nome
  ), por_conta as (
    select c.id::text as id, c.nome, c.tipo as detalhe,
           count(*) filter (where x.tipo = 'simulacao') as simulacoes,
           count(*) filter (where x.tipo = 'proposta') as propostas,
           count(*) filter (where x.tipo = 'aprovada') as aprovadas,
           count(*) filter (where x.tipo = 'contrato') as contratos,
           count(*) filter (where x.tipo = 'contrato' and x.registrado) as registrados,
           coalesce(sum(x.valor) filter (where x.tipo = 'contrato'), 0)::float8 as valor
      from fatos x join contas c on c.id = x.tenant_id
     where x.periodo = 'atual'
     group by c.id, c.nome, c.tipo
  )
  select jsonb_build_object(
    'atual', coalesce((select to_jsonb(t) - 'periodo' from totais t where periodo = 'atual'),
                      '{"simulacoes":0,"propostas":0,"aprovadas":0,"contratos":0,"registrados":0,"valor":0}'),
    'anterior', coalesce((select to_jsonb(t) - 'periodo' from totais t where periodo = 'anterior'),
                         '{"simulacoes":0,"propostas":0,"aprovadas":0,"contratos":0,"registrados":0,"valor":0}'),
    'serie', coalesce((select jsonb_agg(to_jsonb(s) order by s.chave) from serie s), '[]'),
    'rankingUsuarios', coalesce((select jsonb_agg(to_jsonb(r)) from (
        select * from por_usuario
         order by contratos desc, valor desc, propostas desc, simulacoes desc, nome limit 10) r), '[]'),
    'rankingContas', coalesce((select jsonb_agg(to_jsonb(r)) from (
        select * from por_conta
         order by contratos desc, valor desc, propostas desc, simulacoes desc, nome limit 10) r), '[]'))
  into resultado;
  return resultado;
end $$;

revoke all on function plataforma.producao_do_ecossistema(jsonb) from public;
grant execute on function plataforma.producao_do_ecossistema(jsonb) to app_api; -- agilliza_ponte herda app_api (0175)
