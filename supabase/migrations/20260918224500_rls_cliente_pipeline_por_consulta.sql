-- Funil de clientes: mesma regra, sem recalcular o acesso por linha.
--
-- As duas políticas chamavam `usuario_tem_acesso_cliente(uid, cliente_id)` para
-- CADA linha (1,9 s por consulta em 18/09/2026). Essa função responde "o
-- usuário enxerga este cliente?", que é exatamente a política de leitura de
-- `clientes` (reescrita em 20260918223000 com o mesmo corpo da função). Então a
-- linha do funil é visível/alterável quando o cliente dela aparece para o
-- usuário em `clientes`, e o banco resolve isso uma vez por consulta.
--
-- Conferido antes da troca, para os 86 usuários, entrando como cada um: mesmas
-- linhas do funil nas duas regras (89 / 2.201 / 2.209 / 4.379 por lote, mesma
-- assinatura md5 por usuário).
--
-- Atenção: se a política de leitura de `clientes` mudar, o funil acompanha
-- (é o comportamento esperado: funil só de clientes visíveis).
-- Autorizado pelo Lucca em 18/09/2026.

drop policy if exists "Pipeline ver por acesso" on public.cliente_pipeline;
create policy "Pipeline ver por acesso" on public.cliente_pipeline
  for select to authenticated
  using (cliente_id in (select c.id from public.clientes c));

drop policy if exists "Pipeline alterar por acesso" on public.cliente_pipeline;
create policy "Pipeline alterar por acesso" on public.cliente_pipeline
  for all to authenticated
  using (cliente_id in (select c.id from public.clientes c))
  with check (cliente_id in (select c.id from public.clientes c));
