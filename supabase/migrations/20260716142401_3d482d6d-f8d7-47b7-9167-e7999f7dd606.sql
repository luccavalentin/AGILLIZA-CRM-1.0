
-- =========================================================
-- Chats diretos entre usuários internos
-- =========================================================

CREATE TABLE public.dm_conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id UUID NOT NULL,
  criador_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ultima_mensagem_em TIMESTAMPTZ,
  ultima_mensagem_preview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.dm_participantes (
  conversa_id UUID NOT NULL REFERENCES public.dm_conversas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ultima_leitura_em TIMESTAMPTZ,
  entrou_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversa_id, user_id)
);

CREATE TABLE public.dm_mensagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID NOT NULL REFERENCES public.dm_conversas(id) ON DELETE CASCADE,
  autor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  correspondente_id UUID NOT NULL,
  texto TEXT,
  anexo_url TEXT,
  anexo_nome TEXT,
  anexo_mime TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dm_conv_corr ON public.dm_conversas(correspondente_id, ultima_mensagem_em DESC);
CREATE INDEX idx_dm_msg_conv ON public.dm_mensagens(conversa_id, created_at DESC);
CREATE INDEX idx_dm_part_user ON public.dm_participantes(user_id);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dm_conversas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dm_participantes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dm_mensagens TO authenticated;
GRANT ALL ON public.dm_conversas TO service_role;
GRANT ALL ON public.dm_participantes TO service_role;
GRANT ALL ON public.dm_mensagens TO service_role;

-- RLS
ALTER TABLE public.dm_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_participantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_mensagens ENABLE ROW LEVEL SECURITY;

-- Helper: usuário é participante da conversa?
CREATE OR REPLACE FUNCTION public.dm_e_participante(_conv uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.dm_participantes WHERE conversa_id = _conv AND user_id = _user);
$$;

-- Policies dm_conversas
CREATE POLICY "dm_conv_select" ON public.dm_conversas FOR SELECT TO authenticated
  USING (public.dm_e_participante(id, auth.uid()));
CREATE POLICY "dm_conv_insert" ON public.dm_conversas FOR INSERT TO authenticated
  WITH CHECK (criador_id = auth.uid() AND correspondente_id = public.correspondente_do_usuario(auth.uid()));
CREATE POLICY "dm_conv_update" ON public.dm_conversas FOR UPDATE TO authenticated
  USING (public.dm_e_participante(id, auth.uid()));

-- Policies dm_participantes
CREATE POLICY "dm_part_select" ON public.dm_participantes FOR SELECT TO authenticated
  USING (public.dm_e_participante(conversa_id, auth.uid()));
CREATE POLICY "dm_part_insert" ON public.dm_participantes FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.dm_conversas c WHERE c.id = conversa_id AND c.criador_id = auth.uid())
    OR user_id = auth.uid()
  );
CREATE POLICY "dm_part_update_self" ON public.dm_participantes FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Policies dm_mensagens
CREATE POLICY "dm_msg_select" ON public.dm_mensagens FOR SELECT TO authenticated
  USING (public.dm_e_participante(conversa_id, auth.uid()));
CREATE POLICY "dm_msg_insert" ON public.dm_mensagens FOR INSERT TO authenticated
  WITH CHECK (autor_id = auth.uid() AND public.dm_e_participante(conversa_id, auth.uid()));

-- Get-or-create 1:1
CREATE OR REPLACE FUNCTION public.dm_get_or_create_1on1(_other uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_corr uuid;
  v_conv uuid;
BEGIN
  IF v_me IS NULL OR _other IS NULL OR v_me = _other THEN
    RAISE EXCEPTION 'DM inválida';
  END IF;
  v_corr := public.correspondente_do_usuario(v_me);
  IF v_corr IS NULL OR v_corr <> public.correspondente_do_usuario(_other) THEN
    RAISE EXCEPTION 'Usuários de correspondentes diferentes';
  END IF;

  SELECT c.id INTO v_conv
  FROM public.dm_conversas c
  WHERE c.correspondente_id = v_corr
    AND EXISTS (SELECT 1 FROM public.dm_participantes p1 WHERE p1.conversa_id = c.id AND p1.user_id = v_me)
    AND EXISTS (SELECT 1 FROM public.dm_participantes p2 WHERE p2.conversa_id = c.id AND p2.user_id = _other)
    AND (SELECT count(*) FROM public.dm_participantes p WHERE p.conversa_id = c.id) = 2
  LIMIT 1;

  IF v_conv IS NOT NULL THEN
    RETURN v_conv;
  END IF;

  INSERT INTO public.dm_conversas (correspondente_id, criador_id)
  VALUES (v_corr, v_me) RETURNING id INTO v_conv;

  INSERT INTO public.dm_participantes (conversa_id, user_id) VALUES (v_conv, v_me);
  INSERT INTO public.dm_participantes (conversa_id, user_id) VALUES (v_conv, _other);

  RETURN v_conv;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dm_get_or_create_1on1(uuid) TO authenticated;

-- Trigger: atualiza preview + notifica outros participantes
CREATE OR REPLACE FUNCTION public.dm_after_insert_mensagem()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_nome text;
BEGIN
  UPDATE public.dm_conversas
    SET ultima_mensagem_em = NEW.created_at,
        ultima_mensagem_preview = LEFT(COALESCE(NEW.texto, NEW.anexo_nome, 'Anexo'), 140),
        updated_at = now()
    WHERE id = NEW.conversa_id;

  SELECT nome INTO v_nome FROM public.profiles WHERE id = NEW.autor_id;

  FOR r IN
    SELECT user_id FROM public.dm_participantes
     WHERE conversa_id = NEW.conversa_id AND user_id <> NEW.autor_id
  LOOP
    PERFORM public.emitir_notificacao(
      r.user_id, NEW.correspondente_id, 'chat.dm',
      'Nova mensagem de ' || COALESCE(v_nome, 'colega'),
      LEFT(COALESCE(NEW.texto, NEW.anexo_nome, 'Anexo'), 200),
      '/operacional/chats?dm=' || NEW.conversa_id::text
    );
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_dm_after_insert_mensagem
AFTER INSERT ON public.dm_mensagens
FOR EACH ROW EXECUTE FUNCTION public.dm_after_insert_mensagem();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_mensagens;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_conversas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_participantes;
