-- Produção do ecossistema (0306, frente a1): permissão, filtros, Sua base x Assinantes,
-- carteira ("Minha"), usuário, contrato pela data de emissão e entradas tortas.
-- PROPOSTA para packages/db/testes/705_producao_do_ecossistema.sql (Agilliza Tech).
select plan(24);
select teste.sair();
select teste.novo_usuario('tecnico_p','plataforma',teste.tid('operador_x'),'operacoes_tecnicas');

-- Sem permissão de crédito: recusa
select teste.entrar('tecnico_p');
select throws_ok($$select plataforma.producao_do_ecossistema(jsonb_build_object('base','assinantes','de',current_date,'ate',current_date,'anterior_de',current_date-1,'anterior_ate',current_date-1))$$,
  '42501', null, 'operações técnicas não vê a produção');

-- Entradas tortas
select teste.entrar('operador_x');
select throws_ok($$select plataforma.producao_do_ecossistema(jsonb_build_object('base','todas','de',current_date,'ate',current_date,'anterior_de',current_date-1,'anterior_ate',current_date-1))$$,
  '22023', null, 'base desconhecida é recusada');
select throws_ok($$select plataforma.producao_do_ecossistema(jsonb_build_object('base','assinante','de',current_date,'ate',current_date,'anterior_de',current_date-1,'anterior_ate',current_date-1))$$,
  '22023', null, 'um assinante exige a licença');
select throws_ok($$select plataforma.producao_do_ecossistema(jsonb_build_object('base','assinantes','de',current_date,'ate',current_date-5,'anterior_de',current_date-1,'anterior_ate',current_date-1))$$,
  '22023', null, 'período invertido é recusado');
select throws_ok($$select plataforma.producao_do_ecossistema(jsonb_build_object('base','assinantes','de',current_date-500,'ate',current_date,'anterior_de',current_date-1001,'anterior_ate',current_date-501))$$,
  '22023', null, 'período acima de 400 dias é recusado');
select throws_ok($$select plataforma.producao_do_ecossistema('{"base":"assinantes"}')$$,
  '22023', null, 'sem datas é recusado');

-- Assinantes: bate com as listas que já existem (mesmo período)
create temp table _p on commit drop as
select plataforma.producao_do_ecossistema(jsonb_build_object('base','assinantes',
  'de',current_date-1,'ate',current_date+1,'anterior_de',current_date-4,'anterior_ate',current_date-2)) as r;
select is((select (r->'atual'->>'propostas')::int from _p),
          (plataforma.consultar_propostas(jsonb_build_object('origem','licenca','de',current_date-1,'ate',current_date+1))->>'total')::int,
          'propostas dos assinantes = consultar_propostas');
select is((select (r->'atual'->>'simulacoes')::int from _p),
          (plataforma.consultar_simulacoes(jsonb_build_object('origem','licenca','de',current_date-1,'ate',current_date+1))->>'total')::int,
          'simulações dos assinantes = consultar_simulacoes');
select is((select (r->'anterior'->>'propostas')::int from _p), 0, 'período anterior separado');
select is((select jsonb_array_length(r->'serie') from _p), 3, 'série com um ponto por dia do período');
select is((select (r->'atual'->>'contratos')::int from _p), 0, 'sem contrato ainda');

-- Contrato emitido e registrado conta pela data de emissão, com o valor aprovado
select teste.sair();
update operacional.propostas set status = 'registrado', contrato_emitido_em = now(), valor_aprovado = 250000
 where id = teste.id('proposta_B');
select teste.entrar('operador_x');
create temp table _c on commit drop as
select plataforma.producao_do_ecossistema(jsonb_build_object('base','assinantes',
  'de',current_date-1,'ate',current_date+1,'anterior_de',current_date-4,'anterior_ate',current_date-2)) as r;
select is((select (r->'atual'->>'contratos')::int from _c), 1, 'contrato emitido conta');
select is((select (r->'atual'->>'registrados')::int from _c), 1, 'registrado conta entre os emitidos');
select is((select (r->'atual'->>'valor')::numeric from _c), 250000::numeric, 'valor financiado = valor aprovado');
select is((select (r->'atual'->>'aprovadas')::int from _c), 0, 'contrato não conta como crédito aprovado');

