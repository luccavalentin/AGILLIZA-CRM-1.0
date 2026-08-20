ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS imovel_tipo text,
  ADD COLUMN IF NOT EXISTS imovel_uso text,
  ADD COLUMN IF NOT EXISTS imovel_situacao text,
  ADD COLUMN IF NOT EXISTS imovel_valor numeric,
  ADD COLUMN IF NOT EXISTS imovel_cep text,
  ADD COLUMN IF NOT EXISTS imovel_logradouro text,
  ADD COLUMN IF NOT EXISTS imovel_numero text,
  ADD COLUMN IF NOT EXISTS imovel_complemento text,
  ADD COLUMN IF NOT EXISTS imovel_bairro text,
  ADD COLUMN IF NOT EXISTS imovel_cidade text,
  ADD COLUMN IF NOT EXISTS imovel_uf text,
  ADD COLUMN IF NOT EXISTS iq_nome text,
  ADD COLUMN IF NOT EXISTS iq_comentario text;