# NIMPORT.STANDARD.1 — Carga 2026 normalizada no pipeline padrão

## Situação atual (2026-10-09)
- Classe: **Registro de lote**. Nenhum dado foi reimportado nem duplicado.

## O que foi feito
- `import_technical_adoptions` (migration 0272, append-only): 12 operações técnicas 2026 adotadas como "adopted existing technical import" — hash, arquivo, parser, lote lógico (`lote:<sha256>`), contagens por tabela-alvo, resultado informado, data e chave `tecnica-…@1:<sha256>:adocao`.
- 10 lotes lógicos (turmas e alunos têm carga + correção/conversão no mesmo hash).
- `stage_import_batch` reconhece hash adotado e devolve `dry_run_only`: nenhum lote aplicável, nenhum fato novo.
- `import_source_recognition(sha)` e `import_technical_adoptions_list()` sob `gerir-importacao-de-dados` (Admin/CIECE).
- Central de Importações: seção "Histórico da carga 2026" e aviso de arquivo já adotado na prévia, com contagem de linhas da prévia.

## Limite
- Contagem de correspondências/conflitos por linha só existe quando a operação técnica a informou; ausente é exibido "—", nunca zero.
