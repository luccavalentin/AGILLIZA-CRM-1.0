-- Unifica o formato de estado civil / regime de casamento entre CRM, simulação
-- e proposta, e dá à simulação um lugar para guardar o sexo do titular e do
-- cônjuge.
--
-- Problema: `clientes.estado_civil` é enum em texto ("casado"), enquanto os
-- formulários de simulação/proposta e o contrato da integração usam códigos
-- ("CA"). O trigger `sync_cliente_derivados` copiava o texto do CRM para
-- `simulacoes`, `propostas` e `proposta_envolvidos` — e o <Select> dessas telas,
-- que só conhece os códigos, abria vazio. Em produção havia 1.592 simulações com
-- "casado" contra 760 com "CA", e nenhum regime em código.
--
-- Sexo: `simulacoes` não tinha coluna. O formulário coletava, gravava só no
-- cliente, e ao reabrir a simulação o campo voltava vazio.
--
-- Idempotente: pode ser reaplicada sem efeito colateral.

-- 0. Status "aguardando_envio" ------------------------------------------------
-- O código grava `propostas.status = 'aguardando_envio'` no início do envio
-- (state-machine.ts), mas o valor nunca entrou no enum: o UPDATE falhava em
-- silêncio e levava junto `enviada_em` e a limpeza de `ultimo_erro`.
alter type public.proposta_status add value if not exists 'aguardando_envio' after 'rascunho';

-- 1. Conversores enum-do-CRM -> código da integração --------------------------
create or replace function public.estado_civil_codigo(_v text)
returns text
language sql
immutable
set search_path to 'public'
as $$
  select case lower(coalesce(_v, ''))
    when 'solteiro'      then 'S'
    when 'casado'        then 'CA'
    when 'uniao_estavel' then 'UE'
    when 'divorciado'    then 'DI'
    when 'viuvo'         then 'VI'
    when 'separado'      then 'SL'
    -- já em código: devolve como está (maiúsculo)
    when 's'  then 'S'  when 'ca' then 'CA' when 'ue' then 'UE'
    when 'di' then 'DI' when 'vi' then 'VI' when 'sl' then 'SL'
    else null
  end
$$;

create or replace function public.regime_casamento_codigo(_v text)
returns text
language sql
immutable
set search_path to 'public'
as $$
  select case lower(coalesce(_v, ''))
    when 'comunhao_parcial'       then 'CP'
    when 'comunhao_universal'     then 'CU'
    when 'separacao_total'        then 'SC'
    when 'separacao_convencional' then 'SC'
    when 'separacao_obrigatoria'  then 'SO'
    when 'participacao_final'     then 'PA'
    when 'cp' then 'CP' when 'cu' then 'CU' when 'sc' then 'SC'
    when 'so' then 'SO' when 'pa' then 'PA'
    -- "nao_aplicavel" e vazio não têm código no banco
    else null
  end
$$;

revoke execute on function public.estado_civil_codigo(text) from public, anon;
revoke execute on function public.regime_casamento_codigo(text) from public, anon;

