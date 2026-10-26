-- Scan IA (C17, frente a7 — pedido de 26/10/2026): vários documentos de uma vez e regras
-- determinísticas sobre o que a IA leu.
--
-- 1. scan_ia_lotes: um envio com vários documentos do MESMO cliente (RG, renda,
--    residência, certidão, matrícula…). A conferência junta os campos de todos e cria o
--    cliente ou completa um existente de uma vez. Isolado por correspondente e pela matriz
--    de permissões (crm.scan_ia, com crm.clientes como equivalente, igual ao bucket).
-- 2. scan_ia_leituras.lote_id: a leitura pode pertencer a um lote.
-- 3. scan_ia_campos_extraidos.valido / motivo_validacao: resultado das regras (CPF com
--    dígito, data real, UF, órgão emissor, CEP…). O valor reprovado continua lá, marcado,
--    para o operador decidir.

create table if not exists public.scan_ia_lotes (
  id uuid primary key default gen_random_uuid(),
  correspondente_id uuid not null,
  criador_id uuid,
  cliente_id uuid references public.clientes(id) on delete set null,
  status text not null default 'aberto' check (status in ('aberto', 'aplicado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_scan_ia_lotes_corr on public.scan_ia_lotes (correspondente_id, created_at desc);

alter table public.scan_ia_lotes enable row level security;
revoke all on public.scan_ia_lotes from anon;
grant select, insert, update, delete on public.scan_ia_lotes to authenticated;
grant all on public.scan_ia_lotes to service_role;

drop policy if exists scan_ia_lotes_select on public.scan_ia_lotes;
create policy scan_ia_lotes_select on public.scan_ia_lotes
  for select to authenticated
  using (
    correspondente_id = public.correspondente_do_usuario((select auth.uid()))
    and (
      public.usuario_tem_permissao((select auth.uid()), 'crm.scan_ia', 'view')
      or public.usuario_tem_permissao((select auth.uid()), 'crm.clientes', 'view')
    )
  );

drop policy if exists scan_ia_lotes_escrita on public.scan_ia_lotes;
create policy scan_ia_lotes_escrita on public.scan_ia_lotes
  for all to authenticated
  using (
    correspondente_id = public.correspondente_do_usuario((select auth.uid()))
    and (
      public.usuario_tem_permissao((select auth.uid()), 'crm.scan_ia', 'create')
      or public.usuario_tem_permissao((select auth.uid()), 'crm.clientes', 'create')
      or public.usuario_tem_permissao((select auth.uid()), 'crm.clientes', 'edit')
    )
  )
  with check (
    correspondente_id = public.correspondente_do_usuario((select auth.uid()))
    and (
      public.usuario_tem_permissao((select auth.uid()), 'crm.scan_ia', 'create')
      or public.usuario_tem_permissao((select auth.uid()), 'crm.clientes', 'create')
      or public.usuario_tem_permissao((select auth.uid()), 'crm.clientes', 'edit')
    )
  );

drop trigger if exists trg_scan_ia_lotes_updated on public.scan_ia_lotes;
create trigger trg_scan_ia_lotes_updated before update on public.scan_ia_lotes
  for each row execute function public.update_updated_at_column();

alter table public.scan_ia_leituras
  add column if not exists lote_id uuid references public.scan_ia_lotes(id) on delete set null;
create index if not exists idx_scan_ia_leituras_lote on public.scan_ia_leituras (lote_id) where lote_id is not null;

-- A leitura só entra num lote do MESMO correspondente (lote de outra conta não é aceito
-- nem por quem acerta o id).
create or replace function public.scan_ia_leitura_lote_mesma_conta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.lote_id is not null and not exists (
    select 1 from public.scan_ia_lotes l
     where l.id = new.lote_id and l.correspondente_id = new.correspondente_id
  ) then
    raise exception 'Lote do Scan IA não encontrado.' using errcode = '23503';
  end if;
  return new;
end $$;

revoke execute on function public.scan_ia_leitura_lote_mesma_conta() from public, anon;

drop trigger if exists trg_scan_ia_leitura_lote on public.scan_ia_leituras;
create trigger trg_scan_ia_leitura_lote before insert or update of lote_id, correspondente_id
  on public.scan_ia_leituras for each row execute function public.scan_ia_leitura_lote_mesma_conta();

alter table public.scan_ia_campos_extraidos
  add column if not exists valido boolean,
  add column if not exists motivo_validacao text;
