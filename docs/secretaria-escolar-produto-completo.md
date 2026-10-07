# Secretaria Escolar — checklist de produto (Lote N5)

| Requisito | Estado | Teste |
|---|---|---|
| A. Home "O que precisa de você hoje": alunos sem turma, pendências, matrículas sem data, ações rápidas; números secundários recolhidos | FEITO (secretariat-page.tsx) | school-secretariat + a11y |
| Escola/ano escolhidos sozinhos quando há só uma escola/ano aberto | FEITO | — |
| B. Busca por nome | NÃO — regra vigente: só CPF/INEP, busca registrada (minimização) | — |
| B. Cadastro em etapas, foto 3×4, dedupe | PENDENTE (rever /matriculas/nova) | — |
| C. Enturmação/saída/transferência | N5.2: enturmar escolhe da lista de turmas ativas da escola/ano (`eligibleClassOptions`); capacidade aparece como "não informada" (sem regra de capacidade, nunca zero); backend continua validando escopo | secretariat.test |
| D. Turmas/vagas/professores | PENDENTE | — |
| E/F. Documentos oficiais e Livro de Matrícula | só tipos com modelo homologado (DOCUMENT_TEMPLATE_PENDING) | PENDENTE |
| G. Avisos | /comunicacao-escolar existente; sem anexos (ATTACHMENTS_PENDING) | — |
| K. Testes com 2 Secretarias reais | exige aprovação de sessão | BLOQUEADO |

## N5.2 — situação por item
| Item | Situação |
|---|---|
| 1 Matrícula em 8 etapas, rascunho, dedupe, foto 3×4 | PENDENTE (não iniciado; dedupe atual = localizar por identificador exato) |
| 2 Enturmação sem código | FEITO (lista visual); turno/jornada na lista PENDENTE |
| 3 Turmas para a Secretaria | existente em /turmas (sem IDs na lista); filtros/multietapa/estudantes/professores na ficha PENDENTE |
| 4 Professor ↔ turma | existente em atribuição docente (B4.8); revisão de UX PENDENTE |
| 5 Vagas | PENDENTE; regra: "Capacidade não informada" nunca vira zero |
| 6 Livro de Matrícula | PENDENTE (sem sequência oficial no banco) |
| 7 Documentos | só tipos componíveis; demais TEMPLATE_INSTITUCIONAL_PENDENTE |
| 9 Testes com 2 escolas reais | não executados |

## Matrícula guiada (N5.2.1 + N5.2.2)
- `/matriculas/nova` (com sessão): Aluno, Responsáveis, Endereço, Documentos, Informações escolares, Ano letivo, Turma, Revisar e concluir. "Etapa X de 8", "Faltam N informações obrigatórias", salvando/salvo/erro, confirmação antes de concluir, ficha (vida escolar + foto) ao final.
- Obrigatório só o que a cadeia exige: nome + CPF ou INEP (aluno novo), ano, data de início, turma.
- Rascunho no banco (append-only, base esperada, CPF só HMAC + 2 dígitos); retomada; descarte confirmado apaga a foto do rascunho.
- Dedupe exato por CPF/INEP com "Usar este cadastro"; documento já cadastrado sem escolher o cadastro é recusado (nunca mescla).
- Foto 3×4 opcional: Adicionar/Trocar/Remover, "Tirar foto" no celular; tipo real pelos bytes (JPG/PNG/WEBP), até 5 MB; bucket privado, caminho `<escola>/<rascunho>/`; URL assinada curta. Na conclusão o MESMO objeto vira referência em `student_photo_versions` (sem cópia); foto vinculada não pode ser apagada.
- Turmas ativas na data com "Há vaga / Lotada / Capacidade não informada"; banco revalida escola, ano, data e turma ativa.
- Limites: foto de rascunho deixado aberto sem descartar fica até varredura técnica (sem rotina automática). Contas setoriais não geram `student_registration_events`; autoria fica no evento de conclusão.

