-- Read-only regression for owner-authorized restoration on 2026-10-23.
-- A failed assertion raises division by zero; no identities or approvals are written.
SELECT 1 / CASE WHEN (
  SELECT count(*) FROM public.curricular_components_at(DATE '2027-03-03')
  WHERE version = 0 AND component_id IN (
    'comp-lingua-portuguesa', 'comp-matematica', 'comp-ciencias',
    'comp-historia', 'comp-geografia', 'comp-arte',
    'comp-educacao-fisica', 'comp-ensino-religioso', 'comp-lingua-inglesa'
  )
) = 9 THEN 1 ELSE 0 END AS nine_authorized_defaults;
SELECT 1 / CASE WHEN NOT has_table_privilege('anon', 'public.curricular_component_system_defaults', 'SELECT')
  AND NOT has_table_privilege('authenticated', 'public.curricular_component_system_defaults', 'INSERT')
  THEN 1 ELSE 0 END AS access_unchanged;
SELECT 1 / CASE WHEN (SELECT count(*) FROM public.institutional_curricular_components) = 10
  AND EXISTS (SELECT 1 FROM public.institutional_curricular_components WHERE id = 'comp-educacao-financeira')
  THEN 1 ELSE 0 END AS preserved_catalog;