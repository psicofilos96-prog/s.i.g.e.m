-- Centro de Operações L12: conservação/manutenção e baixa formal. Baixa só por processo: proposta (motivo + processo
-- administrativo L07 + laudo/avaliação juntados) → autorização por pessoa ≠ proponente com decisão → destinação com
-- comprovante → efetivação que grava o evento 'baixa' na cadeia do bem. Trigger recusa 'baixa' sem processo autorizado.
-- Nada é apagado: identidade e cadeia são append-only.
CREATE TABLE public.ops_asset_maintenance_links (
  asset_id uuid NOT NULL REFERENCES public.ops_assets(id),
  maintenance_order_id uuid NOT NULL REFERENCES public.ops_maintenance_orders(id),
  author_person uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (asset_id, maintenance_order_id)
);
CREATE TABLE public.ops_asset_disposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id uuid NOT NULL REFERENCES public.ops_assets(id),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  reason_kind text NOT NULL CHECK (reason_kind IN ('inservivel','obsolescencia','antieconomico','extravio','furto-roubo','sinistro','outro')),
  justification text NOT NULL CHECK (length(btrim(justification)) >= 20),
  case_id uuid NOT NULL REFERENCES public.admin_case_files(id),
  assessment_ref uuid NOT NULL REFERENCES public.admin_case_events(id),
  base_asset_seq int NOT NULL,
  proposer_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.ops_asset_disposal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  disposal_id uuid NOT NULL REFERENCES public.ops_asset_disposals(id),
  seq int NOT NULL CHECK (seq >= 1),
  kind text NOT NULL CHECK (kind IN ('autorizacao','indeferimento','destinacao','efetivacao','arquivamento')),
  decision_ref text,
  destination_kind text CHECK (destination_kind IN ('doacao','alienacao','reciclagem','descarte-ambiental','devolucao','inutilizacao','nao-aplicavel')),
  destination_party text,
  doc_ref uuid REFERENCES public.admin_case_events(id),
  effective_on date NOT NULL,
  note text,
  actor_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (disposal_id, seq),
  CHECK (kind NOT IN ('autorizacao','indeferimento') OR length(btrim(coalesce(decision_ref,''))) >= 3),
  CHECK (kind <> 'indeferimento' OR length(btrim(coalesce(note,''))) >= 10),
  CHECK (kind <> 'destinacao' OR (destination_kind IS NOT NULL AND doc_ref IS NOT NULL AND (destination_kind = 'nao-aplicavel' OR length(btrim(coalesce(destination_party,''))) >= 3))),
  CHECK (kind <> 'arquivamento' OR length(btrim(coalesce(note,''))) >= 10)
);
CREATE UNIQUE INDEX ops_disposal_terminal ON public.ops_asset_disposal_events (disposal_id) WHERE kind IN ('indeferimento','efetivacao','arquivamento');

CREATE OR REPLACE FUNCTION public.ops_disposal_state(_d uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT coalesce((SELECT CASE kind WHEN 'autorizacao' THEN 'autorizada' WHEN 'indeferimento' THEN 'indeferida' WHEN 'destinacao' THEN 'destinada'
    WHEN 'efetivacao' THEN 'efetivada' WHEN 'arquivamento' THEN 'arquivada' END FROM public.ops_asset_disposal_events WHERE disposal_id = _d ORDER BY seq DESC LIMIT 1), 'proposta')
$$;
REVOKE ALL ON FUNCTION public.ops_disposal_state(uuid) FROM PUBLIC, anon, authenticated;

-- Guarda de banco: evento 'baixa' só se existir processo do bem no estado 'destinada' (efetivação em curso).
CREATE OR REPLACE FUNCTION public.ops_asset_writeoff_guard() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.kind = 'baixa' AND NOT EXISTS (SELECT 1 FROM public.ops_asset_disposals d WHERE d.asset_id = NEW.asset_id
       AND public.ops_disposal_state(d.id) = 'destinada' AND NEW.doc_ref IS NOT NULL) THEN
    RAISE EXCEPTION 'opsa:writeoff-requires-process';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.ops_asset_writeoff_guard() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER opsae_writeoff_guard BEFORE INSERT ON public.ops_asset_events FOR EACH ROW EXECUTE FUNCTION public.ops_asset_writeoff_guard();
CREATE TRIGGER opsaml_immutable BEFORE UPDATE OR DELETE ON public.ops_asset_maintenance_links FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opsad_immutable BEFORE UPDATE OR DELETE ON public.ops_asset_disposals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER opsade_immutable BEFORE UPDATE OR DELETE ON public.ops_asset_disposal_events FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
-- Identidade do bem nunca é apagada nem editada (já append-only); reforço explícito contra TRUNCATE.
CREATE OR REPLACE FUNCTION public.ops_no_truncate() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'append-only: truncate proibido'; END $$;
CREATE TRIGGER opsa_no_truncate BEFORE TRUNCATE ON public.ops_assets FOR EACH STATEMENT EXECUTE FUNCTION public.ops_no_truncate();
CREATE TRIGGER opsae_no_truncate BEFORE TRUNCATE ON public.ops_asset_events FOR EACH STATEMENT EXECUTE FUNCTION public.ops_no_truncate();

GRANT SELECT ON public.ops_asset_maintenance_links TO authenticated;
GRANT SELECT (id, asset_id, school_id, reason_kind, justification, case_id, base_asset_seq, proposer_person, idempotency_key, created_at) ON public.ops_asset_disposals TO authenticated;
GRANT SELECT (id, disposal_id, seq, kind, decision_ref, destination_kind, destination_party, effective_on, note, actor_person, idempotency_key, created_at) ON public.ops_asset_disposal_events TO authenticated;
GRANT ALL ON public.ops_asset_maintenance_links, public.ops_asset_disposals, public.ops_asset_disposal_events TO service_role;
ALTER TABLE public.ops_asset_maintenance_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_asset_disposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_asset_disposal_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "asset maintenance by school" ON public.ops_asset_maintenance_links FOR SELECT TO authenticated USING (public.ops_asset_readable(asset_id));
CREATE POLICY "disposals by school" ON public.ops_asset_disposals FOR SELECT TO authenticated USING (public.ops_can_read('patrimonio', school_id));
CREATE POLICY "disposal events by school" ON public.ops_asset_disposal_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ops_asset_disposals d WHERE d.id = disposal_id AND public.ops_can_read('patrimonio', d.school_id)));

