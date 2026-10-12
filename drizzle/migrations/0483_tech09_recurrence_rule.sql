-- Tecnologia L09: regra de recorrência (janela em dias + mínimo de incidentes por chave) é configuração versionada
-- com fonte, utilizável só na última versão aprovada por pessoa ≠ autor. A análise é projeção na leitura.
CREATE TABLE public.tech_recurrence_rule_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version int NOT NULL UNIQUE CHECK (version >= 1),
  window_days int NOT NULL CHECK (window_days BETWEEN 1 AND 366),
  min_incidents int NOT NULL CHECK (min_incidents BETWEEN 2 AND 1000),
  source text NOT NULL CHECK (length(btrim(source)) >= 10),
  reason text CHECK (reason IS NULL OR length(btrim(reason)) >= 10),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (version = 1 OR reason IS NOT NULL)
);
CREATE TABLE public.tech_recurrence_rule_approvals (
  rule_version_id uuid PRIMARY KEY REFERENCES public.tech_recurrence_rule_versions(id),
  decision text NOT NULL CHECK (length(btrim(decision)) >= 10),
  person_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tech_recurrence_rule_versions, public.tech_recurrence_rule_approvals TO authenticated;
GRANT ALL ON public.tech_recurrence_rule_versions, public.tech_recurrence_rule_approvals TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.tech_recurrence_rule_versions, public.tech_recurrence_rule_approvals FROM anon, authenticated, service_role;
ALTER TABLE public.tech_recurrence_rule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_recurrence_rule_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tech rec read" ON public.tech_recurrence_rule_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "tech rec appr read" ON public.tech_recurrence_rule_approvals FOR SELECT TO authenticated USING (true);
CREATE TRIGGER tech_rec_immutable BEFORE UPDATE OR DELETE ON public.tech_recurrence_rule_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER tech_rec_appr_immutable BEFORE UPDATE OR DELETE ON public.tech_recurrence_rule_approvals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.record_tech_recurrence_rule(_window int, _min int, _source text, _reason text, _key text) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _v int;
BEGIN
  SELECT version INTO _v FROM public.tech_recurrence_rule_versions WHERE idempotency_key = _key;
  IF _v IS NOT NULL THEN RETURN _v; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('configurar-prazos-de-tecnologia') THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('techrec'));
  SELECT coalesce(max(version), 0) + 1 INTO _v FROM public.tech_recurrence_rule_versions;
  INSERT INTO public.tech_recurrence_rule_versions(version, window_days, min_incidents, source, reason, person_id, idempotency_key)
  VALUES (_v, _window, _min, btrim(_source), _reason, _p, _key);
  RETURN _v;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'regra-invalida';
END $$;

CREATE OR REPLACE FUNCTION public.approve_tech_recurrence_rule(_version uuid, _decision text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _c public.tech_recurrence_rule_versions;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('aprovar-prazos-de-tecnologia') THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  SELECT * INTO _c FROM public.tech_recurrence_rule_versions WHERE id = _version;
  IF _c.id IS NULL THEN RAISE EXCEPTION 'indisponivel'; END IF;
  IF _c.person_id = _p THEN RAISE EXCEPTION 'aprovador-igual-autor'; END IF;
  IF EXISTS (SELECT 1 FROM public.tech_recurrence_rule_approvals WHERE rule_version_id = _version) THEN RETURN; END IF;
  INSERT INTO public.tech_recurrence_rule_approvals(rule_version_id, decision, person_id) VALUES (_version, btrim(_decision), _p);
END $$;
REVOKE ALL ON FUNCTION public.record_tech_recurrence_rule(int, int, text, text, text), public.approve_tech_recurrence_rule(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_tech_recurrence_rule(int, int, text, text, text), public.approve_tech_recurrence_rule(uuid, text) TO authenticated;
