/** L03 — rascunho local do editor: sessionStorage (por aba), chave conta+modelo, só a estrutura do modelo (sem dados de pessoas). */
import { draftKey, recoverDraft, serializeDraft, type LocalDraft } from "./editor-model";

const store = () => (typeof window === "undefined" ? null : window.sessionStorage);
export function saveLocalDraft(d: LocalDraft) { try { store()?.setItem(draftKey(d.accountId, d.templateId), serializeDraft(d)); } catch { /* cota/privacidade: sem rascunho local */ } }
export function readLocalDraft(accountId: string, templateId: string, base: number) { return recoverDraft(store()?.getItem(draftKey(accountId, templateId)) ?? null, accountId, templateId, base); }
export function clearLocalDraft(accountId: string, templateId: string) { store()?.removeItem(draftKey(accountId, templateId)); }
