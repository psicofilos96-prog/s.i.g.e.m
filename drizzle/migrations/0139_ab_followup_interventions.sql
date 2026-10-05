ALTER TABLE public.school_pedagogical_records ADD COLUMN IF NOT EXISTS referral text;
ALTER TABLE public.school_pedagogical_records ADD COLUMN IF NOT EXISTS responsible_person_id uuid;
ALTER TABLE public.school_pedagogical_records ADD COLUMN IF NOT EXISTS period_id text;
ALTER TABLE public.school_pedagogical_records ADD COLUMN IF NOT EXISTS return_on date;
ALTER TABLE public.school_pedagogical_records ADD COLUMN IF NOT EXISTS status_value_id text;
ALTER TABLE public.school_pedagogical_records ADD COLUMN IF NOT EXISTS status_value_version integer;
COMMENT ON COLUMN public.school_pedagogical_records.status_value_id IS 'AB: situação do acompanhamento, só de catálogo homologado situacao-de-acompanhamento-pedagogico; nulo = não declarada.';

CREATE OR REPLACE FUNCTION public.record_school_pedagogical_record_v2(_base_id uuid, _kind text, _school text, _subject_kind text, _subject_id text,
  _category_value text, _body text, _visibility text, _occurred_on date, _reason text,
  _referral text, _responsible_person_id uuid, _period_id text, _return_on date, _status_value text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE _person uuid := public.current_person_id(); r uuid; st record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'followup:session-required'; END IF;
  IF _person IS NULL OR NOT EXISTS (SELECT 1 FROM public.institutional_persons p WHERE p.id = _person AND p.actor_nature = 'pessoa-natural')
    THEN RAISE EXCEPTION 'followup:natural-person-required'; END IF;
  IF _responsible_person_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.institutional_persons p WHERE p.id = _responsible_person_id AND p.actor_nature = 'pessoa-natural')
    THEN RAISE EXCEPTION 'followup:responsible-invalid'; END IF;
  IF _return_on IS NOT NULL AND _occurred_on IS NOT NULL AND _return_on < _occurred_on THEN RAISE EXCEPTION 'followup:return-before-occurrence'; END IF;
  IF length(coalesce(_referral,'')) > 4000 THEN RAISE EXCEPTION 'followup:referral-too-long'; END IF;
  IF _period_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.institutional_academic_periods p WHERE p.id = _period_id) THEN RAISE EXCEPTION 'followup:period-unknown'; END IF;
  IF _status_value IS NOT NULL THEN
    SELECT d.value_id, d.version INTO st FROM public.attribute_value_definitions d
     WHERE d.scheme_id = 'situacao-de-acompanhamento-pedagogico' AND d.value_id = _status_value AND d.status = 'homologado' ORDER BY d.version DESC LIMIT 1;
    IF st.value_id IS NULL THEN RAISE EXCEPTION 'followup:status-not-homologated'; END IF;
  END IF;
  r := public.record_school_pedagogical_record(_base_id, _kind, _school, _subject_kind, _subject_id, _category_value, _body, _visibility, _occurred_on, _reason);
  UPDATE public.school_pedagogical_records SET referral = nullif(btrim(_referral),''), responsible_person_id = _responsible_person_id, period_id = _period_id,
    return_on = _return_on, status_value_id = st.value_id, status_value_version = st.version WHERE id = r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.record_school_pedagogical_record_v2(uuid,text,text,text,text,text,text,text,date,text,text,uuid,text,date,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.record_school_pedagogical_record_v2(uuid,text,text,text,text,text,text,text,date,text,text,uuid,text,date,text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.record_school_pedagogical_record(uuid,text,text,text,text,text,text,text,date,text) FROM PUBLIC, anon, authenticated, service_role;
COMMENT ON FUNCTION public.record_school_pedagogical_record(uuid,text,text,text,text,text,text,text,date,text) IS 'AB: chamada só por record_school_pedagogical_record_v2 (pessoa natural + campos de intervenção).';
REVOKE EXECUTE ON FUNCTION public.school_pedagogical_records_at FROM PUBLIC, anon, service_role;