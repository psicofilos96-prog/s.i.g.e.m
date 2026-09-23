# Roadmap

- [x] Criar a central operacional de unidades escolares.
- [x] Criar a página contextual de uma unidade.
- [x] Integrar padrões e estados ao Design System.
- [x] Validar interações, acessibilidade e responsividade.
- [x] Consolidar padrões operacionais (taxonomias neutras, componentes genéricos, testes).
- [x] Evoluir unidades para UX institucional real com dados fictícios semanticamente coerentes.
- [x] Oferta educacional e matrizes curriculares versionadas (consulta e leitura).
- [x] Gestão e versionamento de matrizes curriculares (workspace, comparação, revisão).
- [x] Turmas e organização escolar (consulta e leitura contextual).
- [x] Criação e organização de turmas (workspace de contexto, edição demonstrativa).
- [x] Alunos e trajetória escolar (consulta, identidade permanente, vínculos letivos, participações).

## Etapa 8B — Cadastro e identidade do aluno (Pessoa → Aluno)

- [x] /alunos/novo e /alunos/editar/$id (workspace dedicado, por seções)
- [x] Identidade Pessoa/Aluno, identificador SIGEM permanente, CPF opcional
- [x] Verificação de possíveis duplicidades com decisão humana (sem merge)
- [x] Edição com dirty state, correção cadastral vs alteração histórica
- [x] Responsáveis, saúde/NEE/AEE apenas como áreas futuras
- [x] 113 testes verdes

## Etapa 8C — Ingresso e matrícula escolar (Aluno → Matrícula Escolar)

- [x] /matriculas/nova com acessos contextuais em /alunos e /alunos/$id
- [x] Localizar aluno no cadastro mestre, confirmar identidade, selecionar unidade
- [x] Cenários primeiro ingresso, matrícula existente e retorno à mesma unidade
- [x] Prevenção de segunda matrícula permanente (Aluno + Unidade)
- [x] Relação em outra unidade sinalizada sem inventar transferência
- [x] Conclusão demonstrativa sem vínculo letivo, participação ou enturmação
- [x] 131 testes verdes

## Etapa 8D — Vínculo letivo, renovação e participação (Matrícula Escolar → Vínculo Letivo → Participação)

- [x] /vinculos-letivos/novo com ?aluno= e ?matricula=, acessos contextuais no detalhe do aluno
- [x] Matrícula escolar de origem, período letivo, oferta, organização acadêmica (EJA por fases)
- [x] Renovação criando novo contexto temporal e preservando o vínculo anterior
- [x] Prevenção de vínculo equivalente no mesmo contexto
- [x] Participações múltiplas: regular, AEE coexistente, complementar, sem motor de compatibilidade
- [x] Conflito de participação regular em outra unidade impedindo conclusão, sem resolver nada
- [x] Matriz contextual apenas consultada; nenhuma alocação em turma
- [x] 153 testes verdes

## Etapa 8E — Enturmação e movimentação em turma (Participação → Alocação → Turma)

- [x] /enturmacoes/nova e /enturmacoes/movimentar com ?aluno=, ?participacao=, ?turma=
- [x] Acessos contextuais no detalhe do aluno e no detalhe da turma
- [x] Turma contextual por unidade, período, oferta, organização e agrupamentos; turno e jornada distintos
- [x] Turma simples, multisseriada/multietapa com agrupamento individual e EJA por fase
- [x] Vigência com início e término opcional; "Sem turma atual." na enturmação inicial
- [x] Movimentação atômica encerrando a alocação anterior e preservando o histórico
- [x] Conflitos, capacidade e compatibilidade apenas como avisos, sem regra inventada
- [x] Conclusão demonstrativa sem persistência, dirty state, privacidade e acessibilidade
- [x] 178 testes verdes

## Etapa 8F — Transferência escolar (origem preservada, destino próprio)

- [x] /transferencias/nova com ?aluno=, ?matricula=, ?participacao= e acessos contextuais no aluno, matrícula, participação e trajetória
- [x] Três tipos: transferência interna, saída para instituição externa, entrada proveniente de instituição externa
- [x] Matrícula escolar do destino criada, reutilizada ou retomada em retorno; matrícula da origem nunca convertida
- [x] Data efetiva orientando encerramento temporal na origem e continuidade no destino, sem sobreposição
- [x] Impactos explícitos: encerrados, preservados, criados, reutilizados e pendentes
- [x] Atomicidade conceitual em 7 passos, sem sucesso parcial, com conflito de versão demonstrativo
- [x] Saída externa sem unidade fictícia; entrada externa sem matrícula na instituição externa
- [x] AEE e participações complementares tratados separadamente; sem enturmação nem reclassificação automática
- [x] Documentação demonstrativa sem checklist legal, dirty state, privacidade e acessibilidade
- [x] 207 testes verdes

