-- =============================================================================
-- Financeiro da matriz (frente a5) — 2/3: os fluxos.
--
--   A. Comissões recebidas dos bancos (public.comissoes): previsão no gatilho com a
--      regra gravada, valor informado pelo banco, recebimento (só por baixa), parcial,
--      divergência, contestação, cancelamento com motivo, lançamento manual.
--   B. Comissões de corretores e parceiros (public.comissoes_usuario): participantes
--      por proposta (originou/atendeu/participou), regra individual ou geral do papel
--      (a individual prevalece), percentual ou fixo, base (financiado, contrato,
--      comissão do banco), estados prevista → aguardando confirmação → aprovada →
--      parcial → paga, contestação, ajuste e cancelamento com motivo.
--   C. Contas a pagar (com boleto e rascunho) e outras receitas.
--   D. Livro de baixas: registrar e estornar recebimento/pagamento (parcial, comprovante).
--
-- Regra gravada: cada lançamento guarda a cópia da regra usada; mudar a regra NÃO
-- recalcula lançamento nenhum (as funções antigas que recalculavam foram removidas).
-- Registro do contrato e aprovação de crédito só geram PREVISÃO: nada vira recebido
-- ou pago sem baixa feita por quem tem a permissão (ou conciliação confirmada).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Funções antigas que recalculavam o histórico, apagavam lançamentos ou geravam
--    comissão na simulação: saem (as telas novas usam as funções abaixo).
-- -----------------------------------------------------------------------------
drop trigger if exists on_simulacao_comissoes_usuario on public.simulacoes;
drop function if exists public.trg_simulacao_comissoes_usuario();
drop function if exists public.calcular_comissoes_usuario_simulacao(uuid);
drop function if exists public.sincronizar_comissoes_usuario_regra(uuid);
drop function if exists public.excluir_regra_comissao_usuario(uuid);
drop function if exists public.recalcular_comissoes_usuario_correspondente(uuid);

-- -----------------------------------------------------------------------------
-- A. Comissões dos bancos
-- -----------------------------------------------------------------------------
/** Situação derivada dos valores (cancelado e contestado são decisões de pessoa). */
create or replace function public.fin_cb_situacao(_c public.comissoes, _tol numeric)
returns text language sql immutable set search_path = public as $$
  select case
    when _c.situacao = 'cancelado' then 'cancelado'
    when _c.situacao = 'contestado' then 'contestado'
    when _c.valor_recebido > 0 and _c.valor_recebido > coalesce(_c.valor_informado, _c.valor_bruto) + _tol then 'divergente'
    when _c.valor_recebido > 0 and (_c.valor_recebido + _tol >= coalesce(_c.valor_informado, _c.valor_bruto)
                                    or _c.encerrado_com_diferenca) then 'recebido'
    when _c.valor_recebido > 0 then 'parcial'
    when _c.valor_informado is not null and abs(_c.valor_informado - _c.valor_bruto) > _tol then 'divergente'
    when _c.valor_informado is not null then 'a_receber'
    else 'previsto'
  end
$$;

