-- Matrículas — Lote corretivo 14: parâmetros oficiais (EI, EJA, distribuição, avisos, supressão territorial)
-- só por ato assinado no SIGEM Documentos (admin_act_signatures), versões append-only, aprovação por pessoa ≠ autor.
-- Publicar/retomar campanha recusa se faltar parâmetro aprovado que a campanha declarou depender.
-- Inscrição, atendimento assistido e demais registros obrigatórios NÃO são tocados. Nada é semeado.
CREATE TABLE IF NOT EXISTS public.enr_parameter_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parameter_key text NOT NULL CHECK (parameter_key IN ('grupos-etarios-educacao-infantil','idade-minima-eja','criterio-de-distribuicao','modelos-de-aviso','supressao-territorial')),
  version int NOT NULL CHECK (version >= 1),
  value jsonb NOT NULL,
  act_version_id uuid NOT NULL,
  valid_from date NOT NULL,
  reason text CHECK (reason IS NULL OR length(btrim(reason)) >= 10),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parameter_key, version),
  CHECK (version = 1 OR reason IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS public.enr_parameter_approvals (
  parameter_version_id uuid PRIMARY KEY REFERENCES public.enr_parameter_versions(id),
  decision text NOT NULL CHECK (length(btrim(decision)) >= 10),
  person_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.enr_campaign_parameter_requirements (
  campaign_id uuid NOT NULL REFERENCES public.enr_campaigns(id),
  parameter_key text NOT NULL CHECK (parameter_key IN ('grupos-etarios-educacao-infantil','idade-minima-eja','criterio-de-distribuicao','modelos-de-aviso','supressao-territorial')),
  person_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, parameter_key)
);
GRANT SELECT ON public.enr_parameter_versions, public.enr_parameter_approvals, public.enr_campaign_parameter_requirements TO authenticated;
GRANT ALL ON public.enr_parameter_versions, public.enr_parameter_approvals, public.enr_campaign_parameter_requirements TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.enr_parameter_versions, public.enr_parameter_approvals, public.enr_campaign_parameter_requirements FROM anon, authenticated, service_role;
ALTER TABLE public.enr_parameter_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enr_parameter_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enr_campaign_parameter_requirements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "enr param read" ON public.enr_parameter_versions;
CREATE POLICY "enr param read" ON public.enr_parameter_versions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "enr param appr read" ON public.enr_parameter_approvals;
CREATE POLICY "enr param appr read" ON public.enr_parameter_approvals FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "enr camp req read" ON public.enr_campaign_parameter_requirements;
CREATE POLICY "enr camp req read" ON public.enr_campaign_parameter_requirements FOR SELECT TO authenticated USING (public.enr_campaign_manager() OR public.enr_campaign_state(campaign_id) IN ('publicada','suspensa','encerrada'));
DROP TRIGGER IF EXISTS enr_param_immutable ON public.enr_parameter_versions;
CREATE TRIGGER enr_param_immutable BEFORE UPDATE OR DELETE ON public.enr_parameter_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
DROP TRIGGER IF EXISTS enr_param_appr_immutable ON public.enr_parameter_approvals;
CREATE TRIGGER enr_param_appr_immutable BEFORE UPDATE OR DELETE ON public.enr_parameter_approvals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
DROP TRIGGER IF EXISTS enr_camp_req_immutable ON public.enr_campaign_parameter_requirements;
CREATE TRIGGER enr_camp_req_immutable BEFORE UPDATE OR DELETE ON public.enr_campaign_parameter_requirements FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

-- Forma mínima de cada valor (a semântica é da norma, não do código).
CREATE OR REPLACE FUNCTION public.enr_parameter_value_ok(_k text, _v jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE _b jsonb; _prev int := -1;
BEGIN
  IF jsonb_typeof(_v) <> 'object' THEN RETURN false; END IF;
  IF _k = 'grupos-etarios-educacao-infantil' THEN
    IF coalesce(_v->>'dataDeCorte','') !~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' OR jsonb_typeof(_v->'faixas') <> 'array' OR jsonb_array_length(_v->'faixas') = 0 THEN RETURN false; END IF;
    FOR _b IN SELECT x FROM jsonb_array_elements(_v->'faixas') x ORDER BY (x->>'deMeses')::int LOOP
      IF jsonb_typeof(_b->'deMeses') <> 'number' OR jsonb_typeof(_b->'ateMeses') <> 'number' OR (_b->>'deMeses')::int < 0
         OR (_b->>'ateMeses')::int < (_b->>'deMeses')::int OR (_b->>'deMeses')::int <= _prev
         OR coalesce(_b->>'segmento','') NOT IN ('creche','pre-escola') OR length(btrim(coalesce(_b->>'rotulo',''))) < 2 THEN RETURN false; END IF;
      _prev := (_b->>'ateMeses')::int;
    END LOOP;
    RETURN true;
  ELSIF _k = 'idade-minima-eja' THEN
    RETURN jsonb_typeof(_v->'fundamentalAnos') = 'number' AND (_v->>'fundamentalAnos')::int BETWEEN 10 AND 30
      AND coalesce(_v->>'dataDeReferencia','') ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$';
  ELSIF _k = 'criterio-de-distribuicao' THEN
    RETURN jsonb_typeof(_v->'ordem') = 'array' AND jsonb_array_length(_v->'ordem') > 0
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_v->'ordem') x WHERE jsonb_typeof(x) <> 'string' OR length(btrim(x #>> '{}')) < 3)
      AND coalesce(_v->>'empate','') = 'nao-decidir';
  ELSIF _k = 'modelos-de-aviso' THEN
    RETURN jsonb_typeof(_v->'modelos') = 'array' AND jsonb_array_length(_v->'modelos') > 0
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_v->'modelos') x WHERE length(btrim(coalesce(x->>'tipo',''))) < 3 OR length(btrim(coalesce(x->>'texto',''))) < 10);
  ELSIF _k = 'supressao-territorial' THEN
    RETURN jsonb_typeof(_v->'minimoPorCelula') = 'number' AND (_v->>'minimoPorCelula')::int BETWEEN 2 AND 1000;
  END IF;
  RETURN false;
END $$;

-- Última versão aprovada vigente na data (versão posterior não aprovada não derruba a anterior).
CREATE OR REPLACE FUNCTION public.enr_parameter_in_force(_k text, _on date) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT v.id FROM public.enr_parameter_versions v JOIN public.enr_parameter_approvals a ON a.parameter_version_id = v.id
  WHERE v.parameter_key = _k AND v.valid_from <= _on ORDER BY v.version DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.record_enr_parameter(_parameter text, _expected int, _value jsonb, _act uuid, _valid_from date, _reason text, _key text) RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _v int; _cur int;
BEGIN
  SELECT version INTO _v FROM public.enr_parameter_versions WHERE idempotency_key = _key AND person_id = _p;
  IF _v IS NOT NULL THEN RETURN _v; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'enr:no-person'; END IF;
  IF NOT public.has_network_capability('configurar-parametros-de-matricula') THEN RAISE EXCEPTION 'enr:unavailable'; END IF;
  IF _act IS NULL OR NOT EXISTS (SELECT 1 FROM public.admin_act_signatures s WHERE s.act_version_id = _act) THEN RAISE EXCEPTION 'enr:act-unsigned'; END IF;
  IF _valid_from IS NULL THEN RAISE EXCEPTION 'enr:invalid'; END IF;
  IF NOT public.enr_parameter_value_ok(_parameter, _value) THEN RAISE EXCEPTION 'enr:invalid-value'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('enrparam:' || _parameter));
  SELECT coalesce(max(version), 0) INTO _cur FROM public.enr_parameter_versions WHERE parameter_key = _parameter;
  IF _cur <> coalesce(_expected, -1) THEN RAISE EXCEPTION 'enr:stale-version'; END IF;
  INSERT INTO public.enr_parameter_versions(parameter_key, version, value, act_version_id, valid_from, reason, person_id, idempotency_key)
  VALUES (_parameter, _cur + 1, _value, _act, _valid_from, nullif(btrim(_reason), ''), _p, _key);
  RETURN _cur + 1;
