CREATE TABLE public.institutional_visit_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  logical_id uuid NOT NULL, version integer NOT NULL, supersedes_id uuid REFERENCES public.institutional_visit_records(id),
  school_id text NOT NULL REFERENCES public.institutional_schools(id),
  visited_on date NOT NULL,
  visitor_kind_id text NOT NULL, visitor_kind_version integer NOT NULL,
  declared_identification text NOT NULL,
  origin_organization text,
  additional_identification jsonb NOT NULL DEFAULT '{}'::jsonb,
  annulled boolean NOT NULL DEFAULT false,
  originating_act_ref text, correction_reason text,
  author_user_id uuid, author_person_id uuid REFERENCES public.institutional_persons(id),
  authorizing_engagement_id uuid REFERENCES public.institutional_engagements(id),
  capability_policy_id uuid REFERENCES public.capability_policies(id), capability_policy_version integer,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (logical_id, version),
  CHECK (btrim(declared_identification) <> '')
);
GRANT SELECT ON public.institutional_visit_records TO authenticated;
GRANT ALL ON public.institutional_visit_records TO service_role;
ALTER TABLE public.institutional_visit_records ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER ivr_immutable BEFORE UPDATE OR DELETE ON public.institutional_visit_records FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
CREATE POLICY "visits by school capability" ON public.institutional_visit_records FOR SELECT TO authenticated
  USING (public.has_school_capability('consultar-registro-de-visitas', school_id));

CREATE OR REPLACE FUNCTION public.record_visit_version(_logical uuid, _base uuid, _school text, _visited_on date,
  _kind text, _kind_version integer, _identification text, _origin text, _additional jsonb,
  _annul boolean, _act_ref text, _correction_reason text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g record; cur record; _v integer := 1; _lid uuid := coalesce(_logical, gen_random_uuid()); _id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sessão ausente'; END IF;
  SELECT ec.engagement_id, ec.policy_id, ec.policy_version INTO g FROM public.effective_capabilities(current_date) ec
   WHERE ec.capability_id = 'registrar-visita-institucional' AND ec.school_id = _school AND ec.class_id IS NULL LIMIT 1;
  IF g.engagement_id IS NULL THEN RAISE EXCEPTION 'Capacidade registrar-visita-institucional não concedida por política homologada na escola'; END IF;
  IF coalesce(_additional, '{}'::jsonb) <> '{}'::jsonb THEN
    RAISE EXCEPTION 'Nenhuma política homologada permite identificador adicional do visitante'; END IF;
  IF coalesce(btrim(_identification),'') = '' THEN RAISE EXCEPTION 'Identificação declarada ausente'; END IF;
  PERFORM public.require_catalog('tipo-de-visitante', _kind, _kind_version, _visited_on);
  PERFORM pg_advisory_xact_lock(hashtext('ivr:' || _lid));
  SELECT * INTO cur FROM institutional_visit_records WHERE logical_id = _lid ORDER BY version DESC LIMIT 1;
  IF cur.id IS NOT NULL THEN
    IF _base IS DISTINCT FROM cur.id THEN RAISE EXCEPTION 'Versão base superada'; END IF;
    IF cur.annulled THEN RAISE EXCEPTION 'Visita anulada não é corrigida'; END IF;
    IF coalesce(btrim(_correction_reason),'') = '' THEN RAISE EXCEPTION 'Correção exige motivo'; END IF;
    IF cur.school_id <> _school THEN RAISE EXCEPTION 'Visita não muda de escola: anule e registre na escola correta'; END IF;
    _v := cur.version + 1;
  ELSIF _base IS NOT NULL THEN RAISE EXCEPTION 'Base inexistente';
  ELSIF coalesce(_annul, false) THEN RAISE EXCEPTION 'Anulação exige visita existente'; END IF;
  INSERT INTO institutional_visit_records(logical_id, version, supersedes_id, school_id, visited_on, visitor_kind_id, visitor_kind_version,
    declared_identification, origin_organization, additional_identification, annulled, originating_act_ref, correction_reason,
    author_user_id, author_person_id, authorizing_engagement_id, capability_policy_id, capability_policy_version)
  VALUES (_lid, _v, cur.id, _school, _visited_on, _kind, _kind_version, btrim(_identification), nullif(btrim(_origin),''), '{}'::jsonb,
    coalesce(_annul,false), _act_ref, _correction_reason, auth.uid(), public.current_person_id(), g.engagement_id, g.policy_id, g.policy_version)
  RETURNING id INTO _id;
  RETURN _id;
END $$;
REVOKE EXECUTE ON FUNCTION public.record_visit_version(uuid,uuid,text,date,text,integer,text,text,jsonb,boolean,text,text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.record_visit_version(uuid,uuid,text,date,text,integer,text,text,jsonb,boolean,text,text) TO authenticated;