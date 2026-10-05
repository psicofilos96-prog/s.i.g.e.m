## Auditoria e governança (`src/features/audit/`, sem migration)
- A central é projeção dos ledgers existentes lida pela RLS de quem consulta; nunca grava trilha paralela, porque segunda trilha divergiria da origem.
- Cada fonte entra por adaptador com allowlist de colunas e texto livre passa por `redact`; colunas como login, finalidade de acesso, detalhe de importação e texto de motivo nunca são lidas, porque minimização vale por construção.
- Fonte recusada e fonte vazia aparecem iguais, porque diferenciá-las permitiria enumeração.
- Exportação exige a capability `exportar-auditoria` (sem política atribuída) e sai pelo motor de relatórios.
- Retenção é configuração (`RetentionConfig`); sem decisão, nada é descartado, porque prazo legal não pode nascer no código.
- Writers × DML direto é verificado por teste sobre as migrations (`directDmlGrants`), porque busca de texto em tela não prova ausência de escrita direta.
