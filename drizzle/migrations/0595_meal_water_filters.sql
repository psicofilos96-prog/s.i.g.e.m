-- Controle de refil de purificadores (Anexo 12): cada troca é registro imutável; próxima troca = data + meses declarados no registro.
CREATE TABLE public.meal_water_filter_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  equipment text NOT NULL CHECK (length(btrim(equipment)) >= 2 AND length(equipment) <= 120),
  equipment_kind text NOT NULL CHECK (equipment_kind IN ('torneira','maior')),
  changed_on date NOT NULL,
  period_months int NOT NULL CHECK (period_months BETWEEN 1 AND 36),
  note text NULL CHECK (note IS NULL OR length(note) <= 1000),
  recorded_by uuid NOT NULL,
  grant_ref uuid NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key text NOT NULL UNIQUE
);
REVOKE ALL ON public.meal_water_filter_changes FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.meal_water_filter_changes TO service_role;
ALTER TABLE public.meal_water_filter_changes ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER mwf_append_only BEFORE UPDATE OR DELETE ON public.meal_water_filter_changes FOR EACH ROW EXECUTE FUNCTION public.import_append_only();

CREATE OR REPLACE FUNCTION public.record_meal_water_filter_change(_school text, _equipment text, _kind text, _on date, _months int, _note text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; nid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'meal:auth-required'; END IF;
  SELECT id INTO nid FROM public.meal_water_filter_changes WHERE idempotency_key = _key;
  IF nid IS NOT NULL THEN RETURN nid; END IF;
  IF _on IS NULL OR _on > CURRENT_DATE THEN RAISE EXCEPTION 'meal:execution-in-future'; END IF;
  g := public.meal_grant_on('registrar-execucao-alimentacao', _school, _on);
  INSERT INTO public.meal_water_filter_changes(school_id, equipment, equipment_kind, changed_on, period_months, note, recorded_by, grant_ref, idempotency_key)
  VALUES (_school, btrim(_equipment), _kind, _on, _months, nullif(btrim(_note),''), auth.uid(), g, _key) RETURNING id INTO nid;
  RETURN nid;
END $fn$;
REVOKE ALL ON FUNCTION public.record_meal_water_filter_change(text, text, text, date, int, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_meal_water_filter_change(text, text, text, date, int, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.meal_water_filters_at(_school text)
RETURNS TABLE(equipment text, equipment_kind text, changed_on date, period_months int, next_on date, note text, history int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  PERFORM public.meal_grant('consultar-alimentacao-escolar', _school);
  RETURN QUERY SELECT DISTINCT ON (w.equipment) w.equipment, w.equipment_kind, w.changed_on, w.period_months,
    (w.changed_on + make_interval(months => w.period_months))::date, w.note,
    (SELECT count(*)::int FROM public.meal_water_filter_changes x WHERE x.school_id = _school AND x.equipment = w.equipment)
  FROM public.meal_water_filter_changes w WHERE w.school_id = _school
  ORDER BY w.equipment, w.changed_on DESC, w.recorded_at DESC;
END $fn$;
REVOKE ALL ON FUNCTION public.meal_water_filters_at(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.meal_water_filters_at(text) TO authenticated;