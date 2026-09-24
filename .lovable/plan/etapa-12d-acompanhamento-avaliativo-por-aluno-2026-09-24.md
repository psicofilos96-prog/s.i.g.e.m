# Etapa 12D — Acompanhamento Avaliativo por Aluno

Visão longitudinal do percurso avaliativo de cada estudante, derivada das entidades das Etapas 12A–12C. Sem segunda fonte de dados, sem cópia de lançamentos, sem nenhum cálculo acadêmico.

## O que a tela entrega

Uma leitura de trajetória, não uma planilha aluno × período × instrumento. Três níveis de profundidade:

1. **Identidade e colocação** — aluno, identificador SIGEM, ano letivo, turma, componente/campo, situação da colocação acadêmica na data consultada e origem do calendário (oficial ou legado demonstrativo).
2. **Régua de períodos** — uma faixa por período oficial do calendário homologado, com: instrumentos aplicados, quantos lançamentos registrados, quantos pendentes, quantos não registrados com motivo, quantos corrigidos. No lugar de qualquer síntese numérica: **"Resultado ainda não consolidado"**.
3. **Detalhe sob demanda** — abrir um período expande seus instrumentos; abrir um instrumento mostra o lançamento com valor exibido conforme a escala, data, responsável, contexto da época e, quando houver, as versões anteriores da correção com justificativa.

Nada de rolagem infinita: períodos fechados por padrão, exceto o período corrente.

## Casos que a tela precisa tratar corretamente

| Situação | Tratamento |
| --- | --- |
| Mudou de turma no período | A trajetória é montada pelas alocações; cada instrumento aparece sob a turma vigente na sua data de aplicação. Nenhum registro da turma anterior desaparece. |
| Transferido durante o ano | Períodos após o encerramento aparecem como encerramento de percurso, sem gerar pendência. |
| Ingressou depois do instrumento | Marcado como não elegível na data — ausência legítima, não pendência. |
| Instrumento aplicado antes do vínculo | Fica em seção informativa; não entra na contagem do aluno. |
| Lançamento corrigido | Marca "corrigido" com acesso às versões anteriores, valor antigo, data e justificativa. |
| Renomeação posterior de período, instrumento ou tipo | A leitura histórica usa o snapshot gravado no lançamento, com o rótulo atual apenas como referência secundária. |
| Escalas quantitativa, conceitual, descritiva | Exibição pela escala da configuração; nunca converter conceito ou descrição em número. |
| Acompanhamento / Educação Infantil | Quando `usesPedagogicalRecords` é verdadeiro e `allowsGrades` falso, a tela troca instrumentos por linha do tempo de experiências, campos e observações individuais já existentes no Diário. Nenhum instrumento, nota, média ou conceito é inventado. |
| Consulta histórica | Seleção de ano letivo e componente; o passado é lido como foi registrado. |
| Ausência legítima × pendência | Legítima: não elegível na data, ou "não registrado" com motivo. Pendência: elegível na data, instrumento aplicado, lançamento ainda vazio ou em rascunho. |

## Rotas propostas

- `/diario/turmas/$turmaId/alunos/$alunoId/avaliacao` — percurso do aluno no contexto da turma e do componente do professor. Acesso a partir da lista de alunos da turma e da pauta do instrumento.
- `/alunos/$id` — novo acesso contextual "Percurso avaliativo", levando à mesma visão no contexto vigente (Direção e Supervisão).

Sem rota nova de documento: Boletim, Ficha Individual e Folha Final permanecem fora desta etapa.

## Detalhes técnicos

Novo módulo de projeção pura `src/features/assessment/assessment-student-journey.ts`, sem estado próprio e sem escrita:

- `buildStudentJourney(...)` cruza `studentPlacements` / `eligibilityInPeriod` (12A), períodos oficiais de `calendar-queries` + `calendar-assessment-link` (12B.1/12B.2), instrumentos e lançamentos de `assessment-instrument-store` (12C) e a configuração de `assessment-configuration`.
- `periodSummary(...)` classifica por período: registrado, pendente, não registrado com motivo, corrigido, não elegível. Contagens de itens — nunca média, soma, peso ou situação.
- Telas em `assessment-student-journey-pages.tsx`, reusando `StatusBadge`, `StatePanel` e os padrões de filtro e navegação já aprovados.

Nenhum tipo novo com campo normativo. Nada de média de período ou anual, soma de pontos, pesos, arredondamento, recuperação, substituição, resultado final, aprovação/reprovação, dependência, efeito de frequência ou decisão de Conselho.

## Testes

- Mudança de turma no meio do período mantém os registros das duas turmas nas datas certas.
- Aluno transferido não gera pendência depois da saída.
- Ingresso posterior aparece como não elegível, nunca como pendência.
- Correção preserva versões e justificativa.
- Renomear período, tipo ou instrumento não altera a leitura histórica.
- Educação Infantil mostra acompanhamento pedagógico e nenhum instrumento, nota ou conceito.
- Nenhum valor consolidado aparece na interface.
- Interface em 390, 1366 e 1920 px, com acessibilidade e conteúdo extremo.

## Fora de escopo

Boletim, Ficha Individual, Folha Final e demais documentos; qualquer cálculo ou situação acadêmica; backend, persistência e autorização real.
