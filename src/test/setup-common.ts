// Setup comum a todos os ambientes (node e jsdom).
// B4.10.0c.1 — o modo inicial do Diário é "pendente" (falha fechada no app). Testes de unidade
// sem fronteira de sessão exercitam o laboratório; por isso o estabelecem EXPLICITAMENTE aqui.
// Testes de fronteira (diary-session*) trocam o modo pelo controlador real.
import { beforeEach } from "vitest";
import { setDiaryPersistenceMode } from "@/features/diary/diary-persistence-mode";
setDiaryPersistenceMode("laboratorio"); // antes dos imports do arquivo de teste (constantes de módulo)
beforeEach(() => {
  setDiaryPersistenceMode("laboratorio");
  // NFILTER.1: estado de lista vive na sessão; cada teste começa sem estado herdado.
  try { globalThis.sessionStorage?.clear(); } catch { /* sem DOM */ }
});