## N5.3 — Vagas e Livro de Matrícula
- Vagas (`/secretaria/vagas`): por turma ativa, capacidade, enturmados, vagas e "Há vaga / Lotada / Capacidade não informada"; a enturmação usa a mesma fonte e só bloqueia turma lotada com capacidade conhecida.
- Livro (`/secretaria/livro-matricula`): lido das matrículas oficiais (sem segunda fonte), posição congelada no momento da abertura; pesquisa por nome/código, filtros turma/situação; PDF A4 e planilhas da mesma linha.
- Pendente de decisão: numeração oficial, assinaturas, prioridade de lista de espera.

## N5.3.1 — Nova turma
- Assistente de 7 passos em Turmas → Nova turma; criação tudo-ou-nada; turma simples ou multisseriada pelo catálogo homologado; capacidade opcional (em branco = "Capacidade não informada", zero recusado); ficha mostra composição, capacidade e professores.
- Pendente: vincular professores pela conta da Secretaria (writer exige pessoa natural; sem matriz/atuação docente cadastradas); composição ainda não lida por Mapa III/Diário.

## N5.3.2 — Professores, jornada e composição
- A Secretaria registra professores da turma como ATOR institucional (sem pessoa fabricada); o professor continua exigindo pessoa natural + atuação + vínculo + lotação na escola.
- Jornada opcional no assistente (criada na mesma transação) e editável na ficha, sempre como nova versão.
- Ficha mostra composição com subtotais pela posição individual do estudante; sem posição: "Posição curricular não registrada".

## N5.4 — Documentos, transferências, renovação
Ver `docs/secretaria-documentos-transferencias-renovacao.md`. Técnico: PASS na prova SQL; templates oficiais pendentes; validação no navegador pendente.

## N5.5 — Fechamento da estação (rodada 1)
| Item | Situação |
|---|---|
| 1 Histórico transversal | FEITO: `student_trajectory_at` (0226) inclui saídas de turma da Secretaria (`class_enrollment_episode_endings`) e encerramento da matrícula (`school_enrollment_endings`), com knownAt; mesma fonte, sem segunda trilha |
| 2 Pendências documentais | PENDENTE TÉCNICO: não há tabela/writer de pendência documental; lista obrigatória = DEPENDE_DECISAO |
| 3 Avisos | existente (`/comunicacao-escolar`, AJ); anexos ATTACHMENTS_PENDING; prévia/confirmação a revisar |
| 4 Serviços da escola | PENDENTE TÉCNICO: área "Serviços da escola" ainda não agrupada |
| 5 Programas sociais/PSE | DEPENDE_DECISAO |
| 6 Home | parcial (N5.1); contadores de documentos/serviços dependem de 2 e 4 |
| 7 Auditoria de rotas | PENDENTE |
| Browser | INTERACTIVE_BROWSER_VALIDATION_PENDING |

## N5.5.1 — pendências documentais (2026-10-07, migration 0231)
- `student_document_pendency_events` append-only (trigger), sem DML para ninguém; escrita só por `record_student_document_pendency` (abre como pendente; atualiza com base esperada; escola vem da matrícula; capability escolar `manter-matricula-e-enturmacao`); leitura só por `student_document_pendencies(_school)` (sem capability ⇒ vazio).
- Estados: pendente/recebido/inválido/vencido/dispensado; prazo opcional; sem prazo nunca é atraso. Nenhuma lista de obrigatórios (DEPENDE_DECISAO); anexos ATTACHMENTS_PENDING.
- UI: painel "Documentos pendentes" na vida escolar do aluno, com histórico.
- Testes: `document-pendencies.test.ts` 4/4; secretaria+privacidade+invariantes 68/68; typecheck limpo. Execução real com sessão (A/B) NÃO feita.
- Abertos: comunicação multi-turma, Serviços da escola, contagem na home, auditoria de rotas, gates completos. Sem PASS.
