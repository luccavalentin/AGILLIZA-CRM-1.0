-- =============================================================================
-- Auditoria adversarial rodada 2 (eco-aud2): financeiro da matriz. Teste pgTAP 761 do Agilliza Tech.
--
--   1. `fin_pay_ins` aceitava o papel financeiro antigo (usuario_pode_financeiro) para criar
--      QUALQUER conta a pagar, mesmo sem "Contas a pagar › criar" na matriz nova. O papel antigo
--      vale só para as contas da folha/adiantamentos (origem rh_*), como nas outras políticas;
--      e a alteração (with check) também não troca a origem para fugir da regra.
--   2. Hash de duplicidade do extrato dependia da posição da linha no arquivo: o mesmo extrato
--      baixado com outro período (ou em outra ordem) entrava de novo inteiro. Agora: data, valor,
--      descrição, documento (ou o FITID) e a ocorrência da movimentação idêntica no arquivo.
--   3. Tolerância de divergência ia até R$ 1.000 (quem edita regras aceitava comissão R$ 999
--      menor como "exata"). Agora há um teto configurável por correspondente (padrão R$ 1,00),
--      que só a administração do correspondente muda.
-- Funções existentes alteradas: public.fin_importar_extrato, public.fin_param,
-- public.fin_parametros_salvar. Políticas: fin_pay_ins, fin_pay_upd.
-- =============================================================================

-- 1. Contas a pagar ---------------------------------------------------------------------------
drop policy if exists fin_pay_ins on public.financial_payables;
create policy fin_pay_ins on public.financial_payables for insert to authenticated
  with check (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
              and (public.fin_pode('financeiro.contas_pagar', 'create')
                   or (origem_tipo like 'rh\_%' and public.usuario_pode_financeiro((select auth.uid())))));
drop policy if exists fin_pay_upd on public.financial_payables;
create policy fin_pay_upd on public.financial_payables for update to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
         and (public.fin_pode('financeiro.contas_pagar', 'edit')
              or (origem_tipo like 'rh\_%' and public.usuario_pode_financeiro((select auth.uid())))))
  with check (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
              and (public.fin_pode('financeiro.contas_pagar', 'edit')
                   or (origem_tipo like 'rh\_%' and public.usuario_pode_financeiro((select auth.uid())))));

-- 3. Teto da tolerância -----------------------------------------------------------------------
alter table public.fin_parametros
  add column if not exists teto_tolerancia_divergencia numeric(14, 2) not null default 1.00
    check (teto_tolerancia_divergencia between 0 and 1000);

create or replace function public.fin_tg_parametros_tolerancia()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (tg_op = 'INSERT' and new.teto_tolerancia_divergencia <> 1.00)
     or (tg_op = 'UPDATE' and new.teto_tolerancia_divergencia is distinct from old.teto_tolerancia_divergencia) then
    if auth.uid() is not null and not public.has_any_role(auth.uid(), array['admin', 'correspondente']::public.app_role[]) then
      raise exception 'Só a administração do correspondente muda o teto da tolerância de divergência.' using errcode = '42501';
    end if;
  end if;
  if new.tolerancia_divergencia is null or new.tolerancia_divergencia < 0
     or new.tolerancia_divergencia > new.teto_tolerancia_divergencia then
    raise exception 'A tolerância de divergência (R$ %) passa do teto configurado (R$ %).',
      to_char(new.tolerancia_divergencia, 'FM999999990.00'), to_char(new.teto_tolerancia_divergencia, 'FM999999990.00')
      using errcode = '22023';
  end if;
  return new;
end $$;
revoke all on function public.fin_tg_parametros_tolerancia() from public, anon, authenticated;
drop trigger if exists trg_fin_parametros_tolerancia on public.fin_parametros;
create trigger trg_fin_parametros_tolerancia before insert or update on public.fin_parametros
  for each row execute function public.fin_tg_parametros_tolerancia();

