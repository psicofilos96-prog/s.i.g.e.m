## Inclusão — NEI/AEE/mediação (`src/features/inclusion/`, migrations 0072/0073)

- Registros (`inclusion_records`) são pedagógicos, append-only e exigem finalidade educacional; não há campo de diagnóstico, CID ou deficiência, e categoria só vem de catálogo homologado sem seed, porque taxonomia médica/elegibilidade não é do SIGEM.
- Participação/atendimento AEE são tipos de registro próprios, separados da matrícula regular; nada infere condição a partir de AEE, mediação, turma ou texto.
- Leitura só por `inclusion_records_at`: capability `consultar-apoio-inclusivo` da própria escola, ou mediação vigente da própria conta (só necessidade/plano marcados para mediação); Família, docente e Direção não têm caminho automático.
- Anexos: metadados no banco, conteúdo no armazenamento privado `inclusao-sensivel` sem política de cliente; o servidor só toca o arquivo depois de o banco autorizar como o usuário e gravar a trilha (`inclusion_access_events`, sem conteúdo). Clínico exige `consultar-documento-sensivel-inclusao`.
- Exportação é minimizada (`minimizedExport`): sem autoria, motivos, categorias nem anexos; não há painel agregado de inclusão.
