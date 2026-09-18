-- Estado do polling de propostas (servidor).
--
-- A sincronização gravava `propostas.ultima_sincronizacao_em` a CADA consulta,
-- mesmo sem mudança. `propostas` está na publicação do realtime: cada gravação
-- fazia toda tela inscrita recarregar a lista, que disparava mais consultas
-- (~21 mil gravações/dia em propostas com 6 usuários, 18/09/2026).
--
-- O controle de "quando consultei esta proposta pela última vez" vive aqui:
-- fora do realtime e sem acesso pelo cliente (RLS ligado, sem políticas — só o
-- service role do servidor lê e grava). `ultimo_resumo` guarda o resumo da
-- última resposta, para o log registrar só consultas com resposta diferente.
create table if not exists public.proposta_sync_estado (
  proposta_id uuid primary key references public.propostas(id) on delete cascade,
  ultima_consulta_em timestamptz not null default now(),
  ultimo_resumo text
);

alter table public.proposta_sync_estado enable row level security;

comment on table public.proposta_sync_estado is
  'Polling de propostas: última consulta ao provedor e resumo da última resposta. Só o servidor (service role) acessa.';
