
CREATE OR REPLACE FUNCTION public.add_horas_uteis(_corr uuid, _inicio timestamptz, _horas numeric)
RETURNS timestamptz LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE
  tz text := 'America/Sao_Paulo';
  cur timestamp;
  restante numeric;
  dia_ini timestamp;
  dia_fim timestamp;
  disp numeric;
BEGIN
  IF _horas IS NULL OR _horas <= 0 THEN RETURN _inicio; END IF;
  cur := _inicio AT TIME ZONE tz;
  restante := _horas;
  FOR i IN 1..2000 LOOP
    EXIT WHEN restante <= 0;
    IF public.is_dia_util(_corr, cur::date) THEN
      dia_ini := date_trunc('day', cur) + interval '9 hour';
      dia_fim := date_trunc('day', cur) + interval '18 hour';
      IF cur < dia_ini THEN cur := dia_ini; END IF;
      IF cur < dia_fim THEN
        disp := extract(epoch FROM (dia_fim - cur))/3600.0;
        IF restante <= disp THEN
          RETURN (cur + (restante * interval '1 hour')) AT TIME ZONE tz;
        ELSE
          restante := restante - disp;
        END IF;
      END IF;
    END IF;
    cur := date_trunc('day', cur) + interval '1 day' + interval '9 hour';
  END LOOP;
  RETURN cur AT TIME ZONE tz;
END; $$;
