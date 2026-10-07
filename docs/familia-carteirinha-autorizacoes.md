# Família, carteirinha e autorizações

| Requisito | Estado |
|---|---|
| A Portal | Existente, por seções autorizadas |
| B Vínculo responsável↔aluno | Existente: autorização explícita (/autorizacoes-familia) |
| C Carteirinha | Parcial: visualização frente/verso; N9.2: regra de verificação pública (`card-verification.ts`, allowlist de campos, válida/expirada/cancelada/substituída/indisponível); emissão persistida, QR, página pública e PDF PENDENTES |
| D/E Autorizações e portaria | Pendente |
| F Frequência/boletim | Aguardando ato de publicação à família |
| H Ficha de saúde | DECISÃO PENDENTE |

## N9.2 — PARTIAL (CONTINUE_FROM=N9.2.1)
Só a regra de verificação. Emissão/reemissão/cancelamento no banco, QR, rota pública, PDF, portal, autorizações e portaria pendentes.

## N9.2.1 (parcial)
- Carteirinha persistida (0230): `student_card_issuances` append-only (emissão/reemissão/cancelamento, versão + base esperada, motivo obrigatório após v1, vigência por ano); grava só `record_student_card` (capability escolar `emitir-carteirinha-estudantil`, sem política atribuída ⇒ falha fechada; exige matrícula na escola); verificação pública só por `verify_student_card` (allowlist: status, id público, nome, escola, turma, ano; inexistente = cancelada-pedida = `indisponivel`); histórico da escola por `student_card_chain`.
- PENDENTE técnico: foto canônica, PDF frente/verso com identidade aprovada, página pública ligada ao reader, portal com carteira vigente, autorizações, portaria.
- DEPENDE_DECISAO: quem recebe `emitir-carteirinha-estudantil`.
