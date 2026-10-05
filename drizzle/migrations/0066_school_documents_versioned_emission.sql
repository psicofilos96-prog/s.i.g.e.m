-- Documentos escolares oficiais: motor genérico de emissão versionada.
-- Template versionado (apresentação, nunca norma); emissão = snapshot imutável com SHA-256;
-- reprodução ≠ emissão original; cancelamento/retificação append-only; verificação pública minimizada.
-- Nenhuma regra de política é criada: as três capabilities falham fechado até decisão do proprietário.

CREATE FUNCTION public.school_document_capabilities() RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$
  SELECT ARRAY['manter-modelo-de-documento-escolar','emitir-documento-escolar','consultar-documento-escolar']::text[] $$;
REVOKE ALL ON FUNCTION public.school_document_capabilities() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_document_capabilities() TO authenticated;

CREATE FUNCTION public.school_document_grant(_capability text, _school text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _capability IS NULL OR NOT (_capability = ANY (public.school_document_capabilities())) THEN
    RAISE EXCEPTION 'document:capability-not-allowed'; END IF;
  SELECT c.engagement_id INTO g FROM public.effective_scope_capabilities(CURRENT_DATE) c
   WHERE c.capability_id = _capability AND c.policy_id IS NOT NULL
     AND (c.scope_level = 'rede' OR (_school IS NOT NULL AND c.scope_level = 'escola' AND c.school_id = _school))
   ORDER BY (c.scope_level = 'escola') DESC, c.policy_version DESC, c.engagement_id LIMIT 1;
  IF g IS NULL THEN RAISE EXCEPTION 'capability:%', _capability; END IF;
  RETURN g;
END $fn$;
REVOKE ALL ON FUNCTION public.school_document_grant(text, text) FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE public.school_document_templates (
  id text PRIMARY KEY CHECK (id ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  document_kind text NOT NULL CHECK (document_kind ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.school_document_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id text NOT NULL REFERENCES public.school_document_templates(id),
  version_no integer NOT NULL CHECK (version_no >= 1),
  supersedes_id uuid REFERENCES public.school_document_template_versions(id),
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  blocks jsonb NOT NULL CHECK (jsonb_typeof(blocks) = 'array'),
  identity jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(identity) = 'object'),
  numbering jsonb CHECK (numbering IS NULL OR jsonb_typeof(numbering) = 'object'),
  public_fields text[] NOT NULL DEFAULT '{}',
  source_ref text,
  change_reason text,
  recorded_by uuid NOT NULL,
  recorded_by_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, version_no),
  UNIQUE (supersedes_id)
);
CREATE TABLE public.school_document_emissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_code text NOT NULL UNIQUE,
  emission_kind text NOT NULL CHECK (emission_kind IN ('original','reproducao')),
  reproduces_id uuid REFERENCES public.school_document_emissions(id),
  retifies_id uuid REFERENCES public.school_document_emissions(id),
  template_version_id uuid NOT NULL REFERENCES public.school_document_template_versions(id),
  document_kind text NOT NULL,
  school_id text NOT NULL,
  student_id text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot jsonb NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  snapshot_sha256 text NOT NULL,
  emission_number text,
  public_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  emitted_by uuid NOT NULL,
  emitted_by_person text,
  emitted_by_engagement uuid NOT NULL,
  emitted_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((emission_kind = 'reproducao') = (reproduces_id IS NOT NULL))
);
CREATE INDEX ON public.school_document_emissions (school_id, student_id, emitted_at DESC);
CREATE TABLE public.school_document_emission_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emission_id uuid NOT NULL REFERENCES public.school_document_emissions(id),
  event_kind text NOT NULL CHECK (event_kind IN ('cancelamento','retificacao')),
  replacement_emission_id uuid REFERENCES public.school_document_emissions(id),
  reason text NOT NULL CHECK (length(btrim(reason)) > 0),
  recorded_by uuid NOT NULL,
  recorded_by_engagement uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (emission_id),
  CHECK ((event_kind = 'retificacao') = (replacement_emission_id IS NOT NULL))
);

