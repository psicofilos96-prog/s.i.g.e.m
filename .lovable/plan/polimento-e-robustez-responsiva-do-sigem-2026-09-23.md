# Polimento e robustez responsiva do SIGEM

## Objetivo
Eliminar colisões, sobreposições e dependências de conteúdo curto sem alterar a identidade aprovada, regras, dados, rotas ou fluxos.

## Implementação

1. **Criar um padrão reutilizável de informações**
   - Introduzir um componente compartilhado para pares rótulo/valor.
   - Usar container queries para alternar automaticamente entre duas colunas flexíveis e empilhamento conforme a largura real do painel.
   - Garantir `min-width: 0`, quebra segura de palavras e altura determinada pelo conteúdo.
   - Aplicar ao resumo do registro, contexto/autoria do registro e listas de definição administrativas.

2. **Robustecer estruturas compartilhadas**
   - Ajustar cabeçalhos para títulos multilinha e ações que se reorganizam sem colisão.
   - Permitir que botões e badges com textos longos quebrem de modo controlado, preservando dimensões mínimas e ícones.
   - Melhorar breadcrumbs, filtros, chips, estados, linhas de agenda e seletores para conteúdo longo.
   - Manter rolagem horizontal somente dentro dos contêineres de tabelas; remover ocultação genérica de conteúdo das células.

3. **Adaptar painéis contextuais pela largura disponível**
   - Trocar colunas laterais rígidas do Diário por `minmax(0, 1fr)` + `clamp(300px, 25vw, 380px)`.
   - Ativar o painel lateral apenas quando houver espaço real; em larguras intermediárias e celulares, integrá-lo ao fluxo vertical.
   - Aplicar o mesmo princípio aos detalhes administrativos que usam painéis laterais estreitos.

4. **Cobrir conteúdo extremo e regressões**
   - Adicionar testes de componente com nomes institucionais, componentes e profissionais propositalmente longos.
   - Cobrir pares rótulo/valor, multilinha, badges, cabeçalhos, ações e tabela com conteúdo extenso.
   - Preservar integralmente os testes existentes.

5. **Validar em navegador**
   - Verificar 390, 768, 1024, 1280, 1366, 1440 e 1920px.
   - Conferir zoom equivalente a 125% e 150%.
   - Testar sidebar aberta e recolhida.
   - Inspecionar `/diario/registrar` em 1366×768 e confirmar visualmente o resumo sem sobreposição.
   - Revisar Diário, chamada, frequência, históricos e amostras dos módulos administrativos.

6. **Fechamento**
   - Executar testes, verificação de tipos, lint e build.
   - Atualizar o roadmap apenas com resultados efetivamente verificados.
   - Entregar causa raiz, componentes e páginas afetadas, estratégia, contagens, resultados e capturas.

## Limites preservados
- Nenhuma mudança de identidade visual, regra acadêmica, fixture funcional, permissão, rota ou comportamento.
- Nenhuma dependência pesada, persistência ou Etapa 11D.
