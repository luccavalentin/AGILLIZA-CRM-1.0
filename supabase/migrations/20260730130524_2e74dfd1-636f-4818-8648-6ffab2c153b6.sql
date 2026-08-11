CREATE POLICY "chat_anexos_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-anexos');
CREATE POLICY "chat_anexos_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'chat-anexos');
CREATE POLICY "chat_anexos_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-anexos' AND owner = auth.uid());