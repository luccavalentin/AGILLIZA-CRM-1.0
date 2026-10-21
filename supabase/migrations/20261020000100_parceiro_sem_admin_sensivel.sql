-- Parceiro (corretor/imobiliária do Portal do Parceiro) nunca administra o sistema.
--
-- O nível "Imobiliária Parceira" estava com admin.backup Ver/Gerar, escopo "todos":
-- o parceiro baixava o backup com nome, e-mail, telefone e documento de toda a
-- equipe interna. Duas camadas:
--   1. dados: desliga os módulos sensíveis de administração em todo nível de parceiro;
--   2. regra: usuario_tem_permissao nega esses módulos a perfil de parceiro, mesmo
--      que alguém volte a marcar na matriz.
-- Pedidos de compra e preferências de notificação (escopo "próprios") seguem como
-- configurados.

update public.permissions pm
   set permitido = false
  from public.access_levels al
 where al.id = pm.nivel_acesso_id
   and al.acesso_tipo = 'portal_parceiro'
   and pm.modulo in ('admin.backup', 'admin.auditoria', 'admin.pessoas', 'admin.regras',
                     'admin.parametros', 'admin.integracoes', 'admin.sla', 'admin.comissoes')
   and pm.permitido;

CREATE OR REPLACE FUNCTION public.usuario_tem_permissao(_user_id uuid, _modulo text, _acao text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    CASE
      WHEN public.has_any_role(_user_id, ARRAY['admin','correspondente']::public.app_role[]) THEN true
      -- Parceiro nunca administra: backup, auditoria, pessoas, permissões, parâmetros…
      WHEN _modulo IN ('admin.backup', 'admin.auditoria', 'admin.pessoas', 'admin.regras',
                       'admin.parametros', 'admin.integracoes', 'admin.sla', 'admin.comissoes')
           AND EXISTS (SELECT 1 FROM public.profiles p
                        WHERE p.id = _user_id AND p.acesso_tipo = 'portal_parceiro') THEN false
      ELSE COALESCE((
        SELECT pm.permitido FROM public.profiles pr
        JOIN public.permissions pm ON pm.nivel_acesso_id = pr.nivel_acesso_id
        WHERE pr.id = _user_id AND pm.modulo = _modulo AND pm.acao = _acao
        LIMIT 1
      ), false)
    END;
$function$;
