-- =============================================================================
-- Roteiro adversarial do gerenciador de Arquivos (migração 20261027040040).
--
-- Roda num banco com as migrações do Agilliza (base fiel `_eco-testes`), dentro de uma
-- transação que termina em ROLLBACK: não deixa nada para trás. Cada verificação grava em
-- __t; no fim, se alguma falhou, o script levanta erro (código de saída ≠ 0).
--
--   node <q.cjs> <banco> -f supabase/tests/arquivos_gerenciador.sql
--
-- Pessoas: dono (admin) e ana (só ver) do escritório A; beto (ver+enviar) e caio
-- (ver+enviar+excluir) do A; zeca, admin do escritório B; anônimo.
-- =============================================================================
begin;

create temp table __t (n serial, ok boolean, descricao text, detalhe text);
grant all on __t to public;
grant all on sequence __t_n_seq to public;
create temp table __u (k text primary key, v uuid);
grant all on __u to public;

create or replace function pg_temp.u(p text) returns uuid language sql stable as $$ select v from __u where k = p $$;
create or replace function pg_temp.ok(p boolean, d text, det text default null) returns void language sql as $$
  insert into __t (ok, descricao, detalhe) values (coalesce(p, false), d, det) $$;
-- Executa como a pessoa (papel authenticated + JWT do Supabase) e devolve 'ok' ou o SQLSTATE.
create or replace function pg_temp.como(p_quem text, p_sql text) returns text language plpgsql as $$
declare r text;
begin
  if p_quem = 'anon' then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    execute 'set local role anon';
  else
    perform set_config('request.jwt.claims', json_build_object('sub', pg_temp.u(p_quem), 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
  end if;
  begin
    execute p_sql;
    r := 'ok';
  exception when others then
    r := sqlstate || ': ' || sqlerrm;
  end;
  execute 'reset role';
  return r;
end $$;
-- Valor escalar como a pessoa.
create or replace function pg_temp.valor(p_quem text, p_sql text) returns text language plpgsql as $$
declare r text;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', pg_temp.u(p_quem), 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
  begin
    execute p_sql into r;
  exception when others then
    r := 'ERRO ' || sqlstate || ': ' || sqlerrm;
  end;
  execute 'reset role';
  return r;
end $$;
grant execute on function pg_temp.u(text), pg_temp.ok(boolean, text, text) to public;

-- ---------------------------------------------------------------------------
-- Montagem (sem gatilhos/FK de auth: a base fiel não tem tipos_pessoa nem usuários)
-- ---------------------------------------------------------------------------
set local session_replication_role = replica;
insert into __u values ('corrA', gen_random_uuid()), ('corrB', gen_random_uuid()),
  ('dono', gen_random_uuid()), ('ana', gen_random_uuid()), ('beto', gen_random_uuid()),
  ('caio', gen_random_uuid()), ('zeca', gen_random_uuid()),
  ('nv_ver', gen_random_uuid()), ('nv_env', gen_random_uuid()), ('nv_exc', gen_random_uuid()),
  ('nv_B', gen_random_uuid());
insert into public.access_levels (id, correspondente_id, nome, ativo)
values (pg_temp.u('nv_ver'), pg_temp.u('corrA'), 'Só ver', true),
       (pg_temp.u('nv_env'), pg_temp.u('corrA'), 'Comercial', true),
       (pg_temp.u('nv_exc'), pg_temp.u('corrA'), 'Analistas', true),
       (pg_temp.u('nv_B'), pg_temp.u('corrB'), 'Equipe B', true);
insert into public.profiles (id, correspondente_id, nome, email, nivel_acesso_id, acesso_tipo, ativo)
values (pg_temp.u('dono'), pg_temp.u('corrA'), 'Dono A', 'dono@a.t', null, 'sistema', true),
       (pg_temp.u('ana'),  pg_temp.u('corrA'), 'Ana',    'ana@a.t',  pg_temp.u('nv_ver'), 'sistema', true),
       (pg_temp.u('beto'), pg_temp.u('corrA'), 'Beto',   'beto@a.t', pg_temp.u('nv_env'), 'sistema', true),
       (pg_temp.u('caio'), pg_temp.u('corrA'), 'Caio',   'caio@a.t', pg_temp.u('nv_exc'), 'sistema', true),
       (pg_temp.u('zeca'), pg_temp.u('corrB'), 'Zeca',   'zeca@b.t', null, 'sistema', true);
insert into public.user_roles (user_id, role) values (pg_temp.u('dono'), 'admin'), (pg_temp.u('zeca'), 'admin'),
  (pg_temp.u('ana'), 'analista'), (pg_temp.u('beto'), 'comercial'), (pg_temp.u('caio'), 'analista');
insert into public.permissions (nivel_acesso_id, modulo, acao, permitido) values
  (pg_temp.u('nv_ver'), 'documentos.arquivos', 'view', true),
  (pg_temp.u('nv_env'), 'documentos.arquivos', 'view', true),
  (pg_temp.u('nv_env'), 'documentos.arquivos', 'create', true),
  (pg_temp.u('nv_exc'), 'documentos.arquivos', 'view', true),
  (pg_temp.u('nv_exc'), 'documentos.arquivos', 'create', true),
  (pg_temp.u('nv_exc'), 'documentos.arquivos', 'delete', true);
set local session_replication_role = origin;

-- Cota pequena para o teste (1 GB) — definida pelo dono.
select pg_temp.ok(pg_temp.como('dono', 'select public.arquivos_definir_cota(1)') = 'ok', 'dono define a cota');
select pg_temp.ok(pg_temp.como('caio', 'select public.arquivos_definir_cota(5000)') like '42501%', 'quem não é dono não muda a cota');
select pg_temp.ok(pg_temp.como('dono', 'select public.arquivos_definir_cota(0)') like '22023%', 'cota zero recusada');

-- ---------------------------------------------------------------------------
-- Pastas e envio
-- ---------------------------------------------------------------------------
insert into __u select 'contratos', pg_temp.valor('beto', $q$select public.arquivos_criar_pasta(null, 'Contratos')$q$)::uuid;
select pg_temp.ok(pg_temp.u('contratos') is not null, 'beto (enviar) cria pasta na raiz');
select pg_temp.ok(pg_temp.valor('beto', $q$select public.arquivos_criar_pasta(null, 'contratos ')$q$)::uuid = pg_temp.u('contratos'),
                  'pasta com o mesmo nome (maiúscula/espaço) devolve a existente, sem duplicar');
select pg_temp.ok(pg_temp.como('ana', $q$select public.arquivos_criar_pasta(null, 'Da Ana')$q$) like '42501%', 'ana (só ver) não cria pasta');
select pg_temp.ok(pg_temp.como('anon', $q$select public.arquivos_criar_pasta(null, 'X')$q$) like '42501%', 'anônimo não executa as funções');
select pg_temp.ok(pg_temp.como('beto', $q$select public.arquivos_criar_pasta(null, 'a/b')$q$) like '22023%', 'nome com barra recusado');

insert into __u select 'sub', pg_temp.valor('beto', format($q$select public.arquivos_criar_pasta(%L, 'Assinados')$q$, pg_temp.u('contratos')))::uuid;
insert into __u select 'arq', (pg_temp.valor('beto', format(
  $q$select public.arquivos_registrar(%L, 'contrato.pdf', %L, 'application/pdf', 1000) ->> 'id'$q$,
  pg_temp.u('sub'), pg_temp.u('corrA') || '/a1-contrato.pdf')))::uuid;
select pg_temp.ok(pg_temp.u('arq') is not null, 'beto registra arquivo na subpasta');
select pg_temp.ok(pg_temp.como('beto', format(
  $q$select public.arquivos_registrar(%L, 'contrato.pdf', %L, 'application/pdf', 10)$q$,
  pg_temp.u('sub'), pg_temp.u('corrA') || '/a2-contrato.pdf')) like '23505%', 'mesmo nome na mesma pasta sem "nova versão" é recusado');
select pg_temp.ok(pg_temp.valor('beto', format(
  $q$select public.arquivos_registrar(%L, 'Contrato.PDF', %L, 'application/pdf', 2000, true) ->> 'versao'$q$,
  pg_temp.u('sub'), pg_temp.u('corrA') || '/a3-contrato.pdf')) = '2', 'mesmo nome com "nova versão" vira a versão 2');
select pg_temp.ok(pg_temp.como('beto', format(
  $q$select public.arquivos_registrar(%L, 'x.pdf', %L, 'application/pdf', 10)$q$,
  pg_temp.u('sub'), pg_temp.u('corrB') || '/x.pdf')) like '22023%', 'caminho no bucket de outro escritório é recusado');
select pg_temp.ok(pg_temp.como('beto', format(
  $q$select public.arquivos_registrar(%L, 'y.pdf', %L, 'application/pdf', 10)$q$,
  pg_temp.u('sub'), pg_temp.u('corrA') || '/a1-contrato.pdf')) like '23505%', 'reaproveitar caminho já registrado é recusado');
select pg_temp.ok(pg_temp.como('beto', format(
  $q$select public.arquivos_registrar(%L, 'grande.zip', %L, 'application/zip', 2000000000)$q$,
  pg_temp.u('sub'), pg_temp.u('corrA') || '/a4-grande.zip')) like '53100%', 'cota estourada recusa o envio');
select pg_temp.ok(pg_temp.valor('beto', format($q$select public.arquivos_restaurar_versao(%L, 1)$q$, pg_temp.u('arq'))) = '3',
                  'voltar à versão 1 cria a versão 3');
select pg_temp.ok((select tamanho from public.arquivos_nos where id = pg_temp.u('arq')) = 1000, 'arquivo volta ao tamanho da versão 1');
select pg_temp.ok(pg_temp.valor('beto', $q$select (public.arquivos_armazenamento() ->> 'usado')$q$) = '3000',
                  'cota conta as versões (a restauração não ocupa espaço de novo)');

-- ---------------------------------------------------------------------------
-- Leitura e isolamento
-- ---------------------------------------------------------------------------
select pg_temp.ok(pg_temp.valor('ana', 'select count(*) from public.arquivos_nos') = '3', 'ana vê os 3 itens do escritório pela RLS');
select pg_temp.ok(pg_temp.valor('zeca', 'select count(*) from public.arquivos_nos') = '0', 'zeca (outro escritório, admin) não vê nada');
select pg_temp.ok(pg_temp.valor('zeca', format('select count(*) from public.arquivos_listar(%L)', pg_temp.u('contratos'))) like 'ERRO P0002%',
                  'zeca não lista pasta de outro escritório');
select pg_temp.ok(pg_temp.como('zeca', format($q$select public.arquivos_renomear(%L, 'hack')$q$, pg_temp.u('arq'))) like 'P0002%',
                  'zeca não renomeia item de outro escritório');
select pg_temp.ok(pg_temp.como('ana', format($q$update public.arquivos_nos set nome = 'x' where id = %L$q$, pg_temp.u('arq'))) like '42501%',
                  'escrita direta na tabela é negada (só pelas funções)');
select pg_temp.ok(pg_temp.como('ana', format($q$delete from public.arquivos_nos where id = %L$q$, pg_temp.u('arq'))) like '42501%',
                  'apagar direto na tabela é negado');
select pg_temp.ok(pg_temp.como('anon', 'select count(*) from public.arquivos_nos') like '42501%', 'anônimo não lê a tabela');
select pg_temp.ok(pg_temp.como('beto', 'select count(*) from public.arquivos_versoes') like '42501%', 'versões só pelas funções');

-- ---------------------------------------------------------------------------
-- Mover
-- ---------------------------------------------------------------------------
select pg_temp.ok(pg_temp.como('beto', format('select public.arquivos_mover(%L, %L)', pg_temp.u('contratos'), pg_temp.u('sub'))) like '22023%',
                  'mover pasta para dentro da própria subpasta é recusado');
select pg_temp.ok(pg_temp.como('beto', format('select public.arquivos_mover(%L, %L)', pg_temp.u('contratos'), pg_temp.u('contratos'))) like '22023%',
                  'mover pasta para dentro dela mesma é recusado');
select pg_temp.ok(pg_temp.como('beto', format('select public.arquivos_mover(%L, %L)', pg_temp.u('contratos'), pg_temp.u('arq'))) like '22023%',
                  'destino que é arquivo é recusado');
select pg_temp.ok(pg_temp.como('ana', format('select public.arquivos_mover(%L, null)', pg_temp.u('arq'))) like '42501%',
                  'ana (só ver) não move');
select pg_temp.ok(pg_temp.como('beto', format('select public.arquivos_mover(%L, null)', pg_temp.u('arq'))) = 'ok', 'beto move o arquivo para a raiz');

-- ---------------------------------------------------------------------------
-- Permissões por pasta / compartilhar
-- ---------------------------------------------------------------------------
insert into __u select 'rh', pg_temp.valor('caio', $q$select public.arquivos_criar_pasta(null, 'RH sigiloso')$q$)::uuid;
select pg_temp.ok(pg_temp.como('beto', format($q$select public.arquivos_definir_acesso(%L, true, '[]')$q$, pg_temp.u('rh'))) like '42501%',
                  'beto (sem excluir) não restringe pasta');
select pg_temp.ok(pg_temp.como('caio', format($q$select public.arquivos_definir_acesso(%L, true, %L)$q$, pg_temp.u('rh'),
                  json_build_array(json_build_object('user_id', pg_temp.u('ana'), 'nivel', 'ver'))::text)) = 'ok',
                  'caio restringe a pasta e compartilha com a ana (ver)');
insert into __u select 'folha', (pg_temp.valor('caio', format(
  $q$select public.arquivos_registrar(%L, 'folha.xlsx', %L, null, 50) ->> 'id'$q$, pg_temp.u('rh'), pg_temp.u('corrA') || '/rh-folha.xlsx')))::uuid;
select pg_temp.ok(pg_temp.valor('beto', format('select count(*) from public.arquivos_nos where id in (%L, %L)', pg_temp.u('rh'), pg_temp.u('folha'))) = '0',
                  'beto não vê a pasta restrita nem o que está dentro');
select pg_temp.ok(pg_temp.valor('beto', format('select count(*) from public.arquivos_listar(%L)', pg_temp.u('rh'))) like 'ERRO P0002%',
                  'beto não lista a pasta restrita (como se não existisse)');
select pg_temp.ok(pg_temp.como('beto', format($q$select public.arquivos_registrar(%L, 'z.txt', %L, null, 1)$q$, pg_temp.u('rh'), pg_temp.u('corrA') || '/z.txt')) like 'P0002%',
                  'beto não envia para dentro da pasta restrita');
select pg_temp.ok(pg_temp.valor('ana', format('select count(*) from public.arquivos_listar(%L)', pg_temp.u('rh'))) = '1',
                  'ana (compartilhada) lista a pasta restrita');
select pg_temp.ok(pg_temp.valor('ana', $q$select count(*) from public.arquivos_listar(null, 'compartilhados')$q$) = '1',
                  'a pasta aparece em "Compartilhados comigo" da ana');
select pg_temp.ok(pg_temp.como('ana', format($q$select public.arquivos_renomear(%L, 'x.xlsx')$q$, pg_temp.u('folha'))) like '42501%',
                  'ana (ver) não renomeia dentro da pasta compartilhada');
select pg_temp.ok(pg_temp.valor('dono', format('select count(*) from public.arquivos_listar(%L)', pg_temp.u('rh'))) = '1',
                  'dono/admin sempre vê a pasta restrita');
-- Compartilhar com a equipe (nível de acesso) do beto, com edição
select pg_temp.ok(pg_temp.como('caio', format($q$select public.arquivos_definir_acesso(%L, true, %L)$q$, pg_temp.u('rh'),
                  json_build_array(json_build_object('nivel_acesso_id', pg_temp.u('nv_env'), 'nivel', 'editar'))::text)) = 'ok',
                  'caio compartilha com a equipe Comercial (editar)');
select pg_temp.ok(pg_temp.como('beto', format($q$select public.arquivos_renomear(%L, 'folha-out.xlsx')$q$, pg_temp.u('folha'))) = 'ok',
                  'beto (equipe com editar) renomeia dentro da pasta');
select pg_temp.ok(pg_temp.valor('ana', format('select count(*) from public.arquivos_listar(%L)', pg_temp.u('rh'))) like 'ERRO P0002%',
                  'ana perdeu o acesso ao sair da lista');
select pg_temp.ok(pg_temp.como('caio', format($q$select public.arquivos_definir_acesso(%L, true, %L)$q$, pg_temp.u('rh'),
                  json_build_array(json_build_object('nivel_acesso_id', pg_temp.u('nv_B'), 'nivel', 'gerir'))::text)) like '22023%',
                  'compartilhar com equipe de outro escritório é recusado');
select pg_temp.ok(pg_temp.como('caio', format($q$select public.arquivos_definir_acesso(%L, true, %L)$q$, pg_temp.u('rh'),
                  json_build_array(json_build_object('user_id', pg_temp.u('zeca'), 'nivel', 'gerir'))::text)) like '22023%',
                  'compartilhar com pessoa de outro escritório é recusado');
select pg_temp.ok(pg_temp.como('caio', format($q$select public.arquivos_definir_acesso(%L, true, %L)$q$, pg_temp.u('rh'),
                  '[{"user_id":null,"nivel":"ver"}]')) like '22023%', 'acesso sem alvo é recusado');
select pg_temp.ok(pg_temp.como('caio', format($q$select public.arquivos_definir_acesso(%L, true, %L)$q$, pg_temp.u('rh'),
                  json_build_array(json_build_object('user_id', pg_temp.u('ana'), 'nivel', 'dono'))::text)) like '22023%', 'nível inexistente é recusado');

-- Storage: ler o objeto só de quem vê o item
select pg_temp.ok(pg_temp.valor('beto', format('select public.arquivos_objeto_visivel(%L, %L)', pg_temp.u('beto'), pg_temp.u('corrA') || '/a1-contrato.pdf')) = 'true',
                  'beto pode ler o objeto de uma versão do arquivo que ele vê');
select pg_temp.ok(pg_temp.valor('ana', format('select public.arquivos_objeto_visivel(%L, %L)', pg_temp.u('ana'), pg_temp.u('corrA') || '/rh-folha.xlsx')) = 'false',
                  'ana (sem acesso à pasta) não lê o objeto');
select pg_temp.ok(pg_temp.valor('zeca', format('select public.arquivos_objeto_visivel(%L, %L)', pg_temp.u('zeca'), pg_temp.u('corrA') || '/a1-contrato.pdf')) = 'false',
                  'outro escritório não lê o objeto');

-- ---------------------------------------------------------------------------
-- Lixeira
-- ---------------------------------------------------------------------------
select pg_temp.ok(pg_temp.como('beto', format('select public.arquivos_para_lixeira(%L)', pg_temp.u('contratos'))) like '42501%',
                  'beto (sem excluir) não manda para a lixeira');
select pg_temp.ok(pg_temp.como('caio', format('select public.arquivos_para_lixeira(%L)', pg_temp.u('contratos'))) = 'ok',
                  'caio manda a pasta para a lixeira');
select pg_temp.ok((select count(*) from public.arquivos_nos where id in (pg_temp.u('contratos'), pg_temp.u('sub')) and excluido_em is not null) = 2,
                  'a subpasta vai junto para a lixeira');
select pg_temp.ok(pg_temp.valor('caio', $q$select count(*) from public.arquivos_lixeira()$q$) = '1', 'a lixeira lista só o item mandado (não os de baixo)');
select pg_temp.ok(pg_temp.valor('caio', $q$select count(*) from public.arquivos_listar(null)$q$) = '2', 'a raiz não mostra o que está na lixeira');
select pg_temp.ok(pg_temp.como('beto', format($q$select public.arquivos_registrar(%L, 'w.txt', %L, null, 1)$q$, pg_temp.u('sub'), pg_temp.u('corrA') || '/w.txt')) like '22023%',
                  'não dá para enviar para pasta na lixeira');
select pg_temp.ok(pg_temp.como('caio', format('select public.arquivos_restaurar(%L)', pg_temp.u('sub'))) like '22023%',
                  'restaurar item de baixo (não mandado) é recusado');
-- nome ocupado na raiz enquanto estava na lixeira
select pg_temp.valor('beto', $q$select public.arquivos_criar_pasta(null, 'Contratos')$q$);
select pg_temp.ok(pg_temp.como('caio', format('select public.arquivos_restaurar(%L)', pg_temp.u('contratos'))) = 'ok', 'caio restaura a pasta');
select pg_temp.ok((select nome from public.arquivos_nos where id = pg_temp.u('contratos')) = 'Contratos (restaurado)',
                  'nome ocupado no destino: volta como "(restaurado)"');
select pg_temp.ok((select excluido_em is null from public.arquivos_nos where id = pg_temp.u('sub')), 'a subpasta volta junto');
-- excluir para sempre
select pg_temp.ok(pg_temp.como('caio', format('select public.arquivos_excluir_definitivo(%L)', pg_temp.u('arq'))) like '22023%',
                  'excluir para sempre fora da lixeira é recusado');
select pg_temp.ok(pg_temp.como('caio', format('select public.arquivos_para_lixeira(%L)', pg_temp.u('arq'))) = 'ok', 'arquivo para a lixeira');
select pg_temp.ok(pg_temp.valor('caio', format('select array_length(public.arquivos_excluir_definitivo(%L), 1)', pg_temp.u('arq'))) = '2',
                  'exclusão definitiva devolve os 2 objetos distintos para o servidor apagar');
select pg_temp.ok(not exists (select 1 from public.arquivos_versoes where no_id = pg_temp.u('arq')), 'versões saem junto');
select pg_temp.ok(pg_temp.valor('beto', $q$select (public.arquivos_armazenamento() ->> 'usado')$q$) = '50', 'espaço liberado na cota');

-- Favoritos e etiquetas
select pg_temp.ok(pg_temp.valor('ana', format('select public.arquivos_favoritar(%L)', pg_temp.u('contratos'))) = 'true', 'ana favorita (só ver basta)');
select pg_temp.ok(pg_temp.valor('ana', $q$select count(*) from public.arquivos_listar(null, 'favoritos')$q$) = '1', 'favorito aparece na visão de favoritos');
select pg_temp.ok(pg_temp.valor('beto', $q$select count(*) from public.arquivos_listar(null, 'favoritos')$q$) = '0', 'favorito é por pessoa');
select pg_temp.ok(pg_temp.como('ana', format($q$select public.arquivos_etiquetar(%L, '{a}')$q$, pg_temp.u('contratos'))) like '42501%', 'ana (ver) não etiqueta');
select pg_temp.ok(pg_temp.valor('beto', format($q$select array_to_string(public.arquivos_etiquetar(%L, '{" Itaú ",itaú,2026,""}'), ',')$q$, pg_temp.u('contratos'))) = '2026,itaú',
                  'etiquetas normalizadas, sem repetir nem vazias');
select pg_temp.ok(pg_temp.valor('beto', $q$select count(*) from public.arquivos_listar(null, 'busca', null, 'itaú')$q$) = '1', 'busca por etiqueta');
select pg_temp.ok(pg_temp.valor('beto', $q$select count(*) from public.arquivos_listar(null, 'busca', 'CONTRATÓS')$q$) = '2', 'busca por nome sem acento/maiúscula (as duas pastas Contratos)');
select pg_temp.ok(pg_temp.como('beto', $q$select public.arquivos_listar(null, 'tudo')$q$) like '22023%', 'visão inválida recusada');

-- ---------------------------------------------------------------------------
do $$
declare f record; n int := 0; total int;
begin
  select count(*) into total from __t;
  for f in select * from __t order by n loop
    if not f.ok then
      n := n + 1;
      raise warning 'FALHOU #%: %', f.n, f.descricao;
    end if;
  end loop;
  if n > 0 then raise exception '% de % verificações falharam', n, total; end if;
  raise notice 'arquivos_gerenciador: % verificações, todas passaram', total;
end $$;
rollback;
