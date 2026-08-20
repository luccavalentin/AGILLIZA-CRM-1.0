ALTER TABLE public.rh_funcionarios
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS rh_funcionarios_user_id_uniq
  ON public.rh_funcionarios(user_id)
  WHERE user_id IS NOT NULL AND deletado_em IS NULL;