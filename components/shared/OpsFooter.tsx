"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/client";
import { startVisiblePoll } from "@/lib/client-hooks";
import type { FonteSaude, SourceHealth } from "@/lib/source-health";
import { cn, formatAmazonDateTime } from "@/lib/utils";

const RODAPE_STORAGE = "cemoa_rodape_oculto_v1";

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

type StatusPayload = {
  sources?: SourceHealth[];
  fontes?: FonteSaude[];
  falhas?: Array<{ nome: string; estado: string; em: number; detalhe: string }>;
  falhasDisponivel?: boolean;
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
  const [fontes, setFontes] = useState<FonteSaude[]>([]);
  const [falhasNota, setFalhasNota] = useState("Nenhuma falha de fonte registrada neste servidor.");
  const [oculto, setOculto] = useState(false);

  useEffect(() => {
    try {
      setOculto(localStorage.getItem(RODAPE_STORAGE) === "1");
    } catch {
      /* o rodapé permanece visível se o navegador bloquear o armazenamento */
    }
  }, []);

  function gravarOculto(next: boolean) {
    setOculto(next);
    try {
      localStorage.setItem(RODAPE_STORAGE, next ? "1" : "0");
    } catch {
      /* a escolha vale só nesta visita */
    }
  }

  useEffect(() => {
    return startVisiblePoll(async () => {
      try {
        const data = await fetchJson<StatusPayload>("/api/status");
        setHealth(data.sources ?? []);
        setFontes(data.fontes ?? []);
        if (data.falhasDisponivel === false) {
          setFalhasNota("Histórico de falhas indisponível neste servidor. Isso não significa que não houve falha.");
        } else if (data.falhas?.length) {
          const ultima = data.falhas[0];
          setFalhasNota(
            ultima
              ? `Última mudança registrada: ${ultima.nome} ${ultima.estado} · ${formatAmazonDateTime(ultima.em)}`
              : "Nenhuma falha de fonte registrada neste servidor.",
          );
        } else {
          setFalhasNota("Nenhuma falha de fonte registrada neste servidor.");
        }
      } catch {
        setFontes([]);
        setFalhasNota("Consulta de integridade indisponível. Isso não significa que as fontes estão normais.");
      }
    }, 60_000);
  }, []);

  const stamps = [
    updatedAt ? `Alertas ${formatAmazonDateTime(updatedAt)}` : null,
    rainAt ? `Chuva ${formatAmazonDateTime(rainAt)}` : null,
    airAt ? `Ar ${formatAmazonDateTime(airAt)}` : null,
    hydroAt ? `Cotas ${formatAmazonDateTime(hydroAt)}` : null,
  ].filter(Boolean);

  if (oculto) {
    return (
      <footer className="shrink-0 border-t border-border bg-panel/90 px-3 py-1 text-[10px] text-text-mute sm:px-6">
        <button
          type="button"
          className="inline-flex min-h-7 items-center gap-1 rounded px-1 py-0.5 font-bold tracking-wide uppercase hover:bg-hover hover:text-text"
          aria-expanded={false}
          onClick={() => gravarOculto(false)}
        >
          Exibir fontes
        </button>
      </footer>
    );
  }

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
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
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
          <button
            type="button"
            className="inline-flex min-h-7 items-center gap-1 rounded px-1.5 py-0.5 font-bold tracking-wide uppercase hover:bg-hover hover:text-text"
            aria-expanded={true}
            onClick={() => gravarOculto(true)}
          >
            Ocultar fontes
          </button>
        </div>
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
      {fontes.length ? (
        <ul className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5" aria-label="Integridade das fontes">
          {fontes.map((fonte) => (
            <li key={fonte.id} title={fonte.erro ?? fonte.estado}>
              <span
                className={
                  fonte.estado === "operacional"
                    ? "text-risco-baixo"
                    : fonte.estado === "atrasada"
                      ? "text-risco-moderado"
                      : fonte.estado === "erro"
                        ? "text-risco-severo"
                        : "text-text-mute"
                }
              >
                {fonte.nome} {fonte.estado}
                {fonte.atualizadoEm ? ` · ${formatAmazonDateTime(fonte.atualizadoEm)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="mt-0.5">{falhasNota}</p>
    </footer>
  );
}
