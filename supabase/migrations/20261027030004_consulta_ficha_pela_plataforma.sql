-- Consulta Ficha do correspondente pelo mesmo caminho do Agilliza Tech (pedido de 26/10/2026, C16).
--
-- A consulta sai pela APIFull, na fila do worker do Agilliza Tech (migração 0319 de lá), e o
-- histórico do Agilliza (`bureau_consultas`) guarda o pedido da plataforma para acompanhar o
-- resultado. Sem política nova: a linha continua nascendo em nome de quem consulta (RLS existente)
-- e o resultado é anotado pelo servidor.
alter table public.bureau_consultas add column if not exists pedido_plataforma_id uuid;
comment on column public.bureau_consultas.pedido_plataforma_id is
  'Pedido da consulta na plataforma (crm.pedidos_consulta do Agilliza Tech, pago pelo contrato do correspondente).';
create unique index if not exists bureau_consultas_pedido_plataforma
  on public.bureau_consultas (pedido_plataforma_id) where pedido_plataforma_id is not null;
