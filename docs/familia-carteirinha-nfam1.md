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
