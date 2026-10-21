-- Scan IA: o bucket passa a seguir a matriz de permissões.
--
-- As políticas de 20260704004251 só aceitavam admin/correspondente/gestor
-- (usuario_pode_admin): o analista via a tela do Scan IA, mas o envio do arquivo,
-- a leitura pela IA e a pré-visualização falhavam (QA 21/10/2026). Agora vale a
-- permissão do módulo crm.scan_ia, com crm.clientes como equivalente (é a regra
-- que a tela usava até aqui). O isolamento por correspondente continua: a primeira
-- pasta do caminho é sempre o correspondente do usuário.
--   - ver o arquivo:          crm.scan_ia ver,       ou crm.clientes ver;
--   - enviar/excluir arquivo: crm.scan_ia processar, ou crm.clientes criar/editar.
-- usuario_tem_permissao já aceita admin e correspondente.

drop policy if exists "scan_ia_objects_select" on storage.objects;
drop policy if exists "scan_ia_objects_insert" on storage.objects;
drop policy if exists "scan_ia_objects_delete" on storage.objects;

create policy "scan_ia_objects_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'scan-ia'
  and (storage.foldername(name))[1] = public.correspondente_do_usuario((select auth.uid()))::text
  and (
    public.usuario_pode_admin((select auth.uid()))
    or public.usuario_tem_permissao((select auth.uid()), 'crm.scan_ia', 'view')
    or public.usuario_tem_permissao((select auth.uid()), 'crm.clientes', 'view')
  )
);

create policy "scan_ia_objects_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'scan-ia'
  and (storage.foldername(name))[1] = public.correspondente_do_usuario((select auth.uid()))::text
  and (
    public.usuario_pode_admin((select auth.uid()))
    or public.usuario_tem_permissao((select auth.uid()), 'crm.scan_ia', 'create')
    or public.usuario_tem_permissao((select auth.uid()), 'crm.clientes', 'create')
    or public.usuario_tem_permissao((select auth.uid()), 'crm.clientes', 'edit')
  )
);

create policy "scan_ia_objects_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'scan-ia'
  and (storage.foldername(name))[1] = public.correspondente_do_usuario((select auth.uid()))::text
  and (
    public.usuario_pode_admin((select auth.uid()))
    or public.usuario_tem_permissao((select auth.uid()), 'crm.scan_ia', 'create')
    or public.usuario_tem_permissao((select auth.uid()), 'crm.clientes', 'create')
    or public.usuario_tem_permissao((select auth.uid()), 'crm.clientes', 'edit')
  )
);

-- A lista de leituras filtra por correspondente e ordena pela data (mais recentes primeiro).
create index if not exists idx_scan_ia_leituras_corr_criacao
  on public.scan_ia_leituras (correspondente_id, created_at desc);
