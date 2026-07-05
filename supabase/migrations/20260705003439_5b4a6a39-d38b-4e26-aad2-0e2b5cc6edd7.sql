DROP TRIGGER IF EXISTS simulacao_before_write_trg ON public.simulacoes;
DROP TRIGGER IF EXISTS simulacao_sincronizar_esteira_trg ON public.simulacoes;
DROP TRIGGER IF EXISTS trg_cli_end_esteira ON public.cliente_enderecos;
DROP TRIGGER IF EXISTS trg_crm_seed_pipeline ON public.clientes;