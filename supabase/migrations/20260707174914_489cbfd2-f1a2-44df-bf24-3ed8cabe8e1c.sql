-- Tabela de Tipos de Pessoa
CREATE TABLE public.tipos_pessoa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  correspondente_id uuid NOT NULL,
  nome text NOT NULL,
  slug text NOT NULL,
  descricao text,
  acesso_tipo public.acesso_tipo NOT NULL DEFAULT 'sistema',
  login_padrao boolean NOT NULL DEFAULT true,
  ativo boolean NOT NULL DEFAULT true,
  is_padrao boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (correspondente_id, slug)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tipos_pessoa TO authenticated;
GRANT ALL ON public.tipos_pessoa TO service_role;

ALTER TABLE public.tipos_pessoa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe vê tipos do seu ecossistema"
ON public.tipos_pessoa FOR SELECT TO authenticated
USING (correspondente_id = public.correspondente_do_usuario(auth.uid()));

CREATE POLICY "Gestores gerenciam tipos do ecossistema"
ON public.tipos_pessoa FOR ALL TO authenticated
USING (
  correspondente_id = public.correspondente_do_usuario(auth.uid())
  AND public.pode_gerenciar_pessoas(auth.uid())
)
WITH CHECK (
  correspondente_id = public.correspondente_do_usuario(auth.uid())
  AND public.pode_gerenciar_pessoas(auth.uid())
);

CREATE TRIGGER trg_tipos_pessoa_updated
BEFORE UPDATE ON public.tipos_pessoa
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.tipos_pessoa (correspondente_id, nome, slug, acesso_tipo, login_padrao, is_padrao)
SELECT c.cid, v.nome, v.slug, v.acesso::public.acesso_tipo, v.login, true
FROM (SELECT DISTINCT correspondente_id AS cid FROM public.profiles WHERE correspondente_id IS NOT NULL) c
CROSS JOIN (VALUES
  ('Usuário interno','usuario','sistema', true),
  ('Imobiliária','imobiliaria','portal_parceiro', false),
  ('Corretor','corretor','portal_parceiro', false)
) AS v(nome, slug, acesso, login)
ON CONFLICT (correspondente_id, slug) DO NOTHING;

-- Alvos do escopo personalizado
CREATE TABLE public.permission_escopo_alvos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  alvo_tipo text NOT NULL CHECK (alvo_tipo IN ('usuario','papel','tipo_pessoa')),
  alvo_id uuid,
  alvo_valor text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_permission_escopo_alvos_perm ON public.permission_escopo_alvos(permission_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.permission_escopo_alvos TO authenticated;
GRANT ALL ON public.permission_escopo_alvos TO service_role;

ALTER TABLE public.permission_escopo_alvos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe lê alvos de escopo"
ON public.permission_escopo_alvos FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Gestores gerenciam alvos de escopo"
ON public.permission_escopo_alvos FOR ALL TO authenticated
USING (public.pode_gerenciar_pessoas(auth.uid()))
WITH CHECK (public.pode_gerenciar_pessoas(auth.uid()));

-- Helper: dono está entre os alvos personalizados do usuário para o módulo
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
              WHERE po.id = _owner_id AND po.tipo_pessoa = a.alvo_valor))
      )
  );
$function$;

-- Funções de acesso passam a honrar 'personalizado'
CREATE OR REPLACE FUNCTION public.usuario_tem_acesso_cliente(_user_id uuid, _cliente_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.clientes c
    WHERE c.id = _cliente_id
      AND c.correspondente_id = public.correspondente_do_usuario(_user_id)
      AND (
        public.usuario_escopo_dados(_user_id, 'crm.clientes') IN ('todos','equipe')
        OR c.responsavel_id = _user_id
        OR c.criador_id = _user_id
        OR public.cliente_vinculado_ao_parceiro(_user_id, c.id)
        OR (public.usuario_escopo_dados(_user_id,'crm.clientes') = 'personalizado'
            AND (public.usuario_escopo_inclui_dono(_user_id,'crm.clientes', c.responsavel_id)
              OR public.usuario_escopo_inclui_dono(_user_id,'crm.clientes', c.criador_id)))
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.usuario_tem_acesso_tarefa(_user_id uuid, _task_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id=_task_id
      AND t.correspondente_id = public.correspondente_do_usuario(_user_id)
      AND (
        public.usuario_escopo_dados(_user_id,'operacional.tarefas') IN ('todos','equipe')
        OR t.responsavel_id=_user_id OR t.criador_id=_user_id
        OR EXISTS (SELECT 1 FROM public.task_participants tp WHERE tp.task_id=t.id AND tp.user_id=_user_id)
        OR (public.usuario_escopo_dados(_user_id,'operacional.tarefas') = 'personalizado'
            AND (public.usuario_escopo_inclui_dono(_user_id,'operacional.tarefas', t.responsavel_id)
              OR public.usuario_escopo_inclui_dono(_user_id,'operacional.tarefas', t.criador_id)))
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.usuario_tem_acesso_demanda(_user_id uuid, _dem_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.demandas d
    WHERE d.id=_dem_id
      AND d.correspondente_id = public.correspondente_do_usuario(_user_id)
      AND (
        public.usuario_escopo_dados(_user_id,'operacional.demandas') IN ('todos','equipe')
        OR d.responsavel_id=_user_id OR d.criador_id=_user_id
        OR EXISTS (SELECT 1 FROM public.demanda_participantes dp WHERE dp.demanda_id=d.id AND dp.user_id=_user_id)
        OR (public.usuario_escopo_dados(_user_id,'operacional.demandas') = 'personalizado'
            AND (public.usuario_escopo_inclui_dono(_user_id,'operacional.demandas', d.responsavel_id)
              OR public.usuario_escopo_inclui_dono(_user_id,'operacional.demandas', d.criador_id)))
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.usuario_tem_acesso_simulacao(_user_id uuid, _sim_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.simulacoes s
    WHERE s.id = _sim_id
      AND s.correspondente_id = public.correspondente_do_usuario(_user_id)
      AND (
        public.usuario_escopo_dados(_user_id,'operacional.simulacoes') IN ('todos','equipe')
        OR s.usuario_responsavel_id = _user_id
        OR s.usuario_criador_id = _user_id
        OR public.cliente_vinculado_ao_parceiro(_user_id, s.cliente_id)
        OR (public.usuario_escopo_dados(_user_id,'operacional.simulacoes') = 'personalizado'
            AND (public.usuario_escopo_inclui_dono(_user_id,'operacional.simulacoes', s.usuario_responsavel_id)
              OR public.usuario_escopo_inclui_dono(_user_id,'operacional.simulacoes', s.usuario_criador_id)))
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.usuario_tem_acesso_proposta(_user_id uuid, _prop_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.propostas p
    WHERE p.id = _prop_id
      AND p.correspondente_id = public.correspondente_do_usuario(_user_id)
      AND (
        public.usuario_escopo_dados(_user_id,'operacional.propostas') IN ('todos','equipe')
        OR p.usuario_responsavel_id = _user_id
        OR p.usuario_criador_id = _user_id
        OR public.cliente_vinculado_ao_parceiro(_user_id, p.cliente_id)
        OR (public.usuario_escopo_dados(_user_id,'operacional.propostas') = 'personalizado'
            AND (public.usuario_escopo_inclui_dono(_user_id,'operacional.propostas', p.usuario_responsavel_id)
              OR public.usuario_escopo_inclui_dono(_user_id,'operacional.propostas', p.usuario_criador_id)))
      )
  );
$function$;