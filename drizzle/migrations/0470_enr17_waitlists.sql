-- Matrículas L17: lista de espera por campanha × célula (escola|etapa|modalidade). Ordem oficial nasce SÓ da distribuição publicada
-- (itens "espera" na ordem de posição do motor); reclassificação = nova versão com ato, motivo e base esperada (mesmo conjunto de pedidos);
-- convocação = 1º não convocado da versão vigente, reservando pelo writer canônico (enr_seat_reserve_v2, origem lista-de-espera).
-- Consulta familiar só devolve a própria posição e o total.
CREATE TABLE public.enr_waitlists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.enr_campaigns(id),
  cell_key text NOT NULL,
  proposal_id uuid NOT NULL REFERENCES public.enr_distribution_proposals(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, cell_key)
);
CREATE TABLE public.enr_waitlist_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  waitlist_id uuid NOT NULL REFERENCES public.enr_waitlists(id),
  version int NOT NULL CHECK (version >= 1),
  entries uuid[] NOT NULL,
  basis text NOT NULL CHECK (basis IN ('distribuicao','reclassificacao')),
  act_ref uuid REFERENCES public.admin_case_act_versions(id),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 20),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (waitlist_id, version),
  CHECK (basis = 'distribuicao' OR act_ref IS NOT NULL)
);
CREATE TABLE public.enr_waitlist_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  waitlist_id uuid NOT NULL REFERENCES public.enr_waitlists(id),
  version int NOT NULL,
  application_id uuid NOT NULL REFERENCES public.enr_applications(id),
  hold_id uuid NOT NULL,
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (waitlist_id, application_id)
);
GRANT SELECT ON public.enr_waitlists, public.enr_waitlist_versions, public.enr_waitlist_calls TO authenticated;
GRANT ALL ON public.enr_waitlists, public.enr_waitlist_versions, public.enr_waitlist_calls TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.enr_waitlists, public.enr_waitlist_versions, public.enr_waitlist_calls FROM authenticated, anon;
ALTER TABLE public.enr_waitlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enr_waitlist_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enr_waitlist_calls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enr wl read" ON public.enr_waitlists FOR SELECT TO authenticated USING (public.has_network_capability('gerir-lista-de-espera') OR public.has_network_capability('reclassificar-lista-de-espera'));
CREATE POLICY "enr wl v read" ON public.enr_waitlist_versions FOR SELECT TO authenticated USING (public.has_network_capability('gerir-lista-de-espera') OR public.has_network_capability('reclassificar-lista-de-espera'));
CREATE POLICY "enr wl c read" ON public.enr_waitlist_calls FOR SELECT TO authenticated USING (public.has_network_capability('gerir-lista-de-espera') OR public.has_network_capability('reclassificar-lista-de-espera'));
CREATE TRIGGER enr_wl_append_only BEFORE UPDATE OR DELETE ON public.enr_waitlists FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER enr_wl_v_append_only BEFORE UPDATE OR DELETE ON public.enr_waitlist_versions FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER enr_wl_c_append_only BEFORE UPDATE OR DELETE ON public.enr_waitlist_calls FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

