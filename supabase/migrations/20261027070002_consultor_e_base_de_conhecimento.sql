-- Consultor IA (C18) e Base de conhecimento (C19/C20) — frente a7, pedido de 26/10/2026.
--
-- 1. Base de conhecimento vira acervo de ARTIGOS: rascunho/publicado, resumo, capa, anexos,
--    versões (cada alteração guarda a anterior em consultor_ia_base_versoes, por gatilho) e o
--    vínculo com a Agilliza News (o post publicado a partir do artigo). Rascunho não alimenta
--    o Consultor e só aparece para quem administra a base.
-- 2. Categorias da base em tabela (globais + da conta), no lugar da lista fixa no código.
-- 3. Parâmetros de cálculo do Consultor por conta (ITBI padrão e por município, cartório,
--    avaliação, certidões, limite de comprometimento, taxa de referência): as contas do
--    Consultor saem calculadas com estes números, nunca fixos no código.
-- 4. Mensagens do Consultor guardam os cálculos feitos e o aviso de "dado atual".
-- 5. Armazenamento: imagens dos artigos e dos posts da News (bucket público, só imagem,
--    nomes impossíveis de adivinhar — precisam abrir no Agilliza Tech) e anexos (bucket
--    privado, por conta).

-- ───────────── 1. Artigos ─────────────
alter table public.consultor_ia_base
  add column if not exists status text not null default 'publicado',
  add column if not exists resumo text,
  add column if not exists capa_url text,
  add column if not exists anexos jsonb not null default '[]'::jsonb,
  add column if not exists versao integer not null default 1,
  add column if not exists publicado_em timestamptz,
  add column if not exists news_post_id uuid,
  add column if not exists news_publicado_em timestamptz,
  add column if not exists news_publico text,
  add column if not exists news_fim_em timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'consultor_ia_base_status_valido') then
    alter table public.consultor_ia_base
      add constraint consultor_ia_base_status_valido check (status in ('rascunho', 'publicado')),
      add constraint consultor_ia_base_capa_https check (capa_url is null or capa_url ~ '^https://'),
      add constraint consultor_ia_base_resumo_tamanho check (resumo is null or length(resumo) <= 400),
      add constraint consultor_ia_base_anexos_lista check (jsonb_typeof(anexos) = 'array');
  end if;
end $$;

update public.consultor_ia_base set publicado_em = coalesce(publicado_em, updated_at) where status = 'publicado';

-- Rascunho só para quem administra a base (antes, qualquer pessoa da conta lia tudo).
drop policy if exists base_select_interno on public.consultor_ia_base;
create policy base_select_interno on public.consultor_ia_base
  for select to authenticated
  using (
    (correspondente_id is null or correspondente_id = public.correspondente_do_usuario((select auth.uid())))
    and (
      status = 'publicado'
      or public.usuario_tem_permissao((select auth.uid()), 'admin.parametros', 'view')
    )
  );

create table if not exists public.consultor_ia_base_versoes (
  id uuid primary key default gen_random_uuid(),
  artigo_id uuid not null references public.consultor_ia_base(id) on delete cascade,
  versao integer not null,
  titulo text not null,
  conteudo text not null,
  resumo text,
  categoria text not null,
  tags text[] not null default '{}',
  status text not null,
  editado_por uuid,
  created_at timestamptz not null default now(),
  unique (artigo_id, versao)
);
create index if not exists idx_consultor_versoes_artigo on public.consultor_ia_base_versoes (artigo_id, versao desc);

alter table public.consultor_ia_base_versoes enable row level security;
revoke all on public.consultor_ia_base_versoes from anon, authenticated;
grant select on public.consultor_ia_base_versoes to authenticated;
grant all on public.consultor_ia_base_versoes to service_role;

