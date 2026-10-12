-- Centro de Operações L04: vistorias programadas/extraordinárias com checklist versionado aprovado,
-- evidências (referência a juntada do SIGEM Documentos, coluna oculta), recomendações com prioridade
-- configurada no checklist e responsáveis = atuação vigente. Vistoria NÃO é laudo técnico.

CREATE TABLE public.ops_checklist_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_key text NOT NULL CHECK (checklist_key ~ '^[a-z0-9-]{2,60}$'),
  version int NOT NULL CHECK (version >= 1),
  label text NOT NULL CHECK (length(btrim(label)) BETWEEN 2 AND 160),
  items jsonb NOT NULL CHECK (jsonb_typeof(items) = 'array' AND jsonb_array_length(items) >= 1),
  priorities text[] NOT NULL DEFAULT '{}',
  author_person uuid NOT NULL,
  reason text CHECK (reason IS NULL OR length(btrim(reason)) >= 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (checklist_key, version),
  CHECK (version = 1 OR reason IS NOT NULL)
);
CREATE TABLE public.ops_checklist_approvals (
  checklist_version_id uuid PRIMARY KEY REFERENCES public.ops_checklist_versions(id),
  approver_person uuid NOT NULL,
  decision_ref text NOT NULL CHECK (length(btrim(decision_ref)) >= 3),
  approved_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ops_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  space_id uuid REFERENCES public.ops_spaces(id),
  kind text NOT NULL CHECK (kind IN ('programada','extraordinaria')),
  scheduled_on date NOT NULL,
  checklist_version_id uuid NOT NULL REFERENCES public.ops_checklist_versions(id),
  responsible_engagement uuid NOT NULL REFERENCES public.institutional_engagements(id),
  motive text CHECK (motive IS NULL OR length(btrim(motive)) >= 10),
  request_id uuid REFERENCES public.ops_requests(id),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (kind <> 'extraordinaria' OR motive IS NOT NULL)
);

CREATE TABLE public.ops_inspection_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.ops_inspections(id),
  seq int NOT NULL CHECK (seq >= 1),
  kind text NOT NULL CHECK (kind IN ('realizada','nao-realizada','retificacao','cancelada')),
  performed_on date,
  answers jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(answers) = 'object'),
  recommendations jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(recommendations) = 'array'),
  evidence_refs uuid[] NOT NULL DEFAULT '{}',
  note text CHECK (note IS NULL OR length(btrim(note)) >= 10),
  inspector_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (inspection_id, seq),
  CHECK (kind NOT IN ('realizada','retificacao') OR performed_on IS NOT NULL),
  CHECK (kind NOT IN ('nao-realizada','retificacao','cancelada') OR note IS NOT NULL)
);

GRANT SELECT ON public.ops_checklist_versions, public.ops_checklist_approvals, public.ops_inspections TO authenticated;
GRANT SELECT (id, inspection_id, seq, kind, performed_on, answers, recommendations, note, inspector_person, idempotency_key, created_at)
  ON public.ops_inspection_records TO authenticated;
GRANT ALL ON public.ops_checklist_versions, public.ops_checklist_approvals, public.ops_inspections, public.ops_inspection_records TO service_role;
ALTER TABLE public.ops_checklist_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_checklist_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_inspection_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checklists readable by persons" ON public.ops_checklist_versions FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
CREATE POLICY "checklist approvals readable by persons" ON public.ops_checklist_approvals FOR SELECT TO authenticated USING (public.current_person_id() IS NOT NULL);
CREATE POLICY "inspections by school" ON public.ops_inspections FOR SELECT TO authenticated USING (public.ops_can_read('infraestrutura', school_id));
CREATE POLICY "inspection records by school" ON public.ops_inspection_records FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ops_inspections i WHERE i.id = inspection_id AND public.ops_can_read('infraestrutura', i.school_id)));

