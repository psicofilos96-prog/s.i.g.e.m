import { useEffect, useRef, useState } from "react";
import { parseBoundary, z } from "@/lib/runtime-shape";
import { diaryMessage } from "./diary-w-source";

export const DIARY_SAVE_TIMEOUT_MS = 15_000;
type Status = "idle" | "sending" | "unknown" | "confirmed";
/** Retains the exact writer closure (identity + payload) when confirmation is uncertain. */
export function useDiarySave(onConfirmed: () => void) {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const pending = useRef<(() => Promise<string>) | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; clearTimeout(timer.current); }; }, []);
  const submit = async (write: () => Promise<string>) => {
    if (busy.current || status === "confirmed") return;
    const attempt = pending.current ?? write;
    pending.current = attempt;
    busy.current = true;
    setStatus("sending"); setMessage(null);
    try {
      const result = await Promise.race([attempt(), new Promise<never>((_, reject) => {
        timer.current = setTimeout(() => reject(new Error("diary-save-timeout")), DIARY_SAVE_TIMEOUT_MS);
      })]);
      parseBoundary(z.string().uuid(), result, "teacher-diary-save");
      if (!mounted.current) return;
      pending.current = null; setStatus("confirmed"); onConfirmed();
    } catch (error) {
      if (!mounted.current) return;
      const raw = error instanceof Error ? error.message : "";
      if (raw.startsWith("diary:")) {
        pending.current = null; setStatus("idle"); setMessage(diaryMessage(raw));
      } else {
        setStatus("unknown");
        setMessage("Sem confirmação do servidor. Tente novamente para conferir o mesmo envio; não faça outro registro.");
      }
    } finally { clearTimeout(timer.current); busy.current = false; }
  };
  return { submit, status, message, locked: status !== "idle" };
}