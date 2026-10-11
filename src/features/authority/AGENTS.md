## Autoridade e navegação (`src/features/authority/`)
- Conta de setor: tela organiza por estação só via `src/features/authority/station-navigation.ts` (menu + StationGate); o banco segue a garantia, porque filtro de tela não autoriza.
- Menu, paleta, busca, cards de início e deep link decidem só por `pathAllowed` (`src/features/authority/nav-capabilities.ts`: estação × capacidade exigida pela tela; autoridade incompleta ⇒ nada), porque regras paralelas voltam a oferecer área inutilizável.