CREATE TRIGGER opscl_immutable BEFORE UPDATE OR DELETE ON public.ops_checklist_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opscla_immutable BEFORE UPDATE OR DELETE ON public.ops_checklist_approvals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opsin_immutable BEFORE UPDATE OR DELETE ON public.ops_inspections FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opsir_immutable BEFORE UPDATE OR DELETE ON public.ops_inspection_records FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.register_ops_checklist_version(_key text, _expected_version int, _label text, _items jsonb, _priorities text[], _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _last int; _id uuid; _it jsonb; _keys text[] := '{}';
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opscl:no-person'; END IF;
  IF NOT public.has_network_capability('configurar-checklists-de-vistoria') THEN RAISE EXCEPTION 'opscl:forbidden'; END IF;
  SELECT coalesce(max(version),0) INTO _last FROM public.ops_checklist_versions WHERE checklist_key = _key;
  IF _last <> _expected_version THEN RAISE EXCEPTION 'opscl:conflict'; END IF;
  IF jsonb_typeof(_items) <> 'array' THEN RAISE EXCEPTION 'opscl:invalid'; END IF;
  FOR _it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    IF coalesce(_it->>'key','') !~ '^[a-z0-9-]{1,60}$' OR length(btrim(coalesce(_it->>'label',''))) < 2
       OR jsonb_typeof(_it->'answers') <> 'array' OR jsonb_array_length(_it->'answers') < 2
       OR (_it->>'key') = ANY (_keys) THEN RAISE EXCEPTION 'opscl:invalid-item'; END IF;
    _keys := _keys || (_it->>'key');
  END LOOP;
  INSERT INTO public.ops_checklist_versions(checklist_key, version, label, items, priorities, author_person, reason)
  VALUES (_key, _last + 1, btrim(_label), _items, coalesce(_priorities,'{}'), _p, nullif(btrim(_reason),'')) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opscl:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.approve_ops_checklist_version(_cv uuid, _decision_ref text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _author uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opscl:no-person'; END IF;
  IF NOT public.has_network_capability('aprovar-checklists-de-vistoria') THEN RAISE EXCEPTION 'opscl:approve-forbidden'; END IF;
  SELECT author_person INTO _author FROM public.ops_checklist_versions WHERE id = _cv;
  IF _author IS NULL THEN RAISE EXCEPTION 'opscl:unavailable'; END IF;
  IF _author = _p THEN RAISE EXCEPTION 'opscl:self-approval'; END IF;
  INSERT INTO public.ops_checklist_approvals(checklist_version_id, approver_person, decision_ref) VALUES (_cv, _p, btrim(_decision_ref));
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'opscl:already-approved';
  WHEN check_violation THEN RAISE EXCEPTION 'opscl:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.ops_checklist_usable(_cv uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.ops_checklist_versions c JOIN public.ops_checklist_approvals a ON a.checklist_version_id = c.id
    WHERE c.id = _cv AND c.version = (SELECT max(version) FROM public.ops_checklist_versions x WHERE x.checklist_key = c.checklist_key))
$$;

CREATE OR REPLACE FUNCTION public.schedule_ops_inspection(_school text, _space uuid, _kind text, _on date, _cv uuid, _engagement uuid, _motive text, _request uuid, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _e public.institutional_engagements;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsin:no-person'; END IF;
  SELECT id INTO _id FROM public.ops_inspections WHERE idempotency_key = _key AND school_id = _school;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_school_capability('programar-vistorias', _school) THEN RAISE EXCEPTION 'opsin:unavailable'; END IF;
  IF NOT public.ops_checklist_usable(_cv) THEN RAISE EXCEPTION 'opsin:checklist-not-approved'; END IF;
  IF _space IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.ops_spaces s WHERE s.id = _space AND s.school_id = _school) THEN RAISE EXCEPTION 'opsin:invalid-space'; END IF;
  IF _request IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.ops_requests r WHERE r.id = _request AND r.school_id = _school AND r.sector = 'infraestrutura') THEN RAISE EXCEPTION 'opsin:invalid-request'; END IF;
  SELECT * INTO _e FROM public.institutional_engagements WHERE id = _engagement;
  IF _e.id IS NULL OR _e.school_id IS DISTINCT FROM _school OR _e.valid_from > _on OR (_e.valid_until IS NOT NULL AND _e.valid_until < _on) THEN
    RAISE EXCEPTION 'opsin:responsible-not-active'; END IF;
  INSERT INTO public.ops_inspections(school_id, space_id, kind, scheduled_on, checklist_version_id, responsible_engagement, motive, request_id, author_person, idempotency_key)
  VALUES (_school, _space, _kind, _on, _cv, _engagement, nullif(btrim(_motive),''), _request, _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opsin:invalid';
END $$;

-- Registro da vistoria: só pela PESSOA da atuação responsável, respostas ⊂ checklist, prioridade ⊂ configurada.
CREATE OR REPLACE FUNCTION public.record_ops_inspection(_inspection uuid, _expected_seq int, _kind text, _performed_on date,
  _answers jsonb, _recommendations jsonb, _evidence uuid[], _note text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _i public.ops_inspections; _c public.ops_checklist_versions; _last int; _seq int;
  _lastkind text; _k text; _v jsonb; _r jsonb; _resp uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsin:no-person'; END IF;
  SELECT seq INTO _seq FROM public.ops_inspection_records WHERE idempotency_key = _key AND inspection_id = _inspection;
  IF _seq IS NOT NULL THEN RETURN _seq; END IF;
  SELECT * INTO _i FROM public.ops_inspections WHERE id = _inspection FOR UPDATE;
  IF _i.id IS NULL OR NOT public.has_school_capability('realizar-vistorias', _i.school_id) THEN RAISE EXCEPTION 'opsin:unavailable'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.institutional_engagements e WHERE e.id = _i.responsible_engagement AND e.person_id = _p) THEN RAISE EXCEPTION 'opsin:not-responsible'; END IF;
  SELECT coalesce(max(seq),0) INTO _last FROM public.ops_inspection_records WHERE inspection_id = _inspection;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'opsin:conflict'; END IF;
  SELECT kind INTO _lastkind FROM public.ops_inspection_records WHERE inspection_id = _inspection AND seq = _last;
  IF _lastkind = 'cancelada' THEN RAISE EXCEPTION 'opsin:closed'; END IF;
  IF _kind = 'retificacao' AND _lastkind IS DISTINCT FROM 'realizada' AND _lastkind IS DISTINCT FROM 'retificacao' THEN RAISE EXCEPTION 'opsin:nothing-to-rectify'; END IF;
  IF _kind IN ('realizada','nao-realizada') AND _last > 0 THEN RAISE EXCEPTION 'opsin:already-recorded'; END IF;
  IF _performed_on IS NOT NULL AND _performed_on > current_date THEN RAISE EXCEPTION 'opsin:invalid-date'; END IF;
  SELECT * INTO _c FROM public.ops_checklist_versions WHERE id = _i.checklist_version_id;
  FOR _k, _v IN SELECT * FROM jsonb_each(coalesce(_answers,'{}')) LOOP
    IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_c.items) it WHERE it->>'key' = _k AND (it->'answers') ? (_v #>> '{}')) THEN
      RAISE EXCEPTION 'opsin:answer-not-in-checklist'; END IF;
  END LOOP;
  FOR _r IN SELECT * FROM jsonb_array_elements(coalesce(_recommendations,'[]')) LOOP
    IF length(btrim(coalesce(_r->>'text',''))) < 10 THEN RAISE EXCEPTION 'opsin:invalid-recommendation'; END IF;
    IF _r ? 'priority' AND NOT ((_r->>'priority') = ANY (_c.priorities)) THEN RAISE EXCEPTION 'opsin:priority-not-configured'; END IF;
    IF _r ? 'responsible' THEN
      _resp := (_r->>'responsible')::uuid;
      IF NOT EXISTS (SELECT 1 FROM public.institutional_engagements e WHERE e.id = _resp AND e.school_id = _i.school_id
        AND e.valid_from <= current_date AND (e.valid_until IS NULL OR e.valid_until >= current_date)) THEN RAISE EXCEPTION 'opsin:responsible-not-active'; END IF;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM unnest(coalesce(_evidence,'{}')) ev WHERE NOT EXISTS (SELECT 1 FROM public.admin_case_events ce WHERE ce.id = ev)) THEN
    RAISE EXCEPTION 'opsin:evidence-not-in-documents'; END IF;
  INSERT INTO public.ops_inspection_records(inspection_id, seq, kind, performed_on, answers, recommendations, evidence_refs, note, inspector_person, idempotency_key)
  VALUES (_inspection, _last + 1, _kind, _performed_on, coalesce(_answers,'{}'), coalesce(_recommendations,'[]'), coalesce(_evidence,'{}'), nullif(btrim(_note),''), _p, _key);
  RETURN _last + 1;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opsin:invalid';
  WHEN invalid_text_representation THEN RAISE EXCEPTION 'opsin:invalid';
END $$;

REVOKE ALL ON FUNCTION public.register_ops_checklist_version(text,int,text,jsonb,text[],text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_ops_checklist_version(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.schedule_ops_inspection(text,uuid,text,date,uuid,uuid,text,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_ops_inspection(uuid,int,text,date,jsonb,jsonb,uuid[],text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_ops_checklist_version(text,int,text,jsonb,text[],text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_ops_checklist_version(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.schedule_ops_inspection(text,uuid,text,date,uuid,uuid,text,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_ops_inspection(uuid,int,text,date,jsonb,jsonb,uuid[],text,text) TO authenticated;
