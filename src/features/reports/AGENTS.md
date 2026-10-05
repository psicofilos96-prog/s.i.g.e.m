## Relatórios e exportações (`src/features/reports/`)
- Todo relatório é `ReportDefinition` versionada no `report-registry.ts` sobre linhas que o reader canônico já devolveu ao usuário; não há SQL editável, porque exportação nunca pode ampliar permissão.
- CSV/XLSX/PDF saem só de `report-engine.ts` (neutralização de fórmula, escape HTML, ausência = "não disponível"), porque cada tela com seu exportador divergia e permitia injection.
- Colunas `sensitive` saem por padrão; filtros/ordenação/agrupamento só sobre colunas declaradas.
- Relatório sem fonte/regra homologada fica catalogado com `dependency` e recusa execução, porque fórmula de déficit/aulas não pode nascer no código.
- Arquivos gerados vivem só na sessão com expiração (`GenerationLog`); job assíncrono é a interface `JobRunner`, sem armazenamento remoto até haver decisão de retenção.
