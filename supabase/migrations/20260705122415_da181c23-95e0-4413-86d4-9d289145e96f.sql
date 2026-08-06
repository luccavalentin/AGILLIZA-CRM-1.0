CREATE POLICY "demanda_anexos_select" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'demanda-anexos');
CREATE POLICY "demanda_anexos_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'demanda-anexos');
CREATE POLICY "demanda_anexos_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'demanda-anexos');