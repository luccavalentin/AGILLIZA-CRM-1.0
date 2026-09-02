-- Endurece `sync_cliente_derivados` para clientes sem estado civil.
--
-- Complementa 20260827130000. Aquela migration corrigiu o erro que travava o
-- cadastro (`NULL IN (...)` -> NULL -> viola o NOT NULL de possui_conjuge),
-- mas ao transformar NULL em `false` ela passou a tratar "estado civil
-- desconhecido" como "nao e casado". Consequencia para uma PF cujo cadastro
-- ainda nao tem estado civil: qualquer edicao do cliente zerava o snapshot do
-- conjuge nas simulacoes e APAGAVA o envolvido conjuge das propostas.
--
-- Aqui a variavel `casado` continua booleana (o erro segue corrigido) e passa
-- a existir uma segunda variavel, `estado_civil_conhecido`. Quando o estado
-- civil e NULL nada de conjuge e escrito nem removido — o que existe fica como
-- esta. Para quem tem estado civil preenchido o comportamento e identico ao
-- original, expressao por expressao.
--
-- Rodar esta migration sozinha ja deixa o banco correto, mesmo que a
-- 20260827130000 nunca tenha sido aplicada. O trigger nao e recriado:
-- continua o mesmo, apontando para esta funcao.

CREATE OR REPLACE FUNCTION public.sync_cliente_derivados()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  casado boolean;
  estado_civil_conhecido boolean;
