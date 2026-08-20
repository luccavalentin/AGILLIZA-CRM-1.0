
-- ============================================================
-- OTIMIZAÇÃO DE PERFORMANCE — mudanças NÃO destrutivas
-- 1) Índices nas FKs sem cobertura (47)
-- 2) Reescrita de políticas RLS: envolve auth.uid()/jwt()/role()
--    em (select ...) para avaliação única por query.
--    Preserva cmd, roles e a expressão original.
-- ============================================================

-- ---------- PARTE 1: índices em FKs sem cobertura ----------
CREATE INDEX IF NOT EXISTS idx_arquivos_nos_parent_id ON public.arquivos_nos (parent_id);
CREATE INDEX IF NOT EXISTS idx_chat_etiqueta_vinculos_aplicado_por ON public.chat_etiqueta_vinculos (aplicado_por);
CREATE INDEX IF NOT EXISTS idx_cliente_app_acessos_cliente_id ON public.cliente_app_acessos (cliente_id);
CREATE INDEX IF NOT EXISTS idx_cliente_app_mensagens_proposta_id ON public.cliente_app_mensagens (proposta_id);
CREATE INDEX IF NOT EXISTS idx_cliente_documento_pastas_criado_por ON public.cliente_documento_pastas (criado_por);
CREATE INDEX IF NOT EXISTS idx_cliente_documentos_aprovado_por ON public.cliente_documentos (aprovado_por);
CREATE INDEX IF NOT EXISTS idx_cliente_documentos_enviado_por ON public.cliente_documentos (enviado_por);
CREATE INDEX IF NOT EXISTS idx_cliente_documentos_pasta_id ON public.cliente_documentos (pasta_id);
CREATE INDEX IF NOT EXISTS idx_cliente_interacoes_responsavel_id ON public.cliente_interacoes (responsavel_id);
CREATE INDEX IF NOT EXISTS idx_cliente_pipeline_historico_stage_id ON public.cliente_pipeline_historico (stage_id);
CREATE INDEX IF NOT EXISTS idx_clientes_criador_id ON public.clientes (criador_id);
CREATE INDEX IF NOT EXISTS idx_comissoes_regra_id ON public.comissoes (regra_id);
CREATE INDEX IF NOT EXISTS idx_comissoes_usuario_payable_id ON public.comissoes_usuario (payable_id);
CREATE INDEX IF NOT EXISTS idx_comissoes_usuario_regra_id ON public.comissoes_usuario (regra_id);
CREATE INDEX IF NOT EXISTS idx_crm_chat_cliente_etiquetas_etiqueta_id ON public.crm_chat_cliente_etiquetas (etiqueta_id);
CREATE INDEX IF NOT EXISTS idx_demanda_anexos_demanda_id ON public.demanda_anexos (demanda_id);
CREATE INDEX IF NOT EXISTS idx_demanda_historico_demanda_id ON public.demanda_historico (demanda_id);
CREATE INDEX IF NOT EXISTS idx_dm_conversas_criador_id ON public.dm_conversas (criador_id);
CREATE INDEX IF NOT EXISTS idx_dm_mensagens_autor_id ON public.dm_mensagens (autor_id);
CREATE INDEX IF NOT EXISTS idx_financial_payables_categoria_id ON public.financial_payables (categoria_id);
CREATE INDEX IF NOT EXISTS idx_financial_payables_cost_center_id ON public.financial_payables (cost_center_id);
CREATE INDEX IF NOT EXISTS idx_financial_payables_payment_method_id ON public.financial_payables (payment_method_id);
CREATE INDEX IF NOT EXISTS idx_financial_receivables_categoria_id ON public.financial_receivables (categoria_id);
CREATE INDEX IF NOT EXISTS idx_financial_receivables_cost_center_id ON public.financial_receivables (cost_center_id);
CREATE INDEX IF NOT EXISTS idx_financial_receivables_payment_method_id ON public.financial_receivables (payment_method_id);
CREATE INDEX IF NOT EXISTS idx_parceiro_detalhes_imobiliaria_id ON public.parceiro_detalhes (imobiliaria_id);
CREATE INDEX IF NOT EXISTS idx_profiles_nivel_acesso_id ON public.profiles (nivel_acesso_id);
CREATE INDEX IF NOT EXISTS idx_proposta_bancos_simulacao_banco_id ON public.proposta_bancos (simulacao_banco_id);
CREATE INDEX IF NOT EXISTS idx_proposta_logs_homefin_proposta_id ON public.proposta_logs_homefin (proposta_id);
CREATE INDEX IF NOT EXISTS idx_proposta_pdfs_proposta_id ON public.proposta_pdfs (proposta_id);
CREATE INDEX IF NOT EXISTS idx_propostas_deleted_by ON public.propostas (deleted_by);
CREATE INDEX IF NOT EXISTS idx_purchase_requests_payable_id ON public.purchase_requests (payable_id);
CREATE INDEX IF NOT EXISTS idx_rh_documentos_checklist_documento_id ON public.rh_documentos_checklist (documento_id);
CREATE INDEX IF NOT EXISTS idx_rh_folha_itens_funcionario_id ON public.rh_folha_itens (funcionario_id);
CREATE INDEX IF NOT EXISTS idx_rh_funcionario_beneficios_tipo_id ON public.rh_funcionario_beneficios (tipo_id);
CREATE INDEX IF NOT EXISTS idx_rh_funcionarios_cargo_id ON public.rh_funcionarios (cargo_id);
CREATE INDEX IF NOT EXISTS idx_rh_holerites_competencia_id ON public.rh_holerites (competencia_id);
CREATE INDEX IF NOT EXISTS idx_scan_ia_campos_extraidos_leitura_id ON public.scan_ia_campos_extraidos (leitura_id);
CREATE INDEX IF NOT EXISTS idx_scan_ia_leituras_cliente_id ON public.scan_ia_leituras (cliente_id);
CREATE INDEX IF NOT EXISTS idx_scan_ia_leituras_proposta_id ON public.scan_ia_leituras (proposta_id);
CREATE INDEX IF NOT EXISTS idx_simulacao_bancos_banco_id ON public.simulacao_bancos (banco_id);
CREATE INDEX IF NOT EXISTS idx_simulacoes_deleted_by ON public.simulacoes (deleted_by);
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON public.task_attachments (task_id);
CREATE INDEX IF NOT EXISTS idx_task_checklist_items_task_id ON public.task_checklist_items (task_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON public.task_comments (task_id);
CREATE INDEX IF NOT EXISTS idx_task_history_task_id ON public.task_history (task_id);
CREATE INDEX IF NOT EXISTS idx_task_tag_links_tag_id ON public.task_tag_links (tag_id);


-- ---------- PARTE 2: reescrita de políticas RLS ----------
-- Recria cada policy que chama auth.uid()/jwt()/role() diretamente,
-- envolvendo cada chamada em (select ...). Preserva cmd, roles e a
-- expressão restante exatamente como estão.
DO $mig$
DECLARE
  r RECORD;
  novo_qual TEXT;
  novo_check TEXT;
  cmd_kw TEXT;
  roles_list TEXT;
  sql_drop TEXT;
  sql_create TEXT;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, cmd, roles, qual, with_check, permissive
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        (qual ~* '(^|[^.\w])auth\.(uid|jwt|role)\s*\(' AND qual !~* 'select\s+auth\.(uid|jwt|role)')
        OR (with_check ~* '(^|[^.\w])auth\.(uid|jwt|role)\s*\(' AND with_check !~* 'select\s+auth\.(uid|jwt|role)')
      )
  LOOP
    -- Regex replace: envolve chamadas nuas em (select ...).
    -- Só substitui quando NÃO estiver precedida por "select " ou "select".
    novo_qual := r.qual;
    novo_check := r.with_check;

    IF novo_qual IS NOT NULL THEN
      novo_qual := regexp_replace(novo_qual, '(?<!select\s)\mauth\.uid\s*\(\s*\)', '(select auth.uid())', 'gi');
      novo_qual := regexp_replace(novo_qual, '(?<!select\s)\mauth\.jwt\s*\(\s*\)', '(select auth.jwt())', 'gi');
      novo_qual := regexp_replace(novo_qual, '(?<!select\s)\mauth\.role\s*\(\s*\)', '(select auth.role())', 'gi');
    END IF;

    IF novo_check IS NOT NULL THEN
      novo_check := regexp_replace(novo_check, '(?<!select\s)\mauth\.uid\s*\(\s*\)', '(select auth.uid())', 'gi');
      novo_check := regexp_replace(novo_check, '(?<!select\s)\mauth\.jwt\s*\(\s*\)', '(select auth.jwt())', 'gi');
      novo_check := regexp_replace(novo_check, '(?<!select\s)\mauth\.role\s*\(\s*\)', '(select auth.role())', 'gi');
    END IF;

    cmd_kw := CASE r.cmd
      WHEN 'ALL'    THEN 'ALL'
      WHEN 'SELECT' THEN 'SELECT'
      WHEN 'INSERT' THEN 'INSERT'
      WHEN 'UPDATE' THEN 'UPDATE'
      WHEN 'DELETE' THEN 'DELETE'
    END;

    -- roles vem como text[]; monta lista qualificada (public/authenticated/anon/...)
    SELECT string_agg(quote_ident(x), ', ') INTO roles_list
    FROM unnest(r.roles) AS x;

    sql_drop := format(
      'DROP POLICY %I ON %I.%I;',
      r.policyname, r.schemaname, r.tablename
    );

    sql_create := format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s',
      r.policyname, r.schemaname, r.tablename,
      CASE WHEN r.permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
      cmd_kw,
      COALESCE(roles_list, 'public')
    );

    IF novo_qual IS NOT NULL THEN
      sql_create := sql_create || ' USING (' || novo_qual || ')';
    END IF;
    IF novo_check IS NOT NULL THEN
      sql_create := sql_create || ' WITH CHECK (' || novo_check || ')';
    END IF;

    EXECUTE sql_drop;
    EXECUTE sql_create;
  END LOOP;
END
$mig$;
