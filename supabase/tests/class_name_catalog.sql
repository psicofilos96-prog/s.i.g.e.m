-- Run in a disposable PostgreSQL database with 0602–0604 and the minimal fixture
-- described by the test runner; this is a trigger/reader test, not an auth/RLS proof.
BEGIN;
CREATE TEMP TABLE catalog_probe (class_id text, version integer, name text, code text, name_catalog_entry_id uuid);
CREATE TRIGGER catalog_probe_guard BEFORE INSERT ON catalog_probe FOR EACH ROW EXECUTE FUNCTION public.validate_class_name_catalog();
DO $$
DECLARE n integer;
BEGIN
 SELECT count(*) INTO n FROM public.class_name_catalog_for_year('2026');
 IF n<>0 THEN RAISE EXCEPTION '2026 must not use the catalog'; END IF;
 SELECT count(*) INTO n FROM public.class_name_catalog_for_year('2027');
 IF n<>136 THEN RAISE EXCEPTION '2027 must expose all 136 names, got %',n; END IF;
 BEGIN
  INSERT INTO catalog_probe VALUES ('test-class',1,'FREE TEXT','x',NULL);
  RAISE EXCEPTION 'invalid name accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%class-name-catalog:selection-required%' THEN RAISE; END IF; END;
 INSERT INTO catalog_probe VALUES ('test-class',1,'BERÇÁRIO I - 40','40',NULL);
 IF NOT EXISTS(SELECT 1 FROM catalog_probe WHERE name_catalog_entry_id IS NOT NULL) THEN RAISE EXCEPTION 'catalog entry not snapshotted'; END IF;
 BEGIN
  INSERT INTO catalog_probe VALUES ('test-class',1,'BERÇÁRIO I - 41','wrong',NULL);
  RAISE EXCEPTION 'mismatched code accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%class-name-catalog:selection-required%' THEN RAISE; END IF; END;
 BEGIN
  INSERT INTO catalog_probe VALUES ('test-class',1,'BERÇÁRIO I - 42','42',NULL);
  RAISE EXCEPTION 'duplicate name accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%class:duplicate-name%' THEN RAISE; END IF; END;
 BEGIN
  INSERT INTO catalog_probe VALUES ('test-class',2,'FREE TEXT','x',NULL);
  RAISE EXCEPTION 'catalog-bound amendment accepted free text';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE '%class-name-catalog:selection-required%' THEN RAISE; END IF; END;
 INSERT INTO catalog_probe VALUES ('test-class',2,'BERÇÁRIO I - 41','41',NULL);
 INSERT INTO catalog_probe VALUES ('legacy-class',2,'OLD NAME','old',NULL);
 RAISE NOTICE 'PASS: 2026/2027, exact pair, invalid, duplicate, amendment, legacy';
END $$;
ROLLBACK;