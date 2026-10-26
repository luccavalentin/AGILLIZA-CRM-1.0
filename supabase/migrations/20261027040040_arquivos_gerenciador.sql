-- Arquivos: gerenciador de arquivos de verdade (pedido do dono de 26/10/2026, item C38).
--
-- "ARQUIVOS (REFATORE DE FORMA INTELIGENTE E QUE FAÇA SENTIDO PARA ARMAZENAMENTO DE
-- DOCUMENTOS)". A tabela `arquivos_nos` (pastas e arquivos do escritório) continua sendo a
-- árvore; ganha o que um gerenciador precisa:
--
--   · lixeira com restauração (nada some de primeira: mover para a lixeira marca o item e
--     tudo abaixo dele; restaurar devolve ao lugar, ou à raiz se a pasta de origem sumiu;
--     excluir para sempre só a partir da lixeira);
--   · versões (enviar um arquivo com o mesmo nome na mesma pasta vira a versão nova; dá para
--     voltar a uma versão anterior);
--   · etiquetas e favoritos (por pessoa);
--   · permissões por pasta: uma pasta (ou arquivo) "restrita" só é vista por quem a criou,
--     pelo dono/admin e por quem recebeu acesso (pessoa ou equipe = nível de acesso), com o
--     nível ver / editar / gerir. Isso também é o "compartilhar";
--   · cota de armazenamento por correspondente (configurável, nunca fixa no código), contando
--     todas as versões e a lixeira.
--
-- Antes, a regra estava só nas server functions: qualquer usuário do correspondente lia,
-- alterava e apagava qualquer item direto pela API do navegador, e qualquer usuário logado
-- enviava objetos para qualquer caminho do bucket. Agora o banco decide:
--   · `arquivos_nivel(usuario, no)` → 0 nenhum, 1 ver, 2 editar, 3 gerir;
--   · a leitura direta da tabela passa pela RLS com essa função;
--   · escrita só pelas funções `arquivos_*` (security definer), que conferem o nível,
--     nome duplicado na mesma pasta (com trava), ciclo ao mover e cota (com trava).
--   · Storage: ler só objeto de item que a pessoa vê; enviar só dentro de
--     `<correspondente>/...`; alterar/apagar objeto só pelo servidor (service_role).

-- ---------------------------------------------------------------------------
-- 1. Colunas novas na árvore
-- ---------------------------------------------------------------------------
alter table public.arquivos_nos
  add column if not exists excluido_em   timestamptz,
  add column if not exists excluido_por  uuid,
  add column if not exists excluido_raiz boolean not null default false,
  add column if not exists etiquetas     text[]  not null default '{}',
  add column if not exists descricao     text,
  add column if not exists versao_atual  integer not null default 1,
  add column if not exists restrita      boolean not null default false;

comment on column public.arquivos_nos.excluido_em is
  'Na lixeira desde (o item e tudo abaixo dele recebem o mesmo instante).';
comment on column public.arquivos_nos.excluido_raiz is
  'É o item que a pessoa mandou para a lixeira (os de baixo foram junto). A lixeira lista só estes.';
comment on column public.arquivos_nos.restrita is
  'Pasta/arquivo com acesso próprio: só criador, dono/admin e quem está em arquivos_permissoes.';

create index if not exists arquivos_nos_lixeira_idx
  on public.arquivos_nos (correspondente_id, excluido_em) where excluido_em is not null;
create index if not exists arquivos_nos_storage_path_idx
  on public.arquivos_nos (storage_path) where storage_path is not null;
create index if not exists arquivos_nos_etiquetas_idx
  on public.arquivos_nos using gin (etiquetas);

-- ---------------------------------------------------------------------------
-- 2. Tabelas de apoio
-- ---------------------------------------------------------------------------
create table if not exists public.arquivos_versoes (
  id            uuid primary key default gen_random_uuid(),
  no_id         uuid not null references public.arquivos_nos (id) on delete cascade,
  versao        integer not null check (versao >= 1),
  storage_path  text not null,
  content_type  text,
  tamanho       bigint not null default 0 check (tamanho >= 0),
  criado_por    uuid,
  created_at    timestamptz not null default now(),
  unique (no_id, versao)
);
create index if not exists arquivos_versoes_path_idx on public.arquivos_versoes (storage_path);

create table if not exists public.arquivos_favoritos (
  user_id    uuid not null,
  no_id      uuid not null references public.arquivos_nos (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, no_id)
);
create index if not exists arquivos_favoritos_no_idx on public.arquivos_favoritos (no_id);

create table if not exists public.arquivos_permissoes (
  id               uuid primary key default gen_random_uuid(),
  no_id            uuid not null references public.arquivos_nos (id) on delete cascade,
  user_id          uuid references public.profiles (id) on delete cascade,
  nivel_acesso_id  uuid references public.access_levels (id) on delete cascade,
  nivel            text not null default 'ver' check (nivel in ('ver', 'editar', 'gerir')),
  concedido_por    uuid,
  created_at       timestamptz not null default now(),
  constraint arquivos_permissoes_um_alvo check ((user_id is null) <> (nivel_acesso_id is null))
);
create unique index if not exists arquivos_permissoes_usuario_uniq
  on public.arquivos_permissoes (no_id, user_id) where user_id is not null;
create unique index if not exists arquivos_permissoes_equipe_uniq
  on public.arquivos_permissoes (no_id, nivel_acesso_id) where nivel_acesso_id is not null;
create index if not exists arquivos_permissoes_user_idx on public.arquivos_permissoes (user_id);

create table if not exists public.arquivos_cotas (
  correspondente_id uuid primary key,
  -- 10 GB por padrão; o dono muda na tela (Arquivos › Armazenamento).
  limite_bytes      bigint not null default 10737418240 check (limite_bytes > 0),
  alterado_por      uuid,
  updated_at        timestamptz not null default now()
);

-- Versão 1 dos arquivos que já existiam (a cota passa a contar pelas versões).
insert into public.arquivos_versoes (no_id, versao, storage_path, content_type, tamanho, criado_por, created_at)
select n.id, 1, n.storage_path, n.content_type, coalesce(n.tamanho, 0), n.criado_por, n.created_at
  from public.arquivos_nos n
 where n.tipo = 'arquivo' and n.storage_path is not null
   and not exists (select 1 from public.arquivos_versoes v where v.no_id = n.id);

