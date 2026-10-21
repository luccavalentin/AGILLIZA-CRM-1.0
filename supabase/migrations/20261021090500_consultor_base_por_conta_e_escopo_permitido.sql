-- Consultor IA (base de conhecimento) e escopo de dados.
--
-- 1. consultor_ia_base: as políticas de gravação só olhavam o papel
--    (admin/correspondente), sem conferir a conta. Quem tinha o papel criava,
--    editava e apagava verbetes de qualquer conta e os globais (sem conta, valem
--    para todas). Agora:
--      - verbete da conta: mesma conta + admin.parametros › edit (a mesma regra
--        da tela Base de Conhecimento);
--      - verbete global: só a administração da plataforma
--        (`pode_editar_base_global`).
--    O WITH CHECK do UPDATE impede mover um verbete para outra conta ou
--    transformar um verbete da conta em global (e vice-versa) sem ser plataforma.
-- 2. consultor_ia_sugestoes: quem tinha o papel lia e resolvia sugestões de
--    todas as contas. Passa a valer a conta + admin.parametros.
-- 3. consultor_ia_trechos: o Consultor carregava até 500 verbetes por pergunta e
--    ranqueava no servidor da aplicação. A função devolve só os mais relevantes
--    pela busca textual (índice GIN sem acento) e aplica a mesma regra de
--    leitura da política base_select_interno. É security definer porque, com
--    RLS, o planejador não usa o índice para `@@` antes da política.
-- 4. usuario_escopo_dados: devolvia o escopo da linha da matriz mesmo com a
--    permissão desligada (permitido = false). Quem não pode ver o módulo caía no
--    escopo "todos" configurado na linha e via a base inteira pela API. Agora só
--    linhas permitidas contam; sem nenhuma, o escopo é "próprios".

-- ───────────── 1. consultor_ia_base ─────────────
-- Administração da plataforma: no banco único, o esquema public guarda só as
-- contas do Agilliza (os assinantes ficam no Corretor), e a ponte trata
-- admin/correspondente como operadores da plataforma. Ponto único para apertar
-- a regra se o banco passar a ter outras contas de correspondente.
create or replace function public.pode_editar_base_global(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_any_role(_user_id, array['admin', 'correspondente']::public.app_role[]);
$$;

revoke execute on function public.pode_editar_base_global(uuid) from public, anon;
grant execute on function public.pode_editar_base_global(uuid) to authenticated, service_role;

drop policy if exists base_admin_insert on public.consultor_ia_base;
create policy base_admin_insert on public.consultor_ia_base
  for insert to authenticated
  with check (
    (correspondente_id is null and public.pode_editar_base_global((select auth.uid())))
    or (
      correspondente_id = public.correspondente_do_usuario((select auth.uid()))
      and public.usuario_tem_permissao((select auth.uid()), 'admin.parametros', 'edit')
    )
  );

drop policy if exists base_admin_update on public.consultor_ia_base;
create policy base_admin_update on public.consultor_ia_base
  for update to authenticated
  using (
    (correspondente_id is null and public.pode_editar_base_global((select auth.uid())))
    or (
      correspondente_id = public.correspondente_do_usuario((select auth.uid()))
      and public.usuario_tem_permissao((select auth.uid()), 'admin.parametros', 'edit')
    )
  )
  with check (
    (correspondente_id is null and public.pode_editar_base_global((select auth.uid())))
    or (
      correspondente_id = public.correspondente_do_usuario((select auth.uid()))
      and public.usuario_tem_permissao((select auth.uid()), 'admin.parametros', 'edit')
    )
  );

drop policy if exists base_admin_delete on public.consultor_ia_base;
create policy base_admin_delete on public.consultor_ia_base
  for delete to authenticated
  using (
    (correspondente_id is null and public.pode_editar_base_global((select auth.uid())))
    or (
      correspondente_id = public.correspondente_do_usuario((select auth.uid()))
      and public.usuario_tem_permissao((select auth.uid()), 'admin.parametros', 'edit')
    )
  );

-- ───────────── 2. consultor_ia_sugestoes ─────────────
drop policy if exists sugestoes_select on public.consultor_ia_sugestoes;
create policy sugestoes_select on public.consultor_ia_sugestoes
  for select to authenticated
  using (
    usuario_id = (select auth.uid())
    or (
      correspondente_id = public.correspondente_do_usuario((select auth.uid()))
      and public.usuario_tem_permissao((select auth.uid()), 'admin.parametros', 'view')
    )
  );

drop policy if exists sugestoes_admin_update on public.consultor_ia_sugestoes;
create policy sugestoes_admin_update on public.consultor_ia_sugestoes
  for update to authenticated
  using (
    correspondente_id = public.correspondente_do_usuario((select auth.uid()))
    and public.usuario_tem_permissao((select auth.uid()), 'admin.parametros', 'edit')
  )
  with check (
    correspondente_id = public.correspondente_do_usuario((select auth.uid()))
    and public.usuario_tem_permissao((select auth.uid()), 'admin.parametros', 'edit')
  );

-- ───────────── 3. consultor_ia_trechos ─────────────
-- Mesmo texto do índice antigo (consultor_ia_base_busca_idx), sem acento, para
-- "imovel" achar "imóvel". `sem_acento` é imutável (20261020140000).
create index if not exists consultor_ia_base_busca_sem_acento_idx
  on public.consultor_ia_base
  using gin (to_tsvector('portuguese', public.sem_acento(coalesce(titulo, '') || ' ' || coalesce(conteudo, ''))));

-- O índice antigo, com acento, deixa de ser usado.
drop index if exists public.consultor_ia_base_busca_idx;

create or replace function public.consultor_ia_trechos(_pergunta text, _limite integer default 20)
returns table (id uuid, categoria text, titulo text, conteudo text, tags text[])
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  with q as (
    -- Termos em OU: basta um termo da pergunta aparecer no verbete; a ordem
    -- vem da relevância. Pergunta só com palavras vazias não devolve nada.
    select nullif(
             replace(plainto_tsquery('portuguese', public.sem_acento(coalesce(_pergunta, '')))::text, ' & ', ' | '),
             ''
           )::tsquery as tsq
  )
  select b.id, b.categoria, b.titulo, b.conteudo, b.tags
    from public.consultor_ia_base b, q
   where q.tsq is not null
     and b.ativo
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

-- ───────────── 4. usuario_escopo_dados ─────────────
create or replace function public.usuario_escopo_dados(_user_id uuid, _modulo text)
returns public.escopo_dados
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when public.has_any_role(_user_id, array['admin', 'correspondente']::public.app_role[]) then 'todos'::public.escopo_dados
      else coalesce((
        select pm.escopo_dados
          from public.profiles pr
          join public.permissions pm on pm.nivel_acesso_id = pr.nivel_acesso_id
         where pr.id = _user_id
           and pm.modulo = _modulo
           and pm.permitido
         order by (pm.acao = 'view') desc
         limit 1
      ), 'proprios'::public.escopo_dados)
    end;
$$;