-- Ler o histórico: quem administra a base, do artigo da própria conta (ou global).
drop policy if exists versoes_select on public.consultor_ia_base_versoes;
create policy versoes_select on public.consultor_ia_base_versoes
  for select to authenticated
  using (
    public.usuario_tem_permissao((select auth.uid()), 'admin.parametros', 'view')
    and exists (
      select 1 from public.consultor_ia_base b
       where b.id = artigo_id
         and (b.correspondente_id is null or b.correspondente_id = public.correspondente_do_usuario((select auth.uid())))
    )
  );

-- Cada alteração de conteúdo guarda a versão anterior (ninguém escreve no histórico à mão).
create or replace function public.consultor_ia_base_versionar()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (old.titulo, old.conteudo, coalesce(old.resumo, ''), old.categoria, old.tags, old.status)
     is distinct from (new.titulo, new.conteudo, coalesce(new.resumo, ''), new.categoria, new.tags, new.status) then
    insert into public.consultor_ia_base_versoes
      (artigo_id, versao, titulo, conteudo, resumo, categoria, tags, status, editado_por)
    values (old.id, old.versao, old.titulo, old.conteudo, old.resumo, old.categoria, old.tags, old.status,
            coalesce(old.atualizado_por, old.criado_por))
    on conflict (artigo_id, versao) do nothing;
    new.versao := old.versao + 1;
  end if;
  if new.status = 'publicado' and (old.status is distinct from 'publicado' or new.publicado_em is null) then
    new.publicado_em := now();
  end if;
  new.updated_at := now();
  return new;
end $$;

revoke execute on function public.consultor_ia_base_versionar() from public, anon;

drop trigger if exists trg_consultor_ia_base_versionar on public.consultor_ia_base;
create trigger trg_consultor_ia_base_versionar before update on public.consultor_ia_base
  for each row execute function public.consultor_ia_base_versionar();

create or replace function public.consultor_ia_base_publicado_em()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status = 'publicado' and new.publicado_em is null then new.publicado_em := now(); end if;
  return new;
end $$;

drop trigger if exists trg_consultor_ia_base_publicado_em on public.consultor_ia_base;
create trigger trg_consultor_ia_base_publicado_em before insert on public.consultor_ia_base
  for each row execute function public.consultor_ia_base_publicado_em();

-- O Consultor só usa artigo PUBLICADO e ativo (gerada da definição de 20261021090500).
create or replace function public.consultor_ia_trechos(_pergunta text, _limite integer default 20)
returns table (id uuid, categoria text, titulo text, conteudo text, tags text[])
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with q as (
    select nullif(
             replace(plainto_tsquery('portuguese', public.sem_acento(coalesce(_pergunta, '')))::text, ' & ', ' | '),
             ''
           )::tsquery as tsq
  )
  select b.id, b.categoria, b.titulo, b.conteudo, b.tags
    from public.consultor_ia_base b, q
   where q.tsq is not null
     and b.ativo
     and b.status = 'publicado'
     and (
       b.correspondente_id is null
       or b.correspondente_id = public.correspondente_do_usuario(auth.uid())
     )
     and to_tsvector('portuguese', public.sem_acento(coalesce(b.titulo, '') || ' ' || coalesce(b.conteudo, ''))) @@ q.tsq
   order by ts_rank_cd(
              to_tsvector('portuguese', public.sem_acento(coalesce(b.titulo, '') || ' ' || coalesce(b.conteudo, ''))),
              q.tsq
            ) desc,
            b.updated_at desc
   limit least(greatest(coalesce(_limite, 20), 1), 50);
$$;

revoke execute on function public.consultor_ia_trechos(text, integer) from public, anon;
grant execute on function public.consultor_ia_trechos(text, integer) to authenticated, service_role;

