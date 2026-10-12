CREATE TABLE public.permanence_plan_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id uuid NOT NULL REFERENCES public.aa_outreach_cases(id),
  version int NOT NULL CHECK (version >= 1),
  objectives jsonb NOT NULL,
  barrier_refs uuid[] NOT NULL DEFAULT '{}',
  actions jsonb NOT NULL,
  resources jsonb NOT NULL DEFAULT '[]'::jsonb,
  pedagogical_intervention_ref uuid, -- logical_id de aa_intervention_versions (Orientação); referência, nunca cópia
  reason text,
  author_person uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, version),
  CHECK (jsonb_typeof(objectives) = 'array' AND jsonb_array_length(objectives) BETWEEN 1 AND 20),
  CHECK (jsonb_typeof(actions) = 'array' AND jsonb_array_length(actions) BETWEEN 1 AND 50),
  CHECK (jsonb_typeof(resources) = 'array'),
  CHECK (version = 1 OR length(btrim(coalesce(reason,''))) >= 10)
);
CREATE TABLE public.permanence_plan_reviews (
  case_id uuid NOT NULL REFERENCES public.aa_outreach_cases(id),
  seq int NOT NULL CHECK (seq >= 1),
  plan_version int NOT NULL,
  kind text NOT NULL CHECK (kind IN ('resultado-de-acao','reavaliacao')),
  action_key text,
  outcome text NOT NULL CHECK (outcome IN ('realizada','parcial','nao-realizada','manter','ajustar','concluir')),
  evidence text NOT NULL CHECK (length(btrim(evidence)) >= 10),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (case_id, seq),
  CHECK (kind <> 'resultado-de-acao' OR (action_key IS NOT NULL AND outcome IN ('realizada','parcial','nao-realizada'))),
  CHECK (kind <> 'reavaliacao' OR outcome IN ('manter','ajustar','concluir'))
);
GRANT SELECT ON public.permanence_plan_versions, public.permanence_plan_reviews TO authenticated;
GRANT ALL ON public.permanence_plan_versions, public.permanence_plan_reviews TO service_role;
ALTER TABLE public.permanence_plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permanence_plan_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "plans by school" ON public.permanence_plan_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.aa_outreach_cases c WHERE c.id = case_id AND public.has_school_capability('acompanhar-permanencia', c.school_id)));
CREATE POLICY "plan reviews by school" ON public.permanence_plan_reviews FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.aa_outreach_cases c WHERE c.id = case_id AND public.has_school_capability('acompanhar-permanencia', c.school_id)));
CREATE TRIGGER ppv_immutable BEFORE UPDATE OR DELETE ON public.permanence_plan_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER ppr_immutable BEFORE UPDATE OR DELETE ON public.permanence_plan_reviews FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.record_permanence_plan_version(_case uuid, _expected_version int, _objectives jsonb, _barrier_refs uuid[], _actions jsonb, _resources jsonb, _intervention uuid, _reason text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _c public.aa_outreach_cases; _last int; _a jsonb;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'permplan:no-person'; END IF;
  SELECT * INTO _c FROM public.aa_outreach_cases WHERE id = _case;
  IF _c.id IS NULL OR NOT public.has_school_capability('elaborar-planos-de-permanencia', _c.school_id) THEN RAISE EXCEPTION 'permplan:unavailable'; END IF;
  FOR _a IN SELECT * FROM jsonb_array_elements(_actions) LOOP
    IF coalesce(_a->>'key','') !~ '^[a-z0-9-]{2,40}$' OR length(btrim(coalesce(_a->>'description',''))) < 5 OR length(btrim(coalesce(_a->>'responsible',''))) < 3 THEN
      RAISE EXCEPTION 'permplan:invalid-action'; END IF;
    IF _a ? 'due' AND (_a->>'due') IS NOT NULL AND (_a->>'due')::date < _c.opened_at::date THEN RAISE EXCEPTION 'permplan:invalid-action'; END IF;
  END LOOP;
  IF (SELECT count(DISTINCT x->>'key') FROM jsonb_array_elements(_actions) x) <> jsonb_array_length(_actions) THEN RAISE EXCEPTION 'permplan:duplicate-action'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(coalesce(_barrier_refs,'{}')) b WHERE NOT EXISTS (SELECT 1 FROM public.permanence_case_barriers pb WHERE pb.barrier_ref = b AND pb.case_id = _case)) THEN
    RAISE EXCEPTION 'permplan:barrier-mismatch'; END IF;
  IF _intervention IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.aa_intervention_versions i WHERE i.logical_id = _intervention AND i.school_id = _c.school_id) THEN
    RAISE EXCEPTION 'permplan:intervention-mismatch'; END IF;
  IF (_objectives::text || _actions::text || coalesce(_resources,'[]')::text) ~* '(cpf|laudo|\mcid\M|diagn[oó]stic|neglig)' THEN RAISE EXCEPTION 'permplan:forbidden-content'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('permplan|' || _case, 0));
  SELECT coalesce(max(version),0) INTO _last FROM public.permanence_plan_versions WHERE case_id = _case;
  IF _last <> _expected_version THEN RAISE EXCEPTION 'permplan:stale-base'; END IF;
  INSERT INTO public.permanence_plan_versions(case_id, version, objectives, barrier_refs, actions, resources, pedagogical_intervention_ref, reason, author_person)
  VALUES (_case, _last+1, _objectives, coalesce(_barrier_refs,'{}'), _actions, coalesce(_resources,'[]'::jsonb), _intervention, nullif(btrim(_reason),''), _p);
  RETURN _last+1;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'permplan:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.record_permanence_plan_review(_case uuid, _expected_seq int, _plan_version int, _kind text, _action_key text, _outcome text, _evidence text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _c public.aa_outreach_cases; _last int; _head int; _s int;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'permplan:no-person'; END IF;
  SELECT seq INTO _s FROM public.permanence_plan_reviews WHERE idempotency_key = _key AND case_id = _case;
  IF _s IS NOT NULL THEN RETURN _s; END IF;
  SELECT * INTO _c FROM public.aa_outreach_cases WHERE id = _case;
  IF _c.id IS NULL OR NOT public.has_school_capability('elaborar-planos-de-permanencia', _c.school_id) THEN RAISE EXCEPTION 'permplan:unavailable'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('permplan|' || _case, 0));
  SELECT max(version) INTO _head FROM public.permanence_plan_versions WHERE case_id = _case;
  IF _head IS NULL OR _head <> _plan_version THEN RAISE EXCEPTION 'permplan:not-current-version'; END IF;
  IF _kind = 'resultado-de-acao' AND NOT EXISTS (SELECT 1 FROM public.permanence_plan_versions v, jsonb_array_elements(v.actions) a
     WHERE v.case_id = _case AND v.version = _head AND a->>'key' = _action_key) THEN RAISE EXCEPTION 'permplan:unknown-action'; END IF;
  SELECT coalesce(max(seq),0) INTO _last FROM public.permanence_plan_reviews WHERE case_id = _case;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'permplan:stale-base'; END IF;
  INSERT INTO public.permanence_plan_reviews(case_id, seq, plan_version, kind, action_key, outcome, evidence, author_person, idempotency_key)
  VALUES (_case, _last+1, _head, _kind, _action_key, _outcome, btrim(_evidence), _p, _key);
  RETURN _last+1;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'permplan:invalid';
END $$;
REVOKE ALL ON FUNCTION public.record_permanence_plan_version(uuid,int,jsonb,uuid[],jsonb,jsonb,uuid,text), public.record_permanence_plan_review(uuid,int,int,text,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_permanence_plan_version(uuid,int,jsonb,uuid[],jsonb,jsonb,uuid,text), public.record_permanence_plan_review(uuid,int,int,text,text,text,text,text) TO authenticated;