-- SIGEM Desenvolvimento L05: Plano Anual de Formação.
-- Conteúdo é filho imutável da versão do plano (L02); ciclo proposta→análise→aprovação→publicação→monitoramento é ledger por versão.
-- Aprovação institucional exige ato juntado no SIGEM Documentos, capacidade própria e pessoa ≠ autor e ≠ analista.

CREATE TABLE public.dev_plan_contents (
  plan_version_id uuid PRIMARY KEY REFERENCES public.dev_plan_versions(id),
  academic_year_id text NOT NULL REFERENCES public.institutional_academic_years(id),
  calendar_version_id uuid REFERENCES public.calendar_versions(id),
  diagnosis_summary text NOT NULL CHECK (length(btrim(diagnosis_summary)) >= 20),
  resources text CHECK (resources IS NULL OR length(btrim(resources)) >= 5),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.dev_plan_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id uuid NOT NULL REFERENCES public.dev_plan_contents(plan_version_id),
  kind text NOT NULL CHECK (kind IN ('eixo','publico','meta','marco')),
  ord int NOT NULL CHECK (ord >= 1),
  text text NOT NULL CHECK (length(btrim(text)) BETWEEN 3 AND 500),
  target_value numeric CHECK (target_value IS NULL OR target_value >= 0),
  target_unit text CHECK (target_unit IS NULL OR length(btrim(target_unit)) BETWEEN 1 AND 40),
  due_on date,
  responsible_engagement uuid REFERENCES public.institutional_engagements(id),
  UNIQUE (plan_version_id, kind, ord),
  CHECK ((target_value IS NULL) = (target_unit IS NULL)),
  CHECK (kind <> 'marco' OR due_on IS NOT NULL)
);

CREATE TABLE public.dev_plan_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id uuid NOT NULL REFERENCES public.dev_plan_contents(plan_version_id),
  seq int NOT NULL CHECK (seq >= 1),
  kind text NOT NULL CHECK (kind IN ('proposta','analise','devolucao','aprovacao','publicacao','monitoramento')),
  note text CHECK (note IS NULL OR length(btrim(note)) >= 10),
  act_document_ref uuid REFERENCES public.docserv_document_versions(id),
  goal_item_id uuid REFERENCES public.dev_plan_items(id),
  observed_value numeric CHECK (observed_value IS NULL OR observed_value >= 0),
  actor_person uuid NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_version_id, seq),
  CHECK (kind NOT IN ('analise','devolucao','aprovacao','monitoramento') OR note IS NOT NULL),
  CHECK (kind <> 'aprovacao' OR act_document_ref IS NOT NULL)
);

