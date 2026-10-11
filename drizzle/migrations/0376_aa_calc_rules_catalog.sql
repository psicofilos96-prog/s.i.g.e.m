CREATE TABLE public.aa_calc_rule_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL, version int NOT NULL, supersedes_id uuid REFERENCES public.aa_calc_rule_versions(id),
  program_key text NOT NULL, edition_label text NOT NULL,
  rule_kind text NOT NULL CHECK (rule_kind IN ('instrumento','matriz','rubrica','parametro','peso','escala','correspondencia-eixo-item','limiar','formula')),
  rule_key text NOT NULL, payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  source_ref text NOT NULL CHECK (length(btrim(source_ref)) >= 3), source_hash text,
  reason text, author_user_id uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version)
);
CREATE TABLE public.aa_calc_rule_homologations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_version_id uuid NOT NULL REFERENCES public.aa_calc_rule_versions(id),
  decision text NOT NULL CHECK (decision IN ('homologado','revogado')), reason text NOT NULL,
  author_user_id uuid NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.aa_calc_rule_versions, public.aa_calc_rule_homologations TO authenticated;
GRANT ALL ON public.aa_calc_rule_versions, public.aa_calc_rule_homologations TO service_role;
ALTER TABLE public.aa_calc_rule_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aa_calc_rule_homologations ENABLE ROW LEVEL SECURITY;
CREATE POLICY aa_rule_read ON public.aa_calc_rule_versions FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY aa_rule_hom_read ON public.aa_calc_rule_homologations FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE FUNCTION public.aa_rule_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'regra-avaliacao:append-only'; END $$;
CREATE TRIGGER aa_rule_ro BEFORE UPDATE OR DELETE ON public.aa_calc_rule_versions FOR EACH ROW EXECUTE FUNCTION public.aa_rule_append_only();
CREATE TRIGGER aa_rule_hom_ro BEFORE UPDATE OR DELETE ON public.aa_calc_rule_homologations FOR EACH ROW EXECUTE FUNCTION public.aa_rule_append_only();

CREATE FUNCTION public.aa_record_calc_rule(_logical uuid, _expected_version int, _program text, _edition text, _kind text, _key text, _payload jsonb, _source text, _source_hash text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE lid uuid := coalesce(_logical, gen_random_uuid()); b public.aa_calc_rule_versions; nid uuid; k text; s numeric := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'regra-avaliacao:unauthenticated'; END IF;
  IF NOT public.has_network_capability('manter-regras-avaliacao') THEN RAISE EXCEPTION 'regra-avaliacao:forbidden'; END IF;
  IF length(btrim(coalesce(_source,''))) < 3 THEN RAISE EXCEPTION 'regra-avaliacao:source-required'; END IF;
  IF length(btrim(coalesce(_program,''))) = 0 OR length(btrim(coalesce(_edition,''))) = 0 OR length(btrim(coalesce(_key,''))) = 0 THEN RAISE EXCEPTION 'regra-avaliacao:identity-required'; END IF;
  IF _kind = 'peso' THEN
    IF jsonb_typeof(_payload->'weights') <> 'object' OR _payload->'weights' = '{}'::jsonb THEN RAISE EXCEPTION 'regra-avaliacao:weights-required'; END IF;
    FOR k IN SELECT jsonb_object_keys(_payload->'weights') LOOP
      IF jsonb_typeof(_payload->'weights'->k) <> 'number' OR (_payload->'weights'->>k)::numeric < 0 THEN RAISE EXCEPTION 'regra-avaliacao:weight-invalid'; END IF;
    END LOOP;
  ELSIF _kind = 'limiar' THEN
    IF jsonb_typeof(_payload->'value') <> 'number' OR coalesce(_payload->>'comparison','') NOT IN ('<','<=','>','>=') THEN RAISE EXCEPTION 'regra-avaliacao:threshold-invalid'; END IF;
  ELSIF _kind = 'escala' THEN
    IF jsonb_typeof(_payload->'min') <> 'number' OR jsonb_typeof(_payload->'max') <> 'number' OR (_payload->>'min')::numeric >= (_payload->>'max')::numeric THEN RAISE EXCEPTION 'regra-avaliacao:scale-invalid'; END IF;
  ELSIF _kind = 'correspondencia-eixo-item' THEN
    IF jsonb_typeof(_payload->'map') <> 'object' OR _payload->'map' = '{}'::jsonb THEN RAISE EXCEPTION 'regra-avaliacao:map-required'; END IF;
  ELSIF _kind = 'formula' THEN
    IF coalesce(_payload->>'kind','') NOT IN ('soma-ponderada','media','soma','proporcao') THEN RAISE EXCEPTION 'regra-avaliacao:formula-kind-closed'; END IF;
  END IF;
  SELECT * INTO b FROM public.aa_calc_rule_versions WHERE logical_id = lid ORDER BY version DESC LIMIT 1 FOR UPDATE;
  IF coalesce(b.version,0) <> coalesce(_expected_version,0) THEN RAISE EXCEPTION 'regra-avaliacao:stale-base'; END IF;
  IF b.id IS NOT NULL AND length(btrim(coalesce(_reason,''))) < 5 THEN RAISE EXCEPTION 'regra-avaliacao:reason-required'; END IF;
  INSERT INTO public.aa_calc_rule_versions(logical_id, version, supersedes_id, program_key, edition_label, rule_kind, rule_key, payload, source_ref, source_hash, reason, author_user_id)
  VALUES (lid, coalesce(b.version,0)+1, b.id, btrim(_program), btrim(_edition), _kind, btrim(_key), _payload, btrim(_source), _source_hash, nullif(btrim(coalesce(_reason,'')),''), auth.uid())
  RETURNING id INTO nid;
  RETURN nid;
END $$;
CREATE FUNCTION public.aa_homologate_calc_rule(_version uuid, _decision text, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v public.aa_calc_rule_versions; nid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'regra-avaliacao:unauthenticated'; END IF;
  IF NOT public.has_network_capability('homologar-regras-avaliacao') THEN RAISE EXCEPTION 'regra-avaliacao:forbidden'; END IF;
  IF length(btrim(coalesce(_reason,''))) < 5 THEN RAISE EXCEPTION 'regra-avaliacao:reason-required'; END IF;
  SELECT * INTO v FROM public.aa_calc_rule_versions WHERE id = _version;
  IF v.id IS NULL THEN RAISE EXCEPTION 'regra-avaliacao:not-found'; END IF;
  IF v.author_user_id = auth.uid() THEN RAISE EXCEPTION 'regra-avaliacao:self-homologation'; END IF;
  INSERT INTO public.aa_calc_rule_homologations(rule_version_id, decision, reason, author_user_id) VALUES (_version, _decision, btrim(_reason), auth.uid()) RETURNING id INTO nid;
  RETURN nid;
END $$;
REVOKE ALL ON FUNCTION public.aa_record_calc_rule(uuid,int,text,text,text,text,jsonb,text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.aa_homologate_calc_rule(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aa_record_calc_rule(uuid,int,text,text,text,text,jsonb,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aa_homologate_calc_rule(uuid,text,text) TO authenticated;