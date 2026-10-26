-- =============================================================================
-- Auditoria adversarial independente do pedido de 26/10 (eco-aud): financeiro da matriz
-- e gerenciador de arquivos. Cada quebra tem teste no pgTAP 758 do Agilliza Tech (banco único).
--
--   1. fin_param(uuid) e fin_total_baixado(text, uuid) são internas (SECURITY DEFINER, sem
--      conferência), mas o `authenticated` mantinha EXECUTE pelo privilégio padrão do
--      Supabase: qualquer pessoa logada lia os parâmetros financeiros de OUTRO correspondente
--      e somava baixas de qualquer alvo pelo /rpc.
--   2. Comissão de participante: quem lançava (ou o próprio beneficiário) aprovava a
--      própria comissão. Agora o beneficiário nunca aprova a dele, e quem lançou só aprova
--      se for administrador/correspondente (mesma regra do Agilliza Tech: o dono pode).
--   3. Ajuste para cima depois de pagamento parcial mantinha a aprovação antiga e o saldo
--      novo era pago sem ninguém aprovar.
--   4. fin_estornar_baixa aceitava `_origem = 'conciliacao'` vindo do cliente e pulava a
--      trava "desfaça a conciliação antes" (a baixa conciliada era estornada e a conta
--      reaberta com o extrato ainda "conciliado"). O desfazer da conciliação já marca a
--      conciliação como desfeita antes de estornar: a trava vale sempre.
--   5. fin_conta_salvar (modo edição) liga o contexto interno e com isso o gatilho de
--      guarda não valia: conta já paga mudava de valor (R$ 100 paga virava R$ 1). As
--      regras "paga/cancelada não muda valor nem vencimento" e "valor ≥ pago" agora valem
--      também por dentro.
--   6. arquivos_registrar confiava no tamanho informado pelo navegador: `tamanho: 0`
--      registrava 50 MB sem gastar cota. Vale o tamanho real do objeto no Storage.
-- Funções existentes alteradas (definição em vigor, mudança mínima): fin_cu_aprovar,
-- fin_cu_ajustar, fin_estornar_baixa, fin_tg_guarda_conta, arquivos_registrar.
-- =============================================================================


revoke execute on function public.fin_param(uuid), public.fin_total_baixado(text, uuid) from authenticated;

