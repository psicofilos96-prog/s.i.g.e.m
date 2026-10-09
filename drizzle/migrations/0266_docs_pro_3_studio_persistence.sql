-- DOCS.PRO.3 — Document Studio: versões append-only, ciclo por eventos, emissões congeladas e verificação pública mínima.
CREATE TABLE public.studio_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id text NOT NULL CHECK (template_id ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  version_no integer NOT NULL CHECK (version_no >= 1),
  supersedes_id uuid REFERENCES public.studio_template_versions(id),
  sector text NOT NULL CHECK (length(sector) BETWEEN 1 AND 40),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
  blocks jsonb NOT NULL CHECK (jsonb_typeof(blocks) = 'array' AND pg_column_size(blocks) < 200000),
  page jsonb NOT NULL CHECK (jsonb_typeof(page) = 'object'),
  base_template_id text,
  content_sha256 text NOT NULL,
  author_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, version_no)
);
CREATE TABLE public.studio_template_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id uuid NOT NULL REFERENCES public.studio_template_versions(id),
  kind text NOT NULL CHECK (kind IN ('enviar-revisao','devolver','homologar','arquivar')),
  actor_id uuid NOT NULL,
  note text CHECK (note IS NULL OR length(note) <= 500),
  at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX ON public.studio_template_events(version_id, at);
CREATE TABLE public.studio_emissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_code text NOT NULL UNIQUE CHECK (verification_code ~ '^[0-9A-F]{20}$'),
  template_version_id uuid NOT NULL REFERENCES public.studio_template_versions(id),
  school_id text,
  title text NOT NULL,
  issuer_label text NOT NULL,
  snapshot jsonb NOT NULL,
  snapshot_sha256 text NOT NULL,
  actor_id uuid NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX ON public.studio_emissions(actor_id);
CREATE TABLE public.studio_emission_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  emission_id uuid NOT NULL UNIQUE REFERENCES public.studio_emissions(id),
  kind text NOT NULL CHECK (kind IN ('cancelamento','substituicao')),
  replaced_by uuid REFERENCES public.studio_emissions(id),
  reason text NOT NULL CHECK (length(reason) BETWEEN 5 AND 500),
  actor_id uuid NOT NULL,
  at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK ((kind = 'substituicao') = (replaced_by IS NOT NULL))
);

GRANT SELECT ON public.studio_template_versions, public.studio_template_events, public.studio_emissions, public.studio_emission_events TO authenticated;
GRANT ALL ON public.studio_template_versions, public.studio_template_events, public.studio_emissions, public.studio_emission_events TO service_role;
ALTER TABLE public.studio_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_template_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_emissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_emission_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.studio_is_admin() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.general_admin_session())
$$;
CREATE OR REPLACE FUNCTION public.studio_can(_what text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT auth.uid() IS NOT NULL AND (public.studio_is_admin() OR public.has_network_capability(
    CASE _what WHEN 'editar' THEN 'manter-modelos-documentais' WHEN 'homologar' THEN 'homologar-modelos-documentais' WHEN 'emitir' THEN 'emitir-documentos-institucionais' ELSE '—' END))
$$;
REVOKE ALL ON FUNCTION public.studio_is_admin(), public.studio_can(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.studio_is_admin(), public.studio_can(text) TO authenticated;

-- Modelos: qualquer conta autenticada lê (são modelos, sem dado pessoal). Emissões: o emissor ou Admin.
CREATE POLICY "studio versions read" ON public.studio_template_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "studio events read" ON public.studio_template_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "studio emissions own or admin" ON public.studio_emissions FOR SELECT TO authenticated USING (actor_id = auth.uid() OR public.studio_is_admin());
CREATE POLICY "studio emission events own or admin" ON public.studio_emission_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.studio_emissions e WHERE e.id = emission_id AND (e.actor_id = auth.uid() OR public.studio_is_admin())));

CREATE OR REPLACE FUNCTION public.studio_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path TO '' AS $$
BEGIN RAISE EXCEPTION 'studio:append-only'; END $$;
CREATE TRIGGER t_append_only BEFORE UPDATE OR DELETE ON public.studio_template_versions FOR EACH ROW EXECUTE FUNCTION public.studio_append_only();
CREATE TRIGGER t_append_only BEFORE UPDATE OR DELETE ON public.studio_template_events FOR EACH ROW EXECUTE FUNCTION public.studio_append_only();
CREATE TRIGGER t_append_only BEFORE UPDATE OR DELETE ON public.studio_emissions FOR EACH ROW EXECUTE FUNCTION public.studio_append_only();
CREATE TRIGGER t_append_only BEFORE UPDATE OR DELETE ON public.studio_emission_events FOR EACH ROW EXECUTE FUNCTION public.studio_append_only();

