ALTER TABLE public.access_levels
  ADD COLUMN IF NOT EXISTS papel public.app_role NOT NULL DEFAULT 'comercial',
  ADD COLUMN IF NOT EXISTS acesso_tipo public.acesso_tipo NOT NULL DEFAULT 'sistema';

UPDATE public.access_levels SET papel = 'gestor', acesso_tipo = 'sistema' WHERE id = '00000000-0000-0000-0000-000000000001';
UPDATE public.access_levels SET papel = 'comercial', acesso_tipo = 'sistema' WHERE id = '00000000-0000-0000-0000-000000000002';
UPDATE public.access_levels SET papel = 'analista', acesso_tipo = 'sistema' WHERE id = '00000000-0000-0000-0000-000000000003';