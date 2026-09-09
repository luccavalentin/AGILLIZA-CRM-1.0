-- Crédito aprovado COM CONDIÇÕES precisa ser distinguível de aprovação plena.
--
-- Sem valor próprio, o condicionado virava `credito_aprovado`: o cabeçalho da
-- proposta dizia "Crédito aprovado" mesmo quando todos os bancos haviam imposto
-- exigências, o operador seguia para a coleta de documentos sem registro delas,
-- e o funil contava como aprovação plena.
--
-- ADD VALUE apenas acrescenta um rótulo ao enum: não reescreve nenhuma linha e
-- não invalida os valores existentes.
ALTER TYPE proposta_status
  ADD VALUE IF NOT EXISTS 'credito_condicionado' AFTER 'credito_aprovado';
