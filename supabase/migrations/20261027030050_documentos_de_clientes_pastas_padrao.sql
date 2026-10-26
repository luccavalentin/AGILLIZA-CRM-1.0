-- =============================================================================
-- Documentos de clientes (pedido do dono de 26/10/2026, itens C21/C22).
--
-- A tela "Documentos de clientes" organiza os arquivos de cada cliente em sete pastas
-- padrão: Comprador, Cônjuge/Participantes, Vendedor, Imóvel, Renda, Banco e proposta e
-- Contratos. A pasta sai da categoria e do tipo do documento; quando alguém MOVE o
-- arquivo para outra pasta na tela, a escolha fica em `pasta_padrao` e vale por cima da
-- regra. Só organização: categoria, tipo, pasta do cliente (pasta_id), checklist e envio
-- ao banco continuam como estão.
--
-- Também fecha um furo antigo: `pasta_id` aceitava a pasta de OUTRO cliente (o servidor
-- não conferia). Agora o banco recusa, em qualquer tela.
-- =============================================================================

alter table public.cliente_documentos
  add column if not exists pasta_padrao text;

do $$ begin
  alter table public.cliente_documentos
    add constraint cliente_documentos_pasta_padrao_chk
    check (pasta_padrao is null or pasta_padrao in
      ('comprador','participantes','vendedor','imovel','renda','banco_proposta','contratos'));
exception when duplicate_object then null; end $$;

comment on column public.cliente_documentos.pasta_padrao is
  'Pasta padrão escolhida na tela Documentos de clientes (mover). Nula = a pasta sai da categoria e do tipo do documento.';

create index if not exists cliente_documentos_cliente_pasta_padrao_idx
  on public.cliente_documentos (cliente_id, pasta_padrao);

-- A pasta do cliente (pasta_id) precisa ser do MESMO cliente do documento.
create or replace function public.cliente_documento_pasta_do_mesmo_cliente()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  if new.pasta_id is not null and not exists (
    select 1 from public.cliente_documento_pastas p
     where p.id = new.pasta_id and p.cliente_id = new.cliente_id
  ) then
    raise exception 'A pasta escolhida não é deste cliente.' using errcode = '23514';
  end if;
  return new;
end $$;

revoke all on function public.cliente_documento_pasta_do_mesmo_cliente() from public;
revoke all on function public.cliente_documento_pasta_do_mesmo_cliente() from anon, authenticated;

drop trigger if exists trg_cli_doc_pasta_mesmo_cliente on public.cliente_documentos;
create trigger trg_cli_doc_pasta_mesmo_cliente
  before insert or update of pasta_id, cliente_id on public.cliente_documentos
  for each row execute function public.cliente_documento_pasta_do_mesmo_cliente();

-- A tabela já tem RLS ligada com a política "Documentos por acesso" (cliente visível ao
-- usuário); a coluna nova herda a mesma regra. Nada para anon.
alter table public.cliente_documentos enable row level security;
revoke all on public.cliente_documentos from anon;
