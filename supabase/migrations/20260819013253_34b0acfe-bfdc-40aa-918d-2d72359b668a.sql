-- O backfill via SQL é limitado porque precisamos consultar a API externa.
-- Este comando serve apenas para sinalizar a intenção, a recuperação real ocorre via chamada ao novo endpoint.
-- Mas podemos limpar mensagens de erro genéricas que podem estar confundindo o status.
UPDATE public.simulacao_bancos
SET mensagem_banco = 'Aguardando resposta da instituição...'
WHERE status_banco = 'aguardando' 
  AND (mensagem_banco IS NULL OR mensagem_banco = '');