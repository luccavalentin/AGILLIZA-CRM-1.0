-- Remove políticas anteriores que exigiam a pasta 'avatars/'
DROP POLICY IF EXISTS "Permitir upload no bucket avatars" ON storage.objects;
DROP POLICY IF EXISTS "Permitir leitura pública no bucket avatars" ON storage.objects;
DROP POLICY IF EXISTS "Permitir deleção para autenticados no bucket avatars" ON storage.objects;
DROP POLICY IF EXISTS "Permitir upload de avatars para autenticados" ON storage.objects;

-- Criar políticas permitindo acesso à raiz do bucket 'avatars'
CREATE POLICY "Permitir upload no bucket avatars raiz"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Permitir leitura pública no bucket avatars raiz"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

CREATE POLICY "Permitir deleção no bucket avatars raiz"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');