CREATE OR REPLACE FUNCTION public.fin_cu_aprovar(_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
   where id = any (_ids) and correspondente_id = v_corr and situacao in ('prevista', 'ajustada')
     -- eco-aud: ninguém aprova a própria comissão; quem lançou só aprova se for admin/correspondente.
     and usuario_id is distinct from auth.uid()
     and (criado_por is distinct from auth.uid()
          or public.has_any_role(auth.uid(), array['admin', 'correspondente']::public.app_role[]));
  get diagnostics v_ok = row_count;
  v_rec := cardinality(_ids) - v_ok;
  perform public.fin_ctx_fim();
  return jsonb_build_object('aprovadas', v_ok, 'recusadas', v_rec);
end $function$
;

CREATE OR REPLACE FUNCTION public.fin_cu_ajustar(_id uuid, _novo numeric, _motivo text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- eco-aud: com pagamento registrado, aumentar manteria a aprovação antiga sobre o saldo novo.
  if cu.valor_pago > 0 and round(_novo, 2) > cu.valor_comissao then
    raise exception 'Comissão com pagamento registrado não aumenta: estorne o pagamento e ajuste (o valor novo passa por aprovação).'
      using errcode = '55000';
  end if;
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
end $function$
;

CREATE OR REPLACE FUNCTION public.fin_estornar_baixa(_id uuid, _motivo text, _origem text DEFAULT 'manual'::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- eco-aud: vale sempre (o desfazer da conciliação já a marca desfeita antes de estornar).
  if to_regclass('public.fin_conciliacoes') is not null
     and exists (select 1 from public.fin_conciliacoes fc where fc.baixa_id = _id and fc.desfeita_em is null) then
    raise exception 'Este pagamento está conciliado com o extrato: desfaça a conciliação antes.' using errcode = '55000';
  end if;
  perform public.fin_ctx('estornada', _motivo);
  update public.fin_baixas set estornada_em = now(), estornada_por = auth.uid(), estorno_motivo = btrim(_motivo) where id = _id;
  perform public.fin_aplicar_baixas(b.natureza, b.alvo_id);
  perform public.fin_ctx_fim();
end $function$
;

CREATE OR REPLACE FUNCTION public.fin_tg_guarda_conta()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  natureza_tab text := case tg_table_name when 'financial_payables' then 'conta_pagar' else 'conta_receber' end;
begin
  -- eco-aud: estas duas valem também dentro das funções do financeiro (fin_conta_salvar editava conta paga).
  if tg_op = 'UPDATE' then
    if old.status in ('paga', 'cancelada', 'estornada')
       and (new.valor is distinct from old.valor or new.vencimento is distinct from old.vencimento) then
      raise exception 'Conta paga ou cancelada não muda de valor nem de vencimento.' using errcode = '42501';
    end if;
    if new.valor < coalesce(new.valor_pago, 0) then
      raise exception 'O valor não pode ficar menor que o já pago.' using errcode = '22023';
    end if;
  end if;
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
end $function$
;

CREATE OR REPLACE FUNCTION public.arquivos_registrar(p_parent uuid, p_nome text, p_storage_path text, p_content_type text, p_tamanho bigint, p_nova_versao boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_corr uuid := public._arquivos_corr(auth.uid());
  v_nome text := btrim(coalesce(p_nome, ''));
  v_existente uuid;
  v_versao integer;
  v_id uuid;
begin
  perform public._arquivos_pasta_destino(auth.uid(), p_parent);
  if p_storage_path is null or split_part(p_storage_path, '/', 1) <> v_corr::text
     or p_storage_path like '%..%' then
    raise exception 'Caminho do arquivo inválido.' using errcode = '22023';
  end if;
  if p_tamanho is null or p_tamanho < 0 then
    raise exception 'Tamanho do arquivo inválido.' using errcode = '22023';
  end if;
  if exists (select 1 from public.arquivos_versoes v where v.storage_path = p_storage_path)
     or exists (select 1 from public.arquivos_nos n where n.storage_path = p_storage_path) then
    raise exception 'Este envio já foi registrado.' using errcode = '23505';
  end if;
  -- eco-aud: vale o tamanho real do objeto no Storage (o navegador dizia 0 e não gastava cota).
  p_tamanho := greatest(p_tamanho, coalesce((select (o.metadata ->> 'size')::bigint from storage.objects o
                                              where o.bucket_id = 'arquivos' and o.name = p_storage_path), 0));
  perform public._arquivos_conferir_cota(v_corr, p_tamanho);
  perform pg_advisory_xact_lock(hashtext('arquivos:' || v_corr::text || ':' || coalesce(p_parent::text, 'raiz')));

  select n.id into v_existente from public.arquivos_nos n
   where n.correspondente_id = v_corr and n.parent_id is not distinct from p_parent and n.tipo = 'arquivo'
     and n.excluido_em is null and lower(n.nome) = lower(v_nome)
   for update;

  if v_existente is not null then
    if not coalesce(p_nova_versao, false) then
      raise exception 'Já existe um arquivo com o nome "%" nesta pasta.', v_nome using errcode = '23505';
    end if;
    perform public._arquivos_exigir(auth.uid(), v_existente, 2);
    select coalesce(max(v.versao), 0) + 1 into v_versao from public.arquivos_versoes v where v.no_id = v_existente;
    insert into public.arquivos_versoes (no_id, versao, storage_path, content_type, tamanho, criado_por)
    values (v_existente, v_versao, p_storage_path, nullif(p_content_type, ''), p_tamanho, auth.uid());
    update public.arquivos_nos
       set storage_path = p_storage_path, content_type = nullif(p_content_type, ''), tamanho = p_tamanho,
           versao_atual = v_versao
     where id = v_existente;
    return jsonb_build_object('id', v_existente, 'versao', v_versao);
  end if;

  insert into public.arquivos_nos (correspondente_id, parent_id, tipo, nome, storage_path, content_type, tamanho, criado_por)
  values (v_corr, p_parent, 'arquivo', v_nome, p_storage_path, nullif(p_content_type, ''), p_tamanho, auth.uid())
  returning id into v_id;
  insert into public.arquivos_versoes (no_id, versao, storage_path, content_type, tamanho, criado_por)
  values (v_id, 1, p_storage_path, nullif(p_content_type, ''), p_tamanho, auth.uid());
  return jsonb_build_object('id', v_id, 'versao', 1);
end $function$
;
