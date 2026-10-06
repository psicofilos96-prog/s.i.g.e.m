-- E2E AJ detectou: privilégios padrão concediam DML ao service_role nas tabelas novas de 0170/0172 (o GRANT SELECT
-- não removia o padrão). Automação não grava fatos nem autoria humana: revoga explicitamente.
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['meal_kitchens','meal_kitchen_versions','meal_kitchen_school_links','meal_menu_publications','meal_inventory_movements',
    'school_communications','school_communication_versions','school_communication_acts','school_communication_receipts'] LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM service_role', t);
  END LOOP;
END $$;