-- Um assinante: só a conta dele
select is((select count(*) from jsonb_array_elements(
             plataforma.producao_do_ecossistema(jsonb_build_object('base','assinante','licenca',teste.id('tenant_b'),
               'de',current_date-1,'ate',current_date+1,'anterior_de',current_date-4,'anterior_ate',current_date-2))->'rankingContas') e
           where e->>'id' <> teste.id('tenant_b')::text)::int, 0, 'um assinante não mistura outras contas');

-- Conta vinculada ao correspondente sai de Assinantes e entra na Sua base
select teste.sair();
update nucleo.tenants set vinculo_agilliza = true where id = teste.id('tenant_a');
select teste.entrar('operador_x');
select ok(not exists (select 1 from jsonb_array_elements(
             plataforma.producao_do_ecossistema(jsonb_build_object('base','assinantes',
               'de',current_date-1,'ate',current_date+1,'anterior_de',current_date-4,'anterior_ate',current_date-2))->'rankingContas') e
           where e->>'id' = teste.id('tenant_a')::text), 'vinculada não aparece em Assinantes');
select ok(exists (select 1 from jsonb_array_elements(
             plataforma.producao_do_ecossistema(jsonb_build_object('base','sua_base',
               'de',current_date-1,'ate',current_date+1,'anterior_de',current_date-4,'anterior_ate',current_date-2))->'rankingContas') e
           where e->>'id' = teste.id('tenant_a')::text), 'vinculada aparece na Sua base');

-- "Minha" = carteira da pessoa
select is((plataforma.producao_do_ecossistema(jsonb_build_object('base','assinantes','minha',true,
             'de',current_date-1,'ate',current_date+1,'anterior_de',current_date-4,'anterior_ate',current_date-2))->'atual'->>'propostas')::int,
          0, 'sem carteira, Minha vem zerada');
select teste.sair();
insert into plataforma.carteira(tenant_id, analista_id) values (teste.id('tenant_b'), teste.uid('operador_x'))
  on conflict (tenant_id) do update set analista_id = excluded.analista_id;
select teste.entrar('operador_x');
select is((plataforma.producao_do_ecossistema(jsonb_build_object('base','assinantes','minha',true,
             'de',current_date-1,'ate',current_date+1,'anterior_de',current_date-4,'anterior_ate',current_date-2))->'atual'->>'contratos')::int,
          1, 'Minha traz a conta da carteira');
select is((select count(*) from jsonb_array_elements(
             plataforma.producao_do_ecossistema(jsonb_build_object('base','assinantes','minha',true,
               'de',current_date-1,'ate',current_date+1,'anterior_de',current_date-4,'anterior_ate',current_date-2))->'rankingContas'))::int,
          1, 'Minha não traz conta fora da carteira');

-- Usuário: filtra e o ranking usa o id prefixado do Tech
select is((plataforma.producao_do_ecossistema(jsonb_build_object('base','assinantes','usuario',teste.uid('suporte_x'),
             'de',current_date-1,'ate',current_date+1,'anterior_de',current_date-4,'anterior_ate',current_date-2))->'atual'->>'propostas')::int,
          0, 'usuário sem produção vem zerado');
select ok((select bool_and(e->>'id' like 't:%') from jsonb_array_elements(
             plataforma.producao_do_ecossistema(jsonb_build_object('base','sua_base',
               'de',current_date-1,'ate',current_date+1,'anterior_de',current_date-4,'anterior_ate',current_date-2))->'rankingUsuarios') e),
          'ranking de usuários com id do Tech prefixado');

-- Série mensal acima de 62 dias
select is((select jsonb_array_length(plataforma.producao_do_ecossistema(jsonb_build_object('base','assinantes',
             'de',date '2026-01-01','ate',date '2026-03-31','anterior_de',date '2025-10-03','anterior_ate',date '2025-12-31'))->'serie')),
          3, 'série por mês acima de 62 dias');
select teste.sair();
select * from finish();
