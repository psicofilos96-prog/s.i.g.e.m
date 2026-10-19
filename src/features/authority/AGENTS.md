## Autoridade e navegação (`src/features/authority/`)
- Session bootstrap and effective authority share bounded reads; login consumes that same origin and failures stay uncertain until recovery, because a stalled or failed read must neither spin forever nor imply signed-out access.
- Conta de setor: tela organiza por estação só via `src/features/authority/station-navigation.ts` (menu + StationGate); o banco segue a garantia, porque filtro de tela não autoriza.
- Menu, paleta, busca, cards de início e deep link decidem só por `pathAllowed` (`src/features/authority/nav-capabilities.ts`: estação × capacidade exigida pela tela; autoridade incompleta ⇒ nada), porque regras paralelas voltam a oferecer área inutilizável.
- L43 (`institutional-profiles.ts`): catálogo de áreas × tipos homologados × verbos × padrões proibidos só descreve e confere a política lida (snapshot em `docs/data/`); nunca concede capacidade, porque cargo, matrícula ou planilha não autorizam.
- Conta de escola (principal `scope: "school"`): telas fixam a escola por `useOwnSchoolId()` e mostram `OwnSchoolName` no lugar do seletor, porque escolher a própria escola é passo inútil e "todas as escolas" pesava a leitura.
