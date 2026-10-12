CREATE TABLE public.permanence_rule_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_key text NOT NULL,
  version int NOT NULL CHECK (version >= 1),
  title text NOT NULL CHECK (length(btrim(title)) >= 3),
  scope jsonb NOT NULL DEFAULT '{}'::jsonb, -- eixos abertos: {"etapa": id, "modalidade": id, "periodo": id}
  conditions jsonb NOT NULL,                -- lista de primitivas declaradas
  combine text NOT NULL CHECK (combine IN ('todas','qualquer')),
  source_ref text NOT NULL,
  valid_from date NOT NULL,
  valid_to date,
  change_reason text,
  author_person uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (rule_key, version),
  CHECK (valid_to IS NULL OR valid_to >= valid_from),
  CHECK (jsonb_typeof(conditions) = 'array' AND jsonb_array_length(conditions) BETWEEN 1 AND 10),
  CHECK (version = 1 OR length(btrim(coalesce(change_reason,''))) >= 10)
);
CREATE TABLE public.permanence_rule_approvals (
  rule_version_id uuid PRIMARY KEY REFERENCES public.permanence_rule_versions(id),
  verdict text NOT NULL CHECK (verdict IN ('aprovada','recusada')),
  decision_ref text NOT NULL CHECK (length(btrim(decision_ref)) >= 3),
  approver_person uuid NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.permanence_rule_versions, public.permanence_rule_approvals TO authenticated;
GRANT ALL ON public.permanence_rule_versions, public.permanence_rule_approvals TO service_role;
ALTER TABLE public.permanence_rule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permanence_rule_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "perm rules readable by persons" ON public.permanence_rule_versions FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
CREATE POLICY "perm approvals readable by persons" ON public.permanence_rule_approvals FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
CREATE TRIGGER permanence_rule_versions_immutable BEFORE UPDATE OR DELETE ON public.permanence_rule_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER permanence_rule_approvals_immutable BEFORE UPDATE OR DELETE ON public.permanence_rule_approvals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.permanence_conditions_valid(_c jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_c) x WHERE NOT (
    (x->>'primitive' = 'taxa-faltas-acima' AND (x->>'value')::numeric > 0 AND (x->>'value')::numeric < 1 AND (x->>'minMarked')::int >= 1) OR
    (x->>'primitive' = 'faltas-consecutivas-min' AND (x->>'value')::int >= 1) OR
    (x->>'primitive' = 'faltas-acumuladas-min' AND (x->>'value')::int >= 1) OR
    (x->>'primitive' = 'tendencia-piora' AND (x->>'minMarked')::int >= 1 AND (x->>'tolerance')::numeric >= 0)
  )) $$;

CREATE OR REPLACE FUNCTION public.register_permanence_rule_version(_rule_key text, _expected_version int, _title text, _scope jsonb, _conditions jsonb, _combine text, _source_ref text, _valid_from date, _valid_to date, _change_reason text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _last int;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'permrule:no-person'; END IF;
  IF NOT public.has_network_capability('configurar-regras-de-permanencia') THEN RAISE EXCEPTION 'permrule:forbidden'; END IF;
  IF NOT public.permanence_conditions_valid(_conditions) THEN RAISE EXCEPTION 'permrule:invalid-conditions'; END IF;
  IF jsonb_typeof(coalesce(_scope,'{}'::jsonb)) <> 'object' OR EXISTS (SELECT 1 FROM jsonb_object_keys(coalesce(_scope,'{}'::jsonb)) k WHERE k NOT IN ('etapa','modalidade','periodo')) THEN
    RAISE EXCEPTION 'permrule:invalid-scope'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('permrule|' || _rule_key, 0));
  SELECT coalesce(max(version),0) INTO _last FROM public.permanence_rule_versions WHERE rule_key = _rule_key;
  IF _last <> _expected_version THEN RAISE EXCEPTION 'permrule:stale-base'; END IF;
  INSERT INTO public.permanence_rule_versions(rule_key, version, title, scope, conditions, combine, source_ref, valid_from, valid_to, change_reason, author_person)
  VALUES (_rule_key, _last+1, btrim(_title), coalesce(_scope,'{}'::jsonb), _conditions, _combine, btrim(_source_ref), _valid_from, _valid_to, nullif(btrim(_change_reason),''), _p);
  RETURN _last+1;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'permrule:invalid-version';
END $$;

CREATE OR REPLACE FUNCTION public.approve_permanence_rule_version(_rule_version_id uuid, _verdict text, _decision_ref text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _author uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'permrule:no-person'; END IF;
  IF NOT public.has_network_capability('aprovar-regras-de-permanencia') THEN RAISE EXCEPTION 'permrule:approve-forbidden'; END IF;
  SELECT author_person INTO _author FROM public.permanence_rule_versions WHERE id = _rule_version_id;
  IF _author IS NULL THEN RAISE EXCEPTION 'permrule:not-found'; END IF;
  IF _author = _p THEN RAISE EXCEPTION 'permrule:self-approval'; END IF;
  INSERT INTO public.permanence_rule_approvals(rule_version_id, verdict, decision_ref, approver_person) VALUES (_rule_version_id, _verdict, btrim(_decision_ref), _p);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'permrule:already-decided'; WHEN check_violation THEN RAISE EXCEPTION 'permrule:decision-required';
END $$;

REVOKE ALL ON FUNCTION public.permanence_conditions_valid(jsonb), public.register_permanence_rule_version(text,int,text,jsonb,jsonb,text,text,date,date,text), public.approve_permanence_rule_version(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.permanence_conditions_valid(jsonb), public.register_permanence_rule_version(text,int,text,jsonb,jsonb,text,text,date,date,text), public.approve_permanence_rule_version(uuid,text,text) TO authenticated;