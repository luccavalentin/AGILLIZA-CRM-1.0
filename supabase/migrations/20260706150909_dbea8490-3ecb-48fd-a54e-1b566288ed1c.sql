ALTER TYPE public.proposta_status ADD VALUE IF NOT EXISTS 'checklist_documentacao';
ALTER TYPE public.proposta_status ADD VALUE IF NOT EXISTS 'cadastro_complementar';
ALTER TYPE public.proposta_status ADD VALUE IF NOT EXISTS 'dossie_completo';
ALTER TYPE public.proposta_status ADD VALUE IF NOT EXISTS 'formularios';
ALTER TYPE public.proposta_status ADD VALUE IF NOT EXISTS 'envio_documentos_banco';
ALTER TYPE public.proposta_status ADD VALUE IF NOT EXISTS 'vistoria_agendamento';
ALTER TYPE public.proposta_status ADD VALUE IF NOT EXISTS 'vistoria_concluida';
ALTER TYPE public.proposta_status ADD VALUE IF NOT EXISTS 'emissao_contrato';