# Auditoria final Família/Carteirinha — N9.2.5

Situação atual: Registro de lote (2026-10-08).

| Área | Situação | Evidência |
|---|---|---|
| Emissão técnica | Pronta: emite/reemite/cancela só via `record_student_card`; estado de `card-issuance.ts` | `card-admin-page.tsx` |
| Foto | Ausente aparece "Foto não registrada" | `student-card-view.tsx` |
| PDF | Impressão do navegador (A4); validade só de `issuedValidity` | `student-card-view.tsx` |
| QR | Só com origem https (`verifyUrlFor`) | `card-issuance.ts` |
| Rota pública | `noindex`, um h1; inexistente/formato inválido iguais | `verificar.carteirinha.$codigo.tsx` |
| Portal da família | Lê só `family_student_cards` (autorização vigente, seção matrícula) | `family-portal-page.tsx` |
| Histórico | Por versão, append-only, tabela com caption | `card-admin-page.tsx` |
| Autorizações | Só `/autorizacoes-familia` via v3 | `guardian-admin-page.tsx` |
| Portaria | Sem tela de portaria na Família/Carteirinha; nada implementado | DEPENDE_DECISAO |
| Mobile | Sem rolagem lateral em 4 telas (desk/mob) | Files `n925-pdfs/` |
| Minimização | Público mostra só nome, escola, turma, ano, código | `publicCardView` |

## Correção técnica
- Status desconhecido devolvido pelo servidor caía no rótulo "não encontrada" mas ainda exibia nome/escola/turma. Agora `publicCardView` (`card-public-code.ts`) descarta todos os dados (regra NPUB.2). "Ano letivo" ausente não imprime "null".
- Testes: `src/features/family-portal/family-n925.test.ts`.

## Pendências
- ASSIGNMENT_PENDING: capabilities de carteirinha/autorização não atribuídas — separadas.
- INTERACTIVE_BROWSER_VALIDATION_PENDING: carteirinha real impressa e QR lido por celular com login.
- REVISAR: `/verificar/$codigo` mostra a impressão digital (sha256) do documento — intencional para conferência; confirmar.
