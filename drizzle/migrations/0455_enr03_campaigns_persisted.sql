-- Matrículas L03: campanhas persistidas. Conteúdo em versões append-only; estado = ledger de eventos com seq esperado.
-- Edital/regra = versão de ato do SIGEM Documentos (admin_case_act_versions) assinada; publicação só da versão autorizada.
CREATE TABLE public.enr_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_year int NOT NULL CHECK (cycle_year BETWEEN 2000 AND 2100),
  cycle_term text NOT NULL CHECK (cycle_term IN ('anual','1-semestre','2-semestre')),
  kind text NOT NULL CHECK (length(btrim(kind)) >= 2),
  author_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.enr_campaign_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.enr_campaigns(id),
  version int NOT NULL CHECK (version >= 1),
  stage_ids text[] NOT NULL CHECK (cardinality(stage_ids) >= 1),
  modality_ids text[] NOT NULL CHECK (cardinality(modality_ids) >= 1),
  school_ids uuid[] NOT NULL CHECK (cardinality(school_ids) >= 1),
  period_from date NOT NULL,
  period_to date NOT NULL,
  edital_act_version_id uuid REFERENCES public.admin_case_act_versions(id),
  rules_act_version_id uuid REFERENCES public.admin_case_act_versions(id),
  change_reason text,
  author_person uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, version),
  CHECK (period_to >= period_from),
  CHECK (version = 1 OR length(btrim(coalesce(change_reason,''))) >= 10)
);
CREATE TABLE public.enr_campaign_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.enr_campaigns(id),
  seq int NOT NULL CHECK (seq >= 1),
  action text NOT NULL CHECK (action IN ('enviar-revisao','devolver','autorizar','publicar','suspender','retomar','encerrar','cancelar')),
  to_state text NOT NULL CHECK (to_state IN ('rascunho','revisao','autorizada','publicada','suspensa','encerrada','cancelada')),
  on_version int NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, seq)
);
GRANT SELECT ON public.enr_campaigns, public.enr_campaign_versions, public.enr_campaign_events TO authenticated;
GRANT ALL ON public.enr_campaigns, public.enr_campaign_versions, public.enr_campaign_events TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.enr_campaigns, public.enr_campaign_versions, public.enr_campaign_events FROM authenticated, anon;
ALTER TABLE public.enr_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enr_campaign_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enr_campaign_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.enr_campaign_state(_c uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT e.to_state FROM public.enr_campaign_events e WHERE e.campaign_id = _c ORDER BY e.seq DESC LIMIT 1), 'rascunho')
$$;
CREATE OR REPLACE FUNCTION public.enr_campaign_manager() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.has_network_capability('manter-campanhas-de-matricula') OR public.has_network_capability('autorizar-campanhas-de-matricula') OR public.has_network_capability('publicar-campanhas-de-matricula')
$$;
-- Leitura: gestores veem tudo; demais autenticados só campanhas já publicadas (inclui suspensa/encerrada, como histórico público).
CREATE POLICY "enr campaigns read" ON public.enr_campaigns FOR SELECT TO authenticated
  USING (public.enr_campaign_manager() OR public.enr_campaign_state(id) IN ('publicada','suspensa','encerrada'));
CREATE POLICY "enr campaign versions read" ON public.enr_campaign_versions FOR SELECT TO authenticated
  USING (public.enr_campaign_manager() OR (public.enr_campaign_state(campaign_id) IN ('publicada','suspensa','encerrada')
    AND version = (SELECT e.on_version FROM public.enr_campaign_events e WHERE e.campaign_id = enr_campaign_versions.campaign_id AND e.action = 'publicar' ORDER BY e.seq DESC LIMIT 1)));
CREATE POLICY "enr campaign events read" ON public.enr_campaign_events FOR SELECT TO authenticated
  USING (public.enr_campaign_manager() OR public.enr_campaign_state(campaign_id) IN ('publicada','suspensa','encerrada'));

