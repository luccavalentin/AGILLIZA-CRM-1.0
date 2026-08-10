UPDATE public.proposta_bancos
SET numero_proposta_banco = NULL,
    status_banco = 'nao_enviado',
    situacao_banco = 'nao_enviado',
    mensagem_banco = NULL
WHERE id = 'f398583a-4b67-4dcc-9d8c-abb19190d1ac'
  AND proposta_id = 'fd6c0235-7145-41dd-8acf-5d0f4df2bdae';