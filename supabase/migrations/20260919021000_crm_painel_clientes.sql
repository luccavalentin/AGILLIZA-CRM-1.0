-- Esteira do CRM montada no banco.
--
-- `listarPainel` trazia, numa consulta só, todos os clientes da esteira com
-- TODAS as suas propostas e simulações (para exibir só a mais recente de cada)
-- e o PostgREST cortava a resposta em 1.000 linhas: com 1.087 clientes, os
-- últimos em ordem alfabética (do "Tha…" ao "Z") sumiam da esteira (18/09/2026).
--
-- Aqui cada cliente vem com a última proposta e a última simulação (não
-- excluídas, por data de criação), os totais, responsável, analista, etapa e
-- imobiliária/corretor. Devolve um único jsonb (sem o teto de linhas).
-- SECURITY INVOKER: as regras de acesso de cada tabela valem como antes.

create or replace function public.crm_painel_clientes(_somente_minhas boolean default false)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(jsonb_agg(linha order by nome), '[]'::jsonb)
  from (
    select
      c.nome,
      jsonb_build_object(
        'id', c.id,
        'nome', c.nome,
        'numero_cliente', c.numero_cliente,
        'created_at', c.created_at,
        'vistoria_agendada_em', c.vistoria_agendada_em,
        'vistoria_concluida_em', c.vistoria_concluida_em,
        'contrato_emitido_em', c.contrato_emitido_em,
        'responsavel_nome', resp.nome,
        'analista_nome', anal.nome,
        'pipeline_atualizado_em', cp.ultima_atualizacao_em,
        'stage_codigo', ps.codigo,
        'proposta_id', prop.id,
        'numero_proposta', prop.numero_proposta,
        'proposta_status', prop.status,
        'nome_banco', prop.nome_banco,
        'total_propostas', coalesce(tp.n, 0),
        'simulacao_id', sim.id,
        'numero_simulacao', sim.numero_simulacao,
        'simulacao_status', sim.status,
        'total_simulacoes', coalesce(ts.n, 0),
        'imobiliaria_nome', imob.nome,
        'corretor_nome', corr.nome
      ) as linha
    from public.clientes c
    left join public.profiles resp on resp.id = c.responsavel_id
    left join public.profiles anal on anal.id = c.criador_id
    left join public.cliente_pipeline cp on cp.cliente_id = c.id
    left join public.pipeline_stages ps on ps.id = cp.stage_id
    left join lateral (
      select p.id, p.numero_proposta, p.status, p.nome_banco
      from public.propostas p
      where p.cliente_id = c.id and p.deleted_at is null
      order by p.created_at desc
      limit 1
    ) prop on true
    left join lateral (
      select count(*) n from public.propostas p
      where p.cliente_id = c.id and p.deleted_at is null
    ) tp on true
    left join lateral (
      select s.id, s.numero_simulacao, s.status
      from public.simulacoes s
      where s.cliente_id = c.id and s.deleted_at is null
      order by s.created_at desc
      limit 1
    ) sim on true
    left join lateral (
      select count(*) n from public.simulacoes s
      where s.cliente_id = c.id and s.deleted_at is null
    ) ts on true
    left join lateral (
      select pf.nome from public.cliente_parceiros v
      left join public.profiles pf on pf.id = v.parceiro_id
      where v.cliente_id = c.id and v.tipo_vinculo = 'imobiliaria'
      order by v.created_at, v.id
      limit 1
    ) imob on true
    left join lateral (
      select pf.nome from public.cliente_parceiros v
      left join public.profiles pf on pf.id = v.parceiro_id
      where v.cliente_id = c.id and v.tipo_vinculo = 'corretor'
      order by v.created_at, v.id
      limit 1
    ) corr on true
    where c.ativo = true
      and c.deleted_at is null
      and c.contrato_arquivado_em is null
      and (
        not _somente_minhas
        or c.responsavel_id = (select auth.uid())
        or c.criador_id = (select auth.uid())
        or exists (
          select 1 from public.cliente_parceiros v
          where v.cliente_id = c.id and v.parceiro_id = (select auth.uid())
        )
      )
  ) t;
$$;

grant execute on function public.crm_painel_clientes(boolean) to authenticated;