EXCEPTION WHEN check_violation OR unique_violation THEN RAISE EXCEPTION 'enr:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.approve_enr_parameter(_version uuid, _decision text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _c public.enr_parameter_versions;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'enr:no-person'; END IF;
  IF NOT public.has_network_capability('aprovar-parametros-de-matricula') THEN RAISE EXCEPTION 'enr:unavailable'; END IF;
  SELECT * INTO _c FROM public.enr_parameter_versions WHERE id = _version;
  IF _c.id IS NULL THEN RAISE EXCEPTION 'enr:not-found'; END IF;
  IF _c.person_id = _p THEN RAISE EXCEPTION 'enr:self-authorization'; END IF;
  IF EXISTS (SELECT 1 FROM public.enr_parameter_versions WHERE parameter_key = _c.parameter_key AND version > _c.version) THEN RAISE EXCEPTION 'enr:superseded'; END IF;
  IF EXISTS (SELECT 1 FROM public.enr_parameter_approvals WHERE parameter_version_id = _version) THEN RETURN; END IF;
  INSERT INTO public.enr_parameter_approvals(parameter_version_id, decision, person_id) VALUES (_version, btrim(_decision), _p);
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'enr:invalid';
END $$;

-- Campanha declara de quais parâmetros depende; só em rascunho, por quem mantém campanhas.
CREATE OR REPLACE FUNCTION public.declare_enr_campaign_parameter(_c uuid, _parameter text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id();
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'enr:no-person'; END IF;
  IF NOT public.has_network_capability('manter-campanhas-de-matricula') THEN RAISE EXCEPTION 'enr:unavailable'; END IF;
  IF public.enr_campaign_state(_c) IS DISTINCT FROM 'rascunho' THEN RAISE EXCEPTION 'enr:not-draft'; END IF;
  INSERT INTO public.enr_campaign_parameter_requirements(campaign_id, parameter_key, person_id) VALUES (_c, _parameter, _p)
  ON CONFLICT (campaign_id, parameter_key) DO NOTHING;
EXCEPTION WHEN check_violation OR foreign_key_violation THEN RAISE EXCEPTION 'enr:invalid';
END $$;

-- Lista o que falta para publicar hoje (vazio = nada bloqueia).
CREATE OR REPLACE FUNCTION public.enr_campaign_parameter_blockers(_c uuid) RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce(array_agg(r.parameter_key ORDER BY r.parameter_key), '{}') FROM public.enr_campaign_parameter_requirements r
  WHERE r.campaign_id = _c AND public.enr_parameter_in_force(r.parameter_key, current_date) IS NULL
$$;

CREATE OR REPLACE FUNCTION public.enr_campaign_publish_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.action IN ('publicar','retomar') AND cardinality(public.enr_campaign_parameter_blockers(NEW.campaign_id)) > 0 THEN
    RAISE EXCEPTION 'enr:parameter-missing';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS enr_campaign_publish_guard ON public.enr_campaign_events;
CREATE TRIGGER enr_campaign_publish_guard BEFORE INSERT ON public.enr_campaign_events FOR EACH ROW EXECUTE FUNCTION public.enr_campaign_publish_guard();

REVOKE ALL ON FUNCTION public.record_enr_parameter(text, int, jsonb, uuid, date, text, text), public.approve_enr_parameter(uuid, text),
  public.declare_enr_campaign_parameter(uuid, text), public.enr_campaign_parameter_blockers(uuid), public.enr_parameter_in_force(text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_enr_parameter(text, int, jsonb, uuid, date, text, text), public.approve_enr_parameter(uuid, text),
  public.declare_enr_campaign_parameter(uuid, text), public.enr_campaign_parameter_blockers(uuid), public.enr_parameter_in_force(text, date) TO authenticated;
REVOKE ALL ON FUNCTION public.enr_campaign_publish_guard() FROM PUBLIC, anon, authenticated;