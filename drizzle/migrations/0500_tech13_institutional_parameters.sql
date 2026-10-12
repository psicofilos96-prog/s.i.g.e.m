-- Tecnologia — Lote corretivo 13: parâmetros institucionais sem registro próprio (vida útil de equipamento,
-- limiar de supressão do mapa de conectividade, mínimo de respostas do autosserviço) viram versões append-only
-- por parâmetro, com fonte, utilizáveis só na última versão aprovada por pessoa ≠ autor. Nada é semeado.
CREATE TABLE IF NOT EXISTS public.tech_parameter_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parameter_key text NOT NULL CHECK (parameter_key IN ('vida-util-de-equipamento','limiar-de-supressao-do-mapa','minimo-de-respostas-do-autosservico')),
  version int NOT NULL CHECK (version >= 1),
  value_int int NOT NULL CHECK (value_int BETWEEN 1 AND 100000),
  unit text NOT NULL CHECK (unit IN ('meses','escolas','respostas')),
  scope_note text CHECK (scope_note IS NULL OR length(btrim(scope_note)) BETWEEN 3 AND 300),
  source text NOT NULL CHECK (length(btrim(source)) >= 10),
  reason text CHECK (reason IS NULL OR length(btrim(reason)) >= 10),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parameter_key, version),
  CHECK (version = 1 OR reason IS NOT NULL),
  CHECK ((parameter_key = 'vida-util-de-equipamento' AND unit = 'meses') OR (parameter_key = 'limiar-de-supressao-do-mapa' AND unit = 'escolas') OR (parameter_key = 'minimo-de-respostas-do-autosservico' AND unit = 'respostas'))
);
CREATE TABLE IF NOT EXISTS public.tech_parameter_approvals (
  parameter_version_id uuid PRIMARY KEY REFERENCES public.tech_parameter_versions(id),
  decision text NOT NULL CHECK (length(btrim(decision)) >= 10),
  person_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tech_parameter_versions, public.tech_parameter_approvals TO authenticated;
GRANT ALL ON public.tech_parameter_versions, public.tech_parameter_approvals TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.tech_parameter_versions, public.tech_parameter_approvals FROM anon, authenticated, service_role;
ALTER TABLE public.tech_parameter_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tech_parameter_approvals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tech param read" ON public.tech_parameter_versions;
CREATE POLICY "tech param read" ON public.tech_parameter_versions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "tech param appr read" ON public.tech_parameter_approvals;
CREATE POLICY "tech param appr read" ON public.tech_parameter_approvals FOR SELECT TO authenticated USING (true);
DROP TRIGGER IF EXISTS tech_param_immutable ON public.tech_parameter_versions;
CREATE TRIGGER tech_param_immutable BEFORE UPDATE OR DELETE ON public.tech_parameter_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
DROP TRIGGER IF EXISTS tech_param_appr_immutable ON public.tech_parameter_approvals;
CREATE TRIGGER tech_param_appr_immutable BEFORE UPDATE OR DELETE ON public.tech_parameter_approvals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.record_tech_parameter(_parameter text, _expected int, _value int, _scope_note text, _source text, _reason text, _key text) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _v int; _cur int;
BEGIN
  SELECT version INTO _v FROM public.tech_parameter_versions WHERE idempotency_key = _key;
  IF _v IS NOT NULL THEN RETURN _v; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('configurar-parametros-de-tecnologia') THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('techparam:' || coalesce(_parameter, '')));
  SELECT coalesce(max(version), 0) INTO _cur FROM public.tech_parameter_versions WHERE parameter_key = _parameter;
  IF _cur <> coalesce(_expected, -1) THEN RAISE EXCEPTION 'versao-desatualizada'; END IF;
  INSERT INTO public.tech_parameter_versions(parameter_key, version, value_int, unit, scope_note, source, reason, person_id, idempotency_key)
  VALUES (_parameter, _cur + 1, _value,
    CASE _parameter WHEN 'vida-util-de-equipamento' THEN 'meses' WHEN 'limiar-de-supressao-do-mapa' THEN 'escolas' ELSE 'respostas' END,
    nullif(btrim(_scope_note), ''), btrim(_source), nullif(btrim(_reason), ''), _p, _key);
  RETURN _cur + 1;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'parametro-invalido';
END $$;

CREATE OR REPLACE FUNCTION public.approve_tech_parameter(_version uuid, _decision text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _c public.tech_parameter_versions;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('aprovar-parametros-de-tecnologia') THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  SELECT * INTO _c FROM public.tech_parameter_versions WHERE id = _version;
  IF _c.id IS NULL THEN RAISE EXCEPTION 'indisponivel'; END IF;
  IF _c.person_id = _p THEN RAISE EXCEPTION 'aprovador-igual-autor'; END IF;
  IF EXISTS (SELECT 1 FROM public.tech_parameter_versions WHERE parameter_key = _c.parameter_key AND version > _c.version) THEN RAISE EXCEPTION 'versao-superada'; END IF;
  IF EXISTS (SELECT 1 FROM public.tech_parameter_approvals WHERE parameter_version_id = _version) THEN RETURN; END IF;
  INSERT INTO public.tech_parameter_approvals(parameter_version_id, decision, person_id) VALUES (_version, btrim(_decision), _p);
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'decisao-invalida';
END $$;
REVOKE ALL ON FUNCTION public.record_tech_parameter(text, int, int, text, text, text, text), public.approve_tech_parameter(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_tech_parameter(text, int, int, text, text, text, text), public.approve_tech_parameter(uuid, text) TO authenticated;