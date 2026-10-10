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

## Etapa 10C — Publicação, alterações e histórico das grades (concluída)

- Rotas: /horarios/revisoes; /horarios/turmas/$turmaId/revisar, /publicar, /alteracoes, /alteracoes/nova, /versoes, /versoes/$versaoId, /versoes/$versaoId/comparar e /horarios/turmas/$turmaId/documentos/$tipo/$referenciaId.
- Camada: schedule-lifecycle.ts (estados da grade e da solicitação, classificações, retificações, versões com retrato próprio, vigência, versão efetiva por data, comparação semântica, conflitos em rede, validações por categoria, impacto, capacidades futuras, cenários A–T) e lifecycle-widgets.tsx.
- Ciclo de vida: elaboração, revisão com devolução, preparação de publicação com confirmação explícita, publicação demonstrativa, alteração pontual com antes/depois e justificativa, retificação sem apagar a versão principal, nova versão preservando as anteriores, histórico cronológico e impressão contextual A4.
- Garantias: nenhuma versão sobrescrita, classificação indefinida sem decisão automática, corresponsabilidade distinta de conflito, dados históricos incompletos sinalizados, privacidade, dirty state e estados operacionais explícitos.
- Testes: 54 novos (580 no total); typecheck e build aprovados; lint sem erros (6 avisos preexistentes); validação visual desktop e mobile em /tmp/browser/10c.
- Fora de escopo e pendente: backend, banco, API, autenticação e autorização reais, publicação oficial, alçadas normativas, integração de calendário, Diário de Classe, frequência, avaliações, folha, ponto e otimização automática.

## Etapa 10D — Consolidação e integração dos horários (concluída)

- Camada única `src/features/schedules/schedule-integration.ts`: data de referência única, projeções de turma/unidade/Pessoa, conflitos por identidade da Pessoa, corresponsabilidade, retificações pendentes e auditoria de consistência.
- Telas de turma, profissional, unidade e impressão reescritas sobre a camada única; rotas com `?data=` preservando a data de referência.
- Conflitos de 10A migrados para identidade da Pessoa (nunca por nome; nunca falso conflito de corresponsabilidade).
- Cabeçalho operacional com ações que quebram linha no celular.
- 28 testes novos (`schedule-integration.test.tsx`); 608 no total.

## Etapa 11A — Diário Inteligente: ambiente do professor

- [x] Consolidar projeções temporais do professor, turmas, componentes, aulas e alunos sem duplicar cadastros
- [x] Criar página inicial, Minhas turmas, ambiente da turma, alunos, perfil contextual, histórico de aulas e documentos
- [x] Implementar seletor de contexto reutilizável e preservar o contexto na navegação local
- [x] Diferenciar Educação Infantil, Anos Iniciais, Anos Finais e EJA sem inventar regras acadêmicas
- [x] Criar estados futuros transparentes para aula/chamada, frequência, avaliações, acompanhamento e documentos indisponíveis
- [x] Integrar navegação institucional e metadados sem alterar Home, Login, branding ou módulos anteriores
- [x] Cobrir cenários, fluxos, filtros, estados vazios, privacidade, acessibilidade e regressões
- [x] Validar suíte completa, tipos, lint, build, desktop 1366×768 e mobile
- 16 testes novos; 624 no total. Typecheck e build aprovados; lint sem erros e com 6 avisos preexistentes.
- Fora de escopo: persistência, registro real de aula, chamada, frequência, avaliações, decisões acadêmicas e documentos oficiais.

## Etapa 11B — Registro de aulas e conteúdos (concluída)

- [x] Contexto compacto com filtros recolhíveis; agenda diária
- [x] /diario/registrar e /diario/registros/$registroId
- [x] Lote/individualização, planejamento x realização, fora da previsão, rascunhos locais
- [ ] 11C: chamada integrada ao registro

## Etapa 11C — Chamada e frequência (concluída)

- [x] Chamada funcional a partir da agenda, do registro concluído, do detalhe e do histórico (`/diario/chamada/$registroId`)
- [x] Alunos por alocação vigente na data; movimentados, transferidos e recém-enturmados sinalizados; lista atual não reescreve histórico
- [x] Marcação por aula/bloco, replicação explícita com confirmação, teclado (P/F), sem presença presumida
- [x] Estados: sem chamada, rascunho, parcialmente preenchida, concluída; conclusão bloqueada com pendências
- [x] Bloqueios: aula em rascunho, atuação de outro profissional, fora da vigência, bloco duplicado (aul-009 × aul-001)
- [x] Histórico de chamadas com filtros (`/diario/chamadas`) e frequência demonstrativa rastreável (`/diario/frequencia`)
- [x] Testes de dados e de navegação entre agenda, registro, chamada, detalhe e histórico
- Limitações deliberadas: estado apenas na memória da aba; sem trilha de auditoria; "Solicitar alteração" futura
- Dependem de confirmação normativa: justificativas/abonos, arredondamento, frequência na Educação Infantil, AEE, atividades complementares, frequência oficial

## Fase piloto — evolução visual controlada (em andamento)

- [x] Auditar tokens, App Shell, cabeçalhos, filtros, tabelas e telas representativas.
- [x] Registrar linha de base: 682 testes, tipos e build aprovados; lint sem erros e com 6 avisos preexistentes.
- [x] Definir direção: navy preciso, Outfit + Figtree e composição adaptativa por natureza da tarefa.
- [x] Implementar e validar Login, Dashboard e Alunos como referências oficiais.
- [x] Produzir capturas desktop/mobile; expansão permanece bloqueada até aprovação.
- Limite: nenhuma regra, fixture, rota ou funcionalidade será alterada nesta fase visual.

## Expansão visual — identidade SIGEM aprovada

- [x] Propagar a linguagem visual validada aos módulos administrativos, detalhes e fluxos operacionais.
- [x] Refinar o Diário Inteligente sem alterar registros, chamada, frequência ou regras acadêmicas.
- [x] Validar 9 rotas representativas em 1366×768 e 390×844, sem rolagem horizontal ou erros de página.
- [x] Preservar 682 testes; typecheck e build aprovados; lint com 0 erros e 6 avisos preexistentes de Fast Refresh.
- [x] Completar os metadados de título e descrição de Horários, alinhando-os às demais rotas do módulo.
- Limite preservado: somente apresentação, experiência e metadados; dados, regras, rotas e comportamentos permanecem inalterados.

## Polimento e robustez responsiva do Design System

- [x] Corrigir sistemicamente pares label/value, começando pelo Resumo do registro de aula.
- [x] Auditar e robustecer cabeçalhos, ações, badges, grids, painéis contextuais e tabelas compartilhadas.
- [x] Adicionar cenários de teste com conteúdo extremo, layouts estreitos e conteúdo multilinha.
- [x] Validar sidebar aberta/recolhida, zoom de 125%/150% e larguras de 390 a 1920px.
- [x] Inspecionar visualmente Registro de aula e telas representativas em desktop e celular.
- [x] Preservar identidade, dados, regras, rotas e todos os testes existentes; não implementar a Etapa 11D.
- Resultado: 686 testes aprovados; tipos e build aprovados; lint sem erros e com 6 avisos preexistentes.
- Verificação: 87 combinações de rotas e larguras sem overflow de página, colisão label/value ou erro de execução.
- Limite preservado: identidade, dados, regras, rotas e comportamentos inalterados; Etapa 11D não implementada.

## Etapa 11D — Diário Inteligente da Educação Infantil

- [x] Adaptar automaticamente o Diário ao contexto da Educação Infantil sem criar um sistema paralelo.
- [x] Implementar registro coletivo de experiência, campos de experiência, objetivos e observações pedagógicas.
- [x] Implementar observações individuais discretas com alunos elegíveis na data e estado temporário na aba.
- [x] Integrar planejamento, histórico, detalhe, linha do tempo e chamada das Etapas 11A–11C.
- [x] Criar fixtures demonstrativas e testes de domínio, interface, navegação, acessibilidade e conteúdo extremo.
- [x] Validar suíte completa, tipos, build, lint e inspeção visual desktop/mobile.
- Resultado: 705 testes aprovados em 33 arquivos; tipos e build aprovados; lint sem erros e com 6 avisos preexistentes.
- Verificação: registro, seleção de campos e objetivos, observação individual, rascunho e detalhe histórico validados em 1366×768 e 390×844, sem overflow de página ou erros de execução.
- Limites: sem backend, persistência oficial, avaliações, notas, documentos oficiais, homologação ou Etapa 11E.

## Etapa 11E — Consolidação do Diário e jornada docente
- [x] Camada `diary-journey` (estado da aula, próxima ação, pendências legítimas, retomada, histórico integrado)
- [x] Meu Diário como central: Hoje, navegação de data, Continuar de onde parei, Pendências, turmas em lista
- [x] Retorno contextual após chamada concluída; contexto preservado nos links da agenda
- [x] Testes de percurso (733 no total), tipos, lint (0 erros) e inspeção 390–1920 + zoom 150%
- Fora de escopo mantido: avaliações, notas, frequência normativa, documentos oficiais, Módulo 12

## Etapa 11F — Polimento final e fechamento do Diário

- [x] Auditar os percursos A–J, remover repetição entre retomada e pendências e preservar confirmações essenciais.
- [x] Implementar seletor contextual coerente em popover desktop e painel inferior mobile.
- [x] Unificar filtros progressivos de Histórico, Chamadas e Frequência com URL, chips e limpeza.
- [x] Consolidar a página da turma com próxima ação, agenda, registros e acessos contextuais.
- [x] Refinar observações individuais da Educação Infantil com anúncio, confirmação e retorno de foco.
- [x] Validar 390, 768, 1024, 1280, 1366, 1440 e 1920px; zoom 125%/150%; sidebar aberta/recolhida.
- [x] Reabrir todas as telas afetadas após o último ajuste, sem overflow, colisões ou erros de execução.
- Resultado: 735 testes aprovados em 34 arquivos; tipos e build aprovados; lint sem erros e com 6 avisos preexistentes.
- Limites preservados: sem avaliações/notas, frequência normativa, documentos oficiais, backend, autenticação real ou Módulo 12.

## Etapa 12A — Auditoria e arquitetura do domínio de avaliação (concluída)

