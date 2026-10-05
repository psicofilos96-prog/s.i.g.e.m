## Acompanhamento da escola — OP/Direção com sessão (`src/features/school-followup/`, migration 0071)

- Com sessão, `/orientacao` e `/direcao` mostram só este módulo; a demonstração 13H/13I fica apenas sem login, porque fixture com sessão criaria segunda verdade.
- O painel é projeção pura dos readers/tabelas canônicos lidos com a sessão; fonte negada = "não disponível", nunca zero, e cada número abre os registros que o compõem.
- Registros de acompanhamento só por `record_school_pedagogical_record` (append-only, retificação/anulação só pelo autor com motivo, categoria do catálogo homologado `categoria-de-acompanhamento-pedagogico`, sem seed) e leitura só por `school_pedagogical_records_at` (escopo escola obrigatório, visibilidade `autoria` só ao autor, `knownAt`), porque acompanhamento não é prontuário nem cópia de fatos.
- OP/Direção nunca escrevem nota/frequência: correção só pelos writers canônicos do Diário com capability própria. Conselho de Classe reutiliza o módulo colegiado existente, sem regra de promoção.
