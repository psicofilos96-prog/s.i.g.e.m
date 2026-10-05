# Invariantes do SIGEM — testes automáticos

Suíte rápida: `bun run test:invariants` (~4 s; já incluída em `bun run test`).
Suíte profunda: `bun run test:deep` (mesmos testes, 2000 execuções por propriedade).
Nova migration: `bun run invariants:freeze-migrations` acrescenta seu hash; hashes existentes nunca são reescritos.

| Invariante | Onde |
|---|---|
| Migrations históricas imutáveis | `architecture.test.ts` (manifesto SHA-256) |
| SECURITY DEFINER vigente fixa `search_path` | idem (última definição de cada função) |
| Rascunho não autoriza (`effective_capabilities` exige homologada) | idem |
| Política sem curinga | idem |
| Tabelas `*_versions` sem GRANT UPDATE/DELETE a anon/authenticated | idem |
| Emissões de documentos append-only (trigger) | idem |
| Relações curriculares muitos-para-muitos | idem |
| Frontend sem service_role; cargo nunca filtra autorização | idem |
| Fontes oficiais sem fixtures; IDs D1 sem dependência de rótulo | idem |
| Exportação da auditoria exige capacidade; importadores com preflight/confirmação | idem |
| Vigências: sobreposição simétrica = dia comum; sucessão sem overlap | `properties.test.ts` |
| Paginação por cursor completa e sem repetição | idem |
| Fato obrigatório desconhecido nunca vira "pronto" | idem |
| Concorrência otimista: uma vitória por base; neutralização idempotente | idem |

Já cobertos em suítes de domínio (não duplicados): normas hardcoded (`normative-configurability.test.ts`), DML direto nas trilhas (`audit`), snapshots de emissão (`school-documents`), readers validOn/knownAt (testes de cada fonte).
