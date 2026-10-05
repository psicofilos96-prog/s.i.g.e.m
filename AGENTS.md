<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Configurabilidade Normativa (princípio transversal do SIGEM)

Os 12 documentos do primeiro SIGEM enviados pelo usuário estão sintetizados em `docs/sigem-memoria-fontes-historicas.md`. Consulte essa memória ao retomar requisitos de produto; ela é contexto histórico, não descrição do estado atual nem autorização para importar regras, dados ou código do modelo abandonado.

Outros 16 documentos, incluindo especificação setorial do SIGEM 2.0, guias de DP, auditoria do primeiro modelo e matriz de rastreabilidade, estão sintetizados em `docs/sigem-memoria-setorial-e-auditoria.md`. Consulte as duas memórias ao tratar requisitos setoriais; preserve a origem, a vigência e a diferença entre proposta, decisão e entrega comprovada.

Toda norma escolar é DADO configurado, homologado e versionado; nunca código. A cadeia é sempre:
`fato → capacidade do motor → configuração → homologação → aplicação → resultado versionado`.

- Motores só conhecem primitivas (comparar, compor, somar, dividir, agregar, tratar ausência de dado). Nenhum motor conhece etapa, modalidade, segmento, ano, escola, cargo, colegiado, patamar, fórmula, prazo ou efeito institucional.
- Enumerações permanecem abertas (identificadores) quando não há necessidade estrutural de fechá-las; listas de interface são opções, não limites do domínio.
- Configurabilidade ≠ edição irrestrita: liberdade estrutural coexiste com governança (rascunho → revisão → homologação), vigência, versionamento imutável, competência institucional e auditoria.
- Sem regra homologada o sistema não conclui: impedimentos são exibidos por extenso; dado ausente nunca vira zero.
- Renomeações e migrações preservam IDs, versões, snapshots e proveniência; a nomenclatura de ciclo substitui "anual", com adaptador de compatibilidade na leitura (`adoptCycleNomenclature`).
- Auditoria automática do princípio: `src/features/assessment/normative-configurability.test.ts`.

## Regras por diretório
Regras detalhadas vivem no `AGENTS.md` de cada diretório: `src/components/sigem/`, `src/features/academic-projections/`, `src/features/assessment/`, `src/features/calendar/`, `src/features/ciece/`, `src/features/classes/`, `src/features/collegial/`, `src/features/cycle-closing/`, `src/features/diary/`, `src/features/institutional-admin/`, `src/features/institutional-decisions/`, `src/features/pedagogical-guidance/`, `src/features/student-life/`, `src/features/workspace/`, `supabase/`.

## Continuidade técnica
Estado, provas e pendências das etapas B4.x: `docs/sigem-continuidade-tecnica-2026-10-03.md`. É um registro de continuidade, **não** fonte normativa; regras vivem nos `AGENTS.md` e as normas, no dado homologado.

## Painéis executivos (`src/features/dashboards/`)
- Métrica é projeção declarada (definição, fórmula versionada, fonte, granularidade, escopo, capabilities) calculada na hora dos readers canônicos com refs de drill-down; cache só em memória com idade explícita, porque número gravado viraria segunda verdade.
- Perspectiva aparece por capability homologada com alcance escola/rede, nunca por cargo; perspectiva sem métrica definível só encaminha à superfície própria, porque KPI inventado seria norma escondida.

## Planejamento docente (`src/features/teaching-planning/`, migration 0078)
- Plano é cadeia append-only por `plan_id` gravada só por `record_teaching_plan_version` (regência vigente do próprio usuário, cabeça esperada, autor único, regência imutável); matriz da versão é congelada no plano, porque mudança de matriz/regência não pode reescrever planejamento histórico.
- Blocos são livres e nível é identificador aberto; refs curriculares só por ID canônico (item da matriz da regência ou item da camada BNCC/SAEB), nunca texto copiado, porque taxonomia pedagógica fixa seria norma no código.
- Rascunho só do autor; publicado só com `consultar-planejamento-docente` na escola; ver nunca concede editar. Cópia é nova instância com `copied_from_version_id`.
- Aula referencia plano por `link_lesson_to_plan` (ledger próprio); planejar nunca marca conteúdo como ministrado.

## Avaliações do professor (`src/features/teacher-assessment/`, migration 0079)
- Item e instrumento são cadeias append-only gravadas só por `record_assessment_item_version`/`record_teacher_instrument_version` (regência vigente, cabeça esperada, autor único); instrumento publicado é congelado e alterar exige cópia, porque prova aplicada não pode mudar.
- Gabarito/critério vive em `assessment_item_keys`, legível só pelo autor ou por compartilhamento explícito (`key_shared`), porque enunciado e resposta juntos vazariam.
- Tipos de item vêm de registro aberto; nenhum peso, escala ou fórmula é definido aqui — resultado continua na Pauta (ligação opcional por `results_instrument_id`), porque segunda regra de nota divergiria.
- Randomização só com semente declarada no instrumento; impressão é projeção determinística sem gabarito, com impressão digital SHA-256.

## Mobile/PWA/Acessibilidade
- PWA é só manifest (instalável), sem service worker nem cache de respostas, porque dados são privados e transacionais e não há sincronização offline.
- Correções de acessibilidade vão primeiro nos componentes compartilhados, guardadas por `src/components/a11y.test.tsx`, porque patch por tela regride.
