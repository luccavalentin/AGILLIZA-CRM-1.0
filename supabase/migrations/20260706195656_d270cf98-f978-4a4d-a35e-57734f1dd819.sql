
-- Catálogo de etiquetas de chat por correspondente
CREATE TABLE public.crm_chat_etiquetas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid NOT NULL,
  nome text NOT NULL,
  cor text NOT NULL DEFAULT 'blue',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_chat_etiquetas TO authenticated;
GRANT ALL ON public.crm_chat_etiquetas TO service_role;
ALTER TABLE public.crm_chat_etiquetas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_etiq_select" ON public.crm_chat_etiquetas FOR SELECT TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()));
CREATE POLICY "chat_etiq_all" ON public.crm_chat_etiquetas FOR ALL TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()));

-- Vínculo cliente <-> etiqueta
CREATE TABLE public.crm_chat_cliente_etiquetas (
  cliente_id uuid NOT NULL,
  etiqueta_id uuid NOT NULL REFERENCES public.crm_chat_etiquetas(id) ON DELETE CASCADE,
  correspondente_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cliente_id, etiqueta_id)
);
GRANT SELECT, INSERT, DELETE ON public.crm_chat_cliente_etiquetas TO authenticated;
GRANT ALL ON public.crm_chat_cliente_etiquetas TO service_role;
ALTER TABLE public.crm_chat_cliente_etiquetas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_cli_etiq_select" ON public.crm_chat_cliente_etiquetas FOR SELECT TO authenticated
  USING (public.usuario_tem_acesso_cliente(auth.uid(), cliente_id));
CREATE POLICY "chat_cli_etiq_ins" ON public.crm_chat_cliente_etiquetas FOR INSERT TO authenticated
  WITH CHECK (
    correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND public.usuario_tem_acesso_cliente(auth.uid(), cliente_id)
  );
CREATE POLICY "chat_cli_etiq_del" ON public.crm_chat_cliente_etiquetas FOR DELETE TO authenticated
  USING (public.usuario_tem_acesso_cliente(auth.uid(), cliente_id));

-- Configuração do chat por cliente (SLA + lembrete)
CREATE TABLE public.crm_chat_meta (
  cliente_id uuid PRIMARY KEY,
  correspondente_id uuid NOT NULL,
  sla_atualizacao_horas integer NOT NULL DEFAULT 24,
  lembrete_em timestamptz,
  lembrete_nota text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_chat_meta TO authenticated;
GRANT ALL ON public.crm_chat_meta TO service_role;
ALTER TABLE public.crm_chat_meta ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_meta_select" ON public.crm_chat_meta FOR SELECT TO authenticated
  USING (public.usuario_tem_acesso_cliente(auth.uid(), cliente_id));
CREATE POLICY "chat_meta_ins" ON public.crm_chat_meta FOR INSERT TO authenticated
  WITH CHECK (
    correspondente_id = public.correspondente_do_usuario(auth.uid())
    AND public.usuario_tem_acesso_cliente(auth.uid(), cliente_id)
  );
CREATE POLICY "chat_meta_upd" ON public.crm_chat_meta FOR UPDATE TO authenticated
  USING (public.usuario_tem_acesso_cliente(auth.uid(), cliente_id))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()));

CREATE TRIGGER crm_chat_meta_updated_at
  BEFORE UPDATE ON public.crm_chat_meta
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