-- Estado vigente = último evento aplicável; homologar a sucessora torna a anterior "substituido".
CREATE OR REPLACE FUNCTION public.studio_version_state(_v uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO '' AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.studio_template_events e WHERE e.version_id = _v AND e.kind = 'arquivar') THEN 'arquivado'
    WHEN EXISTS (SELECT 1 FROM public.studio_template_events e WHERE e.version_id = _v AND e.kind = 'homologar') THEN
      CASE WHEN EXISTS (SELECT 1 FROM public.studio_template_versions n JOIN public.studio_template_events h ON h.version_id = n.id AND h.kind = 'homologar'
                        JOIN public.studio_template_versions me ON me.id = _v
                        WHERE n.template_id = me.template_id AND n.version_no > me.version_no) THEN 'substituido' ELSE 'homologado' END
    ELSE coalesce((SELECT CASE e.kind WHEN 'enviar-revisao' THEN 'em-revisao' ELSE 'rascunho' END FROM public.studio_template_events e
                   WHERE e.version_id = _v AND e.kind IN ('enviar-revisao','devolver') ORDER BY e.at DESC LIMIT 1), 'rascunho')
  END
$$;
REVOKE ALL ON FUNCTION public.studio_version_state(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.studio_version_state(uuid) TO authenticated;

-- Nova versão: sempre nova linha; base esperada = última versão (concorrência otimista). Homologado nunca é editado no lugar.
CREATE OR REPLACE FUNCTION public.studio_save_version(_template_id text, _expected_version integer, _sector text, _title text, _blocks jsonb, _page jsonb, _base_template_id text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE last record; nid uuid;
BEGIN
  IF NOT public.studio_can('editar') THEN RAISE EXCEPTION 'studio:capability-missing'; END IF;
  IF _blocks::text ~* '<\s*(script|iframe|style|object|embed)|javascript:|on[a-z]+\s*=' THEN RAISE EXCEPTION 'studio:markup-rejected'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('studio:' || _template_id));
  SELECT id, version_no INTO last FROM public.studio_template_versions WHERE template_id = _template_id ORDER BY version_no DESC LIMIT 1;
  IF coalesce(last.version_no, 0) <> coalesce(_expected_version, 0) THEN RAISE EXCEPTION 'studio:stale-version'; END IF;
  INSERT INTO public.studio_template_versions(template_id, version_no, supersedes_id, sector, title, blocks, page, base_template_id, content_sha256, author_id)
  VALUES (_template_id, coalesce(last.version_no, 0) + 1, last.id, _sector, _title, _blocks, _page, _base_template_id,
          encode(sha256(convert_to(jsonb_build_object('title', _title, 'blocks', _blocks, 'page', _page)::text, 'UTF8')), 'hex'), auth.uid())
  RETURNING id INTO nid;
  RETURN nid;
END $$;

CREATE OR REPLACE FUNCTION public.studio_transition(_version uuid, _kind text, _note text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE st text; v record;
BEGIN
  SELECT * INTO v FROM public.studio_template_versions WHERE id = _version;
  IF v.id IS NULL THEN RAISE EXCEPTION 'studio:not-found'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('studio:' || v.template_id));
  IF _kind = 'homologar' THEN IF NOT public.studio_can('homologar') THEN RAISE EXCEPTION 'studio:capability-missing'; END IF;
  ELSIF NOT public.studio_can('editar') THEN RAISE EXCEPTION 'studio:capability-missing'; END IF;
  st := public.studio_version_state(_version);
  IF NOT ((_kind = 'enviar-revisao' AND st = 'rascunho') OR (_kind = 'devolver' AND st = 'em-revisao')
       OR (_kind = 'homologar' AND st = 'em-revisao') OR (_kind = 'arquivar' AND st IN ('rascunho','em-revisao','homologado','substituido'))) THEN
    RAISE EXCEPTION 'studio:invalid-transition:%', st;
  END IF;
  IF _kind = 'homologar' AND EXISTS (SELECT 1 FROM public.studio_template_versions n WHERE n.template_id = v.template_id AND n.version_no > v.version_no
       AND EXISTS (SELECT 1 FROM public.studio_template_events h WHERE h.version_id = n.id AND h.kind = 'homologar')) THEN
    RAISE EXCEPTION 'studio:newer-homologated';
  END IF;
  INSERT INTO public.studio_template_events(version_id, kind, actor_id, note) VALUES (_version, _kind, auth.uid(), nullif(btrim(_note), ''));
  RETURN public.studio_version_state(_version);
END $$;

-- Emissão: só de versão homologada vigente; congela modelo + fatos resolvidos + hash; código opaco aleatório de 80 bits.
CREATE OR REPLACE FUNCTION public.studio_emit(_version uuid, _facts jsonb, _school_id text DEFAULT NULL)
RETURNS TABLE(emission_id uuid, verification_code text, snapshot_sha256 text) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE v record; snap jsonb; code text; h text; nid uuid;
BEGIN
  IF NOT public.studio_can('emitir') THEN RAISE EXCEPTION 'studio:capability-missing'; END IF;
  SELECT * INTO v FROM public.studio_template_versions WHERE id = _version;
  IF v.id IS NULL OR public.studio_version_state(_version) <> 'homologado' THEN RAISE EXCEPTION 'studio:not-homologated'; END IF;
  IF jsonb_typeof(coalesce(_facts, '{}'::jsonb)) <> 'object' OR pg_column_size(_facts) > 200000 THEN RAISE EXCEPTION 'studio:facts-invalid'; END IF;
  snap := jsonb_build_object('template_id', v.template_id, 'version_id', v.id, 'version_no', v.version_no, 'title', v.title,
                             'blocks', v.blocks, 'page', v.page, 'facts', coalesce(_facts, '{}'::jsonb), 'content_sha256', v.content_sha256);
  h := encode(sha256(convert_to(snap::text, 'UTF8')), 'hex');
  code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10) || substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  INSERT INTO public.studio_emissions(verification_code, template_version_id, school_id, title, issuer_label, snapshot, snapshot_sha256, actor_id)
  VALUES (code, v.id, _school_id, v.title, 'Secretaria Municipal de Educação de Itaperuna', snap, h, auth.uid()) RETURNING id INTO nid;
  RETURN QUERY SELECT nid, code, h;
