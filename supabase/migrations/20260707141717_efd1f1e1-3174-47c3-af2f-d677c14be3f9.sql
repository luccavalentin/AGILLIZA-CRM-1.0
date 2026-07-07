CREATE TABLE public.links_uteis (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo text NOT NULL,
  url text NOT NULL,
  descricao text,
  categoria text,
  criado_por uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.links_uteis TO authenticated;
GRANT ALL ON public.links_uteis TO service_role;

ALTER TABLE public.links_uteis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe interna visualiza links"
ON public.links_uteis FOR SELECT TO authenticated
USING (public.is_equipe_interna(auth.uid()));

CREATE POLICY "Equipe interna cria links"
ON public.links_uteis FOR INSERT TO authenticated
WITH CHECK (public.is_equipe_interna(auth.uid()));

CREATE POLICY "Equipe interna edita links"
ON public.links_uteis FOR UPDATE TO authenticated
USING (public.is_equipe_interna(auth.uid()))
WITH CHECK (public.is_equipe_interna(auth.uid()));

CREATE POLICY "Equipe interna exclui links"
ON public.links_uteis FOR DELETE TO authenticated
USING (public.is_equipe_interna(auth.uid()));

CREATE TRIGGER update_links_uteis_updated_at
BEFORE UPDATE ON public.links_uteis
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_links_uteis_categoria ON public.links_uteis (categoria);