-- =============================================================================
-- Auditoria adversarial rodada 2 (eco-aud2, 26/10/2026): RH — folha recalculada no banco e
-- ficha ligada a usuário.
--
--   1. `rh_fechar_competencia` gravava os valores que o CLIENTE mandava (salário base,
--      proventos, descontos, adiantamentos e líquido) e criava as contas a pagar com eles. A
--      função é chamável pelo /rpc do Supabase com o token da pessoa: quem tem "Folha · fechar"
--      mandava o próprio líquido de R$ 50.000 e o financeiro recebia a conta a pagar — sem a
--      permissão de alterar salário e sem nenhum lançamento. Agora o BANCO recalcula cada
--      funcionário com o mesmo motor da tela (`src/lib/rh/holerite-calc.ts` +
--      `entrada-competencia.ts` + `clt.ts`, mesma aritmética de ponto flutuante e o mesmo
--      arredondamento) a partir do que está gravado: ficha, alterações salariais, benefícios,
--      faltas, adiantamentos, lançamentos, dependentes e a tabela fiscal vigente. Valor
--      enviado que não bate com o recalculado (mais de R$ 0,01) é recusado ("a folha mudou
--      desde a prévia"); quem entra na folha também é o banco que diz (sem funcionário a mais
--      nem a menos). O que fica gravado são os valores do banco.
--   2. Ficha de RH ligada a usuário (`rh_funcionarios.user_id`): quem só tinha "Funcionários ·
--      editar" ligava a ficha de um colega ao PRÓPRIO usuário e passava a ver os holerites dele
--      ("Meu RH", PDF no bucket) — salário sem "Salários · ver". Também era possível ligar a
--      ficha a um usuário de outra empresa. Agora ligar (ou trocar) o usuário da ficha exige
--      "Salários · ver" e o usuário tem de ser da mesma empresa. Desligar continua livre.
--
-- Funções existentes alteradas (geradas de pg_get_functiondef, mudança mínima):
--   public.rh_fechar_competencia (recalcula e confere; grava os valores do banco).
-- Funções novas: public.rh_calcular_item_folha (interna, sem /rpc), public.rh_funcionario_guardar_vinculo (gatilho).
-- Teste: pgTAP 764 do Agilliza Tech (banco único).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Motor da folha no banco (espelho fiel do motor da tela)
-- -----------------------------------------------------------------------------

/** Math.round(n * 100) / 100 do JavaScript, em double precision (mesma aritmética). */
create or replace function public.rh__r2(n double precision)
returns double precision
language sql
immutable
parallel safe
set search_path = pg_catalog
as $$
  select case when n is null or n = 'NaN'::float8 or n in ('Infinity'::float8, '-Infinity'::float8) then 0::float8
              else floor(n * 100 + 0.5) / 100 end
$$;

/**
 * Um funcionário numa competência, calculado a partir do que está gravado (o mesmo que a
 * prévia da tela faz): {salario_base, proventos, descontos, adiantamentos, liquido, inss, irrf,
 * base_inss, base_irrf, fgts}. Interna: sem execução pelo /rpc (só `rh_fechar_competencia`).
 * Devolve nulo se não há tabela fiscal vigente.
 */
