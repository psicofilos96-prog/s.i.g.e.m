# Etapa 9C — Vínculos funcionais

## Objetivo

Completar a jornada `Pessoa → Profissional → Vínculo Funcional` dentro do detalhe de Profissionais, mantendo vínculo, cargo, lotação, função e atuação pedagógica como conceitos independentes.

## Implementação

- Criar fixtures e regras demonstrativas para primeiro vínculo, vínculos simultâneos, mesmo cargo sem duplicidade automática, histórico, ausência de matrícula/carga/enquadramento, cessão e atenção histórica.
- Criar `/profissionais/$id/vinculos/novo` como workspace por seções: profissional, contexto institucional, identificação funcional, cargo/enquadramento, carga, vigência, verificação, revisão e conclusão.
- Criar `/profissionais/$id/vinculos/$vinculoId` para consulta contextual do vínculo e `/editar` para manutenção isolada, preservando Pessoa, Profissional e registros históricos.
- Integrar “Novo vínculo funcional” e links para cada vínculo no detalhe aprovado do profissional, sem criar um módulo global paralelo.
- Tratar matrícula funcional como atributo do vínculo, Identificador SIGEM como atributo da Pessoa e duplicidade apenas por identificadores/contexto relevantes.
- Permitir múltiplos vínculos vigentes, inclusive de mesmo cargo, e vínculos encerrados consultáveis; término preserva o registro.
- Manter Lotação, Função, Atuação Pedagógica e encerramento jurídico apenas como áreas ou ações futuras, com “Registrar lotação” após a conclusão demonstrativa.
- Aplicar minimização, autorização futura, dirty state, saída protegida, revisão integral e feedback sem persistência.

## Detalhes técnicos

- Reutilizar `OperationalPageHeader`, `DetailSection`, `DefinitionList`, `StatusBadge`, diálogos e padrões de workspace existentes.
- Manter dados exclusivamente locais e fictícios; sem backend, banco, API, autenticação ou regras jurídicas municipais.
- Usar rotas file-based e navegação tipada com `to` e `params`, sem editar a árvore gerada.
- Atualizar o harness operacional e adicionar testes de rotas, pré-condições, simultaneidade, duplicidade, histórico, edição, privacidade e acessibilidade.

## Validação

- Preservar os 255 testes existentes e executar a suíte completa.
- Validar formatação, typecheck, lint, build automático e os fluxos centrais no navegador desktop.
- Registrar como pendências futuras as taxonomias normativas, lotações, funções, atuação pedagógica, encerramento jurídico e autorização real.