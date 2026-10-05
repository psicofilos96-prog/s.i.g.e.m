## Base de conhecimento (`src/features/knowledge-base/`, `/base-de-conhecimento`, migration 0094)
- Documento → versão append-only (hash e referência do original) → chunks com seção/página; classificação só `publico`/`interno` (interno exige capability) e fontes em lista fechada, porque o índice nunca pode ampliar acesso.
- ACL mora na versão e vale por chunk via RLS (`kb_can_read_version`); busca só por `kb_search` INVOKER, porque filtrar no navegador vazaria.
- `planIngestion` recusa prontuário, nota, dado pessoal e credencial; nada sensível é indexado automaticamente.
- Revogação/exclusão do índice são eventos; revogada/substituída aparece só como histórico com aviso, excluída some da busca, nada é apagado.
- Busca semântica é o contrato `Ranker`; sem provedor, `lexicalRanker` local (nada sai), e escrita só por `record_kb_document_version` com `gerir-base-de-conhecimento` (não atribuída).