- [x] Auditoria: nenhum código legado de notas/médias/períodos avaliativos; documentos do Diário apenas como cartões informativos.
- [x] Domínio em `src/features/assessment/` (tipos, regras puras, repositório em memória, fixtures demonstrativas, mapa de documentos) e `docs/avaliacao-arquitetura.md`.
- [x] Nenhuma regra homologada; resultados e situação sempre não oficiais.
- Próxima: 12B (não iniciada).

## Módulo 12 — Avaliação
- [x] 12A — Auditoria e arquitetura do domínio
- [x] 12B — Ano letivo por ID, datas ISO canônicas, etapa estruturada, períodos e configuração avaliativa, /diario/turmas/$turmaId/avaliacao, documentos derivados de dependências
- [x] 12B.1 — Calendário da rede governado pela Supervisão (rascunho → em revisão → homologado imutável → arquivado); escolas só consultam o mesmo calendarId; documento fiel Regular (anual) e EJA (semestral) 2027; duplicação para o próximo ano com revisão de colisões; avaliação referencia períodos oficiais por ID
- [ ] Pendente do usuário: reenviar as imagens de referência (o .rar não abriu) para comparação lado a lado
- [x] 12B.2 — Estrutura de períodos configurável: adicionar/remover/renomear/reordenar, agrupamentos opcionais por ID, Conselho derivado do dia CC, colunas rotuladas, cenário estrutural 2026 com 4 períodos (não oficial)
- [x] 12C — Instrumentos e lançamentos avaliativos: instrumento genérico (título, tipo permitido, data, descrição) sem peso/nota máxima/quantidade mínima; período derivado da data e referenciado por `calendarPeriodId`; 2026 sem calendário homologado = legado demonstrativo não oficial; pauta de elegíveis separada de movimentações informativas; lançamento com estado próprio, snapshot de contexto imutável e histórico de correções justificadas; "não registrado" nunca equivale a 0. Rotas em `/diario/turmas/$turmaId/avaliacao`. 854 testes verdes; tipos e build aprovados.
- [x] 12D — Acompanhamento avaliativo por aluno: projeção pura somente leitura (`assessment-student-journey.ts`) sobre colocações, configuração, instrumentos e lançamentos existentes; situações registrado / não registrado com motivo / pendente / planejado / não elegível; períodos recolhíveis com "Resultado ainda não consolidado"; rótulos históricos pelo snapshot; versões de correção; EI por experiências e observações do Diário. Rota `/diario/turmas/$turmaId/alunos/$alunoId/avaliacao`, acessos pela ficha do aluno e pelo acompanhamento na turma. 862 testes verdes. 
- [x] 12D.1 — Saneamento estrutural pré-consolidação: `curriculumRef` estável (código da matriz ou, sem código, a própria atuação) + rótulo histórico; configuração e versão gravadas em instrumento e lançamento, percurso com configurações diferentes lado a lado sem conversão; autoria (`createdBy`, `author`, `correctedBy` com nome exibido e data); "em aberto" no lugar de "pendente", sem noção de prazo; 2026 explicitamente não oficial; concordância singular/plural. 874 testes verdes. Aguardando autorização para a próxima etapa.

- [x] 12E — Motor configurável de composição e consolidação: modelo declarativo (categorias por identidade de tipo, pesos, quantidade mínima, agregações, `requiresAllPeriods`); bloqueio informativo sem regra homologada; acumulado parcial distinto de resultado anual original (só com dados completos); `roundScore` como único ponto de arredondamento, aplicado apenas nos pontos de fechamento declarados, preservando precisão interna; "não registrado" e rascunho como dado ausente, nunca zero, sem noção de prazo; valores de transferência externa participam apenas se a configuração os admitir, preservando `origin` e metadados, sem conversão; conceitual/descritiva e EI como não aplicável; auditoria estática contra regras codificadas. 899 testes verdes; tipos, build e lint aprovados.

- [x] 12F — Configuração, versionamento e homologação das regras avaliativas: regra institucional única (metadados + modelo de composição), governança exclusiva da Supervisão, estados rascunho → em revisão → homologada (imutável) → arquivada, duplicação como nova versão, validação estrutural bloqueante, resolução por contexto (ano, vigência, etapa, turma), prévia em linguagem natural, comparação por identificador, simulador sem dados reais, painel da regra aplicável na avaliação da turma. Capaz ≠ configurada ≠ homologada; nenhuma regra real da rede homologada. 940 testes verdes; tipos, build e lint aprovados.
- [x] 12F.1 — Rascunho institucional incompleto e primeira regra real em elaboração (Anos Finais): pendências normativas explícitas (`assessment-rule-pending.ts`), painel "Definições pendentes" e aviso "Regra em elaboração", revisão/homologação recusadas com pendência obrigatória, consolidação anual e recuperação sem fórmula bloqueadas, teto por categoria, prevalências curadas na UI sem restringir o domínio. Nenhuma regra real homologada. 955 testes verdes; tipos, build e lint aprovados.
- [x] 12F.2 — Anos Finais completados com o que foi confirmado: consolidação anual por soma (total possível derivado dos tetos dos períodos), direito à recuperação periódica com resultado do período inferior a 50, recuperação final por componente com gatilho derivado do mínimo anual; pendentes: consolidação entre múltiplas recuperações, teto e prevalência da recuperação final, mínimo anual (regra de situação) e momento do arredondamento. Nenhuma regra homologada. 960 testes verdes.

- [x] 12B.3 — Calendário com projeção canônica única, regras e documento configuráveis por calendário
- [x] Identidade Institucional (brasão, logo SEMED com vigência, logo por unidade); calendário migrado

- [x] 12G — Fechamento do Período Avaliativo: quatro momentos distintos (entrega docente → conferência institucional → fechamento oficial → retificação/reabertura) no nível componente × turma × período oficial; estados `em-andamento`, `entregue`, `em-conferencia`, `devolvida-para-ajustes`, `fechado`, `reaberto`; competência por capacidade (nunca cargo); bloqueios explicitados por extenso (lançamento vazio/rascunho, instrumento sem pauta, quantidade mínima só se a regra homologada exigir, atuação sem vigência NO PERÍODO, pauta não entregue/não conferida, calendário não homologado, regra não homologada); prévia não oficial nunca gera `PeriodClosingRecord`; "resultado consolidado oficial do período" (nunca situação acadêmica, anual, recuperação final ou frequência); versões imutáveis encadeadas por `precedingClosingId`, vigência DERIVADA da cadeia (sem `isCurrent` editável) com invariantes; `ClosingSourceReference` para documentos futuros ficarem ligados à versão que os originou. 18 testes novos (1.057 no total); tipos aprovados. Nenhum fechamento oficial possível nas fixtures: não há calendário nem regra homologada aplicável.

- [x] 12H — Consolidação do Percurso Avaliativo: ciclo avaliativo genérico (anual, por fase, modular) declarado pela configuração e resolvido fora do motor; consolidação a partir das versões vigentes dos fechamentos oficiais da 12G; acumulado parcial distinto de consolidação completa; quatro camadas separadas (resultado matemático do ciclo, recuperação final, resultado pós-recuperação, situação acadêmica como ponto de integração); arredondamento apenas nos pontos configurados (`ciclo` genérico ao lado do legado `anual`); mudança de turma consolidada naturalmente; ingresso posterior, cobertura parcial, "não registrado", configuração/regra divergente e fechamentos concorrentes como pendência administrativa, sem zero ou equivalência; recuperação final com elegibilidade, teto, prevalência e agregação vindos da regra homologada, bloqueando o pós-recuperação quando pendentes; configurações não numéricas como não aplicável; `CycleConsolidationFacts` com dimensões estruturadas para exploração futura da CIECE. Rota `/diario/turmas/$turmaId/avaliacao/consolidacao`. 26 testes novos (1.083 no total); tipos e build aprovados. Nenhuma regra homologada: nas demonstrações a consolidação permanece bloqueada.

- [x] 12H.1 — Fechamento e Consolidação Oficial da Frequência: previsto ≠ ministrado ≠ aplicável ao aluno; política de apuração configurável (unidade e escopo) com ID estável e sem granularidade codificada (inclusive Educação Infantil); carga horária preservada e duração desconhecida como `null`; marcas neutras (`presenca`/`ausencia`) com indicação de ocorrência registrada no prontuário do aluno (Secretaria Escolar) por tipos configuráveis, sem abono, compensação ou classificação de falta; ausência de chamada nunca vira presença nem falta; aula ministrada sem chamada concluída bloqueia o fechamento quando a política exige; sem prazo arbitrário de edição; governança por capacidade (entrega docente → conferência → fechamento oficial → retificação/reabertura) com versões imutáveis encadeadas e vigência derivada da cadeia; trava de reescrita da chamada histórica; equações de integridade apenas sobre unidades ministradas/aplicáveis; `FactStudentAttendanceAnalytical` com fatos atômicos, proveniência, política e versão para a CIECE, sem relatórios. Rota `/diario/turmas/$turmaId/frequencia/fechamento`. 22 testes novos (1.105 no total); tipos e build aprovados. Nenhuma política de apuração homologada: nas demonstrações o fechamento oficial permanece bloqueado.

