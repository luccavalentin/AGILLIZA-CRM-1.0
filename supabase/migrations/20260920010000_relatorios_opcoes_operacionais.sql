-- Opções dos filtros de relatório contadas no banco.
--
-- Para montar duas listinhas de filtro (bancos e produtos) a tela baixava
-- TODAS as linhas de simulacao_bancos (12.126), propostas e simulações —
-- cerca de 19 mil linhas por abertura, paginadas de mil em mil, para no fim
-- ficar com algumas dezenas de valores distintos. Além do peso, a paginação
-- tem teto (50 lotes): passando de 50 mil linhas, opções sumiriam em silêncio.
--
-- SECURITY INVOKER: a RLS continua valendo, então cada pessoa vê as mesmas
-- opções que via antes — as dos registros a que tem acesso. Conferido contra
-- o cálculo antigo para 6 usuários: mesmas listas.

create or replace function public.relatorios_opcoes_operacionais()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'bancos', coalesce((
      select jsonb_agg(distinct nome) from (
        select nome_banco nome from public.homefin_bancos where ativo and nome_banco is not null
        union
        select nome_banco from public.simulacao_bancos where nome_banco is not null
      ) b
    ), '[]'::jsonb),
    'produtos', coalesce((
      select jsonb_agg(distinct produto) from (
        select produto from public.propostas where deleted_at is null and produto is not null
        union
        select produto from public.simulacoes where deleted_at is null and produto is not null
      ) p
    ), '[]'::jsonb)
  );
$$;

grant execute on function public.relatorios_opcoes_operacionais() to authenticated;
