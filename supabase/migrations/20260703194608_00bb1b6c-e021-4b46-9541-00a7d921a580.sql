-- =========================================================
-- ENUM app_role
-- =========================================================
CREATE TYPE public.app_role AS ENUM (
  'admin', 'correspondente', 'gestor', 'comercial',
  'analista', 'imobiliaria', 'corretor', 'cliente'
);

CREATE TYPE public.acesso_tipo AS ENUM ('sistema', 'portal_parceiro');
CREATE TYPE public.escopo_dados AS ENUM ('todos', 'equipe', 'proprios');

-- =========================================================
-- shared updated_at trigger fn
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- =========================================================
-- access_levels
-- =========================================================
CREATE TABLE public.access_levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  correspondente_id UUID,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  is_padrao BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_levels TO authenticated;
GRANT ALL ON public.access_levels TO service_role;

-- =========================================================
-- profiles
-- =========================================================
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  correspondente_id UUID,
  email TEXT,
  nome TEXT,
  telefone TEXT,
  foto_url TEXT,
  nivel_acesso_id UUID REFERENCES public.access_levels(id) ON DELETE SET NULL,
  acesso_tipo public.acesso_tipo NOT NULL DEFAULT 'sistema',
  ativo BOOLEAN NOT NULL DEFAULT true,
  bloqueado_em TIMESTAMPTZ,
  consentimento_lgpd_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- =========================================================
-- user_roles
-- =========================================================
CREATE TABLE public.user_roles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

-- =========================================================
-- permissions
-- =========================================================
CREATE TABLE public.permissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nivel_acesso_id UUID NOT NULL REFERENCES public.access_levels(id) ON DELETE CASCADE,
  modulo TEXT NOT NULL,
  acao TEXT NOT NULL,
  escopo_dados public.escopo_dados NOT NULL DEFAULT 'proprios',
  permitido BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (nivel_acesso_id, modulo, acao)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permissions TO authenticated;
GRANT ALL ON public.permissions TO service_role;

-- =========================================================
-- admin_audit_logs
-- =========================================================
CREATE TABLE public.admin_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  correspondente_id UUID,
  acao TEXT NOT NULL,
  entidade TEXT,
  entidade_id UUID,
  ip TEXT,
  user_agent TEXT,
  payload_anterior JSONB,
  payload_novo JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_audit_logs TO authenticated;
GRANT ALL ON public.admin_audit_logs TO service_role;

-- Indexes
CREATE INDEX idx_profiles_correspondente ON public.profiles(correspondente_id);
CREATE INDEX idx_user_roles_user ON public.user_roles(user_id);
CREATE INDEX idx_permissions_nivel ON public.permissions(nivel_acesso_id);
CREATE INDEX idx_access_levels_correspondente ON public.access_levels(correspondente_id);
CREATE INDEX idx_audit_correspondente ON public.admin_audit_logs(correspondente_id);

-- updated_at triggers
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_access_levels_updated BEFORE UPDATE ON public.access_levels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_permissions_updated BEFORE UPDATE ON public.permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- SECURITY DEFINER helper functions
-- =========================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID, _roles public.app_role[])
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = ANY(_roles));
$$;

CREATE OR REPLACE FUNCTION public.correspondente_do_usuario(_user_id UUID)
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT correspondente_id FROM public.profiles WHERE id = _user_id;
$$;

