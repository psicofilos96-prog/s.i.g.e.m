# Human Interface Language — SIGEM 2.0

> Documento normativo da experiência. Consolidado na Etapa 13UX · Rodada 5 a partir do
> piloto aprovado `/alunos/novo`. Vale para toda tela nova; as telas existentes só serão
> migradas mediante autorização explícita, rodada por rodada.

---

## 1. Princípio fundamental

**O domínio pensa como máquina. A interface conversa como pessoa.**

Três camadas, nesta ordem, sem atalho entre a primeira e a terceira:

```text
Domínio (máquina)        →  Tradução de interação      →  Interface humana (pessoa)
fatos, políticas,           rótulos, ordem, requisito      "Cadastrar aluno",
capacidades, versões        pendente, próxima ação         "Para avançar, informe a data"
```

Consequências obrigatórias:

- A camada de apresentação **não relaxa nenhuma regra**: validação, capacidade, vigência,
  homologação e versionamento continuam integralmente no domínio.
- A camada de domínio **não dita vocabulário de tela**. Nenhum identificador, nome de
  entidade ou conceito de modelagem aparece na superfície operacional por falta de tradução.
- Toda tradução vive em módulo próprio de apresentação (ex.: `person-presentation.ts`,
  `presentation-labels.ts`), nunca embutida no motor.

## 2. Níveis de revelação

| Nível | Serve para | Onde aparece |
| --- | --- | --- |
| 1 — Agir | fazer a tarefa agora | superfície primária: título, campos, ação dominante |
| 2 — Compreender | entender por que algo está assim | uma linha próxima ao elemento, sob demanda leve |
| 3 — Fundamentar | auditoria, norma, versão, escopo, LGPD | `InstitutionalDetails` / painel institucional |

Regra: **nunca** promover nível 3 para nível 1. Regra inversa também vale: nível 3 nunca é
suprimido — ele existe, íntegro, a um clique.

## 3. Tom de voz

- Verbo concreto no rótulo: *Cadastrar aluno*, *Conceder prazo*, *Conferir cadastro encontrado*.
- Vocabulário da escola, não da arquitetura: "aluno", "turma", "matrícula", "prazo", "responsável".
- Proibido na superfície operacional: *identidade humana canônica*, *papel educacional*,
  *projeção operacional autorizada*, *fato canônico*, *alternativa admissível*,
  *efeito institucional*, *executor competente*, *motor de sinais*.
- Permitido e desejável no nível 3, onde é precisão e não jargão.
- Microcopy orienta, não legisla: "se souber", "se houver", "quando a pessoa utilizar",
  em vez de "(opcional)" / "(obrigatório)".

## 4. Hierarquia de ações

| Papel | Forma | Quantidade |
| --- | --- | --- |
| Primária | botão sólido, alvo ≥ 48 px, à direita ou no fim da tarefa | **uma** por contexto |
| Secundária | contorno | poucas, relacionadas |
| Terciária | texto/ghost | apoio, consulta, auditoria |
| Saída/risco | ghost neutro + confirmação | isolada das demais |

Duas ações de mesmo peso no mesmo contexto é defeito, não escolha estética.

## 5. Formulários humanos

Toda tela de formulário responde visualmente, sem leitura de manual:

1. Onde estou? 2. O que faço agora? 3. O que é exigido e o que não é?
4. Algo me impede? 5. Posso voltar ou sair sem perder trabalho? 6. Qual é a próxima ação?

Regras de validação:

- Nada de erro antes de interação: a mensagem do campo só aparece após `blur` (estado `touched`).
- Mensagem de requisito é condução: `StepGuidance` escreve "Para avançar, informe …" e
  **desaparece** quando satisfeita, deixando a ação primária sozinha em destaque.
- Sem `ERRO:`, sem caixa vermelha de despedida, sem asterisco como única informação.
- Transparência de persistência: se o preenchimento vive apenas em memória, dizer isso com
  clareza antes da saída. Nunca simular salvamento automático.

