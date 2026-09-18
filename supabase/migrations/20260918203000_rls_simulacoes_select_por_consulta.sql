-- Leitura de simulações: mesma regra, avaliada uma vez por consulta.
--
-- A política chamava `usuario_tem_acesso_simulacao(uid, id)` para CADA linha;
-- a função refaz `select ... from simulacoes where id = <a linha>` e chama
-- correspondente_do_usuario / usuario_escopo_dados (que chama has_any_role)
-- de novo por linha. Com 6.537 simulações: 1,3–3,7 s por consulta (18/09/2026).
--
-- A condição abaixo é a MESMA do corpo da função, copiada literalmente, só que
-- sobre a própria linha (id é a chave, então `exists(... where id = linha and
-- COND)` = COND) e com o usuário, o correspondente e o escopo calculados uma
-- vez por consulta (`(select ...)`). Conferido antes da troca: mesmas contagens
-- por usuário nas duas regras (escopo "todos" 6.537 = 6.537; parceiros por
-- vínculo 322 = 322 e 136 = 136; 10 usuários de "próprios" sem divergência).
--
-- Só a leitura muda. Inserir/alterar/excluir seguem com as políticas atuais, e
-- a função continua existindo (outras políticas a usam). Autorizado pelo Lucca
-- em 18/09/2026.
drop policy if exists "Ver simulacoes por escopo" on public.simulacoes;
create policy "Ver simulacoes por escopo" on public.simulacoes
  for select to authenticated
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
