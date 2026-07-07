
-- Tabela formularios_bancarios
DROP POLICY IF EXISTS "Equipe interna cria formularios" ON public.formularios_bancarios;
DROP POLICY IF EXISTS "Equipe interna edita formularios" ON public.formularios_bancarios;
DROP POLICY IF EXISTS "Equipe interna exclui formularios" ON public.formularios_bancarios;
DROP POLICY IF EXISTS "Equipe interna visualiza formularios" ON public.formularios_bancarios;

CREATE POLICY "Autenticados visualizam formularios" ON public.formularios_bancarios
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados criam formularios" ON public.formularios_bancarios
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados editam formularios" ON public.formularios_bancarios
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Autenticados excluem formularios" ON public.formularios_bancarios
  FOR DELETE TO authenticated USING (true);

-- Storage bucket formularios-bancarios
DROP POLICY IF EXISTS "Equipe interna envia arquivos formularios" ON storage.objects;
DROP POLICY IF EXISTS "Equipe interna atualiza arquivos formularios" ON storage.objects;
DROP POLICY IF EXISTS "Equipe interna exclui arquivos formularios" ON storage.objects;
DROP POLICY IF EXISTS "Equipe interna le arquivos formularios" ON storage.objects;

CREATE POLICY "Autenticados leem arquivos formularios" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'formularios-bancarios');
CREATE POLICY "Autenticados enviam arquivos formularios" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'formularios-bancarios');
CREATE POLICY "Autenticados atualizam arquivos formularios" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'formularios-bancarios') WITH CHECK (bucket_id = 'formularios-bancarios');
CREATE POLICY "Autenticados excluem arquivos formularios" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'formularios-bancarios');
