CREATE TABLE public.school_official_letters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL,
  year integer NOT NULL,
  seq integer NOT NULL,
  code text NOT NULL,
  recipient text NOT NULL CHECK (length(btrim(recipient)) BETWEEN 3 AND 300),
  subject text NOT NULL CHECK (length(btrim(subject)) BETWEEN 3 AND 300),
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 10 AND 20000),
  signer text NOT NULL CHECK (length(btrim(signer)) BETWEEN 3 AND 200),
  signer_role text CHECK (signer_role IS NULL OR length(signer_role) <= 120),
  idempotency_key text NOT NULL UNIQUE,
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (school_id, year, seq)
);
CREATE TABLE public.school_official_letter_cancellations (
  letter_id uuid PRIMARY KEY REFERENCES public.school_official_letters(id),
  school_id text NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 5),
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.school_official_letters, public.school_official_letter_cancellations TO authenticated;
GRANT ALL ON public.school_official_letters, public.school_official_letter_cancellations TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.school_official_letters, public.school_official_letter_cancellations FROM authenticated, anon;
ALTER TABLE public.school_official_letters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_official_letter_cancellations ENABLE ROW LEVEL SECURITY;
CREATE POLICY school_official_letters_read ON public.school_official_letters FOR SELECT TO authenticated USING (public.has_school_capability('manter-matricula-e-enturmacao', school_id));
CREATE POLICY school_official_letter_cancellations_read ON public.school_official_letter_cancellations FOR SELECT TO authenticated USING (public.has_school_capability('manter-matricula-e-enturmacao', school_id));
CREATE TRIGGER school_official_letters_immutable BEFORE UPDATE OR DELETE ON public.school_official_letters FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE TRIGGER school_official_letter_cancellations_immutable BEFORE UPDATE OR DELETE ON public.school_official_letter_cancellations FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE OR REPLACE FUNCTION public.secretariat_issue_letter(_recipient text, _subject text, _body text, _signer text, _signer_role text, _idem text)
RETURNS TABLE(letter_id uuid, code text) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE s text := public.secretariat_own_school_id(); y int := extract(year from current_date)::int; n int; prev public.school_official_letters; nid uuid; c text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:required'; END IF;
  IF s IS NULL OR NOT public.has_school_capability('manter-matricula-e-enturmacao', s) THEN RAISE EXCEPTION 'letter:capability-missing'; END IF;
  IF coalesce(btrim(_idem),'') = '' THEN RAISE EXCEPTION 'letter:idempotency-required'; END IF;
  SELECT * INTO prev FROM public.school_official_letters l WHERE l.idempotency_key=_idem;
  IF FOUND THEN RETURN QUERY SELECT prev.id, prev.code; RETURN; END IF;
  IF length(btrim(coalesce(_recipient,''))) < 3 THEN RAISE EXCEPTION 'letter:recipient-required'; END IF;
  IF length(btrim(coalesce(_subject,''))) < 3 THEN RAISE EXCEPTION 'letter:subject-required'; END IF;
  IF length(btrim(coalesce(_body,''))) < 10 THEN RAISE EXCEPTION 'letter:body-required'; END IF;
  IF length(btrim(coalesce(_signer,''))) < 3 THEN RAISE EXCEPTION 'letter:signer-required'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('letter:'||s||':'||y));
  SELECT coalesce(max(l.seq),0)+1 INTO n FROM public.school_official_letters l WHERE l.school_id=s AND l.year=y;
  c := 'Ofício nº ' || lpad(n::text,3,'0') || '/' || y;
  INSERT INTO public.school_official_letters(school_id,year,seq,code,recipient,subject,body,signer,signer_role,idempotency_key,recorded_by)
  VALUES (s,y,n,c,btrim(_recipient),btrim(_subject),btrim(_body),btrim(_signer),nullif(btrim(_signer_role),''),_idem,auth.uid()) RETURNING id INTO nid;
  RETURN QUERY SELECT nid, c;
END $$;
REVOKE ALL ON FUNCTION public.secretariat_issue_letter(text,text,text,text,text,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.secretariat_issue_letter(text,text,text,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.secretariat_cancel_letter(_letter uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE sch text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session:required'; END IF;
  SELECT l.school_id INTO sch FROM public.school_official_letters l WHERE l.id=_letter;
  IF sch IS NULL OR NOT public.has_school_capability('manter-matricula-e-enturmacao', sch) THEN RAISE EXCEPTION 'letter:capability-missing'; END IF;
  IF length(btrim(coalesce(_reason,''))) < 5 THEN RAISE EXCEPTION 'letter:reason-required'; END IF;
  IF EXISTS (SELECT 1 FROM public.school_official_letter_cancellations x WHERE x.letter_id=_letter) THEN RAISE EXCEPTION 'letter:already-cancelled'; END IF;
  INSERT INTO public.school_official_letter_cancellations(letter_id,school_id,reason,recorded_by) VALUES (_letter,sch,btrim(_reason),auth.uid());
END $$;
REVOKE ALL ON FUNCTION public.secretariat_cancel_letter(uuid,text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.secretariat_cancel_letter(uuid,text) TO authenticated;