BEGIN
  -- `NULL IN (...)` avalia para NULL em SQL, nao para false. Com estado civil
  -- nulo `casado` virava NULL e `possui_conjuge = casado` violava o NOT NULL.
  casado := COALESCE(NEW.estado_civil IN ('casado', 'uniao_estavel'), false);
  -- Estado civil desconhecido nao e o mesmo que "nao casado". Quando e NULL
  -- nada de conjuge e sobrescrito nem removido: so preservamos o que existe.
  estado_civil_conhecido := NEW.estado_civil IS NOT NULL;

  -- Simulações vinculadas: atualiza snapshot do titular e do cônjuge
  UPDATE public.simulacoes SET
    nome_cliente = COALESCE(NEW.nome, nome_cliente),
    cpf_cnpj = COALESCE(NEW.documento, cpf_cnpj),
    email = COALESCE(NEW.email, email),
    celular = COALESCE(NEW.telefone_celular, celular),
    data_nascimento = COALESCE(NEW.data_nascimento, data_nascimento),
    estado_civil = NEW.estado_civil::text,
    regime_casamento = NEW.regime_casamento::text,
    renda_total = COALESCE(NEW.renda_total_declarada, renda_total),
    possui_conjuge = CASE WHEN estado_civil_conhecido THEN casado ELSE possui_conjuge END,
    nome_conjuge = CASE WHEN NOT estado_civil_conhecido THEN nome_conjuge WHEN casado THEN NEW.conjuge_nome ELSE NULL END,
    cpf_conjuge = CASE WHEN NOT estado_civil_conhecido THEN cpf_conjuge WHEN casado THEN NEW.conjuge_cpf ELSE NULL END,
    email_conjuge = CASE WHEN NOT estado_civil_conhecido THEN email_conjuge WHEN casado THEN NEW.conjuge_email ELSE NULL END,
    celular_conjuge = CASE WHEN NOT estado_civil_conhecido THEN celular_conjuge WHEN casado THEN NEW.conjuge_celular ELSE NULL END,
    data_nascimento_conjuge = CASE WHEN NOT estado_civil_conhecido THEN data_nascimento_conjuge WHEN casado THEN NEW.conjuge_data_nascimento ELSE NULL END,
    renda_conjuge = CASE WHEN NOT estado_civil_conhecido THEN renda_conjuge WHEN casado THEN NEW.conjuge_renda ELSE NULL END,
    compoe_renda = CASE WHEN NOT estado_civil_conhecido THEN compoe_renda WHEN casado THEN compoe_renda ELSE false END,
    updated_at = now()
  WHERE cliente_id = NEW.id;

  -- Propostas não terminais: snapshot básico + flag de cônjuge
  UPDATE public.propostas SET
    nome_cliente = COALESCE(NEW.nome, nome_cliente),
    estado_civil = NEW.estado_civil::text,
    possui_conjuge = CASE WHEN estado_civil_conhecido THEN casado ELSE possui_conjuge END
  WHERE cliente_id = NEW.id
    AND status NOT IN ('contrato_emitido', 'cancelada', 'credito_recusado');

  -- Envolvidos titulares (não-cônjuges) das propostas do cliente
  UPDATE public.proposta_envolvidos SET
    nome = COALESCE(NEW.nome, nome),
    cpf_cnpj = COALESCE(NEW.documento, cpf_cnpj),
    email = COALESCE(NEW.email, email),
    celular = COALESCE(NEW.telefone_celular, celular),
    data_nascimento = COALESCE(NEW.data_nascimento, data_nascimento),
    estado_civil = NEW.estado_civil::text,
    regime_casamento = NEW.regime_casamento::text,
    renda = COALESCE(NEW.renda_total_declarada, renda),
    nome_mae = COALESCE(NEW.mae, nome_mae),
    profissao = COALESCE(NEW.profissao, profissao),
    empresa = COALESCE(NEW.empresa, empresa),
    tipo_sexo = COALESCE(NEW.sexo, tipo_sexo),
    updated_at = now()
  WHERE cliente_id = NEW.id AND conjuge_de IS NULL;

  IF casado THEN
    -- Sincroniza (ou insere) cônjuge por proposta
    UPDATE public.proposta_envolvidos c SET
      nome = COALESCE(NEW.conjuge_nome, c.nome),
      cpf_cnpj = COALESCE(NEW.conjuge_cpf, c.cpf_cnpj),
      email = COALESCE(NEW.conjuge_email, c.email),
      celular = COALESCE(NEW.conjuge_celular, c.celular),
      data_nascimento = COALESCE(NEW.conjuge_data_nascimento, c.data_nascimento),
      renda = COALESCE(NEW.conjuge_renda, c.renda),
      nome_mae = COALESCE(NEW.conjuge_nome_mae, c.nome_mae),
      profissao = COALESCE(NEW.conjuge_profissao, c.profissao),
      empresa = COALESCE(NEW.conjuge_empresa, c.empresa),
      tipo_sexo = COALESCE(NEW.conjuge_sexo, c.tipo_sexo),
      updated_at = now()
    FROM public.proposta_envolvidos t
    WHERE t.cliente_id = NEW.id
      AND t.conjuge_de IS NULL
      AND c.conjuge_de = t.id;

    -- Cria envolvido cônjuge nas propostas onde ainda não existe (se houver dados mínimos)
    IF NEW.conjuge_nome IS NOT NULL AND NEW.conjuge_cpf IS NOT NULL THEN
      INSERT INTO public.proposta_envolvidos (
        proposta_id, cliente_id, tipo_qualificacao, conjuge_de,
        nome, cpf_cnpj, email, celular, data_nascimento, renda,
        nome_mae, profissao, empresa, tipo_sexo, tipo_pessoa
      )
      SELECT t.proposta_id, NULL, 'TI', t.id,
             NEW.conjuge_nome, NEW.conjuge_cpf, NEW.conjuge_email, NEW.conjuge_celular,
             NEW.conjuge_data_nascimento, NEW.conjuge_renda,
             NEW.conjuge_nome_mae, NEW.conjuge_profissao, NEW.conjuge_empresa,
             NEW.conjuge_sexo, 'F'
      FROM public.proposta_envolvidos t
      LEFT JOIN public.proposta_envolvidos c ON c.conjuge_de = t.id
      WHERE t.cliente_id = NEW.id
        AND t.conjuge_de IS NULL
        AND c.id IS NULL;
    END IF;
  ELSIF estado_civil_conhecido THEN
    -- Não é mais casado: remove envolvido cônjuge das propostas do cliente
    DELETE FROM public.proposta_envolvidos c
    USING public.proposta_envolvidos t
    WHERE t.cliente_id = NEW.id
      AND t.conjuge_de IS NULL
      AND c.conjuge_de = t.id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_cliente_derivados() FROM PUBLIC, anon, authenticated;
