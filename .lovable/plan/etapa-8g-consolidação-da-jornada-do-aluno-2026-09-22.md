# Etapa 8G — Consolidação da jornada do aluno

## Objetivo
Unificar a experiência das telas já existentes sem alterar o modelo acadêmico, criar novas operações ou transformar a jornada em um único formulário.

## Implementação
- Criar uma camada compartilhada de leitura da jornada para derivar situação atual, participação regular, outras participações, pendências e próxima ação exclusivamente dos dados fictícios existentes.
- Reorganizar `/alunos/$id` como ponto central operacional: identidade mínima, situação escolar atual, próxima ação, ações secundárias condicionais e histórico separado do contexto vigente.
- Refinar a trajetória em blocos temporais legíveis, com rótulos explícitos de “Atual” e “Histórico”, mantendo a estrutura técnica disponível sob expansão progressiva.
- Corrigir ações impossíveis ou redundantes e preservar `aluno`, `matricula` e `participacao` ao navegar entre ingresso, vínculo, enturmação, movimentação e transferência.
- Acrescentar, após conclusões demonstrativas, um próximo passo contextual que leve à operação independente seguinte; nenhuma tela será convertida em fluxo único.
- Uniformizar linguagem de pendências, estados sem dados e conflito, além do indicador e diálogo de alterações não salvas nos workspaces existentes.
- Ajustar os principais layouts para 1366×768 e notebooks menores, mantendo tabelas com rolagem própria, comparações legíveis e ações acessíveis por teclado.

## Componentes e dados
- Extrair somente padrões comprovadamente repetidos: resumo de contexto do aluno, próxima ação contextual, lista de pendências e detalhes técnicos expansíveis.
- Consolidar jornadas A–H por meio dos alunos fictícios existentes e, apenas onde houver lacuna real, adicionar o menor fixture necessário sem criar novo domínio.

## Validação
- Adicionar testes integrados das jornadas cadastro → ingresso → vínculo → enturmação, movimentação, transferência, histórico, Regular + AEE e aluno histórico.
- Cobrir ações condicionais, parâmetros preservados, terminologia, privacidade, acessibilidade, alterações não salvas e layouts principais.
- Preservar os 207 testes existentes e validar testes completos, build automático, typecheck e lint.

## Fora do escopo
Backend, banco, APIs, autenticação real, persistência, novas regras acadêmicas, reclassificação, diário, frequência, notas, horários, docentes, censo, responsáveis completos e alterações em Home, Login ou branding.
