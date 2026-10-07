# Secretaria Escolar — checklist de produto (Lote N5)

| Requisito | Estado | Teste |
|---|---|---|
| A. Home "O que precisa de você hoje": alunos sem turma, pendências, matrículas sem data, ações rápidas; números secundários recolhidos | FEITO (secretariat-page.tsx) | school-secretariat + a11y |
| Escola/ano escolhidos sozinhos quando há só uma escola/ano aberto | FEITO | — |
| B. Busca por nome | NÃO — regra vigente: só CPF/INEP, busca registrada (minimização) | — |
| B. Cadastro em etapas, foto 3×4, dedupe | PENDENTE (rever /matriculas/nova) | — |
| C. Enturmação/saída/transferência | existente; enturmar ainda pede identificador da turma → trocar por lista | PENDENTE |
| D. Turmas/vagas/professores | PENDENTE | — |
| E/F. Documentos oficiais e Livro de Matrícula | só tipos com modelo homologado (DOCUMENT_TEMPLATE_PENDING) | PENDENTE |
| G. Avisos | /comunicacao-escolar existente; sem anexos (ATTACHMENTS_PENDING) | — |
| K. Testes com 2 Secretarias reais | exige aprovação de sessão | BLOQUEADO |
