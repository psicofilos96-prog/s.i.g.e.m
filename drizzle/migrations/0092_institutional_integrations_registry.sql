-- Central de integrações institucionais: configuração versionada (append-only) e execuções minimizadas.
-- Segredo nunca é guardado: só o NOME da variável de ambiente que o contém.
CREATE TABLE public.institutional_integration_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_key text NOT NULL CHECK (integration_key ~ '^[a-z0-9][a-z0-9-]{2,62}$'),
  version integer NOT NULL CHECK (version >= 1),
  slot text NOT NULL CHECK (slot ~ '^[a-z0-9-]{2,40}$'),
  provider text NOT NULL CHECK (provider ~ '^[a-z0-9][a-z0-9-]{1,40}$'),
  state text NOT NULL CHECK (state IN ('inativa','ativa')),
  config jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(config) = 'object'),
  secret_ref text CHECK (secret_ref IS NULL OR secret_ref ~ '^[A-Z][A-Z0-9_]{2,63}$'),
  mapping jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(mapping) = 'array'),
  reason text NOT NULL CHECK (length(trim(reason)) >= 3),
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (integration_key, version)
);
CREATE TABLE public.institutional_integration_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_key text NOT NULL,
  config_version integer,
  kind text NOT NULL CHECK (kind IN ('health','dry-run','sync')),
  outcome text NOT NULL CHECK (outcome IN ('ok','falha','recusado')),
  code text NOT NULL,
  attempts integer NOT NULL DEFAULT 1,
  run_by uuid,
  ran_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.institutional_integration_versions, public.institutional_integration_runs TO service_role;
REVOKE ALL ON public.institutional_integration_versions, public.institutional_integration_runs FROM PUBLIC, anon, authenticated;
ALTER TABLE public.institutional_integration_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutional_integration_runs ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER institutional_integration_versions_ao BEFORE UPDATE OR DELETE ON public.institutional_integration_versions FOR EACH ROW EXECUTE FUNCTION public.integration_append_only();
CREATE TRIGGER institutional_integration_runs_ao BEFORE UPDATE OR DELETE ON public.institutional_integration_runs FOR EACH ROW EXECUTE FUNCTION public.integration_append_only();

-- Writer único, com base esperada (concorrência otimista).
CREATE OR REPLACE FUNCTION public.record_institutional_integration_version(
  _key text, _expected_version integer, _slot text, _provider text, _state text, _config jsonb, _secret_ref text, _mapping jsonb, _reason text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _head integer;
BEGIN
  PERFORM public.integration_require_admin();
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('inst-integration:' || _key));
  SELECT max(version) INTO _head FROM public.institutional_integration_versions WHERE integration_key = _key;
  IF _head IS DISTINCT FROM _expected_version THEN RAISE EXCEPTION 'integration:stale-version'; END IF;
  IF _config::text ~* '"[^"]*(secret|senha|password|token|api[_-]?key|private)[^"]*"\s*:' THEN RAISE EXCEPTION 'integration:secret-in-config'; END IF;
  INSERT INTO public.institutional_integration_versions(integration_key, version, slot, provider, state, config, secret_ref, mapping, reason, recorded_by)
  VALUES (_key, coalesce(_head,0) + 1, _slot, _provider, _state, coalesce(_config,'{}'), nullif(_secret_ref,''), coalesce(_mapping,'[]'), _reason, auth.uid());
  INSERT INTO public.integration_admin_events(actor, action, detail) VALUES (auth.uid(), 'institutional-integration.version', jsonb_build_object('key',_key,'version',coalesce(_head,0)+1,'state',_state));
  RETURN coalesce(_head,0) + 1;
END; $$;

CREATE OR REPLACE FUNCTION public.institutional_integrations_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.integration_require_admin();
  RETURN jsonb_build_object(
    'versions', coalesce((SELECT jsonb_agg(jsonb_build_object('key',v.integration_key,'version',v.version,'slot',v.slot,'provider',v.provider,'state',v.state,'config',v.config,'secret_ref',v.secret_ref,'mapping',v.mapping,'reason',v.reason,'recorded_at',v.recorded_at) ORDER BY v.integration_key, v.version) FROM public.institutional_integration_versions v),'[]'),
    'runs', coalesce((SELECT jsonb_agg(x) FROM (SELECT jsonb_build_object('key',r.integration_key,'config_version',r.config_version,'kind',r.kind,'outcome',r.outcome,'code',r.code,'attempts',r.attempts,'ran_at',r.ran_at) x FROM public.institutional_integration_runs r ORDER BY r.ran_at DESC LIMIT 200) q),'[]'));
END; $$;

REVOKE ALL ON FUNCTION public.record_institutional_integration_version(text,integer,text,text,text,jsonb,text,jsonb,text), public.institutional_integrations_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_institutional_integration_version(text,integer,text,text,text,jsonb,text,jsonb,text), public.institutional_integrations_overview() TO authenticated;