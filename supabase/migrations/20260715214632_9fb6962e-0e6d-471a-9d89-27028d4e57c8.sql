-- Performance: índices para reduzir latência de consultas quentes (identificadas via pg_stat_statements).
-- Todos os CREATE INDEX IF NOT EXISTS — seguros e idempotentes.

-- proposta_followups: sem índice de FK; consultada por proposta_id + ordem cronológica.
CREATE INDEX IF NOT EXISTS proposta_followups_proposta_idx
  ON public.proposta_followups (proposta_id, created_at DESC);

-- proposta_bancos: consultas por proposta_id + ORDER BY nome_banco / created_at.
CREATE INDEX IF NOT EXISTS proposta_bancos_proposta_created_idx
  ON public.proposta_bancos (proposta_id, created_at);

-- simulacao_bancos: ORDER BY valor_parcela dentro de uma simulação.
CREATE INDEX IF NOT EXISTS simulacao_bancos_sim_parcela_idx
  ON public.simulacao_bancos (simulacao_id, valor_parcela NULLS LAST);

-- simulacoes: painel filtra por responsável + período.
CREATE INDEX IF NOT EXISTS simulacoes_responsavel_created_idx
  ON public.simulacoes (usuario_responsavel_id, created_at DESC);

-- propostas: painel filtra por responsável + período.
CREATE INDEX IF NOT EXISTS propostas_responsavel_created_idx
  ON public.propostas (usuario_responsavel_id, created_at DESC);

CREATE INDEX IF NOT EXISTS propostas_correspondente_status_idx
  ON public.propostas (correspondente_id, status);

-- tasks: filtros por correspondente/responsável/criador + status/prazo.
CREATE INDEX IF NOT EXISTS tasks_correspondente_status_idx
  ON public.tasks (correspondente_id, status);
CREATE INDEX IF NOT EXISTS tasks_responsavel_idx
  ON public.tasks (responsavel_id);
CREATE INDEX IF NOT EXISTS tasks_criador_idx
  ON public.tasks (criador_id);

-- demandas: filtros pesados em RLS e listagem.
CREATE INDEX IF NOT EXISTS demandas_correspondente_status_idx
  ON public.demandas (correspondente_id, status);
CREATE INDEX IF NOT EXISTS demandas_responsavel_idx
  ON public.demandas (responsavel_id);
CREATE INDEX IF NOT EXISTS demandas_criador_idx
  ON public.demandas (criador_id);
CREATE INDEX IF NOT EXISTS demandas_cliente_idx
  ON public.demandas (cliente_id);

-- demanda_mensagens: listagem por demanda em ordem cronológica.
CREATE INDEX IF NOT EXISTS demanda_mensagens_demanda_idx
  ON public.demanda_mensagens (demanda_id, created_at);

-- crm_chat_meta: acessos por cliente.
CREATE INDEX IF NOT EXISTS crm_chat_meta_cliente_idx
  ON public.crm_chat_meta (cliente_id);

-- cliente_parceiros: função cliente_vinculado_ao_parceiro(parceiro_id, cliente_id) — filtra por parceiro_id.
CREATE INDEX IF NOT EXISTS cliente_parceiros_parceiro_idx
  ON public.cliente_parceiros (parceiro_id);

-- cliente_enderecos: filtro composto por cliente + principal.
CREATE INDEX IF NOT EXISTS cliente_enderecos_cliente_principal_idx
  ON public.cliente_enderecos (cliente_id, principal);

-- comissoes / financeiro: leitura por proposta.
CREATE INDEX IF NOT EXISTS comissoes_proposta_idx
  ON public.comissoes (proposta_id);

-- cliente_historico já tem (cliente_id, created_at DESC). Nada a fazer.
-- notificacoes já tem (user_id, lida, created_at DESC).