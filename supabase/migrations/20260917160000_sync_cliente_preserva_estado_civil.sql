-- `sync_cliente_derivados` gravava `estado_civil = v_estado_civil` e
-- `regime_casamento = v_regime` sem COALESCE: qualquer atualização do cliente
-- com esses campos vazios no CRM (ex.: gravação só do cônjuge ou do checklist)
-- apagava o estado civil e o regime já preenchidos na simulação, na proposta e
-- nos participantes. Agora o valor atual é mantido quando o CRM não tem um.
-- Idempotente: a troca só acontece enquanto a forma antiga existir.
do $$
declare
  d text;
begin
  d := pg_get_functiondef('public.sync_cliente_derivados'::regproc);
  d := replace(d, 'estado_civil = v_estado_civil,', 'estado_civil = coalesce(v_estado_civil, estado_civil),');
  d := replace(d, 'regime_casamento = v_regime,', 'regime_casamento = coalesce(v_regime, regime_casamento),');
  execute d;
end $$;