Primitivas: `TaskFieldset`, `FieldHint`, `FieldMessage` (`src/components/sigem/human-workflow.tsx`).

## 6. Stepper e fluxos multietapas

Usar `StepRail` quando existir sequência mental legítima (3 a 5 etapas curtas). Não usar para
formulário curto, para tela de consulta nem para fracionar densidade especializada.

Exigências: trilho contínuo; etapa concluída com marca e retorno livre; etapa atual com anel e
rótulo destacado; etapas futuras discretas; `aria-current="step"`; nenhum texto redundante do
tipo "Etapa 2 de 4" quando o trilho já comunica isso.

## 7. Semântica de estados

Estado é traduzido antes de ser exibido. Identificador interno (`aguardando-deliberacao`,
`pendente-de-definicao`, UUID, kebab-case) **nunca** vai para badge, título ou lista.

Escala semântica: informativo · em andamento · atenção · impedimento · sucesso · indisponível.
Cor nunca é o único portador: forma, ícone e palavra acompanham.

## 8. Indisponibilidade consciente

Ausência de dado nunca é zero, nunca é estimativa, nunca é traço solitário. Um item indisponível
declara, em linguagem humana: **o que falta**, **de quem depende** e **o que muda quando existir**.

Errado: `Indisponível agora` · `Inconclusivo:` · `—`
Certo: "Ainda não há regra de situação homologada para esta turma; a Supervisão precisa homologá-la
antes de o resultado ser calculado."

## 9. Permissão e competência

Nunca ocultar indiscriminadamente. Quatro casos distintos:

| Caso | Tratamento |
| --- | --- |
| Irrelevante no contexto | não apresentar |
| Sem capacidade do agente | apresentar em forma secundária, com explicação humana + "Entenda por quê" |
| Impedida pelo processo | apresentar com o requisito que falta |
| Protegida (sigilo) | não revelar a existência do conteúdo |

Primitiva: `ActionDisclosure`. Cargo não autoriza: a explicação cita capacidade, escopo,
vigência e política — no nível 3.

## 10. Decisão institucional

Toda mesa decisória apresenta, nesta ordem: **objeto** · **por que chegou aqui** · **fatos
considerados** · **alternativas admissíveis (em linguagem de escolha)** · **o que cada escolha
produz** · **fundamentação exigida** · **registro do ato**. Sem regra exigente, sem alternativa
ou sem competência vigente, a tela explica o impedimento e não oferece decisão.

## 11. Sucesso e continuidade

Conclusão não é beco sem saída. A tela de sucesso traz: confirmação clara, o que exatamente
passou a existir, **o que não** passou a existir, e próximas ações contextuais **apenas quando
autorizadas** pelo contexto real.

## 12. Densidade adaptada ao trabalho

| Perfil | Público | Característica |
| --- | --- | --- |
| Operacional | secretaria, atendimento, professor no dia | baixa carga, poucos campos, ação óbvia |
| Analítico | coordenação, direção | hierarquia forte, agrupamento por assunto |
| Especializado/normativo | Supervisão, colegiado | alta densidade legítima, vocabulário técnico preservado |

Densidade alta não é defeito quando corresponde à tarefa e ao público.

## 13. Convenções do App Shell

Rotinas do dia primeiro; funções normativas atrás de revelação progressiva ("Mais funções").
Busca global (ir a lugares e coisas, `Ctrl+K`) é distinta de busca local (filtrar a lista desta
tela). Nada de controle técnico ou botão de teste na barra superior; simulação vive em painel
próprio e discreto.

## 14. Acessibilidade inegociável

Teclado em todo o fluxo com foco visível; alvo mínimo 44–48 px; texto base ≥ 16 px; contraste
WCAG AA no mínimo e AAA no texto corrido; zoom 125% e 200% sem perda de conteúdo ou função;
reflow em 382 px; semântica nativa (`nav`, `section`, `label`, `role="status"`, `aria-current`);
data sempre DD/MM/AAAA na tela, ISO apenas internamente.

## 15. Tabela de equivalências

