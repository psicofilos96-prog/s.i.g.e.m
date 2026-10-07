-- N11.2.3 Transporte escolar: fatos append-only por escola; sem regra (distância, elegibilidade, capacidade) inventada.
CREATE TABLE public.school_transport_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('rota','ponto','vinculo-estudante')),
  logical_id uuid NOT NULL,
  version int NOT NULL CHECK (version >= 1),
  route_logical_id uuid,
  stop_logical_id uuid,
  student_id text,
  label text,
  valid_from date NOT NULL,
  valid_until date,
  revoked boolean NOT NULL DEFAULT false,
  author_user_id uuid NOT NULL DEFAULT auth.uid(),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (valid_until IS NULL OR valid_until >= valid_from),
  CHECK (label IS NULL OR char_length(label) BETWEEN 1 AND 200),
  CHECK ((kind <> 'ponto') OR route_logical_id IS NOT NULL),
  CHECK ((kind <> 'vinculo-estudante') OR (stop_logical_id IS NOT NULL AND student_id IS NOT NULL))
);
CREATE INDEX school_transport_facts_school ON public.school_transport_facts (school_id, kind);
GRANT SELECT ON public.school_transport_facts TO authenticated;
GRANT ALL ON public.school_transport_facts TO service_role;
ALTER TABLE public.school_transport_facts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transporte: leitura por capacidade na escola" ON public.school_transport_facts
  FOR SELECT TO authenticated USING (
    public.has_school_capability('consultar-transporte-escolar', school_id)
    OR public.has_school_capability('manter-transporte-escolar', school_id)
    OR public.has_network_capability('consultar-transporte-escolar'));

CREATE OR REPLACE FUNCTION public.school_transport_append_only() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$ BEGIN RAISE EXCEPTION 'transporte:append-only'; END $$;
CREATE TRIGGER school_transport_facts_append_only BEFORE UPDATE OR DELETE ON public.school_transport_facts
  FOR EACH ROW EXECUTE FUNCTION public.school_transport_append_only();

CREATE OR REPLACE FUNCTION public.record_school_transport_fact(
  _school text, _kind text, _logical uuid, _expected_version int,
  _route uuid, _stop uuid, _student text, _label text,
  _valid_from date, _valid_until date, _revoked boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _head int; _id uuid; _parent_school text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'transporte:sem-sessao'; END IF;
  IF NOT public.has_school_capability('manter-transporte-escolar', _school) THEN RAISE EXCEPTION 'transporte:sem-autorizacao'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('transporte:' || _logical::text));
  SELECT max(version) INTO _head FROM public.school_transport_facts WHERE logical_id = _logical;
  IF coalesce(_head, 0) <> coalesce(_expected_version, 0) THEN RAISE EXCEPTION 'transporte:base-alterada'; END IF;
  IF _head IS NOT NULL AND EXISTS (SELECT 1 FROM public.school_transport_facts WHERE logical_id = _logical AND (school_id <> _school OR kind <> _kind)) THEN
    RAISE EXCEPTION 'transporte:identidade-imutavel'; END IF;
  IF _kind = 'ponto' THEN
    SELECT school_id INTO _parent_school FROM public.school_transport_facts WHERE logical_id = _route AND kind = 'rota' LIMIT 1;
    IF _parent_school IS DISTINCT FROM _school THEN RAISE EXCEPTION 'transporte:rota-de-outra-escola'; END IF;
  ELSIF _kind = 'vinculo-estudante' THEN
    SELECT school_id INTO _parent_school FROM public.school_transport_facts WHERE logical_id = _stop AND kind = 'ponto' LIMIT 1;
    IF _parent_school IS DISTINCT FROM _school THEN RAISE EXCEPTION 'transporte:ponto-de-outra-escola'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.school_enrollments e WHERE e.student_id = _student AND e.school_id = _school) THEN
      RAISE EXCEPTION 'transporte:estudante-sem-matricula-na-escola'; END IF;
  END IF;
  INSERT INTO public.school_transport_facts (school_id, kind, logical_id, version, route_logical_id, stop_logical_id, student_id, label, valid_from, valid_until, revoked)
  VALUES (_school, _kind, _logical, coalesce(_head, 0) + 1, _route, _stop, _student, _label, _valid_from, _valid_until, coalesce(_revoked, false))
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.record_school_transport_fact(text,text,uuid,int,uuid,uuid,text,text,date,date,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_school_transport_fact(text,text,uuid,int,uuid,uuid,text,text,date,date,boolean) TO authenticated;