-- Busca "esta proposta já foi enviada ao banco?" no log da HomeFin.
--
-- `sincronizarPropostaImpl` filtra `proposta_logs_homefin` por proposta e por
-- `endpoint like '%/incluir-proposta-integracao'`. Só havia índice por
-- proposta: numa proposta com milhares de linhas de consulta, o banco lia todas
-- para achar os poucos envios — 1 a 1,8 s em média, até 8 s (timeout), nas
-- duas consultas mais caras do sistema (18/09/2026). Índice parcial só com as
-- linhas de envio: pequeno e exato para essa busca.
create index if not exists idx_proposta_logs_envio_por_proposta
  on public.proposta_logs_homefin (proposta_id, created_at desc)
  where endpoint like '%/incluir-proposta-integracao';