-- ───────────── 2. Categorias ─────────────
create table if not exists public.consultor_ia_categorias (
  id uuid primary key default gen_random_uuid(),
  correspondente_id uuid,
  nome text not null check (length(btrim(nome)) between 2 and 60),
  ordem integer not null default 100,
  created_at timestamptz not null default now()
);
create unique index if not exists consultor_ia_categorias_nome
  on public.consultor_ia_categorias (coalesce(correspondente_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(nome));

alter table public.consultor_ia_categorias enable row level security;
revoke all on public.consultor_ia_categorias from anon;
grant select, insert, update, delete on public.consultor_ia_categorias to authenticated;
grant all on public.consultor_ia_categorias to service_role;

drop policy if exists categorias_select on public.consultor_ia_categorias;
create policy categorias_select on public.consultor_ia_categorias
  for select to authenticated
  using (correspondente_id is null or correspondente_id = public.correspondente_do_usuario((select auth.uid())));

drop policy if exists categorias_escrita on public.consultor_ia_categorias;
create policy categorias_escrita on public.consultor_ia_categorias
  for all to authenticated
  using (
    (correspondente_id is null and public.pode_editar_base_global((select auth.uid())))
    or (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
        and public.usuario_tem_permissao((select auth.uid()), 'admin.parametros', 'edit'))
  )
  with check (
    (correspondente_id is null and public.pode_editar_base_global((select auth.uid())))
    or (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
        and public.usuario_tem_permissao((select auth.uid()), 'admin.parametros', 'edit'))
  );

insert into public.consultor_ia_categorias (correspondente_id, nome, ordem)
select null, c.nome, c.ordem
  from (values ('FGTS', 10), ('SFH_SFI', 20), ('Documentacao', 30), ('Regulatorio', 40), ('Bradesco', 50),
               ('Santander', 60), ('Itau', 70), ('Duvidas_Frequentes', 80)) as c(nome, ordem)
 where not exists (select 1 from public.consultor_ia_categorias x where x.correspondente_id is null and lower(x.nome) = lower(c.nome));

-- ───────────── 3. Parâmetros de cálculo do Consultor ─────────────
create table if not exists public.consultor_ia_parametros (
  correspondente_id uuid primary key,
  itbi_percentual numeric(6, 3) not null default 3.000 check (itbi_percentual between 0 and 10),
  itbi_municipios jsonb not null default '[]'::jsonb check (jsonb_typeof(itbi_municipios) = 'array'),
  cartorio_percentual numeric(6, 3) not null default 1.500 check (cartorio_percentual between 0 and 10),
  avaliacao_banco numeric(12, 2) not null default 3100.00 check (avaliacao_banco between 0 and 100000),
  certidoes_valor numeric(12, 2) not null default 500.00 check (certidoes_valor between 0 and 100000),
  comprometimento_max_percentual numeric(5, 2) not null default 30.00 check (comprometimento_max_percentual between 1 and 100),
  taxa_referencia_anual numeric(6, 3) check (taxa_referencia_anual is null or taxa_referencia_anual between 0 and 60),
  atualizado_por uuid,
  atualizado_em timestamptz not null default now()
);

alter table public.consultor_ia_parametros enable row level security;
revoke all on public.consultor_ia_parametros from anon;
grant select, insert, update on public.consultor_ia_parametros to authenticated;
grant all on public.consultor_ia_parametros to service_role;

drop policy if exists parametros_select on public.consultor_ia_parametros;
create policy parametros_select on public.consultor_ia_parametros
  for select to authenticated
  using (
    correspondente_id = public.correspondente_do_usuario((select auth.uid()))
    and (
      public.usuario_tem_permissao((select auth.uid()), 'crm.clientes', 'view')
      or public.usuario_tem_permissao((select auth.uid()), 'admin.parametros', 'view')
    )
  );

drop policy if exists parametros_escrita on public.consultor_ia_parametros;
create policy parametros_escrita on public.consultor_ia_parametros
  for all to authenticated
  using (
    correspondente_id = public.correspondente_do_usuario((select auth.uid()))
    and public.usuario_tem_permissao((select auth.uid()), 'admin.parametros', 'edit')
  )
  with check (
    correspondente_id = public.correspondente_do_usuario((select auth.uid()))
    and public.usuario_tem_permissao((select auth.uid()), 'admin.parametros', 'edit')
  );

/**
 * Os parâmetros da conta de quem pergunta (cria a linha com os padrões da tabela na
 * primeira vez — os valores padrão moram nos DEFAULTs acima, não no código).
 */
create or replace function public.consultor_ia_parametros_da_conta()
returns public.consultor_ia_parametros
language plpgsql
security definer
set search_path = public
as $$
declare
  corr uuid := public.correspondente_do_usuario(auth.uid());
  r public.consultor_ia_parametros;
begin
  if corr is null then
    raise exception 'Conta não identificada.' using errcode = '42501';
  end if;
  if not (public.usuario_tem_permissao(auth.uid(), 'crm.clientes', 'view')
          or public.usuario_tem_permissao(auth.uid(), 'admin.parametros', 'view')) then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  insert into public.consultor_ia_parametros (correspondente_id) values (corr) on conflict (correspondente_id) do nothing;
  select * into r from public.consultor_ia_parametros where correspondente_id = corr;
  return r;
end $$;

revoke execute on function public.consultor_ia_parametros_da_conta() from public, anon;
grant execute on function public.consultor_ia_parametros_da_conta() to authenticated, service_role;

-- ───────────── 4. Mensagens com cálculos ─────────────
alter table public.consultor_ia_mensagens
  add column if not exists calculos jsonb not null default '[]'::jsonb,
  add column if not exists aviso_dado_atual boolean not null default false;

-- ───────────── 5. Armazenamento da base ─────────────
insert into storage.buckets (id, name, public)
values ('conhecimento-imagens', 'conhecimento-imagens', true), ('conhecimento-anexos', 'conhecimento-anexos', false)
on conflict (id) do nothing;

drop policy if exists conhecimento_imagens_insert on storage.objects;
create policy conhecimento_imagens_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'conhecimento-imagens'
    and (storage.foldername(name))[1] = public.correspondente_do_usuario((select auth.uid()))::text
    and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp', 'gif')
    and (
      public.usuario_tem_permissao((select auth.uid()), 'admin.parametros', 'edit')
      or public.usuario_tem_permissao((select auth.uid()), 'saas.news', 'edit')
    )
  );

