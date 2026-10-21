-- Ficha de parceiro para quem já foi cadastrado como imobiliária ou corretor parceiro.
-- O cadastro de pessoas nunca gravava `parceiro_detalhes` (nem o % de comissão que o
-- formulário enviava): /crm/parceiros ficava vazio e o portal do parceiro sem dados.
-- A aplicação passa a criar a ficha no cadastro; aqui só se completa quem ficou sem.
insert into public.parceiro_detalhes (profile_id, correspondente_id, tipo_pessoa, percentual_comissao)
select p.id, p.correspondente_id,
       case when 'imobiliaria' = any (coalesce(p.tipos_pessoa, array[p.tipo_pessoa])) then 'pj' else 'pf' end,
       0
  from public.profiles p
 where p.acesso_tipo = 'portal_parceiro'
   and p.correspondente_id is not null
   and p.deleted_at is null
   and coalesce(p.tipos_pessoa, array[p.tipo_pessoa]) && array['imobiliaria', 'corretor']
   and not exists (select 1 from public.parceiro_detalhes d where d.profile_id = p.id);
