# DOCS.PRO.3 — Persistência, homologação e QR do Document Studio

## Situação atual
Classe: Registro de lote (2026-10-09).

## Entregue
- Banco (migrations 0266/0267): `studio_template_versions` (append-only; template, versão, setor, autor, criado em, hash do conteúdo, `supersedes_id`), `studio_template_events` (enviar-revisao/devolver/homologar/arquivar com ator e data), `studio_emissions` (versão, fatos resolvidos, snapshot, hash, ator, data, código opaco de 80 bits), `studio_emission_events` (cancelamento/substituição, uma vez só). Tudo append-only por trigger; escrita só por RPC SECURITY DEFINER.
- Estado = projeção dos eventos (`studio_version_state`); homologar versão nova torna a anterior "Substituído". Homologado nunca é editado no lugar.
- Permissão: Admin geral ou capability `manter-modelos-documentais` / `homologar-modelos-documentais` / `emitir-documentos-institucionais` (nenhuma atribuída hoje ⇒ só Admin).
- Emissão só de versão homologada vigente; reabrir reproduz pelo snapshot (nunca pela versão atual).
- QR gerado localmente (qrcode-generator) apontando para `/verificar/documento/<código>`; teste lê o QR com jsQR.
- Verificação pública (`verify_studio_document`): situação, tipo, emissor, data, versão e hash; formato inválido e inexistente respondem igual; sem dado pessoal.
- Os 41 modelos-base continuam rascunhos; "Gravar como rascunho" é ato explícito.
- Tela `/central-de-documentos`: Biblioteca, Editor (salvar versão, duplicar, revisão, homologar, arquivar), Histórico (comparar versões), Emitir, Emitidos (reproduzir PDF, cancelar, substituir), Acervo.

## Provas
- `studio-cloud.test.ts` (8): QR escaneável, parse, estados, substituição, diff, reprodução, cancelado, ids dos modelos-base.
- `scripts/docs-pro-3-studio-e2e.mjs` (harness, JWT real): 24/24 — ACL Admin × Secretaria, base desatualizada, marcação recusada, rascunho não emite, versão histórica preservada, substituída não emite, outra conta não lê nem cancela, anônimo não lê, sem enumeração, cancelado/substituído na verificação; resíduo 0.

## Pendências
- Fatos da emissão são informados por quem emite (congelados e atribuídos ao ator); leitura automática por reader ainda não ligada aos tokens.
- HUMAN_BROWSER_VISUAL_VALIDATION_PENDING (fluxo com login real no navegador).
