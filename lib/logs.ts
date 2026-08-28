import type { FrontLog } from "@/lib/types";

const MAX = 80;
const logs: FrontLog[] = [];

export function pushLog(entry: Omit<FrontLog, "id">) {
  logs.unshift({
    id: `${entry.at}-${Math.random().toString(36).slice(2, 8)}`,
    ...entry,
  });
  if (logs.length > MAX) logs.length = MAX;
  return logs[0];
}

export function listLogs() {
  return logs;
}
