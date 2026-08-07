
CREATE OR REPLACE FUNCTION public.usuario_tem_acesso_demanda(_user_id uuid, _dem_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.demandas d
    WHERE d.id=_dem_id
      AND d.correspondente_id = public.correspondente_do_usuario(_user_id)
      AND (
        public.usuario_escopo_dados(_user_id,'operacional.demandas') IN ('todos','equipe')
        OR d.responsavel_id=_user_id OR d.criador_id=_user_id
        OR EXISTS (SELECT 1 FROM public.demanda_participantes dp WHERE dp.demanda_id=d.id AND dp.user_id=_user_id)
        OR (d.cliente_id IS NOT NULL AND public.cliente_vinculado_ao_parceiro(_user_id, d.cliente_id))
        OR (public.usuario_escopo_dados(_user_id,'operacional.demandas') = 'personalizado'
            AND (public.usuario_escopo_inclui_dono(_user_id,'operacional.demandas', d.responsavel_id)
              OR public.usuario_escopo_inclui_dono(_user_id,'operacional.demandas', d.criador_id)))
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.usuario_tem_acesso_tarefa(_user_id uuid, _task_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id=_task_id
      AND t.correspondente_id = public.correspondente_do_usuario(_user_id)
      AND (
        public.usuario_escopo_dados(_user_id,'operacional.tarefas') IN ('todos','equipe')
        OR t.responsavel_id=_user_id OR t.criador_id=_user_id
        OR EXISTS (SELECT 1 FROM public.task_participants tp WHERE tp.task_id=t.id AND tp.user_id=_user_id)
        OR (t.cliente_id IS NOT NULL AND public.cliente_vinculado_ao_parceiro(_user_id, t.cliente_id))
        OR (public.usuario_escopo_dados(_user_id,'operacional.tarefas') = 'personalizado'
            AND (public.usuario_escopo_inclui_dono(_user_id,'operacional.tarefas', t.responsavel_id)
              OR public.usuario_escopo_inclui_dono(_user_id,'operacional.tarefas', t.criador_id)))
      )
  );
$function$;
