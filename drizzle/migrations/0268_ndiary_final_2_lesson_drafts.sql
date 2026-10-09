CREATE TABLE public.lesson_record_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  draft_key uuid NOT NULL,
  seq integer NOT NULL CHECK (seq >= 1),
  payload jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object' AND octet_length(payload::text) <= 200000),
  discarded boolean NOT NULL DEFAULT false,
  author_user_id uuid NOT NULL DEFAULT auth.uid(),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (draft_key, seq)
);
CREATE INDEX lesson_record_drafts_author_idx ON public.lesson_record_drafts (author_user_id, draft_key, seq DESC);
GRANT SELECT, INSERT ON public.lesson_record_drafts TO authenticated;
GRANT ALL ON public.lesson_record_drafts TO service_role;
ALTER TABLE public.lesson_record_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Autor lê o próprio rascunho de aula" ON public.lesson_record_drafts FOR SELECT TO authenticated USING (author_user_id = auth.uid());
CREATE POLICY "Autor grava o próprio rascunho de aula" ON public.lesson_record_drafts FOR INSERT TO authenticated
  WITH CHECK (author_user_id = auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.lesson_record_drafts d WHERE d.draft_key = lesson_record_drafts.draft_key AND d.author_user_id <> auth.uid()));
CREATE OR REPLACE FUNCTION public.lesson_record_drafts_immutable() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN RAISE EXCEPTION 'lesson-draft:append-only'; END $$;
CREATE TRIGGER lesson_record_drafts_immutable BEFORE UPDATE OR DELETE ON public.lesson_record_drafts
  FOR EACH ROW EXECUTE FUNCTION public.lesson_record_drafts_immutable();
COMMENT ON TABLE public.lesson_record_drafts IS 'NDIARY.FINAL.2: rascunho do registro de aula (autosave). Não é registro oficial; oficial só lesson_record_versions.';