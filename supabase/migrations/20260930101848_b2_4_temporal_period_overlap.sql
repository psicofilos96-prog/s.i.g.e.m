-- B2.4 corretiva: somente a validação temporal de sobreposição.
-- A migration 20260930083550 permanece como fato histórico aplicado.
-- Versões são efetivas de valid_from até a próxima mudança da mesma identidade;
-- datas dos períodos são inclusivas. Não altera dados nem capacidades.
CREATE OR REPLACE FUNCTION public.register_academic_period_version(
  _period text, _organization text, _base_version_id uuid, _official_name text,
  _starts_on date, _ends_on date, _is_active boolean, _valid_from date,
  _reason text, _act_ref text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _g uuid; _id text; _year text; _base public.institutional_academic_period_versions%ROWTYPE;
  _year_current public.institutional_academic_year_versions%ROWTYPE;
  _org_current public.institutional_period_organization_versions%ROWTYPE;
  _name text := nullif(btrim(coalesce(_official_name, '')), '');
BEGIN
  _g := public.b2_4_authorizing_engagement();
  IF _organization IS NULL THEN RAISE EXCEPTION 'period:organization-required'; END IF;
  IF _name IS NULL THEN RAISE EXCEPTION 'period:name-required'; END IF;
  IF _starts_on IS NULL OR _ends_on IS NULL OR _starts_on > _ends_on THEN RAISE EXCEPTION 'period:invalid-dates'; END IF;
  IF _is_active IS NULL THEN RAISE EXCEPTION 'period:status-required'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'period:valid-from-required'; END IF;
  IF coalesce(btrim(_act_ref), '') = '' THEN RAISE EXCEPTION 'period:act-required'; END IF;
  SELECT academic_year_id INTO _year FROM public.institutional_period_organizations WHERE id = _organization;
  IF _year IS NULL THEN RAISE EXCEPTION 'period:organization-not-found'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('academic-year:' || _year));
  PERFORM pg_advisory_xact_lock(hashtext('period-organization:' || _organization));
  SELECT * INTO _year_current FROM public.institutional_academic_year_versions
    WHERE academic_year_id = _year ORDER BY version DESC LIMIT 1;
  SELECT * INTO _org_current FROM public.institutional_period_organization_versions
    WHERE organization_id = _organization ORDER BY version DESC LIMIT 1;
  IF _year_current.id IS NULL OR NOT _year_current.is_active THEN RAISE EXCEPTION 'period:year-unavailable'; END IF;
  IF _org_current.id IS NULL OR NOT _org_current.is_active THEN RAISE EXCEPTION 'period:organization-unavailable'; END IF;
  IF _starts_on < _year_current.starts_on OR _ends_on > _year_current.ends_on
    THEN RAISE EXCEPTION 'period:outside-year'; END IF;
  IF _period IS NULL THEN
    IF _base_version_id IS NOT NULL THEN RAISE EXCEPTION 'period:unexpected-base'; END IF;
    _id := 'per-' || gen_random_uuid();
  ELSE
    SELECT * INTO _base FROM public.institutional_academic_period_versions
      WHERE period_id = _period ORDER BY version DESC LIMIT 1;
    IF _base.id IS NULL THEN RAISE EXCEPTION 'period:not-found'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.institutional_academic_periods
                   WHERE id = _period AND period_organization_id = _organization)
      THEN RAISE EXCEPTION 'period:organization-mismatch'; END IF;
    IF _base_version_id IS DISTINCT FROM _base.id THEN RAISE EXCEPTION 'period:base-superseded'; END IF;
    IF coalesce(btrim(_reason), '') = '' THEN RAISE EXCEPTION 'period:reason-required'; END IF;
    IF _valid_from < _base.valid_from THEN RAISE EXCEPTION 'period:valid-from-before-base'; END IF;
    IF _base.official_name = _name AND _base.starts_on = _starts_on AND _base.ends_on = _ends_on
      AND _base.is_active = _is_active AND _base.valid_from = _valid_from THEN RAISE EXCEPTION 'period:no-change'; END IF;
    _id := _period;
  END IF;
  -- A candidata vale de _valid_from em diante. A versão aplicável de outro
  -- período só pode mudar em sua própria valid_from; verificamos cada ponto.
  -- ORDER BY version replica a leitura institucional as-of, sem antecipar
  -- versões futuras nem reescrever retroativamente as versões anteriores.
  IF _is_active AND EXISTS (
    WITH checkpoints AS (
      SELECT _valid_from AS at_date
      UNION
      SELECT v.valid_from
      FROM public.institutional_academic_periods p
      JOIN public.institutional_academic_period_versions v ON v.period_id = p.id
      WHERE p.period_organization_id = _organization AND p.id <> _id
        AND v.valid_from > _valid_from
    )
    SELECT 1
    FROM checkpoints c
    JOIN public.institutional_academic_periods p
      ON p.period_organization_id = _organization AND p.id <> _id
    JOIN LATERAL (
      SELECT v.is_active, v.starts_on, v.ends_on
      FROM public.institutional_academic_period_versions v
      WHERE v.period_id = p.id AND v.valid_from <= c.at_date
      ORDER BY v.version DESC LIMIT 1
    ) applicable ON true
    WHERE applicable.is_active
      AND daterange(applicable.starts_on, applicable.ends_on, '[]')
          && daterange(_starts_on, _ends_on, '[]')
  ) THEN RAISE EXCEPTION 'period:overlap'; END IF;
  IF _period IS NULL THEN
    INSERT INTO public.institutional_academic_periods
      (id, academic_year_id, period_organization_id, label, starts_on, ends_on)
    VALUES (_id, _year, _organization, _name, _starts_on, _ends_on);
    INSERT INTO public.institutional_academic_period_versions
      (period_id, version, official_name, starts_on, ends_on, is_active, valid_from,
       originating_act_ref, recorded_by, recorded_by_person_id, recorded_via_engagement_id)
    VALUES (_id, 1, _name, _starts_on, _ends_on, _is_active, _valid_from,
            btrim(_act_ref), auth.uid(), public.current_person_id(), _g);
  ELSE
    INSERT INTO public.institutional_academic_period_versions
      (period_id, version, supersedes_id, official_name, starts_on, ends_on, is_active,
       valid_from, change_reason, originating_act_ref, recorded_by,
       recorded_by_person_id, recorded_via_engagement_id)
    VALUES (_id, _base.version + 1, _base.id, _name, _starts_on, _ends_on, _is_active,
            _valid_from, btrim(_reason), btrim(_act_ref), auth.uid(), public.current_person_id(), _g);
  END IF;
  RETURN _id;
END $$;
