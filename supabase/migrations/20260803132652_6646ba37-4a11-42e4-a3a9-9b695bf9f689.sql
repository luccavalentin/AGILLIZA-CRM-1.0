-- Remove políticas anteriores para evitar conflitos
DROP POLICY IF EXISTS "Permitir upload no bucket avatars" ON storage.objects;
DROP POLICY IF EXISTS "Permitir leitura pública no bucket avatars" ON storage.objects;
DROP POLICY IF EXISTS "Permitir tudo para autenticados no bucket avatars" ON storage.objects;
DROP POLICY IF EXISTS "Permitir upload de avatars para autenticados" ON storage.objects;

-- Criar políticas simplificadas para o bucket 'avatars'
CREATE POLICY "Permitir upload no bucket avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Permitir leitura pública no bucket avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

CREATE POLICY "Permitir deleção para autenticados no bucket avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');
