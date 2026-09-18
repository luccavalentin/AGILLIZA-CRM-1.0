-- Índices de busca por trecho de texto (ilike '%termo%').
--
-- As telas de clientes, simulações, propostas e a busca geral filtram com
-- `ilike '%termo%'` em nome, CPF/CNPJ, e-mail e números. Sem índice, cada busca
-- lê a tabela inteira; hoje isso custa 6–30 ms (após a RLS por consulta), mas
-- cresce junto com as tabelas. Índices GIN de trigramas deixam o banco achar
-- as linhas direto, sem mudar nenhum resultado.
-- Autorizado pelo Lucca em 18/09/2026.

create extension if not exists pg_trgm with schema extensions;

create index if not exists idx_clientes_nome_trgm on public.clientes using gin (nome extensions.gin_trgm_ops);
create index if not exists idx_clientes_documento_trgm on public.clientes using gin (documento extensions.gin_trgm_ops);
create index if not exists idx_clientes_email_trgm on public.clientes using gin (email extensions.gin_trgm_ops);

create index if not exists idx_simulacoes_nome_cliente_trgm on public.simulacoes using gin (nome_cliente extensions.gin_trgm_ops);
create index if not exists idx_simulacoes_cpf_cnpj_trgm on public.simulacoes using gin (cpf_cnpj extensions.gin_trgm_ops);
create index if not exists idx_simulacoes_numero_trgm on public.simulacoes using gin (numero_simulacao extensions.gin_trgm_ops);

create index if not exists idx_propostas_nome_cliente_trgm on public.propostas using gin (nome_cliente extensions.gin_trgm_ops);
create index if not exists idx_propostas_cpf_cnpj_trgm on public.propostas using gin (cpf_cnpj extensions.gin_trgm_ops);
create index if not exists idx_propostas_numero_trgm on public.propostas using gin (numero_proposta extensions.gin_trgm_ops);
create index if not exists idx_propostas_numero_banco_trgm on public.propostas using gin (numero_proposta_banco extensions.gin_trgm_ops);
