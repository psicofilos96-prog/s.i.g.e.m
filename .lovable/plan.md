# Etapa 11A — Diário Inteligente

## Objetivo
Criar o ambiente demonstrativo do professor dentro do SIGEM, orientado à próxima aula, às turmas e à consulta contextual dos alunos. O módulo reutilizará os registros fictícios já aprovados de profissionais, vínculos, atuações, turmas, alunos, matrizes e horários, sem persistência ou operações acadêmicas reais.

## Experiência e rotas
- Adicionar **Diário Inteligente** à navegação institucional, sem alterar Home, Login ou branding.
- Criar rotas próprias para:
  - `/diario` — Meu Diário;
  - `/diario/turmas` — Minhas turmas em cartões ou lista;
  - `/diario/turmas/$turmaId` — ambiente da turma;
  - `/diario/turmas/$turmaId/alunos` — alunos na data consultada;
  - `/diario/turmas/$turmaId/alunos/$alunoId` — acompanhamento contextual;
  - `/diario/aulas` — histórico de aulas registradas;
  - `/diario/documentos` — biblioteca contextual de documentos.
- Manter escola, turma, componente, período letivo, período acadêmico e data de referência em parâmetros validados durante a navegação.
- Usar um professor fictício com várias turmas como contexto inicial e manter cenários alternativos para duas escolas, vários vínculos, substituição, histórico e ausência de turma.

## O que será construído
- Uma camada única de projeção temporal para atuações vigentes, próximas aulas, alunos participantes na data e diferenças por etapa.
- Componentes compartilhados: cabeçalho do Diário, seletor acadêmico, identificação da atuação, cartão de turma, lista de alunos, resumo de aula, pendência e estados operacional/futuro.
- Meu Diário com próxima aula em destaque, turmas sob responsabilidade, pendências demonstrativas e registros recentes.
- Minhas turmas com busca, filtros, troca cartão/lista e atalhos diretos.
- Ambiente da turma com visão geral funcional e áreas futuras claramente indisponíveis, sem controles de salvar ou concluir.
- Consulta de alunos derivada de matrícula, vínculo, participação e alocação, respeitando ingresso, saída, transferência e movimentação.
- Perfil acadêmico limitado ao contexto docente, sem duplicar cadastro pessoal ou expor dados sensíveis.
- Histórico separando aula planejada de aula efetivamente registrada.
- Biblioteca indicando disponibilidade e dependências de cada documento, sem emissão oficial.
- Variações coerentes para Educação Infantil, Anos Iniciais, Anos Finais, EJA e turmas multietapa.

## Integridade e limites
- Referenciar sempre IDs canônicos de Pessoa, Profissional, vínculo, atuação, turma, aluno, participação, alocação, grade e bloco.
- Não apresentar atuação ou aluno fora de sua vigência na data consultada.
- Não converter grade planejada em aula ministrada; registros de aula serão fixtures próprios e explicitamente demonstrativos.
- Não inferir docência por lotação, função ou nome.
- Não criar backend, autenticação paralela, persistência, chamada, frequência, notas, decisões acadêmicas, publicação ou documentos oficiais.

## Qualidade
- Adicionar testes de dados e interface para contexto, vigências, múltiplas escolas/componentes, navegação, histórico, movimentações de alunos, diferenças por etapa, filtros, vazios, privacidade, acessibilidade e ausência de operações falsas.
- Preservar os 608 testes existentes e executar suíte completa, tipos, lint e build.
- Verificar os fluxos principais no navegador em 1366×768 e mobile, incluindo foco, legibilidade e ausência de rolagem horizontal da página.
