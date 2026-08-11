
-- 1) formularios_bancarios: leitura para autenticados; escrita só gestão
DROP POLICY IF EXISTS "Autenticados criam formularios" ON public.formularios_bancarios;
DROP POLICY IF EXISTS "Autenticados editam formularios" ON public.formularios_bancarios;
DROP POLICY IF EXISTS "Autenticados excluem formularios" ON public.formularios_bancarios;
DROP POLICY IF EXISTS "Autenticados visualizam formularios" ON public.formularios_bancarios;

CREATE POLICY "Formularios: leitura autenticado" ON public.formularios_bancarios
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Formularios: gestao cria" ON public.formularios_bancarios
  FOR INSERT TO authenticated WITH CHECK (public.usuario_pode_admin(auth.uid()));
CREATE POLICY "Formularios: gestao edita" ON public.formularios_bancarios
  FOR UPDATE TO authenticated USING (public.usuario_pode_admin(auth.uid())) WITH CHECK (public.usuario_pode_admin(auth.uid()));
CREATE POLICY "Formularios: gestao exclui" ON public.formularios_bancarios
  FOR DELETE TO authenticated USING (public.usuario_pode_admin(auth.uid()));

-- 2) Corrige join quebrado na leitura de tarefas
DROP POLICY IF EXISTS "tasks leitura" ON public.tasks;
CREATE POLICY "tasks leitura" ON public.tasks
  FOR SELECT TO authenticated
  USING (
    (correspondente_id = public.correspondente_do_usuario(auth.uid()))
    AND (
      (public.usuario_escopo_dados(auth.uid(), 'operacional.tarefas') = ANY (ARRAY['todos'::public.escopo_dados, 'equipe'::public.escopo_dados]))
      OR (responsavel_id = auth.uid())
      OR (criador_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.task_participants tp
        WHERE tp.task_id = tasks.id AND tp.user_id = auth.uid()
      )
    )
  );

-- 3) Corrige join quebrado na leitura de demandas
DROP POLICY IF EXISTS "demandas leitura" ON public.demandas;
CREATE POLICY "demandas leitura" ON public.demandas
  FOR SELECT TO authenticated
  USING (
    (correspondente_id = public.correspondente_do_usuario(auth.uid()))
    AND (
      (public.usuario_escopo_dados(auth.uid(), 'operacional.demandas') = ANY (ARRAY['todos'::public.escopo_dados, 'equipe'::public.escopo_dados]))
      OR (responsavel_id = auth.uid())
      OR (criador_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM public.demanda_participantes dp
        WHERE dp.demanda_id = demandas.id AND dp.user_id = auth.uid()
      )
    )
  );

-- 4) Storage bucket 'arquivos': escopo por correspondente via arquivos_nos
DROP POLICY IF EXISTS "Arquivos storage: ler autenticado" ON storage.objects;
DROP POLICY IF EXISTS "Arquivos storage: enviar autenticado" ON storage.objects;
DROP POLICY IF EXISTS "Arquivos storage: atualizar autenticado" ON storage.objects;
DROP POLICY IF EXISTS "Arquivos storage: excluir autenticado" ON storage.objects;

CREATE POLICY "Arquivos storage: ler do correspondente" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'arquivos'
    AND EXISTS (
      SELECT 1 FROM public.arquivos_nos an
      WHERE an.storage_path = storage.objects.name
        AND an.correspondente_id = public.correspondente_do_usuario(auth.uid())
    )
  );
-- Upload: o registro em arquivos_nos é criado após o upload, então basta estar autenticado (nome do arquivo é um UUID aleatório)
CREATE POLICY "Arquivos storage: enviar autenticado" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'arquivos' AND auth.uid() IS NOT NULL);
CREATE POLICY "Arquivos storage: atualizar do correspondente" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'arquivos'
    AND EXISTS (
      SELECT 1 FROM public.arquivos_nos an
      WHERE an.storage_path = storage.objects.name
        AND an.correspondente_id = public.correspondente_do_usuario(auth.uid())
    )
  );
CREATE POLICY "Arquivos storage: excluir do correspondente" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'arquivos'
    AND EXISTS (
      SELECT 1 FROM public.arquivos_nos an
      WHERE an.storage_path = storage.objects.name
        AND an.correspondente_id = public.correspondente_do_usuario(auth.uid())
    )
  );

-- 5) Storage bucket 'demanda-anexos': escopo por acesso à demanda (pasta = demanda_id)
DROP POLICY IF EXISTS "demanda_anexos_select" ON storage.objects;
DROP POLICY IF EXISTS "demanda_anexos_insert" ON storage.objects;
DROP POLICY IF EXISTS "demanda_anexos_delete" ON storage.objects;

CREATE POLICY "demanda_anexos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'demanda-anexos'
    AND public.usuario_tem_acesso_demanda(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
CREATE POLICY "demanda_anexos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'demanda-anexos'
    AND public.usuario_tem_acesso_demanda(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
CREATE POLICY "demanda_anexos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'demanda-anexos'
    AND public.usuario_tem_acesso_demanda(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

-- 6) Storage bucket 'tarefa-anexos': escopo por acesso à tarefa (pasta = task_id)
DROP POLICY IF EXISTS "tarefa_anexos_select" ON storage.objects;
DROP POLICY IF EXISTS "tarefa_anexos_insert" ON storage.objects;
DROP POLICY IF EXISTS "tarefa_anexos_delete" ON storage.objects;

CREATE POLICY "tarefa_anexos_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'tarefa-anexos'
    AND public.usuario_tem_acesso_tarefa(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
CREATE POLICY "tarefa_anexos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'tarefa-anexos'
    AND public.usuario_tem_acesso_tarefa(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
CREATE POLICY "tarefa_anexos_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'tarefa-anexos'
    AND public.usuario_tem_acesso_tarefa(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

-- 7) Storage bucket 'formularios-bancarios': leitura autenticado; escrita só gestão
DROP POLICY IF EXISTS "Autenticados leem arquivos formularios" ON storage.objects;
DROP POLICY IF EXISTS "Autenticados enviam arquivos formularios" ON storage.objects;
DROP POLICY IF EXISTS "Autenticados atualizam arquivos formularios" ON storage.objects;
DROP POLICY IF EXISTS "Autenticados excluem arquivos formularios" ON storage.objects;

CREATE POLICY "Formularios storage: leitura autenticado" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'formularios-bancarios' AND auth.uid() IS NOT NULL);
CREATE POLICY "Formularios storage: gestao envia" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'formularios-bancarios' AND public.usuario_pode_admin(auth.uid()));
CREATE POLICY "Formularios storage: gestao atualiza" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'formularios-bancarios' AND public.usuario_pode_admin(auth.uid()))
  WITH CHECK (bucket_id = 'formularios-bancarios' AND public.usuario_pode_admin(auth.uid()));
CREATE POLICY "Formularios storage: gestao exclui" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'formularios-bancarios' AND public.usuario_pode_admin(auth.uid()));
