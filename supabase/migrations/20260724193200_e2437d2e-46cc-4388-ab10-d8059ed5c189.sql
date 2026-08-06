
-- Remove duplicates keeping the oldest folder per (cliente_id, slug), reassigning any documents to the kept folder.
WITH duplicadas AS (
  SELECT id, cliente_id, slug,
    FIRST_VALUE(id) OVER (PARTITION BY cliente_id, slug ORDER BY created_at ASC, id ASC) AS keep_id
  FROM public.cliente_documento_pastas
  WHERE slug IS NOT NULL
), a_remover AS (
  SELECT id, keep_id FROM duplicadas WHERE id <> keep_id
)
UPDATE public.cliente_documentos d
SET pasta_id = a.keep_id
FROM a_remover a
WHERE d.pasta_id = a.id;

DELETE FROM public.cliente_documento_pastas p
USING (
  SELECT id, cliente_id, slug,
    FIRST_VALUE(id) OVER (PARTITION BY cliente_id, slug ORDER BY created_at ASC, id ASC) AS keep_id
  FROM public.cliente_documento_pastas
  WHERE slug IS NOT NULL
) d
WHERE p.id = d.id AND d.id <> d.keep_id;

-- Unique constraint to prevent future duplicates for system folders (slug NOT NULL).
CREATE UNIQUE INDEX IF NOT EXISTS cliente_documento_pastas_cliente_slug_uidx
  ON public.cliente_documento_pastas (cliente_id, slug)
  WHERE slug IS NOT NULL;
