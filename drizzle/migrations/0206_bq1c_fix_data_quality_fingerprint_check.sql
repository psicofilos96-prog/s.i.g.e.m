-- BQ.1C — defeito preexistente: o CHECK de fingerprint usava repetição {3,300}, acima do limite (255) do motor de
-- regex do Postgres, então TODO insert falhava ("invalid repetition count"). Mesma regra, expressa sem repetição longa.
ALTER TABLE public.data_quality_review_events DROP CONSTRAINT IF EXISTS data_quality_review_events_fingerprint_check;
ALTER TABLE public.data_quality_review_events ADD CONSTRAINT data_quality_review_events_fingerprint_check
  CHECK (fingerprint ~ '^[a-z0-9:._/-]+$' AND length(fingerprint) BETWEEN 3 AND 300);
