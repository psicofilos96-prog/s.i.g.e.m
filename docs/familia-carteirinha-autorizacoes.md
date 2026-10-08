# Família, carteirinha e autorizações

## Situação atual (NDOCS.1, 2026-10-08)
- Classe: **Referência vigente**. Descreve contrato/fluxo em vigor; regras detalhadas prevalecem nos `AGENTS.md`.
- Em conflito, prevalecem os `AGENTS.md` e `sigem-documentacao-canonica.md`; o mapa é `mapa-documentacao-vigente.md`.


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

## N9.2.2 (parcial)
- Página pública `/verificar/carteirinha/<código>.<versão>` (QR) sobre `verify_student_card`: só status (válida/expirada/cancelada/substituída/não encontrada), nome, escola, turma, ano letivo; formato inválido responde igual a inexistente. Emissão: ASSIGNMENT_PENDING (sem política). Pendentes: foto, PDF, Secretaria UI, portal, autorizações, portaria.

## N9.2.2 (2026-10-07)
- Impressão em escala física: frente e verso saem com 85,6 mm de largura (proporção 85,6 × 54 mm), sem partir o cartão entre páginas.
- Já existentes e mantidos: QR para /verificar/carteirinha/<código> com projeção mínima; status válida/expirada/cancelada/substituída pela cadeia de emissões.
- Emissão: `emitir-carteirinha-estudantil` sem conta atribuída por escola = ASSIGNMENT_PENDING.
- Pendentes: foto canônica privada, PDF gerado com conferência por imagem, tela da Secretaria (emitir/reemitir/cancelar/histórico), status e download no Portal da Família, autorizações de imagem/retirada/temporária, portaria; testes com execução real no banco bloqueados (acesso só leitura).
- Não passou: FAMILY_STUDENT_CARD_CORE_TECHNICALLY_COMPLETE.