-- Nenhum acesso direto: tudo por readers/writers SECURITY DEFINER.
REVOKE ALL ON public.school_document_templates, public.school_document_template_versions,
  public.school_document_emissions, public.school_document_emission_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.school_document_templates, public.school_document_template_versions,
  public.school_document_emissions, public.school_document_emission_events TO service_role;
ALTER TABLE public.school_document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_document_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_document_emissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_document_emission_events ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION public.school_document_append_only() RETURNS trigger
LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN RAISE EXCEPTION 'document:append-only'; END $$;
CREATE TRIGGER sdt_append_only BEFORE UPDATE OR DELETE ON public.school_document_templates FOR EACH ROW EXECUTE FUNCTION public.school_document_append_only();
CREATE TRIGGER sdtv_append_only BEFORE UPDATE OR DELETE ON public.school_document_template_versions FOR EACH ROW EXECUTE FUNCTION public.school_document_append_only();
CREATE TRIGGER sde_append_only BEFORE UPDATE OR DELETE ON public.school_document_emissions FOR EACH ROW EXECUTE FUNCTION public.school_document_append_only();
CREATE TRIGGER sdee_append_only BEFORE UPDATE OR DELETE ON public.school_document_emission_events FOR EACH ROW EXECUTE FUNCTION public.school_document_append_only();

