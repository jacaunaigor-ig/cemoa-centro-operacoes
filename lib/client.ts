import { STATIC_DEPLOY, withBase } from "@/lib/site";

export function reportClientError(message: string, context?: string) {
  if (STATIC_DEPLOY) return;
  try {
    void fetch(withBase("/api/logs"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: "error", message, context }),
    });
  } catch {
    /* ignore logger failure */
  }
}

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(withBase(url), { cache: "no-store" });
  if (!res.ok) {
    const err = new Error(`Falha ${res.status} em ${url}`);
    reportClientError(err.message, "fetchJson");
    throw err;
  }
  return res.json() as Promise<T>;
}