-- ---------------------------------------------------------------------------
-- 3. Acesso: tudo e só por aqui
-- ---------------------------------------------------------------------------
alter table public.arquivos_versoes    enable row level security;
alter table public.arquivos_favoritos  enable row level security;
alter table public.arquivos_permissoes enable row level security;
alter table public.arquivos_cotas      enable row level security;

revoke all on public.arquivos_nos, public.arquivos_versoes, public.arquivos_favoritos,
              public.arquivos_permissoes, public.arquivos_cotas from anon, authenticated;
grant select on public.arquivos_nos to authenticated;
grant all on public.arquivos_nos, public.arquivos_versoes, public.arquivos_favoritos,
             public.arquivos_permissoes, public.arquivos_cotas to service_role;

/**
 * Nível da pessoa num item: 0 nenhum, 1 ver, 2 editar, 3 gerir.
 *
 *  · fora do correspondente, inativo ou sem "Arquivos: ver" → 0;
 *  · dono/admin → 3;
 *  · sem item restrito no caminho → pela matriz (excluir = 3, enviar = 2, ver = 1);
 *  · com item restrito no caminho, vale o mais próximo: criador dele = 3; senão o maior
 *    nível concedido à pessoa ou à equipe (nível de acesso) dela; sem concessão = 0.
 */
