-- SIGEM Permanência L24: prova estrutural de RLS/privilégios. Bloco termina em RAISE; nada persiste.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['aa_outreach_cases','aa_outreach_events','permanence_rule_versions','permanence_rule_approvals',
    'permanence_alerts','permanence_alert_events','permanence_case_numbers','permanence_case_priorities','permanence_case_priority_events',
    'permanence_out_of_school_signals','permanence_out_of_school_events','permanence_barrier_types','permanence_case_barriers',
    'permanence_contact_attempts','permanence_visits','permanence_plan_versions','permanence_plan_reviews',
    'permanence_referral_destinations','permanence_referrals','permanence_referral_events','permanence_returns'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || t)::regclass) THEN RAISE EXCEPTION 'RLS off: %', t; END IF;
    IF has_table_privilege('anon', 'public.' || t, 'SELECT') THEN RAISE EXCEPTION 'anon lê %', t; END IF;
    IF has_table_privilege('authenticated', 'public.' || t, 'INSERT') OR has_table_privilege('authenticated', 'public.' || t, 'UPDATE')
       OR has_table_privilege('authenticated', 'public.' || t, 'DELETE') THEN RAISE EXCEPTION 'DML direto em %', t; END IF;
  END LOOP;
  RAISE EXCEPTION 'perm24-ok';
END $$;
