CREATE TABLE public.arquivos_nos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  correspondente_id UUID NOT NULL,
  parent_id UUID REFERENCES public.arquivos_nos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'arquivo',
  nome TEXT NOT NULL,
  storage_path TEXT,
  content_type TEXT,
  tamanho BIGINT,
  criado_por UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT arquivos_nos_tipo_chk CHECK (tipo IN ('pasta','arquivo'))
);

CREATE INDEX idx_arquivos_nos_corr_parent ON public.arquivos_nos (correspondente_id, parent_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.arquivos_nos TO authenticated;
GRANT ALL ON public.arquivos_nos TO service_role;

ALTER TABLE public.arquivos_nos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Arquivos: ver do meu correspondente" ON public.arquivos_nos
  FOR SELECT TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()));

CREATE POLICY "Arquivos: criar no meu correspondente" ON public.arquivos_nos
  FOR INSERT TO authenticated
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()));

CREATE POLICY "Arquivos: atualizar do meu correspondente" ON public.arquivos_nos
  FOR UPDATE TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()))
  WITH CHECK (correspondente_id = public.correspondente_do_usuario(auth.uid()));

CREATE POLICY "Arquivos: excluir do meu correspondente" ON public.arquivos_nos
  FOR DELETE TO authenticated
  USING (correspondente_id = public.correspondente_do_usuario(auth.uid()));

CREATE TRIGGER update_arquivos_nos_updated_at
  BEFORE UPDATE ON public.arquivos_nos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Políticas de storage para o bucket "arquivos"
CREATE POLICY "Arquivos storage: ler autenticado" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'arquivos');

CREATE POLICY "Arquivos storage: enviar autenticado" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'arquivos');

CREATE POLICY "Arquivos storage: atualizar autenticado" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'arquivos');

CREATE POLICY "Arquivos storage: excluir autenticado" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'arquivos');