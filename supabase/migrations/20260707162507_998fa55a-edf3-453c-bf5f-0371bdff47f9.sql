-- Tipo de pessoa e controle de login em profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tipo_pessoa text NOT NULL DEFAULT 'usuario',
  ADD COLUMN IF NOT EXISTS login_habilitado boolean NOT NULL DEFAULT true;

-- Restringe valores válidos via trigger de validação (evita CHECK imutável desnecessário; simples enum textual)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_tipo_pessoa_valores'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_tipo_pessoa_valores
      CHECK (tipo_pessoa IN ('usuario','imobiliaria','corretor'));
  END IF;
END $$;

-- Atualiza a trigger para gravar tipo_pessoa e login_habilitado a partir do metadata
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  meta JSONB := NEW.raw_user_meta_data;
  v_correspondente_id UUID;
  v_papel public.app_role;
  v_acesso public.acesso_tipo := 'sistema';
  v_nivel UUID;
  v_tipo_pessoa text := 'usuario';
  v_login_habilitado boolean := true;
BEGIN
  IF (meta->>'papel_inicial') = 'correspondente' THEN
    v_correspondente_id := NEW.id;
    v_papel := 'correspondente';
    v_acesso := 'sistema';
  ELSIF (meta->>'correspondente_id') IS NOT NULL THEN
    v_correspondente_id := (meta->>'correspondente_id')::UUID;
    v_papel := COALESCE((meta->>'papel')::public.app_role, 'comercial');
    IF (meta->>'acesso_tipo') IS NOT NULL THEN
      v_acesso := (meta->>'acesso_tipo')::public.acesso_tipo;
    END IF;
    IF (meta->>'nivel_acesso_id') IS NOT NULL THEN
      v_nivel := (meta->>'nivel_acesso_id')::UUID;
    END IF;
  ELSE
    v_correspondente_id := NULL;
    v_papel := NULL;
  END IF;

  IF (meta->>'tipo_pessoa') IS NOT NULL THEN
    v_tipo_pessoa := meta->>'tipo_pessoa';
  END IF;
  IF (meta->>'login_habilitado') IS NOT NULL THEN
    v_login_habilitado := (meta->>'login_habilitado')::boolean;
  END IF;

  INSERT INTO public.profiles (id, correspondente_id, email, nome, telefone, acesso_tipo, nivel_acesso_id, tipo_pessoa, login_habilitado)
  VALUES (
    NEW.id,
    v_correspondente_id,
    CASE WHEN v_login_habilitado THEN NEW.email ELSE NULL END,
    COALESCE(meta->>'full_name', meta->>'nome'),
    meta->>'telefone',
    v_acesso,
    v_nivel,
    v_tipo_pessoa,
    v_login_habilitado
  );

  IF v_papel IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_papel)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;