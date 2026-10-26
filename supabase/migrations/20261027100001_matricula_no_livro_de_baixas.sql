-- Pagamento de matrícula no livro único de baixas do financeiro da matriz (consolidação c1, 26/10/2026).
--
-- A frente a4 controla quem pediu cada matrícula e se pagou (`matricula_solicitacoes.reembolsado`,
-- marcado na tela de Matrículas); a frente a5 tem o livro de TODO recebimento (`fin_baixas`) e a
-- conciliação. Até aqui o financeiro só LIA as matrículas (`fin_matriculas_a_receber`): o dinheiro
-- recebido não entrava no livro nem casava com o extrato.
--
-- Desenho (sem conta a receber paralela, para a receita não contar duas vezes):
--   · natureza nova `matricula` no livro (entrada; alvo = a própria matrícula; módulo das contas a
--     receber). A matrícula concluída é o "lançamento"; não nasce `financial_receivables` para ela;
--   · marcar paga na tela de Matrículas → gatilho grava a baixa no livro (origem `matricula`),
--     idempotente (um índice único deixa no máximo UMA baixa ativa por matrícula, mesmo em corrida);
--     desfazer o pagamento → a baixa é estornada (recusado se ela já estiver conciliada com o extrato);
--   · baixa pelo financeiro (`fin_registrar_baixa('matricula', …)`, direto ou pela conciliação) →
--     `fin_aplicar_baixas` marca a matrícula paga; estornar a baixa a devolve para "em aberto";
--   · a conciliação sugere as matrículas em aberto para as entradas do extrato;
--   · o painel mostra a natureza `matricula` (realizado = livro; previsto = concluídas em aberto),
--     uma vez só.
--
-- Funções existentes alteradas (geradas de pg_get_functiondef, mudança mínima): fin_modulo_natureza,
-- fin_descricao_alvo, fin_aplicar_baixas, fin_registrar_baixa, fin_sugestoes_conciliacao,
-- fin_conciliar, fin_painel. As de a4 (matricula_marcar_paga, matricula_desfazer_pagamento) não mudam.

-- -----------------------------------------------------------------------------
-- 1. O livro aceita a natureza `matricula` (entrada) e a origem `matricula`
-- -----------------------------------------------------------------------------
alter table public.fin_baixas drop constraint if exists fin_baixas_natureza_check;
alter table public.fin_baixas add constraint fin_baixas_natureza_check
  check (natureza in ('comissao_banco', 'repasse_assinante', 'comissao_participante', 'conta_pagar', 'conta_receber', 'matricula'));
alter table public.fin_baixas drop constraint if exists fin_baixas_check;
alter table public.fin_baixas add constraint fin_baixas_check
  check ((natureza in ('comissao_banco', 'conta_receber', 'matricula') and sentido = 'entrada')
      or (natureza in ('repasse_assinante', 'comissao_participante', 'conta_pagar') and sentido = 'saida'));
alter table public.fin_baixas drop constraint if exists fin_baixas_origem_check;
alter table public.fin_baixas add constraint fin_baixas_origem_check
  check (origem in ('manual', 'conciliacao', 'migracao', 'matricula'));

-- Uma baixa ativa por matrícula: a idempotência vale também com dois cliques ao mesmo tempo.
create unique index if not exists fin_baixas_matricula_unica
  on public.fin_baixas (alvo_id) where natureza = 'matricula' and estornada_em is null;

-- Pagamentos já marcados na tela de Matrículas antes desta migração entram no livro uma vez.
insert into public.fin_baixas (correspondente_id, natureza, sentido, alvo_id, valor, data, origem, observacao, registrado_por, registrado_em)
select s.correspondente_id, 'matricula', 'entrada', s.id, s.valor,
       least(coalesce(s.data_pagto_reembolso, s.reembolsado_em::date, current_date), current_date), 'migracao',
       'Pagamento marcado na tela de Matrículas (antes do livro)', s.pago_registrado_por, coalesce(s.reembolsado_em, now())
  from public.matricula_solicitacoes s
 where s.reembolsado and s.status = 'concluida' and s.valor > 0
   and not exists (select 1 from public.fin_baixas b where b.natureza = 'matricula' and b.alvo_id = s.id and b.estornada_em is null);

