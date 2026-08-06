-- Permite múltiplos tipos de pessoa por usuário (privilégios pela união)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tipos_pessoa text[] NOT NULL DEFAULT '{}';

-- Backfill a partir do tipo único existente
UPDATE public.profiles
SET tipos_pessoa = ARRAY[tipo_pessoa]
WHERE tipo_pessoa IS NOT NULL
  AND (tipos_pessoa IS NULL OR cardinality(tipos_pessoa) = 0);

-- Validação: cada tipo do array deve existir na tabela dinâmica; mantém tipo_pessoa sincronizado ao primeiro
CREATE OR REPLACE FUNCTION public.profiles_validar_tipo_pessoa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  t text;
BEGIN
  -- Se veio apenas tipo_pessoa (único) e o array está vazio, deriva o array
  IF (NEW.tipos_pessoa IS NULL OR cardinality(NEW.tipos_pessoa) = 0)
     AND NEW.tipo_pessoa IS NOT NULL THEN
    NEW.tipos_pessoa := ARRAY[NEW.tipo_pessoa];
  END IF;

  -- Valida cada tipo do array
  IF NEW.tipos_pessoa IS NOT NULL AND cardinality(NEW.tipos_pessoa) > 0 THEN
    FOREACH t IN ARRAY NEW.tipos_pessoa LOOP
      IF NOT EXISTS (SELECT 1 FROM public.tipos_pessoa tp WHERE tp.slug = t) THEN
        RAISE EXCEPTION 'Tipo de pessoa inválido: %', t;
      END IF;
    END LOOP;
    -- Mantém tipo_pessoa (único) sincronizado com o primeiro do array
    NEW.tipo_pessoa := NEW.tipos_pessoa[1];
  ELSIF NEW.tipo_pessoa IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.tipos_pessoa tp WHERE tp.slug = NEW.tipo_pessoa) THEN
      RAISE EXCEPTION 'Tipo de pessoa inválido: %', NEW.tipo_pessoa;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_validar_tipo_pessoa ON public.profiles;
CREATE TRIGGER trg_profiles_validar_tipo_pessoa
BEFORE INSERT OR UPDATE OF tipo_pessoa, tipos_pessoa ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.profiles_validar_tipo_pessoa();

-- Escopo personalizado por tipo de pessoa passa a considerar QUALQUER tipo do array (união = mais poder)
CREATE OR REPLACE FUNCTION public.usuario_escopo_inclui_dono(_user_id uuid, _modulo text, _owner_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT _owner_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.profiles pr
    JOIN public.permissions pm ON pm.nivel_acesso_id = pr.nivel_acesso_id
    JOIN public.permission_escopo_alvos a ON a.permission_id = pm.id
    WHERE pr.id = _user_id
      AND pm.modulo = _modulo
      AND pm.escopo_dados = 'personalizado'
      AND (
        (a.alvo_tipo = 'usuario' AND a.alvo_id = _owner_id)
        OR (a.alvo_tipo = 'papel' AND public.has_role(_owner_id, a.alvo_valor::public.app_role))
        OR (a.alvo_tipo = 'tipo_pessoa' AND EXISTS (
              SELECT 1 FROM public.profiles po
              WHERE po.id = _owner_id
                AND (po.tipo_pessoa = a.alvo_valor OR a.alvo_valor = ANY(po.tipos_pessoa))))
      )
  );
$function$;