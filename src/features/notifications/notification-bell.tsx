import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { unreadCount } from "./notifications-source";

export function NotificationBell() {
  const q = useQuery({ queryKey: ["notifications", "unread"], queryFn: unreadCount, refetchInterval: 120_000, retry: false });
  const n = q.data ?? 0;
  return (
    <Link to="/avisos" className="relative inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent" aria-label={n ? `Avisos: ${n} não lidos` : "Avisos"}>
      <Bell className="h-4 w-4" />
      {n > 0 && <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-primary px-1 text-2xs leading-4 text-primary-foreground">{n > 99 ? "99+" : n}</span>}
    </Link>
  );
}
