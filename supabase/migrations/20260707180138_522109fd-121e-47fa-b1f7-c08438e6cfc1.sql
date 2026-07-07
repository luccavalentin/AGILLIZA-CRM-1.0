ALTER TABLE public.cliente_parceiros
  ADD COLUMN IF NOT EXISTS tipo_vinculo text NOT NULL DEFAULT 'corretor';

ALTER TABLE public.cliente_parceiros
  DROP CONSTRAINT IF EXISTS cliente_parceiros_tipo_vinculo_check;

ALTER TABLE public.cliente_parceiros
  ADD CONSTRAINT cliente_parceiros_tipo_vinculo_check
  CHECK (tipo_vinculo IN ('imobiliaria','corretor','comercial_agilliza'));

ALTER TABLE public.cliente_parceiros
  DROP CONSTRAINT IF EXISTS cliente_parceiros_cliente_id_parceiro_id_key;

ALTER TABLE public.cliente_parceiros
  DROP CONSTRAINT IF EXISTS cliente_parceiros_cliente_parceiro_tipo_key;

ALTER TABLE public.cliente_parceiros
  ADD CONSTRAINT cliente_parceiros_cliente_parceiro_tipo_key
  UNIQUE (cliente_id, parceiro_id, tipo_vinculo);