- [x] 12I — Situação Acadêmica e Regras de Promoção (infraestrutura): quatro camadas separadas (fatos acadêmicos consolidados → regra institucional homologada → deliberação institucional registrada → situação resultante). Motor com apenas DUAS formas estruturais de critério (`comparacao` e `composicao`) sobre referência a fato + escopo + agregação + operador + parâmetro + composição lógica + consequência; nenhum conceito escolar codificado (sem frequência mínima, nota de corte, dependência, promoção, retenção, colegiado, modalidade, etapa ou quantidade de períodos). Situações acadêmicas são entidades configuráveis com IDs estáveis, propriedades e efeitos declarados, sem categoria fixa. Ordem de avaliação declarada pela regra. Autorização por capacidade institucional (nunca cargo). `InstitutionalDeliberationRecord` genérico, com competência declarada e restrição opcional de situações produzíveis. Consolidador canônico da frequência do ciclo (`attendance-cycle-consolidation.ts`) agregando as versões vigentes da 12H.1 antes de qualquer política normativa; proporções apenas como materialização analítica reproduzível declarada. Fato indisponível, parâmetro sem valor, referência ambígua, ciclo incompleto e pendência administrativa nunca produzem zero, falso por omissão ou situação presumida — geram estado operacional explícito (`aguardando-regra-homologada`, `ciclo-em-andamento`, `pendencia-administrativa`, `criterio-nao-avaliavel`, `aguardando-deliberacao`, `nao-aplicavel`), que jamais é situação acadêmica. Determinação registrada é imutável e encadeada por `precedingRecordId` (retificação, reprocessamento, deliberação). Explicabilidade estrutural por nó (fato, escopo, valor, operador, parâmetro, resultado, regra/versão, consequência, proveniência). Saída analítica atômica para a CIECE (fatos, critérios, deliberações e situações linha a linha, com proveniência, versão e temporalidade), sem indicadores ou relatórios. Rota `/diario/turmas/$turmaId/avaliacao/situacao`. 24 testes novos (1.129 no total); tipos e build aprovados. Nenhuma regra, situação, patamar, percentual, efeito de justificativa ou competência de colegiado homologada: as fixtures permanecem em rascunho com parâmetros sem valor e a determinação segue bloqueada.
- Decisões normativas ainda pendentes da rede: situações acadêmicas reais e seus efeitos; sequência de avaliação dos critérios; patamares de rendimento e de presença; efeito da ocorrência registrada sobre a frequência; competência do colegiado (se pode alterar resultado, frequência ou situação); tratamento de dependência e de ingresso tardio sem histórico; regra de progressão entre ciclos.

- [x] Construtor visual de regras de situação acadêmica (criar, editar, versionar, diagnosticar, simular, homologar por governança) — nenhuma regra real homologada.

- [x] 12J — Deliberações Institucionais e Colegiados (`src/features/collegial/`): infraestrutura genérica com sessão, pauta, deliberação e ata estruturada como entidades separadas; naturezas de sessão cadastráveis e capacidades como identificadores abertos; papéis obrigatórios, quórum, forma de decisão, assinatura e provocação formal exigidos SOMENTE quando a configuração os declarar (quórum ausente = `satisfied: null`; sem `recordsVotes` não há votação); competência decisória exclusivamente do `DeliberationBody` da regra de situação homologada (12I) — a existência documental do Conselho não confere poder algum; dossiê congelado com versões exatas das fontes e `dossierDivergences` relatando retificação posterior sem alterar o analisado; resultado matemático preservado (`dossier.computed`) ao lado da situação deliberada, nunca reescrito; ata encerrada imutável com termo de retificação encadeado; fatos analíticos atômicos para a CIECE, sem indicadores; nenhuma condicional por etapa/modalidade (percurso sem regra promocional simplesmente não é encaminhado); dois colegiados demonstrativos de governanças opostas sobre o mesmo motor. Rota `/diario/turmas/$turmaId/avaliacao/conselho`. 21 testes novos + 2 auditorias anti-rigidez (1.220 no total); tipos, build e navegador conferidos. Nenhuma configuração homologada.

- [x] 12K — Encerramento Oficial do Ciclo e da Turma (orquestrador de integridade): não calcula nota, frequência, situação nem deliberação. Cadeia `requisito configurado → avaliador registrado (evaluatorId) → diagnóstico`, sem `switch` por tipo de requisito; avaliadores nativos são primitivas genéricas (estado de fonte, cobertura de fontes esperadas, fato disponível, ausência de pendência) e uma exigência nova é atendida por avaliador registrado sem alterar o inspetor. Cinco estados de diagnóstico (satisfeito, não satisfeito, não aplicável, inconclusivo, erro de configuração); "cadeia íntegra" = todos os requisitos obrigatórios E aplicáveis satisfeitos; dado ausente nunca atende critério e requisito sem avaliador é erro de configuração. Situação acadêmica terminal é exigência OPCIONAL da política: percurso qualitativo encerra sem APROVADO/REPROVADO e nenhuma situação é inventada. `resolutionSourceTypeId`, estados institucionais e naturezas de ato são identificadores abertos. Snapshot com fatos materializados + referências exatas com versão (consulta futura autossuficiente); congelamento em memória declarado como defesa, não como garantia arquitetural. Retificação e reabertura como ritos com capacidade e justificativa, em versões encadeadas que preservam integralmente a anterior. Matriz governável `operationId × institutionalState` para operações de qualquer módulo, com padrão declarado. Fatos atômicos ao CIECE com proveniência, sem taxa ou indicador. Código em `src/features/cycle-closing/`, rota `/diario/turmas/$turmaId/encerramento`. 14 testes novos; auditoria anti-rigidez ampliada; tipos aprovados. Nada homologado: as duas políticas são demonstrativas em rascunho.

- [x] 12L — Projeções Canônicas do Percurso Acadêmico (`src/features/academic-projections/`): fronteira única de publicação entre a verdade institucional congelada pelo encerramento (12K) e todos os consumidores futuros (13 Vida Escolar, 14/CIECE, 15 Documentos, 18 Portal, 26). Contratos com `projectionSchemaVersion` independente do `closingVersion`; `dimensionKindId` como identificador aberto ao lado de `dimensionDefinitionId`, `parentDimensionId` e `scopeReference`; `resolution { sourceTypeId?, standingId?, completeness, reason? }` sem duplicação derivável (nenhum `hasTerminalStanding`); pendências estruturadas (`issueId`, `issueTypeId`, `scopeReference`, `status`, `sourceReference?`); frequência canonicamente aberta (`attendance.facts[]` + `attendance.dimensions[]`) com métricas comuns apenas como helpers; rótulos como `labelSnapshot` histórico; temporalidade genérica (`cycleStartDate`/`cycleEndDate`, `academicYearId` só quando existir); `isCurrentClosingVersion` sempre DERIVADO da cadeia. Projetor puro: `projectClassCycle`, `projectStudentCycle`, `projectClosingChain`; adaptador tabular derivado `projectToAnalyticRows`; `cycle-closing-analytics.ts` passa a derivar da projeção (compatibilidade legada, `@deprecated`) para que o CIECE tenha raiz única. Testes de contrato com quatro consumidores fictícios e dimensão inédita sem alterar o motor. Consulta somente leitura `/diario/turmas/$turmaId/projecao` com alternador de versão vigente/superada e proveniência rastreável. 1.287 testes verdes; auditoria anti-rigidez ampliada; tipos e build aprovados. Nada homologado; nenhum consumidor implementado.

