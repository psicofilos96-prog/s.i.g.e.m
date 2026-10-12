-- Matrículas L14: distribuição = proposta derivada de execução OFICIAL de classificação (L13). Conflitos são recalculados no banco
-- sobre o snapshot (pedido inexistente/de outra campanha, preferência fora da campanha, vaga não lida/sem fonte, reserva, empates, indeterminados).
-- Validação institucional por pessoa ≠ executor/proponente com ato; publicação só após validação sem conflito. Nada cria vaga/reserva/matrícula.
CREATE TABLE public.enr_distribution_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL UNIQUE REFERENCES public.enr_classification_runs(id),
  campaign_id uuid NOT NULL REFERENCES public.enr_campaigns(id),
  conflicts jsonb NOT NULL,
  conflict_count int NOT NULL CHECK (conflict_count >= 0),
  proposer_person uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.enr_distribution_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.enr_distribution_proposals(id),
  seq int NOT NULL CHECK (seq >= 1),
  action text NOT NULL CHECK (action IN ('validar','devolver','publicar')),
  act_ref uuid REFERENCES public.admin_case_act_versions(id),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 20),
  person_id uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, seq),
  CHECK (action <> 'validar' OR act_ref IS NOT NULL)
);
GRANT SELECT ON public.enr_distribution_proposals, public.enr_distribution_events TO authenticated;
GRANT ALL ON public.enr_distribution_proposals, public.enr_distribution_events TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.enr_distribution_proposals, public.enr_distribution_events FROM authenticated, anon;
ALTER TABLE public.enr_distribution_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enr_distribution_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enr dist read" ON public.enr_distribution_proposals FOR SELECT TO authenticated USING (public.enr_classifier() OR public.has_network_capability('validar-distribuicao-de-vagas'));
CREATE POLICY "enr dist ev read" ON public.enr_distribution_events FOR SELECT TO authenticated USING (public.enr_classifier() OR public.has_network_capability('validar-distribuicao-de-vagas'));
CREATE TRIGGER enr_dist_append_only BEFORE UPDATE OR DELETE ON public.enr_distribution_proposals FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER enr_dist_ev_append_only BEFORE UPDATE OR DELETE ON public.enr_distribution_events FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();

CREATE OR REPLACE FUNCTION public.enr_distribution_conflicts(_run uuid) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH r AS (SELECT * FROM public.enr_classification_runs WHERE id = _run),
  v AS (SELECT cv.school_keys FROM r JOIN public.enr_campaign_versions cv ON cv.campaign_id = r.campaign_id
        ORDER BY cv.version DESC LIMIT 1),
  reqs AS (SELECT e AS q FROM r, jsonb_array_elements(r.input_snapshot->'requests') e),
  cells AS (SELECT e AS c FROM r, jsonb_array_elements(r.input_snapshot->'cells') e),
  c AS (
    SELECT 'pedido-sem-protocolo-valido: ' || (q->>'protocol') AS t FROM reqs
     WHERE NOT EXISTS (SELECT 1 FROM public.protocol_registrations p JOIN public.enr_application_protocols l ON l.registration_id = p.id
                       JOIN public.enr_applications a ON a.id = l.application_id, r
                       WHERE p.protocol_number = q->>'protocol' AND a.campaign_id = r.campaign_id)
    UNION ALL SELECT 'preferencia-fora-da-campanha: ' || (q->>'protocol') || ' → ' || pref FROM reqs, jsonb_array_elements_text(q->'preferences') pref, v
     WHERE split_part(pref, '|', 1) <> ALL (v.school_keys)
    UNION ALL SELECT 'vaga-nao-lida: ' || (c->>'cellKey') FROM cells WHERE jsonb_typeof(c->'available') <> 'number'
    UNION ALL SELECT 'vaga-sem-fonte: ' || (c->>'cellKey') FROM cells WHERE coalesce(c->>'sourceRef','') = ''
    UNION ALL SELECT 'reserva-nao-lida: ' || (c->>'cellKey') FROM cells WHERE jsonb_typeof(c->'reserved') <> 'number'
    UNION ALL SELECT 'empate-nao-resolvido: ' || g::text FROM r, jsonb_array_elements(r.result->'unresolvedTies') g
    UNION ALL SELECT 'pedido-indeterminado: ' || (i->>'protocol') FROM r, jsonb_array_elements(r.result->'indeterminate') i
    UNION ALL SELECT 'conflito-do-motor: ' || x FROM r, jsonb_array_elements_text(r.result->'conflicts') x
  )
  SELECT coalesce(jsonb_agg(t ORDER BY t), '[]'::jsonb) FROM c
