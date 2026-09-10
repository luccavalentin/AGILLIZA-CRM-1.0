-- CAUSA RAIZ das simulações presas em "Em análise" (Santander).
--
-- O cron `reconciliar-simulacoes` roda a cada 2 minutos e "sucede" 720 vezes
-- por dia — mas o que ele agenda é uma chamada `pg_net`, e o `pg_net` desiste
-- em 5.000 ms por padrão. Medido em 12 horas: 202 das 360 chamadas morreram em
-- "Timeout of 5000 ms reached" (net._http_response). Quando o pg_net desiste, a
-- conexão cai; no Cloudflare a queda do cliente ABORTA o handler no meio da
-- varredura. A rodada nunca terminava — e sempre morria no mesmo ponto.
--
-- Consequência visível: fora do horário comercial, sem ninguém com o navegador
-- aberto empurrando a reconciliação pela tela, nada era reconciliado. Nos logs
-- da integração há ZERO consultas entre 02h e 10h UTC. A simulação ficava "Em
-- análise" a noite inteira até a faxina de 24h transformá-la em erro.
--
-- A rota passou a caber num orçamento de 20 s por rodada (o que não couber fica
-- para a rodada seguinte, dois minutos depois). Aqui damos a ela a janela de
-- 25 s para terminar e responder.
--
-- O comando é reescrito a partir do que já está agendado, em vez de recriado:
-- assim a URL e a chave de autorização continuam sendo as mesmas que já estão
-- em produção, e nenhum segredo precisa ser repetido neste arquivo.

do $$
declare
  j record;
  novo_comando text;
begin
  for j in
    select jobid, jobname, command
    from cron.job
    where jobname in ('reconciliar-simulacoes', 'sync-propostas-ativas')
  loop
    -- Idempotente: se o job já tem janela própria, não mexe.
    if position('timeout_milliseconds' in j.command) > 0 then
      raise notice 'job % já possui timeout_milliseconds; mantido', j.jobname;
      continue;
    end if;

    novo_comando := replace(
      j.command,
      'body := ''{}''::jsonb',
      'body := ''{}''::jsonb,' || chr(10) || '    timeout_milliseconds := 25000'
    );

    if novo_comando = j.command then
      raise warning 'job %: não foi possível localizar o parâmetro body; revise manualmente', j.jobname;
      continue;
    end if;

    perform cron.alter_job(j.jobid, command => novo_comando);
    raise notice 'job % agora espera 25 s pela resposta', j.jobname;
  end loop;
end $$;
