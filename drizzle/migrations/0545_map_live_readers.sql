-- Mapa vivo: leitores minimizados por escola, só para quem consulta o Mapa da escola.
CREATE OR REPLACE FUNCTION public.map_live_classes(_school text, _on date)
RETURNS TABLE(class_id text, class_name text, stage_label text, shift_label text, students integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ok AS (SELECT public.has_school_capability('consultar-mapa-estatistico', _school) AS v),
  cls AS (
    SELECT c.id, c.stage_label_snapshot FROM institutional_classes c, ok
    WHERE ok.v AND c.school_id = _school AND c.valid_from <= _on AND (c.valid_until IS NULL OR c.valid_until >= _on)
  ),
  ep AS (
    SELECT e.class_id, e.student_id FROM class_enrollment_episodes e
    WHERE e.class_id IN (SELECT id FROM cls) AND e.valid_from <= _on
      AND NOT EXISTS (SELECT 1 FROM class_enrollment_episodes w WHERE w.supersedes_id = e.id)
      AND NOT EXISTS (SELECT 1 FROM class_enrollment_episode_endings x WHERE x.episode_id = e.id AND x.ended_on < _on)
  )
  SELECT c.id,
    (SELECT r.name FROM public.class_at(c.id, _on) r ORDER BY r.version DESC LIMIT 1),
    c.stage_label_snapshot,
    (SELECT s.value_label FROM public.class_shift_at(c.id, _on) s ORDER BY s.version DESC LIMIT 1),
    (SELECT count(DISTINCT ep.student_id)::int FROM ep WHERE ep.class_id = c.id)
  FROM cls c;
$$;

CREATE OR REPLACE FUNCTION public.map_live_movements(_school text, _from date, _to date)
RETURNS TABLE(grp text, student_name text, census_id text, kind text, happened_on date, class_label text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ok AS (SELECT public.has_school_capability('consultar-mapa-estatistico', _school) AS v),
  nm AS (
    SELECT DISTINCT ON (i.student_id) i.student_id, coalesce(nullif(i.social_name,''), i.civil_name) AS name
    FROM student_identity_versions i ORDER BY i.student_id, i.version DESC
  ),
  cid AS (
    SELECT sp.student_id, min(pi.value) AS v FROM institutional_student_persons sp
    JOIN institutional_person_identifiers pi ON pi.person_id = sp.person_id AND pi.identifier_kind = 'inep-pessoa'
    GROUP BY sp.student_id
  ),
  rows AS (
    SELECT 'A'::text g, se.student_id, 'Novo'::text k, se.opened_on d, NULL::text cl
    FROM school_enrollments se, ok WHERE ok.v AND se.school_id = _school AND se.opened_on BETWEEN _from AND _to
      AND NOT EXISTS (SELECT 1 FROM school_enrollments w WHERE w.supersedes_id = se.id)
    UNION ALL
    SELECT CASE WHEN x.reason_label ILIKE 'transfer%' THEN 'B' WHEN x.reason_label ILIKE ANY (ARRAY['%abandono%','%evas%']) THEN 'C'
                WHEN x.reason_label ILIKE 'remanej%' THEN 'R' ELSE 'D' END,
      e.student_id, x.reason_label, x.ended_on, e.class_label_snapshot
    FROM class_enrollment_episode_endings x JOIN class_enrollment_episodes e ON e.id = x.episode_id, ok
    WHERE ok.v AND e.school_id = _school AND x.ended_on BETWEEN _from AND _to
      AND x.reason_label NOT ILIKE 'movida para%'
  )
  SELECT r.g, nm.name, cid.v, r.k, r.d, r.cl FROM rows r
  LEFT JOIN nm ON nm.student_id = r.student_id LEFT JOIN cid ON cid.student_id = r.student_id
  ORDER BY r.g, nm.name;
$$;

CREATE OR REPLACE FUNCTION public.map_live_staff(_school text, _on date)
RETURNS TABLE(source text, person_key text, full_name text, registration text, cargo text, funcao text, grupo text, situacao text, classes text, observacao text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ok AS (SELECT public.has_school_capability('consultar-mapa-estatistico', _school) AS v),
  reg AS (
    SELECT DISTINCT ON (l.person_id, l.registration_norm) l.person_id, l.registration_norm, l.action
    FROM payroll_registration_person_links l ORDER BY l.person_id, l.registration_norm, l.seq DESC
  ),
  regs AS (
    SELECT r.person_id, string_agg(DISTINCT r.registration_norm || coalesce(' / QP ' || nullif(f.qpmec_number,''), ''), '; ') AS reg,
           string_agg(DISTINCT f.cargo_label, '; ') AS cargo
    FROM reg r LEFT JOIN payroll_functional_registrations f ON f.registration_norm = r.registration_norm
    WHERE r.action <> 'unlink' GROUP BY r.person_id
  ),
  pid AS (SELECT person_id, min(value) v FROM institutional_person_identifiers WHERE identifier_kind = 'id-profissional' GROUP BY person_id),
  teach AS (
    SELECT e.person_id, string_agg(DISTINCT coalesce(cr.name, c.code, c.name), ', ') AS classes,
           string_agg(DISTINCT c.stage_label_snapshot, ', ') AS stages
    FROM institutional_engagements e JOIN institutional_classes c ON c.id = e.class_id
    LEFT JOIN LATERAL (SELECT r.name FROM public.class_at(c.id, _on) r ORDER BY r.version DESC LIMIT 1) cr ON true, ok
    WHERE ok.v AND e.engagement_kind_id = 'professor' AND c.school_id = _school
      AND e.valid_from <= _on AND (e.valid_until IS NULL OR e.valid_until >= _on)
    GROUP BY e.person_id
  )
  SELECT 'atuacao', t.person_id::text, p.display_name, coalesce(regs.reg, pid.v), regs.cargo, 'Professor regente', t.stages, 'Em atividade', t.classes, NULL
  FROM teach t JOIN institutional_persons p ON p.id = t.person_id
  LEFT JOIN regs ON regs.person_id = t.person_id LEFT JOIN pid ON pid.person_id = t.person_id
  UNION ALL
  SELECT 'quadro-2026', 'q:' || s.id::text, s.full_name, s.registration, s.cargo, s.funcao, s.grupo, s.situacao, NULL, s.observacao
  FROM staff_administrative_records s, ok
  WHERE ok.v AND s.school_id = _school AND s.source_kind = 'servidores-por-escola' AND extract(year FROM _on) = 2026;
$$;

REVOKE ALL ON FUNCTION public.map_live_classes(text, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.map_live_movements(text, date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.map_live_staff(text, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.map_live_classes(text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.map_live_movements(text, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.map_live_staff(text, date) TO authenticated;