DO $$
DECLARE
  r record;
  nova_qual text;
  nova_check text;
  sql text;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        (qual ~ 'auth\.uid\(\)' AND qual !~ 'SELECT auth\.uid\(\)')
        OR (with_check ~ 'auth\.uid\(\)' AND with_check !~ 'SELECT auth\.uid\(\)')
      )
  LOOP
    -- Normaliza (desembrulha) qualquer auth.uid() ja embrulhado, depois embrulha tudo uma unica vez.
    nova_qual := r.qual;
    IF nova_qual IS NOT NULL THEN
      nova_qual := regexp_replace(nova_qual, '\(\s*SELECT auth\.uid\(\) AS uid\)', 'auth.uid()', 'g');
      nova_qual := regexp_replace(nova_qual, 'auth\.uid\(\)', '(select auth.uid())', 'g');
    END IF;

    nova_check := r.with_check;
    IF nova_check IS NOT NULL THEN
      nova_check := regexp_replace(nova_check, '\(\s*SELECT auth\.uid\(\) AS uid\)', 'auth.uid()', 'g');
      nova_check := regexp_replace(nova_check, 'auth\.uid\(\)', '(select auth.uid())', 'g');
    END IF;

    sql := format('ALTER POLICY %I ON public.%I', r.policyname, r.tablename);
    IF nova_qual IS NOT NULL THEN
      sql := sql || format(' USING (%s)', nova_qual);
    END IF;
    IF nova_check IS NOT NULL THEN
      sql := sql || format(' WITH CHECK (%s)', nova_check);
    END IF;

    EXECUTE sql;
  END LOOP;
END $$;