CREATE OR REPLACE FUNCTION public.is_correspondente(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _user_id
      AND p.correspondente_id = p.id
      AND public.has_role(_user_id, 'correspondente')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_interno(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_any_role(_user_id, ARRAY['admin','correspondente','gestor','comercial','analista']::public.app_role[]);
$$;

CREATE OR REPLACE FUNCTION public.pode_gerenciar_pessoas(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    public.has_any_role(_user_id, ARRAY['admin','correspondente']::public.app_role[])
    OR (
      public.has_role(_user_id, 'gestor')
      AND EXISTS (
        SELECT 1 FROM public.profiles pr
        JOIN public.permissions pm ON pm.nivel_acesso_id = pr.nivel_acesso_id
        WHERE pr.id = _user_id
          AND pm.modulo = 'admin.pessoas'
          AND pm.acao = 'create'
          AND pm.permitido = true
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.usuario_tem_permissao(_user_id UUID, _modulo TEXT, _acao TEXT)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    CASE
      WHEN public.has_any_role(_user_id, ARRAY['admin','correspondente']::public.app_role[]) THEN true
      ELSE COALESCE((
        SELECT pm.permitido FROM public.profiles pr
        JOIN public.permissions pm ON pm.nivel_acesso_id = pr.nivel_acesso_id
        WHERE pr.id = _user_id AND pm.modulo = _modulo AND pm.acao = _acao
        LIMIT 1
      ), false)
    END;
$$;

CREATE OR REPLACE FUNCTION public.usuario_escopo_dados(_user_id UUID, _modulo TEXT)
RETURNS public.escopo_dados LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    CASE
      WHEN public.has_any_role(_user_id, ARRAY['admin','correspondente']::public.app_role[]) THEN 'todos'::public.escopo_dados
      ELSE COALESCE((
        SELECT pm.escopo_dados FROM public.profiles pr
        JOIN public.permissions pm ON pm.nivel_acesso_id = pr.nivel_acesso_id
        WHERE pr.id = _user_id AND pm.modulo = _modulo
        ORDER BY (pm.acao = 'view') DESC
        LIMIT 1
      ), 'proprios'::public.escopo_dados)
    END;
$$;

CREATE OR REPLACE FUNCTION public.mask_pii_jsonb(_data JSONB)
RETURNS JSONB LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
DECLARE
  result JSONB := _data;
  k TEXT;
  sensitive TEXT[] := ARRAY['cpf','cnpj','renda','rg','senha','password','documento','data_nascimento'];
BEGIN
  IF _data IS NULL OR jsonb_typeof(_data) <> 'object' THEN
    RETURN _data;
  END IF;
  FOREACH k IN ARRAY sensitive LOOP
    IF result ? k THEN
      result := jsonb_set(result, ARRAY[k], '"***"'::jsonb);
    END IF;
  END LOOP;
  RETURN result;
END;
$$;

-- =========================================================
-- handle_new_user_profile trigger on auth.users
-- =========================================================
CREATE OR REPLACE FUNCTION public.handle_new_user_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  meta JSONB := NEW.raw_user_meta_data;
  v_correspondente_id UUID;
  v_papel public.app_role;
  v_acesso public.acesso_tipo := 'sistema';
  v_nivel UUID;
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
    -- fallback: standalone user with no ecosystem metadata; skip role
    v_correspondente_id := NULL;
    v_papel := NULL;
  END IF;

  INSERT INTO public.profiles (id, correspondente_id, email, nome, telefone, acesso_tipo, nivel_acesso_id)
  VALUES (
    NEW.id,
    v_correspondente_id,
    NEW.email,
    COALESCE(meta->>'full_name', meta->>'nome'),
    meta->>'telefone',
    v_acesso,
    v_nivel
  );

  IF v_papel IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_papel)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_profile();

-- =========================================================
-- RLS POLICIES
-- =========================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- profiles: user sees own + everyone in own ecosystem
CREATE POLICY "profiles_select_ecossistema" ON public.profiles FOR SELECT TO authenticated
USING (
  id = auth.uid()
  OR correspondente_id = public.correspondente_do_usuario(auth.uid())
);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_manage_ecossistema" ON public.profiles FOR UPDATE TO authenticated
USING (
  correspondente_id = public.correspondente_do_usuario(auth.uid())
  AND public.pode_gerenciar_pessoas(auth.uid())
)
WITH CHECK (
  correspondente_id = public.correspondente_do_usuario(auth.uid())
  AND public.pode_gerenciar_pessoas(auth.uid())
);

-- user_roles: read own + own ecosystem
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = user_roles.user_id
      AND p.correspondente_id = public.correspondente_do_usuario(auth.uid())
  )
);

-- access_levels: read defaults + own ecosystem; manage own ecosystem
CREATE POLICY "access_levels_select" ON public.access_levels FOR SELECT TO authenticated
USING (
  is_padrao = true
  OR correspondente_id = public.correspondente_do_usuario(auth.uid())
);
CREATE POLICY "access_levels_write" ON public.access_levels FOR ALL TO authenticated
USING (
  correspondente_id = public.correspondente_do_usuario(auth.uid())
  AND public.pode_gerenciar_pessoas(auth.uid())
)
WITH CHECK (
  correspondente_id = public.correspondente_do_usuario(auth.uid())
  AND public.pode_gerenciar_pessoas(auth.uid())
);

-- permissions: read for levels visible to user; manage by correspondente/gestor authorized
CREATE POLICY "permissions_select" ON public.permissions FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.access_levels al
    WHERE al.id = permissions.nivel_acesso_id
      AND (al.is_padrao = true OR al.correspondente_id = public.correspondente_do_usuario(auth.uid()))
  )
);
CREATE POLICY "permissions_write" ON public.permissions FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.access_levels al
    WHERE al.id = permissions.nivel_acesso_id
      AND al.correspondente_id = public.correspondente_do_usuario(auth.uid())
  )
  AND public.pode_gerenciar_pessoas(auth.uid())
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.access_levels al
    WHERE al.id = permissions.nivel_acesso_id
      AND al.correspondente_id = public.correspondente_do_usuario(auth.uid())
  )
  AND public.pode_gerenciar_pessoas(auth.uid())
);

-- audit logs: read own ecosystem
CREATE POLICY "audit_select_ecossistema" ON public.admin_audit_logs FOR SELECT TO authenticated
USING (correspondente_id = public.correspondente_do_usuario(auth.uid()));

-- =========================================================
-- SEED: default access levels (produto)
-- =========================================================
INSERT INTO public.access_levels (id, correspondente_id, nome, descricao, is_padrao, ativo) VALUES
  ('00000000-0000-0000-0000-000000000001', NULL, 'Gestor', 'Braço direito do correspondente, gerencia a equipe.', true, true),
  ('00000000-0000-0000-0000-000000000002', NULL, 'Comercial', 'Vendedor / originador de negócio.', true, true),
  ('00000000-0000-0000-0000-000000000003', NULL, 'Analista', 'Analista de crédito / operacional.', true, true);
