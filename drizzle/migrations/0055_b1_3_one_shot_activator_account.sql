-- B1.3: the initial administrator account may be prepared only once, even if
-- the Auth user is later removed. The immutable origin is the durable marker.
CREATE UNIQUE INDEX sigem_activator_account_origins_one_shot
  ON public.sigem_activator_account_origins ((true));

-- Serialize the origin record with activation and designation changes. A
-- delayed server request cannot finish creating the account after activation.
CREATE FUNCTION public.sigem_activator_account_origin_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _state text; _current record; _supervisor text; _requester record;
BEGIN
  SELECT state INTO _state FROM public.sigem_installation_state WHERE singleton FOR UPDATE;
  IF _state IS DISTINCT FROM 'nao-instalado' THEN
    RAISE EXCEPTION 'activator-account:already-activated';
  END IF;
  SELECT version, installer_email INTO _current
  FROM public.sigem_installer_designation_versions ORDER BY version DESC LIMIT 1;
  IF _current.version IS NULL OR NEW.designation_version IS DISTINCT FROM _current.version
     OR lower(NEW.login) IS DISTINCT FROM lower(_current.installer_email) THEN
    RAISE EXCEPTION 'activator-account:designation-changed';
  END IF;
  SELECT installer_email INTO _supervisor
  FROM public.sigem_installer_designation_versions ORDER BY version ASC LIMIT 1;
  SELECT email, email_confirmed_at INTO _requester
  FROM auth.users WHERE id = NEW.requested_by_user_id;
  IF _requester.email_confirmed_at IS NULL
     OR lower(_requester.email) IS DISTINCT FROM lower(_supervisor) THEN
    RAISE EXCEPTION 'activator-account:requester-not-authorized';
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.sigem_activator_account_origin_guard() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER activator_account_origin_guard
  BEFORE INSERT ON public.sigem_activator_account_origins
  FOR EACH ROW EXECUTE FUNCTION public.sigem_activator_account_origin_guard();
