-- =============================================================================
-- ImobMatch Gestão (28/10/2026): módulos novos na matriz de permissões.
--
-- A gestão do ImobMatch saiu de "Gestão de Parceiros e Anúncios" (Gestão de sistemas) para o
-- menu próprio ImobMatch Gestão, com um módulo por tela: imobmatch.visao, imobmatch.moderacao,
-- imobmatch.financeiro, imobmatch.planos e imobmatch.config (o mapa da ponte está na 0460 do
-- Corretor). Quem já moderava pelo módulo antigo (saas.imobmatch) continua igual:
--   · saas.imobmatch ver    → imobmatch.visao ver e imobmatch.moderacao ver;
--   · saas.imobmatch editar → imobmatch.moderacao editar.
-- O módulo antigo continua valendo (as funções aceitam os dois). Financeiro, Planos e
-- Configurações NÃO são copiados de ninguém: o administrador libera na matriz quando quiser
-- (administrador e correspondente já veem tudo).
-- =============================================================================
with origem as (
  select p.nivel_acesso_id, m.novo_mod, m.nova_acao, bool_or(p.permitido) as permitido
    from public.permissions p
    join (values ('view', 'imobmatch.visao', 'view'),
                 ('view', 'imobmatch.moderacao', 'view'),
                 ('edit', 'imobmatch.moderacao', 'edit')) m(acao, novo_mod, nova_acao)
      on m.acao = p.acao
   where p.modulo = 'saas.imobmatch'
   group by 1, 2, 3
)
insert into public.permissions (nivel_acesso_id, modulo, acao, permitido)
select nivel_acesso_id, novo_mod, nova_acao, permitido from origem where permitido
on conflict (nivel_acesso_id, modulo, acao) do nothing;