CREATE TRIGGER enr_campaigns_append_only BEFORE UPDATE OR DELETE ON public.enr_campaigns FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER enr_campaign_versions_append_only BEFORE UPDATE OR DELETE ON public.enr_campaign_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER enr_campaign_events_append_only BEFORE UPDATE OR DELETE ON public.enr_campaign_events FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.create_enr_campaign(_year int, _term text, _kind text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'enr:no-person'; END IF;
  SELECT id INTO _id FROM public.enr_campaigns WHERE idempotency_key = _key AND author_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF NOT public.has_network_capability('manter-campanhas-de-matricula') THEN RAISE EXCEPTION 'enr:unavailable'; END IF;
  INSERT INTO public.enr_campaigns(cycle_year, cycle_term, kind, author_person, idempotency_key)
  VALUES (_year, _term, btrim(_kind), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation OR unique_violation THEN RAISE EXCEPTION 'enr:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.record_enr_campaign_version(_c uuid, _expected_version int, _stages text[], _modalities text[], _schools uuid[],
  _from date, _to date, _edital uuid, _rules uuid, _reason text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _last int; _y int; _t text;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'enr:no-person'; END IF;
  IF NOT public.has_network_capability('manter-campanhas-de-matricula') THEN RAISE EXCEPTION 'enr:unavailable'; END IF;
  SELECT cycle_year, cycle_term INTO _y, _t FROM public.enr_campaigns WHERE id = _c FOR UPDATE;
  IF _y IS NULL THEN RAISE EXCEPTION 'enr:not-found'; END IF;
  IF public.enr_campaign_state(_c) <> 'rascunho' THEN RAISE EXCEPTION 'enr:not-draft'; END IF;
  SELECT coalesce(max(version),0) INTO _last FROM public.enr_campaign_versions WHERE campaign_id = _c;
  IF _last <> coalesce(_expected_version,0) THEN RAISE EXCEPTION 'enr:stale-version'; END IF;
  IF extract(year FROM _from)::int NOT IN (_y-1, _y) OR extract(year FROM _to)::int NOT IN (_y-1, _y) THEN RAISE EXCEPTION 'enr:period-outside-cycle'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(_schools) s WHERE NOT EXISTS (SELECT 1 FROM public.schools x WHERE x.id = s)) THEN RAISE EXCEPTION 'enr:unknown-school'; END IF;
  INSERT INTO public.enr_campaign_versions(campaign_id, version, stage_ids, modality_ids, school_ids, period_from, period_to,
    edital_act_version_id, rules_act_version_id, change_reason, author_person)
  VALUES (_c, _last+1, _stages, _modalities, _schools, _from, _to, _edital, _rules, nullif(btrim(coalesce(_reason,'')),''), _p);
  RETURN _last+1;
EXCEPTION WHEN check_violation OR unique_violation OR foreign_key_violation THEN RAISE EXCEPTION 'enr:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.record_enr_campaign_event(_c uuid, _expected_seq int, _action text, _reason text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _seq int; _state text; _ver int; _to text; _cap text; _v record; _done int;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'enr:no-person'; END IF;
  SELECT seq INTO _done FROM public.enr_campaign_events WHERE idempotency_key = _key AND person_id = _p;
  IF _done IS NOT NULL THEN RETURN _done; END IF;
  PERFORM 1 FROM public.enr_campaigns WHERE id = _c FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'enr:not-found'; END IF;
  SELECT coalesce(max(seq),0) INTO _seq FROM public.enr_campaign_events WHERE campaign_id = _c;
  IF _seq <> coalesce(_expected_seq,0) THEN RAISE EXCEPTION 'enr:stale-seq'; END IF;
  _state := public.enr_campaign_state(_c);
  SELECT max(version) INTO _ver FROM public.enr_campaign_versions WHERE campaign_id = _c;
  IF _ver IS NULL THEN RAISE EXCEPTION 'enr:no-version'; END IF;
  SELECT CASE
    WHEN _action='enviar-revisao' AND _state='rascunho' THEN 'revisao'
    WHEN _action='devolver' AND _state IN ('revisao','autorizada') THEN 'rascunho'
    WHEN _action='autorizar' AND _state='revisao' THEN 'autorizada'
    WHEN _action='publicar' AND _state='autorizada' THEN 'publicada'
    WHEN _action='suspender' AND _state='publicada' THEN 'suspensa'
    WHEN _action='retomar' AND _state='suspensa' THEN 'publicada'
    WHEN _action='encerrar' AND _state IN ('publicada','suspensa') THEN 'encerrada'
    WHEN _action='cancelar' AND _state IN ('rascunho','revisao','autorizada') THEN 'cancelada'
  END INTO _to;
  IF _to IS NULL THEN RAISE EXCEPTION 'enr:invalid-transition'; END IF;
  _cap := CASE WHEN _action IN ('autorizar','devolver') THEN 'autorizar-campanhas-de-matricula'
               WHEN _action IN ('publicar','suspender','retomar','encerrar') THEN 'publicar-campanhas-de-matricula'
               ELSE 'manter-campanhas-de-matricula' END;
  IF NOT public.has_network_capability(_cap) THEN RAISE EXCEPTION 'enr:unavailable'; END IF;
  SELECT * INTO _v FROM public.enr_campaign_versions WHERE campaign_id = _c AND version = _ver;
  IF _action = 'autorizar' THEN
    IF _v.author_person = _p THEN RAISE EXCEPTION 'enr:self-authorization'; END IF;
    IF EXISTS (SELECT 1 FROM public.enr_campaign_events e WHERE e.campaign_id=_c AND e.action='enviar-revisao' AND e.on_version=_ver AND e.person_id=_p)
      THEN RAISE EXCEPTION 'enr:self-authorization'; END IF;
    IF _v.edital_act_version_id IS NULL THEN RAISE EXCEPTION 'enr:edital-required'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.admin_act_signatures s WHERE s.act_version_id = _v.edital_act_version_id) THEN RAISE EXCEPTION 'enr:edital-unsigned'; END IF;
    IF _v.rules_act_version_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.admin_act_signatures s WHERE s.act_version_id = _v.rules_act_version_id) THEN RAISE EXCEPTION 'enr:rules-unsigned'; END IF;
  END IF;
  IF _action = 'publicar' THEN
    IF NOT EXISTS (SELECT 1 FROM public.enr_campaign_events e WHERE e.campaign_id=_c AND e.action='autorizar' AND e.on_version=_ver
      AND e.seq = (SELECT max(seq) FROM public.enr_campaign_events WHERE campaign_id=_c)) THEN RAISE EXCEPTION 'enr:not-authorized-version'; END IF;
    IF _v.period_to < current_date THEN RAISE EXCEPTION 'enr:period-elapsed'; END IF;
  END IF;
  INSERT INTO public.enr_campaign_events(campaign_id, seq, action, to_state, on_version, reason, person_id, idempotency_key)
  VALUES (_c, _seq+1, _action, _to, _ver, btrim(_reason), _p, _key);
  RETURN _seq+1;
EXCEPTION WHEN check_violation OR unique_violation THEN RAISE EXCEPTION 'enr:invalid';
END $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['enr_campaign_state(uuid)','enr_campaign_manager()','create_enr_campaign(int,text,text,text)',
    'record_enr_campaign_version(uuid,int,text[],text[],uuid[],date,date,uuid,uuid,text)','record_enr_campaign_event(uuid,int,text,text,text)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;