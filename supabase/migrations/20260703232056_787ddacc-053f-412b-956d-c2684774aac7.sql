
-- Tentativas de acesso do portal do cliente (rate-limit / bloqueio)
CREATE TABLE public.cliente_app_acessos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  documento_hash text NOT NULL,
  tipo_acesso text NOT NULL DEFAULT 'login',
  sucesso boolean NOT NULL DEFAULT false,
  motivo_bloqueio text,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cliente_app_acessos_doc ON public.cliente_app_acessos(documento_hash, created_at DESC);

GRANT ALL ON public.cliente_app_acessos TO service_role;
ALTER TABLE public.cliente_app_acessos ENABLE ROW LEVEL SECURITY;

-- Chat cliente <-> time
CREATE TABLE public.cliente_app_mensagens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  correspondente_id uuid,
  proposta_id uuid REFERENCES public.propostas(id) ON DELETE SET NULL,
  remetente_tipo text NOT NULL CHECK (remetente_tipo IN ('cliente','time')),
  remetente_id uuid,
  mensagem text NOT NULL,
  anexo_url text,
  lida_em timestamptz,
  criada_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cliente_app_mensagens_cliente ON public.cliente_app_mensagens(cliente_id, criada_em);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_app_mensagens TO authenticated;
GRANT ALL ON public.cliente_app_mensagens TO service_role;
ALTER TABLE public.cliente_app_mensagens ENABLE ROW LEVEL SECURITY;

-- Time interno pode ver/responder as mensagens dos clientes do seu correspondente
CREATE POLICY "Time ve mensagens do correspondente"
ON public.cliente_app_mensagens FOR SELECT TO authenticated
USING (correspondente_id = public.correspondente_do_usuario(auth.uid()));

CREATE POLICY "Time responde mensagens do correspondente"
ON public.cliente_app_mensagens FOR INSERT TO authenticated
WITH CHECK (
  correspondente_id = public.correspondente_do_usuario(auth.uid())
  AND remetente_tipo = 'time'
);

CREATE POLICY "Time atualiza mensagens do correspondente"
ON public.cliente_app_mensagens FOR UPDATE TO authenticated
USING (correspondente_id = public.correspondente_do_usuario(auth.uid()));

-- Notificacoes in-app do cliente
CREATE TABLE public.cliente_app_notificacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  correspondente_id uuid,
  tipo text NOT NULL DEFAULT 'geral',
  titulo text NOT NULL,
  corpo text,
  link text,
  lida boolean NOT NULL DEFAULT false,
  criada_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cliente_app_notif_cliente ON public.cliente_app_notificacoes(cliente_id, criada_em DESC);

GRANT ALL ON public.cliente_app_notificacoes TO service_role;
ALTER TABLE public.cliente_app_notificacoes ENABLE ROW LEVEL SECURITY;
