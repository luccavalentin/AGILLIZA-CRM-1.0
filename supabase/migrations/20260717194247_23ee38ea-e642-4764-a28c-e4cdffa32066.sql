-- Segurança: restringir execução de funções SECURITY DEFINER públicas
-- Estratégia: REVOKE FROM PUBLIC/anon; GRANT TO authenticated, service_role
-- Preserva 100% do funcionamento para usuários logados e triggers/server functions.

DO $$
DECLARE
  r RECORD;
  fn_signature TEXT;
BEGIN
  FOR r IN
    SELECT
      n.nspname AS schema_name,
      p.proname AS function_name,
      pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true  -- apenas SECURITY DEFINER
  LOOP
    fn_signature := format('%I.%I(%s)', r.schema_name, r.function_name, r.args);

    -- Remove execução pública e anônima
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn_signature);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn_signature);

    -- Garante execução para usuários autenticados e papel de serviço
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn_signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn_signature);
  END LOOP;
END;
$$;
