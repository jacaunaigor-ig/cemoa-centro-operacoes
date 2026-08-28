export function reportClientError(message: string, context?: string) {
  try {
    void fetch("/api/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ level: "error", message, context }),
    });
  } catch {
    /* ignore logger failure */
  }
}

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const err = new Error(`Falha ${res.status} em ${url}`);
    reportClientError(err.message, "fetchJson");
    throw err;
  }
  return res.json() as Promise<T>;
}