GRANT SELECT ON public.dev_plan_contents, public.dev_plan_items, public.dev_plan_events TO authenticated;
GRANT ALL ON public.dev_plan_contents, public.dev_plan_items, public.dev_plan_events TO service_role;
REVOKE SELECT ON public.dev_plan_events FROM authenticated;
GRANT SELECT (id, plan_version_id, seq, kind, note, goal_item_id, observed_value, actor_person, created_at) ON public.dev_plan_events TO authenticated;
ALTER TABLE public.dev_plan_contents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dev_plan_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.dev_plan_published(_version uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.dev_plan_events WHERE plan_version_id = _version AND kind = 'publicacao')
$$;
REVOKE EXECUTE ON FUNCTION public.dev_plan_published(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dev_plan_published(uuid) TO authenticated, service_role;

-- Gestão vê tudo; plano publicado é público para autenticados.
CREATE POLICY "dev plan contents manager or published" ON public.dev_plan_contents FOR SELECT TO authenticated USING (public.dev_can_manage() OR public.dev_plan_published(plan_version_id));
CREATE POLICY "dev plan items manager or published" ON public.dev_plan_items FOR SELECT TO authenticated USING (public.dev_can_manage() OR public.dev_plan_published(plan_version_id));
CREATE POLICY "dev plan events manager or published" ON public.dev_plan_events FOR SELECT TO authenticated USING (public.dev_can_manage() OR public.dev_plan_published(plan_version_id));

CREATE TRIGGER devpc_immutable BEFORE UPDATE OR DELETE ON public.dev_plan_contents FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devpi_immutable BEFORE UPDATE OR DELETE ON public.dev_plan_items FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
CREATE TRIGGER devpev_immutable BEFORE UPDATE OR DELETE ON public.dev_plan_events FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only();
REVOKE TRUNCATE ON public.dev_plan_contents, public.dev_plan_items, public.dev_plan_events FROM authenticated, anon;

-- Plano: utilizável só se última versão, aprovada E publicada (programa só nasce de plano publicado).
CREATE OR REPLACE FUNCTION public.dev_version_usable(_subject text, _version uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.dev_version_approvals a WHERE a.subject = _subject AND a.version_id = _version AND a.decision = 'aprovada')
    AND CASE _subject
      WHEN 'plano' THEN NOT EXISTS (SELECT 1 FROM public.dev_plan_versions v JOIN public.dev_plan_versions w ON w.plan_id = v.plan_id AND w.version > v.version WHERE v.id = _version)
        AND EXISTS (SELECT 1 FROM public.dev_plan_events e WHERE e.plan_version_id = _version AND e.kind = 'publicacao')
      WHEN 'curso' THEN NOT EXISTS (SELECT 1 FROM public.dev_course_versions v JOIN public.dev_course_versions w ON w.course_id = v.course_id AND w.version > v.version WHERE v.id = _version)
      ELSE false END
$$;

-- Plano não é mais decidido pela aprovação direta da L02: só pelo fluxo.
CREATE OR REPLACE FUNCTION public.decide_dev_version(_subject text, _version uuid, _decision text, _reason text, _key text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _id uuid; _author uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT id INTO _id FROM public.dev_version_approvals WHERE idempotency_key = _key AND approver_person = _p;
  IF _id IS NOT NULL THEN RETURN _id; END IF;
  IF _subject = 'plano' THEN RAISE EXCEPTION 'dev:use-plan-workflow'; END IF;
  IF NOT public.has_network_capability('aprovar-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  IF _subject = 'curso' THEN SELECT author_person INTO _author FROM public.dev_course_versions WHERE id = _version;
  ELSE RAISE EXCEPTION 'dev:invalid'; END IF;
  IF _author IS NULL THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  IF _author = _p THEN RAISE EXCEPTION 'dev:self-approval'; END IF;
  INSERT INTO public.dev_version_approvals(subject, version_id, decision, reason, approver_person, idempotency_key)
  VALUES (_subject, _version, _decision, btrim(_reason), _p, _key) RETURNING id INTO _id;
  RETURN _id;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'dev:already-decided';
  WHEN check_violation THEN RAISE EXCEPTION 'dev:invalid';
END $$;

-- Conteúdo: só o autor da versão, uma vez, antes da proposta. _items: [{kind, text, target_value?, target_unit?, due_on?, responsible_engagement?}]
CREATE OR REPLACE FUNCTION public.record_dev_plan_content(_version uuid, _year text, _calendar uuid, _diagnosis text, _resources text, _items jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _v public.dev_plan_versions; _it jsonb; _ord jsonb := '{}'; _n int; _eng public.institutional_engagements;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  IF NOT public.has_network_capability('planejar-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  SELECT * INTO _v FROM public.dev_plan_versions WHERE id = _version FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  IF _v.author_person <> _p THEN RAISE EXCEPTION 'dev:not-author'; END IF;
  IF EXISTS (SELECT 1 FROM public.dev_plan_contents WHERE plan_version_id = _version) THEN RETURN _version; END IF;
  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' THEN RAISE EXCEPTION 'dev:invalid'; END IF;
  INSERT INTO public.dev_plan_contents(plan_version_id, academic_year_id, calendar_version_id, diagnosis_summary, resources)
  VALUES (_version, _year, _calendar, btrim(_diagnosis), nullif(btrim(coalesce(_resources, '')), ''));
  FOR _it IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _n := coalesce((_ord->>(_it->>'kind'))::int, 0) + 1; _ord := _ord || jsonb_build_object(_it->>'kind', _n);
    IF _it->>'responsible_engagement' IS NOT NULL THEN
      SELECT * INTO _eng FROM public.institutional_engagements WHERE id = (_it->>'responsible_engagement')::uuid;
      IF NOT FOUND OR (_eng.valid_until IS NOT NULL AND _eng.valid_until < current_date) THEN RAISE EXCEPTION 'dev:responsible-not-active'; END IF;
    END IF;
    INSERT INTO public.dev_plan_items(plan_version_id, kind, ord, text, target_value, target_unit, due_on, responsible_engagement)
    VALUES (_version, _it->>'kind', _n, btrim(_it->>'text'), (_it->>'target_value')::numeric, nullif(btrim(coalesce(_it->>'target_unit', '')), ''),
      (_it->>'due_on')::date, (_it->>'responsible_engagement')::uuid);
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM public.dev_plan_items WHERE plan_version_id = _version AND kind = 'eixo')
     OR NOT EXISTS (SELECT 1 FROM public.dev_plan_items WHERE plan_version_id = _version AND kind = 'publico') THEN
    RAISE EXCEPTION 'dev:plan-incomplete'; END IF;
  RETURN _version;
EXCEPTION WHEN check_violation OR foreign_key_violation OR invalid_text_representation OR invalid_datetime_format THEN RAISE EXCEPTION 'dev:invalid';
END $$;

-- Transições: proposta (autor) → analise (≠ autor, 'analisar-plano-de-formacao') → devolucao|aprovacao → publicacao → monitoramento*.
-- devolucao encerra a versão: correção = nova versão (L02).
CREATE OR REPLACE FUNCTION public.record_dev_plan_event(_version uuid, _expected_seq int, _kind text, _note text, _act uuid, _goal uuid, _observed numeric, _key text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _p uuid := public.current_person_id(); _v public.dev_plan_versions; _last int; _prev text; _seq int; _analyst uuid;
BEGIN
  IF _p IS NULL THEN RAISE EXCEPTION 'dev:no-person'; END IF;
  SELECT seq INTO _seq FROM public.dev_plan_events WHERE idempotency_key = _key AND plan_version_id = _version;
  IF _seq IS NOT NULL THEN RETURN _seq; END IF;
  SELECT * INTO _v FROM public.dev_plan_versions WHERE id = _version FOR UPDATE;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM public.dev_plan_contents WHERE plan_version_id = _version) THEN RAISE EXCEPTION 'dev:plan-incomplete'; END IF;
  SELECT coalesce(max(seq), 0) INTO _last FROM public.dev_plan_events WHERE plan_version_id = _version;
  IF _last <> _expected_seq THEN RAISE EXCEPTION 'dev:stale'; END IF;
  SELECT kind INTO _prev FROM public.dev_plan_events WHERE plan_version_id = _version AND seq = _last;
  IF NOT (
    (_kind = 'proposta' AND _prev IS NULL) OR
    (_kind = 'analise' AND _prev = 'proposta') OR
    (_kind IN ('devolucao','aprovacao') AND _prev = 'analise') OR
    (_kind = 'publicacao' AND _prev = 'aprovacao') OR
    (_kind = 'monitoramento' AND _prev IN ('publicacao','monitoramento'))
  ) THEN RAISE EXCEPTION 'dev:invalid-transition'; END IF;
  IF _kind = 'proposta' AND (_v.author_person <> _p OR NOT public.has_network_capability('planejar-formacao')) THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  IF _kind IN ('analise','devolucao') AND NOT public.has_network_capability('analisar-plano-de-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  IF _kind = 'aprovacao' AND NOT public.has_network_capability('aprovar-plano-de-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  IF _kind = 'publicacao' AND NOT public.has_network_capability('publicar-plano-de-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  IF _kind = 'monitoramento' AND NOT public.has_network_capability('acompanhar-formacao') THEN RAISE EXCEPTION 'dev:unavailable'; END IF;
  IF _kind IN ('analise','devolucao','aprovacao') AND _v.author_person = _p THEN RAISE EXCEPTION 'dev:segregation'; END IF;
  IF _kind = 'aprovacao' THEN
    SELECT actor_person INTO _analyst FROM public.dev_plan_events WHERE plan_version_id = _version AND kind = 'analise';
    IF _analyst = _p THEN RAISE EXCEPTION 'dev:segregation'; END IF;
  END IF;
  IF _kind = 'monitoramento' AND _goal IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.dev_plan_items WHERE id = _goal AND plan_version_id = _version AND kind = 'meta') THEN
    RAISE EXCEPTION 'dev:invalid-goal'; END IF;
  IF _observed IS NOT NULL AND _goal IS NULL THEN RAISE EXCEPTION 'dev:invalid-goal'; END IF;
  INSERT INTO public.dev_plan_events(plan_version_id, seq, kind, note, act_document_ref, goal_item_id, observed_value, actor_person, idempotency_key)
  VALUES (_version, _last + 1, _kind, nullif(btrim(coalesce(_note, '')), ''), CASE WHEN _kind = 'aprovacao' THEN _act END,
    CASE WHEN _kind = 'monitoramento' THEN _goal END, CASE WHEN _kind = 'monitoramento' THEN _observed END, _p, _key);
  IF _kind = 'aprovacao' THEN
    INSERT INTO public.dev_version_approvals(subject, version_id, decision, reason, approver_person, idempotency_key)
    VALUES ('plano', _version, 'aprovada', btrim(_note), _p, _key || ':approval');
  END IF;
  RETURN _last + 1;
EXCEPTION WHEN check_violation OR foreign_key_violation THEN RAISE EXCEPTION 'dev:invalid';
  WHEN unique_violation THEN RAISE EXCEPTION 'dev:already-decided';
END $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['record_dev_plan_content(uuid,text,uuid,text,text,jsonb)','record_dev_plan_event(uuid,int,text,text,uuid,uuid,numeric,text)'] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;