- [x] 13A — Identidade e Vínculo Escolar Canônico (`src/features/student-life/`): fundação do Capítulo 13 (Vida Escolar). Princípio reitor: ENTIDADES representam o estado institucional vigente consultável; EVENTOS formam o ledger histórico imutável que explica como esse estado foi produzido — nenhuma alteração institucional muda o estado sem deixar fato histórico, ato originador e proveniência. Nomenclatura desambiguada: `Person` (identidade humana) → `StudentRole` (papel perante a Rede, materializa o vínculo com a Rede sem entidade intermediária redundante) → `SchoolInstitutionalBond` (relação duradoura com a unidade, com episódios de vigência), deixando "matrícula letiva" (inscrição por ciclo) para a 13B. Três naturezas de identificação formalizadas: ID técnico interno imutável, `InstitutionalIdentifier` exibível com padrão configurável e `ExternalIdentifierReference` (namespace, código, vigência, estado de conferência, proveniência) — nenhum identificador externo é chave primária. `firstNetworkAdmissionDate` NÃO é campo: é projeção `getFirstNetworkAdmissionDate` derivada do ledger. Bitemporalidade (`effectiveDate` do fato ≠ `recordedAt` do registro), retificação encadeada (`precedingEventId`, `supersedesId`, motivo configurado) sem sobrescrever o fato anterior. Eventos com `eventTypeDefinitionId` + `payloadSchemaDefinitionId` + `attributes` validados contra o schema declarado (nunca JSON livre); `summary` apenas leitura humana, jamais descrição canônica. Diagnósticos estruturados (`code`, `typeId`, `severity`, `scopeReference`, `parameters`, `message?`) com agregação por código. Estados/transições/motivos configurados em máquinas independentes (aluno-rede ≠ vínculo-unidade), exigências formais e ato institucional obrigatório por configuração. Unicidade SEMÂNTICA: invariante temporal de não sobreposição, nunca `unique(studentId, schoolId)` eterno; retorno à mesma unidade admite reativação de episódio OU novo vínculo encadeado, conforme política declarada (não declarada ⇒ inconclusivo). Coexistência de participações genérica, sem qualquer noção de horário. `OptionalValue` distingue dado desconhecido, não informado e não aplicável sem criar categoria cadastral. Minimização LGPD: `StudentReference` mínima, sem dossiê, documentos, laudos ou ocorrências. Adaptadores dos protótipos 8A–8F preservando todas as rotas existentes. 22 testes novos (1.312 no total) + 3 verificações na auditoria anti-rigidez; tipos e build aprovados. Nada homologado; nenhuma tela nova; matrícula letiva, enturmação, transferência, efeitos acadêmicos, dossiê e portais permanecem para 13B em diante.
- [x] 13B — Matrícula, Rematrícula e Inscrição Letiva (`src/features/student-life/cycle-enrollment-*.ts`): motor institucional de inscrição letiva, não formulário de "matrícula do ano". `AcademicCycleEnrollment` é entidade própria e temporal entre o vínculo institucional com a unidade (13A) e a futura alocação em turma (13C), referenciando aluno, vínculo, ciclo, oferta, organização acadêmica e matrizes por IDs estáveis — sem premissa de anualidade, série, modalidade ou quantidade de períodos. Matrícula inicial e rematrícula NÃO são entidades distintas: são ritos (`admissionProcessKindId`) configurados que produzem a mesma entidade, diferindo apenas em exigências estruturais e política de requisitos. `CycleParticipation` é entidade temporal PRÓPRIA consultada por `cycleEnrollmentId` (nunca subdocumento), preparando a 13C, cuja alocação apontará para a participação. `validUntil` significa exclusivamente fim de vigência: causa, rito e ato pertencem ao evento/transição. Coexistência entre unidades resolvida pela Solução A — cada contexto `unidade + ciclo + oferta` tem sua própria inscrição, e a política compara naturezas por escopo configurado (mesma unidade x unidades distintas), sem noção de horário, turno ou capacidade. Requisitos declarativos resolvidos por avaliador registrado (`evaluatorId`), com resultado técnico em cinco estados e EFEITO institucional configurável (`requirementEffectDefinitionId` + capacidades `preventsTransition`, `requiresRegularizationDeadline`, `requiresInstitutionalAct`) — nenhuma enumeração de efeito fechada em código. Prazos preservam origem/proveniência (`originKindId`, agente, ato, prazo substituído). Capacidade de constituir inscrição a partir de requerimento é declarada (`allowsEnrollmentCreation`), nunca deduzida do nome do estado. `EnrollmentDefinitionSnapshot` congela IDs e versões das definições vigentes no ato, para que uma inscrição antiga nunca seja reinterpretada por configuração futura; matrizes curriculares são lista (zero, uma ou várias). Projeções derivadas (versão vigente, cadeia de retificação, participações vigentes, trajetória, rastro bitemporal) e fatos atômicos ao CIECE sem interpretação: publica `cycleStartDate`, `studentValidFrom` e estados de requisito, jamais "ingresso tardio" ou `hasPendingDocument`. Diagnósticos semanticamente neutros (`SL-ENROLL-PARTICIPATION-INCOMPATIBLE`, sem taxonomia "principal"). Adaptadores dos protótipos 8C/8D preservam as rotas existentes. 30 testes novos (1.342 no total), incluindo retificação bitemporal sem sobrescrever o passado, evolução de política sem reescrever inscrições históricas e substituição integral da máquina por identificadores fictícios sem tocar no motor. Nada homologado; nenhuma tela nova. Enturmação (13C), transferências (13D), efeitos acadêmicos da 12L (13E), dossiê (13F) e portais seguem pendentes.
- [x] 13C — Enturmação e Movimentações (`src/features/student-life/class-allocation-*.ts`): enturmação como ALOCAÇÃO TEMPORAL da participação (`ClassAllocation`: `participationId` + `classId` + vigência), nunca atributo do aluno nem lista dentro da turma; composição de turma é projeção do ledger (`classCompositionOn`, `classCompositionAsKnownAt`), jamais campo persistido. `AcademicClass` canônica com `classId` estável (preservando os consumidores do Diário e do Capítulo 12) e SEM capacidade, headcount, turno fixo ou jornada textual; capacidade é `ClassCapacityRecord` temporal versionado com `CapacityQuotaReservation` declarativa. Turma distinta de agrupamento interno: `ClassGroupingDefinition` responde pela posição curricular em turma multietapa e `academicOrganizationId` é opcional na turma. Requisitos de alocação resolvidos por avaliador registrado (fato → avaliador → efeito configurado), sem percentual, limite ou classificação normativa no motor; ausência de registro de capacidade é inconclusiva e nunca autoriza por omissão. Movimentação é operação ATÔMICA que devolve plano (origem encerrada + destino constituído) e aborta integralmente quando o destino é inadmissível, preservando a origem; o fim da vigência da origem vem da política temporal declarada (offset, inclusividade, coexistência na data) — sem `-1 dia` nativo — e a avaliação do destino considera a origem como será encerrada pela própria operação. Cardinalidade por participação separada da coexistência entre participações distintas (AEE e complementar permanecem possíveis). Processo originador é `originatingProcessKindId` neutro e configurado; processo não declarado devolve inconclusivo. Retificação apenas encadeada e retrospectiva (`supersedesAllocationId`, motivo configurado), sem reescrever o passado. Denormalizações validadas contra as referências canônicas. Fatos atômicos ao CIECE com ato institucional estruturado, pares de movimentação sem classificação de motivo e ocupação como projeção reproduzível rotulada, sem excedente nem flags derivadas. 30 testes novos (1.372 no total); tipos e build aprovados. Nada homologado; nenhuma tela nova. Transferências (13D), efeitos acadêmicos da 12L (13E) e dossiê (13F) seguem pendentes.
- [x] 13D — Transferências e Mobilidade Institucional (`src/features/student-life/transfer-*.ts`): transferência como PROCESSO institucional bitemporal, nunca formulário. `InstitutionalTransferProcess` é identidade permanente sem `activeVersionId`/`versionsCount`; a REPRESENTAÇÃO evolui em `TransferProcessVersionRecord` encadeado (`precedingVersionId`) e o ledger `TransferStageTransitionRecord` é a única fonte do estágio vigente (`currentStageOf`, `stageOnDate`, `stageAsKnownAt`) — corrigir data ou destino cria versão, não outro processo. Origem e destino são polos SIMÉTRICOS e polimórficos (`contextReferenceTypeDefinitionId` + `payloadSchemaDefinitionId` + `attributes` validados), sem noção de "interno"/"externo"; ausência de contexto é fato epistêmico estruturado (motivo, declarante com papel, ato, proveniência), nunca `destinationKnown: false`, e "destino conhecido?" é projeção (`isContextKnown`). Nenhuma flag semântica de estágio: a cadeia é transição → efeitos configurados → executores registrados (`registerTransferEffectExecutor`), com primitivas genéricas (encerrar vigência de alocação/inscrição, resolver política de participações, avaliar efeito sobre o vínculo, registrar intervalo, publicar fato de mobilidade). O efeito sobre CADA participação e sobre o vínculo escolar vem de política configurada sobre FATOS publicados pelo motor (`inscricoes-vigentes-remanescentes-no-vinculo`), sem semântica fixa de AEE e sem conduta por omissão — participação não prevista deixa o plano inconclusivo e nenhuma vigência é encerrada (atomicidade). Fim da vigência na origem vem da política temporal da 13C; sem política resolvida, inconclusivo, sem `-1 dia` nativo. `InstitutionalTransitionIntervalRecord` é entidade de primeira classe cuja NATUREZA é cadastrada (`intervalo-transito-regulamentar-demo` é fixture), permitindo responder pela condição institucional conhecida entre duas datas sem inventar falta ou abandono. Estados documentais e de verificação são catálogos abertos. A situação de vida escolar NÃO é atribuída por código: `transfer-life-projection.ts` projeta a partir do fato atômico de mobilidade conforme política versionada (o mesmo fato histórico passa a projetar outra situação quando a política muda; fato sem regra gera diagnóstico, nunca situação por omissão). Fatos atômicos ao CIECE (processo, transições, documentos, intervalos, mobilidade) sem flags, taxas ou juízo. Adaptadores traduzem o protótipo 8F sem torná-lo fonte de verdade; a 13D não cria turma, alocação ou inscrição no destino. 27 testes novos (1.399 no total); tipos e build aprovados. Nada homologado; nenhuma tela nova. Efeitos acadêmicos da 12L (13E) e dossiê (13F) seguem pendentes.
- [x] 13E — Continuidade Acadêmica e Aproveitamento de Estudos (`src/features/student-life/continuity-*.ts`): ponte entre o resultado acadêmico oficial e a Vida Escolar, sem recalcular nota, frequência ou situação. Fonte de origem é aberta (`sourceTypeDefinitionId` + `sourceSchemaVersion` + `sourceReference` versionada), com adaptadores tipados para a fronteira canônica da 12L (`normalizeFromCanonicalProjection`) e para registro acadêmico externo; uma terceira fonte entra por configuração, sem tocar no motor. Ausência de resolução terminal é admitida: percurso qualitativo não recebe aprovação/reprovação fabricada, e `resolutionReference` preserva a taxonomia de origem em vez de condensá-la. Contexto AVALIADO (`ContinuityTargetContext`) separado da resolução PRODUZIDA (`AcademicContinuationResolution`), cujos estados são configurados. Motor declarativo: condição (`conditionKindId`) → combinador → consequência (`consequenceDefinitionId` + `executorId` + `parameters`), todos por registro extensível; executor, avaliador ou combinador ausente devolve INCONCLUSIVO com diagnóstico, nunca decisão presumida, e fato indisponível (`null`) só satisfaz comparadores de ausência. Obrigação de continuidade (`AcademicContinuityObligation`) não carrega campo de estado: o estado é projeção do ledger `ObligationLedgerEntry` (`currentObligationStatus`, `obligationStatusAsOf`, `obligationsAsOf`), e mudança ocorre exclusivamente por evento institucional validado (tipo cadastrado, cadeia de estados coerente, motivo em retificação). Natureza, estado, tipo de evento e tipo de pendência são identificadores abertos; quantidade de obrigações é livre. Equivalência curricular é N:M (`CurriculumCorrespondenceGroup` com listas de origem e destino de qualquer `referenceKindId`, não só componente), decidida por CAPACIDADE institucional (`capacityDefinitionId` + ato + proveniência), nunca por cargo, e congelando `targetCurriculumVersion` para que decisão antiga não seja reinterpretada por matriz futura. Retificação é bitemporal e encadeada (`supersedesEvaluationId`), preservando a avaliação anterior. Fatos atômicos ao CIECE em seis extratores, incluindo eventos do ciclo de vida das obrigações como matéria-prima e o estado apenas como projeção derivada, sem indicadores ou taxas. Fronteira formal auditada por teste: nenhum módulo da 13E referencia inscrição, participação ou alocação — constituir matrícula, participação e turma segue exclusivo de 13B/13C. 36 testes novos (1.435 no total); tipos e build aprovados. Nada homologado; nenhuma tela nova. Dossiê da vida escolar (13F) segue pendente.
- [x] 13F — Dossiê e Prontuário Canônico do Aluno (`src/features/student-life/dossier-*.ts`): agregador governado, nunca segunda fonte de verdade — matrícula (13B), turma (13C), mobilidade (13D), continuidade (13E) e resultado (Cap. 12) permanecem nos seus domínios e entram apenas por referência versionada. Quatro distinções preservadas: documento apresentado ≠ conteúdo ≠ verificação ≠ fato institucional reconhecido; nenhuma produz a outra automaticamente. `DossierRecord` tem titularidade PLURAL (`subjectReferences[]` + `scopeEntities[]`), admitindo acontecimento multi-aluno projetado por cada ficha sem duplicação, e não persiste flag de superação — `currentDossierRecords` deriva a vigência da cadeia `supersedesRecordId`. Documento é `DocumentRecord` sem `studentId` obrigatório (aluno, responsável, processo, unidade, entidade externa, vários simultaneamente), separado de `DigitalAssetReference` (arquivo, integridade) e ligado por `DocumentRepresentation` N:M — original, digitalização e via autenticada são representações do MESMO documento institucional. Relações entre recursos são `DossierRelation` aberta (`relationTypeDefinitionId`), sem campos específicos por natureza. Parentesco deixou de conferir poder: `PersonalRelationshipRecord` descreve a relação e `StudentResponsibilityAssignment` descreve capacidades, vigência, fundamento e ato/documento; não existe `isLegalGuardian` e responsabilidade pode existir sem relação registrada. Acesso segue `fatos do acesso → política → efeito configurado → executor registrado`, sem `allowed: boolean`: efeitos demonstrativos (permitido, negado, com auditoria, parcialmente, exige justificativa) são configuração, efeito sem executor é inconclusivo e falha FECHADA, e a política registra `processingPurposeDefinitionId` e base legal/institucional. Redação por ATRIBUTO (`grantedFieldPaths`/`redactedFieldPaths`) permite conhecer a existência sem o conteúdo integral. Auditoria é consequência da política por operação (consultar metadados, visualizar conteúdo, obter representação — catálogo aberto), nunca flag do recurso. Ciclo de vida é política TRANSVERSAL (documentos E registros) com âncora configurada e consequências declarativas por executor (arquivar, revisar, restringir acesso, preservar permanentemente); o motor só PROPÕE ações e nunca exclui destrutivamente. Timeline é projeção pura com `sourceTypeDefinitionId` + `sourceEntityReference` + `sourceProjectionSchemaVersion` — sem capítulos do plano como domínio — e superação DERIVADA no instante da projeção; autorização ocorre ANTES da projeção, e a busca textual roda apenas sobre campos liberados, de modo que ator sem acesso não descobre o registro por palavra, snippet, metadado ou contagem. Exposição ao CIECE publica fatos ATÔMICOS autorizáveis (`documentRecordId + tipo + data + escopo + estado + proveniência`), sem contagens, e conteúdo sigiloso não existe para o cubo. Exigências documentais da 13B são resolvidas contra o repositório (satisfeito/dispensado/pendente/inconclusivo) sem duplicar documento e sem `hasPendingDocuments`. 45 testes novos (1.480 no total); tipos e build aprovados. Nada homologado; nenhuma tela nova.

