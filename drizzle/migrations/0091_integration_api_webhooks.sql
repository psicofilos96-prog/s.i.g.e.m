-- API de integração + webhooks. Tabelas só para service_role (servidor); administração por funções DEFINER com capability.
CREATE TABLE public.integration_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(name) BETWEEN 3 AND 120),
  scopes text[] NOT NULL DEFAULT '{}',
  school_ids text[],            -- null = sem restrição de escola; '{}' = nenhuma escola
  rate_limit_per_minute integer NOT NULL DEFAULT 60 CHECK (rate_limit_per_minute BETWEEN 1 AND 600),
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.integration_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.integration_clients(id),
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by uuid
);
CREATE TABLE public.integration_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.integration_clients(id),
  key_id uuid REFERENCES public.integration_keys(id),
  method text NOT NULL,
  route text NOT NULL,
  status integer NOT NULL,
  error_code text,
  idempotency_key text,
  response_body jsonb,
  request_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX integration_requests_idem ON public.integration_requests (client_id, route, idempotency_key) WHERE idempotency_key IS NOT NULL AND status < 300;
CREATE INDEX integration_requests_rate ON public.integration_requests (client_id, created_at DESC);
CREATE TABLE public.webhook_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.integration_clients(id),
  url text NOT NULL CHECK (url ~ '^https://'),
  events text[] NOT NULL,
  secret text NOT NULL,
  secret_version integer NOT NULL DEFAULT 1,
  active boolean NOT NULL DEFAULT true,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.webhook_subscriptions(id),
  event_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','entregue','falhou','dead-letter')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_http_status integer,
  last_error text,
  replay_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, event_id)
);
CREATE TABLE public.integration_admin_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor uuid NOT NULL,
  action text NOT NULL,
  target_id uuid,
  detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['integration_clients','integration_keys','integration_requests','webhook_subscriptions','webhook_deliveries','integration_admin_events'] LOOP
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP; END $$;

CREATE OR REPLACE FUNCTION public.integration_append_only() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'integration:append-only'; END; $$;
CREATE TRIGGER integration_requests_ao BEFORE UPDATE OR DELETE ON public.integration_requests FOR EACH ROW EXECUTE FUNCTION public.integration_append_only();
CREATE TRIGGER integration_admin_events_ao BEFORE UPDATE OR DELETE ON public.integration_admin_events FOR EACH ROW EXECUTE FUNCTION public.integration_append_only();
REVOKE ALL ON FUNCTION public.integration_append_only() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.integration_require_admin() RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN IF auth.uid() IS NULL OR NOT public.has_network_capability('administrar-integracoes') THEN RAISE EXCEPTION 'integration:capability-missing'; END IF; END; $$;

CREATE OR REPLACE FUNCTION public.integration_random_token() RETURNS text LANGUAGE sql VOLATILE SET search_path = '' AS $$
  SELECT replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
$$;

