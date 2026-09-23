# Etapa 9B — Cadastro e identidade profissional

## Objetivo

Criar a experiência demonstrativa de cadastro e edição de **Pessoa → Profissional**, resolvendo primeiro a identidade canônica da Pessoa e sem criar ou alterar Vínculo Funcional.

## Entrega

- Criar as rotas `/profissionais/novo` e `/profissionais/editar/$id`, com metadados próprios e workspace dedicado por seções.
- Ativar **Novo profissional** na consulta e **Editar cadastro** no detalhe, preservando integralmente a estrutura visual e os conteúdos aprovados na Etapa 9A.
- Implementar as seções: Localizar Pessoa, Confirmar identidade, Dados cadastrais, Identificadores, Verificação de duplicidade, Papel Profissional, Revisão e Conclusão demonstrativa.
- Permitir pesquisa demonstrativa no cadastro mestre por nome, nome social, identificador SIGEM, CPF e identificador externo, sempre com resultados minimizados.
- Cobrir quatro decisões principais:
  - nenhuma Pessoa encontrada: preparar Pessoa nova + papel Profissional;
  - Pessoa existente sem papel Profissional: reutilizar a Pessoa e adicionar somente o papel;
  - Pessoa já Profissional: impedir duplicação e oferecer acesso ao cadastro existente;
  - Pessoa já Aluno: preservar os papéis distintos `Aluno` e `Profissional` na mesma identidade.
- Representar CPF como identificador civil opcional e mascarado, nunca como chave primária universal; manter o identificador SIGEM único da Pessoa.
- Implementar correspondências demonstrativas forte, possível e homônimo, com revisão e decisão humana; nunca fundir, sobrescrever ou selecionar automaticamente.
- Manter o cadastro profissional livre de matrícula funcional, empregador, cargo, enquadramento, lotação, função, escola, turma e atuação pedagógica.
- Tratar **Profissional sem vínculo funcional** como estado válido e exibir **Próximo passo: criar vínculo funcional** apenas como ação futura desabilitada.
- Na edição, distinguir correção cadastral de alteração historicamente relevante, preservar vínculos existentes como somente leitura e informar que fatos/documentos anteriores não são reescritos.
- Aplicar o padrão consolidado de alterações não salvas, confirmação de saída, revisão e conclusão sem persistência.

## Dados demonstrativos

- Criar fixtures isolados e integralmente fictícios para os cenários A–J solicitados.
- Reutilizar conceitualmente as Pessoas e Profissionais da Etapa 9A quando houver correspondência, sem modificar seus vínculos funcionais.
- Não exibir endereço, filiação, telefone, dados bancários, saúde, família ou documentos completos no fluxo.

## Componentes e integração

- Criar um módulo de rascunho/fixtures para identidade profissional e um componente de workspace específico.
- Reutilizar `OperationalPageHeader`, `DetailSection`, `DefinitionList`, `StatusBadge`, diálogos e controles do Design System.
- Ampliar somente os pontos necessários na consulta, detalhe e harness de rotas; Home, Login, App Shell, branding e bloco Aluno permanecem inalterados.

## Validação

- Adicionar testes para entrada pelas ações contextuais, busca e seleção de Pessoa, nova identidade, múltiplos papéis, prevenção de duplicação, CPF opcional/mascarado, matching e decisão humana, ausência dos conceitos funcionais, edição isolada, revisão, conclusão, próxima ação, dirty state, privacidade e acessibilidade básica.
- Preservar os 231 testes existentes e executar a suíte completa, build, typecheck e lint.
- Validar no navegador os fluxos centrais de Pessoa nova, Pessoa existente e edição, incluindo console e apresentação visual.

## Fora de escopo e decisões abertas

- Sem backend, persistência, API, autenticação real ou operação funcional.
- Sem criação de Vínculo Funcional, matrícula funcional, cargo, enquadramento, lotação, função, atuação pedagógica ou atribuição docente.
- Permanecem abertas para etapas futuras as regras definitivas de matching, taxonomias cadastrais, autorização institucional, auditoria jurídica e o workspace de Vínculo Funcional da Etapa 9C.