- [x] 13G — Portal da Secretaria Escolar (`src/features/workspace/`): Workspace Projection Framework reutilizável (`workspace-types.ts`, `workspace-engine.ts`, `workspace-search.ts`) + perspectiva demonstrativa da Secretaria (`secretary-workspace.ts`, `secretary-workspace-page.tsx`, rota `/secretaria`). Princípio: portal não é domínio nem fonte de verdade — é projeção operacional autorizada (`agente + capacidades efetivas + escopo institucional + finalidade + contexto → projeção`). `WorkspaceAccessContext` (nunca papel); `OperationalQueueItem` derivado, com chave determinística e sem ciclo de vida próprio; filas, janelas de prazo e de "concluído recentemente" como configuração (nenhuma janela fixa em código); `WorkspaceActionDescriptor` separando admissibilidade do processo da autorização do agente, com falha fechada explicável; registro aberto de processos (`processTypeDefinitionId + projectionAdapter`) e de predicados de fila; Ficha Integrada composicional por `profileSectionProvider`; Matriz de Pendências agregando diagnósticos dos domínios com política, versão e executor competente; Busca Universal autorizada ANTES da indexação, privilegiando identificador institucional e excluindo ID técnico sem capacidade específica; múltiplos escopos institucionais; deep links para o objeto real; datas DD/MM/AAAA. 44 testes novos (1.524 no total), tipos, build e navegador conferidos. Rotas legadas preservadas (sem redirecionamento antes de equivalência comprovada); nada homologado; 13H não iniciada.

- [x] 13H — Portal da Orientação Pedagógica (`src/features/pedagogical-guidance/`): camada de ATENÇÃO e camada de ACOMPANHAMENTO sobre os fatos canônicos, sem criar realidade paralela sobre o aluno. Cadeia `SignalDefinition → SignalEvaluation → PedagogicalSignalOccurrence` separa capacidade configurada, detecção e materialização histórica: a ocorrência congela versão da definição e retrato dos fatos, de modo que alterar parâmetro cria nova versão e nunca reescreve o passado; definição não homologada apura mas não produz sinal institucional; fato indisponível permanece inconclusivo e jamais vira zero. Ciclo de vida do sinal e do caso são projeções do ledger (`projectSignalLifecycleState`, `projectCaseState`) com estados configurados; "descartado após análise" é decisão institucional, não erro. `PedagogicalFollowUpCase` admite múltiplos sujeitos, nasce com ou sem sinal (`openingModeDefinitionId`: sinal, provocação institucional, encaminhamento, solicitação da família) e tem responsabilidade TEMPORAL própria (`CaseResponsibilityAssignment`) distinta de participação. Plano é versionável (`FollowUpPlan → FollowUpPlanVersion → PlanItem`): revisão cria versão encadeada preservando a anterior. `ObservedFactRecord` referencia fato posterior com `assertsCausality: false`, e efetividade é `EffectivenessAssessment` própria — resultado observado nunca significa eficácia. Encerramento tem estado final e motivo independentes: encerrar ≠ resolvido. Comunicação é `CommunicationRecord` genérico cuja autorização vem de responsabilidade vigente com capacidade exigida (13F); relação pessoal não confere poder e capacidade não declarada falha fechada. Encaminhamento usa `ReferralPolicy → responseExpectationDefinition`: sem retorno obrigatório não fica pendente, resposta exigida permanece pendente até o retorno, expectativa não configurada é inconclusiva. Observação docente permanece do professor, entrando como fonte com autoria preservada. A tela `/orientacao` reutiliza o Workspace Projection Framework da 13G como SEGUNDA perspectiva (capacidades, escopos, filas, janelas, processos e seções da ficha por configuração), com visão de turma como porta de entrada (estudantes com itens autorizados, sem taxas ou gráficos) e fatos atômicos ao CIECE sem conteúdo nem agregação. 35 testes novos (1.559 no total); tipos, build e navegador aprovados. Nada homologado. Direção (13I) e Supervisão (13J), documentos oficiais (Cap. 15) e indicadores (Cap. 14) seguem fora de escopo.

- [x] 13I — Portal da Direção Escolar e Decisão Institucional (`src/features/institutional-decisions/` + `src/features/school-leadership/`, rota `/direcao`): primeiro workspace institucional e decisório. Competência por `InstitutionalCompetenceGrant` (capacidade + escopo + vigência), cargo apenas como rótulo; processos decisórios com política exigente, fatos considerados com disponibilidade declarada, alternativas admissíveis e efeitos por executor registrado; falha fechada para definição não homologada, fundamentação ausente, capacidade faltante e ato sem emissor; retificação encadeada com versão vigente derivada; governança local de configuração com autoridade proprietária, mutabilidade declarada, override com limites por executor e homologação superior; seis áreas na tela (Central/Mesa, Visão institucional, Estudantes e casos, Governança, Histórico) como projeções autorizadas, sem indicador estatístico; confidencialidade da 13H preservada por capacidade específica. 35 verificações novas (1.594 no total), tipos, build e navegador conferidos. Nada homologado; 13J não iniciada.

- [x] 6D.3.2.7 — Pauta Descritiva focal: CONGELADA em 29/09/2026 (lista + editor focal, Anterior/Próximo visíveis, texto preservado ao trocar de estudante, 382 px/200% sem rolagem horizontal).

- [x] Família 6D.3.2 — Pauta 2.0: sete etapas concluídas, HOMOLOGADAS e CONGELADAS em 29/09/2026. Pendências de validação futura (não bloqueiam): seletor de tipo no laboratório; teste com login/turma real.
- [x] 6D.3.3.0 — Auditoria da Mesa Avaliativa (somente leitura) entregue; aguarda decisão do usuário sobre 6D.3.3.6–6D.3.3.8.
- [ ] 6D.3.3.1 — Assessment Period Projection: camada de domínio/projeção pura e serializável para a futura Mesa Avaliativa do Período; sem UI, sem tocar Pauta 2.0, motores canônicos, fechamento, Conselho ou CIECE.
- [ ] 6D.3.3.2 — Assessment Period Workspace (Mesa Avaliativa do Período): superfície COMPREENDER → LOCALIZAR → NAVEGAR consumindo exclusivamente AssessmentPeriodProjection; sem edição em célula, sem cálculo em React, sem CIECE/ranking/risco.
- [ ] 6D.3.3.3 — Explicabilidade da Composição Avaliativa: projeção de explicabilidade + resolvedores humanos + painel "Como foi calculado?", sem recalcular nem alterar o motor.
- [x] 6D.3.3.1 — Assessment Period Projection (homologada com o plano da 6D.3.3.2).
- [x] 6D.3.3.2 — Mesa Avaliativa do Período (`/diario/turmas/$turmaId/avaliacao/periodo`).
- [x] 6D.3.3.3c — Interface "Como este resultado foi formado?" (aguarda homologação).
- [x] 6D.3.3.4 — Continuidade Avaliação do período ↔ Pauta ↔ Correção (aguarda homologação).
- [ ] 6D.3.3.3 — Explicabilidade da composição (aguarda plano/homologação).
- [ ] 6D.3.3.4 — Integração e continuidade Mesa → Pauta → Correção → Mesa (aguarda 6D.3.3.3).
- [ ] 6D.3.4 — Fechamento avaliativo do período (aguarda 6D.3.3.4).
- [ ] 6D.3.5 — Recuperação avaliativa 2.0 (aguarda 6D.3.4).

- [ ] 6D.3.3.2 homologação final — auditoria executada; BLOQUEADA: resultado corrigido (versão ≥ 2) indistinguível de resultado oficial na matriz/lista. Aguarda decisão do usuário.

- [x] 6D.3.3.5 Canonização da pauta e aposentadoria da pauta legada (aguarda homologação)
- [x] 6D.3.4.1 Fonte canônica do fechamento (aguarda homologação)

