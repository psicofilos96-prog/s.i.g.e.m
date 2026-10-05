-- R5.1 — invariantes de sobreposição por janela efetiva.
-- Append-only após 0059. Não altera política v4, não homologa nada e não grava dados curriculares.
-- Os writers da 0059 mantêm seus checks rápidos; estes triggers fecham o caso histórico em que
-- uma identidade já possui sucessão futura e a versão anterior ainda é efetiva no intervalo testado.

CREATE FUNCTION public.guard_r5_profile_effective_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $fn$
BEGIN
  IF EXISTS (
    WITH eff AS (
      SELECT v.*
      FROM public.curricular_correspondence_profile_versions v
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.curricular_correspondence_profile_versions r
        WHERE r.supersedes_id = v.id
          AND r.change_kind = 'retificacao'
      )
    ),
    win AS (
      SELECT e.*,
        LEAST(
          e.valid_until,
          (
            SELECT min(e2.valid_from) - 1
            FROM eff e2
            WHERE e2.profile_id = e.profile_id
              AND e2.version > e.version
          )
        ) AS effective_until
      FROM eff e
    )
    SELECT 1
    FROM win a
    JOIN win b
      ON a.profile_id < b.profile_id
     AND a.valid_from <= coalesce(b.effective_until, 'infinity'::date)
     AND b.valid_from <= coalesce(a.effective_until, 'infinity'::date)
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'profile:overlaps-other-profile';
  END IF;
  RETURN NEW;
END $fn$;

CREATE FUNCTION public.guard_r5_correspondence_effective_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $fn$
BEGIN
  IF EXISTS (
    WITH eff AS (
      SELECT v.*
      FROM public.curricular_position_matrix_correspondence_versions v
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.curricular_position_matrix_correspondence_versions r
        WHERE r.supersedes_id = v.id
          AND r.change_kind = 'retificacao'
      )
    ),
    win AS (
      SELECT e.*,
        LEAST(
          e.valid_until,
          (
            SELECT min(e2.valid_from) - 1
            FROM eff e2
            WHERE e2.correspondence_id = e.correspondence_id
              AND e2.version > e.version
          )
        ) AS effective_until
      FROM eff e
    ),
    keyed AS (
      SELECT
        c.id AS correspondence_id,
        c.profile_id,
        w.valid_from,
        w.effective_until,
        (
          SELECT pg_catalog.jsonb_agg(
            pg_catalog.jsonb_build_array(k.scheme_id, k.value_id, k.value_version)
            ORDER BY k.scheme_id
          )
          FROM public.curricular_position_matrix_correspondence_keys k
          WHERE k.correspondence_version_id = w.id
        ) AS key_signature
      FROM win w
      JOIN public.curricular_position_matrix_correspondences c
        ON c.id = w.correspondence_id
    )
    SELECT 1
    FROM keyed a
    JOIN keyed b
      ON a.profile_id = b.profile_id
     AND a.correspondence_id < b.correspondence_id
     AND a.key_signature IS NOT NULL
     AND a.key_signature = b.key_signature
     AND a.valid_from <= coalesce(b.effective_until, 'infinity'::date)
     AND b.valid_from <= coalesce(a.effective_until, 'infinity'::date)
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'correspondence:overlap';
  END IF;
  RETURN NULL;
END $fn$;

CREATE FUNCTION public.guard_r5_association_effective_overlap()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $fn$
BEGIN
  IF EXISTS (
    WITH eff AS (
      SELECT v.*
      FROM public.class_specific_matrix_association_versions v
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.class_specific_matrix_association_versions r
        WHERE r.supersedes_id = v.id
          AND r.change_kind = 'retificacao'
      )
    ),
    win AS (
      SELECT e.*,
        LEAST(
          e.valid_until,
          (
            SELECT min(e2.valid_from) - 1
            FROM eff e2
            WHERE e2.association_id = e.association_id
              AND e2.version > e.version
          )
        ) AS effective_until
      FROM eff e
    ),
    scoped AS (
      SELECT a.id AS association_id, a.class_id, w.valid_from, w.effective_until
      FROM win w
      JOIN public.class_specific_matrix_associations a
        ON a.id = w.association_id
    )
    SELECT 1
    FROM scoped a
    JOIN scoped b
      ON a.class_id = b.class_id
     AND a.association_id < b.association_id
     AND a.valid_from <= coalesce(b.effective_until, 'infinity'::date)
     AND b.valid_from <= coalesce(a.effective_until, 'infinity'::date)
    LIMIT 1
  ) THEN
    RAISE EXCEPTION 'association:overlap';
  END IF;
  RETURN NEW;
END $fn$;

REVOKE ALL ON FUNCTION public.guard_r5_profile_effective_overlap() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.guard_r5_correspondence_effective_overlap() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.guard_r5_association_effective_overlap() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER r5_profile_effective_overlap
AFTER INSERT ON public.curricular_correspondence_profile_versions
FOR EACH ROW EXECUTE FUNCTION public.guard_r5_profile_effective_overlap();

-- As chaves E3 são filhas da versão e são inseridas após a versão; o trigger por statement
-- roda quando o conjunto completo de chaves do writer já está presente.
CREATE TRIGGER r5_correspondence_effective_overlap
AFTER INSERT ON public.curricular_position_matrix_correspondence_keys
FOR EACH STATEMENT EXECUTE FUNCTION public.guard_r5_correspondence_effective_overlap();

CREATE TRIGGER r5_association_effective_overlap
AFTER INSERT ON public.class_specific_matrix_association_versions
FOR EACH ROW EXECUTE FUNCTION public.guard_r5_association_effective_overlap();
