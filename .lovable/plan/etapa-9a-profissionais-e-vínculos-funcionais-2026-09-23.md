# Etapa 9A — Profissionais e vínculos funcionais

## Objetivo
Adicionar o bloco de consulta de profissionais sem alterar o núcleo de alunos ou criar operações de cadastro. A experiência deixará explícita a cadeia Pessoa → Profissional → Vínculo Funcional e preparará, sem implementar, Lotação → Atribuição de Função → Atuação Pedagógica.

## Implementação
- Criar um conjunto isolado de dados integralmente fictícios para profissionais, vínculos, lotações, funções, atuações pedagógicas e eventos temporais. Os dez cenários solicitados serão cobertos sem taxonomias jurídicas definitivas ou dados pessoais sensíveis.
- Criar `/profissionais` com `OperationalPageHeader`, pesquisa por nome e identificadores funcionais, filtros conceituais, `DataGrid`, ordenação, paginação controlada e os estados já suportados pelo sistema.
- Manter a tabela enxuta: profissional e identificador, vínculo contextual, lotação atual, funções atuais e situação. CPF, endereço, dados bancários, familiares, médicos e documentos completos não aparecerão.
- Criar `/profissionais/$id` com visão geral editorial e aba funcional de trajetória, distinguindo visual e textualmente Atual de Histórico sem depender apenas de cor.
- Apresentar cada vínculo separadamente, com empregador/contexto, matrícula funcional, cargo, enquadramento, carga horária opcional, situação e vigência.
- Exibir lotações e funções como relações próprias e potencialmente múltiplas. A atuação pedagógica terá seção separada e somente leitura, sem inferi-la pelo cargo.
- Manter áreas futuras desabilitadas e identificadas como futuras: Vínculos, Lotações, Funções, Atuação pedagógica, Documentos e Histórico/Auditoria, sem criar páginas vazias.
- Adicionar “Profissionais” ao grupo institucional existente da Sidebar e reconhecer a página na Topbar, sem redesenhar a navegação global.
- Criar as rotas pai, índice e detalhe com metadados próprios e integrar ambas ao roteador usado pelos testes.

## Estados e acesso futuro
- Reutilizar os estados `loading`, `empty`, `error`, `permission` e `stale` do `DataGrid`; o detalhe terá estado de não encontrado.
- Comunicar que a consulta é demonstrativa e deverá respeitar futuramente papel institucional, escopo, finalidade e temporalidade, sem implementar autenticação ou autorização.

## Testes e validação
- Cobrir listagem, pesquisas, filtros, paginação, detalhe válido, não encontrado e navegação.
- Cobrir Pessoa ≠ Profissional, Profissional ≠ Vínculo, múltiplos vínculos, lotações e funções, Cargo ≠ Função, atuação pedagógica separada, histórico, carga horária ausente, minimização e Atual vs Histórico.
- Verificar rótulos, tabela, abas, estados e navegação por teclado em nível básico.
- Executar toda a suíte existente e nova, build, typecheck e lint; validar `/profissionais` e um detalhe real dos fixtures no navegador em desktop e mobile.

## Fora de escopo
- Nenhum backend, banco, API, persistência, autenticação real, cadastro/edição, lotação operacional, atribuição funcional ou docente, quadro de pessoal, folha, ponto, frequência funcional, horários, diário, notas ou frequência de alunos.
- Nenhuma alteração em Home, Login, identidade visual, branding ou conceitos congelados do núcleo de alunos.

## Decisões mantidas abertas
- Taxonomias jurídicas e administrativas oficiais, regras de autorização, origem e validação de identificadores, cálculo/distribuição de carga horária e regras operacionais de lotação, função e atuação pedagógica permanecerão para etapas futuras.