| Domínio / código | Interface humana |
| --- | --- |
| identidade humana canônica / papel educacional | o cadastro do aluno |
| projeção operacional autorizada | o que está sob sua responsabilidade hoje |
| `processStateDefinitionId: aguardando-decisao-institucional` | Esperando decisão da Direção |
| alternativa admissível | o que você pode decidir aqui |
| efeito institucional declarado | o que acontece se você escolher isso |
| executor competente | quem pode fazer isso |
| capacidade efetiva ausente | Você não tem permissão para esta ação |
| resultado inconclusivo | Ainda falta algo para concluir: … |
| requisito obrigatório não satisfeito | Para avançar, informe … |
| `mutabilityDefinitionId` | o que ainda pode ser alterado |

## 16. Guia de aplicação a um novo fluxo

1. Escreva as 6 perguntas do §5 e responda-as com o layout, não com texto explicativo.
2. Liste os termos do domínio envolvidos e traduza cada um em módulo de apresentação.
3. Escolha o perfil de densidade (§12) antes de desenhar.
4. Defina a única ação primária.
5. Coloque norma, auditoria e versão no nível 3.
6. Verifique: teclado, zoom 200%, 382 px, ausência de dado, ausência de permissão, conclusão.

## 17. Inventário observacional de dívida de UX

Levantamento de leitura, **sem nenhuma alteração de tela**. Critério aplicado: linguagem técnica
e alta densidade **não** são dívida quando pertencem legitimamente à tarefa e ao público.
Casos duvidosos ficam como *requer avaliação*.

Categorias: A vazamento de arquitetura · B excesso no primeiro plano · C hierarquia de ação
confusa · D estado técnico exposto · E explicação insuficiente · F validação hostil ·
G densidade inadequada · H ação sem continuidade · I auditoria competindo com a rotina ·
J inconsistência de componentes.

### Achado transversal (prioridade máxima)

O par **"identidade humana canônica / papel educacional"** é copy de produto em telas de uso
amplo: `students-list-page.tsx:239`, `students-data.ts:145`, `student-detail-page.tsx:455`,
`professional-detail-page.tsx:281`. E o disclaimer **"projeção operacional autorizada sobre os
fatos canônicos"** está replicado em `secretaria.tsx:11,17`, `direcao.tsx:11,17`,
`orientacao.tsx:11,17` e `guidance-workspace-page.tsx:189` — inclusive em metadados de página,
visíveis em título de aba e prévia de link. Categoria **A**, sistêmico.

### Por família

