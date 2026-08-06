-- Tabela de ajustes avulsos da folha (proventos/descontos manuais por competência)
CREATE TABLE public.rh_folha_ajustes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  correspondente_id UUID NOT NULL,
  funcionario_id UUID NOT NULL REFERENCES public.rh_funcionarios(id) ON DELETE CASCADE,
  mes SMALLINT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano SMALLINT NOT NULL CHECK (ano BETWEEN 2020 AND 2100),
  tipo TEXT NOT NULL CHECK (tipo IN ('provento','desconto')),
  descricao TEXT NOT NULL,
  valor NUMERIC(14,2) NOT NULL CHECK (valor >= 0),
  criado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rh_folha_ajustes_comp
  ON public.rh_folha_ajustes (correspondente_id, ano, mes);
CREATE INDEX idx_rh_folha_ajustes_func
  ON public.rh_folha_ajustes (funcionario_id, ano, mes);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rh_folha_ajustes TO authenticated;
GRANT ALL ON public.rh_folha_ajustes TO service_role;

ALTER TABLE public.rh_folha_ajustes ENABLE ROW LEVEL SECURITY;

-- Escopo: mesmo correspondente do usuário
CREATE POLICY "rh_folha_ajustes_select_corresp"
  ON public.rh_folha_ajustes FOR SELECT
  TO authenticated
  USING (
    correspondente_id = (
      SELECT correspondente_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "rh_folha_ajustes_insert_corresp"
  ON public.rh_folha_ajustes FOR INSERT
  TO authenticated
  WITH CHECK (
    correspondente_id = (
      SELECT correspondente_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "rh_folha_ajustes_update_corresp"
  ON public.rh_folha_ajustes FOR UPDATE
  TO authenticated
  USING (
    correspondente_id = (
      SELECT correspondente_id FROM public.profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    correspondente_id = (
      SELECT correspondente_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "rh_folha_ajustes_delete_corresp"
  ON public.rh_folha_ajustes FOR DELETE
  TO authenticated
  USING (
    correspondente_id = (
      SELECT correspondente_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Trigger updated_at (reusa função pública se já existir)
CREATE OR REPLACE FUNCTION public.rh_folha_ajustes_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rh_folha_ajustes_touch
BEFORE UPDATE ON public.rh_folha_ajustes
FOR EACH ROW EXECUTE FUNCTION public.rh_folha_ajustes_touch();