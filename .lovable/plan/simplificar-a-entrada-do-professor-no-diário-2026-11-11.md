# Simplificar a entrada do professor no Diário

## Objetivo
Quando o professor entra, ele vê só o que usa no dia a dia, sem termos técnicos. O resto do sistema continua igual por trás. Nenhuma regra, dado ou permissão muda: só a forma de mostrar.

## Hoje
O Diário tem mais de 40 telas separadas (aulas, chamadas, registros, frequência, avaliação com pauta, instrumentos, período, consolidação, conselho, fechamento, projeção, encerramento, livro, folha final, documentos, planejamento, meus diários...). O professor precisa saber onde fica cada coisa.

## Como vai ficar

### 1. Tela inicial do professor ("Minhas aulas")
- No topo: "Hoje, terça, 10/11" e a lista das aulas do dia (turma, disciplina, horário).
- Cada aula tem três botões grandes: **Fazer chamada**, **Registrar aula**, **Ver alunos**.
- Aula já feita mostra um sinal "Feito" em vez do botão.
- Logo abaixo: "Pendências" (chamadas ou registros de dias anteriores ainda não feitos), com um botão para resolver cada uma.

### 2. Menu do professor com 6 itens só
1. Minhas aulas (início)
2. Chamada
3. Registro de aula
4. Planejamento
5. Notas
6. Minhas turmas (alunos e documentos)

Telas de fechamento, conselho, consolidação, livro e folha final saem do menu do professor e aparecem só dentro de "Minhas turmas", quando o período estiver no momento de fechar.

### 3. Notas simplificadas
- Escolher turma → disciplina → período → ver a lista de alunos com uma coluna por avaliação.
- Botão "Nova avaliação" (nome, data, valor) direto ali, sem tela separada de "instrumento".
- Palavras como "pauta", "instrumento" e "consolidação" trocadas por "notas", "avaliação" e "média do período".

### 4. Planejamento
- Escolher turma e disciplina, escrever o plano da semana/mês, salvar. Lista dos planos anteriores logo abaixo.

### 5. Linguagem
- Revisar todos os textos dessas telas: tirar explicações longas, avisos técnicos e códigos; mensagens curtas como "Chamada salva" ou "Faltam 3 alunos".

## Verificação
- Entrar como prof.teste1@ (Camila, Turma 10) e fazer, de ponta a ponta: chamada de uma aula, registro dessa aula, um planejamento e uma nota. Conferir que tudo aparece depois de recarregar.
- Conferir que a Secretaria e o CIECE continuam vendo os mesmos dados.

## Detalhes técnicos
- Nova tela inicial reaproveita `lesson-central.ts`/`next-lesson-card.tsx` e `teacher-agenda.ts` (grade publicada × atribuição vigente); sem fonte nova.
- Menu do docente em `navigation.ts`/navegação por posto reduzido a 6 entradas; rotas antigas continuam existindo (links internos e redirecionamentos), sem apagar nada.
- Notas: tela única sobre `teacher-grades.ts` e o writer `register_assessment_results`; criação de avaliação embutida usando o mesmo fluxo de instrumento.
- Planejamento reutiliza a rota `/planejamento` existente, só com layout novo.
- Sem migrations; sem mudança de RLS; testes existentes do Diário precisam continuar passando, e um teste novo garante que o menu do professor tem só os 6 itens.