| Família (densidade) | Cat. | Evidência | Nota |
| --- | --- | --- | --- |
| Alunos — listagem/ficha (operacional) | A | `students-list-page.tsx:239`; `student-detail-page.tsx:455` | conceito de modelagem como descrição da página |
| Alunos — listagem (operacional) | I | `students-list-page.tsx:270,278,281-286` — "Filtros conceituais demonstrativos…", nota de minimização entre filtro e tabela | auditoria/proveniência à frente da consulta |
| Alunos — listagem (operacional) | requer avaliação (C) | `students-list-page.tsx:242-251` — duas ações no cabeçalho | há diferenciação visual; decidir pela frequência real de uso |
| Matrículas / vínculos letivos (operacional) | C | `enrollment-workspace-page.tsx:110-117` — rótulo primário variável com botões de mesmo peso | falta reforço visual da ação dominante |
| Matrículas (operacional) | requer avaliação (H) | `enrollment-workspace-page.tsx:~1039-1050` — conclusão em estado local | confirmar continuidade após concluir |
| Enturmações (operacional) | J | `allocation-workspace-page.tsx` usa `DateInput`; `assignment-workspace-page.tsx`, `posting-workspace-page.tsx`, `pedagogical-workspace-page.tsx` usam `type="date"` nativo | duas capturas de data no mesmo produto |
| Enturmações (operacional) | requer avaliação (A/E) | `class-allocation-capacity.ts:217`, `class-allocation-governance.ts:160` — "não declarou efeito institucional" | confirmar se a frase chega à tela |
| Transferências (operacional) | requer avaliação (C/H) | `transfer-workspace-page.tsx:191-200,255-267,508` — muitas ações concorrentes; desvio a `/alunos/novo` no meio da tarefa | verificar ação dominante e retorno ao contexto |
| Diário / avaliação (especializado) | E | `—` como ausência em `assessment-instrument-pages.tsx:554`, `assessment-rule-pages.tsx:289,765`, `assessment-structure-page.tsx:154`, `assessment-student-journey-pages.tsx:326`, `cycle-consolidation-pages.tsx:50`, `period-closing-pages.tsx:356` | traço não diz o que falta |
| Diário / avaliação (especializado) | requer avaliação (D) | `academic-standing-types.ts:479-492`, `cycle-consolidation-types.ts:133,141` — estados em kebab-case | confirmar tradução antes do badge |
| Diário — dependências documentais | E | `document-dependencies.ts:87` — rótulo "Indisponível" sem motivo | falta causa e dependência |
| Normas / Supervisão (especializado-institucional) | sem dívida | vocabulário normativo em regras avaliativas, regras de situação, matrizes, calendário, colegiado | terminologia compatível com a competência do público |
| Orientação (analítico) | A | `guidance-workspace-page.tsx:189` — "projeção operacional autorizada sobre os fatos canônicos" | descrição renderizada da página |
| Orientação (analítico) | E | `guidance-workspace-page.tsx:72` — "Indisponível agora" | não diz o que desbloqueia |
| Direção (especializado-institucional) | D | `leadership-workspace-page.tsx:136` — badge com `processStateDefinitionId`; `:551` — "Mutabilidade declarada: {mutabilityDefinitionId}" | identificador cru na superfície |
| Direção | A + D | `leadership-workspace-page.tsx:168` — "(competente: {competentExecutorDefinitionId})" | termo de arquitetura + id |
| Direção | E | `leadership-workspace-page.tsx:101,167` — "Indisponível agora", "Inconclusivo:" | sem causa nem requisito |
| Direção | requer avaliação (A) | `leadership-workspace.ts:445` — "nenhuma alternativa admissível para este agente nesta data" | confirmar se é mensagem de tela |
| Secretaria (operacional) | J | `secretary-workspace-page.tsx` usa `WorkSurface`/`RailCard`/`AwarenessBand`; alunos, matrículas, turmas, profissionais e transferências usam `OperationalPageHeader` | duas linguagens para o mesmo tipo de tela |
| Profissionais (operacional) | A | `professional-detail-page.tsx:281` — "Pessoa é a identidade humana canônica; Profissional é um papel institucional" | mesmo vazamento de Alunos |
| Profissionais (operacional) | requer avaliação (B/G) | `professional-detail-page.tsx` — ficha agrega identidade, vínculos, lotações, funções, atuações e histórico | medir carga acima da primeira dobra |
| Profissionais (operacional) | requer avaliação (F) | "Vínculo funcional existente obrigatório" em `assignment-workspace-page.tsx:89`, `assignments-console-page.tsx:72`, `functional-link-workspace-page.tsx:83`, `posting-movement-page.tsx:72`, `posting-workspace-page.tsx:86`, `postings-console-page.tsx:74` | depende do gatilho: em `mount` é hostil, após interação é aceitável |
| Turmas (operacional) | requer avaliação | `class-detail-page.tsx`, `class-workspace-page.tsx` não inspecionados linha a linha | nova passagem dedicada |
| `/alunos/novo` (operacional) | conforme | piloto aprovado da Rodada 4 e do refinamento fino | referência desta linguagem |

### Questões abertas do inventário

1. Tradução efetiva dos estados em kebab-case nas telas de situação acadêmica e consolidação.
2. Gatilho real das mensagens "obrigatório" em Profissionais (`mount` × `blur`).
3. Strings institucionais citadas em módulos de domínio: confirmar quais chegam ao DOM.
4. Passagem dedicada a Turmas e ao fluxo longo de Transferências.

Nenhum item deste inventário autoriza alteração de tela. Cada correção entra como rodada
própria, aprovada individualmente.
