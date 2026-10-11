-- TSEMED.9 — Tabela 09: limites numéricos por campo no catálogo, matrícula por etapa e mediação NEI como
-- leituras centrais agregadas (sem fonte ⇒ null), anexos privados por escola/ano/tabela (append-only, retirada por evento).
CREATE OR REPLACE FUNCTION public.semed_validate_values(_def jsonb, _values jsonb)
 RETURNS void LANGUAGE plpgsql IMMUTABLE SET search_path TO '' AS $function$
DECLARE k text; v jsonb; spec jsonb; t text; x numeric;
BEGIN
  IF _values IS NULL OR jsonb_typeof(_values) <> 'object' THEN RAISE EXCEPTION 'semed:valores-invalidos'; END IF;
  FOR k, v IN SELECT * FROM jsonb_each(_values) LOOP
    spec := public.semed_key_spec(_def, k);
    IF spec IS NULL THEN RAISE EXCEPTION 'semed:campo-desconhecido:%', k; END IF;
    CONTINUE WHEN jsonb_typeof(v) = 'null';
    t := spec->>'type';
    IF t = 'int' THEN
      IF jsonb_typeof(v) <> 'number' THEN RAISE EXCEPTION 'semed:inteiro-invalido:%', k; END IF;
      x := (v::text)::numeric;
      IF x <> trunc(x) OR x < coalesce((spec->>'min')::numeric, 0) OR x > coalesce((spec->>'max')::numeric, 100000) THEN
        RAISE EXCEPTION 'semed:inteiro-invalido:%', k; END IF;
    ELSIF t = 'text' THEN
      IF jsonb_typeof(v) <> 'string' OR length(v #>> '{}') > 500 THEN RAISE EXCEPTION 'semed:texto-invalido:%', k; END IF;
    ELSIF t = 'enum' THEN
      IF jsonb_typeof(v) <> 'string' OR NOT ((spec->'options') ? (v #>> '{}')) THEN RAISE EXCEPTION 'semed:opcao-invalida:%', k; END IF;
    ELSE RAISE EXCEPTION 'semed:tipo-desconhecido:%', k; END IF;
  END LOOP;
END $function$;

CREATE OR REPLACE FUNCTION public.semed_table_central(_school text)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $function$
DECLARE r record; inep text; act bigint; undated bigint; txt text; med bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT public.semed_can_read(_school) THEN RETURN NULL; END IF;
  SELECT official_name, district, location_kind, phone, institutional_email INTO r
    FROM public.institutional_school_record_versions WHERE school_id = _school AND (valid_from IS NULL OR valid_from <= current_date)
    ORDER BY version_number DESC LIMIT 1;
  SELECT value INTO inep FROM public.institutional_school_identifiers WHERE school_id = _school AND identifier_kind = 'inep';
  SELECT cardinality(active_ids), undated_count INTO act, undated FROM public.active_enrollments_at(_school, current_date, now());
  txt := CASE WHEN coalesce(undated, 0) = 0 THEN act::text
              ELSE act || ' com data de início + ' || undated || ' sem data de início registrada (não apurado se vigentes)' END;
  -- Só contagem de estudantes distintos com mediação vigente (NEI): nenhum nome, laudo ou CID sai daqui.
  SELECT count(DISTINCT m.student_id) INTO med FROM public.inclusion_mediation_assignments m
    WHERE m.school_id = _school AND m.valid_from <= current_date AND (m.valid_to IS NULL OR m.valid_to >= current_date)
      AND NOT EXISTS (SELECT 1 FROM public.inclusion_mediation_assignments s WHERE s.supersedes_id = m.id);
  RETURN jsonb_build_object('escola', r.official_name, 'inep', inep, 'distrito', r.district, 'zona', r.location_kind,
    'telefone', r.phone, 'email', r.institutional_email, 'matricula-ativa', txt, 'diretor', NULL,
    'nei-mediacao', CASE WHEN med > 0 THEN med::text ELSE NULL END,
    'matricula-etapa', NULL);
END $function$;

CREATE TABLE public.semed_table_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id text NOT NULL REFERENCES public.institutional_schools(id), year int NOT NULL, table_code text NOT NULL,
  object_path text NOT NULL UNIQUE, file_name text NOT NULL CHECK (length(file_name) BETWEEN 1 AND 200),
  mime_type text NOT NULL CHECK (mime_type IN ('application/pdf','image/jpeg','image/png')),
  size_bytes int NOT NULL CHECK (size_bytes BETWEEN 1 AND 10485760),
  description text CHECK (description IS NULL OR length(description) <= 300),
  withdrawn_of uuid REFERENCES public.semed_table_attachments(id), withdraw_reason text,
  recorded_by uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.semed_table_attachments TO authenticated;
GRANT ALL ON public.semed_table_attachments TO service_role;
ALTER TABLE public.semed_table_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anexos SEMED no escopo" ON public.semed_table_attachments FOR SELECT TO authenticated USING (public.semed_can_read(school_id));
CREATE TRIGGER semed_attachments_immutable BEFORE UPDATE OR DELETE ON public.semed_table_attachments FOR EACH ROW EXECUTE FUNCTION public.semed_append_only();

CREATE OR REPLACE FUNCTION public.semed_attachment_register(_school text, _year int, _code text, _path text, _name text, _mime text, _size int, _description text)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.semed_can_fill(_school) THEN RAISE EXCEPTION 'semed:sem-permissao'; END IF;
  IF _code NOT IN ('04','06','09','10','11') THEN RAISE EXCEPTION 'semed:tabela-invalida'; END IF;
  IF _path NOT LIKE _school || '/' || _year || '/' || _code || '/%' THEN RAISE EXCEPTION 'semed:caminho-invalido'; END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'semed-anexos' AND o.name = _path) THEN RAISE EXCEPTION 'semed:arquivo-ausente'; END IF;
  INSERT INTO public.semed_table_attachments (school_id, year, table_code, object_path, file_name, mime_type, size_bytes, description, recorded_by)
    VALUES (_school, _year, _code, _path, _name, _mime, _size, nullif(trim(_description), ''), auth.uid()) RETURNING semed_table_attachments.id INTO id;
  RETURN id;
END $$;

CREATE OR REPLACE FUNCTION public.semed_attachment_withdraw(_id uuid, _reason text)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = '' AS $$
DECLARE a public.semed_table_attachments; nid uuid;
BEGIN
  SELECT * INTO a FROM public.semed_table_attachments WHERE id = _id AND withdrawn_of IS NULL;
  IF a.id IS NULL OR auth.uid() IS NULL OR NOT public.semed_can_fill(a.school_id) THEN RAISE EXCEPTION 'semed:sem-permissao'; END IF;
  IF coalesce(length(trim(_reason)), 0) < 5 THEN RAISE EXCEPTION 'semed:motivo-obrigatorio'; END IF;
  IF EXISTS (SELECT 1 FROM public.semed_table_attachments w WHERE w.withdrawn_of = _id) THEN RAISE EXCEPTION 'semed:ja-retirado'; END IF;
  INSERT INTO public.semed_table_attachments (school_id, year, table_code, object_path, file_name, mime_type, size_bytes, withdrawn_of, withdraw_reason, recorded_by)
    VALUES (a.school_id, a.year, a.table_code, a.object_path || '#retirada-' || gen_random_uuid(), a.file_name, a.mime_type, a.size_bytes, a.id, trim(_reason), auth.uid())
    RETURNING semed_table_attachments.id INTO nid;
  RETURN nid;
END $$;
REVOKE EXECUTE ON FUNCTION public.semed_attachment_register(text,int,text,text,text,text,int,text), public.semed_attachment_withdraw(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.semed_attachment_register(text,int,text,text,text,text,int,text), public.semed_attachment_withdraw(uuid,text) TO authenticated;

CREATE POLICY "semed-anexos envio pela escola" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'semed-anexos' AND public.semed_can_fill((storage.foldername(name))[1]));
CREATE POLICY "semed-anexos leitura no escopo" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'semed-anexos' AND public.semed_can_read((storage.foldername(name))[1]));

CREATE OR REPLACE FUNCTION public.bo_fixture_cleanup_semed(_operation_id text) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE n int := 0; c int;
BEGIN
  IF NOT public.technical_automation_enabled() THEN RAISE EXCEPTION 'bo:automation-disabled'; END IF;
  IF _operation_id !~ '^bo-[0-9a-f]{12}$' THEN RAISE EXCEPTION 'bo:invalid-marker'; END IF;
  PERFORM set_config('sigem.bo_cleanup_op', _operation_id, true);
  DELETE FROM public.semed_table_submission_events e WHERE public.semed_fixture_row(to_jsonb(e)); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  DELETE FROM public.semed_table_submissions s WHERE public.semed_fixture_row(to_jsonb(s))
    AND NOT EXISTS (SELECT 1 FROM public.semed_table_submission_events e WHERE e.submission_id = s.id); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  DELETE FROM public.semed_t04_adjustments a WHERE public.semed_fixture_row(to_jsonb(a)); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  DELETE FROM public.semed_t04_rule_versions a WHERE public.semed_fixture_row(to_jsonb(a)); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  DELETE FROM public.semed_t06_rule_versions a WHERE public.semed_fixture_row(to_jsonb(a)); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  DELETE FROM public.semed_table_attachments a WHERE a.withdrawn_of IS NOT NULL AND public.semed_fixture_row(to_jsonb(a)); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  DELETE FROM public.semed_table_attachments a WHERE public.semed_fixture_row(to_jsonb(a)); GET DIAGNOSTICS c = ROW_COUNT; n := n + c;
  PERFORM set_config('sigem.bo_cleanup_op', '', true);
  RETURN n;
END $$;
