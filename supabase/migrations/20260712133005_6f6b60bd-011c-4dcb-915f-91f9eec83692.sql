-- Função que avalia se o cadastro do cliente está completo
CREATE OR REPLACE FUNCTION public.cliente_cadastro_esta_completo(_cliente_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.clientes%ROWTYPE;
  tem_endereco boolean;
BEGIN
  SELECT * INTO c FROM public.clientes WHERE id = _cliente_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Endereço com CEP válido
  SELECT EXISTS (
    SELECT 1 FROM public.cliente_enderecos e
    WHERE e.cliente_id = _cliente_id
      AND e.cep IS NOT NULL
      AND length(regexp_replace(e.cep, '\D', '', 'g')) = 8
  ) INTO tem_endereco;

  -- Dados obrigatórios do titular
  IF NOT tem_endereco
     OR coalesce(btrim(c.nome), '') = ''
     OR coalesce(btrim(c.documento), '') = ''
     OR c.data_nascimento IS NULL
     OR c.estado_civil IS NULL
     OR coalesce(btrim(c.mae), '') = ''
     OR coalesce(btrim(c.email), '') = ''
     OR coalesce(btrim(c.telefone_celular), '') = ''
     OR coalesce(btrim(c.profissao), '') = ''
     OR coalesce(c.renda_total_declarada, 0) <= 0
  THEN
    RETURN false;
  END IF;

  -- Se casado ou união estável, exige dados do cônjuge
  IF c.estado_civil IN ('casado', 'uniao_estavel') THEN
    IF coalesce(btrim(c.conjuge_nome), '') = ''
       OR coalesce(btrim(c.conjuge_cpf), '') = ''
       OR c.conjuge_data_nascimento IS NULL
       OR coalesce(btrim(c.conjuge_celular), '') = ''
       OR coalesce(btrim(c.conjuge_profissao), '') = ''
    THEN
      RETURN false;
    END IF;
  END IF;

  RETURN true;
END;
$$;

-- Trigger no próprio cliente: reavalia ao salvar o cadastro
CREATE OR REPLACE FUNCTION public.cliente_sincronizar_cadastro_completo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.cliente_cadastro_esta_completo(NEW.id) THEN
    PERFORM public.cliente_pipeline_avancar_para(NEW.id, 'cadastro_completo', 'cadastro');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cliente_sincronizar_cadastro_completo ON public.clientes;
CREATE TRIGGER trg_cliente_sincronizar_cadastro_completo
AFTER UPDATE ON public.clientes
FOR EACH ROW
EXECUTE FUNCTION public.cliente_sincronizar_cadastro_completo();

-- Endereço agora só reavalia a completude (não avança sozinho por CEP)
CREATE OR REPLACE FUNCTION public.cliente_endereco_sincronizar_esteira()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.cliente_cadastro_esta_completo(NEW.cliente_id) THEN
    PERFORM public.cliente_pipeline_avancar_para(NEW.cliente_id, 'cadastro_completo', 'endereco');
  END IF;
  RETURN NEW;
END;
$$;