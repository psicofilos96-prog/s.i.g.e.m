## Planejamento docente (`src/features/teaching-planning/`, migration 0078)
- Plano é cadeia append-only por `plan_id` gravada só por `record_teaching_plan_version` (regência vigente do próprio usuário, cabeça esperada, autor único, regência imutável); matriz da versão é congelada no plano, porque mudança de matriz/regência não pode reescrever planejamento histórico.
- Blocos são livres e nível é identificador aberto; refs curriculares só por ID canônico (item da matriz da regência ou item da camada BNCC/SAEB), nunca texto copiado, porque taxonomia pedagógica fixa seria norma no código.
- Rascunho só do autor; publicado só com `consultar-planejamento-docente` na escola; ver nunca concede editar. Cópia é nova instância com `copied_from_version_id`.
- Aula referencia plano por `link_lesson_to_plan` (ledger próprio); planejar nunca marca conteúdo como ministrado.
