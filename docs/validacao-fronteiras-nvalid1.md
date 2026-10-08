# Validação de dados nas fronteiras — NVALID.1

**Situação atual:** Registro de lote (2026-10-08).

## Padrão
`src/lib/runtime-shape.ts` (`parseBoundary` + zod): resposta é conferida em execução; payload incompleto ou enum inválido ⇒ `ShapeError` (falha fechada, mensagem humana `SHAPE_MESSAGE`); campo extra descartado.

## Aplicado
- Portal da Família: `family_students`, `family_student_summary` (`family-schemas.ts`).

## Já validado (sem mudança)
- Verificação pública da carteirinha (`publicCardView`: status desconhecido ⇒ indisponível sem detalhes).
- Importações: `import-kernel` (leitura segura, limite 20 MB, layout ausente recusa) e validação por domínio.
- Formulários de matrícula/pessoa/profissional: validação própria antes de gravar; o banco revalida.

## Pendente (migração gradual)
~65 leitores ainda usam `data as T`. Migrar ao tocar cada tela; prioridade a telas de família, inclusão e integrações.