drop policy if exists conhecimento_imagens_delete on storage.objects;
create policy conhecimento_imagens_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'conhecimento-imagens'
    and (storage.foldername(name))[1] = public.correspondente_do_usuario((select auth.uid()))::text
    and (
      public.usuario_tem_permissao((select auth.uid()), 'admin.parametros', 'edit')
      or public.usuario_tem_permissao((select auth.uid()), 'saas.news', 'edit')
    )
  );

drop policy if exists conhecimento_anexos_select on storage.objects;
create policy conhecimento_anexos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'conhecimento-anexos'
    and (storage.foldername(name))[1] = public.correspondente_do_usuario((select auth.uid()))::text
    and (
      public.usuario_tem_permissao((select auth.uid()), 'admin.parametros', 'view')
      or public.usuario_tem_permissao((select auth.uid()), 'crm.clientes', 'view')
    )
  );

drop policy if exists conhecimento_anexos_insert on storage.objects;
create policy conhecimento_anexos_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'conhecimento-anexos'
    and (storage.foldername(name))[1] = public.correspondente_do_usuario((select auth.uid()))::text
    and lower(storage.extension(name)) in ('pdf', 'docx', 'xlsx', 'pptx', 'jpg', 'jpeg', 'png', 'txt', 'csv')
    and public.usuario_tem_permissao((select auth.uid()), 'admin.parametros', 'edit')
  );

drop policy if exists conhecimento_anexos_delete on storage.objects;
create policy conhecimento_anexos_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'conhecimento-anexos'
    and (storage.foldername(name))[1] = public.correspondente_do_usuario((select auth.uid()))::text
    and public.usuario_tem_permissao((select auth.uid()), 'admin.parametros', 'edit')
  );
