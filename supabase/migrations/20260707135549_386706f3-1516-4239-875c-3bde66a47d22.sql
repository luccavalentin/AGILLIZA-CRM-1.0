
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS conjuge_nome text,
  ADD COLUMN IF NOT EXISTS conjuge_cpf text,
  ADD COLUMN IF NOT EXISTS conjuge_data_nascimento date,
  ADD COLUMN IF NOT EXISTS conjuge_nome_mae text,
  ADD COLUMN IF NOT EXISTS conjuge_sexo text,
  ADD COLUMN IF NOT EXISTS conjuge_nacionalidade text,
  ADD COLUMN IF NOT EXISTS conjuge_tipo_documento_identidade text,
  ADD COLUMN IF NOT EXISTS conjuge_numero_documento text,
  ADD COLUMN IF NOT EXISTS conjuge_orgao_expedidor text,
  ADD COLUMN IF NOT EXISTS conjuge_uf_expedicao text,
  ADD COLUMN IF NOT EXISTS conjuge_data_expedicao date,
  ADD COLUMN IF NOT EXISTS conjuge_profissao text,
  ADD COLUMN IF NOT EXISTS conjuge_empresa text,
  ADD COLUMN IF NOT EXISTS conjuge_renda numeric,
  ADD COLUMN IF NOT EXISTS conjuge_email text,
  ADD COLUMN IF NOT EXISTS conjuge_celular text;
