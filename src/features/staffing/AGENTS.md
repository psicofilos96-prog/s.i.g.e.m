## Quadro docente (`src/features/staffing/`, `/quadro-docente`, sem migration)
- Demanda vem só da grade vigente (`class_schedule_at`, blocos utilizáveis) e cobertura só da regência vigente (`teaching_assignments_at`), lidas com um knownAt por lote; projeção pura e não persistida, porque número gravado viraria segunda verdade.
- Grade/regência ilegível ⇒ null e total não fechado; disponibilidade só com fonte canônica (inexistente hoje), porque ausência não pode virar zero nem regra de RH.
- Pessoa agrega atuações por `person_id`; classificação funcional e habilitação nunca vêm de cargo textual nem de lista no código.
- Cenário só com parâmetro explícito do usuário e nunca gera ato funcional; fórmula versionada em `STAFFING_FORMULA` e cada número expõe blocos/regências que o compõem.