/** Recalcula recebido/situação a partir do livro e libera os participantes que esperavam o banco. */
create or replace function public.fin_cb_atualizar(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  c public.comissoes;
  v_sit text;
  v_antes text;
begin
  select * into c from public.comissoes where id = _id for update;
  if not found then return; end if;
  v_antes := c.situacao;
  c.valor_recebido := public.fin_total_baixado('comissao_banco', _id);
  v_sit := public.fin_cb_situacao(c, (public.fin_param(c.correspondente_id)).tolerancia_divergencia);
  update public.comissoes
     set valor_recebido = c.valor_recebido,
         situacao = v_sit,
         status = case when v_sit = 'recebido' then 'recebida'::public.comissao_status
                       when v_sit = 'cancelado' then 'encerrada'::public.comissao_status
                       else 'a_receber'::public.comissao_status end
   where id = _id
     and (valor_recebido is distinct from c.valor_recebido or situacao is distinct from v_sit);
  if v_sit = 'recebido' and v_antes is distinct from 'recebido' then
    perform public.fin_cu_apos_recebimento_banco(_id);
  end if;
end $$;

/**
 * Data do gatilho de uma etapa da proposta: é nela que se escolhe a regra vigente (e dela
 * contam os prazos). Registro: `contrato_registrado_em` (frente a3, lida por to_jsonb para não
 * depender da coluna); contrato emitido: `contrato_emitido_em`; demais etapas (ou sem data): hoje.
 */
create or replace function public.fin_data_gatilho(_p public.propostas, _gatilho text)
returns date language sql stable set search_path = public as $$
  select coalesce(case _gatilho
                    when 'registrado' then (to_jsonb(_p) ->> 'contrato_registrado_em')::timestamptz::date
                    when 'contrato_emitido' then _p.contrato_emitido_em::date
                  end, current_date)
$$;

/** Previsão da comissão do banco para a proposta (uma por proposta; regra gravada). */
create or replace function public.calcular_comissao_proposta(_prop_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  p public.propostas;
  r public.comissao_regras;
  v_base numeric;
  v_fonte text;
  v_bruto numeric := 0;
  v_pct numeric := 0;
  v_id uuid;
  v_par public.fin_parametros;
  v_data date;
begin
  select * into p from public.propostas where id = _prop_id;
  if not found or p.deleted_at is not null then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended('fin_cb:' || _prop_id::text, 0));
  -- Data do gatilho (registro escolhido pelo analista, contrato emitido ou hoje): a regra vigente nela.
  v_data := public.fin_data_gatilho(p, p.status::text);
  select id into v_id from public.comissoes where proposta_id = _prop_id and situacao <> 'cancelado'
   order by created_at limit 1;
  if v_id is not null then return v_id; end if;

  v_par := public.fin_param(p.correspondente_id);
  if coalesce(p.valor_financiamento_aprovado, 0) > 0 then
    v_base := p.valor_financiamento_aprovado; v_fonte := 'valor_financiamento_aprovado';
  else
    v_base := coalesce(p.valor_financiamento, 0); v_fonte := 'valor_financiamento';
  end if;

  select * into r from public.comissao_regras cr
   where cr.correspondente_id = p.correspondente_id and cr.ativo
     and (cr.produto is null or cr.produto = p.produto)
     and (cr.banco_nome is null or cr.banco_nome = p.nome_banco)
     and cr.faixa_min <= v_base and (cr.faixa_max is null or cr.faixa_max >= v_base)
     and (cr.vigencia_inicio is null or cr.vigencia_inicio <= v_data)
     and (cr.vigencia_fim is null or cr.vigencia_fim >= v_data)
   order by (cr.produto is not null) desc, (cr.banco_nome is not null) desc, cr.faixa_min desc, cr.created_at desc
   limit 1;
  if r.id is not null then
    if r.tipo = 'percentual' then
      v_pct := r.valor;
      v_bruto := round(v_base * r.valor / 100.0, 2);
    else
      v_pct := case when v_base > 0 then round(r.valor / v_base * 100.0, 4) else 0 end;
      v_bruto := round(r.valor, 2);
    end if;
  end if;

  perform public.fin_ctx('previsao_gerada', 'Gatilho da proposta (' || p.status::text || ')');
  insert into public.comissoes (
    correspondente_id, proposta_id, parceiro_id, usuario_responsavel_id, banco_nome, produto, valor_base,
    percentual, valor_bruto, split_parceiro, split_interno, status, regra_id, situacao, previsao_recebimento,
    cliente_nome, numero_contrato, origem_calculo, origem)
  values (
    p.correspondente_id, _prop_id, p.parceiro_id, p.usuario_responsavel_id, p.nome_banco, p.produto, v_base,
    v_pct, v_bruto, 0, v_bruto, 'a_receber', r.id, 'previsto', v_data + v_par.dias_previsao_recebimento,
    p.nome_cliente, p.numero_proposta_banco,
    jsonb_build_object('fonte', 'regra_do_banco', 'gatilho', p.status::text, 'data_calculo', current_date, 'data_gatilho', v_data,
                       'base', v_base, 'base_fonte', v_fonte, 'sem_regra', r.id is null,
                       'regra', case when r.id is null then null
                                     else to_jsonb(r) - 'created_at' - 'updated_at' end),
    'gatilho')
  returning id into v_id;
  perform public.fin_ctx_fim();
  return v_id;
end $$;

/** Gatilho das propostas: previsão do banco no gatilho configurado; participantes em toda etapa. */
create or replace function public.on_proposta_contrato_emitido()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_gat text;
begin
  if old.status is distinct from new.status then
    begin
      v_gat := (public.fin_param(new.correspondente_id)).gatilho_comissao_banco;
      if new.status::text = 'registrado' or (v_gat = 'contrato_emitido' and new.status::text = 'contrato_emitido') then
        perform public.calcular_comissao_proposta(new.id);
      end if;
      perform public.calcular_comissoes_usuario_proposta(new.id, new.status::text);
    exception when others then
      -- O fluxo da proposta nunca trava por causa do financeiro; a falha fica na auditoria.
      perform public.fin_ctx_fim();
      insert into public.fin_auditoria (correspondente_id, entidade, entidade_id, acao, depois)
      values (new.correspondente_id, 'propostas', new.id, 'falha_gatilho_financeiro',
              jsonb_build_object('status', new.status::text, 'erro', sqlerrm, 'codigo', sqlstate));
    end;
  end if;
  return new;
end $$;

create or replace function public.fin_cb_lancar(_d jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_corr uuid := public.fin_exigir('financeiro.comissoes_bancos', 'create');
  p public.propostas;
  v_prop uuid := nullif(_d ->> 'proposta_id', '')::uuid;
  v_valor numeric := round(coalesce((_d ->> 'valor_previsto')::numeric, 0), 2);
  v_contrato text := nullif(btrim(_d ->> 'numero_contrato'), '');
  v_banco text := nullif(btrim(_d ->> 'banco_nome'), '');
  v_dup text;
  v_id uuid;
begin
  if v_valor < 0 or v_valor >= 1000000000 then
    raise exception 'Valor previsto inválido.' using errcode = '22023';
  end if;
  if v_prop is not null then
    select * into p from public.propostas where id = v_prop and correspondente_id = v_corr and deleted_at is null;
    if not found then raise exception 'Proposta não encontrada.' using errcode = 'P0002'; end if;
    perform pg_advisory_xact_lock(hashtextextended('fin_cb:' || v_prop::text, 0));
  end if;
  if v_banco is null and p.id is null then
    raise exception 'Informe o banco.' using errcode = '22023';
  end if;
  select string_agg(coalesce(c.numero_contrato, c.cliente_nome, c.id::text), ', ') into v_dup
    from public.comissoes c
   where c.correspondente_id = v_corr and c.situacao <> 'cancelado'
     and ((v_prop is not null and c.proposta_id = v_prop)
          or (v_contrato is not null and c.numero_contrato = v_contrato and c.banco_nome is not distinct from coalesce(v_banco, p.nome_banco)));
  if v_dup is not null and not coalesce((_d ->> 'confirmar_duplicidade')::boolean, false) then
    raise exception 'Possível duplicidade: já existe comissão desta proposta/contrato (%).', v_dup
      using errcode = 'P0001', hint = 'duplicidade';
  end if;
  if v_dup is not null and length(btrim(coalesce(_d ->> 'justificativa', ''))) < 5 then
    raise exception 'Para lançar em duplicidade, escreva a justificativa.' using errcode = '22023';
  end if;
  perform public.fin_ctx('lancamento_manual', nullif(btrim(_d ->> 'justificativa'), ''));
  insert into public.comissoes (
    correspondente_id, proposta_id, parceiro_id, usuario_responsavel_id, banco_nome, produto, valor_base, percentual,
    valor_bruto, split_parceiro, split_interno, status, situacao, previsao_recebimento, cliente_nome, numero_contrato,
    origem_calculo, origem, observacao, criado_por, duplicidade_justificativa)
  values (
    v_corr, v_prop, p.parceiro_id, p.usuario_responsavel_id, coalesce(v_banco, p.nome_banco),
    coalesce(nullif(btrim(_d ->> 'produto'), ''), p.produto),
    round(coalesce((_d ->> 'valor_base')::numeric, p.valor_financiamento_aprovado, p.valor_financiamento, 0), 2),
    coalesce((_d ->> 'percentual')::numeric, 0), v_valor, 0, v_valor, 'a_receber', 'previsto',
    coalesce(nullif(_d ->> 'previsao_recebimento', '')::date, current_date + (public.fin_param(v_corr)).dias_previsao_recebimento),
    coalesce(nullif(btrim(_d ->> 'cliente_nome'), ''), p.nome_cliente),
    coalesce(v_contrato, p.numero_proposta_banco),
    jsonb_build_object('fonte', 'manual', 'data_calculo', current_date, 'valor_previsto', v_valor,
                       'percentual', (_d ->> 'percentual')::numeric, 'base', (_d ->> 'valor_base')::numeric,
                       'origem_do_calculo', nullif(btrim(_d ->> 'origem_do_calculo'), '')),
    'manual', nullif(btrim(_d ->> 'observacao'), ''), auth.uid(),
    case when v_dup is not null then btrim(_d ->> 'justificativa') end)
  returning id into v_id;
  perform public.fin_cb_atualizar(v_id);
  perform public.fin_ctx_fim();
  return jsonb_build_object('id', v_id);
end $$;

/** Valor que o banco informou (relatório/extrato do banco). Recebimento é outra ação. */
create or replace function public.fin_cb_informar(_id uuid, _valor numeric, _observacao text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_corr uuid;
  c public.comissoes;
begin
  if not (public.fin_pode('financeiro.comissoes_bancos', 'create') or public.fin_pode('financeiro.comissoes_bancos', 'edit')) then
    raise exception 'Você não tem permissão para informar valores das comissões dos bancos.' using errcode = '42501';
  end if;
  v_corr := public.fin_corr();
  select * into c from public.comissoes where id = _id and correspondente_id = v_corr for update;
  if not found then raise exception 'Comissão não encontrada.' using errcode = 'P0002'; end if;
  if c.situacao = 'cancelado' then raise exception 'Comissão cancelada.' using errcode = '55000'; end if;
  if _valor is null or _valor < 0 or _valor >= 1000000000 then raise exception 'Valor inválido.' using errcode = '22023'; end if;
  perform public.fin_ctx('valor_informado', _observacao);
  update public.comissoes
     set valor_informado = round(_valor, 2), informado_em = now(), informado_por = auth.uid(),
         observacao = coalesce(nullif(btrim(_observacao), ''), observacao)
   where id = _id;
  perform public.fin_cb_atualizar(_id);
  perform public.fin_ctx_fim();
end $$;

/** Corrige a previsão (com motivo). A regra gravada fica em origem_calculo, com o valor anterior. */
create or replace function public.fin_cb_corrigir_previsao(_id uuid, _valor numeric, _motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_corr uuid := public.fin_exigir('financeiro.comissoes_bancos', 'edit');
  c public.comissoes;
begin
  if length(btrim(coalesce(_motivo, ''))) < 5 then raise exception 'Escreva o motivo da correção.' using errcode = '22023'; end if;
  if _valor is null or _valor < 0 or _valor >= 1000000000 then raise exception 'Valor inválido.' using errcode = '22023'; end if;
  select * into c from public.comissoes where id = _id and correspondente_id = v_corr for update;
  if not found then raise exception 'Comissão não encontrada.' using errcode = 'P0002'; end if;
  if c.situacao in ('cancelado', 'recebido') then
    raise exception 'Comissão recebida ou cancelada não muda de previsão.' using errcode = '55000';
  end if;
  perform public.fin_ctx('previsao_corrigida', _motivo);
  update public.comissoes
     set valor_bruto = round(_valor, 2), split_interno = round(_valor, 2),
         origem_calculo = coalesce(origem_calculo, '{}'::jsonb)
                          || jsonb_build_object('correcoes', coalesce(origem_calculo -> 'correcoes', '[]'::jsonb)
                               || jsonb_build_array(jsonb_build_object('de', c.valor_bruto, 'para', round(_valor, 2),
                                                    'motivo', _motivo, 'por', auth.uid(), 'em', now())))
   where id = _id;
  perform public.fin_cb_atualizar(_id);
  perform public.fin_ctx_fim();
end $$;

create or replace function public.fin_cb_contestar(_id uuid, _motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare v_corr uuid := public.fin_exigir('financeiro.comissoes_bancos', 'edit');
begin
  if length(btrim(coalesce(_motivo, ''))) < 5 then raise exception 'Escreva o motivo da contestação.' using errcode = '22023'; end if;
  perform public.fin_ctx('contestada', _motivo);
  update public.comissoes set situacao = 'contestado', contestacao_motivo = btrim(_motivo)
   where id = _id and correspondente_id = v_corr and situacao not in ('cancelado', 'contestado');
  if not found then raise exception 'Comissão não encontrada ou não pode ser contestada.' using errcode = 'P0002'; end if;
  perform public.fin_ctx_fim();
end $$;

create or replace function public.fin_cb_resolver_contestacao(_id uuid, _motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare v_corr uuid := public.fin_exigir('financeiro.comissoes_bancos', 'edit');
begin
  if length(btrim(coalesce(_motivo, ''))) < 5 then raise exception 'Escreva como a contestação foi resolvida.' using errcode = '22023'; end if;
  perform public.fin_ctx('contestacao_resolvida', _motivo);
  update public.comissoes set situacao = 'previsto' where id = _id and correspondente_id = v_corr and situacao = 'contestado';
  if not found then raise exception 'Comissão não está contestada.' using errcode = 'P0002'; end if;
  perform public.fin_cb_atualizar(_id);
  perform public.fin_ctx_fim();
end $$;

create or replace function public.fin_cb_cancelar(_id uuid, _motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_corr uuid := public.fin_exigir('financeiro.comissoes_bancos', 'edit');
  c public.comissoes;
begin
  if length(btrim(coalesce(_motivo, ''))) < 5 then raise exception 'Escreva o motivo do cancelamento.' using errcode = '22023'; end if;
  select * into c from public.comissoes where id = _id and correspondente_id = v_corr for update;
  if not found then raise exception 'Comissão não encontrada.' using errcode = 'P0002'; end if;
  if c.situacao = 'cancelado' then raise exception 'Comissão já cancelada.' using errcode = '55000'; end if;
  if public.fin_total_baixado('comissao_banco', _id) > 0 then
    raise exception 'Há recebimento registrado: estorne o recebimento antes de cancelar.' using errcode = '55000';
  end if;
  perform public.fin_ctx('cancelada', _motivo);
  update public.comissoes set situacao = 'cancelado', cancelamento_motivo = btrim(_motivo), status = 'encerrada'
   where id = _id;
  perform public.fin_ctx_fim();
end $$;

/** Parcial que o banco não vai completar: encerra como recebido, com a diferença registrada. */
create or replace function public.fin_cb_encerrar_com_diferenca(_id uuid, _motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare v_corr uuid := public.fin_exigir('financeiro.comissoes_bancos', 'receber');
begin
  if length(btrim(coalesce(_motivo, ''))) < 5 then raise exception 'Escreva o motivo da diferença.' using errcode = '22023'; end if;
  perform public.fin_ctx('encerrada_com_diferenca', _motivo);
  update public.comissoes set encerrado_com_diferenca = true, encerramento_motivo = btrim(_motivo)
   where id = _id and correspondente_id = v_corr and situacao = 'parcial';
  if not found then raise exception 'Só uma comissão parcialmente recebida pode ser encerrada com diferença.' using errcode = '55000'; end if;
  perform public.fin_cb_atualizar(_id);
  perform public.fin_ctx_fim();
end $$;

/** Propostas com contrato emitido/registrado sem previsão: gera as que faltam (nunca recalcula). */
create or replace function public.fin_cb_gerar_faltantes()
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_corr uuid := public.fin_exigir('financeiro.comissoes_bancos', 'create');
  v_n integer := 0;
  r record;
begin
  for r in
    select p.id from public.propostas p
     where p.correspondente_id = v_corr and p.deleted_at is null
       and p.status::text in ('contrato_emitido', 'registrado')
       and not exists (select 1 from public.comissoes c where c.proposta_id = p.id and c.situacao <> 'cancelado')
     limit 500
  loop
    perform public.calcular_comissao_proposta(r.id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- Regras do banco (editar regra nunca muda previsão já gerada: ela tem a cópia)
create or replace function public.fin_regra_banco_salvar(_d jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_corr uuid := public.fin_exigir('financeiro.comissoes_bancos', 'regras');
  v_id uuid := nullif(_d ->> 'id', '')::uuid;
  v_tipo text := coalesce(_d ->> 'tipo', 'percentual');
  v_valor numeric := (_d ->> 'valor')::numeric;
begin
  if v_tipo not in ('percentual', 'fixo') then raise exception 'Tipo inválido.' using errcode = '22023'; end if;
  if v_valor is null or v_valor < 0 or (v_tipo = 'percentual' and v_valor > 100) or v_valor >= 1000000000 then
    raise exception 'Valor da regra inválido.' using errcode = '22023';
  end if;
  if coalesce((_d ->> 'faixa_max')::numeric, 1e15) < coalesce((_d ->> 'faixa_min')::numeric, 0) then
    raise exception 'A faixa máxima é menor que a mínima.' using errcode = '22023';
  end if;
  perform public.fin_ctx(case when v_id is null then 'regra_criada' else 'regra_alterada' end, null);
  if v_id is null then
    insert into public.comissao_regras (correspondente_id, banco_nome, produto, faixa_min, faixa_max, tipo, valor,
                                        percentual_parceiro, percentual_interno, vigencia_inicio, vigencia_fim, ativo)
    values (v_corr, nullif(btrim(_d ->> 'banco_nome'), ''), nullif(btrim(_d ->> 'produto'), ''),
            coalesce((_d ->> 'faixa_min')::numeric, 0), (_d ->> 'faixa_max')::numeric,
            v_tipo::public.comissao_regra_tipo, v_valor, 0, 100,
            nullif(_d ->> 'vigencia_inicio', '')::date, nullif(_d ->> 'vigencia_fim', '')::date,
            coalesce((_d ->> 'ativo')::boolean, true))
    returning id into v_id;
  else
    update public.comissao_regras
       set banco_nome = nullif(btrim(_d ->> 'banco_nome'), ''), produto = nullif(btrim(_d ->> 'produto'), ''),
           faixa_min = coalesce((_d ->> 'faixa_min')::numeric, 0), faixa_max = (_d ->> 'faixa_max')::numeric,
           tipo = v_tipo::public.comissao_regra_tipo, valor = v_valor,
           vigencia_inicio = nullif(_d ->> 'vigencia_inicio', '')::date, vigencia_fim = nullif(_d ->> 'vigencia_fim', '')::date,
           ativo = coalesce((_d ->> 'ativo')::boolean, ativo)
     where id = v_id and correspondente_id = v_corr;
    if not found then raise exception 'Regra não encontrada.' using errcode = 'P0002'; end if;
  end if;
  perform public.fin_ctx_fim();
  return v_id;
end $$;

-- -----------------------------------------------------------------------------
-- B. Corretores e parceiros
-- -----------------------------------------------------------------------------
/** Participantes padrão da proposta (só quando ninguém definiu): parceiro originou, responsável atendeu. */
create or replace function public.fin_participantes_padrao(_prop_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p public.propostas;
begin
  select * into p from public.propostas where id = _prop_id;
  if not found or exists (select 1 from public.fin_proposta_participantes where proposta_id = _prop_id) then return; end if;
  insert into public.fin_proposta_participantes (correspondente_id, proposta_id, pessoa_id, papel, observacao)
  select p.correspondente_id, _prop_id, x.pessoa, x.papel, 'Definido pela proposta'
    from (values (p.parceiro_id, 'originou'), (p.usuario_parceiro_id, 'originou'),
                 (p.usuario_responsavel_id, 'atendeu'), (p.comercial_id, 'participou'), (p.analista_id, 'participou')) x(pessoa, papel)
   where x.pessoa is not null and exists (select 1 from public.profiles pr where pr.id = x.pessoa)
  on conflict (proposta_id, pessoa_id, papel) do nothing;
end $$;

/** Base de cálculo de um participante (valor e de onde veio). */
create or replace function public.fin_cu_base(_p public.propostas, _base text, out valor numeric, out fonte text,
                                              out comissao_banco_id uuid, out banco_recebido boolean)
language plpgsql stable security definer set search_path = public as $$
declare c public.comissoes;
begin
  banco_recebido := false;
  if _base = 'valor_contrato' then
    valor := coalesce(_p.valor_imovel, 0); fonte := 'valor_imovel';
  elsif _base = 'comissao_banco' then
    select * into c from public.comissoes where proposta_id = _p.id and situacao <> 'cancelado' order by created_at limit 1;
    comissao_banco_id := c.id;
    banco_recebido := coalesce(c.situacao = 'recebido', false);
    if c.id is null then valor := 0; fonte := 'sem_comissao_do_banco';
    elsif c.situacao = 'recebido' then valor := c.valor_recebido; fonte := 'comissao_banco_recebida';
    elsif c.valor_informado is not null then valor := c.valor_informado; fonte := 'comissao_banco_informada';
    else valor := c.valor_bruto; fonte := 'comissao_banco_prevista'; end if;
  else
    if coalesce(_p.valor_financiamento_aprovado, 0) > 0 then
      valor := _p.valor_financiamento_aprovado; fonte := 'valor_financiamento_aprovado';
    else
      valor := coalesce(_p.valor_financiamento, 0); fonte := 'valor_financiamento';
    end if;
  end if;
  valor := round(coalesce(valor, 0), 2);
end $$;

/**
 * Gera as previsões de corretores e parceiros da proposta para a etapa (gatilho). Uma por
 * pessoa e regra; regra individual da pessoa prevalece sobre a regra geral do papel.
 * Nunca recalcula o que já existe.
 */
create or replace function public.calcular_comissoes_usuario_proposta(_prop_id uuid, _gatilho text default 'contrato_emitido')
returns integer language plpgsql security definer set search_path = public as $$
declare
  p public.propostas;
  pp record;
  r public.comissao_regras_usuario;
  b record;
  v_valor numeric;
  v_n integer := 0;
  v_tem_individual boolean;
  v_par public.fin_parametros;
  v_data date;
begin
  select * into p from public.propostas where id = _prop_id;
  if not found or p.deleted_at is not null then return 0; end if;
  -- Vigência e vencimento contam da data do gatilho, não de hoje (igual ao repasse dos assinantes).
  v_data := public.fin_data_gatilho(p, _gatilho);
  if not exists (select 1 from public.comissao_regras_usuario cr
                  where cr.correspondente_id = p.correspondente_id and cr.ativo and cr.encerrada_em is null
                    and cr.gatilho = _gatilho) then
    return 0;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('fin_cu:' || _prop_id::text, 0));
  perform public.fin_participantes_padrao(_prop_id);
  v_par := public.fin_param(p.correspondente_id);
  perform public.fin_ctx('previsao_gerada', 'Gatilho da proposta (' || _gatilho || ')');

  for pp in select * from public.fin_proposta_participantes where proposta_id = _prop_id order by papel, created_at loop
    v_tem_individual := exists (
      select 1 from public.comissao_regras_usuario cr
       where cr.correspondente_id = p.correspondente_id and cr.ativo and cr.encerrada_em is null
         and cr.gatilho = _gatilho and cr.usuario_id = pp.pessoa_id
         and (cr.papel is null or cr.papel = pp.papel)
         and (cr.vigencia_inicio is null or cr.vigencia_inicio <= v_data)
         and (cr.vigencia_fim is null or cr.vigencia_fim >= v_data));
    for r in
      select cr.* from public.comissao_regras_usuario cr
       where cr.correspondente_id = p.correspondente_id and cr.ativo and cr.encerrada_em is null
         and cr.gatilho = _gatilho
         and (cr.banco_nome is null or cr.banco_nome = p.nome_banco)
         and (cr.produto is null or cr.produto = p.produto)
         and (cr.operacao is null or cr.operacao = p.produto or cr.operacao = p.tipo_imovel or cr.operacao = p.uso_imovel)
         and (cr.vigencia_inicio is null or cr.vigencia_inicio <= v_data)
         and (cr.vigencia_fim is null or cr.vigencia_fim >= v_data)
         and (cr.papel is null or cr.papel = pp.papel)
         and ((v_tem_individual and cr.usuario_id = pp.pessoa_id)
              or (not v_tem_individual and cr.usuario_id is null and cr.papel = pp.papel))
       order by cr.created_at
    loop
      if exists (select 1 from public.comissoes_usuario cu
                  where cu.proposta_id = _prop_id and cu.usuario_id = pp.pessoa_id and cu.regra_id = r.id) then
        continue;
      end if;
      select * into b from public.fin_cu_base(p, r.base_calculo);
      v_valor := case when r.tipo_valor = 'fixo' then round(r.valor_fixo, 2) else round(b.valor * r.percentual / 100.0, 2) end;
      insert into public.comissoes_usuario (
        correspondente_id, proposta_id, usuario_id, regra_id, tipo_vinculo, gatilho, base_calculo, percentual,
        valor_base, valor_comissao, valor_original, banco_nome, produto, numero_proposta, status, situacao, papel,
        regra_snapshot, vencimento, comissao_banco_id, origem)
      values (
        p.correspondente_id, _prop_id, pp.pessoa_id, r.id, r.tipo_vinculo, _gatilho, r.base_calculo,
        case when r.tipo_valor = 'fixo' then 0 else r.percentual end,
        b.valor, v_valor, v_valor, p.nome_banco, p.produto, p.numero_proposta, 'a_pagar',
        case when (r.exige_recebimento_banco or r.base_calculo = 'comissao_banco') and not b.banco_recebido
             then 'aguardando_confirmacao' else 'prevista' end,
        pp.papel,
        (to_jsonb(r) - 'created_at' - 'updated_at')
          || jsonb_build_object('base_valor', b.valor, 'base_fonte', b.fonte, 'data_calculo', current_date,
                                'data_gatilho', v_data, 'regra_individual', r.usuario_id is not null),
        v_data + v_par.dias_vencimento_comissao, b.comissao_banco_id, 'gatilho');
      v_n := v_n + 1;
    end loop;
  end loop;
  perform public.fin_ctx_fim();
  return v_n;
end $$;

-- A versão de um argumento deixava a chamada ambígua com a de dois (que tem padrão).
drop function if exists public.calcular_comissoes_usuario_proposta(uuid);

/** Gatilho de inserção: proposta que já nasce numa etapa gera as previsões dela (sem travar a proposta). */
create or replace function public.on_proposta_comissao_usuario_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    perform public.calcular_comissoes_usuario_proposta(new.id, new.status::text);
    if new.status::text = 'registrado'
       or (new.status::text = 'contrato_emitido'
           and (public.fin_param(new.correspondente_id)).gatilho_comissao_banco = 'contrato_emitido') then
      perform public.calcular_comissao_proposta(new.id);
    end if;
  exception when others then
    perform public.fin_ctx_fim();
    insert into public.fin_auditoria (correspondente_id, entidade, entidade_id, acao, depois)
    values (new.correspondente_id, 'propostas', new.id, 'falha_gatilho_financeiro',
            jsonb_build_object('status', new.status::text, 'erro', sqlerrm, 'codigo', sqlstate));
  end;
  return new;
end $$;

/** Banco pagou: quem esperava o recebimento volta a "prevista"; base "comissão do banco" vira a recebida. */
create or replace function public.fin_cu_apos_recebimento_banco(_cb uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  c public.comissoes;
  cu public.comissoes_usuario;
  v_valor numeric;
begin
  select * into c from public.comissoes where id = _cb;
  if not found then return; end if;
  perform public.fin_ctx('base_confirmada', 'Comissão do banco recebida');
  for cu in
    select * from public.comissoes_usuario
     where (comissao_banco_id = _cb or (proposta_id = c.proposta_id and c.proposta_id is not null and comissao_banco_id is null))
       and situacao = 'aguardando_confirmacao'
     for update
  loop
    if cu.base_calculo = 'comissao_banco' and coalesce(cu.regra_snapshot ->> 'tipo_valor', 'percentual') = 'percentual' then
      -- percentual GRAVADO na linha, nunca o da regra de hoje
      v_valor := round(c.valor_recebido * cu.percentual / 100.0, 2);
      update public.comissoes_usuario
         set valor_base = c.valor_recebido, valor_comissao = v_valor, valor_original = v_valor, comissao_banco_id = _cb,
             situacao = 'prevista',
             regra_snapshot = coalesce(regra_snapshot, '{}'::jsonb)
                              || jsonb_build_object('base_definitiva', c.valor_recebido, 'base_prevista', cu.valor_base,
                                                    'base_confirmada_em', now())
       where id = cu.id;
    else
      update public.comissoes_usuario set situacao = 'prevista', comissao_banco_id = coalesce(comissao_banco_id, _cb)
       where id = cu.id;
    end if;
  end loop;
end $$;

create or replace function public.fin_participantes_salvar(_prop_id uuid, _itens jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_corr uuid := public.fin_exigir('financeiro.comissoes', 'create');
  i jsonb;
  v_n integer := 0;
begin
  if not exists (select 1 from public.propostas where id = _prop_id and correspondente_id = v_corr) then
    raise exception 'Proposta não encontrada.' using errcode = 'P0002';
  end if;
  if jsonb_typeof(_itens) <> 'array' or jsonb_array_length(_itens) > 20 then
    raise exception 'Lista de participantes inválida.' using errcode = '22023';
  end if;
  perform public.fin_ctx('participantes_definidos', null);
  delete from public.fin_proposta_participantes where proposta_id = _prop_id;
  for i in select * from jsonb_array_elements(_itens) loop
    if not exists (select 1 from public.profiles pr where pr.id = (i ->> 'pessoa_id')::uuid and pr.correspondente_id = v_corr) then
      raise exception 'Participante não pertence a este correspondente.' using errcode = '42501';
    end if;
    if coalesce(i ->> 'papel', '') not in ('originou', 'atendeu', 'participou') then
      raise exception 'Papel inválido.' using errcode = '22023';
    end if;
    insert into public.fin_proposta_participantes (correspondente_id, proposta_id, pessoa_id, papel, observacao, criado_por)
    values (v_corr, _prop_id, (i ->> 'pessoa_id')::uuid, i ->> 'papel', nullif(btrim(i ->> 'observacao'), ''), auth.uid())
    on conflict (proposta_id, pessoa_id, papel) do nothing;
    v_n := v_n + 1;
  end loop;
  perform public.fin_ctx_fim();
  return v_n;
end $$;

/** Gera o que falta da proposta para as etapas que ela já passou (nunca recalcula). */
create or replace function public.fin_cu_gerar_faltantes(_prop_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_corr uuid := public.fin_exigir('financeiro.comissoes', 'create');
  p public.propostas;
  etapas text[] := array['rascunho', 'enviada_banco', 'em_analise_credito', 'credito_aprovado', 'aguardando_documentos',
                         'engenharia_vistoria', 'analise_juridica', 'contrato_emitido', 'registrado'];
  v_pos integer;
  v_n integer := 0;
  e text;
begin
  select * into p from public.propostas where id = _prop_id and correspondente_id = v_corr;
  if not found then raise exception 'Proposta não encontrada.' using errcode = 'P0002'; end if;
  v_pos := array_position(etapas, p.status::text);
  if v_pos is null then
    return public.calcular_comissoes_usuario_proposta(_prop_id, p.status::text);
  end if;
  foreach e in array etapas[1:v_pos] loop
    v_n := v_n + public.calcular_comissoes_usuario_proposta(_prop_id, e);
  end loop;
  return v_n;
end $$;

/** Soma das comissões de participantes da proposta não pode passar da comissão do banco sem aviso. */
create or replace function public.fin_cu_soma_excede(_prop_id uuid, _adicional numeric, _exceto uuid default null)
returns numeric language sql stable security definer set search_path = public as $$
  with banco as (
    select coalesce(case when c.situacao = 'recebido' then c.valor_recebido else coalesce(c.valor_informado, c.valor_bruto) end, 0) v
      from public.comissoes c where c.proposta_id = _prop_id and c.situacao <> 'cancelado' order by c.created_at limit 1),
  soma as (
    select coalesce(sum(cu.valor_comissao), 0) v from public.comissoes_usuario cu
     where cu.proposta_id = _prop_id and cu.situacao <> 'cancelada' and cu.id is distinct from _exceto)
  select case when (select v from banco) > 0 and (select v from soma) + _adicional > (select v from banco)
              then (select v from soma) + _adicional - (select v from banco) else 0 end
$$;

create or replace function public.fin_cu_lancar(_d jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_corr uuid := public.fin_exigir('financeiro.comissoes', 'create');
  p public.propostas;
  v_prop uuid := nullif(_d ->> 'proposta_id', '')::uuid;
  v_pessoa uuid := (_d ->> 'usuario_id')::uuid;
  v_papel text := nullif(_d ->> 'papel', '');
  v_tipo text := coalesce(_d ->> 'tipo_valor', 'percentual');
  v_base_tipo text := coalesce(_d ->> 'base_calculo', 'valor_financiado');
  v_pct numeric := coalesce((_d ->> 'percentual')::numeric, 0);
  v_valor numeric;
  v_base numeric;
  v_fonte text := 'informada';
  v_excede numeric := 0;
  v_dup boolean := false;
  v_conf boolean := coalesce((_d ->> 'confirmar')::boolean, false);
  v_just text := nullif(btrim(_d ->> 'justificativa'), '');
  b record;
  v_cb uuid;
  v_id uuid;
begin
  if not exists (select 1 from public.profiles pr where pr.id = v_pessoa and pr.correspondente_id = v_corr) then
    raise exception 'Pessoa não pertence a este correspondente.' using errcode = '42501';
  end if;
  if v_papel is not null and v_papel not in ('originou', 'atendeu', 'participou') then raise exception 'Papel inválido.' using errcode = '22023'; end if;
  if v_tipo not in ('percentual', 'fixo') or v_base_tipo not in ('valor_financiado', 'valor_contrato', 'comissao_banco') then
    raise exception 'Tipo ou base inválidos.' using errcode = '22023';
  end if;
  if v_pct < 0 or v_pct > 100 then raise exception 'Percentual de 0 a 100.' using errcode = '22023'; end if;
  if v_prop is not null then
    select * into p from public.propostas where id = v_prop and correspondente_id = v_corr and deleted_at is null;
    if not found then raise exception 'Proposta não encontrada.' using errcode = 'P0002'; end if;
    perform pg_advisory_xact_lock(hashtextextended('fin_cu:' || v_prop::text, 0));
    select * into b from public.fin_cu_base(p, v_base_tipo);
    v_base := coalesce((_d ->> 'valor_base')::numeric, b.valor);
    v_fonte := case when _d ? 'valor_base' then 'informada' else b.fonte end;
    v_cb := b.comissao_banco_id;
  else
    v_base := coalesce((_d ->> 'valor_base')::numeric, 0);
  end if;
  v_valor := case when v_tipo = 'fixo' then round((_d ->> 'valor_fixo')::numeric, 2) else round(v_base * v_pct / 100.0, 2) end;
  if v_valor is null or v_valor <= 0 or v_valor >= 1000000000 then raise exception 'Valor da comissão inválido.' using errcode = '22023'; end if;

  if v_prop is not null then
    v_dup := exists (select 1 from public.comissoes_usuario cu
                      where cu.proposta_id = v_prop and cu.usuario_id = v_pessoa and cu.situacao <> 'cancelada'
                        and (v_papel is null or cu.papel is null or cu.papel = v_papel));
    v_excede := public.fin_cu_soma_excede(v_prop, v_valor);
  end if;
  if v_dup and not v_conf then
    raise exception 'Possível duplicidade: esta pessoa já tem comissão nesta proposta.' using errcode = 'P0001', hint = 'duplicidade';
  end if;
  if v_excede > 0 and not v_conf then
    raise exception 'A soma das comissões passa da comissão do banco em R$ %.', to_char(v_excede, 'FM999G999G990D00')
      using errcode = 'P0001', hint = 'soma';
  end if;
  if (v_dup or v_excede > 0) and coalesce(length(v_just), 0) < 5 then
    raise exception 'Escreva a justificativa para lançar mesmo assim.' using errcode = '22023';
  end if;

  perform public.fin_ctx('lancamento_manual', v_just);
  insert into public.comissoes_usuario (
    correspondente_id, proposta_id, usuario_id, regra_id, tipo_vinculo, gatilho, base_calculo, percentual, valor_base,
    valor_comissao, valor_original, banco_nome, produto, numero_proposta, status, situacao, papel, regra_snapshot,
    vencimento, comissao_banco_id, origem, observacao, criado_por, duplicidade_justificativa)
  values (
    v_corr, v_prop, v_pessoa, null, coalesce(nullif(_d ->> 'tipo_vinculo', '')::public.comissao_tipo_vinculo, 'outro'),
    'manual', v_base_tipo, case when v_tipo = 'fixo' then 0 else v_pct end, round(v_base, 2), v_valor, v_valor,
    p.nome_banco, p.produto, p.numero_proposta, 'a_pagar', 'prevista', v_papel,
    jsonb_build_object('fonte', 'manual', 'tipo_valor', v_tipo, 'percentual', v_pct, 'valor_fixo', (_d ->> 'valor_fixo')::numeric,
                       'base_calculo', v_base_tipo, 'base_valor', round(v_base, 2), 'base_fonte', v_fonte,
                       'data_calculo', current_date, 'soma_excedia', v_excede),
    coalesce(nullif(_d ->> 'vencimento', '')::date, current_date + (public.fin_param(v_corr)).dias_vencimento_comissao),
    v_cb, 'manual', nullif(btrim(_d ->> 'observacao'), ''), auth.uid(),
    case when v_dup or v_excede > 0 then v_just end)
  returning id into v_id;
  perform public.fin_ctx_fim();
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.fin_cu_aprovar(_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_corr uuid := public.fin_exigir('financeiro.comissoes', 'aprovar');
  v_ok integer := 0;
  v_rec integer := 0;
begin
  if _ids is null or cardinality(_ids) = 0 or cardinality(_ids) > 500 then
    raise exception 'Escolha de 1 a 500 comissões.' using errcode = '22023';
  end if;
  perform public.fin_ctx('aprovada_para_pagamento', null);
  update public.comissoes_usuario
     set situacao = 'aprovada', aprovado_por = auth.uid(), aprovado_em = now()
   where id = any (_ids) and correspondente_id = v_corr and situacao in ('prevista', 'ajustada');
  get diagnostics v_ok = row_count;
  v_rec := cardinality(_ids) - v_ok;
  perform public.fin_ctx_fim();
  return jsonb_build_object('aprovadas', v_ok, 'recusadas', v_rec);
end $$;

/** Contestar: quem administra (editar) ou a própria pessoa que recebe. */
create or replace function public.fin_cu_contestar(_id uuid, _motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare cu public.comissoes_usuario;
begin
  if length(btrim(coalesce(_motivo, ''))) < 5 then raise exception 'Escreva o motivo da contestação.' using errcode = '22023'; end if;
  select * into cu from public.comissoes_usuario where id = _id for update;
  if not found or cu.correspondente_id is distinct from public.correspondente_do_usuario(auth.uid()) then
    raise exception 'Comissão não encontrada.' using errcode = 'P0002';
  end if;
  if not (public.fin_pode('financeiro.comissoes', 'edit') or cu.usuario_id = auth.uid()) then
    raise exception 'Você não tem permissão para contestar esta comissão.' using errcode = '42501';
  end if;
  if cu.situacao in ('paga', 'cancelada', 'contestada') then
    raise exception 'Esta comissão não pode ser contestada agora.' using errcode = '55000';
  end if;
  perform public.fin_ctx('contestada', _motivo);
  update public.comissoes_usuario
     set situacao = 'contestada', situacao_antes_contestacao = cu.situacao, contestacao_motivo = btrim(_motivo),
         contestado_por = auth.uid(), contestado_em = now()
   where id = _id;
  perform public.fin_ctx_fim();
end $$;

create or replace function public.fin_cu_ajustar(_id uuid, _novo numeric, _motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_corr uuid := public.fin_exigir('financeiro.comissoes', 'edit');
  cu public.comissoes_usuario;
begin
  if length(btrim(coalesce(_motivo, ''))) < 5 then raise exception 'Escreva o motivo do ajuste.' using errcode = '22023'; end if;
  select * into cu from public.comissoes_usuario where id = _id and correspondente_id = v_corr for update;
  if not found then raise exception 'Comissão não encontrada.' using errcode = 'P0002'; end if;
  if cu.situacao in ('paga', 'cancelada') then raise exception 'Comissão paga ou cancelada não é ajustada.' using errcode = '55000'; end if;
  if _novo is null or _novo <= 0 or _novo >= 1000000000 then raise exception 'Valor inválido.' using errcode = '22023'; end if;
  if round(_novo, 2) < cu.valor_pago then raise exception 'O novo valor é menor que o já pago.' using errcode = '22023'; end if;
  perform public.fin_ctx('ajustada', _motivo);
  update public.comissoes_usuario
     set valor_comissao = round(_novo, 2), ajuste_motivo = btrim(_motivo),
         valor_original = coalesce(valor_original, cu.valor_comissao),
         situacao = case when cu.valor_pago > 0 and cu.valor_pago >= round(_novo, 2) then 'paga'
                         when cu.valor_pago > 0 then 'parcial' else 'ajustada' end,
         aprovado_por = case when cu.valor_pago > 0 then aprovado_por end,
         aprovado_em = case when cu.valor_pago > 0 then aprovado_em end,
         status = case when cu.valor_pago > 0 and cu.valor_pago >= round(_novo, 2) then 'paga'::public.comissao_usuario_status
                       else 'a_pagar'::public.comissao_usuario_status end
   where id = _id;
  perform public.fin_ctx_fim();
end $$;

create or replace function public.fin_cu_resolver_contestacao(_id uuid, _manter boolean, _novo numeric, _motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_corr uuid := public.fin_exigir('financeiro.comissoes', 'edit');
  cu public.comissoes_usuario;
begin
  if length(btrim(coalesce(_motivo, ''))) < 5 then raise exception 'Escreva como a contestação foi resolvida.' using errcode = '22023'; end if;
  select * into cu from public.comissoes_usuario where id = _id and correspondente_id = v_corr for update;
  if not found or cu.situacao <> 'contestada' then raise exception 'Comissão não está contestada.' using errcode = 'P0002'; end if;
  perform public.fin_ctx('contestacao_resolvida', _motivo);
  update public.comissoes_usuario
     set situacao = coalesce(cu.situacao_antes_contestacao, 'prevista'), situacao_antes_contestacao = null
   where id = _id;
  if not _manter then
    perform public.fin_cu_ajustar(_id, _novo, _motivo);
  end if;
  perform public.fin_ctx_fim();
end $$;

create or replace function public.fin_cu_cancelar(_id uuid, _motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_corr uuid := public.fin_exigir('financeiro.comissoes', 'edit');
  cu public.comissoes_usuario;
begin
  if length(btrim(coalesce(_motivo, ''))) < 5 then raise exception 'Escreva o motivo do cancelamento.' using errcode = '22023'; end if;
  select * into cu from public.comissoes_usuario where id = _id and correspondente_id = v_corr for update;
  if not found then raise exception 'Comissão não encontrada.' using errcode = 'P0002'; end if;
  if cu.situacao = 'cancelada' then raise exception 'Comissão já cancelada.' using errcode = '55000'; end if;
  if public.fin_total_baixado('comissao_participante', _id) > 0 then
    raise exception 'Há pagamento registrado: estorne o pagamento antes de cancelar.' using errcode = '55000';
  end if;
  perform public.fin_ctx('cancelada', _motivo);
  update public.comissoes_usuario set situacao = 'cancelada', status = 'cancelada', cancelamento_motivo = btrim(_motivo)
   where id = _id;
  perform public.fin_ctx_fim();
end $$;

create or replace function public.fin_regra_participante_salvar(_d jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_corr uuid := public.fin_exigir('financeiro.comissoes', 'regras');
  v_id uuid := nullif(_d ->> 'id', '')::uuid;
  v_pessoa uuid := nullif(_d ->> 'usuario_id', '')::uuid;
  v_papel text := nullif(_d ->> 'papel', '');
begin
  if v_pessoa is null and v_papel is null then
    raise exception 'Regra geral precisa de um papel (originou, atendeu ou participou).' using errcode = '22023';
  end if;
  if v_pessoa is not null and not exists (select 1 from public.profiles pr where pr.id = v_pessoa and pr.correspondente_id = v_corr) then
    raise exception 'Pessoa não pertence a este correspondente.' using errcode = '42501';
  end if;
  if coalesce(_d ->> 'gatilho', '') !~ '^[a-z_]{3,40}$' then raise exception 'Gatilho inválido.' using errcode = '22023'; end if;
  perform public.fin_ctx(case when v_id is null then 'regra_criada' else 'regra_alterada' end, null);
  if v_id is null then
    insert into public.comissao_regras_usuario (correspondente_id, usuario_id, tipo_vinculo, gatilho, base_calculo, percentual,
      tipo_valor, valor_fixo, papel, operacao, banco_nome, produto, vigencia_inicio, vigencia_fim, ativo, observacao,
      exige_recebimento_banco, criador_id)
    values (v_corr, v_pessoa, coalesce(nullif(_d ->> 'tipo_vinculo', '')::public.comissao_tipo_vinculo, 'outro'),
      _d ->> 'gatilho', coalesce(_d ->> 'base_calculo', 'valor_financiado'), coalesce((_d ->> 'percentual')::numeric, 0),
      coalesce(_d ->> 'tipo_valor', 'percentual'), (_d ->> 'valor_fixo')::numeric, v_papel, nullif(btrim(_d ->> 'operacao'), ''),
      nullif(btrim(_d ->> 'banco_nome'), ''), nullif(btrim(_d ->> 'produto'), ''),
      nullif(_d ->> 'vigencia_inicio', '')::date, nullif(_d ->> 'vigencia_fim', '')::date, true,
      nullif(btrim(_d ->> 'observacao'), ''), coalesce((_d ->> 'exige_recebimento_banco')::boolean, false), auth.uid())
    returning id into v_id;
  else
    update public.comissao_regras_usuario
       set usuario_id = v_pessoa, tipo_vinculo = coalesce(nullif(_d ->> 'tipo_vinculo', '')::public.comissao_tipo_vinculo, tipo_vinculo),
           gatilho = _d ->> 'gatilho', base_calculo = coalesce(_d ->> 'base_calculo', base_calculo),
           percentual = coalesce((_d ->> 'percentual')::numeric, 0), tipo_valor = coalesce(_d ->> 'tipo_valor', tipo_valor),
           valor_fixo = (_d ->> 'valor_fixo')::numeric, papel = v_papel, operacao = nullif(btrim(_d ->> 'operacao'), ''),
           banco_nome = nullif(btrim(_d ->> 'banco_nome'), ''), produto = nullif(btrim(_d ->> 'produto'), ''),
           vigencia_inicio = nullif(_d ->> 'vigencia_inicio', '')::date, vigencia_fim = nullif(_d ->> 'vigencia_fim', '')::date,
           observacao = nullif(btrim(_d ->> 'observacao'), ''),
           exige_recebimento_banco = coalesce((_d ->> 'exige_recebimento_banco')::boolean, exige_recebimento_banco)
     where id = v_id and correspondente_id = v_corr and encerrada_em is null;
    if not found then raise exception 'Regra não encontrada ou encerrada.' using errcode = 'P0002'; end if;
  end if;
  perform public.fin_ctx_fim();
  return v_id;
end $$;

/** Encerrar regra (nunca apaga lançamentos: eles têm a cópia da regra). */
create or replace function public.fin_regra_encerrar(_tipo text, _id uuid, _motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare v_corr uuid;
begin
  if _tipo = 'participante' then
    v_corr := public.fin_exigir('financeiro.comissoes', 'regras');
    perform public.fin_ctx('regra_encerrada', _motivo);
    update public.comissao_regras_usuario
       set ativo = false, encerrada_em = now(), encerrada_por = auth.uid(), motivo_encerramento = nullif(btrim(_motivo), ''),
           vigencia_fim = least(coalesce(vigencia_fim, current_date), current_date)
     where id = _id and correspondente_id = v_corr and encerrada_em is null;
  elsif _tipo = 'banco' then
    v_corr := public.fin_exigir('financeiro.comissoes_bancos', 'regras');
    perform public.fin_ctx('regra_encerrada', _motivo);
    update public.comissao_regras set ativo = false, vigencia_fim = least(coalesce(vigencia_fim, current_date), current_date)
     where id = _id and correspondente_id = v_corr and ativo;
  else
    raise exception 'Tipo de regra inválido.' using errcode = '22023';
  end if;
  if not found then raise exception 'Regra não encontrada ou já encerrada.' using errcode = 'P0002'; end if;
  perform public.fin_ctx_fim();
end $$;

-- -----------------------------------------------------------------------------
-- C. Contas a pagar e outras receitas
-- -----------------------------------------------------------------------------
/** Possíveis duplicatas de uma conta (antes de salvar): linha digitável, código, fornecedor+valor+vencimento. */
create or replace function public.fin_conta_duplicatas(_tipo text, _d jsonb, _exceto uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_corr uuid;
  v_res jsonb;
  v_linha text := nullif(regexp_replace(coalesce(_d ->> 'linha_digitavel', ''), '\D', '', 'g'), '');
  v_cod text := nullif(regexp_replace(coalesce(_d ->> 'codigo_barras', ''), '\D', '', 'g'), '');
  v_forn uuid := nullif(_d ->> 'fornecedor_id', '')::uuid;
  v_nome text := lower(nullif(btrim(coalesce(_d ->> 'fornecedor', _d ->> 'pagador')), ''));
  v_valor numeric := round((_d ->> 'valor')::numeric, 2);
  v_venc date := nullif(_d ->> 'vencimento', '')::date;
begin
  if _tipo = 'pagar' then
    v_corr := public.fin_exigir('financeiro.contas_pagar', 'view');
    select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'numero', p.numero, 'descricao', p.descricao, 'valor', p.valor,
             'vencimento', p.vencimento, 'status', p.status, 'rascunho', p.rascunho,
             'motivo', case when v_linha is not null and p.linha_digitavel = v_linha then 'mesma linha digitável'
                            when v_cod is not null and p.codigo_barras = v_cod then 'mesmo código de barras'
                            else 'mesmo fornecedor, valor e vencimento' end)), '[]')
      into v_res
      from public.financial_payables p
     where p.correspondente_id = v_corr and p.status <> 'cancelada' and p.id is distinct from _exceto
       and ((v_linha is not null and p.linha_digitavel = v_linha)
            or (v_cod is not null and p.codigo_barras = v_cod)
            or (v_valor is not null and v_venc is not null and p.valor = v_valor and p.vencimento = v_venc
                and ((v_forn is not null and p.fornecedor_id = v_forn) or (v_nome is not null and lower(p.fornecedor) = v_nome))));
  else
    v_corr := public.fin_exigir('financeiro.contas_receber', 'view');
    select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'numero', r.numero, 'descricao', r.descricao, 'valor', r.valor,
             'vencimento', r.vencimento, 'status', r.status, 'motivo',
             case when r.origem_tipo is not null and r.origem_tipo = _d ->> 'origem_tipo' and r.origem_ref = _d ->> 'origem_ref'
                  then 'mesma origem' else 'mesmo pagador, valor e vencimento' end)), '[]')
      into v_res
      from public.financial_receivables r
     where r.correspondente_id = v_corr and r.natureza = 'operacional' and r.status <> 'cancelada' and r.id is distinct from _exceto
       and ((r.origem_tipo is not null and r.origem_tipo = _d ->> 'origem_tipo' and r.origem_ref = _d ->> 'origem_ref')
            or (v_valor is not null and v_venc is not null and r.valor = v_valor and r.vencimento = v_venc
                and v_nome is not null and lower(r.pagador) = v_nome));
  end if;
  return v_res;
end $$;

/**
 * Cria (com recorrência/parcelas) ou edita uma conta a pagar/receber. Duplicata → aviso
 * (hint 'duplicidade') até a pessoa confirmar com justificativa. Boleto salvo como
 * rascunho fica fora de toda soma até ser conferido (fin_conta_confirmar_rascunho).
 */
create or replace function public.fin_conta_salvar(_tipo text, _d jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_mod text := case _tipo when 'pagar' then 'financeiro.contas_pagar' when 'receber' then 'financeiro.contas_receber' end;
  v_corr uuid;
  v_id uuid := nullif(_d ->> 'id', '')::uuid;
  v_valor numeric := round((_d ->> 'valor')::numeric, 2);
  v_venc date := nullif(_d ->> 'vencimento', '')::date;
  v_rec text := coalesce(nullif(_d ->> 'recorrencia', ''), 'nenhuma');
  v_parc integer := coalesce((_d ->> 'parcelas')::integer, 1);
  v_ate date := nullif(_d ->> 'recorrencia_ate', '')::date;
  v_rasc boolean := coalesce((_d ->> 'rascunho')::boolean, false);
  v_dups jsonb;
  v_n integer;
  v_ids uuid[] := '{}';
  v_primeiro uuid;
  v_novo uuid;
  v_cent bigint;
  v_base bigint;
  i integer;
  v_linha text := nullif(regexp_replace(coalesce(_d ->> 'linha_digitavel', ''), '\D', '', 'g'), '');
  v_cod text := nullif(regexp_replace(coalesce(_d ->> 'codigo_barras', ''), '\D', '', 'g'), '');
  v_just text := nullif(btrim(_d ->> 'justificativa'), '');
begin
  if v_mod is null then raise exception 'Tipo de conta inválido.' using errcode = '22023'; end if;
  -- Conferir/corrigir rascunho de boleto é parte do lançamento (criar), não edição.
  v_corr := public.fin_exigir(v_mod, case when v_id is null then 'create'
                                          when _tipo = 'pagar' and exists (select 1 from public.financial_payables x
                                                                           where x.id = v_id and x.rascunho) then 'create'
                                          else 'edit' end);
  if length(btrim(coalesce(_d ->> 'descricao', ''))) < 2 then raise exception 'Escreva a descrição.' using errcode = '22023'; end if;
  if v_valor is null or v_valor <= 0 or v_valor >= 1000000000 then raise exception 'Valor inválido.' using errcode = '22023'; end if;
  if v_venc is null or v_venc < date '2000-01-01' or v_venc > current_date + 3650 then
    raise exception 'Vencimento inválido.' using errcode = '22023';
  end if;
  if v_rec not in ('nenhuma', 'mensal', 'anual', 'parcelado') then raise exception 'Recorrência inválida.' using errcode = '22023'; end if;
  if nullif(_d ->> 'fornecedor_id', '') is not null and not exists (
       select 1 from public.fin_fornecedores f where f.id = (_d ->> 'fornecedor_id')::uuid and f.correspondente_id = v_corr) then
    raise exception 'Fornecedor não encontrado.' using errcode = 'P0002';
  end if;
  if _tipo = 'receber' and nullif(_d ->> 'proposta_id', '') is not null and not exists (
       select 1 from public.propostas pr where pr.id = (_d ->> 'proposta_id')::uuid and pr.correspondente_id = v_corr) then
    raise exception 'Proposta não encontrada.' using errcode = 'P0002';
  end if;

  v_dups := public.fin_conta_duplicatas(_tipo, _d || jsonb_build_object('linha_digitavel', v_linha, 'codigo_barras', v_cod), v_id);
  if jsonb_array_length(v_dups) > 0 and not coalesce((_d ->> 'confirmar_duplicidade')::boolean, false) then
    raise exception 'Possível duplicidade: % conta(s) parecida(s) (%).', jsonb_array_length(v_dups), v_dups -> 0 ->> 'motivo'
      using errcode = 'P0001', hint = 'duplicidade', detail = v_dups::text;
  end if;
  if jsonb_array_length(v_dups) > 0 and coalesce(length(v_just), 0) < 5 then
    raise exception 'Escreva a justificativa para salvar mesmo com a duplicidade.' using errcode = '22023';
  end if;

  perform public.fin_ctx(case when v_id is null then 'criada' else 'editada' end,
                         case when jsonb_array_length(v_dups) > 0 then v_just end);

  if v_id is not null then
    if _tipo = 'pagar' then
      update public.financial_payables
         set descricao = btrim(_d ->> 'descricao'), fornecedor = nullif(btrim(_d ->> 'fornecedor'), ''),
             fornecedor_id = nullif(_d ->> 'fornecedor_id', '')::uuid, categoria_id = nullif(_d ->> 'categoria_id', '')::uuid,
             cost_center_id = nullif(_d ->> 'cost_center_id', '')::uuid, payment_method_id = nullif(_d ->> 'payment_method_id', '')::uuid,
             valor = v_valor, vencimento = v_venc, observacao = nullif(btrim(_d ->> 'observacao'), ''),
             linha_digitavel = case when _d ? 'linha_digitavel' then v_linha else linha_digitavel end,
             codigo_barras = case when _d ? 'codigo_barras' then v_cod else codigo_barras end,
             boleto_tipo = case when _d ? 'boleto_tipo' then nullif(_d ->> 'boleto_tipo', '') else boleto_tipo end,
             boleto_beneficiario = case when _d ? 'boleto_beneficiario' then nullif(btrim(_d ->> 'boleto_beneficiario'), '') else boleto_beneficiario end,
             boleto_documento = case when _d ? 'boleto_documento'
                                     then nullif(regexp_replace(coalesce(_d ->> 'boleto_documento', ''), '\D', '', 'g'), '')
                                     else boleto_documento end,
             duplicidade_justificativa = coalesce(case when jsonb_array_length(v_dups) > 0 then v_just end, duplicidade_justificativa)
       where id = v_id and correspondente_id = v_corr and natureza = 'operacional';
    else
      update public.financial_receivables
         set descricao = btrim(_d ->> 'descricao'), pagador = nullif(btrim(_d ->> 'pagador'), ''),
             categoria_id = nullif(_d ->> 'categoria_id', '')::uuid, cost_center_id = nullif(_d ->> 'cost_center_id', '')::uuid,
             payment_method_id = nullif(_d ->> 'payment_method_id', '')::uuid, proposta_id = nullif(_d ->> 'proposta_id', '')::uuid,
             valor = v_valor, vencimento = v_venc, observacao = nullif(btrim(_d ->> 'observacao'), ''),
             duplicidade_justificativa = coalesce(case when jsonb_array_length(v_dups) > 0 then v_just end, duplicidade_justificativa)
       where id = v_id and correspondente_id = v_corr and natureza = 'operacional';
    end if;
    if not found then raise exception 'Conta não encontrada.' using errcode = 'P0002'; end if;
    perform public.fin_ctx_fim();
    return jsonb_build_object('ids', jsonb_build_array(v_id));
  end if;

  -- Quantas ocorrências: parcelado divide o total; mensal/anual repete até a data final (máx. 60)
  if v_rec = 'parcelado' then
    if v_parc < 2 or v_parc > 120 then raise exception 'Parcelas de 2 a 120.' using errcode = '22023'; end if;
    v_n := v_parc;
  elsif v_rec in ('mensal', 'anual') then
    if v_ate is null or v_ate < v_venc then raise exception 'Informe até quando a conta se repete.' using errcode = '22023'; end if;
    v_n := least(60, 1 + case when v_rec = 'mensal'
                               then (extract(year from age(v_ate, v_venc)) * 12 + extract(month from age(v_ate, v_venc)))::int
                               else extract(year from age(v_ate, v_venc))::int end);
  else
    v_n := 1;
  end if;
  if v_rasc and v_n > 1 then raise exception 'Rascunho de boleto é uma conta só.' using errcode = '22023'; end if;
  v_cent := round(v_valor * 100);
  v_base := case when v_rec = 'parcelado' then v_cent / v_n else v_cent end;

  for i in 1 .. v_n loop
    if _tipo = 'pagar' then
      insert into public.financial_payables (
        correspondente_id, descricao, fornecedor, fornecedor_id, categoria_id, cost_center_id, payment_method_id,
        vencimento, valor, status, recorrencia, recorrencia_ate, recorrencia_origem_id, parcelas, parcela_numero,
        criador_id, natureza, linha_digitavel, codigo_barras, boleto_tipo, boleto_beneficiario, boleto_documento,
        rascunho, observacao, origem_tipo, origem_ref, duplicidade_justificativa)
      values (
        v_corr, btrim(_d ->> 'descricao') || case when v_n > 1 then ' (' || i || '/' || v_n || ')' else '' end,
        nullif(btrim(_d ->> 'fornecedor'), ''), nullif(_d ->> 'fornecedor_id', '')::uuid,
        nullif(_d ->> 'categoria_id', '')::uuid, nullif(_d ->> 'cost_center_id', '')::uuid, nullif(_d ->> 'payment_method_id', '')::uuid,
        case when v_rec = 'anual' then (v_venc + make_interval(years => i - 1))::date
             when v_rec in ('mensal', 'parcelado') then (v_venc + make_interval(months => i - 1))::date else v_venc end,
        round((case when v_rec = 'parcelado' and i = v_n then v_cent - v_base * (v_n - 1) else v_base end)::numeric / 100, 2),
        'aberta', v_rec::public.financial_recorrencia, v_ate, v_primeiro,
        case when v_rec = 'parcelado' then v_n end, case when v_n > 1 then i end,
        auth.uid(), 'operacional', v_linha, v_cod, nullif(_d ->> 'boleto_tipo', ''),
        nullif(btrim(_d ->> 'boleto_beneficiario'), ''),
        nullif(regexp_replace(coalesce(_d ->> 'boleto_documento', ''), '\D', '', 'g'), ''),
        v_rasc, nullif(btrim(_d ->> 'observacao'), ''), nullif(_d ->> 'origem_tipo', ''), nullif(_d ->> 'origem_ref', ''),
        case when jsonb_array_length(v_dups) > 0 then v_just end)
      returning id into v_novo;
    else
      insert into public.financial_receivables (
        correspondente_id, descricao, pagador, proposta_id, categoria_id, cost_center_id, payment_method_id, vencimento,
        valor, status, recorrencia, recorrencia_ate, recorrencia_origem_id, parcelas, parcela_numero, criador_id,
        natureza, observacao, origem_tipo, origem_ref, duplicidade_justificativa)
      values (
        v_corr, btrim(_d ->> 'descricao') || case when v_n > 1 then ' (' || i || '/' || v_n || ')' else '' end,
        nullif(btrim(_d ->> 'pagador'), ''), nullif(_d ->> 'proposta_id', '')::uuid,
        nullif(_d ->> 'categoria_id', '')::uuid, nullif(_d ->> 'cost_center_id', '')::uuid, nullif(_d ->> 'payment_method_id', '')::uuid,
        case when v_rec = 'anual' then (v_venc + make_interval(years => i - 1))::date
             when v_rec in ('mensal', 'parcelado') then (v_venc + make_interval(months => i - 1))::date else v_venc end,
        round((case when v_rec = 'parcelado' and i = v_n then v_cent - v_base * (v_n - 1) else v_base end)::numeric / 100, 2),
        'aberta', v_rec::public.financial_recorrencia, v_ate, v_primeiro,
        case when v_rec = 'parcelado' then v_n end, case when v_n > 1 then i end, auth.uid(), 'operacional',
        nullif(btrim(_d ->> 'observacao'), ''), nullif(_d ->> 'origem_tipo', ''), nullif(_d ->> 'origem_ref', ''),
        case when jsonb_array_length(v_dups) > 0 then v_just end)
      returning id into v_novo;
    end if;
    v_primeiro := coalesce(v_primeiro, v_novo);
    v_ids := v_ids || v_novo;
  end loop;
  perform public.fin_ctx_fim();
  return jsonb_build_object('ids', to_jsonb(v_ids));
end $$;

/** Conferência do rascunho de boleto: só depois dela a conta entra nas somas. */
create or replace function public.fin_conta_confirmar_rascunho(_id uuid, _d jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_corr uuid := public.fin_exigir('financeiro.contas_pagar', 'create');
  v_dups jsonb;
  v_just text := nullif(btrim(_d ->> 'justificativa'), '');
  p public.financial_payables;
begin
  select * into p from public.financial_payables where id = _id and correspondente_id = v_corr for update;
  if not found or not p.rascunho then raise exception 'Rascunho não encontrado.' using errcode = 'P0002'; end if;
  -- Salva a conferência (com a checagem de duplicidade de sempre) e só então tira do rascunho.
  perform public.fin_conta_salvar('pagar', _d || jsonb_build_object('id', _id));
  perform public.fin_ctx('rascunho_conferido', v_just);
  update public.financial_payables set rascunho = false where id = _id;
  perform public.fin_ctx_fim();
end $$;

create or replace function public.fin_conta_cancelar(_tipo text, _id uuid, _motivo text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_corr uuid := public.fin_exigir(case _tipo when 'pagar' then 'financeiro.contas_pagar' else 'financeiro.contas_receber' end, 'edit');
begin
  if _tipo not in ('pagar', 'receber') then raise exception 'Tipo inválido.' using errcode = '22023'; end if;
  if length(btrim(coalesce(_motivo, ''))) < 5 then raise exception 'Escreva o motivo do cancelamento.' using errcode = '22023'; end if;
  if public.fin_total_baixado(case _tipo when 'pagar' then 'conta_pagar' else 'conta_receber' end, _id) > 0 then
    raise exception 'Há pagamento registrado: estorne antes de cancelar.' using errcode = '55000';
  end if;
  perform public.fin_ctx('cancelada', _motivo);
  if _tipo = 'pagar' then
    update public.financial_payables set status = 'cancelada', cancelado_motivo = btrim(_motivo), cancelado_por = auth.uid(), cancelado_em = now()
     where id = _id and correspondente_id = v_corr and natureza = 'operacional' and status <> 'cancelada';
  else
    update public.financial_receivables set status = 'cancelada', cancelado_motivo = btrim(_motivo), cancelado_por = auth.uid(), cancelado_em = now()
     where id = _id and correspondente_id = v_corr and natureza = 'operacional' and status <> 'cancelada';
  end if;
  if not found then raise exception 'Conta não encontrada ou já cancelada.' using errcode = 'P0002'; end if;
  perform public.fin_ctx_fim();
end $$;

/** Descartar rascunho de boleto (o único caso em que a conta some). */
create or replace function public.fin_conta_descartar_rascunho(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_corr uuid := public.fin_exigir('financeiro.contas_pagar', 'create');
begin
  perform public.fin_ctx('rascunho_descartado', null);
  delete from public.financial_payables where id = _id and correspondente_id = v_corr and rascunho;
  if not found then raise exception 'Rascunho não encontrado.' using errcode = 'P0002'; end if;
  perform public.fin_ctx_fim();
end $$;

/**
 * Ponto de integração (C45f): receita que nasce em outro módulo (ex.: matrícula pedida por
 * terceiro, frente a4). Idempotente por origem: chamar de novo devolve a mesma conta.
 */
create or replace function public.fin_receita_de_origem(_origem_tipo text, _origem_ref text, _descricao text, _valor numeric,
                                                        _vencimento date, _pagador text default null, _proposta uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_corr uuid := public.fin_exigir('financeiro.contas_receber', 'create');
  v_id uuid;
begin
  if coalesce(_origem_tipo, '') !~ '^[a-z_]{3,40}$' or length(coalesce(_origem_ref, '')) not between 1 and 120 then
    raise exception 'Origem inválida.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('fin_orig:' || v_corr || _origem_tipo || _origem_ref, 0));
  select id into v_id from public.financial_receivables
   where correspondente_id = v_corr and origem_tipo = _origem_tipo and origem_ref = _origem_ref and status <> 'cancelada';
  if v_id is not null then return v_id; end if;
  return ((public.fin_conta_salvar('receber', jsonb_build_object(
            'descricao', _descricao, 'valor', _valor, 'vencimento', _vencimento, 'pagador', _pagador,
            'proposta_id', _proposta, 'origem_tipo', _origem_tipo, 'origem_ref', _origem_ref,
            'confirmar_duplicidade', true, 'justificativa', 'Receita gerada pela origem ' || _origem_tipo))) -> 'ids' ->> 0)::uuid;
end $$;

-- -----------------------------------------------------------------------------
-- D. Livro de baixas: registrar e estornar
-- -----------------------------------------------------------------------------
/** Aplica o livro no lançamento (valor pago/recebido e situação). */
create or replace function public.fin_aplicar_baixas(_natureza text, _alvo uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_total numeric := public.fin_total_baixado(_natureza, _alvo);
  v_data date := (select max(data) from public.fin_baixas where natureza = _natureza and alvo_id = _alvo and estornada_em is null);
  v_tol numeric;
begin
  perform set_config('fin.interno', 'on', true);
  if _natureza = 'conta_pagar' then
    update public.financial_payables
       set valor_pago = v_total,
           status = case when status = 'cancelada' then status
                         when v_total > 0 and v_total >= valor then 'paga'::public.financial_status
                         when v_total > 0 then 'parcial'::public.financial_status else 'aberta'::public.financial_status end,
           data_pagamento = case when v_total > 0 and v_total >= valor then v_data end
     where id = _alvo;
  elsif _natureza = 'conta_receber' then
    update public.financial_receivables
       set valor_pago = v_total,
           status = case when status = 'cancelada' then status
                         when v_total > 0 and v_total >= valor then 'paga'::public.financial_status
                         when v_total > 0 then 'parcial'::public.financial_status else 'aberta'::public.financial_status end,
           data_pagamento = case when v_total > 0 and v_total >= valor then v_data end
     where id = _alvo;
  elsif _natureza = 'comissao_banco' then
    perform public.fin_cb_atualizar(_alvo);
  elsif _natureza = 'comissao_participante' then
    select (public.fin_param(correspondente_id)).tolerancia_divergencia into v_tol from public.comissoes_usuario where id = _alvo;
    update public.comissoes_usuario
       set valor_pago = v_total,
           situacao = case when situacao = 'cancelada' then situacao
                           when v_total > 0 and v_total + coalesce(v_tol, 0) >= valor_comissao then 'paga'
                           when v_total > 0 then 'parcial'
                           when situacao in ('paga', 'parcial') then 'aprovada' else situacao end,
           status = case when situacao = 'cancelada' then 'cancelada'::public.comissao_usuario_status
                         when v_total > 0 and v_total + coalesce(v_tol, 0) >= valor_comissao then 'paga'::public.comissao_usuario_status
                         else 'a_pagar'::public.comissao_usuario_status end
     where id = _alvo;
  end if;
end $$;

/**
 * Registra recebimento/pagamento efetivo (total ou parcial) com comprovante. Única porta
 * para "recebido"/"pago" (além da conciliação confirmada, que usa esta mesma função).
 */
create or replace function public.fin_registrar_baixa(_natureza text, _alvo uuid, _valor numeric, _data date,
                                                      _conta_bancaria uuid default null, _forma text default null,
                                                      _documento text default null, _observacao text default null,
                                                      _anexo uuid default null, _permitir_excedente boolean default false,
                                                      _origem text default 'manual')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_corr uuid;
  v_acao text := case _natureza when 'comissao_banco' then 'receber' when 'conta_receber' then 'baixar'
                                when 'conta_pagar' then 'baixar' when 'comissao_participante' then 'pagar' end;
  v_saldo numeric;
  v_tol numeric;
  v_id uuid;
  c public.comissoes;
  cu public.comissoes_usuario;
  pg_ public.financial_payables;
  rc public.financial_receivables;
begin
  if _natureza = 'repasse_assinante' then
    raise exception 'O pagamento de repasse ao assinante é registrado na tela de repasses.' using errcode = '22023';
  end if;
  if v_acao is null then raise exception 'Natureza inválida.' using errcode = '22023'; end if;
  if _origem = 'conciliacao' then
    if not public.fin_pode('financeiro.conciliacao', 'conciliar') then
      raise exception 'Você não tem permissão para conciliar.' using errcode = '42501';
    end if;
  elsif _origem <> 'manual' then
    raise exception 'Origem inválida.' using errcode = '22023';
  end if;
  v_corr := public.fin_exigir(public.fin_modulo_natureza(_natureza), v_acao);
  if _valor is null or _valor <= 0 or _valor >= 1000000000 then raise exception 'Valor inválido.' using errcode = '22023'; end if;
  if _data is null or _data > current_date + 1 or _data < date '2000-01-01' then
    raise exception 'Data do pagamento inválida (não pode ser futura).' using errcode = '22023';
  end if;
  if _conta_bancaria is not null and not exists (select 1 from public.fin_contas_bancarias where id = _conta_bancaria and correspondente_id = v_corr) then
    raise exception 'Conta bancária não encontrada.' using errcode = 'P0002';
  end if;
  if _anexo is not null and not exists (select 1 from public.fin_anexos where id = _anexo and correspondente_id = v_corr and removido_em is null) then
    raise exception 'Comprovante não encontrado.' using errcode = 'P0002';
  end if;
  v_tol := (public.fin_param(v_corr)).tolerancia_divergencia;

  if _natureza = 'comissao_banco' then
    select * into c from public.comissoes where id = _alvo and correspondente_id = v_corr for update;
    if not found then raise exception 'Comissão não encontrada.' using errcode = 'P0002'; end if;
    if c.situacao = 'cancelado' then raise exception 'Comissão cancelada não recebe.' using errcode = '55000'; end if;
    v_saldo := coalesce(c.valor_informado, c.valor_bruto) - public.fin_total_baixado(_natureza, _alvo);
    if round(_valor, 2) > v_saldo + v_tol and not _permitir_excedente then
      raise exception 'O valor passa do esperado (saldo R$ %). Confirme para registrar como divergente.', to_char(greatest(v_saldo, 0), 'FM999G999G990D00')
        using errcode = 'P0001', hint = 'excedente';
    end if;
  elsif _natureza = 'comissao_participante' then
    select * into cu from public.comissoes_usuario where id = _alvo and correspondente_id = v_corr for update;
    if not found then raise exception 'Comissão não encontrada.' using errcode = 'P0002'; end if;
    if cu.situacao not in ('aprovada', 'parcial') then
      raise exception 'Só comissão aprovada para pagamento pode ser paga.' using errcode = '55000';
    end if;
    v_saldo := cu.valor_comissao - public.fin_total_baixado(_natureza, _alvo);
    if round(_valor, 2) > v_saldo + v_tol then raise exception 'O valor passa do saldo a pagar.' using errcode = '22023'; end if;
  elsif _natureza = 'conta_pagar' then
    select * into pg_ from public.financial_payables where id = _alvo and correspondente_id = v_corr for update;
    if not found or pg_.natureza <> 'operacional' then raise exception 'Conta não encontrada.' using errcode = 'P0002'; end if;
    if pg_.rascunho then raise exception 'Confira o rascunho do boleto antes de pagar.' using errcode = '55000'; end if;
    if pg_.status in ('cancelada', 'paga', 'estornada') then raise exception 'Conta % não recebe pagamento.', pg_.status using errcode = '55000'; end if;
    v_saldo := pg_.valor - public.fin_total_baixado(_natureza, _alvo);
    if round(_valor, 2) > v_saldo + v_tol then raise exception 'O valor passa do saldo da conta.' using errcode = '22023'; end if;
  else
    select * into rc from public.financial_receivables where id = _alvo and correspondente_id = v_corr for update;
    if not found or rc.natureza <> 'operacional' then raise exception 'Conta não encontrada.' using errcode = 'P0002'; end if;
    if rc.status in ('cancelada', 'paga', 'estornada') then raise exception 'Conta % não recebe pagamento.', rc.status using errcode = '55000'; end if;
    v_saldo := rc.valor - public.fin_total_baixado(_natureza, _alvo);
    if round(_valor, 2) > v_saldo + v_tol then raise exception 'O valor passa do saldo da conta.' using errcode = '22023'; end if;
  end if;

  perform public.fin_ctx(case when _natureza in ('comissao_banco', 'conta_receber') then 'recebimento_registrado'
                              else 'pagamento_registrado' end, _observacao);
  insert into public.fin_baixas (correspondente_id, natureza, sentido, alvo_id, valor, data, conta_bancaria_id, forma, documento,
                                 observacao, anexo_id, origem, registrado_por)
  values (v_corr, _natureza, case when _natureza in ('comissao_banco', 'conta_receber') then 'entrada' else 'saida' end,
          _alvo, round(_valor, 2), _data, _conta_bancaria, nullif(btrim(_forma), ''), nullif(btrim(_documento), ''),
          nullif(btrim(_observacao), ''), _anexo, _origem, auth.uid())
  returning id into v_id;
  if _anexo is not null then
    update public.fin_anexos set entidade = 'fin_baixas', entidade_id = v_id where id = _anexo and entidade_id is null;
  end if;
  perform public.fin_aplicar_baixas(_natureza, _alvo);
  perform public.fin_ctx_fim();
  return v_id;
end $$;

create or replace function public.fin_estornar_baixa(_id uuid, _motivo text, _origem text default 'manual')
returns void language plpgsql security definer set search_path = public as $$
declare
  b public.fin_baixas;
  v_acao text;
begin
  select * into b from public.fin_baixas where id = _id for update;
  if not found or b.correspondente_id is distinct from public.fin_corr() then
    raise exception 'Pagamento não encontrado.' using errcode = 'P0002';
  end if;
  if b.natureza = 'repasse_assinante' then
    raise exception 'O estorno de repasse ao assinante é feito na tela de repasses.' using errcode = '22023';
  end if;
  v_acao := case b.natureza when 'comissao_banco' then 'receber' when 'comissao_participante' then 'pagar' else 'baixar' end;
  perform public.fin_exigir(public.fin_modulo_natureza(b.natureza), v_acao);
  if length(btrim(coalesce(_motivo, ''))) < 5 then raise exception 'Escreva o motivo do estorno.' using errcode = '22023'; end if;
  if b.estornada_em is not null then raise exception 'Este pagamento já foi estornado.' using errcode = '55000'; end if;
  if _origem <> 'conciliacao' and to_regclass('public.fin_conciliacoes') is not null
     and exists (select 1 from public.fin_conciliacoes fc where fc.baixa_id = _id and fc.desfeita_em is null) then
    raise exception 'Este pagamento está conciliado com o extrato: desfaça a conciliação antes.' using errcode = '55000';
  end if;
  perform public.fin_ctx('estornada', _motivo);
  update public.fin_baixas set estornada_em = now(), estornada_por = auth.uid(), estorno_motivo = btrim(_motivo) where id = _id;
  perform public.fin_aplicar_baixas(b.natureza, b.alvo_id);
  perform public.fin_ctx_fim();
end $$;

-- -----------------------------------------------------------------------------
-- E. Cadastros (categorias, centros, formas, contas bancárias, fornecedores), parâmetros e anexos
-- -----------------------------------------------------------------------------
create or replace function public.fin_cadastro_salvar(_entidade text, _d jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_corr uuid;
  v_id uuid := nullif(_d ->> 'id', '')::uuid;
  v_nome text := btrim(coalesce(_d ->> 'nome', _d ->> 'apelido', ''));
  v_doc text := nullif(regexp_replace(coalesce(_d ->> 'documento', ''), '\D', '', 'g'), '');
begin
  if _entidade = 'fornecedor' and not public.fin_pode('financeiro.regras', 'edit') then
    v_corr := public.fin_exigir('financeiro.contas_pagar', 'create');
  else
    v_corr := public.fin_exigir('financeiro.regras', 'edit');
  end if;
  if length(v_nome) < 2 then raise exception 'Escreva o nome.' using errcode = '22023'; end if;
  perform public.fin_ctx(case when v_id is null then 'cadastro_criado' else 'cadastro_alterado' end, null);
  if _entidade in ('categoria', 'centro', 'forma') then
    if exists (select 1 from (
                 select id, nome, correspondente_id from public.financial_categories where _entidade = 'categoria'
                 union all select id, nome, correspondente_id from public.financial_cost_centers where _entidade = 'centro'
                 union all select id, nome, correspondente_id from public.financial_payment_methods where _entidade = 'forma') x
                where x.correspondente_id = v_corr and lower(x.nome) = lower(v_nome) and x.id is distinct from v_id) then
      raise exception 'Já existe um cadastro com este nome.' using errcode = '23505';
    end if;
  end if;
  if _entidade = 'categoria' then
    if v_id is null then
      insert into public.financial_categories (correspondente_id, nome, tipo, ativo)
      values (v_corr, v_nome, coalesce(nullif(_d ->> 'tipo', ''), 'despesa')::public.financial_categoria_tipo, coalesce((_d ->> 'ativo')::boolean, true))
      returning id into v_id;
    else
      update public.financial_categories set nome = v_nome, tipo = coalesce(nullif(_d ->> 'tipo', ''), tipo::text)::public.financial_categoria_tipo,
             ativo = coalesce((_d ->> 'ativo')::boolean, ativo) where id = v_id and correspondente_id = v_corr;
    end if;
  elsif _entidade = 'centro' then
    if v_id is null then
      insert into public.financial_cost_centers (correspondente_id, nome, ativo) values (v_corr, v_nome, coalesce((_d ->> 'ativo')::boolean, true)) returning id into v_id;
    else
      update public.financial_cost_centers set nome = v_nome, ativo = coalesce((_d ->> 'ativo')::boolean, ativo) where id = v_id and correspondente_id = v_corr;
    end if;
  elsif _entidade = 'forma' then
    if v_id is null then
      insert into public.financial_payment_methods (correspondente_id, nome, ativo) values (v_corr, v_nome, coalesce((_d ->> 'ativo')::boolean, true)) returning id into v_id;
    else
      update public.financial_payment_methods set nome = v_nome, ativo = coalesce((_d ->> 'ativo')::boolean, ativo) where id = v_id and correspondente_id = v_corr;
    end if;
  elsif _entidade = 'conta_bancaria' then
    if v_id is null then
      insert into public.fin_contas_bancarias (correspondente_id, apelido, banco_codigo, banco_nome, agencia, conta, ativo, criado_por)
      values (v_corr, v_nome, nullif(_d ->> 'banco_codigo', ''), nullif(btrim(_d ->> 'banco_nome'), ''), nullif(btrim(_d ->> 'agencia'), ''),
              nullif(btrim(_d ->> 'conta'), ''), coalesce((_d ->> 'ativo')::boolean, true), auth.uid())
      returning id into v_id;
    else
      update public.fin_contas_bancarias set apelido = v_nome, banco_codigo = nullif(_d ->> 'banco_codigo', ''),
             banco_nome = nullif(btrim(_d ->> 'banco_nome'), ''), agencia = nullif(btrim(_d ->> 'agencia'), ''),
             conta = nullif(btrim(_d ->> 'conta'), ''), ativo = coalesce((_d ->> 'ativo')::boolean, ativo)
       where id = v_id and correspondente_id = v_corr;
    end if;
  elsif _entidade = 'fornecedor' then
    if v_doc is not null and v_doc !~ '^(\d{11}|\d{14})$' then raise exception 'CPF/CNPJ inválido.' using errcode = '22023'; end if;
    if v_doc is not null and exists (select 1 from public.fin_fornecedores where correspondente_id = v_corr and documento = v_doc and id is distinct from v_id) then
      raise exception 'Já existe fornecedor com este CPF/CNPJ.' using errcode = '23505';
    end if;
    if v_id is null then
      insert into public.fin_fornecedores (correspondente_id, nome, documento, email, telefone, categoria_id, observacao, ativo, criado_por)
      values (v_corr, v_nome, v_doc, nullif(btrim(_d ->> 'email'), ''), nullif(btrim(_d ->> 'telefone'), ''),
              nullif(_d ->> 'categoria_id', '')::uuid, nullif(btrim(_d ->> 'observacao'), ''), coalesce((_d ->> 'ativo')::boolean, true), auth.uid())
      returning id into v_id;
    else
      update public.fin_fornecedores set nome = v_nome, documento = v_doc, email = nullif(btrim(_d ->> 'email'), ''),
             telefone = nullif(btrim(_d ->> 'telefone'), ''), categoria_id = nullif(_d ->> 'categoria_id', '')::uuid,
             observacao = nullif(btrim(_d ->> 'observacao'), ''), ativo = coalesce((_d ->> 'ativo')::boolean, ativo)
       where id = v_id and correspondente_id = v_corr;
    end if;
  else
    raise exception 'Cadastro inválido.' using errcode = '22023';
  end if;
  if v_id is null or not found then raise exception 'Cadastro não encontrado.' using errcode = 'P0002'; end if;
  perform public.fin_ctx_fim();
  return v_id;
end $$;

create or replace function public.fin_parametros_salvar(_d jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_corr uuid := public.fin_exigir('financeiro.regras', 'edit');
begin
  perform public.fin_ctx('parametros_alterados', null);
  insert into public.fin_parametros (correspondente_id, gatilho_comissao_banco, dias_previsao_recebimento, dias_vencimento_comissao,
                                     tolerancia_divergencia, dias_janela_conciliacao, atualizado_por, atualizado_em)
  values (v_corr, coalesce(_d ->> 'gatilho_comissao_banco', 'contrato_emitido'), coalesce((_d ->> 'dias_previsao_recebimento')::int, 30),
          coalesce((_d ->> 'dias_vencimento_comissao')::int, 30), coalesce((_d ->> 'tolerancia_divergencia')::numeric, 0.01),
          coalesce((_d ->> 'dias_janela_conciliacao')::int, 3), auth.uid(), now())
  on conflict (correspondente_id) do update
     set gatilho_comissao_banco = excluded.gatilho_comissao_banco, dias_previsao_recebimento = excluded.dias_previsao_recebimento,
         dias_vencimento_comissao = excluded.dias_vencimento_comissao, tolerancia_divergencia = excluded.tolerancia_divergencia,
         dias_janela_conciliacao = excluded.dias_janela_conciliacao, atualizado_por = excluded.atualizado_por, atualizado_em = now();
  perform public.fin_ctx_fim();
end $$;

/** Registra um arquivo já enviado ao bucket (a política do storage conferiu a pasta do módulo). */
create or replace function public.fin_anexo_registrar(_pasta text, _entidade text, _entidade_id uuid, _caminho text,
                                                      _nome text, _tipo text, _tamanho bigint)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_mod text := public.fin_modulo_da_pasta(_pasta);
  v_corr uuid := public.fin_corr();
  v_id uuid;
begin
  if v_mod is null or v_corr is null then raise exception 'Pasta inválida.' using errcode = '22023'; end if;
  if not (public.fin_pode(v_mod, 'create') or public.fin_pode(v_mod, 'edit') or public.fin_pode(v_mod, 'baixar')
          or public.fin_pode(v_mod, 'receber') or public.fin_pode(v_mod, 'pagar') or public.fin_pode(v_mod, 'conciliar')) then
    raise exception 'Você não tem permissão para anexar neste módulo.' using errcode = '42501';
  end if;
  if _caminho is null or position(v_corr::text || '/' || _pasta || '/' in _caminho) <> 1 or _caminho ~ '\.\.' then
    raise exception 'Caminho do arquivo inválido.' using errcode = '22023';
  end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'financeiro-comprovantes' and o.name = _caminho) then
    raise exception 'Arquivo não encontrado no armazenamento.' using errcode = 'P0002';
  end if;
  perform public.fin_ctx('anexo_enviado', null);
  insert into public.fin_anexos (correspondente_id, modulo, entidade, entidade_id, caminho, nome, tipo, tamanho, enviado_por)
  values (v_corr, v_mod, coalesce(nullif(btrim(_entidade), ''), 'avulso'), _entidade_id, _caminho, left(coalesce(_nome, 'arquivo'), 200),
          left(_tipo, 120), _tamanho, auth.uid())
  returning id into v_id;
  perform public.fin_ctx_fim();
  return v_id;
end $$;

-- -----------------------------------------------------------------------------
-- Execução: cada função confere a permissão por dentro; nada para anon/PUBLIC
-- -----------------------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'public.fin_cb_lancar(jsonb)', 'public.fin_cb_informar(uuid, numeric, text)', 'public.fin_cb_corrigir_previsao(uuid, numeric, text)',
    'public.fin_cb_contestar(uuid, text)', 'public.fin_cb_resolver_contestacao(uuid, text)', 'public.fin_cb_cancelar(uuid, text)',
    'public.fin_cb_encerrar_com_diferenca(uuid, text)', 'public.fin_cb_gerar_faltantes()', 'public.fin_regra_banco_salvar(jsonb)',
    'public.fin_participantes_salvar(uuid, jsonb)', 'public.fin_cu_gerar_faltantes(uuid)', 'public.fin_cu_lancar(jsonb)',
    'public.fin_cu_aprovar(uuid[])', 'public.fin_cu_contestar(uuid, text)', 'public.fin_cu_ajustar(uuid, numeric, text)',
    'public.fin_cu_resolver_contestacao(uuid, boolean, numeric, text)', 'public.fin_cu_cancelar(uuid, text)',
    'public.fin_regra_participante_salvar(jsonb)', 'public.fin_regra_encerrar(text, uuid, text)',
    'public.fin_conta_duplicatas(text, jsonb, uuid)', 'public.fin_conta_salvar(text, jsonb)',
    'public.fin_conta_confirmar_rascunho(uuid, jsonb)', 'public.fin_conta_cancelar(text, uuid, text)',
    'public.fin_conta_descartar_rascunho(uuid)', 'public.fin_receita_de_origem(text, text, text, numeric, date, text, uuid)',
    'public.fin_registrar_baixa(text, uuid, numeric, date, uuid, text, text, text, uuid, boolean, text)',
    'public.fin_estornar_baixa(uuid, text, text)', 'public.fin_cadastro_salvar(text, jsonb)', 'public.fin_parametros_salvar(jsonb)',
    'public.fin_anexo_registrar(text, text, uuid, text, text, text, bigint)']
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  -- internas: só o próprio banco (gatilhos e outras funções)
  foreach f in array array[
    'public.fin_cb_situacao(public.comissoes, numeric)', 'public.fin_cb_atualizar(uuid)', 'public.calcular_comissao_proposta(uuid)',
    'public.fin_data_gatilho(public.propostas, text)',
    'public.on_proposta_contrato_emitido()', 'public.fin_participantes_padrao(uuid)', 'public.fin_cu_base(public.propostas, text)',
    'public.calcular_comissoes_usuario_proposta(uuid, text)', 'public.on_proposta_comissao_usuario_insert()',
    'public.fin_cu_apos_recebimento_banco(uuid)', 'public.fin_cu_soma_excede(uuid, numeric, uuid)', 'public.fin_aplicar_baixas(text, uuid)']
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;