## Etapa 8G — Consolidação da jornada do aluno

- [x] Detalhe do aluno consolidado como ponto central com próxima ação contextual e pendências
- [x] Contexto atual separado do histórico, com estrutura técnica sob expansão progressiva
- [x] Navegação entre matrícula, vínculo, enturmação, movimentação e transferência preservando o aluno
- [x] Conclusões demonstrativas com retorno contextual e próximo passo independente
- [x] Ações impossíveis omitidas e turma atual navegável quando há página de consulta
- [x] Privacidade, conceitos e operações das etapas 8A–8F preservados

## Etapa 9A — Profissionais e vínculos funcionais

- [x] Criar consulta operacional em /profissionais com pesquisa, filtros, paginação e estados
- [x] Criar detalhe em /profissionais/$id com visão geral e trajetória funcional
- [x] Preservar Pessoa → Profissional → Vínculo Funcional e separar cargo, lotação, função e atuação pedagógica
- [x] Cobrir vínculos, lotações, funções, atuação, carga horária e temporalidade com fixtures fictícios
- [x] Integrar Profissionais à navegação existente sem alterar Home, Login, App Shell ou branding
- [x] Adicionar testes de consulta, detalhe, conceitos, privacidade, estados e acessibilidade
- [x] Validar testes, build, typecheck, lint e fluxos principais no navegador

## Etapa 9B — Cadastro e identidade profissional (Pessoa → Profissional)

- [x] Criar /profissionais/novo e /profissionais/editar/$id com workspace por seções
- [x] Localizar e reutilizar Pessoa antes de criar o papel Profissional
- [x] Tratar Pessoa nova, existente, já profissional e com múltiplos papéis
- [x] Aplicar duplicidade demonstrativa, decisão humana e minimização de dados
- [x] Separar identidade profissional de vínculo, matrícula funcional, cargo, lotação, função e atuação
- [x] Implementar revisão, conclusão demonstrativa, próxima ação futura e dirty state
- [x] Integrar ações contextuais na consulta e no detalhe congelados da Etapa 9A
- [x] Adicionar fixtures e testes da Etapa 9B, preservando os 231 existentes
- [x] Validar testes, build, typecheck, lint e fluxos principais

## Etapa 9C — Vínculos funcionais (criação, edição e histórico)

- [x] Criar rotas contextuais de novo vínculo, detalhe e edição sob /profissionais/$id/vinculos
- [x] Exigir Pessoa e Profissional existentes sem criar ou duplicar identidades
- [x] Modelar empregador/contexto, matrícula funcional, cargo, enquadramento, carga e vigência separadamente
- [x] Suportar múltiplos vínculos simultâneos e históricos sem sobrescrita
- [x] Verificar duplicidades por identificador e contexto sem confundir simultaneidade legítima
- [x] Criar detalhe do vínculo com áreas futuras de lotação, função, atuação e auditoria
- [x] Implementar edição com distinção administrativa/histórica e encerramento apenas conceitual
- [x] Implementar revisão, conclusão demonstrativa, próxima ação de lotação e dirty state
- [x] Integrar ações e navegação ao detalhe do profissional preservando a Etapa 9A
- [x] Adicionar fixtures e testes da Etapa 9C, preservando os 255 existentes
- [x] Validar testes, build, typecheck, lint e fluxos principais no navegador

## Etapa 9D1 — Lotações e movimentação funcional (concluída)
- Rotas de lotações, nova, detalhe, edição e movimentação sob o vínculo funcional.
- Pendências futuras: Funções (9D2), Atuação Pedagógica, encerramento jurídico, autorização real, concorrência real.

## Etapa 9D2 — Atribuições de função (concluída)

