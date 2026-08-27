-- Campos de pessoa jurídica exigidos pela integração bancária.
--
-- A API pede cinco dados da empresa no participante PJ:
--   tipoEmpresa, dataRegistroEmpresa, faturamentoEmpresa,
--   patrimonioLiquidoEmpresa e capitalSocialEmpresa
--
-- `dataRegistroEmpresa` já é atendida por `clientes.data_nascimento`, que o
-- formulário rotula como "Data de abertura" quando o cadastro é PJ. As outras
-- quatro não tinham onde ser guardadas.
--
-- Migration puramente ADITIVA: só cria colunas novas, todas anuláveis e sem
-- default. Nenhuma linha existente muda, nenhuma coluna é alterada ou
-- removida, e todo o código que hoje lê `clientes` continua funcionando sem
-- alteração.

alter table public.clientes
  add column if not exists tipo_empresa text,
  add column if not exists faturamento_empresa numeric,
  add column if not exists patrimonio_liquido_empresa numeric,
  add column if not exists capital_social_empresa numeric;

comment on column public.clientes.tipo_empresa is
  'Natureza jurídica enviada ao banco (SA, EPP, ME, MEI, EIRELI). Somente PJ.';
comment on column public.clientes.faturamento_empresa is
  'Faturamento declarado da empresa. Somente PJ.';
comment on column public.clientes.patrimonio_liquido_empresa is
  'Patrimônio líquido declarado da empresa. Somente PJ.';
comment on column public.clientes.capital_social_empresa is
  'Capital social declarado da empresa. Somente PJ.';