-- 2. Sexo do titular e do cônjuge na simulação ---------------------------------
alter table public.simulacoes add column if not exists sexo text;
alter table public.simulacoes add column if not exists sexo_conjuge text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'simulacoes_sexo_check') then
    alter table public.simulacoes
      add constraint simulacoes_sexo_check check (sexo is null or sexo in ('M', 'F'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'simulacoes_sexo_conjuge_check') then
    alter table public.simulacoes
      add constraint simulacoes_sexo_conjuge_check check (sexo_conjuge is null or sexo_conjuge in ('M', 'F'));
  end if;
end $$;

comment on column public.simulacoes.sexo is 'Sexo do titular (M/F) como enviado ao banco. Espelhado de clientes.sexo pelo trigger sync_cliente_derivados.';
comment on column public.simulacoes.sexo_conjuge is 'Sexo do cônjuge (M/F). Espelhado de clientes.conjuge_sexo pelo trigger sync_cliente_derivados.';

-- 3. Trigger passa a gravar código (e a espelhar o sexo) ------------------------
create or replace function public.sync_cliente_derivados()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  casado boolean;
  estado_civil_conhecido boolean;
  v_estado_civil text;
  v_regime text;
  v_sexo text;
  v_sexo_conjuge text;
begin
  casado := coalesce(new.estado_civil in ('casado', 'uniao_estavel'), false);
  estado_civil_conhecido := new.estado_civil is not null;

  -- Formato único: código da integração (S/CA/UE/DI/VI e CP/CU/SC/SO/PA).
  v_estado_civil := public.estado_civil_codigo(new.estado_civil::text);
  v_regime := public.regime_casamento_codigo(new.regime_casamento::text);
  -- Sexo normalizado pela inicial; valor fora de M/F não sobrescreve nada.
  v_sexo := case when upper(left(coalesce(new.sexo, ''), 1)) in ('M', 'F') then upper(left(new.sexo, 1)) end;
  v_sexo_conjuge := case when upper(left(coalesce(new.conjuge_sexo, ''), 1)) in ('M', 'F') then upper(left(new.conjuge_sexo, 1)) end;

  -- Simulações vinculadas: atualiza snapshot do titular e do cônjuge
  update public.simulacoes set
    nome_cliente = coalesce(new.nome, nome_cliente),
    cpf_cnpj = coalesce(new.documento, cpf_cnpj),
    email = coalesce(new.email, email),
    celular = coalesce(new.telefone_celular, celular),
    data_nascimento = coalesce(new.data_nascimento, data_nascimento),
    estado_civil = v_estado_civil,
    regime_casamento = v_regime,
    sexo = coalesce(v_sexo, sexo),
    renda_total = coalesce(new.renda_total_declarada, renda_total),
    possui_conjuge = case when estado_civil_conhecido then casado else possui_conjuge end,
    nome_conjuge = case when not estado_civil_conhecido then nome_conjuge when casado then new.conjuge_nome else null end,
    cpf_conjuge = case when not estado_civil_conhecido then cpf_conjuge when casado then new.conjuge_cpf else null end,
    email_conjuge = case when not estado_civil_conhecido then email_conjuge when casado then new.conjuge_email else null end,
    celular_conjuge = case when not estado_civil_conhecido then celular_conjuge when casado then new.conjuge_celular else null end,
    data_nascimento_conjuge = case when not estado_civil_conhecido then data_nascimento_conjuge when casado then new.conjuge_data_nascimento else null end,
    renda_conjuge = case when not estado_civil_conhecido then renda_conjuge when casado then new.conjuge_renda else null end,
    sexo_conjuge = case when not estado_civil_conhecido then sexo_conjuge when casado then coalesce(v_sexo_conjuge, sexo_conjuge) else null end,
    compoe_renda = case when not estado_civil_conhecido then compoe_renda when casado then compoe_renda else false end,
    updated_at = now()
  where cliente_id = new.id;

  -- Propostas não terminais: snapshot básico + flag de cônjuge
  update public.propostas set
    nome_cliente = coalesce(new.nome, nome_cliente),
    estado_civil = v_estado_civil,
    possui_conjuge = case when estado_civil_conhecido then casado else possui_conjuge end
  where cliente_id = new.id
    and status not in ('contrato_emitido', 'cancelada', 'credito_recusado');

  -- Envolvidos titulares (não-cônjuges) das propostas do cliente
  update public.proposta_envolvidos set
    nome = coalesce(new.nome, nome),
    cpf_cnpj = coalesce(new.documento, cpf_cnpj),
    email = coalesce(new.email, email),
    celular = coalesce(new.telefone_celular, celular),
    data_nascimento = coalesce(new.data_nascimento, data_nascimento),
    estado_civil = v_estado_civil,
    regime_casamento = v_regime,
    renda = coalesce(new.renda_total_declarada, renda),
    nome_mae = coalesce(new.mae, nome_mae),
    profissao = coalesce(new.profissao, profissao),
    empresa = coalesce(new.empresa, empresa),
    tipo_sexo = coalesce(v_sexo, tipo_sexo),
    updated_at = now()
  where cliente_id = new.id and conjuge_de is null;

  if casado then
    update public.proposta_envolvidos c set
      nome = coalesce(new.conjuge_nome, c.nome),
      cpf_cnpj = coalesce(new.conjuge_cpf, c.cpf_cnpj),
      email = coalesce(new.conjuge_email, c.email),
      celular = coalesce(new.conjuge_celular, c.celular),
      data_nascimento = coalesce(new.conjuge_data_nascimento, c.data_nascimento),
      renda = coalesce(new.conjuge_renda, c.renda),
      nome_mae = coalesce(new.conjuge_nome_mae, c.nome_mae),
      profissao = coalesce(new.conjuge_profissao, c.profissao),
      empresa = coalesce(new.conjuge_empresa, c.empresa),
      tipo_sexo = coalesce(v_sexo_conjuge, c.tipo_sexo),
      updated_at = now()
    from public.proposta_envolvidos t
    where t.cliente_id = new.id
      and t.conjuge_de is null
      and c.conjuge_de = t.id;

    if new.conjuge_nome is not null and new.conjuge_cpf is not null then
      insert into public.proposta_envolvidos (
        proposta_id, cliente_id, tipo_qualificacao, conjuge_de,
        nome, cpf_cnpj, email, celular, data_nascimento, renda,
        nome_mae, profissao, empresa, tipo_sexo, tipo_pessoa
      )
      select t.proposta_id, null, 'TI', t.id,
             new.conjuge_nome, new.conjuge_cpf, new.conjuge_email, new.conjuge_celular,
             new.conjuge_data_nascimento, new.conjuge_renda,
             new.conjuge_nome_mae, new.conjuge_profissao, new.conjuge_empresa,
             v_sexo_conjuge, 'F'
      from public.proposta_envolvidos t
      left join public.proposta_envolvidos c on c.conjuge_de = t.id
      where t.cliente_id = new.id
        and t.conjuge_de is null
        and c.id is null;
    end if;
  elsif estado_civil_conhecido then
    delete from public.proposta_envolvidos c
    using public.proposta_envolvidos t
    where t.cliente_id = new.id
      and t.conjuge_de is null
      and c.conjuge_de = t.id;
  end if;

  return new;
end;
$function$;

revoke execute on function public.sync_cliente_derivados() from public, anon, authenticated;

-- 4. Backfill das linhas gravadas em texto, com cópia de segurança --------------
create table if not exists public._bkp_20260911_estado_civil (
  origem text not null,
  id uuid not null,
  estado_civil text,
  estado_civil_conjuge text,
  regime_casamento text,
  copiado_em timestamptz not null default now(),
  primary key (origem, id)
);
-- Só o service role lê a cópia (sem policy = ninguém via API).
alter table public._bkp_20260911_estado_civil enable row level security;

insert into public._bkp_20260911_estado_civil (origem, id, estado_civil, estado_civil_conjuge, regime_casamento)
select 'simulacoes', id, estado_civil, estado_civil_conjuge, regime_casamento
from public.simulacoes
where (estado_civil is not null and estado_civil <> coalesce(public.estado_civil_codigo(estado_civil), ''))
   or (estado_civil_conjuge is not null and estado_civil_conjuge <> coalesce(public.estado_civil_codigo(estado_civil_conjuge), ''))
   or (regime_casamento is not null and regime_casamento <> coalesce(public.regime_casamento_codigo(regime_casamento), ''))
on conflict do nothing;

insert into public._bkp_20260911_estado_civil (origem, id, estado_civil, regime_casamento)
select 'proposta_envolvidos', id, estado_civil, regime_casamento
from public.proposta_envolvidos
where (estado_civil is not null and estado_civil <> coalesce(public.estado_civil_codigo(estado_civil), ''))
   or (regime_casamento is not null and regime_casamento <> coalesce(public.regime_casamento_codigo(regime_casamento), ''))
on conflict do nothing;

insert into public._bkp_20260911_estado_civil (origem, id, estado_civil)
select 'propostas', id, estado_civil
from public.propostas
where estado_civil is not null and estado_civil <> coalesce(public.estado_civil_codigo(estado_civil), '')
on conflict do nothing;

-- O backfill é só de formato. Os triggers de esteira/comissão reagem a UPDATE
-- (mesmo sem mudança de status, quando falta histórico) e disparariam
-- notificação e avanço de etapa para milhares de linhas antigas. Ficam
-- desligados só durante este bloco.
alter table public.simulacoes disable trigger trg_simulacao_sincronizar_esteira;
alter table public.simulacoes disable trigger on_simulacao_comissoes_usuario;
alter table public.propostas disable trigger trg_proposta_sincronizar_esteira;
alter table public.propostas disable trigger trg_proposta_contrato_emitido;

-- Só mexe no que tem tradução; valor desconhecido (ex.: '' ou lixo) fica como está.
update public.simulacoes set
  estado_civil = public.estado_civil_codigo(estado_civil)
where estado_civil is not null
  and public.estado_civil_codigo(estado_civil) is not null
  and estado_civil <> public.estado_civil_codigo(estado_civil);

update public.simulacoes set estado_civil_conjuge = public.estado_civil_codigo(estado_civil_conjuge)
where estado_civil_conjuge is not null
  and public.estado_civil_codigo(estado_civil_conjuge) is not null
  and estado_civil_conjuge <> public.estado_civil_codigo(estado_civil_conjuge);

update public.simulacoes set regime_casamento = public.regime_casamento_codigo(regime_casamento)
where regime_casamento is not null
  and public.regime_casamento_codigo(regime_casamento) is not null
  and regime_casamento <> public.regime_casamento_codigo(regime_casamento);

update public.proposta_envolvidos set estado_civil = public.estado_civil_codigo(estado_civil)
where estado_civil is not null
  and public.estado_civil_codigo(estado_civil) is not null
  and estado_civil <> public.estado_civil_codigo(estado_civil);

update public.proposta_envolvidos set regime_casamento = public.regime_casamento_codigo(regime_casamento)
where regime_casamento is not null
  and public.regime_casamento_codigo(regime_casamento) is not null
  and regime_casamento <> public.regime_casamento_codigo(regime_casamento);

update public.propostas set estado_civil = public.estado_civil_codigo(estado_civil)
where estado_civil is not null
  and public.estado_civil_codigo(estado_civil) is not null
  and estado_civil <> public.estado_civil_codigo(estado_civil);

-- 5. Sexo das simulações existentes, a partir do cadastro do cliente ------------
update public.simulacoes s set
  sexo = case when upper(left(coalesce(c.sexo, ''), 1)) in ('M', 'F') then upper(left(c.sexo, 1)) end,
  sexo_conjuge = case
    when s.possui_conjuge and upper(left(coalesce(c.conjuge_sexo, ''), 1)) in ('M', 'F') then upper(left(c.conjuge_sexo, 1))
  end
from public.clientes c
where c.id = s.cliente_id
  and s.sexo is null
  and (c.sexo is not null or c.conjuge_sexo is not null);

alter table public.simulacoes enable trigger trg_simulacao_sincronizar_esteira;
alter table public.simulacoes enable trigger on_simulacao_comissoes_usuario;
alter table public.propostas enable trigger trg_proposta_sincronizar_esteira;
alter table public.propostas enable trigger trg_proposta_contrato_emitido;
