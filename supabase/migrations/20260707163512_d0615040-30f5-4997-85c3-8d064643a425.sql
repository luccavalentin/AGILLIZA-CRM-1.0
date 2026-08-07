-- Catálogos editáveis de SLA (tipo de demanda, prioridade, canal de escalonamento)
CREATE TABLE IF NOT EXISTS public.sla_catalogo_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid NOT NULL,
  categoria text NOT NULL CHECK (categoria IN ('tipo_demanda', 'prioridade', 'canal')),
  valor text NOT NULL,
  label text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (correspondente_id, categoria, valor)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sla_catalogo_itens TO authenticated;
GRANT ALL ON public.sla_catalogo_itens TO service_role;

ALTER TABLE public.sla_catalogo_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sla_catalogo leitura"
  ON public.sla_catalogo_itens
  FOR SELECT
  TO authenticated
  USING (correspondente_id = correspondente_do_usuario((SELECT auth.uid())));

CREATE POLICY "sla_catalogo gestao"
  ON public.sla_catalogo_itens
  FOR ALL
  TO authenticated
  USING (
    correspondente_id = correspondente_do_usuario((SELECT auth.uid()))
    AND has_any_role((SELECT auth.uid()), ARRAY['admin'::app_role, 'correspondente'::app_role, 'gestor'::app_role])
  )
  WITH CHECK (
    correspondente_id = correspondente_do_usuario((SELECT auth.uid()))
    AND has_any_role((SELECT auth.uid()), ARRAY['admin'::app_role, 'correspondente'::app_role, 'gestor'::app_role])
  );

CREATE TRIGGER trg_sla_catalogo_updated
  BEFORE UPDATE ON public.sla_catalogo_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_sla_catalogo_corr_cat
  ON public.sla_catalogo_itens (correspondente_id, categoria, ordem);

-- Permitir prioridades customizadas nas regras de SLA (mantém p1/p2/p3 como padrão)
ALTER TABLE public.sla_configuracoes
  ALTER COLUMN prioridade TYPE text USING prioridade::text;