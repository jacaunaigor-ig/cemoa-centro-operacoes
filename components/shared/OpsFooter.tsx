"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/client";
import { startVisiblePoll } from "@/lib/client-hooks";
import type { SourceHealth } from "@/lib/source-health";
import { cn, formatAmazonDateTime } from "@/lib/utils";

const FONTES = [
  { href: "https://www.gov.br/cemaden/pt-br", label: "CEMADEN" },
  { href: "https://portal.inmet.gov.br", label: "INMET" },
  { href: "https://www.cptec.inpe.br", label: "CPTEC/INPE" },
  { href: "https://www.gov.br/ana/pt-br", label: "ANA" },
  { href: "https://www.appselva.com.br/", label: "App SELVA" },
  { href: "https://www.purpleair.com/", label: "PurpleAir" },
  { href: "https://www.defesacivil.am.gov.br", label: "Defesa Civil AM" },
] as const;

const TONE: Record<SourceHealth["tone"], string> = {
  ok: "bg-emerald-500",
  atraso: "bg-amber-400",
  falha: "bg-risco-alto",
};

export function OpsFooter({
  source,
  updatedAt,
  rainAt,
  airAt,
  hydroAt,
  supabase,
}: {
  source?: string;
  updatedAt?: number | null;
  rainAt?: number | null;
  airAt?: number | null;
  hydroAt?: number | null;
  supabase?: "ligado" | "aguardando";
}) {
  const [health, setHealth] = useState<SourceHealth[]>([]);

  useEffect(() => {
    return startVisiblePoll(async () => {
      try {
        const data = await fetchJson<{ sources: SourceHealth[] }>("/api/status");
        setHealth(data.sources);
      } catch {
        /* o rodapé continua com os horários locais */
      }
    }, 60_000);
  }, []);

  const stamps = [
    updatedAt ? `Alertas ${formatAmazonDateTime(updatedAt)}` : null,
    rainAt ? `Chuva ${formatAmazonDateTime(rainAt)}` : null,
    airAt ? `Ar ${formatAmazonDateTime(airAt)}` : null,
    hydroAt ? `Cotas ${formatAmazonDateTime(hydroAt)}` : null,
  ].filter(Boolean);

  return (
    <footer className="shrink-0 border-t border-border bg-panel/90 px-3 py-1.5 text-[10px] text-text-mute sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="min-w-0">
          <strong className="font-semibold text-text">CEMOA · Defesa Civil do Amazonas</strong>
          {source ? <span className="ml-1.5">{source}</span> : null}
          {supabase ? (
            <span className="ml-1.5">
              · Supabase: {supabase === "ligado" ? "ligado" : "aguardando chaves"}
            </span>
          ) : null}
        </p>
        <nav aria-label="Fontes de dados" className="flex flex-wrap items-center gap-x-2">
          {FONTES.map((f) => (
            <a
              key={f.href}
              href={f.href}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-focus hover:underline"
            >
              {f.label}
            </a>
          ))}
        </nav>
      </div>
      {health.length ? (
        <ul className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1" aria-label="Saúde das fontes">
          {health.map((s) => (
            <li key={s.id} className="inline-flex items-center gap-1" title={s.detalhe}>
              <span className={cn("size-1.5 shrink-0 rounded-full", TONE[s.tone])} />
              <span className="font-semibold text-text">{s.label}</span>
              <span className="font-mono tabular-nums">
                {s.at ? formatAmazonDateTime(s.at) : "—"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {stamps.length ? (
        <p className="mt-0.5 font-mono tabular-nums">
          Última atualização · {stamps.join(" · ")} · horário de Manaus
        </p>
      ) : null}
    </footer>
  );
}
