
CREATE INDEX IF NOT EXISTS propostas_cliente_idx ON public.propostas (cliente_id);
CREATE INDEX IF NOT EXISTS propostas_simulacao_idx ON public.propostas (simulacao_id);
CREATE INDEX IF NOT EXISTS propostas_corr_created_ativas_idx ON public.propostas (correspondente_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS simulacoes_corr_created_ativas_idx ON public.simulacoes (correspondente_id, created_at DESC) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS tasks_cliente_idx ON public.tasks (cliente_id);

CREATE INDEX IF NOT EXISTS demandas_corr_created_idx ON public.demandas (correspondente_id, created_at DESC);

CREATE INDEX IF NOT EXISTS fin_payables_corr_status_venc_idx ON public.financial_payables (correspondente_id, status, vencimento);

CREATE INDEX IF NOT EXISTS fin_receivables_corr_status_venc_idx ON public.financial_receivables (correspondente_id, status, vencimento);
CREATE INDEX IF NOT EXISTS fin_receivables_proposta_idx ON public.financial_receivables (proposta_id);

CREATE INDEX IF NOT EXISTS fluxo_caixa_corr_data_idx ON public.fluxo_caixa (correspondente_id, data DESC);

CREATE INDEX IF NOT EXISTS cliente_documentos_cliente_idx ON public.cliente_documentos (cliente_id);
