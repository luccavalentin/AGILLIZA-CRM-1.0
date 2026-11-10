-- Status "correcao_banco": o portal do Itaú ou do Santander mostrou a proposta
-- cancelada ou recusada. A equipe corrige no banco e a proposta volta à etapa
-- em que o portal estiver (o robô dos portais devolve sozinho quando o banco
-- volta a andar). Fica fora da ordem do funil, como "cancelada".
--
-- Os gatilhos da esteira tratam o valor novo pelo ELSE (sem mudar a etapa do
-- cliente; aviso genérico "Proposta atualizada").
ALTER TYPE public.proposta_status ADD VALUE IF NOT EXISTS 'correcao_banco' AFTER 'registrado';
