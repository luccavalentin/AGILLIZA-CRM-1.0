-- Busca de clientes sem depender de acento: "joao" acha "João".
--
-- `clientes.nome_busca` guarda o nome em minúsculas e sem acento, calculado pelo
-- próprio banco (coluna gerada). As telas buscam nela com o termo também sem
-- acento (listarClientes e buscarClientesCRM).
--
-- No banco único da homologação a extensão unaccent já existe, criada pelo
-- Corretor no esquema `extensoes`; no Supabase padrão ela fica em `extensions`.
-- A função procura nos dois (search_path) e é security definer: os papéis do
-- Agilliza não têm USAGE em `extensoes`, e todo INSERT em clientes passa por ela.

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create or replace function public.sem_acento(texto text)
returns text
language sql
immutable
strict
parallel safe
security definer
set search_path = pg_catalog, extensions, extensoes
as $$ select unaccent('unaccent'::regdictionary, texto) $$;

comment on function public.sem_acento(text) is
  'Texto sem acento (unaccent), imutável para uso em coluna gerada e índice.';

alter table public.clientes
  add column if not exists nome_busca text
  generated always as (lower(public.sem_acento(nome))) stored;

-- Índice de trigramas para ilike '%termo%'. Com RLS o planejador ainda pode
-- ler a tabela inteira (ver 20260918235000); fica pronto para uma busca no
-- banco que aplique a regra de acesso por cima. O operador vem do esquema onde
-- o pg_trgm estiver (`extensions` ou, no banco único, `extensoes`).
do $$
declare
  esquema text;
begin
  select n.nspname into esquema
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'pg_trgm';
  execute format(
    'create index if not exists idx_clientes_nome_busca_trgm on public.clientes using gin (nome_busca %I.gin_trgm_ops)',
    esquema
  );
end $$;