- [x] Calendário — correções homologadas (o HOMOLOGADO é o conjunto de alterações, NÃO o conteúdo do calendário): (1) "Salvar" gravava só ao sair do campo — texto passa a entrar no rascunho enquanto digita, botão reflete rascunho real; (2) datas dos Conselhos de Classe corrigidas no EJA fase 2–9 (30/04 e 30/09 — 1º período; 12/07 — 2º período; 19/07 — final/1; 10/12 — final/2) e no Regular + EJA fase 1 (21/05, 10/09, 10/12, 17/12); (3) campo de informações adicionais com linhas editáveis no documento, com fonte/tamanho/negrito configuráveis em "Formatação dos textos". 92 testes do calendário verdes (1.852 no total); tipos e build aprovados. As datas permanecem DADO editável — nada no calendário foi congelado.

- [x] 6D.3.4.3b homologação funcional — teste cirúrgico de concorrência do fechamento no lote PASSOU SEM DEFEITO: plano sob Closing v1 + mudança para Closing v2 antes de registrar ⇒ "fatos-mudaram" (planId incorpora closingId+closingVersion), nenhuma versão nova, nenhuma parcial, rascunhos e Closing v1/v2 intactos; nova conferência sob v2 produz e registra novo plano. 0 linhas de produção alteradas. 15 testes no arquivo (840 na suíte ampla); typecheck OK. 6D.3.4.3b CONCLUÍDA; 6D.3.4.4 não iniciada.

- [x] 6D.3.4.4 — Closing Workspace 2.0 (aguarda homologação)

- [x] 6D.3.5.1 — Avaliadores canônicos de recuperação (prevalência + elegibilidade), domínio e testes. Aguarda homologação; 6D.3.5.2 não iniciada.
- [x] 6D.3.5.2 — consolidação anual e prévia no motor canônico; subtotal substituível aguardando decisão. Aguarda homologação.
- [x] 6D.3.5.2b — subtotal substituível canônico + elegibilidade na recuperação periódica (domínio). Aguarda homologação.
- [x] 6D.3.5.3 — Recuperação periódica integrada (homologada)
- [x] 6D.3.5.3b — admissibilidade do resultado canônico unificada, vínculo regra↔configuração explícito, pn-consolidacao derivado (homologada e congelada)
- [x] 6D.3.5.4 — divergência pós-fechamento por fato novo relevante (origens version-succession / new-relevant-fact)
- [x] 6D.3.5.5 — explicabilidade da recuperação em três níveis, a partir do recibo
- [x] 6D.3.5.4/0 — microcorreção elegibilidade × divergência (A/B/C testados)
- [x] 6D.3.5.6 — Recuperação Final operacional canônica (testes A–O)
- [x] 6D.3.5.7 — tipo canônico it-recuperacao-final nas 4 regras; laboratório /laboratorio/recuperacao; conferência desktop/382/zoom/teclado
- [ ] Jornada visual Pauta → consolidação com dados reais: depende de regra homologada aplicável a uma turma de demonstração
- [x] 6D.3.5.7 microcorreção — “Não registrado” oficial na Recuperação Final distinto de ausência e de insuficiência (motivo exibido; sem alterar matemática/elegibilidade/efeito). 2 testes.
- [ ] 6D.3.5.7 jornada real Pauta → Consolidação — BLOQUEADA: a turma de laboratório (tur-001, estrutura est-2026-a) não tem calendário homologado, logo nenhum período é oficial e a Consolidação não se forma. Destravar exige vincular calendário à estrutura (config real) ou gravar calendário de laboratório no armazenamento persistente de calendários do usuário. Aguarda decisão. Ativação explícita já existe em /laboratorio/recuperacao (“Ativar jornada de laboratório”).
- [ ] Congelamento 6D.3.5 e auditoria do Diário 2.0 — após a jornada.

## 6D.3.5.7 — Jornada real (concluída) · 6D.3.5 CONGELADA
- [x] Pauta 2.0 → registro oficial v1 (75) → Consolidação: 40 → 85/75 com explicação do recibo (T+V).
- [x] "Não registrado" oficial exibido com motivo; nenhum valor presumido (T+V).
- [x] Correção focal v1→v2 (75→85) pela Pauta sob fechamento vigente; consolidação usa v2 ("versão corrigida"); v1 preservada na cadeia.
- [x] Sem política de correção pós-fechamento, a correção falha fechada (observado); laboratório declara política transitória própria.
- [x] Retorno contextual "Voltar à Consolidação do ciclo".
- Rascunho ≠ fato: coberto por testes da Pauta; não re-verificado visualmente nesta jornada.
- 849 testes (Avaliação + Diário) e tipos passaram.

## Auditoria do Diário 2.0 (somente leitura) e roteiro de saída
Congelados: Frequência 2.0, Registro de Aula, Pauta 2.0, Avaliação do período, Fechamento, Recuperação.
Pendências para sair do Diário:
1. Persistência real append-only (versões, fechamentos, regras, instrumentos hoje em memória/localStorage) — depende de Lovable Cloud.
2. Conselho de Classe e Situação acadêmica (rotas existem) — dependem da 12I e do módulo de colegiados.
3. Encerramento da turma/ciclo — fronteira com `cycle-closing/` e projeções canônicas.
4. Documentos do Diário — hoje biblioteca demonstrativa; A4/PDF pertence ao Cap. 15.
5. Regras reais homologadas (vínculo configuração explícito) — sem elas o fechamento real fica indisponível.
6. Remoção dos adaptadores legados (página antiga do instrumento, store antigo).
Fronteiras: Vida Escolar (13) lê projeções; CIECE (14) só indicadores; Cap. 15 documentos. Nada disso foi implementado.

## 6D.4 — Conselho de Classe e Situação Acadêmica
- [x] 6D.4.0 auditoria somente leitura.
- [x] 6D.4.1 fonte única de deliberação: situação lê o colegiado (`collegial-standing-bridge.ts`); canal paralelo do store de situação deprecado.
- [x] 6D.4.1b decisão homologada: deliberação só produz efeito após ata encerrada (ponte lê atas vigentes).
- [x] 6D.4.2 situação oficial referencia deliberação + sessão/ata exatas (`deliberationSource`).
- [x] 6D.4.3 `academic-standing-divergence.ts` (domínio; ainda sem tela).
- [x] 6D.4.4 (parcial) observação do encerramento carrega deliberationId/minuteId.
- [ ] 6D.4.4b botão de registrar situação oficial e integração da divergência à tela.
- [ ] 6D.4.5 autorização real nas telas (bloqueado: não existe sessão de usuário real sem Lovable Cloud; perfis demonstrativos permanecem).

## 6D.4 — CONGELADA
- [x] Telas de situação (projetada, preparação, oficial, divergência), registro individual/lote com revalidação, avisos do Conselho, cadeia e bloqueio do encerramento.
- [ ] Dívida: binding das capabilities ao usuário autenticado será realizado com a persistência/autenticação Lovable Cloud.
- [ ] Extensão futura: componentes da progressão parcial (não deriváveis canonicamente hoje).
- [ ] 6D.5.0 — auditoria da Educação Infantil.

## 6D.5 — Educação Infantil (congelada no que independe do Cloud)
- [x] BNCC EI01/EI02/EI03 (93 objetivos) na Matriz; Diário filtra por grupo da turma, campo, código e texto; fictícios removidos.
- [ ] Parecer descritivo do período: não existe hoje; falta definir o rito oficial (periodicidade, responsável, ato).
- [ ] Persistência real e salvamento automático: Lovable Cloud.
- [ ] Integração de matrizes (SAEB, AVALIA RJ, correlações BNCC↔descritores e painel de Avaliação e Desempenho): planilhas recebidas, aguardando etapa própria.

## 6D.5 — CONGELADA
- [x] 6D.5.1 BNCC EI01/EI02/EI03 na Matriz canônica; Diário consulta por ID.
- [x] 6D.5.2 Parecer descritivo: período pela configuração, autoria pela atuação, rascunho → conferir → oficializar, nova versão com Antes/Depois, falha fechada por concorrência.
- [ ] Persistência real — aguarda Lovable Cloud.
- [ ] Turma demonstrativa de Berçário (EI01) não existe nos dados de demonstração; repositório e testes já cobrem EI01.
- [ ] Próximo: auditoria somente leitura da próxima pendência do Diário.
- [ ] Backlog separado: integração SAEB/AVALIA RJ e relatórios de desempenho.

## Saída do Diário — auditoria curta (pós-6D.5)
- Itens antigos 11C, 6D.3.2.7, 6D.3.3.x, 6D.3.4, 6D.3.5, 6D.4.4b e 6D.5.0 abertos acima já foram entregues por etapas posteriores (registros desatualizados).
- [x] Item 6 do roteiro: removido o código de lançamento morto da página antiga do instrumento (a Pauta 2.0 é a única superfície) e o canal de escrita de deliberações do store de situação (fonte única: colegiado). 1.973 testes e tipos passaram.
- Diário funcionalmente encerrado. Restam só itens bloqueados por fatores externos: persistência/autorização real (Lovable Cloud), documentos A4/PDF (Cap. 15), regras reais homologadas pela rede (dado a ser fornecido).

- [x] Auditoria pré-Cloud do Diário (docs/auditoria-pre-cloud-diario.md)
- [x] Cloud ativado + cadeia usuário→pessoa→atuação→política→capacidades (vazia)
- [x] Login (e-mail e Google) + fronteira `session-authority.ts`
- [x] Parecer EI persistente (append-only + `officialize_descriptive_report` transacional) e catálogo BNCC (93) na base
- [ ] Confirmar identificadores `oficializar-parecer-descritivo` / `consultar-parecer-descritivo` (parecer não tinha capacidade no domínio)
- [ ] Jornada real no navegador — bloqueada: não há pessoa/atuação/política homologada real
- [ ] Migrar AssessmentEntryVersion + lotes da Pauta (próximo)

