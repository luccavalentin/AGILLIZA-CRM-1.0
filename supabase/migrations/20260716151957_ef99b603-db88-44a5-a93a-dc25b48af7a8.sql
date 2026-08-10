
-- =========================================================
-- Estado de conversa por usuário (arquivar/ocultar/renomear/fixar)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.chat_estado_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_tipo text NOT NULL CHECK (chat_tipo IN ('dm','cliente','demanda','portal_cliente')),
  chat_id uuid NOT NULL,
  arquivado_em timestamptz,
  oculto_em timestamptz,           -- "excluir só para mim"
  pinado_em timestamptz,
  apelido text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, chat_tipo, chat_id)
);
CREATE INDEX IF NOT EXISTS chat_estado_usuario_idx
  ON public.chat_estado_usuario (user_id, chat_tipo, arquivado_em, oculto_em);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_estado_usuario TO authenticated;
GRANT ALL ON public.chat_estado_usuario TO service_role;

ALTER TABLE public.chat_estado_usuario ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estado próprio ver" ON public.chat_estado_usuario
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "estado próprio inserir" ON public.chat_estado_usuario
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "estado próprio atualizar" ON public.chat_estado_usuario
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "estado próprio remover" ON public.chat_estado_usuario
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER trg_chat_estado_usuario_upd
  BEFORE UPDATE ON public.chat_estado_usuario
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- Vínculo genérico de etiquetas (dm/cliente/demanda)
-- Continua usando o catálogo público.crm_chat_etiquetas.
-- =========================================================
CREATE TABLE IF NOT EXISTS public.chat_etiqueta_vinculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  etiqueta_id uuid NOT NULL REFERENCES public.crm_chat_etiquetas(id) ON DELETE CASCADE,
  chat_tipo text NOT NULL CHECK (chat_tipo IN ('dm','cliente','demanda')),
  chat_id uuid NOT NULL,
  correspondente_id uuid NOT NULL,
  aplicado_por uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (etiqueta_id, chat_tipo, chat_id)
);
CREATE INDEX IF NOT EXISTS chat_etiqueta_vinculos_lookup
  ON public.chat_etiqueta_vinculos (chat_tipo, chat_id);
CREATE INDEX IF NOT EXISTS chat_etiqueta_vinculos_corr
  ON public.chat_etiqueta_vinculos (correspondente_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_etiqueta_vinculos TO authenticated;
GRANT ALL ON public.chat_etiqueta_vinculos TO service_role;

ALTER TABLE public.chat_etiqueta_vinculos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vinculos ver" ON public.chat_etiqueta_vinculos
  FOR SELECT TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()));
CREATE POLICY "vinculos gerir" ON public.chat_etiqueta_vinculos
  FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()));

-- Backfill: replica os vínculos cliente<->etiqueta atuais no modelo unificado.
INSERT INTO public.chat_etiqueta_vinculos (etiqueta_id, chat_tipo, chat_id, correspondente_id)
SELECT cce.etiqueta_id, 'cliente', cce.cliente_id, cce.correspondente_id
FROM public.crm_chat_cliente_etiquetas cce
ON CONFLICT (etiqueta_id, chat_tipo, chat_id) DO NOTHING;

-- =========================================================
-- Pesquisa por palavra-chave (tsvector + GIN)
-- =========================================================
ALTER TABLE public.dm_mensagens
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('portuguese', COALESCE(texto,''))) STORED;
CREATE INDEX IF NOT EXISTS dm_mensagens_search_tsv ON public.dm_mensagens USING GIN (search_tsv);

ALTER TABLE public.cliente_app_mensagens
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('portuguese', COALESCE(mensagem,''))) STORED;
CREATE INDEX IF NOT EXISTS cliente_app_mensagens_search_tsv ON public.cliente_app_mensagens USING GIN (search_tsv);

ALTER TABLE public.demanda_mensagens
  ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('portuguese', COALESCE(corpo,''))) STORED;
CREATE INDEX IF NOT EXISTS demanda_mensagens_search_tsv ON public.demanda_mensagens USING GIN (search_tsv);