END $$;

CREATE OR REPLACE FUNCTION public.studio_void_emission(_emission uuid, _kind text, _reason text, _replaced_by uuid DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $$
DECLARE e record;
BEGIN
  SELECT * INTO e FROM public.studio_emissions WHERE id = _emission;
  IF e.id IS NULL OR NOT (public.studio_is_admin() OR (e.actor_id = auth.uid() AND public.studio_can('emitir'))) THEN RAISE EXCEPTION 'studio:capability-missing'; END IF;
  IF _kind = 'substituicao' AND (_replaced_by IS NULL OR _replaced_by = _emission OR NOT EXISTS (SELECT 1 FROM public.studio_emissions r WHERE r.id = _replaced_by AND r.issued_at >= e.issued_at)) THEN
    RAISE EXCEPTION 'studio:replacement-invalid';
  END IF;
  INSERT INTO public.studio_emission_events(emission_id, kind, replaced_by, reason, actor_id) VALUES (_emission, _kind, _replaced_by, btrim(_reason), auth.uid());
END $$;

-- Verificação pública mínima: mesma resposta para formato inválido e inexistente (sem enumeração); nenhum fato pessoal.
CREATE OR REPLACE FUNCTION public.verify_studio_document(_code text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO '' AS $$
DECLARE e record; x record;
BEGIN
  IF _code IS NULL OR upper(btrim(_code)) !~ '^[0-9A-F]{20}$' THEN RETURN jsonb_build_object('status', 'nao-encontrado'); END IF;
  SELECT * INTO e FROM public.studio_emissions WHERE verification_code = upper(btrim(_code));
  IF e.id IS NULL THEN RETURN jsonb_build_object('status', 'nao-encontrado'); END IF;
  SELECT * INTO x FROM public.studio_emission_events WHERE emission_id = e.id;
  RETURN jsonb_build_object('status', CASE x.kind WHEN 'cancelamento' THEN 'cancelado' WHEN 'substituicao' THEN 'substituido' ELSE 'valido' END,
    'title', e.title, 'issuer', e.issuer_label, 'issued_at', e.issued_at, 'version_no', (e.snapshot->>'version_no')::int,
    'snapshot_sha256', e.snapshot_sha256);
END $$;

REVOKE ALL ON FUNCTION public.studio_save_version(text, integer, text, text, jsonb, jsonb, text), public.studio_transition(uuid, text, text),
  public.studio_emit(uuid, jsonb, text), public.studio_void_emission(uuid, text, text, uuid), public.verify_studio_document(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.studio_save_version(text, integer, text, text, jsonb, jsonb, text), public.studio_transition(uuid, text, text),
  public.studio_emit(uuid, jsonb, text), public.studio_void_emission(uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_studio_document(text) TO anon, authenticated;