## Persistência — Resultados oficiais da Pauta (Cloud)
- [x] Capacidades confirmadas do parecer: `consultar-parecer-descritivo`, `oficializar-parecer-descritivo` (sem `editar-parecer`).
- [x] Tabelas append-only de versões de resultado e atos de lote; função transacional com capacidade `registrar-resultado-avaliativo` (leitura também por `consultar-resultado-avaliativo`).
- [x] Pauta e correção usam a sessão real quando há login; laboratório em memória só sem login.
- [ ] Pendência de integração: jornada navegador+banco (v1, v1→v2, Não registrado, conflito, lote, repetição, perda de capacidade, isolamento de turmas) — aguarda primeira pessoa+atuação+política homologada.
- [x] Fechamentos de período persistidos (ato + versão, append-only); Pauta e correção revalidam fechamento vigente e política de correção no banco.
- [x] Instrumentos institucionais persistidos; resultados com referência real.
- [ ] Tela de fechamento ainda mostra botões pelo perfil demonstrativo (o banco recusa sem capacidade) — trocar pela capacidade da sessão.
- [ ] Próximo no mapa: Conselho → sessões → atas → deliberações → situação acadêmica oficial.
- [ ] Cadastro de políticas de correção homologadas (tabela vazia ⇒ correção no Cloud falha fechada).

## Rodada persistência — Conselho e Situação (Implementado — aguardando bateria vertical real)
- [x] Fechamento: botões pelas capacidades reais da sessão
- [x] Status do instrumento persistido como ato
- [x] Conselho: configurações, ledger da sessão, deliberações, versões da ata
- [x] Situação acadêmica oficial + lotes
- [ ] Registro de aula (versões + retificação) — ainda no navegador
- [ ] Chamada (versões) e fechamento de frequência — ainda no navegador
- [ ] Registro qualitativo EI — ainda no navegador
- [ ] Encerramento do ciclo/turma — ainda no navegador
- [ ] Formulários reais de composição/pauta/deliberação do Conselho (atalhos demonstrativos desabilitados com sessão)
- [ ] Bateria vertical: aguarda conta → pessoa → atuação → política homologada

## Quatro famílias do Diário no Cloud (concluído, sem bateria vertical)
- [x] Registro de aula, chamada + fechamento de frequência, experiências EI e encerramento do ciclo gravam só no banco com sessão.
- [x] Conselho: formulários reais de composição, pauta e deliberação; condução sem capacidade declarada falha fechada na tela e no banco.
- [x] Auditoria SECURITY DEFINER: 5 auxiliares sem verificação de chamador tiveram execução revogada; os demais 20 verificam capacidade/pessoa (achado a confirmar na bateria vertical).
- [ ] Bateria vertical — bloqueio: não há nenhuma conta na base; aguarda dados reais da primeira cadeia (conta, pessoa, atuação, política, turma e estudantes).
- [x] Estudantes com login vêm só da fronteira institucional (estudante → matrícula → escola → turma → vigência); sem fonte, lista vazia.
- [x] Passada visual (1280/382 px) das cinco superfícies; formulários do Conselho ajustados ao celular.
- Fora do Diário ainda usam lista demonstrativa: Direção, Orientação, Secretaria (setores seguintes).
- Pendente na bateria: turmas/atuações pedagógicas do Diário ainda são demonstrativas no modo autenticado.

## Diário congelado estruturalmente
- [x] Com login: pessoa, atuação, turma, componente, período e estudante vêm 100% do banco; sem fonte ⇒ vazio. Sem login: laboratório.
- [ ] Bateria vertical — pré-requisito: dados reais da primeira cadeia (conta, pessoa, atuação, política, turma, estudantes), a fornecer pelo usuário.

## Fase A homologada · Diário congelado (persistência/autorização encerrada por ora)
Dependências EXTERNAS (não são pendências de implementação):
1. Períodos letivos oficiais de 2026.
2. Grade real de Língua Portuguesa do 6º ANO-600.
3. Data inicial da atuação da professora Juliana na turma.
4. Data inicial das enturmações dos 30 estudantes.
5. Referência e vigência do ato normativo que homologará a política de capacidades.
PENDENTE (não falha): sessão real da professora; conta→pessoa→atuação; leitura dentro/fora do escopo; escrita real sem capacidade; execução real das 13 funções de registro (hoje só inspeção de código); jornadas positivas da Fase B.

## Rumo ao CIECE (Cap. 14) — auditoria de leitura
- [ ] 14.0 — Auditoria/contrato do CIECE sobre a projeção canônica (12L): próximo prompt.
- [x] 14.1A — `CanonicalFact` + catálogo (uma fonte por tipo, granularidade, tempo) + guarda contra agregação; três ambiguidades resolvidas.
- [x] 14.1B — adaptadores puros + leitura real do banco (frequência, resultado do período, situação oficial, encerramento via 12L, episódios, atuações); sem sessão ⇒ vazio.
- [x] 14.1C — paridade semântica laboratório × banco e auditoria inversa (testes). Leitura real com dados: PENDENTE (dependências externas).
- [x] 14.1D — dimensões ausentes documentadas, sem tabela nova.
- [x] 14.1 congelada (critérios 1–8 atendidos por teste).
- [ ] 14.1.1 congelada; 14.2 congelada; 14.3 congelada; 14.4 próxima).
- [x] 14.2 — Motor Canônico de Indicadores (congelada).
- [x] 14.3 — Autorização, escopo e privacidade analítica (congelada; política de divulgação ainda não homologada).
- [x] 14.4 — Superfícies do CIECE (congelada; recongelada após 14.3.1).
- [x] 14.3.1 — Proteção contra reconstrução por totais (congelada).
- [x] 14.5 — Fonte institucional de matrícula, enturmação e movimentação (congelada).
- [x] 14.6 — Matrícula e movimentação no CIECE (congelada; nenhum indicador nem natureza homologados).
- [x] 14.7 — Fontes de sexo administrativo e turno (congelada; catálogos vazios, capacidades não concedidas). Pendentes: AEE, transporte, alimentação, endereço (domínios próprios).
- Decisão: Visitas Recebidas = fonte canônica futura "Registro Institucional de Visitas".
- [x] 14.13 — Registro Institucional de Visitas (capacidades não concedidas; 28/31 estrutura, 0/31 dados). AEE, Transporte, Alimentação: domínios futuros, não construir como campos. Próximo: carga institucional e homologações.
- [ ] 14.14 — Entrada em operação. Feito: inventário, matriz de capacidades p/ ato, tabela da cadeia piloto, catálogo de segurança + correção de idempotência antes da autorização (10 funções). BLOQUEADO (norma/dado da rede): ato da política, catálogos, períodos 2026, grade, datas de atuação/enturmação, regras de correção/acadêmicas → bateria real, 1º Mapa, carga das 55.

## Política de Capacidades — ARQUITETURA CONGELADA (29/09/2026)
- [x] 103 regras, 8 atuações, escopos, segregação autorizar≠executar confirmada pelo usuário
- [x] Sem novos ajustes abstratos; política permanece em rascunho, não homologada
- [ ] Bloqueados pela rede/Secretaria: ato de homologação, catálogos, períodos 2026, grade real, datas, contas → bateria vertical e cadeia Juliana
- [ ] Próximo desenvolvimento funcional independente de homologação: retomar 6D.3.2.7 (Pauta descritiva) e 6D.4.4b (botão de situação oficial)

## 6D.3.3 — Mesa Avaliativa: CONGELADA (29/09/2026)
- [x] 6D.3.3.6 fonte única: `assessment-period-sources.ts` (com sessão: instrumentos, versões, fechamentos e períodos institucionais do banco; sem sessão: laboratório). Regra e modelo pelo mesmo caminho do Fechamento; sem regra ⇒ resultado indisponível. Filtro por componente aplicado.
- [x] 6D.3.3.7 autorização: capacidades de `sessionActor` no escopo turma+período; valores exigem `consultar-resultado-avaliativo`; ações exigem `registrar-resultado-avaliativo`; "Corrigir" só encaminha à Pauta (caminho paralelo removido). Nenhuma capacidade nova.
- [x] 6D.3.3.8 EI inaplicável pelo grupo curricular declarado; 13 testes de paridade Pauta × Mesa × Fechamento; 382 px/200% sem rolagem horizontal.
- [ ] Reconciliação do Capítulo 6D entregue; aguarda decisão do usuário.
- [x] 6D.FINAL.1 persistência de regra/configuração avaliativa (sem normas cadastradas)
- [x] 6D.FINAL.2 Fechamento lê instrumentos/versões/regra/configuração/períodos do banco
- [x] 6D.FINAL.3 Consolidação lê do banco
- [x] 6D.FINAL.5 contagem, linha do tempo, política de frequência e regras de situação canônicas
- [ ] 6D resíduos: naturezas de ato/estados do encerramento, opções da projeção, catálogo de ocorrências de frequência (sem fonte persistente)

