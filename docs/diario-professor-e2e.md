# Frente L — Diário do professor E2E

**Status: BLOCKED_BY_SOURCE para E2E real; testes sintéticos PASS.**

- "Minhas turmas" e "Meu horário" são projeções de `institutional-teaching.ts` sobre `institutional_engagements` + `class_schedule_at`; sem regência e sem grade, as listas ficam vazias — nunca horário do laboratório.
- Aula, frequência, conteúdo, nota e retificação gravam só por writers canônicos com autoria humana (sessão + capability); a camada técnica não escreve atos pedagógicos.
- Capabilities, histórico append-only, concorrência otimista e IDOR cobertos pela suíte existente (testes sintéticos em memória — **não** são E2E real).

Estado real: 0 registros de aula, 0 frequências, 0 regências docentes. Nenhum usuário ou regência foi fabricado.
