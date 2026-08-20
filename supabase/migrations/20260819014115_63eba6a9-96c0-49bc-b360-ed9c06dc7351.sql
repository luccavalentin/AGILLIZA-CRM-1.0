
-- 1. Backfill das taxas do Itaú que foram sobrescritas com 0 por condições de corrida
update public.simulacao_bancos
set 
  taxa_juros_ano = (raw_response->>'taxaJurosAnoBanco')::numeric,
  taxa_cet_ano = (raw_response->>'taxaCetAnoBanco')::numeric,
  mensagem_banco = null
where 
  nome_banco ilike '%ita%'
  and (taxa_juros_ano = 0 or taxa_juros_ano is null)
  and raw_response->>'taxaJurosAnoBanco' is not null
  and (raw_response->>'taxaJurosAnoBanco')::numeric > 0
  and created_at >= now() - interval '24 hours';

-- 2. Limpeza de mensagens de envio em bancos que já concluíram
update public.simulacao_bancos
set mensagem_banco = null
where 
  status_banco = 'simulada'
  and mensagem_banco = 'Enviando solicitação...'
  and created_at >= now() - interval '24 hours';

-- 3. Recálculo de status global para simulações que ficaram presas em 'enviando'
update public.simulacoes s
set status = case 
    when not exists (select 1 from public.simulacao_bancos sb where sb.simulacao_id = s.id and sb.selecionado = true and sb.status_banco != 'simulada') then 'simulada'::public.simulacao_status
    when exists (select 1 from public.simulacao_bancos sb where sb.simulacao_id = s.id and sb.selecionado = true and sb.status_banco = 'simulada') then 'parcialmente_simulada'::public.simulacao_status
    when not exists (select 1 from public.simulacao_bancos sb where sb.simulacao_id = s.id and sb.selecionado = true and sb.status_banco != 'erro') then 'erro_banco'::public.simulacao_status
    else 'enviando'::public.simulacao_status
  end,
  updated_at = now()
where 
  status = 'enviando'
  and created_at >= now() - interval '24 hours';
