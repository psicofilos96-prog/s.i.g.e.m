# Expansão visual da identidade SIGEM

## Objetivo

Levar a direção “Cinematic institutional mobile” já aprovada para os módulos restantes, sem reconstruir telas nem alterar dados, regras acadêmicas, rotas ou comportamentos.

## Implementação

1. **Fundação compartilhada**
   - Consolidar superfícies, seções, indicadores, estados, navegação contextual e padrões responsivos nos componentes existentes.
   - Reduzir bordas e cartões redundantes, preservando densidade e acessibilidade.

2. **Módulos administrativos**
   - Aplicar a linguagem às consultas e detalhes de Unidades, Matrizes, Turmas, Alunos, Profissionais, Vínculos, Lotações e Atuações Pedagógicas.
   - Refinar formulários e fluxos operacionais por agrupamentos semânticos, sem alterar validações.

3. **Horários**
   - Refinar consultas, grades, versões, comparações, revisão e publicação demonstrativa.
   - Preservar integralmente a leitura temporal e os estados já implementados.

4. **Diário Inteligente**
   - Refinar agenda, turmas, registro de aulas, histórico, chamada e frequência.
   - Manter a distinção entre previsto, registrado, rascunho, concluído e pendente.

5. **Validação e entrega**
   - Executar testes, verificação de tipos, lint e build.
   - Validar rotas representativas em desktop 1366×768 e celular 390px, incluindo ausência de rolagem horizontal.
   - Atualizar o roadmap com o escopo realmente concluído e limitações preservadas.

## Diretrizes técnicas

- Priorizar tokens e componentes compartilhados para evitar divergências entre módulos.
- Fazer apenas ajustes locais onde uma tela possui composição própria.
- Não adicionar dependências pesadas nem modificar APIs públicas dos componentes.
- Preservar fixtures, textos operacionais, permissões demonstrativas e todos os fluxos existentes.