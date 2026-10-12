-- Tecnologia L20: recurso pedagógico digital = serviço do catálogo L15 (identidade única); aqui só a avaliação pedagógica.
-- Critérios = versão append-only de rubrica com fonte, utilizável só aprovada por pessoa ≠ autor; avaliação append-only por
-- pessoa ≠ autor da versão do serviço, nota por critério dentro da escala, vínculo curricular só a item existente do referencial.
CREATE TABLE public.tech_pedagogical_rubric_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version int NOT NULL UNIQUE CHECK (version >= 1),
  criteria jsonb NOT NULL CHECK (jsonb_typeof(criteria) = 'array' AND jsonb_array_length(criteria) BETWEEN 1 AND 30),
  scale_max int NOT NULL CHECK (scale_max BETWEEN 2 AND 10),
  source_ref text NOT NULL CHECK (length(btrim(source_ref)) >= 3),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tech_pedagogical_rubric_approvals (
  rubric_version_id uuid PRIMARY KEY REFERENCES public.tech_pedagogical_rubric_versions(id),
  person_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.tech_pedagogical_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_version_id uuid NOT NULL REFERENCES public.tech_digital_service_versions(id),
  rubric_version_id uuid NOT NULL REFERENCES public.tech_pedagogical_rubric_versions(id),
  scores jsonb NOT NULL CHECK (jsonb_typeof(scores) = 'object'),
  verdict text NOT NULL CHECK (verdict IN ('recomendado','recomendado-com-ressalvas','nao-recomendado')),
  curricular_item_ids uuid[] NOT NULL DEFAULT '{}',
  rationale text NOT NULL CHECK (length(btrim(rationale)) BETWEEN 20 AND 4000),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.tech_pedagogical_rubric_versions, public.tech_pedagogical_rubric_approvals, public.tech_pedagogical_evaluations TO service_role;
REVOKE ALL ON public.tech_pedagogical_rubric_versions, public.tech_pedagogical_rubric_approvals, public.tech_pedagogical_evaluations FROM anon, authenticated;
GRANT SELECT ON public.tech_pedagogical_rubric_versions, public.tech_pedagogical_rubric_approvals, public.tech_pedagogical_evaluations TO authenticated;
ALTER TABLE public.tech_pedagogical_rubric_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_pedagogical_rubric_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_pedagogical_evaluations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ped rub read" ON public.tech_pedagogical_rubric_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "ped appr read" ON public.tech_pedagogical_rubric_approvals FOR SELECT TO authenticated USING (true);
CREATE POLICY "ped eval read" ON public.tech_pedagogical_evaluations FOR SELECT TO authenticated USING (true);
CREATE TRIGGER ped_rub_immutable BEFORE UPDATE OR DELETE ON public.tech_pedagogical_rubric_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER ped_appr_immutable BEFORE UPDATE OR DELETE ON public.tech_pedagogical_rubric_approvals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER ped_eval_immutable BEFORE UPDATE OR DELETE ON public.tech_pedagogical_evaluations FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.record_tech_pedagogical_rubric(_expected int, _criteria jsonb, _scale int, _source text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _last int; _prev int;
BEGIN
  SELECT version INTO _prev FROM public.tech_pedagogical_rubric_versions WHERE idempotency_key = _key; IF _prev IS NOT NULL THEN RETURN _prev; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('configurar-avaliacao-de-recursos-pedagogicos') THEN RAISE EXCEPTION 'sem-capacidade'; END IF;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(_criteria) c WHERE jsonb_typeof(c) <> 'object' OR coalesce(c->>'key','') !~ '^[a-z0-9-]{2,40}$' OR length(coalesce(c->>'label','')) < 3)
     OR (SELECT count(DISTINCT c->>'key') FROM jsonb_array_elements(_criteria) c) <> jsonb_array_length(_criteria) THEN RAISE EXCEPTION 'criterios-invalidos'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('tech-ped-rubric'));
  SELECT coalesce(max(version), 0) INTO _last FROM public.tech_pedagogical_rubric_versions;
  IF _last <> _expected THEN RAISE EXCEPTION 'versao-desatualizada'; END IF;
  INSERT INTO public.tech_pedagogical_rubric_versions(version, criteria, scale_max, source_ref, person_id, idempotency_key) VALUES (_last + 1, _criteria, _scale, btrim(_source), _p, _key);
  RETURN _last + 1;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dados-invalidos';
