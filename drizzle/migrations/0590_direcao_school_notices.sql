-- Direção L13 — Avisos da Direção (mural da escola).
-- Publicação e retirada só pela conta da Direção da própria escola; aviso publicado não é editado nem apagado,
-- só retirado com motivo (retirada também é permanente). Leitura pela Direção e OP da escola e pelas contas de rede.
CREATE TABLE public.school_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 200),
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 3 AND 8000),
  audience text NOT NULL CHECK (audience IN ('escola','turma','familias','servidores')),
  class_id text NULL REFERENCES public.institutional_classes(id),
  image_path text NULL,
  expires_on date NULL,
  published_by uuid NOT NULL,
  published_by_principal_id uuid NOT NULL REFERENCES public.institutional_sector_principals(id),
  published_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key text NOT NULL UNIQUE
);
CREATE INDEX sn_school_idx ON public.school_notices(school_id, published_at DESC);

CREATE TABLE public.school_notice_withdrawals (
  notice_id uuid PRIMARY KEY REFERENCES public.school_notices(id),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 3),
  withdrawn_by uuid NOT NULL,
  withdrawn_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON public.school_notices, public.school_notice_withdrawals FROM PUBLIC, anon, authenticated, service_role;
ALTER TABLE public.school_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_notice_withdrawals ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER sn_no_change BEFORE UPDATE OR DELETE ON public.school_notices FOR EACH ROW EXECUTE FUNCTION public.sdo_immutable();
CREATE TRIGGER snw_no_change BEFORE UPDATE OR DELETE ON public.school_notice_withdrawals FOR EACH ROW EXECUTE FUNCTION public.sdo_immutable();

CREATE OR REPLACE FUNCTION public.direcao_publish_school_notice(
  _school text, _title text, _body text, _audience text, _class text, _image_path text, _expires_on date, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pr uuid; nid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'notice:auth-required'; END IF;
  SELECT id INTO pr FROM public.institutional_sector_principals
   WHERE auth_user_id = auth.uid() AND station_code = 'direcao_escolar' AND school_id = _school;
  IF pr IS NULL THEN RAISE EXCEPTION 'notice:direcao-only'; END IF;
  SELECT id INTO nid FROM public.school_notices WHERE idempotency_key = _key;
  IF nid IS NOT NULL THEN RETURN nid; END IF;
  IF _audience = 'turma' THEN
    IF _class IS NULL OR NOT EXISTS (SELECT 1 FROM public.institutional_classes c WHERE c.id = _class AND c.school_id = _school) THEN
      RAISE EXCEPTION 'notice:class-invalid'; END IF;
  ELSIF _class IS NOT NULL THEN RAISE EXCEPTION 'notice:class-not-allowed'; END IF;
  IF _expires_on IS NOT NULL AND _expires_on < current_date THEN RAISE EXCEPTION 'notice:expiry-invalid'; END IF;
  IF _image_path IS NOT NULL AND _image_path NOT LIKE _school || '/%' THEN RAISE EXCEPTION 'notice:image-invalid'; END IF;
  INSERT INTO public.school_notices(school_id, title, body, audience, class_id, image_path, expires_on, published_by, published_by_principal_id, idempotency_key)
  VALUES (_school, btrim(_title), btrim(_body), _audience, _class, _image_path, _expires_on, auth.uid(), pr, _key)
  RETURNING id INTO nid;
  RETURN nid;
END $$;
REVOKE ALL ON FUNCTION public.direcao_publish_school_notice(text, text, text, text, text, text, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.direcao_publish_school_notice(text, text, text, text, text, text, date, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.direcao_withdraw_school_notice(_notice uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'notice:auth-required'; END IF;
  SELECT * INTO n FROM public.school_notices WHERE id = _notice;
  IF n.id IS NULL THEN RAISE EXCEPTION 'notice:not-found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.institutional_sector_principals p WHERE p.auth_user_id = auth.uid()
    AND p.station_code = 'direcao_escolar' AND p.school_id = n.school_id) THEN RAISE EXCEPTION 'notice:direcao-only'; END IF;
  INSERT INTO public.school_notice_withdrawals(notice_id, reason, withdrawn_by) VALUES (_notice, btrim(_reason), auth.uid())
  ON CONFLICT (notice_id) DO NOTHING;
END $$;
REVOKE ALL ON FUNCTION public.direcao_withdraw_school_notice(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.direcao_withdraw_school_notice(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.school_notices_at(_school text)
RETURNS TABLE(id uuid, title text, body text, audience text, class_id text, image_path text, expires_on date,
  published_at timestamptz, withdrawn boolean, withdrawal_reason text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.sdo_can_read(_school) THEN RAISE EXCEPTION 'notice:not-authorized'; END IF;
  RETURN QUERY SELECT n.id, n.title, n.body, n.audience, n.class_id, n.image_path, n.expires_on, n.published_at,
    (w.notice_id IS NOT NULL) AS withdrawn, w.reason AS withdrawal_reason
  FROM public.school_notices n
  LEFT JOIN public.school_notice_withdrawals w ON w.notice_id = n.id
  WHERE n.school_id = _school ORDER BY n.published_at DESC LIMIT 200;
END $$;
REVOKE ALL ON FUNCTION public.school_notices_at(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_notices_at(text) TO authenticated;

CREATE POLICY "avisos-escola leitura autorizada" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avisos-escola' AND public.sdo_can_read((storage.foldername(name))[1]));
CREATE POLICY "avisos-escola envio pela Direção" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avisos-escola' AND EXISTS (SELECT 1 FROM public.institutional_sector_principals p
    WHERE p.auth_user_id = auth.uid() AND p.station_code = 'direcao_escolar' AND p.school_id = (storage.foldername(name))[1]));