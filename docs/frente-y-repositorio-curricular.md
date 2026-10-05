# Frente Y — Repositório curricular canônico (BNCC + SAEB + glossário + relações)

Status: **PASS — READY_FOR_GOVERNED_CURRICULAR_REFERENCE_IMPORT** · **CONTENT — BLOCKED_BY_OFFICIAL_SOURCE**

- Migrations: 0133 (hardening da 0068, cadeias, writers v2, relação com origem, ausência de correspondência, palavras-chave, glossário, homologação, readers INVOKER) e 0134 (policy v8: seis capabilities curriculares de rede, sem wildcard).
- 0068: DML de anon/authenticated/service_role revogado; writers v1 aposentados; `CURRENT_DATE` substituído por data declarada da operação.
- Contrato `sigem.curricular-reference-source.v2` (v1 continua legível): contagem declarada, hierarquia por `parent_code`, vínculos com versão do valor canônico, hash SHA-256 idempotente, cabeça esperada.
- Contrato consumidor: `CurricularReferenceRef` (Planejamento/Aula/Avaliação/Intervenção futuras guardam IDs, não texto).
- Conteúdo oficial: antes 0 itens, adicionados 0 — nenhuma fonte documental verificável no projeto. O legado EI em código ficou marcado como não canônico.
- Teste transacional `supabase/tests/y_curricular_reference.sql` (rollback, zero resíduos).
- Pendências humanas: fornecer documentos oficiais; importar e homologar por pessoas distintas com a capability.
