-- Tabelas filhas pequenas de clientes/propostas: mesma regra, sem checagem por
-- linha (mesmo padrão de 20260918230000).
--
-- `usuario_tem_acesso_cliente(uid, cliente_id)` = o cliente aparece para o
-- usuário na política de leitura de `clientes`; idem para propostas (ambas
-- conferidas para os 86 usuários em 18/09/2026). ALTER POLICY mantém nome,
-- comando e papéis; as demais condições (correspondente no insert/update)
-- ficam iguais. Comandos gerados a partir de pg_policies.
-- Conferido depois: cada usuário vê/altera as mesmas linhas pela função antiga.
-- Autorizado pelo Lucca em 18/09/2026.

alter policy "Pastas por acesso ao cliente" on public.cliente_documento_pastas using ((cliente_id IN (SELECT c.id FROM public.clientes c))) with check ((cliente_id IN (SELECT c.id FROM public.clientes c)));
alter policy "Documentos por acesso" on public.cliente_documentos using ((cliente_id IN (SELECT c.id FROM public.clientes c))) with check ((cliente_id IN (SELECT c.id FROM public.clientes c)));
alter policy "Enderecos por acesso" on public.cliente_enderecos using ((cliente_id IN (SELECT c.id FROM public.clientes c))) with check ((cliente_id IN (SELECT c.id FROM public.clientes c)));
alter policy "Imoveis por acesso" on public.cliente_imoveis using ((cliente_id IN (SELECT c.id FROM public.clientes c))) with check ((cliente_id IN (SELECT c.id FROM public.clientes c)));
alter policy "Interacoes por acesso" on public.cliente_interacoes using ((cliente_id IN (SELECT c.id FROM public.clientes c))) with check ((cliente_id IN (SELECT c.id FROM public.clientes c)));
alter policy "Portal acessos por acesso" on public.cliente_portal_acessos using ((cliente_id IN (SELECT c.id FROM public.clientes c))) with check ((cliente_id IN (SELECT c.id FROM public.clientes c)));
alter policy "Vendedores por acesso ao cliente" on public.cliente_vendedores using ((cliente_id IN (SELECT c.id FROM public.clientes c))) with check ((cliente_id IN (SELECT c.id FROM public.clientes c)));
alter policy chat_cli_etiq_del on public.crm_chat_cliente_etiquetas using ((cliente_id IN (SELECT c.id FROM public.clientes c)));
alter policy chat_cli_etiq_ins on public.crm_chat_cliente_etiquetas with check (((correspondente_id = correspondente_do_usuario(( SELECT auth.uid() AS uid))) AND (cliente_id IN (SELECT c.id FROM public.clientes c))));
alter policy chat_cli_etiq_select on public.crm_chat_cliente_etiquetas using ((cliente_id IN (SELECT c.id FROM public.clientes c)));
alter policy chat_meta_ins on public.crm_chat_meta with check (((correspondente_id = correspondente_do_usuario(( SELECT auth.uid() AS uid))) AND (cliente_id IN (SELECT c.id FROM public.clientes c))));
alter policy chat_meta_select on public.crm_chat_meta using ((cliente_id IN (SELECT c.id FROM public.clientes c)));
alter policy chat_meta_upd on public.crm_chat_meta using ((cliente_id IN (SELECT c.id FROM public.clientes c))) with check ((correspondente_id = correspondente_do_usuario(( SELECT auth.uid() AS uid))));
alter policy proposta_documentos_all on public.proposta_documentos using ((proposta_id IN (SELECT p.id FROM public.propostas p))) with check ((proposta_id IN (SELECT p.id FROM public.propostas p)));
alter policy "Documentos HomeFin por acesso à proposta" on public.proposta_documentos_homefin using ((proposta_id IN (SELECT p.id FROM public.propostas p))) with check ((proposta_id IN (SELECT p.id FROM public.propostas p)));
alter policy proposta_envolvidos_all on public.proposta_envolvidos using ((proposta_id IN (SELECT p.id FROM public.propostas p))) with check ((proposta_id IN (SELECT p.id FROM public.propostas p)));
alter policy proposta_pdfs_all on public.proposta_pdfs using ((proposta_id IN (SELECT p.id FROM public.propostas p))) with check ((proposta_id IN (SELECT p.id FROM public.propostas p)));
