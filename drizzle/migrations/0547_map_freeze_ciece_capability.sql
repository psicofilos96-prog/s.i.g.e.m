CREATE OR REPLACE FUNCTION public.freeze_statistical_map(_school text, _year int, _month int, _note text DEFAULT NULL)
RETURNS public.statistical_map_freezes LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.statistical_map_freezes;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'sessão obrigatória'; END IF;
  -- Congelar é atribuição do CIECE (mesma capacidade que governa a competência do Mapa).
  IF NOT public.has_school_capability('manter-regra-de-competencia-do-mapa', _school) THEN RAISE EXCEPTION 'sem capacidade para congelar o mapa desta escola'; END IF;
  SELECT * INTO r FROM public.statistical_map_freezes WHERE school_id = _school AND year = _year AND month = _month;
  IF FOUND THEN RETURN r; END IF;
  INSERT INTO public.statistical_map_freezes(school_id, year, month, frozen_by, note)
  VALUES (_school, _year, _month, auth.uid(), nullif(btrim(_note), '')) RETURNING * INTO r;
  RETURN r;
END $$;