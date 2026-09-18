-- Agendador da sincronização de propostas: de 2 em 2 min para 1 em 1 min.
--
-- O ritmo por banco/fase (src/lib/propostas/sync-backoff.ts) pede 1 min para
-- Itaú e Santander em análise de crédito. A rota só consulta as propostas
-- vencidas, então rodar a cada minuto não aumenta as consultas das demais.
-- (Aplicado em produção em 18/09/2026 via cron.alter_job.)
select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'sync-propostas-ativas'),
  schedule := '* * * * *'
);