END $$;

CREATE OR REPLACE FUNCTION public.approve_tech_pedagogical_rubric(_rubric uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _r public.tech_pedagogical_rubric_versions;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('aprovar-avaliacao-de-recursos-pedagogicos') THEN RAISE EXCEPTION 'sem-capacidade'; END IF;
  SELECT * INTO _r FROM public.tech_pedagogical_rubric_versions WHERE id = _rubric;
  IF _r.id IS NULL THEN RAISE EXCEPTION 'indisponivel'; END IF;
  IF _r.person_id = _p THEN RAISE EXCEPTION 'autoaprovacao'; END IF;
  IF EXISTS (SELECT 1 FROM public.tech_pedagogical_rubric_versions WHERE version > _r.version) THEN RAISE EXCEPTION 'versao-superada'; END IF;
  INSERT INTO public.tech_pedagogical_rubric_approvals(rubric_version_id, person_id) VALUES (_rubric, _p);
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'ja-aprovada';
END $$;

CREATE OR REPLACE FUNCTION public.record_tech_pedagogical_evaluation(_service text, _scores jsonb, _verdict text, _items uuid[], _rationale text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _sv public.tech_digital_service_versions; _r public.tech_pedagogical_rubric_versions;
BEGIN
  SELECT id INTO _id FROM public.tech_pedagogical_evaluations WHERE idempotency_key = _key; IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('avaliar-recursos-pedagogicos') THEN RAISE EXCEPTION 'sem-capacidade'; END IF;
  SELECT * INTO _sv FROM public.tech_digital_service_versions WHERE service_key = _service ORDER BY version DESC LIMIT 1;
  IF _sv.id IS NULL OR NOT ('estudantes' = ANY(_sv.audience) OR 'professores' = ANY(_sv.audience)) THEN RAISE EXCEPTION 'nao-e-recurso-pedagogico'; END IF;
  IF _sv.person_id = _p THEN RAISE EXCEPTION 'autor-do-cadastro-nao-avalia'; END IF;
  SELECT * INTO _r FROM public.tech_pedagogical_rubric_versions ORDER BY version DESC LIMIT 1;
  IF _r.id IS NULL OR NOT EXISTS (SELECT 1 FROM public.tech_pedagogical_rubric_approvals WHERE rubric_version_id = _r.id) THEN RAISE EXCEPTION 'sem-rubrica-aprovada'; END IF;
  IF (SELECT count(*) FROM jsonb_object_keys(_scores)) <> jsonb_array_length(_r.criteria)
     OR EXISTS (SELECT 1 FROM jsonb_array_elements(_r.criteria) c WHERE NOT (_scores ? (c->>'key')) OR jsonb_typeof(_scores->(c->>'key')) <> 'number'
        OR (_scores->>(c->>'key'))::numeric NOT BETWEEN 0 AND _r.scale_max OR (_scores->>(c->>'key'))::numeric <> trunc((_scores->>(c->>'key'))::numeric))
  THEN RAISE EXCEPTION 'notas-invalidas'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(coalesce(_items, '{}')) i WHERE NOT EXISTS (SELECT 1 FROM public.curricular_reference_items x WHERE x.id = i)) THEN RAISE EXCEPTION 'item-curricular-inexistente'; END IF;
  INSERT INTO public.tech_pedagogical_evaluations(service_version_id, rubric_version_id, scores, verdict, curricular_item_ids, rationale, person_id, idempotency_key)
  VALUES (_sv.id, _r.id, _scores, _verdict, coalesce(_items, '{}'), btrim(_rationale), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'dados-invalidos';
END $$;
REVOKE ALL ON FUNCTION public.record_tech_pedagogical_rubric(int, jsonb, int, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_tech_pedagogical_rubric(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_tech_pedagogical_evaluation(text, jsonb, text, uuid[], text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_tech_pedagogical_rubric(int, jsonb, int, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_tech_pedagogical_rubric(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_tech_pedagogical_evaluation(text, jsonb, text, uuid[], text, text) TO authenticated;