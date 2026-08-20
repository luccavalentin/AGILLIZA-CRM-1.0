CREATE TABLE public.links_categorias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  icone TEXT NOT NULL DEFAULT 'link',
  cor TEXT NOT NULL DEFAULT 'azul',
  criado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_links_categorias_nome ON public.links_categorias (lower(nome));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.links_categorias TO authenticated;
GRANT ALL ON public.links_categorias TO service_role;

ALTER TABLE public.links_categorias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "links_categorias_select" ON public.links_categorias FOR SELECT TO authenticated USING (true);
CREATE POLICY "links_categorias_insert" ON public.links_categorias FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "links_categorias_update" ON public.links_categorias FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "links_categorias_delete" ON public.links_categorias FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_links_categorias_updated_at
BEFORE UPDATE ON public.links_categorias
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.links_categorias (nome, icone, cor)
SELECT DISTINCT ON (lower(categoria)) categoria,
  CASE WHEN lower(categoria) LIKE '%banco%' THEN 'banco'
       WHEN lower(categoria) LIKE '%cart%' THEN 'cartorio'
       ELSE 'link' END,
  'azul'
FROM public.links_uteis
WHERE categoria IS NOT NULL AND btrim(categoria) <> ''
ORDER BY lower(categoria), categoria;