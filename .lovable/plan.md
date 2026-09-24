# Etapa 11F — Polimento final e encerramento do Diário

## Objetivo

Encerrar a Etapa 11 reduzindo fricção real nos percursos docentes, sem redesenhar o SIGEM, criar novos módulos ou alterar regras acadêmicas. O trabalho permanece demonstrativo, com fixtures e estado temporário na aba.

## Implementação

### 1. Auditoria de esforço e retornos
- Mapear os dez percursos A–J e registrar a contagem aproximada de interações antes/depois.
- Remover apenas seleções já conhecidas, páginas intermediárias sem valor e retornos genéricos; preservar revisão, dirty state e confirmações destrutivas.
- Padronizar os links de origem/retorno para manter data, atuação, escola, turma, componente e filtros nas sequências Diário → registro/experiência → chamada → origem e histórico → detalhe → histórico.

### 2. Contexto docente compacto
- Evoluir o seletor atual para um `DiaryContextSwitcher` reutilizável, sem fileira permanente de selects.
- Mostrar o contexto atual de forma editorial e oferecer alteração por atuação compatível: no desktop em popover; no mobile em sheet/drawer acessível já existente no Design System.
- Selecionar uma atuação como unidade coerente, inferindo escola, turma e componente; exibir vínculo somente quando necessário para desambiguar.
- Preservar a data e limpar dimensões incompatíveis na troca, impedindo vazamento de dados da atuação anterior.

### 3. Filtros progressivos e preservados na URL
- Criar um padrão compartilhado para consultas do Diário: busca/período essencial visível, filtros secundários recolhidos, resumo dos ativos, remoção individual e “Limpar filtros”.
- Aplicar em Histórico de aulas/experiências, Chamadas e Frequência.
- Ampliar apenas os schemas de busca dessas rotas e detalhes relacionados para que filtros e origem sejam preservados ao abrir e voltar.
- No mobile, apresentar filtros secundários em sheet/drawer; no desktop, em popover/painel compacto. Nenhuma biblioteca nova.

### 4. Página da turma como espaço de trabalho
- Substituir a composição provisória por leitura editorial baseada na camada `diary-journey`: identidade da turma e atuação, data, próxima ação, agenda relevante, registros recentes, situação das chamadas e acessos ao histórico/alunos.
- Reutilizar a mesma identidade e os mesmos estados da agenda, registro, chamada e histórico.
- Adaptar automaticamente a terminologia da Educação Infantil para experiência, campos e observações, sem disciplina, notas ou percentuais.
- Remover áreas desabilitadas e painéis preparatórios que não ajudam o trabalho atual.

### 5. Observações individuais da Educação Infantil
- Refinar a inclusão, edição, remoção e consulta de observações com labels explícitos, foco previsível após adicionar, confirmação ao remover conteúdo e retorno contextual.
- Garantir lista de crianças temporalmente elegíveis, estados sem observação, textos extensos e múltiplas observações sem aparência clínica ou quantitativa.
- Preservar privacidade, rascunho local e separação entre experiência, observação e chamada.

### 6. Polimento visual, densidade e ações
- Auditar todas as telas do Diário para reduzir cards, badges, bordas, selects e CTAs concorrentes, usando tipografia, divisores, alinhamento e espaçamento do Design System aprovado.
- Manter uma ação primária por tela quando houver próxima ação legítima e subordinar histórico, planejamento e demais acessos.
- Ajustar a densidade para 1366×768 sem alturas rígidas, truncamento indevido ou conteúdo oculto.

## Testes e validação

- Adicionar testes somente para os comportamentos consolidados: filtros progressivos/URL/limpeza/retorno; context switcher entre escolas, vínculos e atuações; data preservada e ausência de vazamento; página da turma e próxima ação; EI na turma e observações; mobile, deep link e retorno contextual.
- Executar suíte completa (mínimo 733 testes), typecheck, build e lint, preservando os seis avisos preexistentes.
- Após a última correção, reabrir Meu Diário, turma, registro, chamada, histórico, chamadas, frequência, context switcher desktop/mobile, experiência EI e observações individuais EI.
- Cobrir representativamente 390, 768, 1024, 1366×768, 1440 e 1920px; zoom 100%, 125% e 150%; sidebar aberta e recolhida; conteúdo extremo, filtros ativos e estados vazios.
- Verificar teclado, foco, Escape, retorno de foco, labels/ARIA, contraste, alvos de toque, ausência de overflow, clipping e sobreposição.

## Limites preservados

Sem backend, banco, API, autenticação/autorização reais, avaliações, notas, instrumentos, médias, recuperação, resultado acadêmico, frequência normativa, abonos, documentos oficiais, auditoria definitiva ou Módulo 12. A identidade visual aprovada não será redesenhada.
