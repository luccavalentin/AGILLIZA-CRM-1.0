CREATE POLICY "fin_comprovantes_all" ON storage.objects FOR ALL TO authenticated
USING (
  bucket_id = 'financeiro-comprovantes'
  AND public.usuario_pode_financeiro(auth.uid())
  AND (storage.foldername(name))[1] = public.correspondente_do_usuario(auth.uid())::text
)
WITH CHECK (
  bucket_id = 'financeiro-comprovantes'
  AND public.usuario_pode_financeiro(auth.uid())
  AND (storage.foldername(name))[1] = public.correspondente_do_usuario(auth.uid())::text
);