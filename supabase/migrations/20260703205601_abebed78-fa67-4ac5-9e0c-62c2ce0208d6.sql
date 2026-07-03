CREATE POLICY "Ler pdfs de simulacao com acesso" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'simulacao-pdfs'
    AND public.usuario_tem_acesso_simulacao(auth.uid(), (split_part(name,'/',1))::uuid)
  );
CREATE POLICY "Gravar pdfs de simulacao com acesso" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'simulacao-pdfs'
    AND public.usuario_tem_acesso_simulacao(auth.uid(), (split_part(name,'/',1))::uuid)
  );