## Etapa 9E1 — Atuação pedagógica (consulta e estrutura) — concluída
- Registro único em src/features/pedagogical/pedagogical-data.ts com cenários fictícios A–O.
- Rotas: /atuacoes-pedagogicas, /profissionais/$id/atuacoes, /profissionais/$id/atuacoes/$atuacaoId.
- Consulta geral, consulta por profissional, painel no detalhe da turma e detalhe da atuação.
- Pendências: operações de criação, edição, encerramento e substituição (9E2); Diário, frequência, notas e horários; autorização e concorrência reais.

## Etapa 9E2 — Atribuição docente e gestão da atuação pedagógica — concluída
- Rotas: /atuacoes-pedagogicas/nova, /profissionais/$id/atuacoes/nova, /profissionais/$id/atuacoes/$atuacaoId/editar, /profissionais/$id/atuacoes/$atuacaoId/encerrar, /profissionais/$id/atuacoes/$atuacaoId/substituir.
- Workspaces por seções para criação/edição, encerramento e substituição temporária, com dirty state, revisão, conflito de versão demonstrativo e conclusão sem persistência.
- Cenários fictícios de operação A–T; duplicidade, corresponsabilidade, lotação e função apenas como avisos ou contexto.
- Pendências: Diário, frequência, notas, horários, autorização e concorrência reais permanecem fora de escopo.

## Etapa 9F — Consolidação da jornada profissional — concluída
- Camada compartilhada `src/features/professionals/professional-journey.ts`: estado temporal derivado de datas (atual/futuro/encerrado/desconhecido) com data de referência controlável, pendências, próximas ações contextuais, cenários integrados A–T e auditoria de consistência de IDs entre profissionais, vínculos, lotações e atuações.
- Hub `/profissionais/$id` com painel "Jornada profissional consolidada": sequência conceitual, pendências, próximas ações válidas por estado, contadores de atuações e notas de autorização futura.
- Fixture `pro-011` (profissional sem vínculo) e cenário de pessoa sem papel profissional (`pes-prof-001`).
- Contexto preservado da Turma: "Atribuir profissional a esta turma" envia turma e unidade (`?turma=&unidade=`), aceitas nas duas rotas de nova atuação.
- 27 testes de integração novos; 446 no total. Typecheck, build e lint sem novos problemas.
- Pendências: Diário, frequência, notas, horários, autorização e concorrência reais permanecem fora de escopo.

## Etapa 10A — Jornadas escolares e consulta de horários — concluída
- [x] Camada compartilhada de jornadas, grades, blocos, versões, publicação e conflitos temporais potenciais entre unidades.
- [x] Consultas operacional, por turma, profissional e unidade, com EI, EF, EJA, multisseriação, substituição e corresponsabilidade.
- [x] Integração contextual aos detalhes de turma, profissional e unidade e à navegação principal.
- [x] Grade semanal acessível, jornada declarada independente, períodos sem distribuição e impressões A4 demonstrativas.
- [x] Calendário escolar, aula ministrada e horário individual mantidos como conceitos independentes da grade e da jornada.
- [x] Cenários fictícios A–T e 28 testes novos; 474 no total. Typecheck e build aprovados; lint sem erros e com 6 avisos preexistentes.
- Planilhas `Todas as jornadas(1).xlsx` e `Todas as turmas(1).xlsx` não estavam disponíveis e não foram importadas.
- Pendências: editor, distribuição automática, otimização, publicação e versionamento reais, regras de permissão por tipo de alteração, integração de calendário, backend, autenticação e persistência reais.

## Etapa 10B — Editor visual de grades semanais (concluída)
- Rotas: /horarios/turmas/$turmaId/nova e /horarios/turmas/$turmaId/editar; detalhes de turma/profissional/unidade convertidos em layout + index para permitir subpáginas.
- Componentes: schedule-draft.ts (rascunho, blocos, alertas, carga, cenários A–T) e schedule-editor-page.tsx (workspace, painel lateral, revisão, conclusão).
- Editor: horários reais, durações 45/50/90 e livres, dias não uniformes, tipos de bloco, componentes/campos da matriz, profissionais por Atuação com vínculo explícito, corresponsabilidade, conflitos de rede, jornada como referência, carga planejada, undo/redo, dirty state, estados demonstrativos.
- Testes: 52 novos (526 no total); typecheck, build e lint (6 avisos preexistentes) aprovados; validação visual 1366×768 e mobile em /tmp/browser/10b.
- Pendências (Etapa 10C): publicação, versionamento definitivo, regras de alteração, alçadas de permissão, calendário e persistência.
