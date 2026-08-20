ALTER TABLE public.simulacao_participantes ADD COLUMN compoe_renda boolean NOT NULL DEFAULT false;
ALTER TABLE public.simulacao_participantes ADD COLUMN vinculo text;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulacao_participantes TO authenticated;
GRANT ALL ON public.simulacao_participantes TO service_role;