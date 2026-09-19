-- Reconciliação de simulações pelo agendador a cada 1 min (era 2).
-- Com a trava global (rotina_reservar, 20 s), os disparos dos navegadores não
-- multiplicam mais as rodadas; o agendador passa a ser a garantia principal,
-- inclusive com ninguém logado.
select cron.alter_job(
  job_id := (select jobid from cron.job where jobname = 'reconciliar-simulacoes'),
  schedule := '* * * * *'
);
