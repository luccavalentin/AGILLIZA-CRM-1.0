-- Etapa "Contrato registrado" depois de "Contrato emitido" (pedido do dono de 26/10/2026, C12).
--
-- A proposta já tinha o status `registrado`; faltava a etapa aparecer em toda a jornada e a data
-- ser guardada de forma confiável (a frente do financeiro usa o registro como gatilho de previsão):
--   · `propostas.contrato_registrado_em`: gravada na própria linha quando a proposta chega a
--     `registrado` (por qualquer caminho), ou escolhida pelo analista em "Marcar contrato
--     registrado"; o espelho do Agilliza Tech (0179/0316) leva essa data ao assinante;
--   · etapa nova do cliente `contrato_registrado` (ordem 10), para a esteira, o painel, o app e o
--     portal do cliente;
--   · `proposta_sincronizar_esteira` leva `registrado` à etapa nova (antes caía em "Contrato
--     emitido") e avisa "Contrato registrado"; `crm_estatisticas_clientes` não conta a etapa nova
--     como "em andamento". Mudança mínima sobre pg_get_functiondef em 26/10/2026.

alter table public.propostas add column if not exists contrato_registrado_em timestamptz;
comment on column public.propostas.contrato_registrado_em is
  'Data do registro do contrato em cartório (etapa "Contrato registrado"). Gatilho da previsão financeira.';

create or replace function public.proposta_contrato_registrado_em()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if new.status = 'registrado' and (tg_op = 'INSERT' or old.status is distinct from 'registrado') then
    new.contrato_registrado_em := coalesce(new.contrato_registrado_em, now());
  end if;
  return new;
end $$;
revoke all on function public.proposta_contrato_registrado_em() from public, anon, authenticated;

drop trigger if exists trg_proposta_contrato_registrado_em on public.propostas;
create trigger trg_proposta_contrato_registrado_em before insert or update of status on public.propostas
  for each row execute function public.proposta_contrato_registrado_em();

-- Registros de antes: a data da última mudança de status é a melhor estimativa.
alter table public.propostas disable trigger user;
update public.propostas set contrato_registrado_em = coalesce(status_atualizado_em, updated_at, created_at)
 where status = 'registrado' and contrato_registrado_em is null;
alter table public.propostas enable trigger user;

insert into public.pipeline_stages (ordem, codigo, nome, mensagem_cliente)
select 10, 'contrato_registrado', 'Contrato registrado',
       'Seu contrato foi registrado em cartório. O imóvel está oficialmente no seu nome!'
 where not exists (select 1 from public.pipeline_stages where codigo = 'contrato_registrado');

CREATE OR REPLACE FUNCTION public.proposta_sincronizar_esteira()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_stage text;
  v_titulo text;
  v_ator uuid;
  v_deve_processar boolean;
BEGIN
  IF NEW.cliente_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_deve_processar := TG_OP = 'INSERT'
    OR OLD.status IS DISTINCT FROM NEW.status
    OR NOT EXISTS (
      SELECT 1
      FROM public.cliente_historico ch
      WHERE ch.cliente_id = NEW.cliente_id
        AND ch.tipo = 'proposta'
        AND ch.metadata->>'proposta_id' = NEW.id::text
        AND ch.metadata->>'status' = NEW.status::text
    );

  IF NOT v_deve_processar THEN
    RETURN NEW;
  END IF;

  v_ator := COALESCE(NEW.usuario_responsavel_id, NEW.usuario_criador_id);

  v_stage := CASE
    WHEN NEW.status IN ('enviada_banco','em_analise_credito') THEN 'credito_enviado'
    WHEN NEW.status IN ('credito_aprovado','credito_condicionado','formularios') THEN 'credito_aprovado'
    WHEN NEW.status IN ('aguardando_documentos','checklist_documentacao','cadastro_complementar','dossie_completo','envio_documentos_banco') THEN 'coleta_documentos'
    WHEN NEW.status IN ('engenharia_vistoria','vistoria_agendamento','vistoria_concluida') THEN 'engenharia_vistoria'
    WHEN NEW.status IN ('analise_juridica','emissao_contrato') THEN 'analise_juridica'
    WHEN NEW.status = 'contrato_emitido' THEN 'contrato_emitido'
    WHEN NEW.status = 'registrado' THEN 'contrato_registrado'
    ELSE NULL
  END;

  IF v_stage IS NOT NULL THEN
    PERFORM public.cliente_pipeline_avancar_para(
      NEW.cliente_id,
      v_stage,
      'proposta',
      'Proposta ' || COALESCE(NEW.numero_proposta, NEW.id::text) || ' atualizada para ' || NEW.status::text
    );
  END IF;

  INSERT INTO public.cliente_historico (cliente_id, tipo, descricao, ator_id, metadata)
  VALUES (
    NEW.cliente_id,
    'proposta',
    'Proposta ' || COALESCE(NEW.numero_proposta, NEW.id::text) || ' atualizada para ' || NEW.status::text,
    v_ator,
    jsonb_build_object('proposta_id', NEW.id, 'simulacao_id', NEW.simulacao_id, 'status', NEW.status::text)
  );

  v_titulo := CASE
    WHEN NEW.status IN ('enviada_banco','em_analise_credito') THEN 'Proposta em análise'
    WHEN NEW.status = 'credito_aprovado' THEN 'Crédito aprovado'
    WHEN NEW.status = 'credito_condicionado' THEN 'Crédito aprovado com condições'
    WHEN NEW.status = 'credito_recusado' THEN 'Crédito não aprovado'
    WHEN NEW.status = 'formularios' THEN 'Formulários do banco'
    WHEN NEW.status = 'aguardando_documentos' THEN 'Documentação pendente'
    WHEN NEW.status = 'engenharia_vistoria' THEN 'Vistoria em andamento'
    WHEN NEW.status = 'analise_juridica' THEN 'Análise jurídica em andamento'
    WHEN NEW.status = 'contrato_emitido' THEN 'Contrato emitido'
    WHEN NEW.status = 'registrado' THEN 'Contrato registrado'
    WHEN NEW.status = 'cancelada' THEN 'Proposta cancelada'
    ELSE 'Proposta atualizada'
  END;

  PERFORM public.notificar_cliente_portal(
    NEW.cliente_id,
    NEW.correspondente_id,
    'proposta.status',
    v_titulo,
    -- C33: o cliente vê o "ID H." (id da oportunidade), nunca o número interno PRO-….
    'Sua proposta' || COALESCE(' ID H. ' || NULLIF(btrim(NEW.homefin_id_oportunidade::text), ''), '') || ' foi atualizada.',
    '/cliente'
  );

  PERFORM public.emitir_notificacao(
    v_ator,
    NEW.correspondente_id,
    'proposta.status',
    v_titulo,
    'Cliente ' || COALESCE(NEW.nome_cliente, '') || ': ' || NEW.status::text,
    '/operacional/propostas/' || NEW.id
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.crm_estatisticas_clientes(_somente_minhas boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(
    'total', count(*),
    'portal_ativo', count(*) filter (where c.portal_acesso_ativo),
    'em_andamento', count(*) filter (
      where ps.codigo is not null and ps.codigo not in ('cadastro_basico', 'contrato_emitido', 'contrato_registrado')
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
$function$;

-- Clientes com proposta já registrada passam à etapa nova.
do $$
declare r record;
begin
  for r in select distinct p.cliente_id from public.propostas p
            where p.status = 'registrado' and p.cliente_id is not null and p.deleted_at is null loop
    perform public.cliente_pipeline_avancar_para(r.cliente_id, 'contrato_registrado', 'proposta',
                                                 'Contrato registrado (etapa nova de 26/10/2026)');
  end loop;
end $$;
