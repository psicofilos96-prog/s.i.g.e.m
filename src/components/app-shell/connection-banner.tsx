import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { CONNECTION_MESSAGES, nextConnectionPhase, type ConnectionPhase } from "@/lib/connection-state";

export function ConnectionBanner() {
  const [phase, setPhase] = useState<ConnectionPhase>("online");

  useEffect(() => {
    if (!navigator.onLine) setPhase("offline");
    const off = () => setPhase((p) => nextConnectionPhase(p, "offline"));
    const on = () => setPhase((p) => nextConnectionPhase(p, "online"));
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    return () => {
      window.removeEventListener("offline", off);
      window.removeEventListener("online", on);
    };
  }, []);

  useEffect(() => {
    if (phase !== "restored") return;
    const t = window.setTimeout(() => setPhase((p) => nextConnectionPhase(p, "settle")), 8000);
    return () => window.clearTimeout(t);
  }, [phase]);

  if (phase === "online") return null;
  const offline = phase === "offline";
  const Icon = offline ? WifiOff : Wifi;
  return (
    <div
      role={offline ? "alert" : "status"}
      className={
        "mb-4 flex items-start gap-2 rounded-md border px-3 py-2 text-sm print:hidden " +
        (offline
          ? "border-destructive/40 bg-destructive/10 text-foreground"
          : "border-border bg-muted text-foreground")
      }
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{CONNECTION_MESSAGES[phase]}</span>
    </div>
  );
}