create or replace function public.arquivos_nivel(_user uuid, _no uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_corr      uuid;
  v_nivel_ac  uuid;
  v_no_corr   uuid;
  v_restrito  record;
  v_concedido integer;
begin
  if _user is null or _no is null then return 0; end if;
  select p.correspondente_id, p.nivel_acesso_id into v_corr, v_nivel_ac
    from public.profiles p
   where p.id = _user and coalesce(p.ativo, true) and p.bloqueado_em is null and p.deleted_at is null;
  if v_corr is null then return 0; end if;
  select n.correspondente_id into v_no_corr from public.arquivos_nos n where n.id = _no;
  if v_no_corr is null or v_no_corr <> v_corr then return 0; end if;
  if not public.usuario_tem_permissao(_user, 'documentos.arquivos', 'view') then return 0; end if;
  if public.has_any_role(_user, array['admin', 'correspondente']::public.app_role[]) then return 3; end if;

  with recursive cadeia as (
    select n.id, n.parent_id, n.restrita, n.criado_por, 0 as prof
      from public.arquivos_nos n where n.id = _no
    union all
    select p.id, p.parent_id, p.restrita, p.criado_por, c.prof + 1
      from public.arquivos_nos p join cadeia c on p.id = c.parent_id
     where c.prof < 100
  )
  select id, criado_por into v_restrito from cadeia where restrita order by prof limit 1;

  if v_restrito.id is null then
    return case
      when public.usuario_tem_permissao(_user, 'documentos.arquivos', 'delete') then 3
      when public.usuario_tem_permissao(_user, 'documentos.arquivos', 'create') then 2
      else 1 end;
  end if;
  if v_restrito.criado_por = _user then return 3; end if;
  select max(case ap.nivel when 'gerir' then 3 when 'editar' then 2 else 1 end) into v_concedido
    from public.arquivos_permissoes ap
   where ap.no_id = v_restrito.id
     and (ap.user_id = _user or (v_nivel_ac is not null and ap.nivel_acesso_id = v_nivel_ac));
  return coalesce(v_concedido, 0);
end $$;

revoke all on function public.arquivos_nivel(uuid, uuid) from public, anon;
grant execute on function public.arquivos_nivel(uuid, uuid) to authenticated, service_role;

drop policy if exists "Arquivos: ver do meu correspondente" on public.arquivos_nos;
drop policy if exists "Arquivos: criar no meu correspondente" on public.arquivos_nos;
drop policy if exists "Arquivos: atualizar do meu correspondente" on public.arquivos_nos;
drop policy if exists "Arquivos: excluir do meu correspondente" on public.arquivos_nos;
drop policy if exists "Arquivos: ver o que tenho acesso" on public.arquivos_nos;
create policy "Arquivos: ver o que tenho acesso" on public.arquivos_nos
  for select to authenticated
  using (correspondente_id = public.correspondente_do_usuario((select auth.uid()))
         and public.arquivos_nivel((select auth.uid()), id) >= 1);
-- Sem política de escrita para authenticated: escrever só pelas funções abaixo.

-- ---------------------------------------------------------------------------
-- 4. Nome único por pasta (com trava, para dois envios simultâneos não passarem)
-- ---------------------------------------------------------------------------
create or replace function public.arquivos_nome_unico()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.nome := btrim(new.nome);
  if new.nome = '' or length(new.nome) > 300 or new.nome ~ '[/\\]' then
    raise exception 'Nome inválido: use até 300 caracteres, sem barras.' using errcode = '22023';
  end if;
  if new.excluido_em is not null then return new; end if;
  perform pg_advisory_xact_lock(hashtext('arquivos:' || new.correspondente_id::text || ':'
                                         || coalesce(new.parent_id::text, 'raiz')));
  if exists (
    select 1 from public.arquivos_nos o
     where o.correspondente_id = new.correspondente_id
       and o.parent_id is not distinct from new.parent_id
       and o.tipo = new.tipo
       and o.excluido_em is null
       and lower(o.nome) = lower(new.nome)
       and o.id <> new.id
  ) then
    raise exception 'Já existe % com o nome "%" nesta pasta.',
      case new.tipo when 'pasta' then 'uma pasta' else 'um arquivo' end, new.nome
      using errcode = '23505';
  end if;
  return new;
end $$;

drop trigger if exists trg_arquivos_nome_unico on public.arquivos_nos;
create trigger trg_arquivos_nome_unico
  before insert or update of nome, parent_id, excluido_em on public.arquivos_nos
  for each row execute function public.arquivos_nome_unico();

-- ---------------------------------------------------------------------------
-- 5. Funções de uso (todas: security definer, conferem correspondente e nível)
-- ---------------------------------------------------------------------------

/** Correspondente da pessoa ativa, ou erro. */
create or replace function public._arquivos_corr(_user uuid)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v uuid;
begin
  select p.correspondente_id into v from public.profiles p
   where p.id = _user and coalesce(p.ativo, true) and p.bloqueado_em is null and p.deleted_at is null;
  if v is null then raise exception 'Sessão inválida.' using errcode = '42501'; end if;
  if not public.usuario_tem_permissao(_user, 'documentos.arquivos', 'view') then
    raise exception 'Você não tem acesso aos Arquivos.' using errcode = '42501';
  end if;
  return v;
end $$;

/** Exige nível mínimo num item (ou na raiz, quando _no é null). Devolve o nível. */
create or replace function public._arquivos_exigir(_user uuid, _no uuid, _minimo integer)
returns integer language plpgsql stable security definer set search_path = public as $$
declare v integer; v_corr uuid := public._arquivos_corr(_user); v_excl timestamptz;
begin
  if _no is null then
    -- Raiz: segue a matriz (sem restrição possível).
    v := case
      when public.has_any_role(_user, array['admin','correspondente']::public.app_role[]) then 3
      when public.usuario_tem_permissao(_user, 'documentos.arquivos', 'delete') then 3
      when public.usuario_tem_permissao(_user, 'documentos.arquivos', 'create') then 2
      else 1 end;
  else
    select n.excluido_em into v_excl from public.arquivos_nos n where n.id = _no and n.correspondente_id = v_corr;
    if not found then raise exception 'Item não encontrado.' using errcode = 'P0002'; end if;
    v := public.arquivos_nivel(_user, _no);
    if v = 0 then raise exception 'Item não encontrado.' using errcode = 'P0002'; end if;
  end if;
  if v < _minimo then
    raise exception '%', case _minimo when 3 then 'Você não pode gerir este item.'
                                      when 2 then 'Você só pode ver este item.'
                                      else 'Sem acesso.' end
      using errcode = '42501';
  end if;
  return v;
end $$;

/** Pasta de destino válida (pasta, viva, do correspondente) com nível de edição. */
create or replace function public._arquivos_pasta_destino(_user uuid, _pasta uuid)
returns void language plpgsql stable security definer set search_path = public as $$
declare r record;
begin
  if _pasta is null then perform public._arquivos_exigir(_user, null, 2); return; end if;
  select n.tipo, n.excluido_em into r from public.arquivos_nos n
   where n.id = _pasta and n.correspondente_id = public._arquivos_corr(_user);
  if not found then raise exception 'Pasta de destino não encontrada.' using errcode = 'P0002'; end if;
  if r.tipo <> 'pasta' then raise exception 'O destino precisa ser uma pasta.' using errcode = '22023'; end if;
  if r.excluido_em is not null then raise exception 'A pasta de destino está na lixeira.' using errcode = '22023'; end if;
  perform public._arquivos_exigir(_user, _pasta, 2);
end $$;

/** Uso e limite do armazenamento do correspondente (versões + lixeira contam). */
create or replace function public.arquivos_armazenamento()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_corr uuid := public._arquivos_corr(auth.uid());
begin
  return jsonb_build_object(
    'usado', coalesce((select sum(v.tamanho) from public.arquivos_versoes v
                        join public.arquivos_nos n on n.id = v.no_id
                       where n.correspondente_id = v_corr), 0),
    'na_lixeira', coalesce((select sum(v.tamanho) from public.arquivos_versoes v
                             join public.arquivos_nos n on n.id = v.no_id
                            where n.correspondente_id = v_corr and n.excluido_em is not null), 0),
    'limite', coalesce((select c.limite_bytes from public.arquivos_cotas c where c.correspondente_id = v_corr),
                       10737418240),
    'pode_alterar', public.has_any_role(auth.uid(), array['admin','correspondente']::public.app_role[]));
end $$;

/** Dono/admin muda a cota (em GB, de 1 a 10.000). */
create or replace function public.arquivos_definir_cota(p_gb numeric)
returns void language plpgsql security definer set search_path = public as $$
declare v_corr uuid := public._arquivos_corr(auth.uid());
begin
  if not public.has_any_role(auth.uid(), array['admin','correspondente']::public.app_role[]) then
    raise exception 'Só o dono ou um administrador muda a cota.' using errcode = '42501';
  end if;
  if p_gb is null or p_gb < 1 or p_gb > 10000 then
    raise exception 'Informe de 1 a 10.000 GB.' using errcode = '22023';
  end if;
  insert into public.arquivos_cotas (correspondente_id, limite_bytes, alterado_por)
  values (v_corr, (p_gb * 1073741824)::bigint, auth.uid())
  on conflict (correspondente_id) do update
     set limite_bytes = excluded.limite_bytes, alterado_por = excluded.alterado_por, updated_at = now();
end $$;

/** Confere a cota antes de gravar `p_bytes` a mais. Trava por correspondente. */
create or replace function public._arquivos_conferir_cota(_corr uuid, p_bytes bigint)
returns void language plpgsql security definer set search_path = public as $$
declare v_usado bigint; v_limite bigint;
begin
  perform pg_advisory_xact_lock(hashtext('arquivos-cota:' || _corr::text));
  select coalesce(sum(v.tamanho), 0) into v_usado from public.arquivos_versoes v
    join public.arquivos_nos n on n.id = v.no_id where n.correspondente_id = _corr;
  select coalesce((select c.limite_bytes from public.arquivos_cotas c where c.correspondente_id = _corr),
                  10737418240) into v_limite;
  if v_usado + greatest(coalesce(p_bytes, 0), 0) > v_limite then
    raise exception 'Armazenamento cheio: libere espaço (esvazie a lixeira ou apague versões antigas) ou peça mais espaço ao administrador.'
      using errcode = '53100';
  end if;
end $$;

/** Cria a pasta. Pasta com o mesmo nome no mesmo lugar: devolve a existente. */
create or replace function public.arquivos_criar_pasta(p_parent uuid, p_nome text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_corr uuid := public._arquivos_corr(auth.uid()); v_id uuid; v_nome text := btrim(coalesce(p_nome, ''));
begin
  perform public._arquivos_pasta_destino(auth.uid(), p_parent);
  perform pg_advisory_xact_lock(hashtext('arquivos:' || v_corr::text || ':' || coalesce(p_parent::text, 'raiz')));
  select n.id into v_id from public.arquivos_nos n
   where n.correspondente_id = v_corr and n.parent_id is not distinct from p_parent and n.tipo = 'pasta'
     and n.excluido_em is null and lower(n.nome) = lower(v_nome);
  if v_id is not null then return v_id; end if;
  insert into public.arquivos_nos (correspondente_id, parent_id, tipo, nome, criado_por)
  values (v_corr, p_parent, 'pasta', v_nome, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

/**
 * Registra o arquivo já enviado ao bucket (caminho `<correspondente>/...`).
 * Mesmo nome na mesma pasta: com p_nova_versao vira a versão seguinte; sem, erro de nome.
 * Devolve {id, versao}.
 */
create or replace function public.arquivos_registrar(
  p_parent uuid, p_nome text, p_storage_path text, p_content_type text, p_tamanho bigint,
  p_nova_versao boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_corr uuid := public._arquivos_corr(auth.uid());
  v_nome text := btrim(coalesce(p_nome, ''));
  v_existente uuid;
  v_versao integer;
  v_id uuid;
begin
  perform public._arquivos_pasta_destino(auth.uid(), p_parent);
  if p_storage_path is null or split_part(p_storage_path, '/', 1) <> v_corr::text
     or p_storage_path like '%..%' then
    raise exception 'Caminho do arquivo inválido.' using errcode = '22023';
  end if;
  if p_tamanho is null or p_tamanho < 0 then
    raise exception 'Tamanho do arquivo inválido.' using errcode = '22023';
  end if;
  if exists (select 1 from public.arquivos_versoes v where v.storage_path = p_storage_path)
     or exists (select 1 from public.arquivos_nos n where n.storage_path = p_storage_path) then
    raise exception 'Este envio já foi registrado.' using errcode = '23505';
  end if;
  perform public._arquivos_conferir_cota(v_corr, p_tamanho);
  perform pg_advisory_xact_lock(hashtext('arquivos:' || v_corr::text || ':' || coalesce(p_parent::text, 'raiz')));

  select n.id into v_existente from public.arquivos_nos n
   where n.correspondente_id = v_corr and n.parent_id is not distinct from p_parent and n.tipo = 'arquivo'
     and n.excluido_em is null and lower(n.nome) = lower(v_nome)
   for update;

  if v_existente is not null then
    if not coalesce(p_nova_versao, false) then
      raise exception 'Já existe um arquivo com o nome "%" nesta pasta.', v_nome using errcode = '23505';
    end if;
    perform public._arquivos_exigir(auth.uid(), v_existente, 2);
    select coalesce(max(v.versao), 0) + 1 into v_versao from public.arquivos_versoes v where v.no_id = v_existente;
    insert into public.arquivos_versoes (no_id, versao, storage_path, content_type, tamanho, criado_por)
    values (v_existente, v_versao, p_storage_path, nullif(p_content_type, ''), p_tamanho, auth.uid());
    update public.arquivos_nos
       set storage_path = p_storage_path, content_type = nullif(p_content_type, ''), tamanho = p_tamanho,
           versao_atual = v_versao
     where id = v_existente;
    return jsonb_build_object('id', v_existente, 'versao', v_versao);
  end if;

  insert into public.arquivos_nos (correspondente_id, parent_id, tipo, nome, storage_path, content_type, tamanho, criado_por)
  values (v_corr, p_parent, 'arquivo', v_nome, p_storage_path, nullif(p_content_type, ''), p_tamanho, auth.uid())
  returning id into v_id;
  insert into public.arquivos_versoes (no_id, versao, storage_path, content_type, tamanho, criado_por)
  values (v_id, 1, p_storage_path, nullif(p_content_type, ''), p_tamanho, auth.uid());
  return jsonb_build_object('id', v_id, 'versao', 1);
end $$;

/** Volta a uma versão anterior (vira a versão mais nova, sem novo envio). */
create or replace function public.arquivos_restaurar_versao(p_no uuid, p_versao integer)
returns integer language plpgsql security definer set search_path = public as $$
declare r record; v_nova integer;
begin
  perform public._arquivos_exigir(auth.uid(), p_no, 2);
  if exists (select 1 from public.arquivos_nos n where n.id = p_no and n.excluido_em is not null) then
    raise exception 'Restaure o arquivo da lixeira antes.' using errcode = '22023';
  end if;
  perform 1 from public.arquivos_nos n where n.id = p_no for update;
  select * into r from public.arquivos_versoes v where v.no_id = p_no and v.versao = p_versao;
  if not found then raise exception 'Versão não encontrada.' using errcode = 'P0002'; end if;
  select max(v.versao) + 1 into v_nova from public.arquivos_versoes v where v.no_id = p_no;
  -- Aponta para o mesmo objeto do bucket: não ocupa espaço de novo. A cota soma o tamanho das
  -- versões, por isso a cópia entra com tamanho 0 (a lista de versões mostra o tamanho real).
  insert into public.arquivos_versoes (no_id, versao, storage_path, content_type, tamanho, criado_por)
  values (p_no, v_nova, r.storage_path, r.content_type, 0, auth.uid());
  update public.arquivos_nos
     set storage_path = r.storage_path, content_type = r.content_type, tamanho = r.tamanho, versao_atual = v_nova
   where id = p_no;
  return v_nova;
end $$;

/** Versões de um arquivo (mais nova primeiro). */
create or replace function public.arquivos_versoes_de(p_no uuid)
returns table (versao integer, tamanho bigint, content_type text, criado_por_nome text, created_at timestamptz, atual boolean)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  perform public._arquivos_exigir(auth.uid(), p_no, 1);
  return query
  select v.versao,
         -- a cópia de restauração aponta para o objeto original: mostra o tamanho real
         coalesce(nullif(v.tamanho, 0), (select o.tamanho from public.arquivos_versoes o
                                          where o.no_id = v.no_id and o.storage_path = v.storage_path
                                          order by o.versao limit 1)),
         v.content_type, p.nome, v.created_at, v.versao = n.versao_atual
    from public.arquivos_versoes v
    join public.arquivos_nos n on n.id = v.no_id
    left join public.profiles p on p.id = v.criado_por
   where v.no_id = p_no
   order by v.versao desc;
end $$;

/** Caminho do objeto de uma versão (para o servidor assinar o link). */
create or replace function public.arquivos_caminho_versao(p_no uuid, p_versao integer)
returns text language plpgsql stable security definer set search_path = public as $$
declare v text;
begin
  perform public._arquivos_exigir(auth.uid(), p_no, 1);
  select storage_path into v from public.arquivos_versoes where no_id = p_no and versao = p_versao;
  if v is null then raise exception 'Versão não encontrada.' using errcode = 'P0002'; end if;
  return v;
end $$;

create or replace function public.arquivos_renomear(p_no uuid, p_nome text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._arquivos_exigir(auth.uid(), p_no, 2);
  update public.arquivos_nos set nome = p_nome where id = p_no and excluido_em is null;
  if not found then raise exception 'Item não encontrado.' using errcode = 'P0002'; end if;
end $$;

/** Move para outra pasta (ou raiz). Recusa ciclo, destino na lixeira e falta de nível. */
create or replace function public.arquivos_mover(p_no uuid, p_destino uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_ciclo boolean;
begin
  perform public._arquivos_exigir(auth.uid(), p_no, 2);
  if p_destino = p_no then
    raise exception 'Não é possível mover uma pasta para dentro dela mesma.' using errcode = '22023';
  end if;
  perform public._arquivos_pasta_destino(auth.uid(), p_destino);
  if p_destino is not null then
    with recursive acima as (
      select n.id, n.parent_id, 0 as prof from public.arquivos_nos n where n.id = p_destino
      union all
      select p.id, p.parent_id, a.prof + 1 from public.arquivos_nos p join acima a on p.id = a.parent_id
       where a.prof < 100
    )
    select exists (select 1 from acima where id = p_no) into v_ciclo;
    if v_ciclo then
      raise exception 'Não é possível mover uma pasta para dentro dela mesma.' using errcode = '22023';
    end if;
  end if;
  update public.arquivos_nos set parent_id = p_destino where id = p_no and excluido_em is null;
  if not found then raise exception 'Item não encontrado.' using errcode = 'P0002'; end if;
end $$;

/** Manda para a lixeira o item e tudo abaixo dele. */
create or replace function public.arquivos_para_lixeira(p_no uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_agora timestamptz := now();
begin
  perform public._arquivos_exigir(auth.uid(), p_no, 3);
  if exists (select 1 from public.arquivos_nos where id = p_no and excluido_em is not null) then
    raise exception 'O item já está na lixeira.' using errcode = '22023';
  end if;
  with recursive abaixo as (
    select n.id, 0 as prof from public.arquivos_nos n where n.id = p_no
    union all
    select f.id, a.prof + 1 from public.arquivos_nos f join abaixo a on f.parent_id = a.id
     where f.excluido_em is null and a.prof < 100
  )
  update public.arquivos_nos n
     set excluido_em = v_agora, excluido_por = auth.uid(), excluido_raiz = (n.id = p_no),
         mostrar_no_menu = case when n.id = p_no then false else n.mostrar_no_menu end
    from abaixo a where n.id = a.id;
end $$;

/**
 * Restaura da lixeira. Volta para a pasta de origem; se ela não existe mais ou também está
 * na lixeira, vai para a raiz. Nome ocupado no destino: ganha " (restaurado)".
 * Devolve a pasta onde o item ficou.
 */
create or replace function public.arquivos_restaurar(p_no uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare r record; v_destino uuid; v_nome text; v_n integer := 1;
begin
  perform public._arquivos_exigir(auth.uid(), p_no, 3);
  select * into r from public.arquivos_nos where id = p_no for update;
  if r.excluido_em is null or not r.excluido_raiz then
    raise exception 'Este item não está na lixeira (restaure a pasta em que ele estava).' using errcode = '22023';
  end if;
  v_destino := r.parent_id;
  if v_destino is not null and not exists (
    select 1 from public.arquivos_nos p where p.id = v_destino and p.excluido_em is null) then
    v_destino := null;
  end if;
  perform pg_advisory_xact_lock(hashtext('arquivos:' || r.correspondente_id::text || ':' || coalesce(v_destino::text, 'raiz')));
  v_nome := r.nome;
  while exists (select 1 from public.arquivos_nos o
                 where o.correspondente_id = r.correspondente_id and o.parent_id is not distinct from v_destino
                   and o.tipo = r.tipo and o.excluido_em is null and lower(o.nome) = lower(v_nome)) loop
    v_nome := left(r.nome, 270) || ' (restaurado' || case when v_n > 1 then ' ' || v_n else '' end || ')';
    v_n := v_n + 1;
  end loop;
  -- Os de baixo voltam juntos (os que foram para a lixeira no mesmo instante).
  with recursive abaixo as (
    select n.id, 0 as prof from public.arquivos_nos n where n.parent_id = p_no and n.excluido_em = r.excluido_em
    union all
    select f.id, a.prof + 1 from public.arquivos_nos f join abaixo a on f.parent_id = a.id
     where f.excluido_em = r.excluido_em and a.prof < 100
  )
  update public.arquivos_nos n set excluido_em = null, excluido_por = null, excluido_raiz = false
    from abaixo a where n.id = a.id;
  update public.arquivos_nos
     set parent_id = v_destino, nome = v_nome, excluido_em = null, excluido_por = null, excluido_raiz = false
   where id = p_no;
  return v_destino;
end $$;

/**
 * Exclui para sempre um item que está na lixeira. Devolve os caminhos dos objetos do bucket
 * que ficaram sem uso, para o servidor apagar (o banco não alcança o storage).
 */
create or replace function public.arquivos_excluir_definitivo(p_no uuid)
returns text[] language plpgsql security definer set search_path = public as $$
declare r record; v_caminhos text[];
begin
  perform public._arquivos_exigir(auth.uid(), p_no, 3);
  select * into r from public.arquivos_nos where id = p_no for update;
  if r.excluido_em is null or not r.excluido_raiz then
    raise exception 'Só dá para excluir para sempre o que está na lixeira.' using errcode = '22023';
  end if;
  with recursive abaixo as (
    select n.id, 0 as prof from public.arquivos_nos n where n.id = p_no
    union all
    select f.id, a.prof + 1 from public.arquivos_nos f join abaixo a on f.parent_id = a.id where a.prof < 100
  ), caminhos as (
    select v.storage_path from public.arquivos_versoes v join abaixo a on a.id = v.no_id
    union
    select n.storage_path from public.arquivos_nos n join abaixo a on a.id = n.id where n.storage_path is not null
  )
  select coalesce(array_agg(distinct c.storage_path), '{}') into v_caminhos from caminhos c;
  delete from public.arquivos_nos where id = p_no;  -- os de baixo e as versões saem em cascata
  -- Objeto ainda usado por outro item (não deveria acontecer) não é apagado.
  select coalesce(array_agg(x), '{}') into v_caminhos from unnest(v_caminhos) x
   where not exists (select 1 from public.arquivos_versoes v where v.storage_path = x)
     and not exists (select 1 from public.arquivos_nos n where n.storage_path = x);
  return v_caminhos;
end $$;

/** Itens que a pessoa mandou para a lixeira e que ela ainda vê. */
create or replace function public.arquivos_lixeira()
returns table (id uuid, tipo text, nome text, tamanho bigint, content_type text, excluido_em timestamptz,
               excluido_por_nome text, origem text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare v_corr uuid := public._arquivos_corr(auth.uid());
begin
  return query
  select n.id, n.tipo, n.nome,
         case when n.tipo = 'arquivo' then n.tamanho
              else (with recursive abaixo as (
                      select f.id, 0 as prof from public.arquivos_nos f where f.parent_id = n.id
                      union all
                      select g.id, a.prof + 1 from public.arquivos_nos g join abaixo a on g.parent_id = a.id where a.prof < 100)
                    select coalesce(sum(x.tamanho), 0)::bigint from public.arquivos_nos x join abaixo a on a.id = x.id) end,
         n.content_type, n.excluido_em, p.nome,
         coalesce((select o.nome from public.arquivos_nos o where o.id = n.parent_id), 'Início')
    from public.arquivos_nos n
    left join public.profiles p on p.id = n.excluido_por
   where n.correspondente_id = v_corr and n.excluido_raiz and n.excluido_em is not null
     and public.arquivos_nivel(auth.uid(), n.id) >= 3
   order by n.excluido_em desc
   limit 500;
end $$;

/** Liga/desliga favorito (por pessoa). Devolve o estado novo. */
create or replace function public.arquivos_favoritar(p_no uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  perform public._arquivos_exigir(auth.uid(), p_no, 1);
  delete from public.arquivos_favoritos where user_id = auth.uid() and no_id = p_no;
  if found then return false; end if;
  insert into public.arquivos_favoritos (user_id, no_id) values (auth.uid(), p_no) on conflict do nothing;
  return true;
end $$;

/** Etiquetas do item: até 10, cada uma com até 30 caracteres, sem repetir. */
create or replace function public.arquivos_etiquetar(p_no uuid, p_etiquetas text[])
returns text[] language plpgsql security definer set search_path = public as $$
declare v text[];
begin
  perform public._arquivos_exigir(auth.uid(), p_no, 2);
  select coalesce(array_agg(e order by e), '{}') into v from (
    select distinct lower(left(btrim(x), 30)) as e from unnest(coalesce(p_etiquetas, '{}')) x
     where btrim(x) <> '') s;
  if cardinality(v) > 10 then raise exception 'Use no máximo 10 etiquetas.' using errcode = '22023'; end if;
  update public.arquivos_nos set etiquetas = v where id = p_no;
  return v;
end $$;

/** Fixa/solta pasta da raiz no menu lateral. */
create or replace function public.arquivos_mostrar_no_menu(p_no uuid, p_mostrar boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._arquivos_exigir(auth.uid(), p_no, 2);
  update public.arquivos_nos set mostrar_no_menu = coalesce(p_mostrar, false)
   where id = p_no and tipo = 'pasta' and parent_id is null and excluido_em is null;
  if not found then raise exception 'Só pastas da raiz podem ir para o menu.' using errcode = '22023'; end if;
end $$;

/**
 * Compartilhar / permissões. p_restrita liga ou desliga o acesso próprio do item; p_acessos
 * é a lista completa: [{"user_id"|"nivel_acesso_id": uuid, "nivel": "ver|editar|gerir"}].
 * Pessoa e equipe precisam ser do mesmo correspondente. Quem restringe continua com acesso
 * (criador = gerir; quem não é o criador entra na lista como "gerir" para não se trancar fora).
 */
create or replace function public.arquivos_definir_acesso(p_no uuid, p_restrita boolean, p_acessos jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_corr uuid := public._arquivos_corr(auth.uid());
  a jsonb;
  v_user uuid;
  v_eq uuid;
  v_nivel text;
  v_criador uuid;
begin
  perform public._arquivos_exigir(auth.uid(), p_no, 3);
  if jsonb_typeof(coalesce(p_acessos, '[]')) <> 'array' or jsonb_array_length(coalesce(p_acessos, '[]')) > 200 then
    raise exception 'Lista de acessos inválida.' using errcode = '22023';
  end if;
  select criado_por into v_criador from public.arquivos_nos where id = p_no for update;
  delete from public.arquivos_permissoes where no_id = p_no;
  for a in select * from jsonb_array_elements(coalesce(p_acessos, '[]')) loop
    v_user := nullif(a ->> 'user_id', '')::uuid;
    v_eq := nullif(a ->> 'nivel_acesso_id', '')::uuid;
    v_nivel := coalesce(a ->> 'nivel', 'ver');
    if v_nivel not in ('ver', 'editar', 'gerir') or ((v_user is null) = (v_eq is null)) then
      raise exception 'Acesso inválido na lista.' using errcode = '22023';
    end if;
    if v_user is not null and not exists (
      select 1 from public.profiles p where p.id = v_user and p.correspondente_id = v_corr and p.deleted_at is null) then
      raise exception 'Pessoa não encontrada neste escritório.' using errcode = '22023';
    end if;
    if v_eq is not null and not exists (
      select 1 from public.access_levels l where l.id = v_eq and l.correspondente_id = v_corr) then
      raise exception 'Equipe não encontrada neste escritório.' using errcode = '22023';
    end if;
    insert into public.arquivos_permissoes (no_id, user_id, nivel_acesso_id, nivel, concedido_por)
    values (p_no, v_user, v_eq, v_nivel, auth.uid())
    on conflict do nothing;
  end loop;
  if coalesce(p_restrita, false) and v_criador is distinct from auth.uid()
     and not public.has_any_role(auth.uid(), array['admin','correspondente']::public.app_role[]) then
    insert into public.arquivos_permissoes (no_id, user_id, nivel, concedido_por)
    values (p_no, auth.uid(), 'gerir', auth.uid())
    on conflict (no_id, user_id) where user_id is not null do update set nivel = 'gerir';
  end if;
  update public.arquivos_nos set restrita = coalesce(p_restrita, false) where id = p_no;
end $$;

/** Acesso atual de um item (para a tela de compartilhar). */
create or replace function public.arquivos_acesso_de(p_no uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._arquivos_exigir(auth.uid(), p_no, 3);
  return jsonb_build_object(
    'restrita', (select restrita from public.arquivos_nos where id = p_no),
    'acessos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'user_id', ap.user_id, 'nivel_acesso_id', ap.nivel_acesso_id, 'nivel', ap.nivel,
               'nome', coalesce(p.nome, p.email, l.nome)) order by coalesce(p.nome, l.nome))
        from public.arquivos_permissoes ap
        left join public.profiles p on p.id = ap.user_id
        left join public.access_levels l on l.id = ap.nivel_acesso_id
       where ap.no_id = p_no), '[]'));
end $$;

/**
 * Lista um nível da árvore (p_parent null = raiz) ou uma visão especial
 * (p_visao: 'pasta' | 'favoritos' | 'compartilhados' | 'recentes' | 'busca').
 * Cada linha já vem com o nível da pessoa, favorito e quantos itens a pasta tem.
 */
create or replace function public.arquivos_listar(
  p_parent uuid default null, p_visao text default 'pasta', p_termo text default null, p_etiqueta text default null)
returns table (
  id uuid, parent_id uuid, tipo text, nome text, content_type text, tamanho bigint, created_at timestamptz,
  updated_at timestamptz, criado_por_nome text, mostrar_no_menu boolean, etiquetas text[], restrita boolean,
  versao_atual integer, favorito boolean, nivel integer, itens bigint, caminho text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_corr uuid := public._arquivos_corr(auth.uid());
  v_termo text := nullif(btrim(coalesce(p_termo, '')), '');
  v_visao text := coalesce(nullif(p_visao, ''), 'pasta');
  v_nivel_ac uuid := (select nivel_acesso_id from public.profiles where id = auth.uid());
begin
  if v_visao not in ('pasta', 'favoritos', 'compartilhados', 'recentes', 'busca') then
    raise exception 'Visão inválida.' using errcode = '22023';
  end if;
  if v_visao = 'pasta' and p_parent is not null then
    perform public._arquivos_exigir(v_user, p_parent, 1);
  end if;
  if v_termo is not null and length(v_termo) > 200 then
    raise exception 'Busca longa demais.' using errcode = '22023';
  end if;
  return query
  with candidatos as (
    select n.* from public.arquivos_nos n
     where n.correspondente_id = v_corr and n.excluido_em is null
       and (
         (v_visao = 'pasta' and n.parent_id is not distinct from p_parent)
         or (v_visao = 'favoritos' and exists (select 1 from public.arquivos_favoritos f
                                                where f.user_id = v_user and f.no_id = n.id))
         or (v_visao = 'compartilhados' and exists (
               select 1 from public.arquivos_permissoes ap where ap.no_id = n.id
                  and (ap.user_id = v_user or (v_nivel_ac is not null and ap.nivel_acesso_id = v_nivel_ac)))
             and n.criado_por is distinct from v_user)
         or (v_visao = 'recentes' and n.tipo = 'arquivo')
         or (v_visao = 'busca' and (v_termo is not null or p_etiqueta is not null))
       )
       and (v_termo is null or lower(public.sem_acento(n.nome)) like '%' || lower(public.sem_acento(v_termo)) || '%'
            or exists (select 1 from unnest(n.etiquetas) e where lower(public.sem_acento(e)) like '%' || lower(public.sem_acento(v_termo)) || '%'))
       and (p_etiqueta is null or lower(p_etiqueta) = any (n.etiquetas))
     order by case when v_visao = 'recentes' then n.updated_at end desc nulls last, n.tipo desc, lower(n.nome)
     limit case when v_visao in ('recentes') then 60 when v_visao = 'busca' then 300 else 5000 end
  ), visiveis as (
    select c.*, public.arquivos_nivel(v_user, c.id) as nv from candidatos c
  )
  select v.id, v.parent_id, v.tipo, v.nome, v.content_type, v.tamanho, v.created_at, v.updated_at,
         p.nome, v.mostrar_no_menu, v.etiquetas, v.restrita, v.versao_atual,
         exists (select 1 from public.arquivos_favoritos f where f.user_id = v_user and f.no_id = v.id),
         v.nv,
         case when v.tipo = 'pasta' then (select count(*) from public.arquivos_nos x
                                           where x.parent_id = v.id and x.excluido_em is null) end,
         case when v_visao <> 'pasta' then (
           with recursive acima as (
             select a.id, a.parent_id, a.nome, 0 as prof from public.arquivos_nos a where a.id = v.parent_id
             union all
             select b.id, b.parent_id, b.nome, ac.prof + 1 from public.arquivos_nos b join acima ac on b.id = ac.parent_id
              where ac.prof < 50)
           select coalesce(string_agg(nome, ' / ' order by prof desc), 'Início') from acima) end
    from visiveis v
    left join public.profiles p on p.id = v.criado_por
   where v.nv >= 1;
end $$;

/** Pastas que a pessoa pode usar como destino (para mover / enviar). */
create or replace function public.arquivos_pastas_destino()
returns table (id uuid, nome text, caminho text)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare v_corr uuid := public._arquivos_corr(auth.uid());
begin
  return query
  with recursive arvore as (
    select n.id, n.nome, n.nome::text as caminho, 0 as prof from public.arquivos_nos n
     where n.correspondente_id = v_corr and n.tipo = 'pasta' and n.parent_id is null and n.excluido_em is null
    union all
    select f.id, f.nome, a.caminho || ' / ' || f.nome, a.prof + 1 from public.arquivos_nos f join arvore a on f.parent_id = a.id
     where f.tipo = 'pasta' and f.excluido_em is null and a.prof < 50
  )
  select a.id, a.nome, a.caminho from arvore a
   where public.arquivos_nivel(auth.uid(), a.id) >= 2
   order by a.caminho
   limit 3000;
end $$;

/** Trilha da pasta até a raiz (só as pastas que a pessoa vê), com o nível da pessoa em cada uma. */
create or replace function public.arquivos_trilha(p_no uuid)
returns table (id uuid, nome text, nivel integer)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if p_no is null then return; end if;
  perform public._arquivos_exigir(auth.uid(), p_no, 1);
  return query
  with recursive acima as (
    select a.id, a.parent_id, a.nome, 0 as prof from public.arquivos_nos a where a.id = p_no
    union all
    select b.id, b.parent_id, b.nome, ac.prof + 1 from public.arquivos_nos b join acima ac on b.id = ac.parent_id
     where ac.prof < 50
  )
  select ac.id, ac.nome, ac.nv from (select a.*, public.arquivos_nivel(auth.uid(), a.id) as nv from acima a) ac
   where ac.nv >= 1 order by ac.prof desc;
end $$;

/** Pessoas e equipes do escritório para compartilhar. */
create or replace function public.arquivos_alvos_compartilhar()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_corr uuid := public._arquivos_corr(auth.uid());
begin
  return jsonb_build_object(
    'pessoas', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'nome', coalesce(nullif(btrim(p.nome), ''), p.email))
                                 order by coalesce(nullif(btrim(p.nome), ''), p.email))
                           from public.profiles p
                          where p.correspondente_id = v_corr and coalesce(p.ativo, true) and p.deleted_at is null
                            and p.acesso_tipo = 'sistema'), '[]'),
    'equipes', coalesce((select jsonb_agg(jsonb_build_object('id', l.id, 'nome', l.nome) order by l.nome)
                           from public.access_levels l
                          where l.correspondente_id = v_corr and coalesce(l.ativo, true)), '[]'));
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'public._arquivos_corr(uuid)', 'public._arquivos_exigir(uuid, uuid, integer)',
    'public._arquivos_pasta_destino(uuid, uuid)', 'public._arquivos_conferir_cota(uuid, bigint)',
    'public.arquivos_armazenamento()', 'public.arquivos_definir_cota(numeric)',
    'public.arquivos_criar_pasta(uuid, text)',
    'public.arquivos_registrar(uuid, text, text, text, bigint, boolean)',
    'public.arquivos_restaurar_versao(uuid, integer)', 'public.arquivos_versoes_de(uuid)',
    'public.arquivos_caminho_versao(uuid, integer)', 'public.arquivos_renomear(uuid, text)',
    'public.arquivos_mover(uuid, uuid)', 'public.arquivos_para_lixeira(uuid)',
    'public.arquivos_restaurar(uuid)', 'public.arquivos_excluir_definitivo(uuid)',
    'public.arquivos_lixeira()', 'public.arquivos_favoritar(uuid)',
    'public.arquivos_etiquetar(uuid, text[])', 'public.arquivos_mostrar_no_menu(uuid, boolean)',
    'public.arquivos_definir_acesso(uuid, boolean, jsonb)', 'public.arquivos_acesso_de(uuid)',
    'public.arquivos_listar(uuid, text, text, text)', 'public.arquivos_pastas_destino()',
    'public.arquivos_trilha(uuid)', 'public.arquivos_alvos_compartilhar()'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    -- As internas (_arquivos_*) não ficam expostas à API.
    if f like 'public._arquivos%' then
      execute format('grant execute on function %s to service_role', f);
    else
      execute format('grant execute on function %s to authenticated, service_role', f);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Storage do bucket "arquivos"
-- ---------------------------------------------------------------------------
drop policy if exists "Arquivos storage: ler do correspondente" on storage.objects;
drop policy if exists "Arquivos storage: enviar autenticado" on storage.objects;
drop policy if exists "Arquivos storage: atualizar do correspondente" on storage.objects;
drop policy if exists "Arquivos storage: excluir do correspondente" on storage.objects;
drop policy if exists "Arquivos storage: ler o que vejo" on storage.objects;
drop policy if exists "Arquivos storage: enviar na pasta do correspondente" on storage.objects;

/** O objeto pertence a um item (qualquer versão) que a pessoa vê? */
create or replace function public.arquivos_objeto_visivel(_user uuid, _caminho text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.arquivos_versoes v
     where v.storage_path = _caminho and public.arquivos_nivel(_user, v.no_id) >= 1)
  or exists (
    select 1 from public.arquivos_nos n
     where n.storage_path = _caminho and public.arquivos_nivel(_user, n.id) >= 1)
$$;
revoke all on function public.arquivos_objeto_visivel(uuid, text) from public, anon;
grant execute on function public.arquivos_objeto_visivel(uuid, text) to authenticated, service_role;

create policy "Arquivos storage: ler o que vejo" on storage.objects
  for select to authenticated
  using (bucket_id = 'arquivos' and public.arquivos_objeto_visivel((select auth.uid()), name));

-- Envio só dentro da pasta do próprio correspondente; quem registra é arquivos_registrar.
create policy "Arquivos storage: enviar na pasta do correspondente" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'arquivos'
              and (storage.foldername(name))[1] = public.correspondente_do_usuario((select auth.uid()))::text
              and public.usuario_tem_permissao((select auth.uid()), 'documentos.arquivos', 'view'));
-- Alterar/apagar objeto: só o servidor (service_role), depois de arquivos_excluir_definitivo.
