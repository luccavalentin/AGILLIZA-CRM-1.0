-- RLS para o bucket scan-ia: acesso por ecossistema (correspondente) e admin
CREATE POLICY "scan_ia_objects_select"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'scan-ia'
  AND usuario_pode_admin(auth.uid())
  AND (storage.foldername(name))[1] = correspondente_do_usuario(auth.uid())::text
);

CREATE POLICY "scan_ia_objects_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'scan-ia'
  AND usuario_pode_admin(auth.uid())
  AND (storage.foldername(name))[1] = correspondente_do_usuario(auth.uid())::text
);

CREATE POLICY "scan_ia_objects_delete"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'scan-ia'
  AND usuario_pode_admin(auth.uid())
  AND (storage.foldername(name))[1] = correspondente_do_usuario(auth.uid())::text
);