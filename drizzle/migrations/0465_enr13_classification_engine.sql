-- Matrículas L13: critérios de classificação versionados por campanha, vinculados ao edital assinado da versão da campanha,
-- aprovados por pessoa ≠ autor; execuções (simulação ou oficial) guardam snapshot das entradas + hashes; reprocessamento confere hash.
-- O motor (TS determinístico `distribution-engine`) produz proposta; nada aqui contempla vaga, reserva ou matrícula.
CREATE OR REPLACE FUNCTION public.enr_rules_valid(_r jsonb) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT jsonb_typeof(_r) = 'array' AND NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(_r) e
    WHERE jsonb_typeof(e) <> 'object'
       OR coalesce(e->>'factKey','') !~ '^[a-z0-9-]{2,60}$'
       OR coalesce(e->>'primitive','') NOT IN ('verdadeiro-primeiro','menor-primeiro','maior-primeiro')
       OR length(btrim(coalesce(e->>'basis',''))) < 5)
$$;
CREATE TABLE public.enr_classification_criteria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.enr_campaigns(id),
  version int NOT NULL CHECK (version >= 1),
  campaign_version int NOT NULL,
  edital_act_version_id uuid NOT NULL REFERENCES public.admin_case_act_versions(id),
  rules jsonb NOT NULL CHECK (public.enr_rules_valid(rules) AND jsonb_array_length(rules) >= 1),
  tiebreaks jsonb NOT NULL CHECK (public.enr_rules_valid(tiebreaks)),
  justification text NOT NULL CHECK (length(btrim(justification)) >= 20),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, version)
);
CREATE TABLE public.enr_classification_criteria_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  criteria_id uuid NOT NULL UNIQUE REFERENCES public.enr_classification_criteria(id),
  approver_person uuid NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 20),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.enr_classification_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.enr_campaigns(id),
  criteria_id uuid NOT NULL REFERENCES public.enr_classification_criteria(id),
  mode text NOT NULL CHECK (mode IN ('simulacao','oficial')),
  engine_version text NOT NULL CHECK (engine_version ~ '^[a-z0-9.-]{3,40}$'),
  input_snapshot jsonb NOT NULL,
  input_hash text NOT NULL CHECK (input_hash ~ '^[0-9a-f]{64}$'),
  result jsonb NOT NULL,
  result_hash text NOT NULL CHECK (result_hash ~ '^[0-9a-f]{64}$'),
  reprocess_of uuid REFERENCES public.enr_classification_runs(id),
  reprocess_matches boolean,
  run_by_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((reprocess_of IS NULL) = (reprocess_matches IS NULL))
);
GRANT SELECT ON public.enr_classification_criteria, public.enr_classification_criteria_approvals, public.enr_classification_runs TO authenticated;
GRANT ALL ON public.enr_classification_criteria, public.enr_classification_criteria_approvals, public.enr_classification_runs TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.enr_classification_criteria, public.enr_classification_criteria_approvals, public.enr_classification_runs FROM authenticated, anon;
ALTER TABLE public.enr_classification_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enr_classification_criteria_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enr_classification_runs ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.enr_classifier() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.has_network_capability('classificar-inscricoes-de-ingresso') OR public.has_network_capability('autorizar-campanhas-de-matricula') OR public.has_network_capability('manter-campanhas-de-matricula')
$$;
CREATE POLICY "enr crit read" ON public.enr_classification_criteria FOR SELECT TO authenticated USING (public.enr_classifier());
CREATE POLICY "enr crit appr read" ON public.enr_classification_criteria_approvals FOR SELECT TO authenticated USING (public.enr_classifier());
CREATE POLICY "enr runs read" ON public.enr_classification_runs FOR SELECT TO authenticated USING (public.enr_classifier());
CREATE TRIGGER enr_crit_append_only BEFORE UPDATE OR DELETE ON public.enr_classification_criteria FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER enr_crit_appr_append_only BEFORE UPDATE OR DELETE ON public.enr_classification_criteria_approvals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER enr_runs_append_only BEFORE UPDATE OR DELETE ON public.enr_classification_runs FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

