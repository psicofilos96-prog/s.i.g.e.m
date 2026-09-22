# Plano — Etapa 5: Cadastro Institucional Real — UX

## Objetivo
Evoluir `/unidades` e `/unidades/$id` de uma demonstração neutra para uma experiência institucional coerente com o domínio real do SIGEM, preservando Home, Login, App Shell, Design System e os padrões operacionais já aprovados.

## Escopo
- Manter tudo no frontend, com dados locais fictícios e claramente demonstrativos.
- Não criar backend, banco, autenticação, APIs, migrations ou regras persistentes.
- Não implementar Oferta Educacional, Matriz Curricular, Turmas, Alunos, Matrículas ou Profissionais.

## Ajustes em dados demonstrativos
- Substituir os campos neutros por campos semanticamente realistas, sem virarem enumerações oficiais.
- Representar: nome atual, nomes anteriores, identificador interno demonstrativo, código INEP demonstrativo opcional, natureza/contexto institucional, localização, contatos, situação operacional e datas demonstrativas.
- Incluir comentários no fixture reforçando que os valores são fictícios, não oficiais e não definem taxonomia institucional.

## `/unidades`
- Refinar a consulta institucional com tabela densa priorizando nome atual, identificação/código externo quando houver, contexto institucional, localização, situação operacional e atualização.
- Preparar a pesquisa visualmente para nome atual, nome anterior, identificador interno e código INEP, mantendo busca local.
- Trocar filtros “Grupo/Marcador/Contexto” por filtros conceituais demonstrativos: situação operacional, contexto institucional, localização e existência de código INEP.
- Preservar DataGrid, FilterBar, estados operacionais, seleção, ordenação, ações discretas, densidade e responsividade.

## `/unidades/$id`
- Reorganizar a Visão Geral em seções semânticas: Identificação, Contexto institucional, Localização e contato, Situação.
- Exibir histórico nominal quando houver, destacando nome anterior → nome atual e vigência demonstrativa.
- Indicar que estrutura física/localização pode não ser sinônimo da identidade institucional, sem criar cadastro de prédios/anexos.
- Manter “Oferta educacional” apenas como área relacionada/futura, sem modelar etapas, modalidades, turnos, integral, matriz, autorização ou séries/fases.
- Manter o painel lateral somente como demonstração de edição contextual curta.

## Componentes e testes
- Reutilizar os padrões existentes: OperationalPageHeader, DataGrid, FilterBar, DefinitionList, DetailSection, AuditTimeline e StatusBadge.
- Ajustar apenas o necessário nos componentes compartilhados se o novo conteúdo exigir flexibilidade, mantendo-os genéricos.
- Atualizar testes afetados por textos, filtros e dados, preservando cobertura comportamental equivalente ou melhor.
- Rodar testes, build, typecheck e lint antes da entrega.

## Validação
- Verificar busca, filtros, remoção/limpeza de filtros, ordenação, seleção, detalhe válido, unidade inexistente, abas futuras desabilitadas, painel de edição, estados operacionais e acessibilidade básica.
- Conferir que Home, Login, branding e direção visual não foram alterados.
