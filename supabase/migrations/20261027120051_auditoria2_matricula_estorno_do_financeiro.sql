-- =============================================================================
-- Auditoria adversarial rodada 2 (eco-aud2, 26/10/2026): matrícula no livro de baixas
-- (consolidação c1, 20261027100001).
--
-- "Desfazer pagamento" na tela de Matrículas (ou o UPDATE direto de `reembolsado`, que a RLS
-- deixa para quem edita matrículas) estornava QUALQUER baixa ativa da matrícula — inclusive a
-- que o FINANCEIRO registrou (com conta bancária, forma e comprovante), sem a permissão de
-- baixar recebimentos e sem motivo. Agora a tela de Matrículas só desfaz o pagamento que ela
-- mesma lançou (origem `matricula` ou a carga inicial `migracao`); o recebimento registrado
-- pelo financeiro (origem `manual`/`conciliacao`) só é estornado por quem tem
-- "Contas a receber · baixar" (no financeiro, com motivo, como antes).
--
-- Função existente alterada (gerada de pg_get_functiondef, mudança mínima): public.fin_tg_matricula_no_livro.
-- Teste: pgTAP 764 do Agilliza Tech (banco único).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fin_tg_matricula_no_livro()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      -- aud2: o recebimento registrado pelo financeiro só sai pelo financeiro (permissão de baixar).
      if auth.uid() is not null
         and exists (select 1 from public.fin_baixas b where b.natureza = 'matricula' and b.alvo_id = new.id and b.estornada_em is null
                        and b.origem not in ('matricula', 'migracao'))
         and not public.fin_pode('financeiro.contas_receber', 'baixar') then
        raise exception 'Este pagamento foi registrado pelo financeiro: o estorno é feito lá, por quem baixa recebimentos.' using errcode = '42501';
      end if;
      perform public.fin_ctx('estornada', 'Pagamento desfeito na tela de Matrículas');
      update public.fin_baixas set estornada_em = now(), estornada_por = auth.uid(), estorno_motivo = 'Pagamento desfeito na tela de Matrículas'
       where natureza = 'matricula' and alvo_id = new.id and estornada_em is null;
      perform public.fin_ctx_fim();
    end if;
  end if;
  return null;
end $function$;
revoke all on function public.fin_tg_matricula_no_livro() from public, anon, authenticated;
