BEGIN;

DO $$
BEGIN
  IF NOT has_function_privilege(
    'authenticated',
    'public.delete_school_institutional_followup_record(text,uuid,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'followup-delete-test:authenticated-rpc-not-granted';
  END IF;
  IF has_table_privilege('authenticated', 'public.school_institutional_followup_deletion_audit', 'SELECT')
    OR has_table_privilege('authenticated', 'public.school_institutional_followup_deletion_audit', 'INSERT')
    OR has_table_privilege('authenticated', 'public.school_institutional_followup_deletion_audit', 'DELETE')
  THEN
    RAISE EXCEPTION 'followup-delete-test:audit-table-exposed';
  END IF;
  IF has_table_privilege('authenticated', 'public.school_institutional_followup_visits', 'DELETE')
    OR has_table_privilege('authenticated', 'public.school_institutional_followup_actions', 'DELETE')
    OR has_table_privilege('authenticated', 'public.school_institutional_followup_updates', 'DELETE')
  THEN
    RAISE EXCEPTION 'followup-delete-test:direct-delete-exposed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.school_institutional_followup_visits'::regclass
      AND tgname = 'followup_visit_immutable' AND NOT tgisinternal AND tgenabled <> 'D'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.school_institutional_followup_actions'::regclass
      AND tgname = 'followup_action_immutable' AND NOT tgisinternal AND tgenabled <> 'D'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.school_institutional_followup_updates'::regclass
      AND tgname = 'followup_update_immutable' AND NOT tgisinternal AND tgenabled <> 'D'
  ) THEN
    RAISE EXCEPTION 'followup-delete-test:immutable-trigger-missing';
  END IF;
END $$;

ROLLBACK;
