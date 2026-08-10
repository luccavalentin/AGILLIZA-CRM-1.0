-- Alinha a esteira do CRM (pipeline_stages) às etapas da proposta e
-- sincroniza automaticamente o status da proposta com a esteira do cliente.

-- 0) Desloca as ordens atuais para liberar a faixa 1..14 (ordem é UNIQUE).
UPDATE public.pipeline_stages SET ordem = ordem + 100;

-- 1) Insere as novas etapas do fluxo da proposta.
INSERT INTO public.pipeline_stages (ordem, codigo, nome, mensagem_cliente) VALUES
  (4,  'credito_enviado',      'Enviado p/ aprovação de crédito', 'Sua proposta foi enviada ao banco para aprovação de crédito.'),
  (5,  'credito_aprovado',     'Crédito aprovado',                 'Seu crédito foi aprovado pelo banco!'),
  (6,  'checklist',            'Checklist de documentação',        'Estamos organizando a documentação necessária.'),
  (7,  'cadastro_complementar','Cadastro complementar',            'Precisamos de alguns dados complementares.'),
  (8,  'dossie',               'Dossiê de documentação',           'Reunindo o dossiê de documentos.'),
  (9,  'formularios',          'Formulários',                      'Preenchimento dos formulários do banco.'),
  (10, 'envio_docs',           'Envio de docs. ao banco',          'Documentação enviada ao banco.'),
  (11, 'vistoria_agenda',      'Vistoria — agendamento',           'Vistoria do imóvel em agendamento.'),
  (12, 'vistoria_ok',          'Vistoria concluída',               'Vistoria do imóvel concluída.'),
  (13, 'emissao_contrato',     'Emissão de contrato',              'Contrato em emissão.')
ON CONFLICT (codigo) DO UPDATE SET ordem = EXCLUDED.ordem, nome = EXCLUDED.nome, mensagem_cliente = EXCLUDED.mensagem_cliente;

-- Ajusta as etapas mantidas para a ordem final.
UPDATE public.pipeline_stages SET ordem = 1,  nome = 'Cadastro Básico'   WHERE codigo = 'cadastro_basico';
UPDATE public.pipeline_stages SET ordem = 2,  nome = 'Cadastro Completo' WHERE codigo = 'cadastro_completo';
UPDATE public.pipeline_stages SET ordem = 3,  nome = 'Simulação'         WHERE codigo = 'simulacao';
UPDATE public.pipeline_stages SET ordem = 14, nome = 'Contrato Emitido'  WHERE codigo = 'contrato_emitido';

-- 2) Remapeia registros existentes das etapas antigas para as novas.
WITH remap(velho, novo) AS (
  VALUES
    ('aprovacao','credito_aprovado'),
    ('documentacao_completa','checklist'),
    ('formularios_1','formularios'),
    ('formularios_2','formularios'),
    ('banco_remessa_1','envio_docs'),
    ('banco_remessa_2','envio_docs'),
    ('vistoria_agendada','vistoria_agenda'),
    ('analise_juridica','emissao_contrato')
)
UPDATE public.cliente_pipeline cp
SET stage_id = destino.id
FROM remap r
JOIN public.pipeline_stages origem ON origem.codigo = r.velho
JOIN public.pipeline_stages destino ON destino.codigo = r.novo
WHERE cp.stage_id = origem.id;

WITH remap(velho, novo) AS (
  VALUES
    ('aprovacao','credito_aprovado'),
    ('documentacao_completa','checklist'),
    ('formularios_1','formularios'),
    ('formularios_2','formularios'),
    ('banco_remessa_1','envio_docs'),
    ('banco_remessa_2','envio_docs'),
    ('vistoria_agendada','vistoria_agenda'),
    ('analise_juridica','emissao_contrato')
)
UPDATE public.cliente_pipeline_historico h
SET stage_id = destino.id
FROM remap r
JOIN public.pipeline_stages origem ON origem.codigo = r.velho
JOIN public.pipeline_stages destino ON destino.codigo = r.novo
WHERE h.stage_id = origem.id;

-- 3) Remove as etapas antigas que não fazem mais parte do fluxo.
DELETE FROM public.pipeline_stages
WHERE codigo IN (
  'aprovacao','documentacao_completa','formularios_1','formularios_2',
  'banco_remessa_1','banco_remessa_2','vistoria_agendada','analise_juridica'
);

-- 4) Reescreve o gatilho proposta -> esteira para cobrir TODOS os status atuais.
CREATE OR REPLACE FUNCTION public.proposta_sincronizar_esteira()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_codigo TEXT;
BEGIN
  IF NEW.cliente_id IS NULL THEN RETURN NEW; END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    v_codigo := CASE NEW.status
      WHEN 'rascunho'               THEN 'simulacao'
      WHEN 'erro_envio'             THEN 'simulacao'
      WHEN 'enviada_banco'          THEN 'credito_enviado'
      WHEN 'em_analise_credito'     THEN 'credito_enviado'
      WHEN 'credito_aprovado'       THEN 'credito_aprovado'
      WHEN 'credito_recusado'       THEN 'credito_aprovado'
      WHEN 'checklist_documentacao' THEN 'checklist'
      WHEN 'cadastro_complementar'  THEN 'cadastro_complementar'
      WHEN 'dossie_completo'        THEN 'dossie'
      WHEN 'formularios'            THEN 'formularios'
      WHEN 'envio_documentos_banco' THEN 'envio_docs'
      WHEN 'vistoria_agendamento'   THEN 'vistoria_agenda'
      WHEN 'vistoria_concluida'     THEN 'vistoria_ok'
      WHEN 'emissao_contrato'       THEN 'emissao_contrato'
      WHEN 'contrato_emitido'       THEN 'contrato_emitido'
      WHEN 'aguardando_documentos'  THEN 'checklist'
      WHEN 'engenharia_vistoria'    THEN 'vistoria_agenda'
      WHEN 'analise_juridica'       THEN 'emissao_contrato'
      WHEN 'registrado'             THEN 'contrato_emitido'
      ELSE NULL
    END;
    IF v_codigo IS NOT NULL THEN
      PERFORM public.cliente_pipeline_avancar_para(NEW.cliente_id, v_codigo, 'proposta');
    END IF;
  END IF;
  RETURN NEW;
END;$$;