-- Critério só referencia o edital da versão da campanha (assinado no L03); versão com base esperada.
CREATE OR REPLACE FUNCTION public.record_enr_classification_criteria(_campaign uuid, _expected_version int, _campaign_version int, _rules jsonb, _tiebreaks jsonb, _justification text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _last int; _edital uuid;
BEGIN
  SELECT id INTO _id FROM public.enr_classification_criteria WHERE idempotency_key = _key;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF _p IS NULL OR NOT public.has_network_capability('manter-campanhas-de-matricula') THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  SELECT v.edital_act_version_id INTO _edital FROM public.enr_campaign_versions v WHERE v.campaign_id = _campaign AND v.version = _campaign_version;
  IF _edital IS NULL THEN RAISE EXCEPTION 'edital-ausente'; END IF;
  SELECT coalesce(max(version),0) INTO _last FROM public.enr_classification_criteria WHERE campaign_id = _campaign;
  IF _last <> _expected_version THEN RAISE EXCEPTION 'versao-desatualizada'; END IF;
  INSERT INTO public.enr_classification_criteria(campaign_id, version, campaign_version, edital_act_version_id, rules, tiebreaks, justification, author_person, idempotency_key)
  VALUES (_campaign, _last + 1, _campaign_version, _edital, _rules, coalesce(_tiebreaks,'[]'::jsonb), _justification, _p, _key) RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.approve_enr_classification_criteria(_criteria uuid, _reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _author uuid; _id uuid;
BEGIN
  SELECT id INTO _id FROM public.enr_classification_criteria_approvals WHERE criteria_id = _criteria;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF _p IS NULL OR NOT public.has_network_capability('autorizar-campanhas-de-matricula') THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  SELECT author_person INTO _author FROM public.enr_classification_criteria WHERE id = _criteria FOR UPDATE;
  IF _author IS NULL THEN RAISE EXCEPTION 'criterio-inexistente'; END IF;
  IF _author = _p THEN RAISE EXCEPTION 'aprovador-igual-autor'; END IF;
  INSERT INTO public.enr_classification_criteria_approvals(criteria_id, approver_person, reason) VALUES (_criteria, _p, _reason) RETURNING id INTO _id;
  RETURN _id;
END $$;

-- Execução: hash das entradas e do resultado recalculados no banco sobre o texto canônico enviado (não confia no hash do cliente).
-- Oficial exige critério APROVADO; reprocessamento exige mesmo snapshot e registra se o resultado coincidiu.
CREATE OR REPLACE FUNCTION public.record_enr_classification_run(_criteria uuid, _mode text, _engine text, _snapshot_text text, _result_text text, _reprocess_of uuid, _key text)
RETURNS TABLE(run_id uuid, input_hash text, result_hash text, reprocess_matches boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _c public.enr_classification_criteria; _ih text; _rh text; _prev public.enr_classification_runs; _m boolean; _id uuid; _r public.enr_classification_runs;
BEGIN
  SELECT * INTO _r FROM public.enr_classification_runs WHERE idempotency_key = _key;
  IF _r.id IS NOT NULL THEN RETURN QUERY SELECT _r.id, _r.input_hash, _r.result_hash, _r.reprocess_matches; RETURN; END IF;
  IF _p IS NULL OR NOT public.has_network_capability('classificar-inscricoes-de-ingresso') THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  SELECT * INTO _c FROM public.enr_classification_criteria WHERE id = _criteria;
  IF _c.id IS NULL THEN RAISE EXCEPTION 'criterio-inexistente'; END IF;
  IF _mode = 'oficial' AND NOT EXISTS (SELECT 1 FROM public.enr_classification_criteria_approvals a WHERE a.criteria_id = _criteria) THEN RAISE EXCEPTION 'criterio-nao-aprovado'; END IF;
  _ih := encode(extensions.digest(_snapshot_text, 'sha256'), 'hex');
  _rh := encode(extensions.digest(_result_text, 'sha256'), 'hex');
  IF _reprocess_of IS NOT NULL THEN
    SELECT * INTO _prev FROM public.enr_classification_runs WHERE id = _reprocess_of;
    IF _prev.id IS NULL OR _prev.criteria_id <> _criteria OR _prev.input_hash <> _ih THEN RAISE EXCEPTION 'reprocessamento-com-entrada-diferente'; END IF;
    _m := (_prev.result_hash = _rh);
  END IF;
  INSERT INTO public.enr_classification_runs(campaign_id, criteria_id, mode, engine_version, input_snapshot, input_hash, result, result_hash, reprocess_of, reprocess_matches, run_by_person, idempotency_key)
  VALUES (_c.campaign_id, _criteria, _mode, _engine, _snapshot_text::jsonb, _ih, _result_text::jsonb, _rh, _reprocess_of, _m, _p, _key) RETURNING id INTO _id;
  RETURN QUERY SELECT _id, _ih, _rh, _m;
END $$;

REVOKE ALL ON FUNCTION public.enr_rules_valid(jsonb), public.enr_classifier(), public.record_enr_classification_criteria(uuid,int,int,jsonb,jsonb,text,text),
  public.approve_enr_classification_criteria(uuid,text), public.record_enr_classification_run(uuid,text,text,text,text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_enr_classification_criteria(uuid,int,int,jsonb,jsonb,text,text),
  public.approve_enr_classification_criteria(uuid,text), public.record_enr_classification_run(uuid,text,text,text,text,uuid,text) TO authenticated;