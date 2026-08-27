-- Persiste a modalidade (PF/PJ) da simulação.
--
-- Hoje a modalidade só existe no formulário. Ao recarregar ou duplicar uma
-- simulação ela volta para "PF": o Itaú e o Santander reaparecem na seleção,
-- o LTV volta a 80% e o prazo a 420 — justamente as regras que a pessoa
-- jurídica não pode ter. O servidor também não tem como recusar um banco que
-- não opera PJ, porque não sabe que a simulação é PJ.
--
-- Migration ADITIVA: cria uma coluna nova com default 'PF'. Nenhuma linha
-- existente muda de comportamento e todo código que hoje lê `simulacoes`
-- continua funcionando sem alteração.

alter table public.simulacoes
  add column if not exists tipo_pessoa text not null default 'PF';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'simulacoes_tipo_pessoa_check'
      and conrelid = 'public.simulacoes'::regclass
  ) then
    alter table public.simulacoes
      add constraint simulacoes_tipo_pessoa_check check (tipo_pessoa in ('PF', 'PJ'));
  end if;
end $$;

comment on column public.simulacoes.tipo_pessoa is
  'Modalidade do proponente titular: PF ou PJ. Em PJ apenas o Bradesco opera.';

-- Backfill: as simulações de pessoa jurídica que já existem são identificáveis
-- pelo CNPJ (14 dígitos). Só marca quem tem CNPJ; nenhuma outra linha é tocada.
update public.simulacoes
   set tipo_pessoa = 'PJ'
 where tipo_pessoa <> 'PJ'
   and length(regexp_replace(coalesce(cpf_cnpj, ''), '\D', '', 'g')) = 14;