-- 2 e 3. Funções (definição em vigor + mudança marcada 20261027120001) --------------------------
CREATE OR REPLACE FUNCTION public.fin_importar_extrato(_conta uuid, _arquivo text, _sha text, _formato text, _linhas jsonb, _confirmar boolean DEFAULT false, _anexo uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_corr uuid := public.fin_exigir('financeiro.conciliacao', 'create');
  v_ext uuid;
  l jsonb;
  v_data date;
  v_valor numeric;
  v_desc text;
  v_doc text;
  v_fitid text;
  v_hash text;
  v_orig uuid;
  v_novas integer := 0;
  v_dup integer := 0;
  v_ant text;
  v_base text;
  v_n integer;
  v_vistos jsonb := '{}';
begin
  if not exists (select 1 from public.fin_contas_bancarias where id = _conta and correspondente_id = v_corr and ativo) then
    raise exception 'Conta bancária não encontrada.' using errcode = 'P0002';
  end if;
  if jsonb_typeof(_linhas) <> 'array' or jsonb_array_length(_linhas) = 0 then
    raise exception 'O arquivo não tem movimentações.' using errcode = '22023';
  end if;
  if jsonb_array_length(_linhas) > 5000 then raise exception 'No máximo 5.000 movimentações por arquivo.' using errcode = '22023'; end if;
  select to_char(importado_em, 'DD/MM/YYYY') into v_ant from public.fin_extratos
   where correspondente_id = v_corr and conta_bancaria_id = _conta and arquivo_sha256 = lower(_sha) limit 1;
  if v_ant is not null and not _confirmar then
    raise exception 'Este mesmo arquivo já foi importado em %. Confirme para importar de novo (as movimentações repetidas ficam marcadas).', v_ant
      using errcode = 'P0001', hint = 'duplicidade';
  end if;
  perform public.fin_ctx('extrato_importado', _arquivo);
  insert into public.fin_extratos (correspondente_id, conta_bancaria_id, arquivo_nome, arquivo_sha256, formato, anexo_id, importado_por)
  values (v_corr, _conta, left(_arquivo, 200), lower(_sha), _formato, _anexo, auth.uid())
  returning id into v_ext;
  for l in select * from jsonb_array_elements(_linhas) loop
    begin
      v_data := (l ->> 'data')::date;
      v_valor := round((l ->> 'valor')::numeric, 2);
    exception when others then
      raise exception 'Movimentação com data ou valor inválido: %', left(l::text, 120) using errcode = '22023';
    end;
    if v_data is null or v_valor is null or v_valor = 0 or abs(v_valor) >= 1000000000
       or v_data < date '2000-01-01' or v_data > current_date + 1 then
      raise exception 'Movimentação com data ou valor inválido: %', left(l::text, 120) using errcode = '22023';
    end if;
    v_desc := left(btrim(coalesce(l ->> 'descricao', '')), 300);
    v_doc := nullif(left(btrim(coalesce(l ->> 'documento', '')), 120), '');
    v_fitid := nullif(left(btrim(coalesce(l ->> 'fitid', '')), 120), '');
    -- 20261027120001: o hash não depende mais da posição da linha no arquivo (o mesmo extrato
    -- baixado com outro período ou em outra ordem duplicava tudo). Movimentações idênticas no
    -- mesmo dia continuam distintas pela ocorrência (1ª, 2ª…) dentro do arquivo.
    v_base := md5(_conta::text || '|' || v_data || '|' || v_valor || '|' ||
                  coalesce(v_fitid, public.fin_normalizar(v_desc) || '|' || coalesce(v_doc, '')));
    v_n := coalesce((v_vistos ->> v_base)::int, 0) + 1;
    v_vistos := v_vistos || jsonb_build_object(v_base, v_n);
    v_hash := case when v_fitid is not null then v_base else md5(v_base || '|' || v_n) end;
    select id into v_orig from public.fin_extrato_linhas
     where correspondente_id = v_corr and conta_bancaria_id = _conta and hash = v_hash and situacao <> 'duplicada' limit 1;
    insert into public.fin_extrato_linhas (correspondente_id, extrato_id, conta_bancaria_id, data, valor, descricao, documento, fitid,
                                           hash, situacao, linha_original_id)
    values (v_corr, v_ext, _conta, v_data, v_valor, v_desc, v_doc, v_fitid, v_hash,
            case when v_orig is null then 'pendente' else 'duplicada' end, v_orig);
    if v_orig is null then v_novas := v_novas + 1; else v_dup := v_dup + 1; end if;
  end loop;
  update public.fin_extratos e
     set linhas_total = v_novas + v_dup, linhas_novas = v_novas, linhas_duplicadas = v_dup,
         periodo_de = (select min(data) from public.fin_extrato_linhas where extrato_id = v_ext),
         periodo_ate = (select max(data) from public.fin_extrato_linhas where extrato_id = v_ext)
   where id = v_ext;
  if _anexo is not null then
    update public.fin_anexos set entidade = 'fin_extratos', entidade_id = v_ext where id = _anexo and correspondente_id = v_corr and entidade_id is null;
  end if;
  perform public.fin_ctx_fim();
  return jsonb_build_object('extrato_id', v_ext, 'total', v_novas + v_dup, 'novas', v_novas, 'duplicadas', v_dup);
end $function$
;

CREATE OR REPLACE FUNCTION public.fin_param(_corr uuid)
 RETURNS fin_parametros
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select coalesce(
    (select p from public.fin_parametros p where p.correspondente_id = _corr),
    row(_corr, 'contrato_emitido', 30, 30, 0.01, 3, null, now(), 1.00)::public.fin_parametros)
$function$
;

CREATE OR REPLACE FUNCTION public.fin_parametros_salvar(_d jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_corr uuid := public.fin_exigir('financeiro.regras', 'edit');
  -- 20261027120001: teto da tolerância (padrão R$ 1,00); quem muda o teto é a administração (gatilho).
  v_teto numeric := coalesce((_d ->> 'teto_tolerancia_divergencia')::numeric,
                             (select p.teto_tolerancia_divergencia from public.fin_parametros p where p.correspondente_id = v_corr), 1.00);
begin
  perform public.fin_ctx('parametros_alterados', null);
  insert into public.fin_parametros (correspondente_id, gatilho_comissao_banco, dias_previsao_recebimento, dias_vencimento_comissao,
                                     tolerancia_divergencia, dias_janela_conciliacao, atualizado_por, atualizado_em, teto_tolerancia_divergencia)
  values (v_corr, coalesce(_d ->> 'gatilho_comissao_banco', 'contrato_emitido'), coalesce((_d ->> 'dias_previsao_recebimento')::int, 30),
          coalesce((_d ->> 'dias_vencimento_comissao')::int, 30), coalesce((_d ->> 'tolerancia_divergencia')::numeric, 0.01),
          coalesce((_d ->> 'dias_janela_conciliacao')::int, 3), auth.uid(), now(), v_teto)
  on conflict (correspondente_id) do update
     set gatilho_comissao_banco = excluded.gatilho_comissao_banco, dias_previsao_recebimento = excluded.dias_previsao_recebimento,
         dias_vencimento_comissao = excluded.dias_vencimento_comissao, tolerancia_divergencia = excluded.tolerancia_divergencia,
         dias_janela_conciliacao = excluded.dias_janela_conciliacao, teto_tolerancia_divergencia = excluded.teto_tolerancia_divergencia, atualizado_por = excluded.atualizado_por, atualizado_em = now();
  perform public.fin_ctx_fim();
end $function$
;

