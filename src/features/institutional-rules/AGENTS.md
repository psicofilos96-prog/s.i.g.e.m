## Regras institucionais (`src/features/institutional-rules/`)
- NAVRULES.1: `/regras-avaliativas` com sessão mostra só `assessment-rules-page.tsx` (reader `institutional_rule_versions_at`, domínio correcao-avaliacao, somente leitura; ações levam aos writers de `/regras-institucionais` conforme capability), porque segunda tela de escrita criaria caminho paralelo.
