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
- [ ] 12D — Acompanhamento avaliativo por aluno (plano apresentado; aguardando autorização)

