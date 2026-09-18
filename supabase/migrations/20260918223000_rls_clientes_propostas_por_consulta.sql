-- Leitura/edição de clientes e propostas: mesma regra, avaliada uma vez por consulta.
--
-- As políticas chamavam `usuario_tem_acesso_cliente(uid, id)` e
-- `usuario_tem_acesso_proposta(uid, id)` para CADA linha; cada chamada refaz a
-- busca da própria linha e recalcula correspondente/escopo do usuário.
-- Mesmo padrão já trocado em simulações (20260918203000).
--
-- As condições abaixo são o corpo das funções, copiado literalmente, sobre a
-- própria linha. Conferido antes da troca para TODOS os 86 usuários contra
-- todas as linhas (18/09/2026): propostas 35.690 pares, 3.560 visíveis nas duas
-- regras, 0 divergências; clientes 93.568 pares, 8.878 visíveis nas duas, 0
-- divergências.
--
-- Muda só o USING de SELECT e UPDATE (que usavam a função). WITH CHECK, INSERT
-- e DELETE ficam como estão; as funções continuam existindo (cliente_pipeline e
-- outras usam). Autorizado pelo Lucca em 18/09/2026.

drop policy if exists "Ver clientes conforme escopo" on public.clientes;
create policy "Ver clientes conforme escopo" on public.clientes
  for select to authenticated
  using (
    correspondente_id = (select public.correspondente_do_usuario((select auth.uid())))
    and (
      (select public.usuario_escopo_dados((select auth.uid()), 'crm.clientes')) in ('todos', 'equipe')
      or responsavel_id = (select auth.uid())
      or criador_id = (select auth.uid())
      or public.cliente_vinculado_ao_parceiro((select auth.uid()), id)
      or (
        (select public.usuario_escopo_dados((select auth.uid()), 'crm.clientes')) = 'personalizado'
        and (
          public.usuario_escopo_inclui_dono((select auth.uid()), 'crm.clientes', responsavel_id)
          or public.usuario_escopo_inclui_dono((select auth.uid()), 'crm.clientes', criador_id)
        )
      )
    )
  );

drop policy if exists "Editar cliente com acesso" on public.clientes;
create policy "Editar cliente com acesso" on public.clientes
  for update to authenticated
  using (
    correspondente_id = (select public.correspondente_do_usuario((select auth.uid())))
    and (
      (select public.usuario_escopo_dados((select auth.uid()), 'crm.clientes')) in ('todos', 'equipe')
      or responsavel_id = (select auth.uid())
      or criador_id = (select auth.uid())
      or public.cliente_vinculado_ao_parceiro((select auth.uid()), id)
      or (
        (select public.usuario_escopo_dados((select auth.uid()), 'crm.clientes')) = 'personalizado'
        and (
          public.usuario_escopo_inclui_dono((select auth.uid()), 'crm.clientes', responsavel_id)
          or public.usuario_escopo_inclui_dono((select auth.uid()), 'crm.clientes', criador_id)
        )
      )
    )
  )
  with check (correspondente_id = public.correspondente_do_usuario((select auth.uid())));

drop policy if exists "propostas_select" on public.propostas;
create policy "propostas_select" on public.propostas
  for select to authenticated
  using (
    correspondente_id = (select public.correspondente_do_usuario((select auth.uid())))
    and (
      (select public.usuario_escopo_dados((select auth.uid()), 'operacional.propostas')) in ('todos', 'equipe')
      or usuario_responsavel_id = (select auth.uid())
      or usuario_criador_id = (select auth.uid())
      or public.cliente_vinculado_ao_parceiro((select auth.uid()), cliente_id)
      or (
        (select public.usuario_escopo_dados((select auth.uid()), 'operacional.propostas')) = 'personalizado'
        and (
          public.usuario_escopo_inclui_dono((select auth.uid()), 'operacional.propostas', usuario_responsavel_id)
          or public.usuario_escopo_inclui_dono((select auth.uid()), 'operacional.propostas', usuario_criador_id)
        )
      )
    )
  );

drop policy if exists "propostas_update" on public.propostas;
create policy "propostas_update" on public.propostas
  for update to authenticated
  using (
    correspondente_id = (select public.correspondente_do_usuario((select auth.uid())))
    and (
      (select public.usuario_escopo_dados((select auth.uid()), 'operacional.propostas')) in ('todos', 'equipe')
      or usuario_responsavel_id = (select auth.uid())
      or usuario_criador_id = (select auth.uid())
      or public.cliente_vinculado_ao_parceiro((select auth.uid()), cliente_id)
      or (
        (select public.usuario_escopo_dados((select auth.uid()), 'operacional.propostas')) = 'personalizado'
        and (
          public.usuario_escopo_inclui_dono((select auth.uid()), 'operacional.propostas', usuario_responsavel_id)
          or public.usuario_escopo_inclui_dono((select auth.uid()), 'operacional.propostas', usuario_criador_id)
        )
      )
    )
  )
  with check (correspondente_id = public.correspondente_do_usuario((select auth.uid())));