CREATE OR REPLACE FUNCTION public.fin_modulo_natureza(_natureza text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select case _natureza
    when 'comissao_banco' then 'financeiro.comissoes_bancos'
    when 'repasse_assinante' then 'financeiro.repasses'
    when 'comissao_participante' then 'financeiro.comissoes'
    when 'conta_pagar' then 'financeiro.contas_pagar'
    when 'conta_receber' then 'financeiro.contas_receber'
    -- c1: matrícula paga pelo solicitante é recebimento das contas a receber.
    when 'matricula' then 'financeiro.contas_receber'
  end
$function$;

CREATE OR REPLACE FUNCTION public.fin_descricao_alvo(_natureza text, _alvo uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select case _natureza
    when 'comissao_banco' then (select 'Comissão ' || coalesce(c.banco_nome, 'banco') || coalesce(' · ' || c.cliente_nome, '')
                                       || coalesce(' · contrato ' || c.numero_contrato, '') from public.comissoes c where c.id = _alvo)
    when 'comissao_participante' then (select 'Comissão de ' || coalesce(pr.nome, 'participante') || coalesce(' · proposta ' || cu.numero_proposta, '')
                                         from public.comissoes_usuario cu left join public.profiles pr on pr.id = cu.usuario_id where cu.id = _alvo)
    when 'conta_pagar' then (select p.descricao || coalesce(' · ' || coalesce(f.nome, p.fornecedor, p.boleto_beneficiario), '')
                               from public.financial_payables p left join public.fin_fornecedores f on f.id = p.fornecedor_id where p.id = _alvo)
    when 'conta_receber' then (select r.descricao || coalesce(' · ' || r.pagador, '') from public.financial_receivables r where r.id = _alvo)
    when 'repasse_assinante' then 'Repasse ao assinante'
    when 'matricula' then (select 'Matrícula' || coalesce(' · ' || coalesce(s.solicitante_conta_nome, nullif(btrim(s.corretor), ''), s.solicitante), '')
                                  || coalesce(' · ' || nullif(btrim(s.imovel), ''), '') || coalesce(' · ' || nullif(btrim(s.cartorio), ''), '')
                             from public.matricula_solicitacoes s where s.id = _alvo)
  end
$function$;

CREATE OR REPLACE FUNCTION public.fin_aplicar_baixas(_natureza text, _alvo uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  elsif _natureza = 'matricula' then
    -- c1: o livro manda na matrícula (paga = baixa ativa do valor dela).
    update public.matricula_solicitacoes
       set reembolsado = v_total > 0 and v_total + 0.005 >= valor,
           reembolsado_em = case when v_total > 0 and v_total + 0.005 >= valor then coalesce(reembolsado_em, now()) end,
           data_pagto_reembolso = case when v_total > 0 and v_total + 0.005 >= valor then v_data end,
           pago_registrado_por = case when v_total > 0 and v_total + 0.005 >= valor then coalesce(pago_registrado_por, auth.uid()) end
     where id = _alvo and status = 'concluida'
       and reembolsado is distinct from (v_total > 0 and v_total + 0.005 >= valor);
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
end $function$;

CREATE OR REPLACE FUNCTION public.fin_registrar_baixa(_natureza text, _alvo uuid, _valor numeric, _data date, _conta_bancaria uuid DEFAULT NULL::uuid, _forma text DEFAULT NULL::text, _documento text DEFAULT NULL::text, _observacao text DEFAULT NULL::text, _anexo uuid DEFAULT NULL::uuid, _permitir_excedente boolean DEFAULT false, _origem text DEFAULT 'manual'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_corr uuid;
  v_acao text := case _natureza when 'comissao_banco' then 'receber' when 'conta_receber' then 'baixar'
                                when 'conta_pagar' then 'baixar' when 'comissao_participante' then 'pagar'
                                when 'matricula' then 'baixar' end;
  v_saldo numeric;
  v_tol numeric;
  v_id uuid;
  c public.comissoes;
  cu public.comissoes_usuario;
  pg_ public.financial_payables;
  rc public.financial_receivables;
  mt public.matricula_solicitacoes;
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
  elsif _natureza = 'matricula' then
    -- c1: matrícula concluída, paga de uma vez pelo valor dela (o pedido é "pago ou não").
    select * into mt from public.matricula_solicitacoes where id = _alvo and correspondente_id = v_corr for update;
    if not found then raise exception 'Matrícula não encontrada.' using errcode = 'P0002'; end if;
    if mt.status <> 'concluida' or mt.valor <= 0 then
      raise exception 'Só matrícula concluída e com valor recebe pagamento.' using errcode = '55000';
    end if;
    if mt.reembolsado then raise exception 'Esta matrícula já está paga.' using errcode = '55000'; end if;
    if abs(round(_valor, 2) - mt.valor) > v_tol then
      raise exception 'O pagamento da matrícula é o valor dela (R$ %).', to_char(mt.valor, 'FM999G999G990D00') using errcode = '22023';
    end if;
  else
    select * into rc from public.financial_receivables where id = _alvo and correspondente_id = v_corr for update;
    if not found or rc.natureza <> 'operacional' then raise exception 'Conta não encontrada.' using errcode = 'P0002'; end if;
    if rc.status in ('cancelada', 'paga', 'estornada') then raise exception 'Conta % não recebe pagamento.', rc.status using errcode = '55000'; end if;
    v_saldo := rc.valor - public.fin_total_baixado(_natureza, _alvo);
    if round(_valor, 2) > v_saldo + v_tol then raise exception 'O valor passa do saldo da conta.' using errcode = '22023'; end if;
  end if;

  perform public.fin_ctx(case when _natureza in ('comissao_banco', 'conta_receber', 'matricula') then 'recebimento_registrado'
                              else 'pagamento_registrado' end, _observacao);
  insert into public.fin_baixas (correspondente_id, natureza, sentido, alvo_id, valor, data, conta_bancaria_id, forma, documento,
                                 observacao, anexo_id, origem, registrado_por)
  values (v_corr, _natureza, case when _natureza in ('comissao_banco', 'conta_receber', 'matricula') then 'entrada' else 'saida' end,
          _alvo, round(_valor, 2), _data, _conta_bancaria, nullif(btrim(_forma), ''), nullif(btrim(_documento), ''),
          nullif(btrim(_observacao), ''), _anexo, _origem, auth.uid())
  returning id into v_id;
  if _anexo is not null then
    update public.fin_anexos set entidade = 'fin_baixas', entidade_id = v_id where id = _anexo and entidade_id is null;
  end if;
  perform public.fin_aplicar_baixas(_natureza, _alvo);
  perform public.fin_ctx_fim();
  return v_id;
end $function$;

CREATE OR REPLACE FUNCTION public.fin_sugestoes_conciliacao(_extrato uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_corr uuid := public.fin_exigir('financeiro.conciliacao', 'view');
  v_par public.fin_parametros := public.fin_param(v_corr);
  v_conta uuid;
  v_res jsonb;
begin
  select conta_bancaria_id into v_conta from public.fin_extratos where id = _extrato and correspondente_id = v_corr;
  if v_conta is null then raise exception 'Extrato não encontrado.' using errcode = 'P0002'; end if;
  with linhas as (
    select l.* from public.fin_extrato_linhas l where l.extrato_id = _extrato and l.situacao = 'pendente'
  ),
  abertos as (
    select 'comissao_banco'::text tipo, c.id, 'entrada'::text sentido,
           coalesce(c.valor_informado, c.valor_bruto) - c.valor_recebido saldo, c.previsao_recebimento ref_data,
           public.fin_descricao_alvo('comissao_banco', c.id) descricao, coalesce(c.numero_contrato, '') documento
      from public.comissoes c
     where c.correspondente_id = v_corr and c.situacao in ('previsto', 'a_receber', 'parcial', 'divergente')
       and coalesce(c.valor_informado, c.valor_bruto) - c.valor_recebido > 0
    union all
    select 'conta_receber', r.id, 'entrada', r.valor - r.valor_pago, r.vencimento,
           public.fin_descricao_alvo('conta_receber', r.id), coalesce(r.numero, '')
      from public.financial_receivables r
     where r.correspondente_id = v_corr and r.natureza = 'operacional' and r.status in ('aberta', 'parcial', 'atrasada')
    union all
    select 'conta_pagar', p.id, 'saida', p.valor - p.valor_pago, p.vencimento,
           public.fin_descricao_alvo('conta_pagar', p.id), coalesce(p.numero, '') || ' ' || coalesce(p.linha_digitavel, '')
      from public.financial_payables p
     where p.correspondente_id = v_corr and p.natureza = 'operacional' and not p.rascunho
       and p.status in ('aberta', 'parcial', 'atrasada')
    union all
    select 'comissao_participante', cu.id, 'saida', cu.valor_comissao - cu.valor_pago, cu.vencimento,
           public.fin_descricao_alvo('comissao_participante', cu.id), coalesce(cu.numero_proposta, '')
      from public.comissoes_usuario cu
     where cu.correspondente_id = v_corr and cu.situacao in ('aprovada', 'parcial')
    union all
    -- c1: matrícula concluída e ainda não paga por quem pediu.
    select 'matricula', s.id, 'entrada', s.valor, coalesce(s.concluida_em::date, s.data_solicitacao),
           public.fin_descricao_alvo('matricula', s.id), ''
      from public.matricula_solicitacoes s
     where s.correspondente_id = v_corr and s.status = 'concluida' and not s.reembolsado and s.valor > 0
  ),
  candidatos as (
    -- pagamentos já registrados e ainda não conciliados
    select l.id linha_id, 'baixa'::text tipo, b.id alvo_id, b.natureza, b.valor, b.data ref_data,
           public.fin_descricao_alvo(b.natureza, b.id) descricao,
           70 - 4 * least(abs(b.data - l.data), 10) + 12 * least(public.fin_similar(l.descricao, public.fin_descricao_alvo(b.natureza, b.id)), 3)
             + case when l.documento is not null and l.documento = b.documento then 20 else 0 end as pontos,
           array['pagamento_registrado', 'exato'] as sinais
      from linhas l
      join public.fin_baixas b on b.correspondente_id = v_corr and b.estornada_em is null
       and b.sentido = case when l.valor > 0 then 'entrada' else 'saida' end
       and abs(b.valor - abs(l.valor)) <= v_par.tolerancia_divergencia
       and abs(b.data - l.data) <= v_par.dias_janela_conciliacao
       and (b.conta_bancaria_id is null or b.conta_bancaria_id = v_conta)
       and not exists (select 1 from public.fin_conciliacoes fc where fc.baixa_id = b.id and fc.desfeita_em is null)
    union all
    -- lançamentos em aberto (a conciliação registra o pagamento ao confirmar)
    select l.id, a.tipo, a.id, a.tipo, a.saldo, a.ref_data, a.descricao,
           case when abs(a.saldo - abs(l.valor)) <= v_par.tolerancia_divergencia then 50 else 20 end
             - 2 * least(abs(coalesce(a.ref_data, l.data) - l.data), 15)
             + 12 * least(public.fin_similar(l.descricao, a.descricao || ' ' || a.documento), 3)
             + case when l.documento is not null and position(l.documento in a.documento) > 0 then 20 else 0 end,
           case when abs(a.saldo - abs(l.valor)) <= v_par.tolerancia_divergencia then array['exato']
                else array['parcial'] end
      from linhas l
      join abertos a on a.sentido = case when l.valor > 0 then 'entrada' else 'saida' end
       -- valor exato; parcial só com indício no texto ou no documento (senão toda tarifa "casaria")
       and (abs(a.saldo - abs(l.valor)) <= v_par.tolerancia_divergencia
            or (abs(l.valor) < a.saldo
                and (public.fin_similar(l.descricao, a.descricao || ' ' || a.documento) > 0
                     or (l.documento is not null and position(l.documento in a.documento) > 0))))
       and abs(coalesce(a.ref_data, l.data) - l.data) <= greatest(v_par.dias_janela_conciliacao * 10, 30)
  ),
  filtrados as (
    select c.*, row_number() over (partition by c.linha_id order by c.pontos desc, c.ref_data) as ordem,
           count(*) over (partition by c.tipo, c.alvo_id) as disputa
      from candidatos c
     where not exists (select 1 from public.fin_sugestoes_rejeitadas sr
                        where sr.linha_id = c.linha_id and sr.alvo_tipo = c.tipo and sr.alvo_id = c.alvo_id)
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'linha_id', l.id, 'data', l.data, 'valor', l.valor, 'descricao', l.descricao, 'documento', l.documento,
           'sugestoes', coalesce((select jsonb_agg(jsonb_build_object(
                           'tipo', f.tipo, 'alvo_id', f.alvo_id, 'natureza', f.natureza, 'valor', f.valor, 'data', f.ref_data,
                           'descricao', f.descricao, 'pontos', f.pontos,
                           'sinais', to_jsonb(f.sinais || case when f.disputa > 1 then array['disputada'] else array[]::text[] end))
                           order by f.ordem)
                          from filtrados f where f.linha_id = l.id and f.ordem <= 3), '[]'::jsonb))
           order by l.data, l.valor), '[]'::jsonb)
    into v_res
    from linhas l;
  return v_res;
end $function$;

CREATE OR REPLACE FUNCTION public.fin_conciliar(_linha uuid, _tipo text, _alvo uuid, _permitir_excedente boolean DEFAULT false)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_corr uuid := public.fin_exigir('financeiro.conciliacao', 'conciliar');
  l public.fin_extrato_linhas;
  b public.fin_baixas;
  v_baixa uuid;
  v_id uuid;
  v_criou boolean := false;
  v_tol numeric := (public.fin_param(v_corr)).tolerancia_divergencia;
begin
  select * into l from public.fin_extrato_linhas where id = _linha and correspondente_id = v_corr for update;
  if not found then raise exception 'Movimentação não encontrada.' using errcode = 'P0002'; end if;
  if l.situacao <> 'pendente' then
    raise exception 'Esta movimentação já está %.', l.situacao using errcode = '55000';
  end if;
  if _tipo = 'baixa' then
    select * into b from public.fin_baixas where id = _alvo and correspondente_id = v_corr for update;
    if not found or b.estornada_em is not null then raise exception 'Pagamento não encontrado ou estornado.' using errcode = 'P0002'; end if;
    if b.sentido <> (case when l.valor > 0 then 'entrada' else 'saida' end) then
      raise exception 'Entrada do extrato não concilia com pagamento (e vice-versa).' using errcode = '22023';
    end if;
    if abs(b.valor - abs(l.valor)) > v_tol then
      raise exception 'Valores diferentes (extrato R$ %, registrado R$ %).', to_char(abs(l.valor), 'FM999G999G990D00'),
        to_char(b.valor, 'FM999G999G990D00') using errcode = '22023';
    end if;
    if not public.fin_pode(public.fin_modulo_natureza(b.natureza), 'view') then
      raise exception 'Você não tem acesso a este lançamento.' using errcode = '42501';
    end if;
    v_baixa := b.id;
  elsif _tipo in ('comissao_banco', 'conta_receber', 'conta_pagar', 'comissao_participante', 'matricula') then
    if (_tipo in ('comissao_banco', 'conta_receber', 'matricula')) <> (l.valor > 0) then
      raise exception 'Entrada do extrato só concilia com recebimento (e saída com pagamento).' using errcode = '22023';
    end if;
    v_baixa := public.fin_registrar_baixa(_tipo, _alvo, abs(l.valor), l.data, l.conta_bancaria_id, 'Extrato', l.documento,
                                          left('Conciliação: ' || l.descricao, 500), null, _permitir_excedente, 'conciliacao');
    v_criou := true;
  else
    raise exception 'Tipo de conciliação inválido.' using errcode = '22023';
  end if;
  perform public.fin_ctx('conciliada', null);
  insert into public.fin_conciliacoes (correspondente_id, linha_id, baixa_id, criou_baixa, confirmado_por)
  values (v_corr, _linha, v_baixa, v_criou, auth.uid())
  returning id into v_id;
  update public.fin_extrato_linhas set situacao = 'conciliada' where id = _linha;
  perform public.fin_ctx_fim();
  return v_id;
exception when unique_violation then
  raise exception 'Esta movimentação ou este pagamento já foi conciliado.' using errcode = '55000';
end $function$;

CREATE OR REPLACE FUNCTION public.fin_painel(_de date, _ate date, _f jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  -- painel ou fluxo de caixa (a tela de fluxo usa o mesmo cálculo)
  v_corr uuid := case when public.fin_pode('financeiro.fluxo_caixa', 'view') then public.fin_exigir('financeiro.fluxo_caixa', 'view')
                      else public.fin_exigir('financeiro.painel', 'view') end;
  v_banco text := nullif(_f ->> 'banco', '');
  v_prod text := nullif(_f ->> 'produto', '');
  v_prop uuid := nullif(_f ->> 'proposta_id', '')::uuid;
  v_pessoa uuid := nullif(_f ->> 'pessoa_id', '')::uuid;
  v_forn uuid := nullif(_f ->> 'fornecedor_id', '')::uuid;
  v_cat uuid := nullif(_f ->> 'categoria_id', '')::uuid;
  v_ver_cb boolean := public.fin_pode('financeiro.comissoes_bancos', 'view');
  v_ver_cu boolean := public.fin_pode('financeiro.comissoes', 'view');
  v_ver_cp boolean := public.fin_pode('financeiro.contas_pagar', 'view');
  v_ver_cr boolean := public.fin_pode('financeiro.contas_receber', 'view');
  v_ver_rp boolean := public.fin_pode('financeiro.repasses', 'view');
begin
  if _de is null or _ate is null or _ate < _de or _ate - _de > 1100 then
    raise exception 'Período inválido (até 3 anos).' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'periodo', jsonb_build_object('de', _de, 'ate', _ate),
    'bancos', case when v_ver_cb then (
      select jsonb_build_object(
        'quantidade', count(*), 'previsto', coalesce(sum(c.valor_bruto), 0), 'informado', coalesce(sum(c.valor_informado), 0),
        'recebido', coalesce(sum(c.valor_recebido), 0),
        'a_receber', coalesce(sum(greatest(coalesce(c.valor_informado, c.valor_bruto) - c.valor_recebido, 0))
                              filter (where c.situacao not in ('recebido', 'cancelado')), 0),
        'divergentes', count(*) filter (where c.situacao = 'divergente'),
        'divergente_valor', coalesce(sum(abs(coalesce(c.valor_informado, c.valor_bruto) - case when c.valor_recebido > 0 then c.valor_recebido else c.valor_bruto end))
                                     filter (where c.situacao = 'divergente'), 0),
        'contestadas', count(*) filter (where c.situacao = 'contestado'),
        'vencidas_qtd', count(*) filter (where c.situacao in ('previsto', 'a_receber', 'divergente') and c.valor_recebido = 0 and c.previsao_recebimento < current_date),
        'vencidas_valor', coalesce(sum(coalesce(c.valor_informado, c.valor_bruto)) filter (where c.situacao in ('previsto', 'a_receber', 'divergente')
                                       and c.valor_recebido = 0 and c.previsao_recebimento < current_date), 0),
        'por_situacao', coalesce((select jsonb_object_agg(s, n) from (select situacao s, count(*) n from public.comissoes c2
                                   where c2.correspondente_id = v_corr and coalesce(c2.previsao_recebimento, c2.created_at::date) between _de and _ate
                                     and (v_banco is null or c2.banco_nome = v_banco) and (v_prod is null or c2.produto = v_prod)
                                     and (v_prop is null or c2.proposta_id = v_prop) group by situacao) z), '{}'::jsonb),
        'por_banco', coalesce((select jsonb_agg(jsonb_build_object('banco', banco, 'previsto', previsto, 'recebido', recebido) order by previsto desc)
                                 from (select coalesce(c3.banco_nome, 'Sem banco') banco, sum(c3.valor_bruto) previsto, sum(c3.valor_recebido) recebido
                                         from public.comissoes c3
                                        where c3.correspondente_id = v_corr and c3.situacao <> 'cancelado'
                                          and coalesce(c3.previsao_recebimento, c3.created_at::date) between _de and _ate
                                          and (v_banco is null or c3.banco_nome = v_banco) and (v_prod is null or c3.produto = v_prod)
                                          and (v_prop is null or c3.proposta_id = v_prop)
                                        group by 1 order by 2 desc limit 12) w), '[]'::jsonb))
        from public.comissoes c
       where c.correspondente_id = v_corr and c.situacao <> 'cancelado'
         and coalesce(c.previsao_recebimento, c.created_at::date) between _de and _ate
         and (v_banco is null or c.banco_nome = v_banco) and (v_prod is null or c.produto = v_prod)
         and (v_prop is null or c.proposta_id = v_prop)) end,
    'participantes', case when v_ver_cu then (
      select jsonb_build_object(
        'quantidade', count(*), 'previstas', coalesce(sum(cu.valor_comissao) filter (where cu.situacao in ('prevista', 'ajustada')), 0),
        'aguardando', coalesce(sum(cu.valor_comissao) filter (where cu.situacao = 'aguardando_confirmacao'), 0),
        'aprovadas', coalesce(sum(cu.valor_comissao - cu.valor_pago) filter (where cu.situacao in ('aprovada', 'parcial')), 0),
        'pagas', coalesce(sum(cu.valor_pago), 0),
        'contestadas', count(*) filter (where cu.situacao = 'contestada'),
        'por_pessoa', coalesce((select jsonb_agg(jsonb_build_object('pessoa', nome, 'valor', valor, 'pago', pago) order by valor desc)
                                  from (select coalesce(pr.nome, 'Sem nome') nome, sum(x.valor_comissao) valor, sum(x.valor_pago) pago
                                          from public.comissoes_usuario x left join public.profiles pr on pr.id = x.usuario_id
                                         where x.correspondente_id = v_corr and x.situacao <> 'cancelada'
                                           and coalesce(x.vencimento, x.created_at::date) between _de and _ate
                                           and (v_pessoa is null or x.usuario_id = v_pessoa) and (v_banco is null or x.banco_nome = v_banco)
                                           and (v_prod is null or x.produto = v_prod) and (v_prop is null or x.proposta_id = v_prop)
                                         group by 1 order by 2 desc limit 10) w), '[]'::jsonb))
        from public.comissoes_usuario cu
       where cu.correspondente_id = v_corr and cu.situacao <> 'cancelada'
         and coalesce(cu.vencimento, cu.created_at::date) between _de and _ate
         and (v_pessoa is null or cu.usuario_id = v_pessoa) and (v_banco is null or cu.banco_nome = v_banco)
         and (v_prod is null or cu.produto = v_prod) and (v_prop is null or cu.proposta_id = v_prop)) end,
    'despesas', case when v_ver_cp then (
      select jsonb_build_object(
        'abertas', coalesce(sum(p.valor - p.valor_pago) filter (where p.status in ('aberta', 'parcial', 'atrasada')), 0),
        'vencidas', coalesce(sum(p.valor - p.valor_pago) filter (where p.status in ('aberta', 'parcial', 'atrasada') and p.vencimento < current_date), 0),
        'vencidas_qtd', count(*) filter (where p.status in ('aberta', 'parcial', 'atrasada') and p.vencimento < current_date),
        'pagas', coalesce(sum(p.valor_pago), 0),
        'recorrentes_qtd', count(*) filter (where p.recorrencia <> 'nenhuma' and p.status <> 'cancelada'),
        'rascunhos_qtd', (select count(*) from public.financial_payables r where r.correspondente_id = v_corr and r.rascunho),
        'por_categoria', coalesce((select jsonb_agg(jsonb_build_object('categoria', nome, 'valor', valor) order by valor desc)
                                     from (select coalesce(cat.nome, 'Sem categoria') nome, sum(x.valor) valor
                                             from public.financial_payables x left join public.financial_categories cat on cat.id = x.categoria_id
                                            where x.correspondente_id = v_corr and x.natureza = 'operacional' and not x.rascunho
                                              and x.status <> 'cancelada' and x.vencimento between _de and _ate
                                              and (v_forn is null or x.fornecedor_id = v_forn) and (v_cat is null or x.categoria_id = v_cat)
                                            group by 1 order by 2 desc limit 10) w), '[]'::jsonb))
        from public.financial_payables p
       where p.correspondente_id = v_corr and p.natureza = 'operacional' and not p.rascunho and p.status <> 'cancelada'
         and p.vencimento between _de and _ate
         and (v_forn is null or p.fornecedor_id = v_forn) and (v_cat is null or p.categoria_id = v_cat)) end,
    'receitas', case when v_ver_cr then (
      select jsonb_build_object(
        'abertas', coalesce(sum(r.valor - r.valor_pago) filter (where r.status in ('aberta', 'parcial', 'atrasada')), 0),
        'vencidas', coalesce(sum(r.valor - r.valor_pago) filter (where r.status in ('aberta', 'parcial', 'atrasada') and r.vencimento < current_date), 0),
        'recebidas', coalesce(sum(r.valor_pago), 0))
        from public.financial_receivables r
       where r.correspondente_id = v_corr and r.natureza = 'operacional' and r.status <> 'cancelada'
         and r.vencimento between _de and _ate and (v_cat is null or r.categoria_id = v_cat)) end,
    -- Realizado (livro) x previsto (saldos em aberto pela data esperada), mês a mês e por natureza.
    'fluxo', coalesce((
      select jsonb_agg(jsonb_build_object('mes', mes, 'natureza', natureza, 'previsto', previsto, 'realizado', realizado) order by mes, natureza)
        from (
          select to_char(m, 'YYYY-MM') mes, n natureza,
                 coalesce((select sum(valor) from public.fin_baixas b
                            where b.correspondente_id = v_corr and b.estornada_em is null and b.natureza = n
                              and date_trunc('month', b.data) = m
                              and public.fin_pode(public.fin_modulo_natureza(n), 'view')), 0) realizado,
                 coalesce(case n
                   when 'comissao_banco' then (select sum(greatest(coalesce(c.valor_informado, c.valor_bruto) - c.valor_recebido, 0))
                                                 from public.comissoes c where c.correspondente_id = v_corr and v_ver_cb
                                                  and c.situacao not in ('recebido', 'cancelado') and date_trunc('month', c.previsao_recebimento) = m)
                   when 'conta_receber' then (select sum(r.valor - r.valor_pago) from public.financial_receivables r
                                               where r.correspondente_id = v_corr and v_ver_cr and r.natureza = 'operacional'
                                                 and r.status in ('aberta', 'parcial', 'atrasada') and date_trunc('month', r.vencimento) = m)
                   when 'conta_pagar' then (select sum(p.valor - p.valor_pago) from public.financial_payables p
                                             where p.correspondente_id = v_corr and v_ver_cp and p.natureza = 'operacional' and not p.rascunho
                                               and p.status in ('aberta', 'parcial', 'atrasada') and date_trunc('month', p.vencimento) = m)
                   when 'comissao_participante' then (select sum(cu.valor_comissao - cu.valor_pago) from public.comissoes_usuario cu
                                                       where cu.correspondente_id = v_corr and v_ver_cu
                                                         and cu.situacao in ('prevista', 'aguardando_confirmacao', 'aprovada', 'parcial', 'ajustada', 'contestada')
                                                         and date_trunc('month', cu.vencimento) = m)
                   when 'matricula' then (select sum(s.valor) from public.matricula_solicitacoes s
                                           where s.correspondente_id = v_corr and v_ver_cr and s.status = 'concluida'
                                             and not s.reembolsado and s.valor > 0
                                             and date_trunc('month', coalesce(s.concluida_em::date, s.data_solicitacao)) = m)
                 end, 0) previsto
            from generate_series(date_trunc('month', _de), date_trunc('month', _ate), interval '1 month') m
           cross join unnest(array['comissao_banco', 'conta_receber', 'conta_pagar', 'comissao_participante', 'repasse_assinante', 'matricula']) n) f
       where previsto <> 0 or realizado <> 0), '[]'::jsonb),
    'alertas', jsonb_build_object(
      'sem_previsao', case when v_ver_cb then (select count(*) from public.propostas p
                                               where p.correspondente_id = v_corr and p.deleted_at is null
                                                 and p.status::text in ('contrato_emitido', 'registrado')
                                                 and not exists (select 1 from public.comissoes c where c.proposta_id = p.id and c.situacao <> 'cancelado')) end,
      'sem_regra', case when v_ver_cb then (select count(*) from public.comissoes c where c.correspondente_id = v_corr
                                              and c.situacao = 'previsto' and c.valor_bruto = 0) end,
      'vencidas_sem_recebimento', case when v_ver_cb then (select count(*) from public.comissoes c where c.correspondente_id = v_corr
                                               and c.situacao in ('previsto', 'a_receber', 'divergente') and c.valor_recebido = 0
                                               and c.previsao_recebimento < current_date) end,
      'divergencias', case when v_ver_cb then (select count(*) from public.comissoes c where c.correspondente_id = v_corr and c.situacao = 'divergente') end,
      'soma_excedida', case when v_ver_cu then (select count(*) from public.comissoes c
                                                where c.correspondente_id = v_corr and c.situacao <> 'cancelado' and c.proposta_id is not null
                                                  and (select coalesce(sum(cu.valor_comissao), 0) from public.comissoes_usuario cu
                                                        where cu.proposta_id = c.proposta_id and cu.situacao <> 'cancelada')
                                                      > coalesce(case when c.situacao = 'recebido' then c.valor_recebido end, c.valor_informado, c.valor_bruto) + 0.01
                                                  and coalesce(c.valor_informado, c.valor_bruto) > 0) end,
      'contestacoes', case when v_ver_cu then (select count(*) from public.comissoes_usuario where correspondente_id = v_corr and situacao = 'contestada') end,
      'rascunhos', case when v_ver_cp then (select count(*) from public.financial_payables where correspondente_id = v_corr and rascunho) end,
      'despesas_vencidas', case when v_ver_cp then (select count(*) from public.financial_payables where correspondente_id = v_corr
                                                    and natureza = 'operacional' and not rascunho and status in ('aberta', 'parcial', 'atrasada')
                                                    and vencimento < current_date) end,
      'extrato_pendente', case when public.fin_pode('financeiro.conciliacao', 'view') then (
                             select count(*) from public.fin_extrato_linhas where correspondente_id = v_corr and situacao = 'pendente') end,
      'repasses_visiveis', v_ver_rp));
end $function$;

-- -----------------------------------------------------------------------------
-- 3. Tela de Matrículas ↔ livro (gatilho; as funções da a4 não mudam)
-- -----------------------------------------------------------------------------
create or replace function public.fin_tg_matricula_no_livro()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.reembolsado and not old.reembolsado then
    -- Marcada paga fora do financeiro: entra no livro (se o financeiro já registrou, nada muda).
    if new.valor > 0 and new.status = 'concluida'
       and not exists (select 1 from public.fin_baixas b where b.natureza = 'matricula' and b.alvo_id = new.id and b.estornada_em is null) then
      perform public.fin_ctx('recebimento_registrado', 'Matrícula marcada paga na tela de Matrículas');
      insert into public.fin_baixas (correspondente_id, natureza, sentido, alvo_id, valor, data, observacao, origem, registrado_por)
      values (new.correspondente_id, 'matricula', 'entrada', new.id, new.valor,
              least(coalesce(new.data_pagto_reembolso, current_date), current_date),
              'Marcada paga na tela de Matrículas', 'matricula', coalesce(new.pago_registrado_por, auth.uid()))
      on conflict (alvo_id) where natureza = 'matricula' and estornada_em is null do nothing;
      perform public.fin_ctx_fim();
    end if;
  elsif old.reembolsado and not new.reembolsado then
    if exists (select 1 from public.fin_baixas b where b.natureza = 'matricula' and b.alvo_id = new.id and b.estornada_em is null) then
      if exists (select 1 from public.fin_baixas b join public.fin_conciliacoes fc on fc.baixa_id = b.id and fc.desfeita_em is null
                  where b.natureza = 'matricula' and b.alvo_id = new.id and b.estornada_em is null) then
        raise exception 'Este pagamento está conciliado com o extrato: desfaça a conciliação no financeiro antes.' using errcode = '55000';
      end if;
      perform public.fin_ctx('estornada', 'Pagamento desfeito na tela de Matrículas');
      update public.fin_baixas set estornada_em = now(), estornada_por = auth.uid(), estorno_motivo = 'Pagamento desfeito na tela de Matrículas'
       where natureza = 'matricula' and alvo_id = new.id and estornada_em is null;
      perform public.fin_ctx_fim();
    end if;
  end if;
  return null;
end $$;
revoke all on function public.fin_tg_matricula_no_livro() from public, anon, authenticated;

drop trigger if exists trg_fin_matricula_no_livro on public.matricula_solicitacoes;
create trigger trg_fin_matricula_no_livro
  after update of reembolsado on public.matricula_solicitacoes
  for each row execute function public.fin_tg_matricula_no_livro();
