-- B1/B4.6.7g: natureza do ator institucional. Decisão do usuário (2026-10-04): a conta
-- supervisao@sigem.itap.gov.br representa a SUPERVISÃO ESCOLAR como órgão, sem pessoa natural.
ALTER TABLE public.institutional_persons ADD COLUMN actor_nature text NOT NULL DEFAULT 'pessoa-natural';
ALTER TABLE public.institutional_persons ADD CONSTRAINT institutional_persons_actor_nature_chk
  CHECK (actor_nature IN ('pessoa-natural','orgao-institucional'));
COMMENT ON COLUMN public.institutional_persons.actor_nature IS
  'pessoa-natural: indivíduo; orgao-institucional: identidade funcional de órgão/setor (display_name é o nome do órgão). Nunca concede capacidade.';

CREATE TABLE public.institutional_actor_nature_origins (
  person_id uuid PRIMARY KEY REFERENCES public.institutional_persons(id),
  actor_nature text NOT NULL CHECK (actor_nature IN ('pessoa-natural','orgao-institucional')),
  origin text NOT NULL,
  recorded_by uuid NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.institutional_actor_nature_origins TO service_role;
ALTER TABLE public.institutional_actor_nature_origins ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER institutional_actor_nature_origins_immutable BEFORE UPDATE OR DELETE ON public.institutional_actor_nature_origins
  FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

CREATE OR REPLACE FUNCTION public.install_sigem_reviewed(_act_ref text, _actor_nature text, _person_name text, _person_identifier text,
  _engagement_kind_id text, _position_label text, _policy_id uuid, _expected_fingerprint text, _confirm_all_rules_reviewed boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE _act uuid; _person uuid; _preexisting boolean;
BEGIN
  IF _actor_nature IS NULL OR _actor_nature NOT IN ('pessoa-natural','orgao-institucional') THEN
    RAISE EXCEPTION 'install:actor-nature-required'; END IF;
  _preexisting := EXISTS (SELECT 1 FROM public.user_person_links WHERE user_id = auth.uid());
  _act := public.install_sigem_reviewed(_act_ref, _person_name, _person_identifier, _engagement_kind_id,
    _position_label, _policy_id, _expected_fingerprint, _confirm_all_rules_reviewed);
  SELECT person_id INTO _person FROM public.sigem_installation_acts WHERE id = _act;
  IF NOT _preexisting THEN
    UPDATE public.institutional_persons SET actor_nature = _actor_nature WHERE id = _person;
    INSERT INTO public.institutional_actor_nature_origins(person_id, actor_nature, origin, recorded_by)
    VALUES (_person, _actor_nature, 'declarada no ato de instalação: ' || btrim(_act_ref), auth.uid());
  ELSIF (SELECT actor_nature FROM public.institutional_persons WHERE id = _person) IS DISTINCT FROM _actor_nature THEN
    RAISE EXCEPTION 'install:actor-nature-divergent';
  END IF;
  RETURN _act;
END $$;
REVOKE ALL ON FUNCTION public.install_sigem_reviewed(text,text,text,text,text,text,uuid,text,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.install_sigem_reviewed(text,text,text,text,text,text,uuid,text,boolean) TO authenticated;
-- A assinatura sem natureza deixa de ser porta pública (continua chamada internamente pelo dono).
REVOKE ALL ON FUNCTION public.install_sigem_reviewed(text,text,text,text,text,uuid,text,boolean) FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.install_sigem_reviewed(text,text,text,text,text,uuid,text,boolean) IS 'DEPRECATED como porta: use a assinatura com _actor_nature (B4.6.7g); sem EXECUTE para authenticated.';