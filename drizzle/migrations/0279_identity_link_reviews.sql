-- LOTE 9: associação conta↔pessoa por identidade comprovada, com revisão por segunda conta.
CREATE TABLE public.identity_link_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id uuid NOT NULL,
  person_id uuid NOT NULL REFERENCES public.institutional_persons(id),
  school_id text,
  evidence_kind text NOT NULL CHECK (evidence_kind IN ('identificador-oficial-conferido','documento-conferido-presencialmente','matricula-funcional-conferida')),
  evidence_note text NOT NULL CHECK (length(btrim(evidence_note)) >= 15),
  proposed_by uuid NOT NULL,
  proposed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.identity_link_review_decisions (
  review_id uuid PRIMARY KEY REFERENCES public.identity_link_reviews(id),
  decision text NOT NULL CHECK (decision IN ('aprovado','recusado')),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  decided_by uuid NOT NULL,
  decided_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.identity_link_reviews, public.identity_link_review_decisions TO authenticated;
GRANT ALL ON public.identity_link_reviews, public.identity_link_review_decisions TO service_role;
ALTER TABLE public.identity_link_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.identity_link_review_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "contas leem revisões" ON public.identity_link_reviews FOR SELECT TO authenticated
  USING (public.has_network_capability('manter-contas-institucionais'));
CREATE POLICY "contas leem decisões" ON public.identity_link_review_decisions FOR SELECT TO authenticated
  USING (public.has_network_capability('manter-contas-institucionais'));

CREATE OR REPLACE FUNCTION public.identity_link_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'identity-link:append-only'; END $$;
CREATE TRIGGER identity_link_reviews_ao BEFORE UPDATE OR DELETE ON public.identity_link_reviews FOR EACH ROW EXECUTE FUNCTION public.identity_link_append_only();
CREATE TRIGGER identity_link_decisions_ao BEFORE UPDATE OR DELETE ON public.identity_link_review_decisions FOR EACH ROW EXECUTE FUNCTION public.identity_link_append_only();

CREATE OR REPLACE FUNCTION public.propose_identity_link(_target_user uuid, _person uuid, _school text, _evidence_kind text, _evidence_note text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'identity-link:no-session'; END IF;
  IF NOT public.has_network_capability('manter-contas-institucionais') THEN RAISE EXCEPTION 'capability:manter-contas-institucionais'; END IF;
  IF _target_user = auth.uid() THEN RAISE EXCEPTION 'identity-link:self-link'; END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _target_user) THEN RAISE EXCEPTION 'identity-link:unknown-account'; END IF;
  -- Nome nunca basta: a pessoa precisa de identificador registrado.
  IF NOT EXISTS (SELECT 1 FROM public.institutional_person_identifiers WHERE person_id = _person) THEN RAISE EXCEPTION 'identity-link:person-without-identifier'; END IF;
  IF _school IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.institutional_schools WHERE id = _school) THEN RAISE EXCEPTION 'identity-link:unknown-school'; END IF;
  IF EXISTS (SELECT 1 FROM public.user_person_links WHERE user_id = _target_user) THEN RAISE EXCEPTION 'identity-link:account-already-linked'; END IF;
  IF EXISTS (SELECT 1 FROM public.identity_link_reviews r WHERE r.target_user_id = _target_user
     AND NOT EXISTS (SELECT 1 FROM public.identity_link_review_decisions d WHERE d.review_id = r.id)) THEN
    RAISE EXCEPTION 'identity-link:pending-review-exists'; END IF;
  INSERT INTO public.identity_link_reviews(target_user_id, person_id, school_id, evidence_kind, evidence_note, proposed_by)
  VALUES (_target_user, _person, _school, _evidence_kind, _evidence_note, auth.uid()) RETURNING id INTO _id;
  RETURN _id;
END $$;

CREATE OR REPLACE FUNCTION public.decide_identity_link(_review uuid, _decision text, _reason text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.identity_link_reviews;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'identity-link:no-session'; END IF;
  IF NOT public.has_network_capability('manter-contas-institucionais') THEN RAISE EXCEPTION 'capability:manter-contas-institucionais'; END IF;
  SELECT * INTO r FROM public.identity_link_reviews WHERE id = _review FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'identity-link:unknown-review'; END IF;
  IF r.proposed_by = auth.uid() THEN RAISE EXCEPTION 'identity-link:reviewer-must-differ'; END IF;
  IF r.target_user_id = auth.uid() THEN RAISE EXCEPTION 'identity-link:self-link'; END IF;
  IF EXISTS (SELECT 1 FROM public.identity_link_review_decisions WHERE review_id = _review) THEN RAISE EXCEPTION 'identity-link:already-decided'; END IF;
  IF _decision = 'aprovado' THEN
    IF EXISTS (SELECT 1 FROM public.user_person_links WHERE user_id = r.target_user_id) THEN RAISE EXCEPTION 'identity-link:account-already-linked'; END IF;
    INSERT INTO public.user_person_links(user_id, person_id) VALUES (r.target_user_id, r.person_id);
  END IF;
  INSERT INTO public.identity_link_review_decisions(review_id, decision, reason, decided_by) VALUES (_review, _decision, _reason, auth.uid());
  RETURN _decision;
END $$;

REVOKE ALL ON FUNCTION public.propose_identity_link(uuid,uuid,text,text,text), public.decide_identity_link(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.propose_identity_link(uuid,uuid,text,text,text), public.decide_identity_link(uuid,text,text) TO authenticated;
COMMENT ON TABLE public.identity_link_reviews IS 'LOTE 9: proposta conta→pessoa com evidência; vínculo só nasce na aprovação por segunda conta. Atuação escolar continua só por record_engagement.';