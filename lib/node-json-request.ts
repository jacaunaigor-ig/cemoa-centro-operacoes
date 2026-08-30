import dns from "node:dns";
import https from "node:https";

try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  // Node sem a API — o https.request ainda força family 4.
}

export type NodeJsonResult = {
  ok: boolean;
  status: number;
  json: Record<string, unknown>;
  text: string;
};

export function nodeJsonRequest(opts: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}): Promise<NodeJsonResult> {
  return new Promise((resolve, reject) => {
    let parsed: URL;
    try {
      parsed = new URL(opts.url);
    } catch {
      reject(new Error("URL do Supabase inválida"));
      return;
    }
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };
    if (opts.body && !headers["Content-Length"]) {
      headers["Content-Length"] = String(Buffer.byteLength(opts.body));
    }
    const req = https.request(
      {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: `${parsed.pathname}${parsed.search}`,
        method: opts.method ?? "GET",
        headers,
        family: 4,
        timeout: opts.timeoutMs ?? 12_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(chunk as Buffer));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let json: Record<string, unknown> = {};
          try {
            json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
          } catch {
            json = {};
          }
          const status = res.statusCode ?? 0;
          resolve({ ok: status >= 200 && status < 300, status, json, text });
        });
      },
    );
    req.on("timeout", () => {
      req.destroy(new Error("timeout"));
    });
    req.on("error", reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}