CREATE OR REPLACE FUNCTION public.link_ops_asset_maintenance(_a uuid, _mo uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _cur text;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsam:no-person'; END IF;
  _cur := public.ops_asset_school(_a);
  IF _cur IS NULL OR NOT public.has_school_capability('manter-bens', _cur) THEN RAISE EXCEPTION 'opsam:forbidden'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ops_maintenance_orders o JOIN public.ops_requests r ON r.id = o.request_id WHERE o.id = _mo AND r.school_id = _cur) THEN RAISE EXCEPTION 'opsam:invalid-order'; END IF;
  INSERT INTO public.ops_asset_maintenance_links(asset_id, maintenance_order_id, author_person) VALUES (_a, _mo, _p) ON CONFLICT DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.propose_ops_asset_disposal(_a uuid, _expected_seq int, _reason text, _justification text, _case uuid, _assessment uuid, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _cur text; _last int;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsad:no-person'; END IF;
  SELECT id INTO _id FROM public.ops_asset_disposals WHERE idempotency_key = _key;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  PERFORM 1 FROM public.ops_assets WHERE id = _a FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'opsad:unavailable'; END IF;
  _cur := public.ops_asset_school(_a);
  IF NOT public.has_school_capability('propor-baixa-de-bens', _cur) THEN RAISE EXCEPTION 'opsad:forbidden'; END IF;
  IF EXISTS (SELECT 1 FROM public.ops_asset_events WHERE asset_id = _a AND kind = 'baixa') THEN RAISE EXCEPTION 'opsad:already-written-off'; END IF;
  IF public.ops_asset_open_transfer(_a) IS NOT NULL THEN RAISE EXCEPTION 'opsad:transfer-open'; END IF;
  IF EXISTS (SELECT 1 FROM public.ops_asset_disposals d WHERE d.asset_id = _a AND public.ops_disposal_state(d.id) IN ('proposta','autorizada','destinada')) THEN RAISE EXCEPTION 'opsad:process-open'; END IF;
  SELECT max(seq) INTO _last FROM public.ops_asset_events WHERE asset_id = _a;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'opsad:conflict'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.admin_case_events e WHERE e.id = _assessment AND e.case_id = _case) THEN RAISE EXCEPTION 'opsad:assessment-not-in-case'; END IF;
  INSERT INTO public.ops_asset_disposals(asset_id, school_id, reason_kind, justification, case_id, assessment_ref, base_asset_seq, proposer_person, idempotency_key)
  VALUES (_a, _cur, _reason, btrim(_justification), _case, _assessment, _last, _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opsad:invalid';
END $$;

CREATE OR REPLACE FUNCTION public.record_ops_asset_disposal_event(_d uuid, _expected_seq int, _kind text, _decision text, _dest_kind text, _dest_party text,
  _doc uuid, _on date, _note text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _dp public.ops_asset_disposals; _st text; _last int; _seq int; _aseq int; _dest_doc uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'opsad:no-person'; END IF;
  SELECT seq INTO _seq FROM public.ops_asset_disposal_events WHERE idempotency_key = _key;
  IF _seq IS NOT NULL THEN RETURN _seq; END IF;
  SELECT * INTO _dp FROM public.ops_asset_disposals WHERE id = _d;
  IF _dp.id IS NULL THEN RAISE EXCEPTION 'opsad:unavailable'; END IF;
  PERFORM 1 FROM public.ops_assets WHERE id = _dp.asset_id FOR UPDATE;
  SELECT coalesce(max(seq),0) INTO _last FROM public.ops_asset_disposal_events WHERE disposal_id = _d;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'opsad:conflict'; END IF;
  _st := public.ops_disposal_state(_d);
  IF NOT ((_kind IN ('autorizacao','indeferimento') AND _st = 'proposta') OR (_kind = 'destinacao' AND _st = 'autorizada')
       OR (_kind = 'efetivacao' AND _st = 'destinada') OR (_kind = 'arquivamento' AND _st IN ('proposta','autorizada'))) THEN RAISE EXCEPTION 'opsad:invalid-transition'; END IF;
  IF _on > current_date OR _on < _dp.created_at::date THEN RAISE EXCEPTION 'opsad:invalid-date'; END IF;
  IF _kind IN ('autorizacao','indeferimento') THEN
    IF NOT public.has_school_capability('autorizar-baixa-de-bens', _dp.school_id) THEN RAISE EXCEPTION 'opsad:authorize-forbidden'; END IF;
    IF _p = _dp.proposer_person THEN RAISE EXCEPTION 'opsad:self-authorization'; END IF;
  ELSIF _kind = 'destinacao' THEN
    IF NOT public.has_school_capability('propor-baixa-de-bens', _dp.school_id) THEN RAISE EXCEPTION 'opsad:forbidden'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.admin_case_events e WHERE e.id = _doc AND e.case_id = _dp.case_id) THEN RAISE EXCEPTION 'opsad:doc-not-in-case'; END IF;
  ELSIF _kind = 'efetivacao' THEN
    IF NOT public.has_school_capability('autorizar-baixa-de-bens', _dp.school_id) THEN RAISE EXCEPTION 'opsad:forbidden'; END IF;
    IF _p = _dp.proposer_person THEN RAISE EXCEPTION 'opsad:self-authorization'; END IF;
    SELECT max(seq) INTO _aseq FROM public.ops_asset_events WHERE asset_id = _dp.asset_id;
    IF _aseq <> _dp.base_asset_seq THEN RAISE EXCEPTION 'opsad:asset-changed'; END IF;
    SELECT doc_ref INTO _dest_doc FROM public.ops_asset_disposal_events WHERE disposal_id = _d AND kind = 'destinacao';
    INSERT INTO public.ops_asset_events(asset_id, seq, kind, doc_ref, effective_on, note, actor_person, idempotency_key)
    VALUES (_dp.asset_id, _aseq + 1, 'baixa', _dest_doc, _on, 'Baixa pelo processo ' || _d::text || ': ' || _dp.justification, _p, _key || '#baixa');
  ELSIF _kind = 'arquivamento' THEN
    IF NOT (public.has_school_capability('propor-baixa-de-bens', _dp.school_id) OR public.has_school_capability('autorizar-baixa-de-bens', _dp.school_id)) THEN RAISE EXCEPTION 'opsad:forbidden'; END IF;
  END IF;
  INSERT INTO public.ops_asset_disposal_events(disposal_id, seq, kind, decision_ref, destination_kind, destination_party, doc_ref, effective_on, note, actor_person, idempotency_key)
  VALUES (_d, _last + 1, _kind, nullif(btrim(_decision),''), _dest_kind, nullif(btrim(_dest_party),''), _doc, _on, nullif(btrim(_note),''), _p, _key);
  RETURN _last + 1;
EXCEPTION WHEN check_violation THEN RAISE EXCEPTION 'opsad:invalid';
  WHEN unique_violation THEN RAISE EXCEPTION 'opsad:already-closed';
END $$;

REVOKE ALL ON FUNCTION public.link_ops_asset_maintenance(uuid,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.propose_ops_asset_disposal(uuid,int,text,text,uuid,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_ops_asset_disposal_event(uuid,int,text,text,text,text,uuid,date,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.link_ops_asset_maintenance(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.propose_ops_asset_disposal(uuid,int,text,text,uuid,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_ops_asset_disposal_event(uuid,int,text,text,text,text,uuid,date,text,text) TO authenticated;
REVOKE ALL ON FUNCTION public.ops_no_truncate() FROM PUBLIC, anon, authenticated;
REVOKE SELECT ON public.ops_asset_disposals, public.ops_asset_disposal_events FROM authenticated;
GRANT SELECT (id, asset_id, school_id, reason_kind, justification, case_id, base_asset_seq, proposer_person, idempotency_key, created_at) ON public.ops_asset_disposals TO authenticated;
GRANT SELECT (id, disposal_id, seq, kind, decision_ref, destination_kind, destination_party, effective_on, note, actor_person, idempotency_key, created_at) ON public.ops_asset_disposal_events TO authenticated;