-- Ordem oficial derivada da distribuição publicada; nunca ordem de chegada.
CREATE OR REPLACE FUNCTION public.enr_open_waitlist(_proposal uuid, _cell text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _d public.enr_distribution_proposals; _r public.enr_classification_runs; _w uuid; _last text; _entries uuid[];
BEGIN
  SELECT waitlist_id INTO _w FROM public.enr_waitlist_versions WHERE idempotency_key = _key;
  IF _w IS NOT NULL THEN RETURN _w; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('gerir-lista-de-espera') THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  SELECT * INTO _d FROM public.enr_distribution_proposals WHERE id = _proposal FOR UPDATE;
  IF _d.id IS NULL THEN RAISE EXCEPTION 'proposta-inexistente'; END IF;
  SELECT action INTO _last FROM public.enr_distribution_events WHERE proposal_id = _proposal ORDER BY seq DESC LIMIT 1;
  IF coalesce(_last,'') <> 'publicar' THEN RAISE EXCEPTION 'distribuicao-nao-publicada'; END IF;
  IF EXISTS (SELECT 1 FROM public.enr_waitlists WHERE proposal_id = _proposal AND cell_key = _cell) THEN RAISE EXCEPTION 'lista-ja-aberta'; END IF;
  SELECT * INTO _r FROM public.enr_classification_runs WHERE id = _d.run_id;
  SELECT coalesce(array_agg(a.id ORDER BY (it->>'position')::int), '{}') INTO _entries
    FROM jsonb_array_elements(_r.result->'items') it
    JOIN jsonb_array_elements(_r.input_snapshot->'requests') q ON q->>'protocol' = it->>'protocol'
    JOIN public.protocol_registrations pr ON pr.protocol_number = it->>'protocol'
    JOIN public.enr_application_protocols l ON l.registration_id = pr.id
    JOIN public.enr_applications a ON a.id = l.application_id AND a.campaign_id = _d.campaign_id
   WHERE it->>'outcome' = 'espera' AND q->'preferences' ? _cell;
  INSERT INTO public.enr_waitlists(campaign_id, cell_key, proposal_id) VALUES (_d.campaign_id, _cell, _proposal) RETURNING id INTO _w;
  INSERT INTO public.enr_waitlist_versions(waitlist_id, version, entries, basis, reason, person_id, idempotency_key)
  VALUES (_w, 1, _entries, 'distribuicao', 'ordem oficial da distribuição publicada', _p, _key);
  RETURN _w;
END $$;

CREATE OR REPLACE FUNCTION public.enr_reclassify_waitlist(_w uuid, _expected_version int, _entries uuid[], _act uuid, _reason text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _cur public.enr_waitlist_versions; _v int;
BEGIN
  SELECT version INTO _v FROM public.enr_waitlist_versions WHERE idempotency_key = _key;
  IF _v IS NOT NULL THEN RETURN _v; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('reclassificar-lista-de-espera') THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  PERFORM 1 FROM public.enr_waitlists WHERE id = _w FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'lista-inexistente'; END IF;
  SELECT * INTO _cur FROM public.enr_waitlist_versions WHERE waitlist_id = _w ORDER BY version DESC LIMIT 1;
  IF _cur.version <> _expected_version THEN RAISE EXCEPTION 'versao-desatualizada'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.admin_case_act_versions WHERE id = _act) THEN RAISE EXCEPTION 'ato-inexistente'; END IF;
  IF length(btrim(coalesce(_reason,''))) < 20 THEN RAISE EXCEPTION 'motivo-obrigatorio'; END IF;
  IF cardinality(_entries) <> cardinality(_cur.entries)
     OR (SELECT count(DISTINCT x) FROM unnest(_entries) x) <> cardinality(_entries)
     OR EXISTS (SELECT unnest(_entries) EXCEPT SELECT unnest(_cur.entries))
  THEN RAISE EXCEPTION 'conjunto-diferente'; END IF;
  INSERT INTO public.enr_waitlist_versions(waitlist_id, version, entries, basis, act_ref, reason, person_id, idempotency_key)
  VALUES (_w, _cur.version + 1, _entries, 'reclassificacao', _act, btrim(_reason), _p, _key);
  RETURN _cur.version + 1;
END $$;

-- Convoca o 1º da versão vigente ainda não convocado; reserva pelo writer canônico na mesma transação (falha ⇒ nada gravado).
CREATE OR REPLACE FUNCTION public.enr_call_from_waitlist(_w uuid, _expected_version int, _key text)
RETURNS TABLE(called_application uuid, called_hold uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _l public.enr_waitlists; _cur public.enr_waitlist_versions; _c public.enr_waitlist_calls; _app uuid; _pool uuid; _h uuid;
BEGIN
  SELECT * INTO _c FROM public.enr_waitlist_calls WHERE idempotency_key = _key;
  IF _c.id IS NOT NULL THEN RETURN QUERY SELECT _c.application_id, _c.hold_id; RETURN; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  IF NOT public.has_network_capability('gerir-lista-de-espera') THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  SELECT * INTO _l FROM public.enr_waitlists WHERE id = _w FOR UPDATE;
  IF _l.id IS NULL THEN RAISE EXCEPTION 'lista-inexistente'; END IF;
  SELECT * INTO _cur FROM public.enr_waitlist_versions WHERE waitlist_id = _w ORDER BY version DESC LIMIT 1;
  IF _cur.version <> _expected_version THEN RAISE EXCEPTION 'versao-desatualizada'; END IF;
  SELECT t.e INTO _app FROM unnest(_cur.entries) WITH ORDINALITY AS t(e, i)
   WHERE NOT EXISTS (SELECT 1 FROM public.enr_waitlist_calls k WHERE k.waitlist_id = _w AND k.application_id = t.e)
   ORDER BY t.i LIMIT 1;
  IF _app IS NULL THEN RAISE EXCEPTION 'lista-esgotada'; END IF;
  SELECT sp.id INTO _pool FROM public.enr_seat_pools sp WHERE sp.campaign_id = _l.campaign_id AND sp.cell_key = _l.cell_key;
  IF _pool IS NULL THEN RAISE EXCEPTION 'quadro-inexistente'; END IF;
  _h := public.enr_seat_reserve_v2(_pool, _app, _l.proposal_id, 'lista-de-espera', 'wl:' || _key);
  INSERT INTO public.enr_waitlist_calls(waitlist_id, version, application_id, hold_id, person_id, idempotency_key)
  VALUES (_w, _cur.version, _app, _h, _p, _key);
  RETURN QUERY SELECT _app, _h;
END $$;

-- Família: só a própria posição (entre não convocados) e o total; nunca ordem nem terceiros. Falha ⇒ resposta uniforme.
CREATE OR REPLACE FUNCTION public.enr_public_waitlist_position(_code text, _check text)
RETURNS TABLE(status text, list_cell text, queue_position int, queue_total int, was_called boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE _a public.enr_applications;
BEGIN
  IF _code IS NULL OR _check IS NULL OR btrim(_code) !~ '^INS-[0-9A-F]{10}$' OR lower(btrim(_check)) !~ '^[0-9a-f]{12}$' THEN
    RETURN QUERY SELECT 'indisponivel'::text, NULL::text, NULL::int, NULL::int, NULL::boolean; RETURN; END IF;
  SELECT * INTO _a FROM public.enr_applications a WHERE a.application_code = btrim(_code);
  IF _a.check_hash IS NULL OR _a.check_hash <> encode(extensions.digest(lower(btrim(_check)), 'sha256'), 'hex') THEN
    RETURN QUERY SELECT 'indisponivel'::text, NULL::text, NULL::int, NULL::int, NULL::boolean; RETURN; END IF;
  RETURN QUERY
  WITH cur AS (
    SELECT DISTINCT ON (v.waitlist_id) v.waitlist_id, v.entries FROM public.enr_waitlist_versions v
     JOIN public.enr_waitlists w ON w.id = v.waitlist_id WHERE w.campaign_id = _a.campaign_id
     ORDER BY v.waitlist_id, v.version DESC),
  mine AS (SELECT * FROM cur WHERE _a.id = ANY (cur.entries)),
  pend AS (
    SELECT mine.waitlist_id, t.e, row_number() OVER (PARTITION BY mine.waitlist_id ORDER BY t.i)::int AS pos, count(*) OVER (PARTITION BY mine.waitlist_id)::int AS tot
      FROM mine, unnest(mine.entries) WITH ORDINALITY t(e, i)
     WHERE NOT EXISTS (SELECT 1 FROM public.enr_waitlist_calls k WHERE k.waitlist_id = mine.waitlist_id AND k.application_id = t.e))
  SELECT 'ok'::text, w.cell_key, p.pos, coalesce((SELECT max(x.tot) FROM pend x WHERE x.waitlist_id = w.id), 0),
         EXISTS (SELECT 1 FROM public.enr_waitlist_calls k WHERE k.waitlist_id = w.id AND k.application_id = _a.id)
    FROM mine JOIN public.enr_waitlists w ON w.id = mine.waitlist_id
    LEFT JOIN pend p ON p.waitlist_id = mine.waitlist_id AND p.e = _a.id;
  IF NOT FOUND THEN RETURN QUERY SELECT 'sem-lista'::text, NULL::text, NULL::int, NULL::int, NULL::boolean; END IF;
END $$;

REVOKE ALL ON FUNCTION public.enr_open_waitlist(uuid,text,text), public.enr_reclassify_waitlist(uuid,int,uuid[],uuid,text,text),
  public.enr_call_from_waitlist(uuid,int,text), public.enr_public_waitlist_position(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enr_open_waitlist(uuid,text,text), public.enr_reclassify_waitlist(uuid,int,uuid[],uuid,text,text),
  public.enr_call_from_waitlist(uuid,int,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enr_public_waitlist_position(text,text) TO anon, authenticated;