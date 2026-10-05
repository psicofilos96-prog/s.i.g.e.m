# Documentos escolares oficiais — motor de emissão versionado

Migration `0066_school_documents_versioned_emission.sql`; código em `src/features/school-documents/`;
telas `/documentos-escolares` (sessão institucional) e `/verificar/$codigo` (pública).

## Modelo
- `school_document_templates` + `school_document_template_versions`: modelo é apresentação versionada
  (blocos `heading`/`paragraph`/`field`/`signature`, condição só de presença/ausência de fato,
  identidade institucional configurável com endereço de imagem, numeração opcional, campos públicos).
  Nova versão exige a versão atual (`_expected_head_id`) e motivo; tipo do modelo é imutável.
- `school_document_emissions`: snapshot imutável dos fatos usados, SHA-256 calculado no banco,
  código de verificação, número (só quando o modelo declara prefixo), emissor/pessoa/atuação/timestamp.
  `reproducao` copia o snapshot do original no servidor (mesma impressão digital), nunca refaz.
- `school_document_emission_events`: cancelamento ou retificação (uma por emissão, motivo obrigatório);
  retificação aponta a nova emissão. Tudo append-only por trigger; nenhuma tabela aceita DML direto.

## Fatos
Compostos pelos readers canônicos (`cycle_enrollments_at`, `cycle_participations_at`, `class_allocations_at`,
`institutional_students`). Mais de um registro vigente = ausente. Frequência, avaliação, fechamento,
encerramento e movimentação NÃO são compostos enquanto não houver regra homologada: os tipos boletim,
ficha individual, histórico, declaração de frequência e transferência existem, mas esses campos saem "sem registro".

## Segurança
- Capabilities `manter-modelo-de-documento-escolar` (rede), `emitir-documento-escolar` e
  `consultar-documento-escolar` (escola ou rede). **Nenhuma regra de política foi criada**: tudo recusa até decisão.
- Consultar histórico exige consultar OU emitir na escola do aluno; emitir não abre consulta de outras escolas.
- `verify_school_document` é a única função para visitantes: status, tipo, título, escola, número, data,
  impressão digital e campos públicos do modelo filtrados por lista proibida (nota, frequência, saúde,
  documentos pessoais, endereço, contato, filiação, nascimento) aplicada no modelo e na emissão.

## Pendências (decisão do proprietário)
1. Quem recebe as três permissões.
2. Hardening: hoje o snapshot é composto no navegador a partir dos readers oficiais e o banco confere
   escola, matrícula e permissão; a composição integral no servidor fica para quando os readers de
   frequência/avaliação tiverem regra homologada.
3. Leitura de QR: a tela imprime o endereço de verificação; gerar a imagem do QR é opcional.
