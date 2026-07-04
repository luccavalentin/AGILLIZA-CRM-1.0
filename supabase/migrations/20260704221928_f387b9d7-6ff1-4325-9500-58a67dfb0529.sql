
UPDATE public.homefin_bancos SET id_banco = 45 WHERE codigo_banco = 237;
UPDATE public.homefin_bancos SET id_banco = 61 WHERE codigo_banco = 341;
UPDATE public.homefin_bancos SET id_banco = 9  WHERE codigo_banco = 33;

INSERT INTO public.homefin_bancos (id_banco, codigo_banco, nome_banco, flag_simulacao, ativo, ordem)
SELECT 96, 9004, 'Somahome', 'S', true, 90
WHERE NOT EXISTS (SELECT 1 FROM public.homefin_bancos WHERE codigo_banco = 9004);

UPDATE public.simulacao_bancos sb
SET homefin_id_banco = hb.id_banco
FROM public.homefin_bancos hb
WHERE sb.codigo_banco = hb.codigo_banco
  AND sb.homefin_id_banco IS NULL
  AND hb.id_banco IS NOT NULL;
