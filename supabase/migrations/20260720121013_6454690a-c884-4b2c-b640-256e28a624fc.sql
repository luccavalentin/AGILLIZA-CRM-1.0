
-- RLS para storage.objects do bucket rh-documentos
-- Estrutura de caminho esperada: {correspondente_id}/{funcionario_id}/{...arquivo}
DROP POLICY IF EXISTS "rh_docs_bucket_select" ON storage.objects;
DROP POLICY IF EXISTS "rh_docs_bucket_insert" ON storage.objects;
DROP POLICY IF EXISTS "rh_docs_bucket_update" ON storage.objects;
DROP POLICY IF EXISTS "rh_docs_bucket_delete" ON storage.objects;

CREATE POLICY "rh_docs_bucket_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'rh-documentos'
    AND (storage.foldername(name))[1] = public.correspondente_do_usuario(auth.uid())::text
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.funcionarios','view')
      OR public.usuario_tem_permissao(auth.uid(),'rh.documentos','view')
      OR public.usuario_tem_permissao(auth.uid(),'rh.holerites','view')));

CREATE POLICY "rh_docs_bucket_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'rh-documentos'
    AND (storage.foldername(name))[1] = public.correspondente_do_usuario(auth.uid())::text
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.documentos','edit')
      OR public.usuario_tem_permissao(auth.uid(),'rh.holerites','edit')
      OR public.usuario_tem_permissao(auth.uid(),'rh.ocorrencias','edit')));

CREATE POLICY "rh_docs_bucket_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'rh-documentos'
    AND (storage.foldername(name))[1] = public.correspondente_do_usuario(auth.uid())::text
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.documentos','edit')
      OR public.usuario_tem_permissao(auth.uid(),'rh.holerites','edit')));

CREATE POLICY "rh_docs_bucket_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'rh-documentos'
    AND (storage.foldername(name))[1] = public.correspondente_do_usuario(auth.uid())::text
    AND (public.has_any_role(auth.uid(), ARRAY['admin','correspondente']::public.app_role[])
      OR public.usuario_tem_permissao(auth.uid(),'rh.documentos','edit')
      OR public.usuario_tem_permissao(auth.uid(),'rh.holerites','edit')));
