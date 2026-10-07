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
