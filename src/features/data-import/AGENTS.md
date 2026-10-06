## Importações governadas (`src/features/data-import/`, migration 0067)
- Pipeline: arquivo → SHA-256 → staging imutável (`stage_import_batch`, único por adaptador+versão+hash) → classificação (válida/rejeitada/duplicada/conflito/já reconciliada) → confirmação → aplicação só pelo writer canônico → eventos; upload nunca escreve entidade canônica, porque staging não é autorização.
- Adaptador só para leiaute real presente no projeto; sem leiaute ⇒ `missing(...)` que recusa parse (Educacenso, GPE, DP), porque coluna presumida seria norma inventada.
- DP_INTEGRATION — BLOCKED_BY_SOURCE_FILE: o SIGEM não é RH e não infere carga, lotação ou situação funcional.
