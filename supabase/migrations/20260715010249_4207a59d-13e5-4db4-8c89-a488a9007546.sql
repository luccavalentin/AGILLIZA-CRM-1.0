
DROP POLICY IF EXISTS "Formularios: gestao cria" ON public.formularios_bancarios;
DROP POLICY IF EXISTS "Formularios: gestao edita" ON public.formularios_bancarios;
DROP POLICY IF EXISTS "Formularios: gestao exclui" ON public.formularios_bancarios;
DROP POLICY IF EXISTS "Formularios: leitura autenticado" ON public.formularios_bancarios;

CREATE POLICY "Formularios: leitura autenticado" ON public.formularios_bancarios
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Formularios: autenticado cria" ON public.formularios_bancarios
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Formularios: autenticado edita" ON public.formularios_bancarios
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Formularios: autenticado exclui" ON public.formularios_bancarios
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
