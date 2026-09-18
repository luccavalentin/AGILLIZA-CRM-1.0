-- Tabelas filhas de clientes e propostas: mesma regra, sem checagem por linha.
--
-- Estas políticas chamavam `usuario_tem_acesso_cliente(uid, cliente_id)` ou
-- `usuario_tem_acesso_proposta(uid, proposta_id)` para CADA linha (logs da
-- HomeFin: 126 mil linhas). A função responde "o usuário enxerga este
-- cliente/proposta?", que é exatamente a política de leitura de `clientes` /
-- `propostas` (reescritas em 20260918223000, conferidas para os 86 usuários).
-- Então a linha filha vale quando o pai aparece para o usuário, e o banco
-- resolve isso uma vez por consulta. Mesmo padrão de cliente_pipeline
-- (20260918224500).
--
-- Conferido antes da troca, para os 86 usuários: visíveis por tabela e
-- assinatura md5 por usuário (pai#quantidade) iguais antes/depois.
-- Autorizado pelo Lucca em 18/09/2026.

-- cliente_historico
drop policy if exists "Historico ver por acesso" on public.cliente_historico;
create policy "Historico ver por acesso" on public.cliente_historico
  for select to authenticated
  using (cliente_id in (select c.id from public.clientes c));
drop policy if exists "Historico inserir por acesso" on public.cliente_historico;
create policy "Historico inserir por acesso" on public.cliente_historico
  for insert to authenticated
  with check (cliente_id in (select c.id from public.clientes c));

-- cliente_pipeline_historico
drop policy if exists "Pipeline hist ver por acesso" on public.cliente_pipeline_historico;
create policy "Pipeline hist ver por acesso" on public.cliente_pipeline_historico
  for select to authenticated
  using (cliente_id in (select c.id from public.clientes c));
drop policy if exists "Pipeline hist inserir por acesso" on public.cliente_pipeline_historico;
create policy "Pipeline hist inserir por acesso" on public.cliente_pipeline_historico
  for insert to authenticated
  with check (cliente_id in (select c.id from public.clientes c));

-- proposta_logs_homefin
drop policy if exists "proposta_logs_select" on public.proposta_logs_homefin;
create policy "proposta_logs_select" on public.proposta_logs_homefin
  for select to authenticated
  using (proposta_id is not null and proposta_id in (select p.id from public.propostas p));

-- proposta_followups
drop policy if exists "proposta_followups_all" on public.proposta_followups;
create policy "proposta_followups_all" on public.proposta_followups
  for all to authenticated
  using (proposta_id in (select p.id from public.propostas p))
  with check (proposta_id in (select p.id from public.propostas p));

-- proposta_historico
drop policy if exists "proposta_historico_select" on public.proposta_historico;
create policy "proposta_historico_select" on public.proposta_historico
  for select to authenticated
  using (proposta_id in (select p.id from public.propostas p));
drop policy if exists "proposta_historico_insert" on public.proposta_historico;
create policy "proposta_historico_insert" on public.proposta_historico
  for insert to authenticated
  with check (proposta_id in (select p.id from public.propostas p));

-- proposta_bancos
drop policy if exists "proposta_bancos_all" on public.proposta_bancos;
create policy "proposta_bancos_all" on public.proposta_bancos
  for all to authenticated
  using (proposta_id in (select p.id from public.propostas p))
  with check (proposta_id in (select p.id from public.propostas p));
