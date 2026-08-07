ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;