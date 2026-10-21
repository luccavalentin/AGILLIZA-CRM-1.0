-- Somahome desligado (20/10/2026, pedido do dono: "banco que eu nunca pedi").
--
-- A migração 20260704221928 cadastrou o Somahome (código 9004) já ATIVO na lista de bancos
-- da integração. No banco novo, montado só pelas migrações, ele apareceu na simulação.
-- Fica cadastrado (o histórico de simulações que o citem continua legível), mas desligado;
-- religar é pela tela Administração › Bancos.
update public.homefin_bancos
   set ativo = false, flag_padrao = false, updated_at = now()
 where codigo_banco = 9004;
