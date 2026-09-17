-- Renda da simulação/proposta é a renda da operação: o usuário mantém a do CRM
-- quando ela cobre a renda necessária, ou digita outra — e é essa que vai ao
-- banco. `sync_cliente_derivados` copiava `renda_total_declarada` e
-- `conjuge_renda` para TODAS as simulações e participantes do cliente a cada
-- gravação do cadastro, trocando a renda digitada pela do CRM. Agora a renda do
-- CRM só preenche quando a simulação/participante ainda não tem renda.
-- Idempotente: cada troca só acontece enquanto a forma antiga existir.
do $$
declare
  d text;
begin
  d := pg_get_functiondef('public.sync_cliente_derivados'::regproc);
  d := replace(d,
    'renda_total = coalesce(new.renda_total_declarada, renda_total),',
    'renda_total = case when coalesce(renda_total, 0) > 0 then renda_total else coalesce(new.renda_total_declarada, renda_total) end,');
  d := replace(d,
    'when casado then new.conjuge_renda else null end,',
    'when casado then case when coalesce(renda_conjuge, 0) > 0 then renda_conjuge else new.conjuge_renda end else null end,');
  d := replace(d,
    'renda = coalesce(new.renda_total_declarada, renda),',
    'renda = case when coalesce(renda, 0) > 0 then renda else coalesce(new.renda_total_declarada, renda) end,');
  d := replace(d,
    'renda = coalesce(new.conjuge_renda, c.renda),',
    'renda = case when coalesce(c.renda, 0) > 0 then c.renda else coalesce(new.conjuge_renda, c.renda) end,');
  execute d;
end $$;
