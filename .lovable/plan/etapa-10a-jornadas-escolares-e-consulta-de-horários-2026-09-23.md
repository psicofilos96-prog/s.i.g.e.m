# Etapa 10A — Jornadas escolares e consulta de horários

## Objetivo
Construir o primeiro recorte do módulo de Horários Escolares como experiência de consulta. Jornada escolar, grade semanal, horário individual, calendário e aula ministrada permanecerão conceitos separados. Não haverá edição, distribuição automática, publicação real ou persistência.

As duas planilhas citadas não estão disponíveis no ambiente atual; portanto, a implementação usará somente dados fictícios coerentes com os registros já existentes e não alegará importação ou análise das planilhas.

## Entrega funcional

### 1. Camada demonstrativa compartilhada
- Criar uma fonte única de jornadas, versões de grade e blocos temporais, referenciando os IDs existentes de turma, unidade, profissional, vínculo e atuação pedagógica.
- Modelar dias e intervalos independentes, inclusive jornadas com horários e durações diferentes por dia.
- Representar blocos variáveis de aula, intervalo, atividade pedagógica e outros tipos configuráveis, sem congelar taxonomia normativa.
- Implementar seletores para turma, unidade e profissional; classificação temporal; estados de publicação; histórico; substituições; informação insuficiente; e conflitos potenciais na rede.
- Detectar sobreposição pela mesma Pessoa, considerando todos os vínculos e unidades, sem transformar corresponsabilidade ou dois profissionais na mesma turma em conflito automático.
- Cobrir os cenários fictícios A–T solicitados e validar a consistência dos registros compartilhados.

### 2. Componentes de consulta
- Criar uma visualização semanal reutilizável com eixo de horários reais e blocos de duração variável, rolagem horizontal, alternativa móvel e estados acessíveis por texto e cor.
- Criar resumo independente da jornada escolar, mostrando funcionamento por dia, entrada, saída, intervalos, duração declarada, turno, vigência e origem.
- Criar painéis reutilizáveis de situação da grade, conflitos, pendências e histórico de versões.
- Criar apresentação A4 demonstrativa para turma, profissional e unidade, com identificação institucional, período, unidade, situação e data de referência.

### 3. Rotas e consultas
- `/horarios`: visão operacional com filtros de período e unidade, indicadores exclusivamente derivados dos fixtures, atalhos e estados loading/empty/error/permission/incompleto/desatualizado.
- `/horarios/turmas`: DataGrid com busca, filtros, paginação, jornada e situação da grade.
- `/horarios/turmas/$turmaId`: jornada separada da grade, visão semanal, conflitos, versão, histórico e impressão.
- `/horarios/profissionais`: DataGrid com filtros por vínculo, unidade, período, componente, situação e conflito, sem dados pessoais excessivos.
- `/horarios/profissionais/$profissionalId`: horário consolidado entre vínculos e unidades, preservando a origem de cada bloco e exibindo sobreposições.
- `/horarios/unidades/$unidadeId`: alternância entre lista operacional, visão semanal e visão por turno, reutilizando exatamente as grades das turmas.
- Adicionar metadados próprios em todas as novas páginas.

### 4. Integração com o SIGEM existente
- Adicionar Horários Escolares à navegação principal sem alterar a fundação visual.
- Substituir os acessos futuros nos detalhes de turma, profissional e unidade por links contextuais reais.
- Preservar IDs e contexto ao navegar entre turma, profissional, unidade, atuação pedagógica e horários.
- Manter calendário apenas como referência conceitual e deixar explícito que a grade recorrente não registra aula ministrada.

### 5. Qualidade
- Ampliar o roteador de testes e adicionar testes de dados e integração para consultas, jornadas variáveis, EI, EF, EJA, multisseriada, múltiplos vínculos/unidades, conflito entre escolas, corresponsabilidade, substituição, calendário independente, publicação, histórico, impressão, privacidade, responsividade semântica, acessibilidade e consistência.
- Preservar os 446 testes anteriores e registrar o novo total exato.
- Executar suíte completa, verificação de tipos, lint e validação visual/navegacional em 1366×768 e mobile.
- Corrigir apenas regressões relacionadas ou erros preexistentes que impeçam a validação, sem ampliar o escopo.

## Decisões que permanecem abertas
- Responsáveis institucionais por elaborar e alterar horários.
- Durações normativas por etapa, modalidade ou turno.
- Critérios definitivos para classificar alterações simples, recorrentes, estruturais e novas versões.
- Regras de autorização, publicação, conformidade e resolução de conflitos.
- Integração futura com calendário oficial, editor, otimização e Diário de Classe.
