DO $$
DECLARE fn RECORD;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'has_role','has_any_role','correspondente_do_usuario','is_correspondente',
        'is_interno','pode_gerenciar_pessoas','usuario_tem_permissao',
        'usuario_escopo_dados','mask_pii_jsonb','handle_new_user_profile',
        'update_updated_at_column'
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon;', fn.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role;', fn.sig);
  END LOOP;
END $$;
