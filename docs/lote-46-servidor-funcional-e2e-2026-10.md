# Lote 46 — Servidor funcional persistido, crosswalk de candidatos e E2E das áreas

Situação atual: Registro de lote (2026-10-13).

## Entrega 3 (migration 0513)
- `payroll_functional_servants`: 1.952 servidores técnicos estáveis (chave = nome normalizado + nascimento; sem nascimento ⇒ matrícula). Agrupamento da fonte, não identidade comprovada.
- `payroll_functional_servant_registrations`: 2.037 vínculos individualizados (matrícula única); 85 servidores com 2 vínculos, que continuam distintos.
- `payroll_servant_identity_candidates`: 213 candidatos, todos `status = candidato`, evidência `matricula-identica` com registro administrativo SEMED. Nenhum candidato por nome isolado; nenhuma pessoa institucional/INEP associada; nenhum CPF.
- Append-only por trigger; backfill idempotente (ON CONFLICT); SELECT só com `consultar-registro-funcional` em alcance de rede; sem INSERT/UPDATE/DELETE para papéis do app.
- Gestão de Pessoas mostra "Cadastros funcionais persistidos" e os candidatos a conferir por servidor.
- `payroll_registration_person_links` segue com 0 ligações; a folha e a escola não dependem do crosswalk.

## Entrega 4 (`scripts/lote46-areas-servants-e2e.mjs` + `.py`)
- Fixtures técnicas temporárias (`bo-fixture.invalid`, tipos da política vigente), com limpeza e verificação de resíduo zero.
- 21/21 verificações: RH sintético lê 1.952/2.037/213; professor sintético e anônimo leem 0 nas três tabelas; escrita direta recusada; as 10 áreas abrem para RH e para o professor, sem nenhuma atividade "Disponível" em perfil rascunho; área inexistente recusa; a tela da folha mostra 2037/1952/85/0/1952.
- Defeito corrigido: o espaço de trabalho mostrava "Disponível" para qualquer conta nas áreas de perfil rascunho; agora mostra "Aguarda homologação" (ou "Sem acesso"), e o teste unitário cobre isso.

## Bloqueios
- Homologação da política rascunho e titulares reais: decisão humana competente.
- Prova de identidade servidor↔pessoa: depende de identificador confiável (CPF por HMAC ou equivalente); hoje nenhuma fonte profissional tem nascimento.