CREATE OR REPLACE FUNCTION public.integration_create_client(_name text, _scopes text[], _school_ids text[], _rate integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _id uuid; _s text;
BEGIN
  PERFORM public.integration_require_admin();
  FOREACH _s IN ARRAY coalesce(_scopes,'{}') LOOP
    IF _s NOT IN ('escolas:ler','publicacoes:ler','webhooks:ler','webhooks:testar') THEN RAISE EXCEPTION 'integration:unknown-scope %', _s; END IF;
  END LOOP;
  INSERT INTO public.integration_clients(name, scopes, school_ids, rate_limit_per_minute, created_by)
  VALUES (trim(_name), coalesce(_scopes,'{}'), _school_ids, coalesce(_rate,60), auth.uid()) RETURNING id INTO _id;
  INSERT INTO public.integration_admin_events(actor, action, target_id, detail) VALUES (auth.uid(),'client.created',_id, jsonb_build_object('scopes',_scopes,'school_ids',_school_ids));
  RETURN _id;
END; $$;

CREATE OR REPLACE FUNCTION public.integration_set_client_active(_client uuid, _active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.integration_require_admin();
  UPDATE public.integration_clients SET active = _active WHERE id = _client;
  IF NOT FOUND THEN RAISE EXCEPTION 'integration:not-found'; END IF;
  INSERT INTO public.integration_admin_events(actor, action, target_id) VALUES (auth.uid(), CASE WHEN _active THEN 'client.activated' ELSE 'client.deactivated' END, _client);
END; $$;

-- Retorna a chave em texto UMA vez; só o hash fica guardado.
CREATE OR REPLACE FUNCTION public.integration_issue_key(_client uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _plain text; _id uuid;
BEGIN
  PERFORM public.integration_require_admin();
  IF NOT EXISTS (SELECT 1 FROM public.integration_clients WHERE id = _client) THEN RAISE EXCEPTION 'integration:not-found'; END IF;
  _plain := 'sgk_' || public.integration_random_token();
  INSERT INTO public.integration_keys(client_id, key_prefix, key_hash, created_by)
  VALUES (_client, left(_plain, 10), encode(pg_catalog.sha256(convert_to(_plain,'UTF8')),'hex'), auth.uid()) RETURNING id INTO _id;
  INSERT INTO public.integration_admin_events(actor, action, target_id, detail) VALUES (auth.uid(),'key.issued',_id, jsonb_build_object('client',_client));
  RETURN _plain;
END; $$;

CREATE OR REPLACE FUNCTION public.integration_revoke_key(_key uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.integration_require_admin();
  UPDATE public.integration_keys SET revoked_at = now(), revoked_by = auth.uid() WHERE id = _key AND revoked_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'integration:not-found'; END IF;
  INSERT INTO public.integration_admin_events(actor, action, target_id) VALUES (auth.uid(),'key.revoked',_key);
END; $$;

CREATE OR REPLACE FUNCTION public.integration_create_subscription(_client uuid, _url text, _events text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _id uuid; _secret text; _e text;
BEGIN
  PERFORM public.integration_require_admin();
  IF _url !~ '^https://' THEN RAISE EXCEPTION 'integration:url-must-be-https'; END IF;
  IF coalesce(array_length(_events,1),0) = 0 THEN RAISE EXCEPTION 'integration:events-required'; END IF;
  FOREACH _e IN ARRAY _events LOOP
    IF _e NOT IN ('integracao.teste','publicacao.publicada') THEN RAISE EXCEPTION 'integration:unknown-event %', _e; END IF;
  END LOOP;
  _secret := 'whsec_' || public.integration_random_token();
  INSERT INTO public.webhook_subscriptions(client_id, url, events, secret, created_by) VALUES (_client, _url, _events, _secret, auth.uid()) RETURNING id INTO _id;
  INSERT INTO public.integration_admin_events(actor, action, target_id, detail) VALUES (auth.uid(),'subscription.created',_id, jsonb_build_object('events',_events));
  RETURN jsonb_build_object('id',_id,'secret',_secret);
END; $$;

CREATE OR REPLACE FUNCTION public.integration_rotate_secret(_subscription uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _secret text;
BEGIN
  PERFORM public.integration_require_admin();
  _secret := 'whsec_' || public.integration_random_token();
  UPDATE public.webhook_subscriptions SET secret = _secret, secret_version = secret_version + 1 WHERE id = _subscription;
  IF NOT FOUND THEN RAISE EXCEPTION 'integration:not-found'; END IF;
  INSERT INTO public.integration_admin_events(actor, action, target_id) VALUES (auth.uid(),'subscription.secret-rotated',_subscription);
  RETURN _secret;
END; $$;

CREATE OR REPLACE FUNCTION public.integration_replay_delivery(_delivery uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.integration_require_admin();
  UPDATE public.webhook_deliveries SET status = 'pendente', next_attempt_at = now(), attempts = 0, replay_count = replay_count + 1, updated_at = now()
   WHERE id = _delivery AND status IN ('falhou','dead-letter','entregue');
  IF NOT FOUND THEN RAISE EXCEPTION 'integration:not-replayable'; END IF;
  INSERT INTO public.integration_admin_events(actor, action, target_id) VALUES (auth.uid(),'delivery.replayed',_delivery);
END; $$;

-- Visão administrativa: nunca devolve hash nem segredo inteiro.
CREATE OR REPLACE FUNCTION public.integration_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.integration_require_admin();
  RETURN jsonb_build_object(
    'clients', coalesce((SELECT jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'scopes',c.scopes,'school_ids',c.school_ids,'rate',c.rate_limit_per_minute,'active',c.active,'created_at',c.created_at) ORDER BY c.created_at) FROM public.integration_clients c),'[]'),
    'keys', coalesce((SELECT jsonb_agg(jsonb_build_object('id',k.id,'client_id',k.client_id,'prefix',k.key_prefix,'created_at',k.created_at,'revoked_at',k.revoked_at) ORDER BY k.created_at) FROM public.integration_keys k),'[]'),
    'subscriptions', coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'client_id',s.client_id,'url',s.url,'events',s.events,'secret_hint','…'||right(s.secret,4),'secret_version',s.secret_version,'active',s.active) ORDER BY s.created_at) FROM public.webhook_subscriptions s),'[]'),
    'deliveries', coalesce((SELECT jsonb_agg(x) FROM (SELECT jsonb_build_object('id',d.id,'subscription_id',d.subscription_id,'event_type',d.event_type,'event_id',d.event_id,'status',d.status,'attempts',d.attempts,'last_http_status',d.last_http_status,'last_error',d.last_error,'replay_count',d.replay_count,'updated_at',d.updated_at) x FROM public.webhook_deliveries d ORDER BY d.updated_at DESC LIMIT 100) q),'[]'),
    'requests', coalesce((SELECT jsonb_agg(x) FROM (SELECT jsonb_build_object('client_id',r.client_id,'method',r.method,'route',r.route,'status',r.status,'error_code',r.error_code,'request_id',r.request_id,'created_at',r.created_at) x FROM public.integration_requests r ORDER BY r.created_at DESC LIMIT 100) q),'[]')
  );
END; $$;

DO $$ DECLARE f text; BEGIN
  FOREACH f IN ARRAY ARRAY['integration_require_admin()','integration_random_token()','integration_create_client(text,text[],text[],integer)','integration_set_client_active(uuid,boolean)','integration_issue_key(uuid)','integration_revoke_key(uuid)','integration_create_subscription(uuid,text,text[])','integration_rotate_secret(uuid)','integration_replay_delivery(uuid)','integration_overview()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
  END LOOP; END $$;
REVOKE ALL ON FUNCTION public.integration_random_token() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.integration_create_client(text,text[],text[],integer), public.integration_set_client_active(uuid,boolean), public.integration_issue_key(uuid), public.integration_revoke_key(uuid), public.integration_create_subscription(uuid,text,text[]), public.integration_rotate_secret(uuid), public.integration_replay_delivery(uuid), public.integration_overview() TO authenticated;