-- Documento enviado à HomeFin, POR PROPOSTA.
--
-- A situação do envio ficava em `cliente_documentos.situacao_integracao`, que
-- é do cliente: com duas propostas (oportunidades diferentes, em bancos
-- diferentes) o mesmo arquivo aparecia "enviado" nas duas depois de ir a uma
-- só, e não havia onde guardar o `idArquivo` devolvido pelo upload.
--
-- Uma linha por documento do CRM × vaga do checklist da oportunidade. A
-- situação é atualizada no envio e a cada sincronização da proposta
-- (`GET /oportunidade/{id}/documentos`): análise da HomeFin, integração com o
-- banco e arquivo removido lá.

create table if not exists public.proposta_documentos_homefin (
  id uuid primary key default gen_random_uuid(),
  proposta_id uuid not null references public.propostas(id) on delete cascade,
  cliente_documento_id uuid not null references public.cliente_documentos(id) on delete cascade,
  homefin_id_oportunidade text not null,
  homefin_id_documento text not null,
  homefin_id_arquivo text,
  nome_vaga text,
  dono_vaga text,
  tipo_vaga text,
  situacao text not null default 'homefin'
    check (situacao in ('enviado', 'homefin', 'erro')),
  mensagem text,
  enviado_por uuid,
  enviado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (proposta_id, cliente_documento_id, homefin_id_documento)
);

create index if not exists idx_proposta_documentos_homefin_proposta
  on public.proposta_documentos_homefin (proposta_id);
create index if not exists idx_proposta_documentos_homefin_documento
  on public.proposta_documentos_homefin (cliente_documento_id);

alter table public.proposta_documentos_homefin enable row level security;

drop policy if exists "Documentos HomeFin por acesso à proposta" on public.proposta_documentos_homefin;
create policy "Documentos HomeFin por acesso à proposta"
  on public.proposta_documentos_homefin
  for all
  to authenticated
  using (public.usuario_tem_acesso_proposta((select auth.uid()), proposta_id))
  with check (public.usuario_tem_acesso_proposta((select auth.uid()), proposta_id));
