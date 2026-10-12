ALTER TABLE public.enr_campaign_versions DROP CONSTRAINT IF EXISTS enr_campaign_versions_school_ids_check;
ALTER TABLE public.enr_campaign_versions ALTER COLUMN school_ids SET DEFAULT '{}'::uuid[];
ALTER TABLE public.enr_campaign_versions ADD COLUMN school_keys text[] NOT NULL DEFAULT '{}'::text[] CHECK (cardinality(school_keys) >= 1);
COMMENT ON COLUMN public.enr_campaign_versions.school_ids IS 'DEPRECATED: replaced by school_keys (canonical school_id text)';
REVOKE EXECUTE ON FUNCTION public.record_enr_campaign_version(uuid,int,text[],text[],uuid[],date,date,uuid,uuid,text) FROM authenticated;
CREATE OR REPLACE FUNCTION public.record_enr_campaign_version(_c uuid, _expected_version int, _stages text[], _modalities text[], _schools text[],
  _from date, _to date, _edital uuid, _rules uuid, _reason text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _last int; _y int;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'enr:no-person'; END IF;
  IF NOT public.has_network_capability('manter-campanhas-de-matricula') THEN RAISE EXCEPTION 'enr:unavailable'; END IF;
  SELECT cycle_year INTO _y FROM public.enr_campaigns WHERE id = _c FOR UPDATE;
  IF _y IS NULL THEN RAISE EXCEPTION 'enr:not-found'; END IF;
  IF public.enr_campaign_state(_c) <> 'rascunho' THEN RAISE EXCEPTION 'enr:not-draft'; END IF;
  SELECT coalesce(max(version),0) INTO _last FROM public.enr_campaign_versions WHERE campaign_id = _c;
  IF _last <> coalesce(_expected_version,0) THEN RAISE EXCEPTION 'enr:stale-version'; END IF;
  IF extract(year FROM _from)::int NOT IN (_y-1, _y) OR extract(year FROM _to)::int NOT IN (_y-1, _y) THEN RAISE EXCEPTION 'enr:period-outside-cycle'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(_schools) s WHERE NOT EXISTS (SELECT 1 FROM public.institutional_school_record_versions x WHERE x.school_id = s)) THEN RAISE EXCEPTION 'enr:unknown-school'; END IF;
  INSERT INTO public.enr_campaign_versions(campaign_id, version, stage_ids, modality_ids, school_keys, period_from, period_to,
    edital_act_version_id, rules_act_version_id, change_reason, author_person)
  VALUES (_c, _last+1, _stages, _modalities, _schools, _from, _to, _edital, _rules, nullif(btrim(coalesce(_reason,'')),''), _p);
  RETURN _last+1;
EXCEPTION WHEN check_violation OR unique_violation OR foreign_key_violation THEN RAISE EXCEPTION 'enr:invalid';
END $$;
REVOKE EXECUTE ON FUNCTION public.record_enr_campaign_version(uuid,int,text[],text[],text[],date,date,uuid,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_enr_campaign_version(uuid,int,text[],text[],text[],date,date,uuid,uuid,text) TO authenticated;