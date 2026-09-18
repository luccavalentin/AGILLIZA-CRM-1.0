-- Remove os índices de trigramas criados em 20260918234500.
--
-- Conferido depois de criar: o banco só usa esses índices em consultas sem
-- RLS. Com RLS ativa (todas as buscas das telas usam o client do usuário), o
-- Postgres não aplica `ilike` antes da política (o operador não é "leakproof"),
-- então lê a tabela do mesmo jeito. Sem ganho, só custo de escrita e espaço.
-- Hoje as buscas levam 6–30 ms. Quando as tabelas crescerem, o caminho é uma
-- função de busca no banco que use o índice para achar os candidatos e aplique
-- a mesma regra de acesso por cima. A extensão pg_trgm fica instalada.

drop index if exists public.idx_clientes_nome_trgm;
drop index if exists public.idx_clientes_documento_trgm;
drop index if exists public.idx_clientes_email_trgm;
drop index if exists public.idx_simulacoes_nome_cliente_trgm;
drop index if exists public.idx_simulacoes_cpf_cnpj_trgm;
drop index if exists public.idx_simulacoes_numero_trgm;
drop index if exists public.idx_propostas_nome_cliente_trgm;
drop index if exists public.idx_propostas_cpf_cnpj_trgm;
drop index if exists public.idx_propostas_numero_trgm;
drop index if exists public.idx_propostas_numero_banco_trgm;
