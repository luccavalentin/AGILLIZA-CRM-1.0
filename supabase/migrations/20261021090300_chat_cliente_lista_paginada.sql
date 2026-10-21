-- Chat do cliente (CRM): lista de conversas paginada no banco.
--
-- A tela montava a lista lendo as últimas 1.000 mensagens do correspondente e agrupando
-- no servidor da aplicação: conversa mais antiga que isso sumia, e cada abertura trazia
-- 1.000 linhas. Esta função devolve uma linha por conversa (cliente + atendente), da mais
-- recente para a mais antiga, com a última mensagem e as não lidas, em páginas
-- (_limite + _antes = data da última conversa da página anterior).
-- SECURITY INVOKER: a RLS de cliente_app_mensagens continua valendo.

CREATE INDEX IF NOT EXISTS idx_cliente_app_mensagens_corr_criada
  ON public.cliente_app_mensagens (correspondente_id, criada_em DESC);

CREATE OR REPLACE FUNCTION public.crm_chat_listar_threads(
  _limite integer DEFAULT 300,
  _antes timestamptz DEFAULT NULL
)
RETURNS TABLE (
  cliente_id uuid,
  atendente_id uuid,
  ultima_mensagem text,
  ultima_em timestamptz,
  ultimo_remetente text,
  ultimo_remetente_id uuid,
  ultima_excluida boolean,
  nao_lidas integer
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_corr uuid := public.correspondente_do_usuario(auth.uid());
  v_limite integer := LEAST(GREATEST(COALESCE(_limite, 300), 1), 2000);
  v_vistas jsonb := '{}'::jsonb;
  v_chave text;
  v_qtd integer := 0;
  r RECORD;
BEGIN
  IF v_corr IS NULL THEN
    RETURN;
  END IF;

  -- Percorre as mensagens pela ordem do índice (mais nova primeiro) e para assim que
  -- juntar _limite conversas distintas.
  FOR r IN
    SELECT m.cliente_id, m.atendente_id, m.mensagem, m.criada_em, m.remetente_tipo,
           m.remetente_id, m.excluida_em
      FROM public.cliente_app_mensagens m
     WHERE m.correspondente_id = v_corr
       AND (_antes IS NULL OR m.criada_em < _antes)
     ORDER BY m.criada_em DESC
  LOOP
    v_chave := r.cliente_id::text || ':' || COALESCE(r.atendente_id::text, '');
    CONTINUE WHEN v_vistas ? v_chave;
    v_vistas := v_vistas || jsonb_build_object(v_chave, true);

    -- Na página seguinte, conversa que já saiu numa página anterior não se repete.
    CONTINUE WHEN _antes IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.cliente_app_mensagens x
       WHERE x.cliente_id = r.cliente_id
         AND x.atendente_id IS NOT DISTINCT FROM r.atendente_id
         AND x.criada_em >= _antes
    );

    cliente_id := r.cliente_id;
    atendente_id := r.atendente_id;
    ultima_mensagem := r.mensagem;
    ultima_em := r.criada_em;
    ultimo_remetente := r.remetente_tipo;
    ultimo_remetente_id := r.remetente_id;
    ultima_excluida := r.excluida_em IS NOT NULL;
    SELECT count(*)::integer INTO nao_lidas
      FROM public.cliente_app_mensagens n
     WHERE n.cliente_id = r.cliente_id
       AND n.atendente_id IS NOT DISTINCT FROM r.atendente_id
       AND n.remetente_tipo = 'cliente'
       AND n.lida_em IS NULL;
    RETURN NEXT;

    v_qtd := v_qtd + 1;
    EXIT WHEN v_qtd >= v_limite;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.crm_chat_listar_threads(integer, timestamptz) TO authenticated;
