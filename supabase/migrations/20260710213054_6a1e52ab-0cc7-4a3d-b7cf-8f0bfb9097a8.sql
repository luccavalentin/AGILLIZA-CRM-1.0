-- Índice único para feriados nacionais globais (correspondente_id IS NULL)
CREATE UNIQUE INDEX IF NOT EXISTS feriados_globais_data_uidx
  ON public.feriados (data)
  WHERE correspondente_id IS NULL;

-- Domingo de Páscoa (algoritmo de Meeus/Butcher)
CREATE OR REPLACE FUNCTION public.domingo_de_pascoa(ano int)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  a int; b int; c int; d int; e int; f int; g int; h int; i int; k int; l int; m int;
  mes int; dia int;
BEGIN
  a := ano % 19;
  b := ano / 100;
  c := ano % 100;
  d := b / 4;
  e := b % 4;
  f := (b + 8) / 25;
  g := (b - f + 1) / 3;
  h := (19 * a + b - d - g + 15) % 30;
  i := c / 4;
  k := c % 4;
  l := (32 + 2 * e + 2 * i - h - k) % 7;
  m := (a + 11 * h + 22 * l) / 451;
  mes := (h + l - 7 * m + 114) / 31;
  dia := ((h + l - 7 * m + 114) % 31) + 1;
  RETURN make_date(ano, mes, dia);
END;
$$;

-- Garante os feriados nacionais globais para um intervalo de anos
CREATE OR REPLACE FUNCTION public.garantir_feriados_nacionais(ano_inicio int, ano_fim int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ano int;
  pascoa date;
BEGIN
  FOR ano IN ano_inicio..ano_fim LOOP
    pascoa := public.domingo_de_pascoa(ano);
    INSERT INTO public.feriados (data, descricao, correspondente_id) VALUES
      (make_date(ano, 1, 1),  'Confraternização Universal', NULL),
      (make_date(ano, 4, 21), 'Tiradentes', NULL),
      (make_date(ano, 5, 1),  'Dia do Trabalho', NULL),
      (make_date(ano, 9, 7),  'Independência do Brasil', NULL),
      (make_date(ano, 10, 12),'Nossa Senhora Aparecida', NULL),
      (make_date(ano, 11, 2), 'Finados', NULL),
      (make_date(ano, 11, 15),'Proclamação da República', NULL),
      (make_date(ano, 11, 20),'Dia da Consciência Negra', NULL),
      (make_date(ano, 12, 25),'Natal', NULL),
      (pascoa - 48, 'Carnaval', NULL),
      (pascoa - 47, 'Carnaval', NULL),
      (pascoa - 46, 'Quarta-feira de Cinzas', NULL),
      (pascoa - 2,  'Sexta-feira Santa', NULL),
      (pascoa + 60, 'Corpus Christi', NULL)
    ON CONFLICT (data) WHERE correspondente_id IS NULL
    DO UPDATE SET descricao = EXCLUDED.descricao;
  END LOOP;
END;
$$;

-- Semeia janela atual (ano anterior até 5 anos à frente)
SELECT public.garantir_feriados_nacionais(
  EXTRACT(YEAR FROM now())::int - 1,
  EXTRACT(YEAR FROM now())::int + 5
);