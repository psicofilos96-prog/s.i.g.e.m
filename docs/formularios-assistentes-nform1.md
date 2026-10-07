# NFORM.1 — Formulários e assistentes (2026-10-07)

Só apresentação/robustez; nenhuma regra de negócio alterada.

## Inventário
- Assistentes em etapas: Nova matrícula (8 etapas, rascunho no servidor com retomada), Nova turma (7 etapas, sem rascunho — criação curta), Recebimento da alimentação (3 passos).
- Primitivas: `FieldShell`, `FieldMessage`, `FieldHint`, `TaskFieldset`; controlador `createAutosave`.
- Obrigatório/opcional: padrão único "(obrigatório)"/"(opcional)"; nenhum `*` solto.
- Erros: junto ao campo (`role="alert"`, `aria-invalid`, `aria-describedby`); nenhum erro de formulário só em aviso flutuante.

## Corrigido
- Vocabulário: `ACTION.continuar`; "Avançar/Próximo/Seguinte" proibidos pela varredura; Recebimento passou a "Continuar". "Anterior" permanece só em paginação.
- Perda de conexão: autosave não tenta salvar sem conexão (estado "Sem conexão — o rascunho será salvo quando a conexão voltar") e salva a última versão ao reconectar (evento `online`), na matrícula e em todo `useAutosave`.
- Recuperação após erro: matrícula ganhou "Tentar novamente" quando o salvamento falha.
- Matrícula: cada etapa lista "Falta nesta etapa" junto ao conteúdo (antes só o ponto no indicador de passos).

## Mantido com justificativa
- `/matriculas/nova`: assistente em etapas com login; formulário único só no laboratório sem login (decisão vigente de separar demonstração). Não é monolito concorrente.

## Pendências
- PENDENTE: mensagem por campo (não só por etapa) dentro do assistente de matrícula; `aria-describedby` nas células da grade de avaliação.
- INTERACTIVE_BROWSER_VALIDATION_PENDING: teclado, celular e queda de rede com login real.
