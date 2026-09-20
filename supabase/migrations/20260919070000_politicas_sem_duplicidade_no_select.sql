-- Uma política de SELECT por tabela nas quatro mais consultadas.
--
-- Cada uma tinha a política de leitura E uma política FOR ALL: como FOR ALL
-- também vale para SELECT, toda consulta avaliava as duas expressões
-- (advisor multiple_permissive_policies, QA 19/09/2026). Em simulacao_bancos
-- e cliente_pipeline as duas eram idênticas — trabalho dobrado puro.
--
-- A política de escrita passa a valer só para INSERT/UPDATE/DELETE, com a
-- mesma expressão de antes. Quem podia ler segue lendo: em simulacao_bancos e
-- cliente_pipeline as expressões eram iguais; em comissoes a de escrita é um
-- subconjunto da de leitura; e em cliente_parceiros a de escrita só somava
-- quem tem 'crm.clientes' update/create sem 'view' — nenhum dos 86 usuários
-- está nessa situação. Conferido linha a linha: 86 usuários × 4 tabelas,
-- mesma contagem e mesma assinatura md5 dos ids visíveis, 0 divergências.

-- simulacao_bancos
drop policy "Gerenciar bancos da simulacao com acesso" on public.simulacao_bancos;
create policy "Incluir bancos da simulacao com acesso" on public.simulacao_bancos
  for insert to public with check (simulacao_id in (select s.id from public.simulacoes s));
create policy "Alterar bancos da simulacao com acesso" on public.simulacao_bancos
  for update to public using (simulacao_id in (select s.id from public.simulacoes s))
  with check (simulacao_id in (select s.id from public.simulacoes s));
create policy "Excluir bancos da simulacao com acesso" on public.simulacao_bancos
  for delete to public using (simulacao_id in (select s.id from public.simulacoes s));

-- cliente_pipeline
drop policy "Pipeline alterar por acesso" on public.cliente_pipeline;
create policy "Pipeline incluir por acesso" on public.cliente_pipeline
  for insert to public with check (cliente_id in (select c.id from public.clientes c));
create policy "Pipeline atualizar por acesso" on public.cliente_pipeline
  for update to public using (cliente_id in (select c.id from public.clientes c))
  with check (cliente_id in (select c.id from public.clientes c));
create policy "Pipeline excluir por acesso" on public.cliente_pipeline
  for delete to public using (cliente_id in (select c.id from public.clientes c));

-- comissoes
drop policy fin_comissoes_mod on public.comissoes;
create policy fin_comissoes_ins on public.comissoes
  for insert to public with check (
    correspondente_id = correspondente_do_usuario((select auth.uid()))
    and usuario_pode_financeiro((select auth.uid())));
create policy fin_comissoes_upd on public.comissoes
  for update to public using (
    correspondente_id = correspondente_do_usuario((select auth.uid()))
    and usuario_pode_financeiro((select auth.uid())))
  with check (
    correspondente_id = correspondente_do_usuario((select auth.uid()))
    and usuario_pode_financeiro((select auth.uid())));
create policy fin_comissoes_del on public.comissoes
  for delete to public using (
    correspondente_id = correspondente_do_usuario((select auth.uid()))
    and usuario_pode_financeiro((select auth.uid())));

-- cliente_parceiros
drop policy "cliente_parceiros write" on public.cliente_parceiros;
create policy "cliente_parceiros insert" on public.cliente_parceiros
  for insert to public with check (
    correspondente_id = correspondente_do_usuario((select auth.uid()))
    and (usuario_pode_admin((select auth.uid()))
         or usuario_tem_permissao((select auth.uid()), 'crm.clientes', 'update')
         or usuario_tem_permissao((select auth.uid()), 'crm.clientes', 'create')
         or usuario_tem_acesso_cliente((select auth.uid()), cliente_id)));
create policy "cliente_parceiros update" on public.cliente_parceiros
  for update to public using (
    correspondente_id = correspondente_do_usuario((select auth.uid()))
    and (usuario_pode_admin((select auth.uid()))
         or usuario_tem_permissao((select auth.uid()), 'crm.clientes', 'update')
         or usuario_tem_permissao((select auth.uid()), 'crm.clientes', 'create')
         or usuario_tem_acesso_cliente((select auth.uid()), cliente_id)))
  with check (
    correspondente_id = correspondente_do_usuario((select auth.uid()))
    and (usuario_pode_admin((select auth.uid()))
         or usuario_tem_permissao((select auth.uid()), 'crm.clientes', 'update')
         or usuario_tem_permissao((select auth.uid()), 'crm.clientes', 'create')
         or usuario_tem_acesso_cliente((select auth.uid()), cliente_id)));
create policy "cliente_parceiros delete" on public.cliente_parceiros
  for delete to public using (
    correspondente_id = correspondente_do_usuario((select auth.uid()))
    and (usuario_pode_admin((select auth.uid()))
         or usuario_tem_permissao((select auth.uid()), 'crm.clientes', 'update')
         or usuario_tem_permissao((select auth.uid()), 'crm.clientes', 'create')
         or usuario_tem_acesso_cliente((select auth.uid()), cliente_id)));
