import { callRpc } from "@/lib/rpc-call";
import { supabase } from "@/integrations/supabase/client";
import type { MyNotification, OpenResult } from "./notifications-model";

type Rpc = (fn: string, a?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, a) => (supabase.rpc as unknown as Rpc)(fn, a);
const call = callRpc;

export const listMyNotifications = (before: string | null) => call<MyNotification[]>("my_notifications", { _limit: 30, _before: before });
export const unreadCount = () => call<number>("my_unread_notification_count");
export const openNotification = (id: string) => call<OpenResult>("open_notification", { _delivery: id });
export const setPreference = (kind: string, optedOut: boolean) => call<void>("set_notification_preference", { _kind: kind, _opted_out: optedOut });
