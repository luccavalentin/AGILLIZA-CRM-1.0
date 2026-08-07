ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS conjuge_banco_conta text,
  ADD COLUMN IF NOT EXISTS conjuge_agencia text,
  ADD COLUMN IF NOT EXISTS conjuge_conta_corrente text,
  ADD COLUMN IF NOT EXISTS conjuge_digito_conta text;

ALTER TABLE public.cliente_vendedores
  ADD COLUMN IF NOT EXISTS conjuge_banco_conta text,
  ADD COLUMN IF NOT EXISTS conjuge_agencia text,
  ADD COLUMN IF NOT EXISTS conjuge_conta_corrente text,
  ADD COLUMN IF NOT EXISTS conjuge_digito_conta text;