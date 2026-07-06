
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS pai text,
  ADD COLUMN IF NOT EXISTS sexo text,
  ADD COLUMN IF NOT EXISTS nacionalidade text,
  ADD COLUMN IF NOT EXISTS naturalidade text,
  ADD COLUMN IF NOT EXISTS tipo_documento_identidade text,
  ADD COLUMN IF NOT EXISTS numero_documento text,
  ADD COLUMN IF NOT EXISTS orgao_expedidor text,
  ADD COLUMN IF NOT EXISTS uf_expedicao text,
  ADD COLUMN IF NOT EXISTS data_expedicao date,
  ADD COLUMN IF NOT EXISTS profissao text,
  ADD COLUMN IF NOT EXISTS empresa text,
  ADD COLUMN IF NOT EXISTS banco_conta text,
  ADD COLUMN IF NOT EXISTS agencia text,
  ADD COLUMN IF NOT EXISTS conta_corrente text,
  ADD COLUMN IF NOT EXISTS digito_conta text;

-- Define a etapa da esteira do cliente para qualquer posição (avanço ou retrocesso).
CREATE OR REPLACE FUNCTION public.cliente_pipeline_definir(_cliente_id uuid, _codigo_destino text, _obs text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dest RECORD;
BEGIN
  SELECT * INTO v_dest FROM public.pipeline_stages WHERE codigo = _codigo_destino;
  IF NOT FOUND THEN RETURN; END IF;

  INSERT INTO public.cliente_pipeline (cliente_id, stage_id, ultima_atualizacao_em)
  VALUES (_cliente_id, v_dest.id, now())
  ON CONFLICT (cliente_id) DO UPDATE SET stage_id = EXCLUDED.stage_id, ultima_atualizacao_em = now();

  INSERT INTO public.cliente_pipeline_historico (cliente_id, stage_id, acao, observacao, mensagem_cliente, enviar_ao_cliente)
  VALUES (_cliente_id, v_dest.id, 'manual', _obs, v_dest.mensagem_cliente, true);

  INSERT INTO public.cliente_historico (cliente_id, tipo, descricao)
  VALUES (_cliente_id, 'etapa', 'Etapa alterada para ' || v_dest.nome);
END;
$function$;
