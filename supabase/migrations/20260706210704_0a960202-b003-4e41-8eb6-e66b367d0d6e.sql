CREATE TABLE public.configuracoes_modulos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  correspondente_id uuid NOT NULL,
  modulo text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (correspondente_id, modulo)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracoes_modulos TO authenticated;
GRANT ALL ON public.configuracoes_modulos TO service_role;

ALTER TABLE public.configuracoes_modulos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config modulos leitura ecossistema"
ON public.configuracoes_modulos
FOR SELECT
USING (correspondente_id = correspondente_do_usuario(auth.uid()));

CREATE POLICY "config modulos gestao admin"
ON public.configuracoes_modulos
FOR ALL
USING (correspondente_id = correspondente_do_usuario(auth.uid()) AND usuario_pode_admin(auth.uid()))
WITH CHECK (correspondente_id = correspondente_do_usuario(auth.uid()) AND usuario_pode_admin(auth.uid()));

CREATE TRIGGER update_configuracoes_modulos_updated_at
BEFORE UPDATE ON public.configuracoes_modulos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();