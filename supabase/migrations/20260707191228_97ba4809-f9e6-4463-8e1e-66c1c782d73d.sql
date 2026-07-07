-- Remove a restrição fixa de tipo_pessoa (agora os tipos são dinâmicos via tabela tipos_pessoa)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_tipo_pessoa_valores;

-- Valida tipo_pessoa contra a tabela dinâmica tipos_pessoa via trigger
CREATE OR REPLACE FUNCTION public.profiles_validar_tipo_pessoa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.tipo_pessoa IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tipos_pessoa tp WHERE tp.slug = NEW.tipo_pessoa) THEN
    RAISE EXCEPTION 'Tipo de pessoa inválido: %', NEW.tipo_pessoa;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_validar_tipo_pessoa ON public.profiles;
CREATE TRIGGER trg_profiles_validar_tipo_pessoa
BEFORE INSERT OR UPDATE OF tipo_pessoa ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_validar_tipo_pessoa();