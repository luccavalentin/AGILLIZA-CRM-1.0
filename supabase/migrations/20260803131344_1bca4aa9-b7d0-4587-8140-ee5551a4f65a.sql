-- Política para permitir upload por usuários autenticados na pasta avatars
CREATE POLICY "Permitir upload de avatars para autenticados"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'configuracoes' AND (storage.foldername(name))[1] = 'avatars');

-- Política para permitir leitura pública dos objetos no bucket
CREATE POLICY "Permitir leitura pública no bucket configuracoes"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'configuracoes');

-- Política para permitir deleção pelos próprios donos
CREATE POLICY "Permitir delete para autenticados"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'configuracoes');
