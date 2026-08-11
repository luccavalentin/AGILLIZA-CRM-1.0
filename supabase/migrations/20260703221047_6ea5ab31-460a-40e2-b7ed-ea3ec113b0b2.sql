
CREATE POLICY "proposta_docs_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documentos-proposta'
    AND public.usuario_tem_acesso_proposta(auth.uid(), (split_part(name,'/',1))::uuid));
CREATE POLICY "proposta_docs_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos-proposta'
    AND public.usuario_tem_acesso_proposta(auth.uid(), (split_part(name,'/',1))::uuid));
CREATE POLICY "proposta_docs_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documentos-proposta'
    AND public.usuario_tem_acesso_proposta(auth.uid(), (split_part(name,'/',1))::uuid));
