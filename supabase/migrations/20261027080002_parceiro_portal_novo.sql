-- Parceiro do portal antigo convertido em vinculado do Agilliza Tech (C70, frente a8).
--
-- O vínculo de verdade mora no Agilliza Tech (plataforma.vinculados_agilliza, 0343). Esta
-- tabela é só o aviso do portal antigo: quando o correspondente converte o parceiro, o
-- servidor grava aqui (service_role) e o parceiro, ao entrar no portal antigo, vê que o
-- acesso novo dele já foi criado. Quem ainda não foi convertido vê o convite genérico.

create table if not exists public.parceiro_portal_novo (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  tenant_id uuid not null,
  convertido_em timestamptz not null default now(),
  convertido_por uuid references public.profiles (id) on delete set null
);

comment on table public.parceiro_portal_novo is
  'Parceiro do portal antigo que já tem a conta vinculada no Agilliza Tech (aviso do portal antigo). Escrita só pelo servidor.';

alter table public.parceiro_portal_novo enable row level security;
revoke all on public.parceiro_portal_novo from anon;
revoke insert, update, delete on public.parceiro_portal_novo from authenticated;
grant select on public.parceiro_portal_novo to authenticated;

drop policy if exists parceiro_portal_novo_leitura on public.parceiro_portal_novo;
create policy parceiro_portal_novo_leitura on public.parceiro_portal_novo
  for select to authenticated
  using (
    profile_id = (select auth.uid())
    or public.usuario_tem_permissao((select auth.uid()), 'saas.licencas', 'view')
  );
