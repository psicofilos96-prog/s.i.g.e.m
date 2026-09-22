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
