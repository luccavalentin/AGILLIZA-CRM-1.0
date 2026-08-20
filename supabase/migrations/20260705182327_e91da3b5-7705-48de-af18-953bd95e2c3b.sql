-- Helper: verifica se o usuário pertence à equipe interna
CREATE OR REPLACE FUNCTION public.is_equipe_interna(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_any_role(
    _user_id,
    ARRAY['admin','correspondente','gestor','comercial','analista','financeiro']::app_role[]
  )
$$;

-- Tabela de formulários bancários
CREATE TABLE public.formularios_bancarios (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  banco text NOT NULL CHECK (banco IN ('itau','bradesco','santander','inter')),
  nome text NOT NULL,
  descricao text,
  storage_path text NOT NULL,
  content_type text,
  tamanho bigint,
  criado_por uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.formularios_bancarios TO authenticated;
GRANT ALL ON public.formularios_bancarios TO service_role;

ALTER TABLE public.formularios_bancarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Equipe interna visualiza formularios"
ON public.formularios_bancarios FOR SELECT TO authenticated
USING (public.is_equipe_interna(auth.uid()));

CREATE POLICY "Equipe interna cria formularios"
ON public.formularios_bancarios FOR INSERT TO authenticated
WITH CHECK (public.is_equipe_interna(auth.uid()));

CREATE POLICY "Equipe interna edita formularios"
ON public.formularios_bancarios FOR UPDATE TO authenticated
USING (public.is_equipe_interna(auth.uid()))
WITH CHECK (public.is_equipe_interna(auth.uid()));

CREATE POLICY "Equipe interna exclui formularios"
ON public.formularios_bancarios FOR DELETE TO authenticated
USING (public.is_equipe_interna(auth.uid()));

CREATE TRIGGER update_formularios_bancarios_updated_at
BEFORE UPDATE ON public.formularios_bancarios
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_formularios_bancarios_banco ON public.formularios_bancarios (banco);

-- Políticas de storage para o bucket de formulários
CREATE POLICY "Equipe interna le arquivos formularios"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'formularios-bancarios' AND public.is_equipe_interna(auth.uid()));

CREATE POLICY "Equipe interna envia arquivos formularios"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'formularios-bancarios' AND public.is_equipe_interna(auth.uid()));

CREATE POLICY "Equipe interna atualiza arquivos formularios"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'formularios-bancarios' AND public.is_equipe_interna(auth.uid()))
WITH CHECK (bucket_id = 'formularios-bancarios' AND public.is_equipe_interna(auth.uid()));

CREATE POLICY "Equipe interna exclui arquivos formularios"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'formularios-bancarios' AND public.is_equipe_interna(auth.uid()));