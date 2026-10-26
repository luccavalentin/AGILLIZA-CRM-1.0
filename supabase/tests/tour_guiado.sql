-- =============================================================================
-- Roteiro adversarial do tour guiado (migração 20261027130001).
--
-- Roda num banco com as migrações do Agilliza (base fiel `_eco-testes`), dentro de uma
-- transação que termina em ROLLBACK: não deixa nada para trás. Cada verificação grava em
-- __t; no fim, se alguma falhou, o script levanta erro (código de saída ≠ 0).
--
-- Pessoas: ana e beto (equipe, papel authenticated), anônimo, sem sessão (JWT sem `sub`).
-- Clientes do portal (só o servidor, papel service_role): c1 e c2 com acesso, c3 revogado.
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
-- Executa como a pessoa (papel + JWT do Supabase) e devolve o valor (texto) ou 'ERRO <sqlstate>'.
create or replace function pg_temp.como(p_quem text, p_sql text) returns text language plpgsql as $$
declare r text;
begin
  if p_quem = 'anon' then
    perform set_config('request.jwt.claims', '{"role":"anon"}', true);
    execute 'set local role anon';
  elsif p_quem = 'servidor' then
    perform set_config('request.jwt.claims', '{"role":"service_role"}', true);
    execute 'set local role service_role';
  elsif p_quem = 'sem_sessao' then
    perform set_config('request.jwt.claims', '{"role":"authenticated"}', true);
    execute 'set local role authenticated';
  else
    perform set_config('request.jwt.claims', json_build_object('sub', pg_temp.u(p_quem), 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
  end if;
  begin
    execute p_sql into r;
    r := coalesce(r, 'ok');
  exception when others then
    r := 'ERRO ' || sqlstate;
  end;
  execute 'reset role';
  return r;
end $$;
grant execute on function pg_temp.u(text), pg_temp.ok(boolean, text, text) to public;

-- ---------------------------------------------------------------------------
-- Montagem (sem gatilhos/FK de auth: a base fiel não tem tipos_pessoa nem usuários)
-- ---------------------------------------------------------------------------
set local session_replication_role = replica;
insert into __u values ('ana', gen_random_uuid()), ('beto', gen_random_uuid()), ('corr', gen_random_uuid()),
  ('c1', gen_random_uuid()), ('c2', gen_random_uuid()), ('c3', gen_random_uuid());
insert into public.clientes (id, correspondente_id, numero_cliente, nome, documento, portal_acesso_ativo)
values (pg_temp.u('c1'), pg_temp.u('corr'), 'T-1', 'Cliente Um', '00000000001', true),
       (pg_temp.u('c2'), pg_temp.u('corr'), 'T-2', 'Cliente Dois', '00000000002', true),
       (pg_temp.u('c3'), pg_temp.u('corr'), 'T-3', 'Cliente Revogado', '00000000003', false);

-- ---------------------------------------------------------------------------
-- Estrutura e permissões
-- ---------------------------------------------------------------------------
select pg_temp.ok((select bool_and(relrowsecurity) from pg_class
                    where oid in ('public.tour_progresso'::regclass, 'public.tour_preferencias'::regclass,
                                  'public.tour_progresso_cliente'::regclass, 'public.tour_preferencias_cliente'::regclass)),
                  'RLS ligada nas 4 tabelas');
select pg_temp.ok(not has_table_privilege('anon', 'public.tour_progresso', 'select')
              and not has_table_privilege('anon', 'public.tour_preferencias', 'select')
              and not has_table_privilege('anon', 'public.tour_progresso_cliente', 'select'),
                  'anônimo não lê nenhuma tabela do tour');
select pg_temp.ok(not has_table_privilege('authenticated', 'public.tour_progresso', 'insert')
              and not has_table_privilege('authenticated', 'public.tour_progresso', 'update')
              and not has_table_privilege('authenticated', 'public.tour_progresso', 'delete'),
                  'equipe não grava direto na tabela (só pelas funções)');
select pg_temp.ok(not has_table_privilege('authenticated', 'public.tour_progresso_cliente', 'select')
              and not has_table_privilege('authenticated', 'public.tour_preferencias_cliente', 'select'),
                  'equipe não lê o progresso dos clientes');
select pg_temp.ok(not has_function_privilege('anon', 'public.tour_estado(text[])', 'execute')
              and not has_function_privilege('anon', 'public.tour_registrar(text, integer, text, integer)', 'execute')
              and not has_function_privilege('anon', 'public.tour_reiniciar(text)', 'execute')
              and not has_function_privilege('anon', 'public.tour_automatico(boolean)', 'execute'),
                  'anônimo não executa as funções da equipe');
select pg_temp.ok(not has_function_privilege('authenticated', 'public.portal_cliente_tour_registrar(uuid, text, integer, text, integer)', 'execute')
              and not has_function_privilege('anon', 'public.portal_cliente_tour_estado(uuid, text[])', 'execute')
              and has_function_privilege('service_role', 'public.portal_cliente_tour_estado(uuid, text[])', 'execute'),
                  'funções do portal: só o servidor (service_role)');
select pg_temp.ok(not has_function_privilege('authenticated', 'public._tour_eu()', 'execute')
              and not has_function_privilege('authenticated', 'public._tour_cliente(uuid)', 'execute'),
                  'funções internas fechadas');
select pg_temp.ok(pg_temp.como('anon', $q$select public.tour_estado('{crm.clientes}')$q$) = 'ERRO 42501', 'anônimo chamando tour_estado é recusado');
select pg_temp.ok(pg_temp.como('anon', $q$select count(*) from public.tour_progresso$q$) = 'ERRO 42501', 'anônimo lendo a tabela é recusado');
select pg_temp.ok(pg_temp.como('sem_sessao', $q$select public.tour_registrar('crm.clientes', 1, 'concluido', 0)$q$) = 'ERRO 42501',
                  'JWT sem pessoa não grava');

-- ---------------------------------------------------------------------------
-- Equipe: cada um só o seu
-- ---------------------------------------------------------------------------
select pg_temp.ok(pg_temp.como('ana', $q$select public.tour_estado('{crm.clientes}')::text$q$) = '{"telas": {}, "automatico": true}',
                  'primeira visita: nada visto e abrir sozinho ligado');
select pg_temp.ok(pg_temp.como('ana', $q$select public.tour_registrar('crm.clientes', 1, 'concluido', 3)->>'gravado'$q$) = 'true', 'ana conclui o tour de Clientes');
select pg_temp.ok(pg_temp.como('ana', $q$select public.tour_estado('{crm.clientes,news}')->'telas'->'crm.clientes'->>'estado'$q$) = 'concluido',
                  'ana vê o próprio progresso');
select pg_temp.ok(pg_temp.como('beto', $q$select public.tour_estado('{crm.clientes}')->'telas'->>'crm.clientes'$q$) = 'ok',
                  'beto não vê o progresso da ana (tela dele vazia)');
select pg_temp.ok(pg_temp.como('beto', $q$select count(*)::text from public.tour_progresso$q$) = '0', 'RLS: beto lê 0 linhas da tabela');
select pg_temp.ok(pg_temp.como('ana', $q$select count(*)::text from public.tour_progresso$q$) = '1', 'RLS: ana lê só a linha dela');
select pg_temp.ok(pg_temp.como('beto', format($q$insert into public.tour_progresso (user_id, tela, versao, estado) values (%L, 'news', 1, 'pulado') returning 'gravou'$q$, pg_temp.u('ana'))) = 'ERRO 42501',
                  'beto não grava progresso no nome da ana');
select pg_temp.ok(pg_temp.como('beto', $q$update public.tour_progresso set estado = 'andamento' returning 'mudou'$q$) = 'ERRO 42501',
                  'beto não altera progresso alheio');
select pg_temp.ok(pg_temp.como('beto', $q$delete from public.tour_progresso returning 'apagou'$q$) = 'ERRO 42501',
                  'beto não apaga progresso alheio');
select pg_temp.ok(pg_temp.como('beto', $q$select public.tour_reiniciar(null)::text$q$) = '0', 'reiniciar do beto apaga 0 linhas');
select pg_temp.ok((select estado from public.tour_progresso where user_id = pg_temp.u('ana') and tela = 'crm.clientes') = 'concluido',
                  'progresso da ana continua lá');

-- ---------------------------------------------------------------------------
-- Regras de estado e versão
-- ---------------------------------------------------------------------------
select pg_temp.como('ana', $q$select public.tour_registrar('crm.clientes', 1, 'andamento', 1)::text$q$);
select pg_temp.ok((select estado from public.tour_progresso where user_id = pg_temp.u('ana') and tela = 'crm.clientes') = 'concluido',
                  'concluído não volta a andamento na mesma versão (outro aparelho)');
select pg_temp.como('ana', $q$select public.tour_registrar('crm.clientes', 3, 'andamento', 2)::text$q$);
select pg_temp.ok((select versao || ':' || estado || ':' || passo from public.tour_progresso where user_id = pg_temp.u('ana') and tela = 'crm.clientes') = '3:andamento:2',
                  'versão nova do roteiro recomeça (andamento, passo salvo)');
select pg_temp.como('ana', $q$select public.tour_registrar('crm.clientes', 2, 'concluido', 0)::text$q$);
select pg_temp.ok((select versao::text from public.tour_progresso where user_id = pg_temp.u('ana') and tela = 'crm.clientes') = '3',
                  'versão antiga não sobrescreve a nova');
select pg_temp.ok(pg_temp.como('ana', $q$select public.tour_registrar('  CRM.Painel ', 1, 'pulado', 0)->>'gravado'$q$) = 'true',
                  'chave com espaço e maiúscula é aceita');
select pg_temp.ok(exists (select 1 from public.tour_progresso where user_id = pg_temp.u('ana') and tela = 'crm.painel'),
                  'e gravada normalizada (crm.painel)');

-- ---------------------------------------------------------------------------
-- Entrada torta
-- ---------------------------------------------------------------------------
select pg_temp.ok(pg_temp.como('ana', $q$select public.tour_registrar('crm clientes', 1, 'concluido', 0)$q$) = 'ERRO 22023', 'tela com espaço recusada');
select pg_temp.ok(pg_temp.como('ana', $q$select public.tour_registrar('../admin', 1, 'concluido', 0)$q$) = 'ERRO 22023', 'tela com ../ recusada');
select pg_temp.ok(pg_temp.como('ana', $q$select public.tour_registrar(''';drop table public.clientes;--', 1, 'concluido', 0)$q$) = 'ERRO 22023', 'injeção na chave recusada');
select pg_temp.ok(pg_temp.como('ana', $q$select public.tour_registrar(null, 1, 'concluido', 0)$q$) = 'ERRO 22023', 'tela nula recusada');
select pg_temp.ok(pg_temp.como('ana', format($q$select public.tour_registrar(%L, 1, 'concluido', 0)$q$, 'a' || repeat('b', 80))) = 'ERRO 22023', 'tela com 81 caracteres recusada');
select pg_temp.ok(pg_temp.como('ana', $q$select public.tour_registrar('news', 0, 'concluido', 0)$q$) = 'ERRO 22023', 'versão 0 recusada');
select pg_temp.ok(pg_temp.como('ana', $q$select public.tour_registrar('news', 1001, 'concluido', 0)$q$) = 'ERRO 22023', 'versão 1001 recusada');
select pg_temp.ok(pg_temp.como('ana', $q$select public.tour_registrar('news', null, 'concluido', 0)$q$) = 'ERRO 22023', 'versão nula recusada');
select pg_temp.ok(pg_temp.como('ana', $q$select public.tour_registrar('news', 1, 'feito', 0)$q$) = 'ERRO 22023', 'estado desconhecido recusado');
select pg_temp.ok(pg_temp.como('ana', $q$select public.tour_registrar('news', 1, 'concluido', -1)$q$) = 'ERRO 22023', 'passo negativo recusado');
select pg_temp.ok(pg_temp.como('ana', $q$select public.tour_registrar('news', 1, 'concluido', 101)$q$) = 'ERRO 22023', 'passo 101 recusado');
select pg_temp.ok(pg_temp.como('ana', $q$select public.tour_estado(array(select 't' || g from generate_series(1, 41) g))$q$) = 'ERRO 22023',
                  'estado de 41 telas de uma vez recusado');
select pg_temp.ok(pg_temp.como('ana', $q$select public.tour_estado(null)->>'automatico'$q$) = 'true', 'lista nula de telas não quebra');
select pg_temp.ok(pg_temp.como('ana', $q$select public.tour_automatico(null)$q$) = 'ERRO 22023', 'abrir sozinho nulo recusado');

-- ---------------------------------------------------------------------------
-- Preferência "abrir sozinho"
-- ---------------------------------------------------------------------------
select pg_temp.como('ana', $q$select public.tour_automatico(false)::text$q$);
select pg_temp.ok(pg_temp.como('ana', $q$select public.tour_estado('{}')->>'automatico'$q$) = 'false', 'ana desliga a abertura automática');
select pg_temp.ok(pg_temp.como('beto', $q$select public.tour_estado('{}')->>'automatico'$q$) = 'true', 'a preferência da ana não muda a do beto');
select pg_temp.ok(pg_temp.como('beto', format($q$update public.tour_preferencias set automatico = true where user_id = %L returning 'mudou'$q$, pg_temp.u('ana'))) = 'ERRO 42501',
                  'beto não muda a preferência da ana direto na tabela');

-- ---------------------------------------------------------------------------
-- Limite de telas por pessoa (600)
-- ---------------------------------------------------------------------------
insert into public.tour_progresso (user_id, tela, versao, estado)
select pg_temp.u('beto'), 'carga.t' || g, 1, 'concluido' from generate_series(1, 600) g;
select pg_temp.ok(pg_temp.como('beto', $q$select public.tour_registrar('crm.clientes', 1, 'concluido', 0)$q$) = 'ERRO 54000',
                  'tela nova além de 600 recusada');
select pg_temp.ok(pg_temp.como('beto', $q$select public.tour_registrar('carga.t1', 2, 'andamento', 1)->>'gravado'$q$) = 'true',
                  'tela já existente continua atualizando no limite');
select pg_temp.ok(pg_temp.como('ana', $q$select public.tour_registrar('crm.clientes.novo', 1, 'concluido', 0)->>'gravado'$q$) = 'true',
                  'o limite do beto não afeta a ana');
select pg_temp.ok(pg_temp.como('beto', $q$select public.tour_reiniciar(null)::text$q$) = '600', 'reiniciar apaga só as do beto (600)');
select pg_temp.ok(exists (select 1 from public.tour_progresso where user_id = pg_temp.u('ana')), 'as da ana ficam');

-- ---------------------------------------------------------------------------
-- Portal do cliente (só o servidor chama, com o id do cookie)
-- ---------------------------------------------------------------------------
select pg_temp.ok(pg_temp.como('ana', format($q$select public.portal_cliente_tour_estado(%L, '{cliente.visao-geral}')$q$, pg_temp.u('c1'))) = 'ERRO 42501',
                  'equipe não chama a função do portal');
select pg_temp.ok(pg_temp.como('anon', format($q$select public.portal_cliente_tour_registrar(%L, 'cliente.visao-geral', 1, 'concluido', 0)$q$, pg_temp.u('c1'))) = 'ERRO 42501',
                  'anônimo não chama a função do portal');
select pg_temp.ok(pg_temp.como('servidor', format($q$select public.portal_cliente_tour_registrar(%L, 'cliente.visao-geral', 1, 'concluido', 4)->>'gravado'$q$, pg_temp.u('c1'))) = 'true',
                  'c1 conclui o tour do Início');
select pg_temp.ok(pg_temp.como('servidor', format($q$select public.portal_cliente_tour_estado(%L, '{cliente.visao-geral}')->'telas'->'cliente.visao-geral'->>'estado'$q$, pg_temp.u('c1'))) = 'concluido',
                  'c1 vê o próprio progresso');
select pg_temp.ok(pg_temp.como('servidor', format($q$select public.portal_cliente_tour_estado(%L, '{cliente.visao-geral}')->'telas'->>'cliente.visao-geral'$q$, pg_temp.u('c2'))) = 'ok',
                  'c2 não vê o progresso do c1');
select pg_temp.ok(pg_temp.como('servidor', format($q$select public.portal_cliente_tour_reiniciar(%L)::text$q$, pg_temp.u('c2'))) = '0',
                  'reiniciar do c2 não apaga o do c1');
select pg_temp.como('servidor', format($q$select public.portal_cliente_tour_registrar(%L, 'cliente.visao-geral', 1, 'andamento', 0)::text$q$, pg_temp.u('c1')));
select pg_temp.ok((select estado from public.tour_progresso_cliente where cliente_id = pg_temp.u('c1') and tela = 'cliente.visao-geral') = 'concluido',
                  'cliente: concluído não volta a andamento na mesma versão');
select pg_temp.ok(pg_temp.como('servidor', format($q$select public.portal_cliente_tour_estado(%L, '{}')$q$, pg_temp.u('c3'))) = 'ERRO 42501',
                  'cliente com acesso revogado não lê');
select pg_temp.ok(pg_temp.como('servidor', format($q$select public.portal_cliente_tour_registrar(%L, 'cliente.chat', 1, 'concluido', 0)$q$, pg_temp.u('c3'))) = 'ERRO 42501',
                  'cliente com acesso revogado não grava');
select pg_temp.ok(pg_temp.como('servidor', $q$select public.portal_cliente_tour_estado(null, '{}')$q$) = 'ERRO 42501', 'cliente nulo recusado');
select pg_temp.ok(pg_temp.como('servidor', format($q$select public.portal_cliente_tour_estado(%L, '{}')$q$, gen_random_uuid())) = 'ERRO 42501',
                  'cliente inexistente recusado');
select pg_temp.ok(pg_temp.como('servidor', format($q$select public.portal_cliente_tour_registrar(%L, 'Cliente Chat!', 1, 'concluido', 0)$q$, pg_temp.u('c1'))) = 'ERRO 22023',
                  'cliente: chave torta recusada');
select pg_temp.ok(pg_temp.como('servidor', format($q$select public.portal_cliente_tour_estado(%L, array(select 't' || g from generate_series(1, 41) g))$q$, pg_temp.u('c1'))) = 'ERRO 22023',
                  'cliente: 41 telas de uma vez recusado');
select pg_temp.como('servidor', format($q$select public.portal_cliente_tour_automatico(%L, false)::text$q$, pg_temp.u('c1')));
select pg_temp.ok(pg_temp.como('servidor', format($q$select public.portal_cliente_tour_estado(%L, '{}')->>'automatico'$q$, pg_temp.u('c1'))) = 'false'
              and pg_temp.como('servidor', format($q$select public.portal_cliente_tour_estado(%L, '{}')->>'automatico'$q$, pg_temp.u('c2'))) = 'true',
                  'cliente: preferência por cliente');
insert into public.tour_progresso_cliente (cliente_id, tela, versao, estado)
select pg_temp.u('c2'), 'carga.t' || g, 1, 'concluido' from generate_series(1, 600) g;
select pg_temp.ok(pg_temp.como('servidor', format($q$select public.portal_cliente_tour_registrar(%L, 'cliente.chat', 1, 'concluido', 0)$q$, pg_temp.u('c2'))) = 'ERRO 54000',
                  'cliente: limite de 600 telas');

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
  raise notice 'tour_guiado: % verificações, todas passaram', total;
end $$;
rollback;
