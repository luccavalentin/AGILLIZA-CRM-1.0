CREATE OR REPLACE FUNCTION public.eleger_lider_oportunidade(p_simulacao_id uuid, p_lock_timeout timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_id uuid;
    v_limite timestamptz;
begin
    v_limite := greatest(
      coalesce(p_lock_timeout, now() - interval '2 minutes'),
      now() - interval '2 minutes'
    );

    update public.simulacoes
       set oportunidade_lock_em = now()
     where id = p_simulacao_id
       and (oportunidade_lock_em is null or oportunidade_lock_em < v_limite)
    returning id into v_id;

    return v_id is not null;
end;
$function$;