$$;

CREATE OR REPLACE FUNCTION public.enr_propose_distribution(_run uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _r public.enr_classification_runs; _id uuid; _c jsonb;
BEGIN
  SELECT id INTO _id FROM public.enr_distribution_proposals WHERE run_id = _run;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF _p IS NULL OR NOT public.has_network_capability('classificar-inscricoes-de-ingresso') THEN RAISE EXCEPTION 'sem-competencia'; END IF;
  SELECT * INTO _r FROM public.enr_classification_runs WHERE id = _run FOR UPDATE;
  IF _r.id IS NULL THEN RAISE EXCEPTION 'execucao-inexistente'; END IF;
  IF _r.mode <> 'oficial' THEN RAISE EXCEPTION 'simulacao-nao-gera-distribuicao'; END IF;
  _c := public.enr_distribution_conflicts(_run);
  INSERT INTO public.enr_distribution_proposals(run_id, campaign_id, conflicts, conflict_count, proposer_person)
  VALUES (_run, _r.campaign_id, _c, jsonb_array_length(_c), _p) RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.record_enr_distribution_event(_proposal uuid, _expected_seq int, _action text, _act uuid, _reason text, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _d public.enr_distribution_proposals; _runner uuid; _last int; _last_action text; _s int;
BEGIN
  SELECT seq INTO _s FROM public.enr_distribution_events WHERE idempotency_key = _key;
  IF _s IS NOT NULL THEN RETURN _s; END IF;
  IF _p IS NULL THEN RAISE EXCEPTION 'sem-pessoa'; END IF;
  SELECT * INTO _d FROM public.enr_distribution_proposals WHERE id = _proposal FOR UPDATE;
  IF _d.id IS NULL THEN RAISE EXCEPTION 'proposta-inexistente'; END IF;
  SELECT run_by_person INTO _runner FROM public.enr_classification_runs WHERE id = _d.run_id;
  SELECT coalesce(max(seq),0) INTO _last FROM public.enr_distribution_events WHERE proposal_id = _proposal;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'sequencia-desatualizada'; END IF;
  SELECT action INTO _last_action FROM public.enr_distribution_events WHERE proposal_id = _proposal AND seq = _last;
  IF _last_action IN ('publicar','devolver') THEN RAISE EXCEPTION 'proposta-encerrada'; END IF;
  IF _action IN ('validar','devolver') THEN
    IF NOT public.has_network_capability('validar-distribuicao-de-vagas') THEN RAISE EXCEPTION 'sem-competencia'; END IF;
    IF _p = _runner OR _p = _d.proposer_person THEN RAISE EXCEPTION 'validador-igual-executor'; END IF;
    IF _last_action = 'validar' THEN RAISE EXCEPTION 'ja-validada'; END IF;
    IF _action = 'validar' THEN
      IF _d.conflict_count > 0 THEN RAISE EXCEPTION 'proposta-com-conflitos'; END IF;
      IF NOT EXISTS (SELECT 1 FROM public.admin_case_act_versions WHERE id = _act) THEN RAISE EXCEPTION 'ato-inexistente'; END IF;
    END IF;
  ELSIF _action = 'publicar' THEN
    IF NOT public.has_network_capability('publicar-campanhas-de-matricula') THEN RAISE EXCEPTION 'sem-competencia'; END IF;
    IF coalesce(_last_action,'') <> 'validar' THEN RAISE EXCEPTION 'publicar-exige-validacao'; END IF;
  ELSE RAISE EXCEPTION 'acao-invalida'; END IF;
  INSERT INTO public.enr_distribution_events(proposal_id, seq, action, act_ref, reason, person_id, idempotency_key)
  VALUES (_proposal, _last + 1, _action, CASE WHEN _action = 'validar' THEN _act END, btrim(_reason), _p, _key);
  RETURN _last + 1;
END $$;

REVOKE ALL ON FUNCTION public.enr_distribution_conflicts(uuid), public.enr_propose_distribution(uuid), public.record_enr_distribution_event(uuid,int,text,uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enr_propose_distribution(uuid), public.record_enr_distribution_event(uuid,int,text,uuid,text,text) TO authenticated;