-- Campos que a verificação pública NUNCA expõe, mesmo se o modelo os listar.
CREATE FUNCTION public.school_document_public_field_forbidden(_key text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path TO '' AS $$
  SELECT _key IS NULL OR lower(_key) ~ '(nota|conceito|media|avalia|frequen|falta|saude|laudo|defici|cpf|rg|nis|certid|document|endere|telefone|email|responsa|nascimento|filia|mae|pai)' $$;
REVOKE ALL ON FUNCTION public.school_document_public_field_forbidden(text) FROM PUBLIC, anon;

CREATE FUNCTION public.record_school_document_template_version(_template_id text, _document_kind text,
  _expected_head_id uuid, _title text, _blocks jsonb, _identity jsonb, _numbering jsonb,
  _public_fields text[], _source_ref text, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; head uuid; head_no int; kind text; f text; new_id uuid;
BEGIN
  g := public.school_document_grant('manter-modelo-de-documento-escolar', NULL);
  IF _template_id IS NULL OR _template_id !~ '^[a-z0-9][a-z0-9-]{1,79}$' THEN RAISE EXCEPTION 'document:template-id-invalid'; END IF;
  IF _blocks IS NULL OR jsonb_typeof(_blocks) <> 'array' THEN RAISE EXCEPTION 'document:blocks-invalid'; END IF;
  FOREACH f IN ARRAY coalesce(_public_fields, '{}') LOOP
    IF public.school_document_public_field_forbidden(f) THEN RAISE EXCEPTION 'document:public-field-forbidden:%', f; END IF;
  END LOOP;
  PERFORM pg_advisory_xact_lock(hashtext('sdt:' || _template_id));
  SELECT document_kind INTO kind FROM public.school_document_templates WHERE id = _template_id;
  IF kind IS NULL THEN
    IF _expected_head_id IS NOT NULL THEN RAISE EXCEPTION 'base-unknown'; END IF;
    INSERT INTO public.school_document_templates(id, document_kind, created_by) VALUES (_template_id, _document_kind, auth.uid());
  ELSIF kind IS DISTINCT FROM _document_kind THEN RAISE EXCEPTION 'document:kind-immutable';
  END IF;
  SELECT v.id, v.version_no INTO head, head_no FROM public.school_document_template_versions v
   WHERE v.template_id = _template_id ORDER BY v.version_no DESC LIMIT 1;
  IF head IS DISTINCT FROM _expected_head_id THEN RAISE EXCEPTION 'base-superseded'; END IF;
  IF head IS NOT NULL AND (_reason IS NULL OR length(btrim(_reason)) = 0) THEN RAISE EXCEPTION 'correction-reason-required'; END IF;
  INSERT INTO public.school_document_template_versions(template_id, version_no, supersedes_id, title, blocks, identity,
    numbering, public_fields, source_ref, change_reason, recorded_by, recorded_by_engagement)
  VALUES (_template_id, coalesce(head_no, 0) + 1, head, _title, _blocks, coalesce(_identity, '{}'::jsonb), _numbering,
    coalesce(_public_fields, '{}'), nullif(btrim(_source_ref), ''), nullif(btrim(_reason), ''), auth.uid(), g)
  RETURNING id INTO new_id;
  RETURN jsonb_build_object('id', new_id, 'version_no', coalesce(head_no, 0) + 1);
END $fn$;
REVOKE ALL ON FUNCTION public.record_school_document_template_version(text, text, uuid, text, jsonb, jsonb, jsonb, text[], text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_school_document_template_version(text, text, uuid, text, jsonb, jsonb, jsonb, text[], text, text) TO authenticated;

CREATE FUNCTION public.school_document_templates_list()
RETURNS TABLE(template_id text, document_kind text, version_id uuid, version_no int, supersedes_id uuid, title text,
  blocks jsonb, identity jsonb, numbering jsonb, public_fields text[], source_ref text, change_reason text, recorded_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  RETURN QUERY SELECT t.id, t.document_kind, v.id, v.version_no, v.supersedes_id, v.title, v.blocks, v.identity,
    v.numbering, v.public_fields, v.source_ref, v.change_reason, v.recorded_at
   FROM public.school_document_templates t JOIN public.school_document_template_versions v ON v.template_id = t.id
   ORDER BY t.id, v.version_no DESC;
END $fn$;
REVOKE ALL ON FUNCTION public.school_document_templates_list() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.school_document_templates_list() TO authenticated;

CREATE FUNCTION public.emit_school_document(_template_version_id uuid, _school_id text, _student_id text,
  _context jsonb, _snapshot jsonb, _reproduces_id uuid, _retifies_id uuid, _retification_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; tv record; orig record; snap jsonb; ctx jsonb; num text; seq int; code text; pub jsonb := '{}'::jsonb;
  f text; new_id uuid; sha text; latest uuid;
BEGIN
  g := public.school_document_grant('emitir-documento-escolar', _school_id);
  IF _reproduces_id IS NOT NULL THEN
    IF _retifies_id IS NOT NULL THEN RAISE EXCEPTION 'document:reproduction-cannot-retify'; END IF;
    SELECT * INTO orig FROM public.school_document_emissions WHERE id = _reproduces_id;
    IF orig.id IS NULL OR orig.school_id <> _school_id THEN RAISE EXCEPTION 'document:emission-not-found'; END IF;
    IF orig.emission_kind = 'reproducao' THEN RAISE EXCEPTION 'document:reproduce-the-original'; END IF;
    IF EXISTS (SELECT 1 FROM public.school_document_emission_events e WHERE e.emission_id = orig.id) THEN
      RAISE EXCEPTION 'document:emission-not-active'; END IF;
    snap := orig.snapshot; ctx := orig.context; num := orig.emission_number; pub := orig.public_payload;
    SELECT * INTO tv FROM public.school_document_template_versions WHERE id = orig.template_version_id;
    _student_id := orig.student_id;
  ELSE
    SELECT v.*, t.document_kind INTO tv FROM public.school_document_template_versions v
      JOIN public.school_document_templates t ON t.id = v.template_id WHERE v.id = _template_version_id;
    IF tv.id IS NULL THEN RAISE EXCEPTION 'document:template-not-found'; END IF;
    IF _snapshot IS NULL OR jsonb_typeof(_snapshot) <> 'object' OR jsonb_typeof(_snapshot -> 'fields') <> 'object' THEN
      RAISE EXCEPTION 'document:snapshot-invalid'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.school_enrollments se WHERE se.student_id = _student_id AND se.school_id = _school_id) THEN
      RAISE EXCEPTION 'document:student-not-enrolled-in-school'; END IF;
    IF _retifies_id IS NOT NULL THEN
      IF _retification_reason IS NULL OR length(btrim(_retification_reason)) = 0 THEN RAISE EXCEPTION 'correction-reason-required'; END IF;
      PERFORM pg_advisory_xact_lock(hashtext('sde:' || _retifies_id::text));
      SELECT * INTO orig FROM public.school_document_emissions WHERE id = _retifies_id;
      IF orig.id IS NULL OR orig.school_id <> _school_id OR orig.student_id <> _student_id OR orig.emission_kind <> 'original' THEN
        RAISE EXCEPTION 'document:emission-not-found'; END IF;
      IF EXISTS (SELECT 1 FROM public.school_document_emission_events e WHERE e.emission_id = orig.id) THEN
        RAISE EXCEPTION 'base-superseded'; END IF;
    END IF;
    snap := _snapshot; ctx := coalesce(_context, '{}'::jsonb);
    FOREACH f IN ARRAY tv.public_fields LOOP
      IF NOT public.school_document_public_field_forbidden(f) AND (snap -> 'fields') ? f
         AND jsonb_typeof(snap -> 'fields' -> f) IN ('string','number') THEN
        pub := pub || jsonb_build_object(f, snap -> 'fields' -> f);
      END IF;
    END LOOP;
    IF tv.numbering IS NOT NULL AND coalesce(tv.numbering ->> 'prefix', '') <> '' THEN
      PERFORM pg_advisory_xact_lock(hashtext('sdn:' || tv.template_id || ':' || _school_id));
      SELECT count(*) + 1 INTO seq FROM public.school_document_emissions e
        JOIN public.school_document_template_versions v ON v.id = e.template_version_id
       WHERE v.template_id = tv.template_id AND e.school_id = _school_id AND e.emission_kind = 'original'
         AND extract(year FROM e.emitted_at) = extract(year FROM now());
      num := (tv.numbering ->> 'prefix') || '-' || to_char(now(), 'YYYY') || '-' ||
             lpad(seq::text, greatest(coalesce((tv.numbering ->> 'digits')::int, 5), 1), '0');
    END IF;
  END IF;
  sha := encode(sha256(convert_to(snap::text, 'UTF8')), 'hex');
  code := upper(substr(encode(extensions.gen_random_bytes(10), 'hex'), 1, 16));
  INSERT INTO public.school_document_emissions(verification_code, emission_kind, reproduces_id, retifies_id, template_version_id,
    document_kind, school_id, student_id, context, snapshot, snapshot_sha256, emission_number, public_payload,
    emitted_by, emitted_by_person, emitted_by_engagement)
  VALUES (code, CASE WHEN _reproduces_id IS NULL THEN 'original' ELSE 'reproducao' END, _reproduces_id, _retifies_id,
    tv.id, coalesce(tv.document_kind, (SELECT document_kind FROM public.school_document_templates WHERE id = tv.template_id)),
    _school_id, _student_id, ctx, snap, sha, num, pub, auth.uid(), public.current_person_id(), g)
  RETURNING id INTO new_id;
  IF _retifies_id IS NOT NULL THEN
    INSERT INTO public.school_document_emission_events(emission_id, event_kind, replacement_emission_id, reason, recorded_by, recorded_by_engagement)
    VALUES (_retifies_id, 'retificacao', new_id, btrim(_retification_reason), auth.uid(), g);
  END IF;
  RETURN jsonb_build_object('id', new_id, 'verification_code', code, 'snapshot_sha256', sha, 'emission_number', num);
END $fn$;
REVOKE ALL ON FUNCTION public.emit_school_document(uuid, text, text, jsonb, jsonb, uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.emit_school_document(uuid, text, text, jsonb, jsonb, uuid, uuid, text) TO authenticated;

CREATE FUNCTION public.cancel_school_document_emission(_emission_id uuid, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE g uuid; e record; new_id uuid;
BEGIN
  SELECT * INTO e FROM public.school_document_emissions WHERE id = _emission_id;
  g := public.school_document_grant('emitir-documento-escolar', e.school_id);
  IF e.id IS NULL THEN RAISE EXCEPTION 'document:emission-not-found'; END IF;
  IF _reason IS NULL OR length(btrim(_reason)) = 0 THEN RAISE EXCEPTION 'correction-reason-required'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('sde:' || _emission_id::text));
  IF EXISTS (SELECT 1 FROM public.school_document_emission_events x WHERE x.emission_id = _emission_id) THEN
    RAISE EXCEPTION 'base-superseded'; END IF;
  INSERT INTO public.school_document_emission_events(emission_id, event_kind, reason, recorded_by, recorded_by_engagement)
  VALUES (_emission_id, 'cancelamento', btrim(_reason), auth.uid(), g) RETURNING id INTO new_id;
  RETURN jsonb_build_object('id', new_id);
END $fn$;
REVOKE ALL ON FUNCTION public.cancel_school_document_emission(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_school_document_emission(uuid, text) TO authenticated;

-- Consulta interna: exige capability de consultar OU de emitir na escola (emitir ≠ ver tudo da rede).
CREATE FUNCTION public.student_document_emissions(_school_id text, _student_id text)
RETURNS TABLE(id uuid, verification_code text, emission_kind text, reproduces_id uuid, retifies_id uuid,
  template_version_id uuid, document_kind text, context jsonb, snapshot jsonb, snapshot_sha256 text,
  emission_number text, emitted_by_person text, emitted_at timestamptz,
  event_kind text, event_reason text, replacement_emission_id uuid, event_recorded_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'session-required'; END IF;
  IF _school_id IS NULL OR _student_id IS NULL THEN RAISE EXCEPTION 'document:scope-required'; END IF;
  BEGIN PERFORM public.school_document_grant('consultar-documento-escolar', _school_id);
  EXCEPTION WHEN raise_exception THEN PERFORM public.school_document_grant('emitir-documento-escolar', _school_id); END;
  RETURN QUERY SELECT e.id, e.verification_code, e.emission_kind, e.reproduces_id, e.retifies_id, e.template_version_id,
    e.document_kind, e.context, e.snapshot, e.snapshot_sha256, e.emission_number, e.emitted_by_person, e.emitted_at,
    x.event_kind, x.reason, x.replacement_emission_id, x.recorded_at
   FROM public.school_document_emissions e LEFT JOIN public.school_document_emission_events x ON x.emission_id = e.id
   WHERE e.school_id = _school_id AND e.student_id = _student_id ORDER BY e.emitted_at DESC;
END $fn$;
REVOKE ALL ON FUNCTION public.student_document_emissions(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_document_emissions(text, text) TO authenticated;

-- Verificação pública mínima: nada de aluno, nota, saúde, documento pessoal ou endereço.
CREATE FUNCTION public.verify_school_document(_code text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $fn$
DECLARE e record; x record; title text;
BEGIN
  IF _code IS NULL OR upper(btrim(_code)) !~ '^[0-9A-F]{16}$' THEN RETURN jsonb_build_object('status', 'invalido'); END IF;
  SELECT * INTO e FROM public.school_document_emissions WHERE verification_code = upper(btrim(_code));
  IF e.id IS NULL THEN RETURN jsonb_build_object('status', 'nao-encontrado'); END IF;
  SELECT * INTO x FROM public.school_document_emission_events WHERE emission_id = coalesce(e.reproduces_id, e.id);
  SELECT v.title INTO title FROM public.school_document_template_versions v WHERE v.id = e.template_version_id;
  RETURN jsonb_build_object(
    'status', CASE WHEN x.event_kind = 'cancelamento' THEN 'cancelado' WHEN x.event_kind = 'retificacao' THEN 'retificado' ELSE 'valido' END,
    'emission_kind', e.emission_kind, 'document_kind', e.document_kind, 'title', title,
    'school_id', e.school_id, 'emission_number', e.emission_number, 'emitted_at', e.emitted_at,
    'snapshot_sha256', e.snapshot_sha256, 'public_fields', e.public_payload);
END $fn$;
REVOKE ALL ON FUNCTION public.verify_school_document(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_school_document(text) TO anon, authenticated;