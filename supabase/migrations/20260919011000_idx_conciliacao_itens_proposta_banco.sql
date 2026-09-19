-- Índice da chave estrangeira conciliacao_itens.proposta_banco_id (advisor
-- unindexed_foreign_keys). Sem ele, apagar um proposta_bancos (ON DELETE SET
-- NULL) varre conciliacao_itens inteira. Não muda nenhum resultado.
create index if not exists idx_conciliacao_itens_proposta_banco_id
  on public.conciliacao_itens (proposta_banco_id);
