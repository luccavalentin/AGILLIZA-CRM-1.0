DROP POLICY IF EXISTS chat_reacoes_select ON public.chat_reacoes;
DROP POLICY IF EXISTS chat_reacoes_insert_own ON public.chat_reacoes;

CREATE POLICY chat_reacoes_select ON public.chat_reacoes
FOR SELECT TO authenticated
USING (
  (origem = 'cliente' AND EXISTS (
    SELECT 1 FROM public.cliente_app_mensagens m
    WHERE m.id = chat_reacoes.mensagem_id
      AND m.correspondente_id = public.correspondente_do_usuario((SELECT auth.uid()))
  ))
  OR (origem = 'demanda' AND EXISTS (
    SELECT 1 FROM public.demanda_mensagens m
    WHERE m.id = chat_reacoes.mensagem_id
      AND public.usuario_tem_acesso_demanda((SELECT auth.uid()), m.demanda_id)
  ))
  OR (origem = 'dm' AND EXISTS (
    SELECT 1 FROM public.dm_mensagens m
    JOIN public.dm_participantes p ON p.conversa_id = m.conversa_id AND p.user_id = (SELECT auth.uid())
    WHERE m.id = chat_reacoes.mensagem_id
  ))
);

CREATE POLICY chat_reacoes_insert_own ON public.chat_reacoes
FOR INSERT TO authenticated
WITH CHECK (
  usuario_id = (SELECT auth.uid())
  AND (
    (origem = 'cliente' AND EXISTS (
      SELECT 1 FROM public.cliente_app_mensagens m
      WHERE m.id = chat_reacoes.mensagem_id
        AND m.correspondente_id = public.correspondente_do_usuario((SELECT auth.uid()))
    ))
    OR (origem = 'demanda' AND EXISTS (
      SELECT 1 FROM public.demanda_mensagens m
      WHERE m.id = chat_reacoes.mensagem_id
        AND public.usuario_tem_acesso_demanda((SELECT auth.uid()), m.demanda_id)
    ))
    OR (origem = 'dm' AND EXISTS (
      SELECT 1 FROM public.dm_mensagens m
      JOIN public.dm_participantes p ON p.conversa_id = m.conversa_id AND p.user_id = (SELECT auth.uid())
      WHERE m.id = chat_reacoes.mensagem_id
    ))
  )
);

-- Remove a versão antiga (5 argumentos) para evitar chamadas sem suporte a resposta.
DROP FUNCTION IF EXISTS public.portal_enviar_mensagem(uuid, uuid, uuid, text, text);