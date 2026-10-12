-- DEV L24: fecha lacuna encontrada pela prova — tabelas L21/L22 sem trigger append-only.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['dev_role_track_targets','dev_role_track_target_withdrawals','dev_partners','dev_partner_versions','dev_partner_approvals','dev_partner_course_links'] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.doc_numbering_append_only()', t || '_immutable', t);
  END LOOP;
END $$;