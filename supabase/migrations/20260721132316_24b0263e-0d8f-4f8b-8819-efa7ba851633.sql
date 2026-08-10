
-- Fase 5: colunas aditivas para editar / excluir suave / responder
ALTER TABLE public.demanda_mensagens
  ADD COLUMN IF NOT EXISTS editada_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS excluida_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS responde_a uuid NULL REFERENCES public.demanda_mensagens(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_demanda_mensagens_responde_a ON public.demanda_mensagens(responde_a);

ALTER TABLE public.dm_mensagens
  ADD COLUMN IF NOT EXISTS editada_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS excluida_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS responde_a uuid NULL REFERENCES public.dm_mensagens(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_dm_mensagens_responde_a ON public.dm_mensagens(responde_a);

-- Reações unificadas (uma tabela para os três motores)
CREATE TABLE IF NOT EXISTS public.chat_reacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origem text NOT NULL CHECK (origem IN ('cliente','demanda','dm')),
  mensagem_id uuid NOT NULL,
  usuario_id uuid NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (origem, mensagem_id, usuario_id, emoji)
);

CREATE INDEX IF NOT EXISTS idx_chat_reacoes_msg ON public.chat_reacoes(origem, mensagem_id);
CREATE INDEX IF NOT EXISTS idx_chat_reacoes_usuario ON public.chat_reacoes(usuario_id);

GRANT SELECT, INSERT, DELETE ON public.chat_reacoes TO authenticated;
GRANT ALL ON public.chat_reacoes TO service_role;

ALTER TABLE public.chat_reacoes ENABLE ROW LEVEL SECURITY;

-- Leitura: mensagem-fonte tem que ser acessível ao usuário
CREATE POLICY "chat_reacoes_select"
ON public.chat_reacoes
FOR SELECT
TO authenticated
USING (
  (origem = 'cliente' AND EXISTS (
     SELECT 1 FROM public.cliente_app_mensagens m
     WHERE m.id = chat_reacoes.mensagem_id
       AND public.usuario_tem_acesso_cliente((select auth.uid()), m.cliente_id)
  ))
  OR (origem = 'demanda' AND EXISTS (
     SELECT 1 FROM public.demanda_mensagens m
     WHERE m.id = chat_reacoes.mensagem_id
       AND public.usuario_tem_acesso_demanda((select auth.uid()), m.demanda_id)
  ))
  OR (origem = 'dm' AND EXISTS (
     SELECT 1 FROM public.dm_mensagens m
     JOIN public.dm_participantes p
       ON p.conversa_id = m.conversa_id AND p.user_id = (select auth.uid())
     WHERE m.id = chat_reacoes.mensagem_id
  ))
);

-- Inserção: só a própria reação, e a mensagem-fonte tem que ser acessível
CREATE POLICY "chat_reacoes_insert_own"
ON public.chat_reacoes
FOR INSERT
TO authenticated
WITH CHECK (
  usuario_id = (select auth.uid())
  AND (
    (origem = 'cliente' AND EXISTS (
       SELECT 1 FROM public.cliente_app_mensagens m
       WHERE m.id = chat_reacoes.mensagem_id
         AND public.usuario_tem_acesso_cliente((select auth.uid()), m.cliente_id)
    ))
    OR (origem = 'demanda' AND EXISTS (
       SELECT 1 FROM public.demanda_mensagens m
       WHERE m.id = chat_reacoes.mensagem_id
         AND public.usuario_tem_acesso_demanda((select auth.uid()), m.demanda_id)
    ))
    OR (origem = 'dm' AND EXISTS (
       SELECT 1 FROM public.dm_mensagens m
       JOIN public.dm_participantes p
         ON p.conversa_id = m.conversa_id AND p.user_id = (select auth.uid())
       WHERE m.id = chat_reacoes.mensagem_id
    ))
  )
);

-- Remoção: só a própria reação
CREATE POLICY "chat_reacoes_delete_own"
ON public.chat_reacoes
FOR DELETE
TO authenticated
USING (usuario_id = (select auth.uid()));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_reacoes;
