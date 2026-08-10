
-- 1) Índices em tabelas filhas muito consultadas por FK
CREATE INDEX IF NOT EXISTS proposta_documentos_proposta_idx
  ON public.proposta_documentos (proposta_id);

CREATE INDEX IF NOT EXISTS proposta_envolvidos_proposta_idx
  ON public.proposta_envolvidos (proposta_id);

-- 2) Pipeline do cliente é agrupado por estágio (kanban) — sem índice hoje
CREATE INDEX IF NOT EXISTS cliente_pipeline_stage_idx
  ON public.cliente_pipeline (stage_id);

-- 3) Consulta quente da matriz de permissões filtra por (nivel_acesso_id, permitido=true).
--    Índice parcial cobrindo os campos usados reduz o custo da leitura para
--    "index only scan" em vez de acessar a tabela.
CREATE INDEX IF NOT EXISTS permissions_nivel_ativos_idx
  ON public.permissions (nivel_acesso_id, modulo, acao)
  WHERE permitido = true;

-- 4) Função unificada para o sino de notificações: uma única chamada
--    devolve os últimos 10 itens + total de não lidas (evita 2 queries
--    a cada invalidate da realtime).
CREATE OR REPLACE FUNCTION public.listar_minhas_notificacoes()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'itens', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', n.id, 'tipo', n.tipo, 'titulo', n.titulo, 'corpo', n.corpo,
        'link', n.link, 'lida', n.lida, 'created_at', n.created_at
      ) ORDER BY n.created_at DESC)
      FROM (
        SELECT id, tipo, titulo, corpo, link, lida, created_at
        FROM public.notificacoes
        WHERE user_id = auth.uid()
        ORDER BY created_at DESC
        LIMIT 10
      ) n
    ), '[]'::jsonb),
    'naoLidas', (
      SELECT count(*) FROM public.notificacoes
      WHERE user_id = auth.uid() AND lida = false
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.listar_minhas_notificacoes() TO authenticated;
