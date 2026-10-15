"use client";

import { useEffect, useState } from "react";
import type { FonteSaude } from "@/lib/source-health";
import { formatAmazonDateTime } from "@/lib/utils";

const FONTES = [
  { href: "https://www.gov.br/cemaden/pt-br", label: "CEMADEN" },
  { href: "https://portal.inmet.gov.br", label: "INMET" },
  { href: "https://www.cptec.inpe.br", label: "CPTEC/INPE" },
  { href: "https://www.gov.br/ana/pt-br", label: "ANA" },
  { href: "https://www.appselva.com.br/", label: "App SELVA" },
  { href: "https://www.purpleair.com/", label: "PurpleAir" },
  { href: "https://www.defesacivil.am.gov.br", label: "Defesa Civil AM" },
] as const;

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
  const [fontes, setFontes] = useState<FonteSaude[]>([]);
  const [falhasNota, setFalhasNota] = useState("Nenhuma falha de fonte registrada neste servidor.");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        if (!res.ok) {
          if (!cancelled) {
            setFalhasNota("Consulta de integridade indisponível. Isso não significa que as fontes estão normais.");
          }
          return;
        }
        const data = (await res.json()) as {
          fontes?: FonteSaude[];
          falhas?: Array<{ nome: string; estado: string; em: number; detalhe: string }>;
          falhasDisponivel?: boolean;
        };
        if (cancelled) return;
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
        if (!cancelled) {
          setFontes([]);
          setFalhasNota("Consulta de integridade indisponível. Isso não significa que as fontes estão normais.");
        }
      }
    }
    void load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
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
                      ? "text-[#a16207]"
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
