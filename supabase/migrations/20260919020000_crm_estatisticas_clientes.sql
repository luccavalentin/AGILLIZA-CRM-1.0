-- Cards da lista de clientes contados no banco.
--
-- `estatisticasClientes` baixava os clientes com a etapa da esteira e contava
-- no servidor. O PostgREST devolve no máximo 1.000 linhas por resposta, então
-- com 1.088 clientes ativos os cards "Portal ativo", "Em andamento" e
-- "Cadastro completo" contavam só uma parte (18/09/2026).
--
-- Mesma regra da consulta anterior, sem o corte: clientes com `ativo`, etapa
-- via cliente_pipeline → pipeline_stages, escopo "minhas" = responsável,
-- criador ou parceiro vinculado. SECURITY INVOKER: as regras de acesso de
-- cada tabela valem como antes (a consulta antiga também passava por elas).

create or replace function public.crm_estatisticas_clientes(_somente_minhas boolean default false)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'total', count(*),
    'portal_ativo', count(*) filter (where c.portal_acesso_ativo),
    'em_andamento', count(*) filter (
      where ps.codigo is not null and ps.codigo not in ('cadastro_basico', 'contrato_emitido')
    ),
    'cadastro_completo', count(*) filter (where coalesce(ps.ordem, 0) >= 4)
  )
  from public.clientes c
  left join public.cliente_pipeline cp on cp.cliente_id = c.id
  left join public.pipeline_stages ps on ps.id = cp.stage_id
  where c.ativo = true
    and (
      not _somente_minhas
      or c.responsavel_id = (select auth.uid())
      or c.criador_id = (select auth.uid())
      or exists (
        select 1 from public.cliente_parceiros v
        where v.cliente_id = c.id and v.parceiro_id = (select auth.uid())
      )
    );
$$;

grant execute on function public.crm_estatisticas_clientes(boolean) to authenticated;
