CREATE POLICY "cli_docs_select" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'cliente-documentos'
  AND public.usuario_tem_acesso_cliente(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
CREATE POLICY "cli_docs_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'cliente-documentos'
  AND public.usuario_tem_acesso_cliente(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
CREATE POLICY "cli_docs_update" ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'cliente-documentos'
  AND public.usuario_tem_acesso_cliente(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
CREATE POLICY "cli_docs_delete" ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'cliente-documentos'
  AND public.usuario_tem_acesso_cliente(auth.uid(), ((storage.foldername(name))[1])::uuid)
);