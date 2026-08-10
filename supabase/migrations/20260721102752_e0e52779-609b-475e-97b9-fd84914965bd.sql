-- Fecha exposição via PostgREST /rpc destas funções SECURITY DEFINER de RH.
-- Todas são gatilhos (triggers) ou utilitárias — nenhuma é chamada via supabase.rpc().
-- Triggers continuam disparando: execução de trigger não depende de EXECUTE.

REVOKE EXECUTE ON FUNCTION public.rh_aplicar_alteracao_salarial() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rh_atualizar_status_experiencia() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rh_documento_sync_checklist() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rh_funcionario_after_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rh_funcionario_log_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rh_semear_checklist_clt(_func_id uuid) FROM PUBLIC, anon, authenticated;
