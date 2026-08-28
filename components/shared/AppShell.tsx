"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Activity, Droplets, Info, Radio } from "lucide-react";
import { cn, formatAmazonTime } from "@/lib/utils";
import { InfoTooltip } from "@/components/shared/InfoTooltip";
import { useEffect, useState } from "react";

export function AppShell({
  children,
  syncLabel = "Sincronizado",
  source = "CEMOA / INMET / CENSIPAM / CPTEC-INPE",
  cache,
}: {
  children: React.ReactNode;
  syncLabel?: string;
  source?: string;
  cache?: "HIT" | "MISS";
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const [clock, setClock] = useState("--:--:--");

  useEffect(() => {
    const tick = () => setClock(formatAmazonTime(Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const shared = new URLSearchParams();
  for (const key of ["municipio", "bacia", "calha"] as const) {
    const value = params.get(key);
    if (value) shared.set(key, value);
  }
  const suffix = shared.toString() ? `?${shared.toString()}` : "";

  return (
    <div className="flex h-dvh max-xl:h-auto max-xl:min-h-dvh flex-col overflow-hidden max-xl:overflow-visible">
      <header className="relative z-20 flex flex-wrap items-center gap-3 border-b border-border bg-panel/90 px-3 py-2.5 backdrop-blur-xl sm:px-5">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-brand to-transparent" />
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <CemoaMark />
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.14em] text-brand-2 uppercase">
              Defesa Civil do Amazonas
            </p>
            <h1 className="truncate text-base font-black tracking-tight sm:text-lg">
              CEMOA · Centro de Operações
            </h1>
          </div>
        </Link>

        <nav
          aria-label="Produtos"
          className="order-3 flex w-full gap-1 rounded-xl border border-border bg-bg/60 p-1 sm:order-none sm:w-auto sm:ml-4"
        >
          <NavTab
            href={`/${suffix}`}
            active={pathname === "/"}
            icon={<Radio className="size-3.5" />}
          >
            Painel de Alertas
          </NavTab>
          <NavTab
            href={`/boletim${suffix}`}
            active={pathname.startsWith("/boletim")}
            icon={<Droplets className="size-3.5" />}
          >
            Boletim Hidrológico
          </NavTab>
        </nav>

        <div className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-1 text-right">
          <div>
            <small className="block font-mono text-[9px] font-bold tracking-[0.12em] text-text-mute uppercase">
              Horário de Manaus
            </small>
            <strong className="font-mono text-sm">{clock}</strong>
          </div>
          <InfoTooltip
            label="Sobre a sincronização"
            title="Sincronizado"
            body={`${source}. Os painéis consultam a API local com cache de 3–4 segundos (HIT/MISS) para reduzir latência. ${cache ? `Última resposta: cache ${cache}.` : ""} Sem Supabase neste recorte: a série é gerada de forma determinística a partir da malha municipal do CEMOA.`}
          >
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg px-2 py-1 text-left hover:bg-white/5"
              aria-label="Sobre a sincronização"
            >
              <span className="live-dot" aria-hidden />
              <span>
                <small className="flex items-center gap-1 text-[9px] font-bold tracking-[0.12em] text-text-mute uppercase">
                  {syncLabel}
                  <Info className="size-3.5 text-text-mute" aria-hidden />
                </small>
                <strong className="flex items-center gap-1 text-xs font-semibold text-live">
                  <Activity className="size-3.5" />
                  Ao vivo
                </strong>
              </span>
            </button>
          </InfoTooltip>
        </div>
      </header>
      <div id="conteudo" className="flex min-h-0 flex-1 flex-col overflow-hidden max-xl:overflow-visible">
        {children}
      </div>
    </div>
  );
}

function NavTab({
  href,
  active,
  icon,
  children,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold sm:flex-none",
        active
          ? "bg-brand text-white shadow"
          : "text-text-dim hover:bg-white/5 hover:text-text",
      )}
      aria-current={active ? "page" : undefined}
    >
      {icon}
      {children}
    </Link>
  );
}

function CemoaMark() {
  return (
    <svg
      viewBox="0 0 48 48"
      className="size-11 shrink-0"
      role="img"
      aria-label="Brasão CEMOA"
    >
      <rect width="48" height="48" rx="12" fill="#121b30" />
      <path
        d="M24 6l14 6v11c0 9.2-6.1 17.4-14 19.8C16.1 40.4 10 32.2 10 23V12l14-6z"
        fill="#ff6a1f"
      />
      <path
        d="M24 10l10 4.2v9c0 6.6-4.3 12.5-10 14.3-5.7-1.8-10-7.7-10-14.3v-9L24 10z"
        fill="#0e1526"
      />
      <path d="M16 24.5h16l-8 9-8-9z" fill="#5eb4ff" />
      <circle cx="24" cy="20" r="3.2" fill="#ffb020" />
    </svg>
  );
}
