-- Edição de simulações e tabelas filhas: mesma regra, sem checagem por linha.
--
-- `usuario_tem_acesso_simulacao(uid, simulacao_id)` responde "o usuário
-- enxerga esta simulação?", que é exatamente a política de leitura de
-- `simulacoes` (20260918203000). Conferido para os 86 usuários antes desta
-- troca (18/09/2026): 53.656 simulações visíveis pela função e pela política,
-- 0 divergências (função avaliada por combinação empresa/responsável/criador/
-- cliente, as únicas colunas de que a regra depende).
--
-- - UPDATE de simulacoes: mesma condição da leitura, calculada uma vez.
-- - Filhas (bancos, histórico, participantes, PDFs): valem quando a simulação
--   pai é visível. Mesmo padrão das filhas de clientes/propostas.
-- Autorizado pelo Lucca em 18/09/2026.

drop policy if exists "Atualizar simulacoes com acesso" on public.simulacoes;
create policy "Atualizar simulacoes com acesso" on public.simulacoes
  for update to authenticated
  using (
    correspondente_id = (select public.correspondente_do_usuario((select auth.uid())))
    and (
      (select public.usuario_escopo_dados((select auth.uid()), 'operacional.simulacoes')) in ('todos', 'equipe')
      or usuario_responsavel_id = (select auth.uid())
      or usuario_criador_id = (select auth.uid())
      or public.cliente_vinculado_ao_parceiro((select auth.uid()), cliente_id)
      or (
        (select public.usuario_escopo_dados((select auth.uid()), 'operacional.simulacoes')) = 'personalizado'
        and (
          public.usuario_escopo_inclui_dono((select auth.uid()), 'operacional.simulacoes', usuario_responsavel_id)
          or public.usuario_escopo_inclui_dono((select auth.uid()), 'operacional.simulacoes', usuario_criador_id)
        )
      )
    )
  );

drop policy if exists "Ver bancos da simulacao com acesso" on public.simulacao_bancos;
create policy "Ver bancos da simulacao com acesso" on public.simulacao_bancos
  for select to authenticated
  using (simulacao_id in (select s.id from public.simulacoes s));
drop policy if exists "Gerenciar bancos da simulacao com acesso" on public.simulacao_bancos;
create policy "Gerenciar bancos da simulacao com acesso" on public.simulacao_bancos
  for all to authenticated
  using (simulacao_id in (select s.id from public.simulacoes s))
  with check (simulacao_id in (select s.id from public.simulacoes s));

drop policy if exists "Ver historico com acesso" on public.simulacao_historico;
create policy "Ver historico com acesso" on public.simulacao_historico
  for select to authenticated
  using (simulacao_id in (select s.id from public.simulacoes s));
drop policy if exists "Inserir historico com acesso" on public.simulacao_historico;
create policy "Inserir historico com acesso" on public.simulacao_historico
  for insert to authenticated
  with check (simulacao_id in (select s.id from public.simulacoes s));

drop policy if exists "Gerenciar participantes com acesso" on public.simulacao_participantes;
create policy "Gerenciar participantes com acesso" on public.simulacao_participantes
  for all to authenticated
  using (simulacao_id in (select s.id from public.simulacoes s))
  with check (simulacao_id in (select s.id from public.simulacoes s));

drop policy if exists "Ver pdfs com acesso" on public.simulacao_pdfs;
create policy "Ver pdfs com acesso" on public.simulacao_pdfs
  for select to authenticated
  using (simulacao_id in (select s.id from public.simulacoes s));
drop policy if exists "Inserir pdfs com acesso" on public.simulacao_pdfs;
create policy "Inserir pdfs com acesso" on public.simulacao_pdfs
  for insert to authenticated
  with check (simulacao_id in (select s.id from public.simulacoes s));
