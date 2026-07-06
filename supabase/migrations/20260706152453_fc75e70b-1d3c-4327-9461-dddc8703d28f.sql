ALTER TABLE public.proposta_envolvidos
  ADD COLUMN IF NOT EXISTS conjuge_de uuid REFERENCES public.proposta_envolvidos(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_proposta_envolvidos_conjuge_de
  ON public.proposta_envolvidos(conjuge_de);