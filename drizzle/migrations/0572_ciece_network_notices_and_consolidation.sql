CREATE TABLE public.network_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 200),
  body text NOT NULL CHECK (length(btrim(body)) BETWEEN 3 AND 8000),
  audience text NOT NULL CHECK (audience IN ('todas','municipal-urbana','municipal-rural','conveniada')),
  image_path text NULL,
  published_by uuid NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  idempotency_key text NOT NULL UNIQUE
);
CREATE TABLE public.network_notice_withdrawals (
  notice_id uuid PRIMARY KEY REFERENCES public.network_notices(id),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 3),
  withdrawn_by uuid NOT NULL,
  withdrawn_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.network_consolidation_homologations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year int NOT NULL CHECK (year BETWEEN 2000 AND 2100),
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  audience text NOT NULL CHECK (audience IN ('todas','municipal-urbana','municipal-rural','conveniada')),
  revision int NOT NULL,
  school_count int NOT NULL CHECK (school_count >= 0),
  totals jsonb NOT NULL,
  fingerprint text NOT NULL,
  reason text NULL,
  homologated_by uuid NOT NULL,
  homologated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (year, month, audience, revision)
);
GRANT SELECT ON public.network_notices, public.network_notice_withdrawals, public.network_consolidation_homologations TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.network_notices, public.network_notice_withdrawals, public.network_consolidation_homologations FROM authenticated, anon, service_role;
ALTER TABLE public.network_notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_notice_withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_consolidation_homologations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "avisos da rede legíveis por autenticados" ON public.network_notices FOR SELECT TO authenticated USING (true);
CREATE POLICY "retiradas legíveis por autenticados" ON public.network_notice_withdrawals FOR SELECT TO authenticated USING (true);
CREATE POLICY "homologações legíveis pela rede" ON public.network_consolidation_homologations FOR SELECT TO authenticated
  USING (public.has_network_capability('consultar-mapa-estatistico'));

CREATE OR REPLACE FUNCTION public.publish_network_notice(_title text, _body text, _audience text, _image_path text, _key text)
RETURNS public.network_notices LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE r public.network_notices;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'aviso:sessao'; END IF;
  IF NOT public.has_network_capability('manter-regra-de-competencia-do-mapa') THEN RAISE EXCEPTION 'aviso:sem-permissao'; END IF;
  SELECT * INTO r FROM public.network_notices WHERE idempotency_key = _key;
  IF FOUND THEN IF r.published_by <> auth.uid() THEN RAISE EXCEPTION 'aviso:conflito'; END IF; RETURN r; END IF;
  IF _image_path IS NOT NULL AND _image_path NOT LIKE auth.uid()::text || '/%' THEN RAISE EXCEPTION 'aviso:imagem-invalida'; END IF;
  INSERT INTO public.network_notices(title, body, audience, image_path, published_by, idempotency_key)
  VALUES (btrim(_title), btrim(_body), _audience, _image_path, auth.uid(), _key) RETURNING * INTO r;
  RETURN r;
END $$;

CREATE OR REPLACE FUNCTION public.withdraw_network_notice(_notice uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'aviso:sessao'; END IF;
  IF NOT public.has_network_capability('manter-regra-de-competencia-do-mapa') THEN RAISE EXCEPTION 'aviso:sem-permissao'; END IF;
  INSERT INTO public.network_notice_withdrawals(notice_id, reason, withdrawn_by) VALUES (_notice, btrim(_reason), auth.uid())
  ON CONFLICT (notice_id) DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION public.homologate_network_consolidation(_year int, _month int, _audience text, _school_count int, _totals jsonb, _fingerprint text, _expected_revision int, _reason text)
RETURNS public.network_consolidation_homologations LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE cur int; r public.network_consolidation_homologations;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'consolidacao:sessao'; END IF;
  IF NOT public.has_network_capability('oficializar-mapa-estatistico') THEN RAISE EXCEPTION 'consolidacao:sem-permissao'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('consol:' || _year || ':' || _month || ':' || _audience));
  SELECT coalesce(max(revision), 0) INTO cur FROM public.network_consolidation_homologations WHERE year = _year AND month = _month AND audience = _audience;
  IF cur <> _expected_revision THEN RAISE EXCEPTION 'consolidacao:base-desatualizada'; END IF;
  IF cur > 0 AND (_reason IS NULL OR length(btrim(_reason)) < 3) THEN RAISE EXCEPTION 'consolidacao:motivo-obrigatorio'; END IF;
  INSERT INTO public.network_consolidation_homologations(year, month, audience, revision, school_count, totals, fingerprint, reason, homologated_by)
  VALUES (_year, _month, _audience, cur + 1, _school_count, _totals, _fingerprint, nullif(btrim(coalesce(_reason,'')), ''), auth.uid()) RETURNING * INTO r;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.publish_network_notice(text,text,text,text,text), public.withdraw_network_notice(uuid,text), public.homologate_network_consolidation(int,int,text,int,jsonb,text,int,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.publish_network_notice(text,text,text,text,text), public.withdraw_network_notice(uuid,text), public.homologate_network_consolidation(int,int,text,int,jsonb,text,int,text) TO authenticated;

CREATE POLICY "avisos-rede leitura autenticada" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'avisos-rede');
CREATE POLICY "avisos-rede envio pelo CIECE" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avisos-rede' AND (storage.foldername(name))[1] = auth.uid()::text AND public.has_network_capability('manter-regra-de-competencia-do-mapa'));