## Caminho crítico aprovado (29/09/2026)
- [x] B1 — IMPLEMENTAÇÃO CONCLUÍDA E CONGELADA / VALIDAÇÃO OPERACIONAL PENDENTE (bateria vertical)
- [ ] B2 — Cadastros acadêmicos estruturantes (B2.0–B2.4 e B2.5.1–B2.5.2 concluídas e congeladas; validação operacional da B2.5.2 pendente)
- [x] B2.4 — Anos letivos e Organizações de Períodos Letivos: implementação concluída, homologada tecnicamente e congelada; oito cenários SQL aprovados em transação revertida, migrations registradas na Cloud, 2.333 testes aprovados com quatro workers e build aprovado na `main`. Validação operacional com login institucional real pendente para a bateria vertical. No fechamento desta etapa, v1 = 108 e v2 = 114 regras, ambas `draft`, sem homologação de política; nenhum ano, organização, período ou vínculo Turma → Organização oficial cadastrado. A associação explícita pertence à etapa proprietária da Turma; Calendário reservado à B4.
- [x] B2.5.1 — Contrato e autorização de Turmas: implementação concluída e congelada / validação operacional com login institucional real pendente. Secretaria Escolar da própria escola; duas capacidades independentes (`manter-cadastro-de-turmas` e `manter-organizacao-de-periodos-da-turma`) somente na v2 `draft`, agora com 116 regras; v1 permanece 108 `draft`. Migration `20260930155129_b2_5_1_class_capability_contract.sql` aplicada e registrada na Cloud. O contrato preserva ID permanente, escola/ano estruturais, estados `ativa`/`inativa`, vigência separada, versões imutáveis e dois tempos (vigência e conhecimento). Nenhuma capacidade entrou em vigor, e nenhum cadastro funcional de Turmas, vínculo real ou dado oficial foi criado nesta microetapa. Catálogos/Classificação da Oferta: B2.6; reconciliação geral das telas demonstrativas: B2.7.
- [x] B2.5.2 — Identidade e histórico cadastral da Turma: implementação concluída e congelada / validação operacional com login institucional real pendente. PR #3 mergeado em `871a051806dc1ed3d217f9eb26a47baa51d52ca4`; migration `20260930185526_b2_5_2_class_record_history.sql` aplicada e registrada uma vez na Lovable Cloud. `institutional_classes` conserva ID, escola e ano estruturais imutáveis; `institutional_class_record_versions` guarda cadastro append-only; `class_at` lê vigência e conhecimento. Criação e correção validam escola oficial ativa e ano por segmentos temporais. Build e 139 arquivos / 2.333 testes passaram na `main` com dois workers. v1 = 108 `draft`, v2 = 116 `draft`, nenhuma política homologada; zero turmas, versões e vínculos. Consumidores legados e a dependência de alterações futuras do ano permanecem documentados em `docs/b2-5-2-turmas-historico-cadastral.md`. B2.5.3 não foi iniciada.
- [ ] B3 — Matrícula, enturmação e movimentação operacionais
- [ ] B4 — Grade/Horários e Calendário institucional versionado
- [ ] B5 — Portais Secretaria, Direção, Orientação sem demonstração com login
- [ ] B6 — Profissionais/RH e lotação
- Posteriores (capítulos próprios): AEE, Transporte, Alimentação, Responsáveis, Censo, Supervisão, Desempenho, Mediadores
- [x] Microetapa transversal — Sistema de Simbologia dos Calendários Escolares, com editor "Personalizar" e pré-visualização (reaberta e concluída). Na B4 a personalização passa, junto com o calendário, do navegador para o banco institucional.
- [x] Personalização do Calendário — concluída, homologada e congelada. Possui: configuração geral; sobrescritas opcionais de impressão por herança; tipografia e espaçamento por bloco; geometria e organização dos blocos; personalização dos marcadores; centralização geométrica das siglas; controle da grade; prévia Tela/A4; persistência; detecção de overflow A4; paginação sem perda de conteúdo. Prova final: PDF real com sobrescrita só de impressão (Feriados 4 pt/9 pt; Tela 6 pt/11 pt Times herdado), persistência após recarregar, prova inversa de herança, dois caminhos de impressão convergidos no mesmo renderizador, padrão restaurado; 2.300 testes.

## B3.3 — Posição curricular individual da alocação
- [x] Fato versionado/bitemporal na alocação, writer/reader/RLS, painel, testes SQL e TS
- [ ] D1 / catálogos de etapa-ano-fase (bloqueio institucional)

## B4.6.7 — Calendário institucional operacional
- [x] 7a: servidor não ignora efeito NULL declarado junto de true/false (0034; teste b466 corrigido + casos misto true/null e false/null)
- [x] Fatia 1: leitores positivos estritos (list/days/types/norm/calendar_at) + telas de lista e detalhe (grade mensal, totais por período)
- [x] Fatia 2: edição versionada, norma de exclusividade, homologar/revogar, importação 2027 do navegador (0035 snapshot de apresentação)
- [x] Fatia 3a: consumidores (aulas previstas, chamada, horários, fechamento período/frequência/ciclo, consolidação, documentos) ligados a calendar_composed_days_at por alocação canônica, um knownAt; 0036 eixo da posição B3.3 do estudante (teste Cloud b4_6_7c ok, rollback)
- [x] Fatia 3b: folha institucional (aparência do snapshot, dias/efeitos das declarações), títulos distintos por ano, seletores aluno/posição, anexar/retry sem nova versão, nova versão herda apresentação, leitura do navegador com erro≠ausência, DateInput; testes Cloud b4_6_7b e b4_6_7c salvos e ok (rollback)
- [ ] Agenda de conselhos: BLOQUEADA — falta capacidade institucional homologada para declarar tipos de conselho; councilRole preservado no original
- [ ] Fatia 4: instalação legítima
- [ ] Fatia 4: caminho legítimo de instalação (supervisao@sigem.itap.gov.br; sem criar conta/senha/pessoa/ato)

## B4.6.7 Fatia 4 — instalação legítima
- [x] Designação condicional supervisao@sigem.itap.gov.br (0037, não sobrescreve, origem auditada imutável)
- [x] Revisão obrigatória das regras (installation_review) + install_sigem_reviewed (e-mail confirmado, contagem revisada, confirmação); porta antiga fechada ao authenticated
- [x] Tela: regras por atuação, pré-requisitos do calendário 2027, caminho da importação preservada
- [x] Evidência do servidor preservada por alocação/dia/norma/versão; pertença por data (inscrição ∩ participação ∩ alocação)
- [x] Padrões de contas documentados (docs/sigem-contas-padrao.md)
- [ ] BLOQUEADO (humano): conta real criar+confirmar e-mail, executar instalação com ato/pessoa reais
- [ ] BLOQUEADO (dados): ano letivo, escolas com INEP, turmas, alocações, atuação da Supervisão em gestao-pedagogica-da-rede
- [ ] BLOQUEADO (norma): capacidade para declarar tipos de conselho (agenda de conselhos)
- [x] Folha institucional reproduz layout/documento salvo; contagem por cobertura integral

## B4.6.7f — Agenda de conselhos e ativação 2027
- [x] Papéis de conselho por versão (0039) + agenda real por alocação
- [x] Assistente de ano letivo/períodos a partir da fonte
- [ ] Instalação e ativação real — aguarda conta legítima, nome real e ato (usuário)
- [x] Conta da Supervisão como órgão (natureza do ator, 0040)
- [ ] Conta supervisao@ criada; aguarda confirmação do e-mail pela Supervisão

- [x] Frente A — varredura de act-required (0103/0104, docs/governanca-referencias-documentais.md)
- [x] Frente B — modelo/importador/operação técnica/UI de infraestrutura (0105)
- [ ] Frente B — carga real de infraestrutura (bloqueada: planilhas Aspectos_Infraestrutura_* e Censo_Escolar_2026_Preliminar não recebidas)
- [x] Frente C — contrato de staging/reconciliação de turmas
- [ ] Frente C — carga real de turmas (bloqueada: planilhas de turmas não recebidas; migration de autoria técnica a confirmar)
- [x] Execução técnica + carga das 55 escolas (0100)
- [x] Frente D — matching/contrato de profissionais
- [ ] Frente D — carga real (bloqueada: planilhas de profissionais não recebidas)
- [x] Frente E — contrato/reconciliação de jornadas
- [ ] Frente E — carga real (bloqueada: Todas as jornadas.xlsx + Frentes C/D)
- [x] Frente F — contrato/reconciliação de alunos
- [ ] Frente F — carga real (bloqueada: planilhas de alunos + Frente C)

## Censo 2026 — Frentes F/G
- [x] Frente C — stand-ins temporais neutralizados (0108)
- [~] Frente F — PARTIAL: pessoas/alunos/matrículas/vínculos observados; participação/alocação aguardam fonte de início efetivo
- [x] Frente G — reconciliação derivada (docs/reconciliacao-censo-escolar-2026.md)
- [ ] Frente E — BLOQUEADA: sem fonte de jornada profissional

## Frente U — Organização pedagógica 2027
- [x] R4/R6/R7/R8 decididos e documentados; gate de prontidão
- [x] Categoria de designação separada da posição; política versionada; reserva nunca reutilizada (0126)
- [x] Prévia para o Gabinete sem gravar; writer oficial só com política homologada
- [ ] Atos humanos: catálogos, matrizes E1–E3, decisão do Gabinete, jornada EI (bloqueado: ato humano)

## Rodada 2026-10-08
- [ ] NDEAD.1 — varredura de código morto (remover só com prova)
- [x] Calendário 2027: 11/10 letivo; 12/10 feriado Dia das Crianças; 13–14/10 recesso; 15/10 feriado Dia do Professor; 10/12 CC; 21/12 CF
- [ ] Dois novos modelos externos (Modelo 4 Matriz mês×dia com fundo fotográfico; Modelo 5 Quadro Anual) lendo do calendário interno, com personalização total (fonte, tamanho, espaçamento, dimensões, posição dos blocos)

## Em andamento (2026-10-08)
- [x] NDATE.1 — auditoria de datas/horários/timezone (só bugs técnicos)
- [x] Calendários externos: anexar imagem de fundo e ajustar; PNGs sobrepostos sem alterar estrutura; controle total de formatação

## Calendário — pedidos de 2026-10-08
- [x] Imagens grandes reduzidas automaticamente (sem erro de 1 MB)
- [x] Layout externo salvo em todos os calendários
- [x] Qualquer dia pode virar dia letivo (inclusive férias/recesso/FDS)
- [x] Trocar tipo/nome de feriado existente
- [x] Regular espelhado automaticamente no EJA Fase I
- [ ] NCOPY.2 — microtextos em linguagem simples (próximo)

## Pedidos do calendário (2026-10-08)
- [x] Feriado adicionado (ex.: 15/10 Dia do Professor) aparece na lista de feriados
- [x] Linha extra nos conselhos de classe: formatação (negrito) e escolha de posição/campo
- [x] Excluir modelos externos "Matriz com fundo fotográfico" e "Quadro Anual (layout livre)"
- [ ] "Externo - Panorâmico" e "Externo - Mosaico" iguais aos modelos internos e com layout livre
- [ ] Planilhas/PDFs enviados sem instrução: aguardam orientação (não importados)
- [x] NKEY.1 atalhos de teclado e foco

- [x] Calendário externo: excluir Panorâmico/Mosaico e criar modelo único de layout livre com imagem só no topo.
- [ ] N2026.IMPORT.5 — consumidores da base 2026 (não executado; pedido em seguida ao REFERENCE)
- [x] N2026.REFERENCE.2027 — Referência 2026 na Preparação 2027
- [x] Linhas da tabela do calendário externo visíveis no PDF em qualquer zoom

- [ ] Auditoria de cumprimento de todos os lotes (pedido 10/10)
- [ ] Nova tela de login institucional (especificação + imagens enviadas) — aguarda confirmação
- [x] R1: infraestrutura escopada, 48 estudantes, 49 turmas, 6 identidades (docs/r1-recuperacao-2026-10-10.md)
