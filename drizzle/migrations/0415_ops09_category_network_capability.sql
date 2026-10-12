CREATE OR REPLACE FUNCTION public.register_ops_asset_category(_key text, _expected_version int, _label text, _conditions text[], _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _last int; _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsac:no-person'; END IF;
  IF NOT public.has_network_capability('configurar-categorias-patrimoniais') THEN RAISE EXCEPTION 'opsac:forbidden'; END IF;
  SELECT coalesce(max(version),0) INTO _last FROM public.ops_asset_category_versions WHERE category_key = _key;
  IF _last <> _expected_version THEN RAISE EXCEPTION 'opsac:conflict'; END IF;
  INSERT INTO public.ops_asset_category_versions(category_key, version, label, allowed_conditions, author_person, reason)
  VALUES (_key, _last + 1, btrim(_label), coalesce(_conditions,'{}'), _p, nullif(btrim(_reason),'')) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opsac:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.approve_ops_asset_category(_cv uuid, _decision_ref text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _v public.ops_asset_category_versions;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsac:no-person'; END IF;
  IF NOT public.has_network_capability('aprovar-categorias-patrimoniais') THEN RAISE EXCEPTION 'opsac:approve-forbidden'; END IF;
  SELECT * INTO _v FROM public.ops_asset_category_versions WHERE id = _cv;
  IF _v.id IS NULL THEN RAISE EXCEPTION 'opsac:not-found'; END IF;
  IF _v.author_person = _p THEN RAISE EXCEPTION 'opsac:self-approval'; END IF;
  INSERT INTO public.ops_asset_category_approvals(category_version_id, approver_person, decision_ref) VALUES (_cv, _p, btrim(_decision_ref));
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'opsac:already-approved';
  WHEN check_violation THEN RAISE EXCEPTION 'opsac:invalid';
END $$;