create or replace function public.rh_calcular_item_folha(p_corr uuid, p_func uuid, p_ano integer, p_mes integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_ini date := make_date(p_ano, p_mes, 1);
  v_fim date := (make_date(p_ano, p_mes, 1) + interval '1 month' - interval '1 day')::date;
  f record;
  t record;
  b record;
  l record;
  v_alt record;
  -- entrada
  e_salario float8;
  e_jornada float8;
  e_faltas float8 := 0;
  e_dsr float8 := 0;
  e_atrasos float8 := 0;
  e_he50 float8 := 0;
  e_he100 float8 := 0;
  e_noturnas float8 := 0;
  e_comissoes float8 := 0;
  e_bonif float8 := 0;
  e_outros_prov float8 := 0;
  e_vt boolean := false;
  e_vt_passagens float8 := 0;
  e_vr boolean := false;
  e_vr_desc float8 := 0;
  e_va boolean := false;
  e_va_desc float8 := 0;
  e_saude float8 := 0;
  e_odonto float8 := 0;
  e_adiant float8 := 0;
  e_consig float8 := 0;
  e_sindical float8 := 0;
  e_pensao float8 := 0;
  e_outros_desc float8 := 0;
  e_desc_avulsos float8 := 0;
  e_dep_ir integer := 0;
  e_filhos_sf integer := 0;
  v_nome text;
  v_desc float8;
  v_custo float8;
  -- cálculo
  valor_hora float8;
  valor_dia float8;
  sal_prop float8;
  he50 float8; he100 float8; adnot float8; comis float8; bonif float8; outros_prov float8; sf float8;
  base_inc float8;
  faltas float8; dsr float8; atrasos float8;
  bruto_inss float8;
  inss float8 := 0;
  base_inss float8;
  pensao float8;
  legais float8;
  base_irrf float8;
  imposto float8 := 0;
  reducao float8 := 0;
  irrf float8;
  vt float8; vr float8; va float8; saude float8; odonto float8; adiant float8; consig float8; sindical float8; outros_desc float8;
  tot_prov float8;
  tot_desc float8;
  faixa jsonb;
  anterior float8;
  teto float8;
begin
  select x.id, x.salario_atual, x.jornada_horas_semanais into f
    from public.rh_funcionarios x where x.id = p_func and x.correspondente_id = p_corr;
  if not found then return null; end if;

  -- Tabela vigente (clt.ts · tabelaVigente): a mais recente até a competência; na mesma data, a própria vence a padrão.
  select x.* into t from public.rh_tabelas_fiscais x
   where (x.correspondente_id is null or x.correspondente_id = p_corr)
     and (extract(year from x.vigencia_desde) * 100 + extract(month from x.vigencia_desde)) <= p_ano * 100 + p_mes
   order by (extract(year from x.vigencia_desde) * 100 + extract(month from x.vigencia_desde)) desc,
            (x.correspondente_id is not null) desc
   limit 1;
  if not found then return null; end if;

  -- Salário na competência (entrada-competencia.ts · salarioNaCompetencia).
  select a.salario_novo into v_alt from public.rh_alteracoes_salariais a
   where a.funcionario_id = p_func and a.vigencia <= v_fim
   order by a.vigencia desc, a.created_at desc limit 1;
  if found then
    e_salario := v_alt.salario_novo::float8;
  else
    select a.salario_anterior into v_alt from public.rh_alteracoes_salariais a
     where a.funcionario_id = p_func and a.vigencia > v_fim
     order by a.vigencia, a.created_at limit 1;
    e_salario := case when found and v_alt.salario_anterior is not null then v_alt.salario_anterior::float8
                      else coalesce(f.salario_atual, 0)::float8 end;
  end if;
  e_jornada := case when f.jornada_horas_semanais is not null and f.jornada_horas_semanais > 0
                    then round(f.jornada_horas_semanais * 5)::float8 else 220 end;

  -- Faltas não abonadas dentro do mês e semanas (domingo a sábado) atingidas.
  select count(distinct d), count(distinct (d - extract(dow from d)::int))
    into e_faltas, e_dsr
    from public.rh_ocorrencias o
    cross join lateral generate_series(greatest(o.data_inicio, v_ini), least(coalesce(o.data_fim, o.data_inicio), v_fim), interval '1 day') g(dd)
    cross join lateral (select g.dd::date as d) z
   where o.funcionario_id = p_func and o.tipo = 'falta' and not o.abonada
     and o.data_inicio <= v_fim and coalesce(o.data_fim, o.data_inicio) >= v_ini;

  -- Benefícios vigentes no mês: só a coparticipação; VT respeita o teto de 6% no motor.
  for b in
    select bt.nome, fb.valor, fb.desconto
      from public.rh_funcionario_beneficios fb
      left join public.rh_beneficios_tipos bt on bt.id = fb.tipo_id
     where fb.funcionario_id = p_func and fb.ativo
       and (fb.vigencia_inicio is null or fb.vigencia_inicio <= v_fim)
       and (fb.vigencia_fim is null or fb.vigencia_fim >= v_ini)
  loop
    v_nome := lower(coalesce(b.nome, ''));
    v_desc := coalesce(b.desconto, 0)::float8;
    if v_nome ~ 'transporte|\yvt\y' then
      e_vt := true;
      v_custo := coalesce(b.valor, 0)::float8;
      e_vt_passagens := e_vt_passagens + case when v_desc > 0 then least(v_desc, case when v_custo <> 0 then v_custo else v_desc end)
                                              else v_custo end;
    elsif v_desc <= 0 then
      continue;
    elsif v_nome ~ 'refei|\yvr\y' then
      e_vr := true; e_vr_desc := e_vr_desc + v_desc;
    elsif v_nome ~ 'aliment|\yva\y' then
      e_va := true; e_va_desc := e_va_desc + v_desc;
    elsif v_nome ~ 'odonto' then
      e_odonto := e_odonto + v_desc;
    elsif v_nome ~ 'sa[uú]de|m[eé]dic' then
      e_saude := e_saude + v_desc;
    else
      e_outros_desc := e_outros_desc + v_desc;
    end if;
  end loop;

  select coalesce(sum(a.valor::float8), 0) into e_adiant from public.rh_adiantamentos a
   where a.funcionario_id = p_func and a.competencia_mes = p_mes and a.competencia_ano = p_ano and a.status::text <> 'cancelado';

  for l in
    select x.tipo, coalesce(x.quantidade, 0)::float8 as q, coalesce(x.valor, 0)::float8 as v
      from public.rh_lancamentos x
     where x.funcionario_id = p_func and x.mes = p_mes and x.ano = p_ano and x.ativo
  loop
    case l.tipo
      when 'hora_extra_50' then e_he50 := e_he50 + l.q;
      when 'hora_extra_100' then e_he100 := e_he100 + l.q;
      when 'adicional_noturno' then e_noturnas := e_noturnas + l.q;
      when 'atraso' then e_atrasos := e_atrasos + l.q;
      when 'comissao' then e_comissoes := e_comissoes + l.v;
      when 'bonus' then e_bonif := e_bonif + l.v;
      when 'outro_provento' then e_outros_prov := e_outros_prov + l.v;
      when 'desconto' then e_desc_avulsos := e_desc_avulsos + l.v;
      when 'emprestimo_consignado' then e_consig := e_consig + l.v;
      when 'pensao_alimenticia' then e_pensao := e_pensao + l.v;
      when 'contribuicao_sindical' then e_sindical := e_sindical + l.v;
      else null;
    end case;
  end loop;
  e_outros_desc := public.rh__r2(e_outros_desc + e_desc_avulsos);
  e_outros_prov := public.rh__r2(e_outros_prov);

  select count(*) filter (where d.ir),
         count(*) filter (where d.salario_familia and d.data_nascimento is not null
                            and extract(year from age(v_fim, d.data_nascimento)) <= 14)
    into e_dep_ir, e_filhos_sf
    from public.rh_dependentes d where d.funcionario_id = p_func;

  -- Motor (holerite-calc.ts · calcularHolerite). Linhas só entram quando o valor é > 0.
  valor_hora := case when e_salario > 0 then e_salario / e_jornada else 0 end;
  valor_dia := e_salario / 30;
  sal_prop := public.rh__r2(valor_dia * 30);
  he50 := public.rh__r2(e_he50 * valor_hora * 1.5);
  he100 := public.rh__r2(e_he100 * valor_hora * 2);
  adnot := public.rh__r2(e_noturnas * valor_hora * (20::float8 / 100));
  comis := public.rh__r2(e_comissoes);
  bonif := public.rh__r2(e_bonif);
  outros_prov := public.rh__r2(e_outros_prov);
  sf := case when e_salario > 0 and e_salario <= t.salario_familia_teto::float8 and e_filhos_sf > 0
             then public.rh__r2(e_filhos_sf * t.salario_familia_quota::float8) else 0 end;
  base_inc := public.rh__r2(sal_prop + he50 + he100 + adnot + 0 + 0 + comis + bonif + 0 + 0 + outros_prov);

  faltas := public.rh__r2(valor_dia * e_faltas);
  dsr := public.rh__r2(valor_dia * e_dsr);
  atrasos := public.rh__r2(valor_hora * e_atrasos);

  bruto_inss := greatest(0, base_inc - faltas - dsr - atrasos);
  if jsonb_array_length(coalesce(t.inss_faixas, '[]')) > 0 then
    teto := (t.inss_faixas -> (jsonb_array_length(t.inss_faixas) - 1) ->> 'ate')::float8;
    anterior := 0;
    for faixa in select x from jsonb_array_elements(t.inss_faixas) x loop
      exit when least(greatest(0, bruto_inss), teto) <= anterior;
      inss := inss + (least(least(greatest(0, bruto_inss), teto), (faixa ->> 'ate')::float8) - anterior) * (faixa ->> 'aliquota')::float8;
      anterior := (faixa ->> 'ate')::float8;
    end loop;
    inss := public.rh__r2(inss);
  end if;
  base_inss := public.rh__r2(bruto_inss);

  pensao := public.rh__r2(e_pensao);
  legais := inss + e_dep_ir * t.irrf_dependente::float8 + pensao;
  base_irrf := public.rh__r2(greatest(0, base_inss - greatest(legais, t.irrf_desconto_simplificado::float8)));
  if base_irrf > 0 then
    select x into faixa from jsonb_array_elements(t.irrf_faixas) with ordinality as z(x, n)
     where x ->> 'ate' is null or base_irrf <= (x ->> 'ate')::float8
     order by n limit 1;
    if faixa is not null then
      imposto := greatest(0, base_irrf * (faixa ->> 'aliquota')::float8 - (faixa ->> 'deducao')::float8);
    end if;
  end if;
  if t.irrf_reducao is not null and jsonb_typeof(t.irrf_reducao) = 'object' then
    if base_inss <= (t.irrf_reducao ->> 'isencao_ate')::float8 then
      reducao := least(imposto, (t.irrf_reducao ->> 'reducao_maxima')::float8);
    elsif base_inss <= (t.irrf_reducao ->> 'ate')::float8 then
      reducao := greatest(0, (t.irrf_reducao ->> 'a')::float8 - (t.irrf_reducao ->> 'b')::float8 * base_inss);
    end if;
  end if;
  reducao := least(imposto, reducao);
  irrf := public.rh__r2(imposto - reducao);

  vt := case when e_vt then public.rh__r2(least(e_salario * 0.06, case when e_vt_passagens <> 0 then e_vt_passagens else e_salario * 0.06 end)) else 0 end;
  vr := case when e_vr then public.rh__r2(e_vr_desc) else 0 end;
  va := case when e_va then public.rh__r2(e_va_desc) else 0 end;
  saude := public.rh__r2(e_saude);
  odonto := public.rh__r2(e_odonto);
  adiant := public.rh__r2(e_adiant);
  consig := public.rh__r2(e_consig);
  sindical := public.rh__r2(e_sindical);
  outros_desc := public.rh__r2(e_outros_desc);

  -- Soma das linhas na ordem da tela (o salário base entra sempre).
  tot_prov := sal_prop;
  if he50 > 0 then tot_prov := tot_prov + he50; end if;
  if he100 > 0 then tot_prov := tot_prov + he100; end if;
  if adnot > 0 then tot_prov := tot_prov + adnot; end if;
  if comis > 0 then tot_prov := tot_prov + comis; end if;
  if bonif > 0 then tot_prov := tot_prov + bonif; end if;
  if outros_prov > 0 then tot_prov := tot_prov + outros_prov; end if;
  if sf > 0 then tot_prov := tot_prov + sf; end if;
  tot_prov := public.rh__r2(tot_prov);

  tot_desc := 0;
  if faltas > 0 then tot_desc := tot_desc + faltas; end if;
  if dsr > 0 then tot_desc := tot_desc + dsr; end if;
  if atrasos > 0 then tot_desc := tot_desc + atrasos; end if;
  if inss > 0 then tot_desc := tot_desc + inss; end if;
  if irrf > 0 then tot_desc := tot_desc + irrf; end if;
  if vt > 0 then tot_desc := tot_desc + vt; end if;
  if vr > 0 then tot_desc := tot_desc + vr; end if;
  if va > 0 then tot_desc := tot_desc + va; end if;
  if saude > 0 then tot_desc := tot_desc + saude; end if;
  if odonto > 0 then tot_desc := tot_desc + odonto; end if;
  if adiant > 0 then tot_desc := tot_desc + adiant; end if;
  if consig > 0 then tot_desc := tot_desc + consig; end if;
  if sindical > 0 then tot_desc := tot_desc + sindical; end if;
  if pensao > 0 then tot_desc := tot_desc + pensao; end if;
  if outros_desc > 0 then tot_desc := tot_desc + outros_desc; end if;
  tot_desc := public.rh__r2(tot_desc);

  return jsonb_build_object(
    'salario_base', round(e_salario::numeric, 2),
    'proventos', round(tot_prov::numeric, 2),
    'descontos', round(tot_desc::numeric, 2),
    'adiantamentos', round(e_adiant::numeric, 2),
    'liquido', round(public.rh__r2(tot_prov - tot_desc)::numeric, 2),
    'inss', round(inss::numeric, 2),
    'irrf', round(irrf::numeric, 2),
    'base_inss', round(base_inss::numeric, 2),
    'base_irrf', round(base_irrf::numeric, 2),
    'fgts', round(public.rh__r2(base_inss * t.fgts_aliquota::float8)::numeric, 2));
end $$;

revoke all on function public.rh__r2(double precision) from public, anon, authenticated;
revoke all on function public.rh_calcular_item_folha(uuid, uuid, integer, integer) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 2. Fechar a competência: o banco recalcula e confere (gerada da definição em vigor)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.rh_fechar_competencia(p_ano integer, p_mes integer, p_itens jsonb, p_vencimento date, p_observacoes text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_corr uuid := public.correspondente_do_usuario(auth.uid());
  v_comp public.rh_folha_competencias%rowtype;
  v_qtd int;
  v_contas int := 0;
  v_tot record;
  v_ini date;
  v_fim date;
  v_nome text;
  v_calc jsonb;
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
  v_ini := make_date(p_ano, p_mes, 1);
  v_fim := (v_ini + interval '1 month' - interval '1 day')::date;

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

  -- aud2: quem entra na folha é o banco que diz (admitido até o fim do mês e não desligado antes do início).
  if exists (select 1 from public.rh_funcionarios f
              where f.correspondente_id = v_corr and f.deletado_em is null
                and f.data_admissao <= v_fim and (f.data_demissao is null or f.data_demissao >= v_ini)
                and not exists (select 1 from jsonb_array_elements(p_itens) i where (i ->> 'funcionario_id')::uuid = f.id))
     or exists (select 1 from jsonb_array_elements(p_itens) i
                  join public.rh_funcionarios f on f.id = (i ->> 'funcionario_id')::uuid
                 where f.data_admissao is null or f.data_admissao > v_fim
                    or (f.data_demissao is not null and f.data_demissao < v_ini)) then
    raise exception 'A lista de funcionários da folha mudou desde a prévia. Recalcule a prévia e feche de novo.' using errcode = '40001';
  end if;

  -- aud2: o banco recalcula cada funcionário com o motor da folha e confere o que veio.
  select jsonb_agg(jsonb_build_object('funcionario_id', i ->> 'funcionario_id',
                                       'calc', public.rh_calcular_item_folha(v_corr, (i ->> 'funcionario_id')::uuid, p_ano, p_mes),
                                       'enviado', i))
    into v_calc
    from jsonb_array_elements(p_itens) i;
  if exists (select 1 from jsonb_array_elements(v_calc) y where jsonb_typeof(y -> 'calc') is distinct from 'object') then
    raise exception 'Não há tabela da folha (INSS/IRRF) vigente em %/%. Cadastre em RH › Configurações › Tabelas da folha.',
      lpad(p_mes::text, 2, '0'), p_ano using errcode = '22023';
  end if;
  select f.nome into v_nome
    from (select (y ->> 'funcionario_id')::uuid as funcionario_id, y -> 'calc' as calc, y -> 'enviado' as enviado
          from jsonb_array_elements(v_calc) y) x
    join public.rh_funcionarios f on f.id = x.funcionario_id
   where abs((x.enviado ->> 'salario_base')::numeric - (x.calc ->> 'salario_base')::numeric) > 0.01
      or abs((x.enviado ->> 'proventos')::numeric - (x.calc ->> 'proventos')::numeric) > 0.01
      or abs((x.enviado ->> 'descontos')::numeric - (x.calc ->> 'descontos')::numeric) > 0.01
      or abs((x.enviado ->> 'liquido')::numeric - (x.calc ->> 'liquido')::numeric) > 0.01
      or abs(coalesce((x.enviado ->> 'total_adiantamentos')::numeric, 0) - (x.calc ->> 'adiantamentos')::numeric) > 0.01
      or (jsonb_typeof(x.enviado -> 'detalhamento' -> 'linhas' -> 'proventos') = 'array'
          and abs(coalesce((select sum((y ->> 'valor')::numeric) from jsonb_array_elements(x.enviado -> 'detalhamento' -> 'linhas' -> 'proventos') y), 0)
                  - (x.calc ->> 'proventos')::numeric) > 0.01)
      or (jsonb_typeof(x.enviado -> 'detalhamento' -> 'linhas' -> 'descontos') = 'array'
          and abs(coalesce((select sum((y ->> 'valor')::numeric) from jsonb_array_elements(x.enviado -> 'detalhamento' -> 'linhas' -> 'descontos') y), 0)
                  - (x.calc ->> 'descontos')::numeric) > 0.01)
   order by f.nome limit 1;
  if v_nome is not null then
    raise exception 'Os valores da folha de % não batem com o cálculo do sistema (a folha mudou desde a prévia). Recalcule a prévia e feche de novo.',
      v_nome using errcode = '40001';
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

  -- aud2: grava os valores do banco (o detalhamento da tela fica, com os números do banco por cima).
  delete from public.rh_folha_itens where competencia_id = v_comp.id;
  insert into public.rh_folha_itens (correspondente_id, competencia_id, funcionario_id, salario_base,
                                     total_beneficios, total_descontos, total_adiantamentos, liquido, detalhamento)
  select v_corr, v_comp.id, x.funcionario_id,
         (x.calc ->> 'salario_base')::numeric,
         0,
         (x.calc ->> 'descontos')::numeric,
         (x.calc ->> 'adiantamentos')::numeric,
         (x.calc ->> 'liquido')::numeric,
         (case when jsonb_typeof(x.enviado -> 'detalhamento') = 'object' then x.enviado -> 'detalhamento' else '{}'::jsonb end)
           || jsonb_build_object('adiantamentos', (x.calc ->> 'adiantamentos')::numeric, 'inss', (x.calc ->> 'inss')::numeric,
                                 'irrf', (x.calc ->> 'irrf')::numeric, 'base_inss', (x.calc ->> 'base_inss')::numeric,
                                 'base_irrf', (x.calc ->> 'base_irrf')::numeric, 'fgts', (x.calc ->> 'fgts')::numeric)
    from (select (y ->> 'funcionario_id')::uuid as funcionario_id, y -> 'calc' as calc, y -> 'enviado' as enviado
            from jsonb_array_elements(v_calc) y) x;

  select round(coalesce(sum((x.calc ->> 'proventos')::numeric), 0), 2) as proventos,
         round(coalesce(sum((x.calc ->> 'descontos')::numeric), 0), 2) as descontos,
         round(coalesce(sum((x.calc ->> 'liquido')::numeric), 0), 2) as liquido
    into v_tot
    from (select (y ->> 'funcionario_id')::uuid as funcionario_id, y -> 'calc' as calc, y -> 'enviado' as enviado
            from jsonb_array_elements(v_calc) y) x;

  update public.rh_folha_competencias
     set status = 'fechada', total_proventos = v_tot.proventos, total_descontos = v_tot.descontos,
         total_liquido = v_tot.liquido, observacoes = coalesce(nullif(btrim(p_observacoes), ''), observacoes),
         fechada_por = auth.uid(), fechada_em = now(), updated_at = now()
   where id = v_comp.id;

  insert into public.financial_payables (correspondente_id, descricao, fornecedor, vencimento, valor, status,
                                         origem_tipo, origem_ref, criador_id)
  select v_corr, format('Folha %s/%s · %s', lpad(p_mes::text, 2, '0'), p_ano, f.nome), f.nome, p_vencimento,
         (x.calc ->> 'liquido')::numeric, 'aberta', 'rh_folha', v_comp.id::text || ':' || f.id::text, auth.uid()
    from (select (y ->> 'funcionario_id')::uuid as funcionario_id, y -> 'calc' as calc
            from jsonb_array_elements(v_calc) y) x
    join public.rh_funcionarios f on f.id = x.funcionario_id
   where (x.calc ->> 'liquido')::numeric > 0 and f.gerar_contas_pagar_automatico;
  get diagnostics v_contas = row_count;

  perform set_config('rh.folha_rpc', '', true);
  return jsonb_build_object('competencia_id', v_comp.id, 'total', v_tot.liquido, 'contas', v_contas,
                            'itens', jsonb_array_length(p_itens));
end $function$;

revoke all on function public.rh_fechar_competencia(integer, integer, jsonb, date, text) from public, anon;
grant execute on function public.rh_fechar_competencia(integer, integer, jsonb, date, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Ficha ligada a usuário: exige "Salários · ver" e usuário da mesma empresa
-- -----------------------------------------------------------------------------
create or replace function public.rh_funcionario_guardar_vinculo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or new.user_id is null
     or (tg_op = 'UPDATE' and new.user_id is not distinct from old.user_id) then
    return new;
  end if;
  if public.correspondente_do_usuario(new.user_id) is distinct from new.correspondente_id then
    raise exception 'O usuário ligado à ficha precisa ser da mesma empresa.' using errcode = '42501';
  end if;
  if not public.rh_pode('rh.salarios', 'view') then
    raise exception 'Ligar a ficha a um usuário libera os holerites dela para ele: exige a permissão RH · Salários · ver.'
      using errcode = '42501';
  end if;
  return new;
end $$;
revoke all on function public.rh_funcionario_guardar_vinculo() from public, anon, authenticated;
drop trigger if exists rh_funcionario_guardar_vinculo on public.rh_funcionarios;
create trigger rh_funcionario_guardar_vinculo before insert or update of user_id on public.rh_funcionarios
  for each row execute function public.rh_funcionario_guardar_vinculo();

-- -----------------------------------------------------------------------------
-- 4. Faltas para a prévia da folha (sem CID nem justificativa)
-- -----------------------------------------------------------------------------
-- A prévia da tela lia `rh_ocorrencias` direto, e a RLS dela exige "Ocorrências · ver": quem
-- fecha a folha sem essa permissão via a prévia SEM as faltas (pagava o dia não trabalhado). Com
-- o banco conferindo, a folha dessa pessoa nunca fecharia. As faltas que a folha usa vêm daqui:
-- só data, fim e abono, da empresa, para quem vê a folha ou os salários.
create or replace function public.rh_faltas_da_folha(p_ids uuid[], p_ini date, p_fim date)
returns table (funcionario_id uuid, data_inicio date, data_fim date, abonada boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not (public.rh_pode('rh.folha', 'view') or public.rh_pode('rh.salarios', 'view') or public.rh_pode('rh.ocorrencias', 'view')) then
    raise exception 'Você não tem permissão para ver a folha.' using errcode = '42501';
  end if;
  if p_ini is null or p_fim is null or p_fim < p_ini or p_fim - p_ini > 62 or coalesce(cardinality(p_ids), 0) > 5000 then
    raise exception 'Pedido inválido.' using errcode = '22023';
  end if;
  return query
    select o.funcionario_id, o.data_inicio, o.data_fim, o.abonada
      from public.rh_ocorrencias o
     where o.funcionario_id = any (p_ids) and o.tipo = 'falta'
       and o.correspondente_id = public.correspondente_do_usuario(auth.uid())
       and o.data_inicio <= p_fim and coalesce(o.data_fim, o.data_inicio) >= p_ini;
end $$;
revoke all on function public.rh_faltas_da_folha(uuid[], date, date) from public, anon;
grant execute on function public.rh_faltas_da_folha(uuid[], date, date) to authenticated;
