## Relatórios e exportações (`src/features/reports/`)
- Todo relatório é `ReportDefinition` versionada no `report-registry.ts` sobre linhas que o reader canônico já devolveu ao usuário; não há SQL editável, porque exportação nunca pode ampliar permissão.
- CSV/XLSX/PDF saem só de `report-engine.ts` (neutralização de fórmula, escape HTML, ausência = "não disponível"), porque cada tela com seu exportador divergia e permitia injection.
- Colunas `sensitive` saem por padrão; filtros/ordenação/agrupamento só sobre colunas declaradas.
- Relatório sem fonte/regra homologada fica catalogado com `dependency` e recusa execução, porque fórmula de déficit/aulas não pode nascer no código.
- Arquivos gerados vivem só na sessão com expiração (`GenerationLog`); job assíncrono é a interface `JobRunner`, sem armazenamento remoto até haver decisão de retenção.
- Central (AR, `report-catalog.ts`, `/relatorios`): metadados (domínio, escopo, natureza, ACL, tela dona) sobre `REPORTS`; o catálogo da Central não executa; só o gerador NREL.2 exporta, e apenas por adaptadores que leem com a sessão do usuário, porque a exportação precisa ter a mesma ACL da tela; natureza "snapshot" só para definição reproduzível e documento oficial só pela Secretaria com template homologado.
- Gerador transversal (NREL.2, `report-builder.ts`/`builder-sources.ts`): assunto é adaptador fechado lido com a sessão do usuário e passa pelo `runReport`; modelos salvos guardam só escolhas por conta+setor, porque o dado precisa ser relido com a ACL de quem gera.
