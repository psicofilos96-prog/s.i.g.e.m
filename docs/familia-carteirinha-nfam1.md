# Portal da Família e carteirinha — NFAM.1

## Situação atual
Classe: Registro de lote (2026-10-08). Fecha os gaps técnicos de FA-01 (N12.5) sem nova decisão institucional.

## Entregue
- Secretaria (`/carteirinhas`): emissão (estudante localizado por CPF/INEP exato), reemissão com nova validade e cancelamento, ambos com motivo e base esperada; proteção contra clique duplo; histórico completo por versão.
- Estados: Válida / Expirada / Cancelada derivados da cadeia (`card-issuance.ts`); versão anterior à reemissão aparece como substituída na verificação pública.
- QR: aponta para `/verificar/carteirinha/<código>.<versão>`, só com origem https; cancelada não tem QR.
- PDF: "Imprimir ou salvar em PDF" imprime só o cartão (frente e verso, 85,6 × 54 mm).
- Família: `family_student_cards` (migration 0245) mostra a carteirinha emitida com QR e aviso de expiração; sem emissão, prévia sem código e sem valor de verificação.
- Minimização: a família recebe só nome, escola, turma, ano, validade e código; nenhum id técnico.

## Pendências
- ASSIGNMENT_PENDING: `emitir-carteirinha-estudantil` e `localizar-estudante-para-matricula` sem política homologada atribuída; até lá a tela recusa com mensagem clara.
- DEPENDE_DECISAO: foto (termo de imagem), turno impresso, modelo oficial.
- PROVAS_SQL_PENDENTES; INTERACTIVE_BROWSER_VALIDATION_PENDING (login real, impressão real).

## N9.2.4 (2026-10-08)
- Verso da carteirinha mostra a validade da emissão oficial ("Válida até …"/"Expirada em …", `issuedValidity`, só do status do banco); sem emissão, "Sem emissão oficial" — antes só aparecia a situação da matrícula. Rótulo do código corrigido para "Código de verificação" (era "Matrícula SIGEM", mas o campo é o código público da carteirinha) — FEITO.
- Página pública (headless, 390 px e 1280 px): código inválido, inexistente e com `<script>` respondem igual ("Carteirinha não encontrada"), `noindex`, sem rolagem lateral.
- Família A/B (fixtures): sem emissão própria nada é sobreposto; origem não https não gera QR. Isolamento real pelo banco (`family_student_cards`) inalterado.
- Já fechados: histórico por versão, estados, QR, PDF frente/verso, portal, autorizações v3.
- DEPENDE_DECISAO: foto (termo de imagem), turno impresso, modelo oficial; portaria — não existe regra de controle de acesso, nada criado. ASSIGNMENT_PENDING: `emitir-carteirinha-estudantil`, `localizar-estudante-para-matricula`. INTERACTIVE_BROWSER_VALIDATION_PENDING: PDF raster da carteirinha emitida (exige login e emissão real).
