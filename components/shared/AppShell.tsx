"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Activity,
  Droplets,
  Info,
  LogIn,
  LogOut,
  Monitor,
  Moon,
  Pencil,
  Radio,
  Shield,
  Smartphone,
  Sun,
  Users,
} from "lucide-react";
import { cn, formatAmazonTime } from "@/lib/utils";
import { useNow, usePauseMotionWhenHidden } from "@/lib/client-hooks";
import { InfoTooltip } from "@/components/shared/InfoTooltip";
import { useOpsMode } from "@/components/shared/OpsMode";
import { LoginDialog } from "@/components/auth/LoginDialog";
import { AdminsDialog } from "@/components/auth/AdminsDialog";
import { MeteoAvisoBanner, MeteoAvisoProvider } from "@/components/alerts/MeteoAvisoWatch";
import { AvisoGraficoProvider } from "@/components/alerts/AvisoGrafico";
import { OpsFooter } from "@/components/shared/OpsFooter";

export function AppShell({
  children,
  syncLabel = "Sincronizado",
  source = "CEMOA / INMET / CENSIPAM / CPTEC-INPE",
  cache,
  updatedAt,
  rainAt,
  hydroAt,
}: {
  children: React.ReactNode;
  syncLabel?: string;
  source?: string;
  cache?: "HIT" | "MISS";
  updatedAt?: number | null;
  rainAt?: number | null;
  hydroAt?: number | null;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const {
    layout,
    theme,
    admin,
    isMobile,
    session,
    needsSetup,
    supabaseConfigured,
    setLayout,
    setTheme,
    setAdmin,
    openAdmins,
    logout,
  } = useOpsMode();
  usePauseMotionWhenHidden();

  const shared = new URLSearchParams();
  for (const key of ["municipio", "bacia", "calha"] as const) {
    const value = params.get(key);
    if (value) shared.set(key, value);
  }
  const suffix = shared.toString() ? `?${shared.toString()}` : "";

  return (
    <MeteoAvisoProvider>
      <AvisoGraficoProvider>
      <div
        className={cn(
          "flex flex-col transition-[min-height] duration-300",
          isMobile
            ? "min-h-dvh"
            : "h-dvh max-lg:h-auto max-lg:min-h-dvh overflow-hidden max-lg:overflow-visible",
        )}
      >
      <header className="sticky top-0 z-30 flex flex-wrap items-center gap-1.5 border-b border-border bg-panel/95 px-2 py-1.5 pt-[max(0.4rem,env(safe-area-inset-top))] shadow-[var(--shadow-card)] backdrop-blur-xl sm:gap-3 sm:px-6 sm:py-2.5">
        <Link href="/" className="flex min-w-0 items-center gap-2 sm:gap-3">
          <CemoaMark compact={isMobile} />
          <div className="min-w-0">
            {!isMobile ? (
              <p className="text-[11px] font-semibold tracking-[0.14em] text-text-mute uppercase">
                Defesa Civil do Amazonas
              </p>
            ) : null}
            <h1 className="truncate text-sm font-bold tracking-tight sm:text-lg">
              {isMobile ? "CEMOA" : "CEMOA · Centro de Operações"}
            </h1>
          </div>
        </Link>

        <nav
          aria-label="Produtos"
          className="flex min-w-0 flex-1 gap-1 rounded-xl border border-border bg-hover p-1 sm:ml-3 sm:flex-none sm:w-auto"
        >
          <NavTab
            href={`/${suffix}`}
            active={pathname === "/"}
            icon={<Radio className="size-3.5" />}
            compact={isMobile}
          >
            {isMobile ? "Alertas" : "Painel de Alertas"}
          </NavTab>
          <NavTab
            href={`/boletim${suffix}`}
            active={pathname.startsWith("/boletim")}
            icon={<Droplets className="size-3.5" />}
            compact={isMobile}
          >
            {isMobile ? "Boletim" : "Boletim Hidrológico"}
          </NavTab>
        </nav>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-x-2 gap-y-1 sm:gap-x-3">
          <div
            className="flex rounded-lg border border-border bg-hover p-0.5"
            role="group"
            aria-label="Modo de visualização"
          >
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[10px] font-bold transition-colors duration-200 touch-manipulation",
                layout === "desktop" ? "bg-brand text-white" : "text-text-mute hover:text-text",
              )}
              aria-pressed={layout === "desktop"}
              onClick={() => setLayout("desktop")}
            >
              <Monitor className="size-3.5" />
              <span className="hidden sm:inline">Desktop</span>
            </button>
            <button
              type="button"
              className={cn(
                "inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-[10px] font-bold transition-colors duration-200 touch-manipulation",
                layout === "mobile" ? "bg-brand text-white" : "text-text-mute hover:text-text",
              )}
              aria-pressed={layout === "mobile"}
              onClick={() => setLayout("mobile")}
            >
              <Smartphone className="size-3.5" />
              <span className="hidden sm:inline">Mobile</span>
            </button>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-lg border border-border bg-panel-2 px-2 py-1.5 text-[10px] font-bold text-text-mute transition-colors hover:text-text"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-pressed={theme === "dark"}
            aria-label={theme === "dark" ? "Ativar modo claro" : "Ativar modo escuro"}
            title={theme === "dark" ? "Modo claro" : "Modo escuro"}
          >
            {theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
            <span className="hidden sm:inline">{theme === "dark" ? "Claro" : "Escuro"}</span>
          </button>
          {layout === "desktop" ? (
            <div className="flex items-center gap-1.5">
              {session ? (
                <>
                  <button
                    type="button"
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-black tracking-wide uppercase transition-colors duration-200 touch-manipulation",
                      admin
                        ? "border-brand/60 bg-brand text-white"
                        : "border-border bg-panel-2 text-text-mute hover:text-text",
                    )}
                    aria-pressed={admin}
                    onClick={() => setAdmin(!admin)}
                    title="Liga ou desliga a edição do mapa (classificar alertas e cotas)"
                  >
                    <Pencil className="size-3.5" />
                    Edição
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg border border-border bg-panel-2 px-2 py-1.5 text-[10px] font-bold text-text-dim transition-colors hover:text-text"
                    onClick={openAdmins}
                    title={
                      session.roleLabel
                        ? `${session.name} · ${session.roleLabel}`
                        : "Equipe de operadores"
                    }
                  >
                    <Users className="size-3.5" />
                    <span className="hidden lg:inline max-w-[11rem] truncate">
                      {session.name}
                      {session.roleLabel ? (
                        <span className="ml-1 font-semibold normal-case tracking-normal text-text-mute">
                          · {session.roleLabel.replace(" · Centro de Monitoramento", "")}
                        </span>
                      ) : null}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center rounded-lg border border-border bg-panel-2 p-1.5 text-text-mute transition-colors hover:text-text"
                    onClick={() => void logout()}
                    aria-label="Sair"
                    title="Sair"
                  >
                    <LogOut className="size-3.5" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-panel-2 px-2.5 py-1.5 text-[10px] font-black tracking-wide text-text-mute uppercase transition-colors hover:text-text"
                  onClick={() => setAdmin(true)}
                >
                  {needsSetup && !supabaseConfigured ? <Shield className="size-3.5" /> : <LogIn className="size-3.5" />}
                  Admin
                </button>
              )}
            </div>
          ) : null}
          <HeaderClock compact={isMobile} />
          {!isMobile ? (
            <InfoTooltip
              label="Sobre a sincronização"
              title="Sincronizado"
              body={`${source}. Os painéis consultam a API local com cache de 3–4 segundos (HIT/MISS) para reduzir latência. ${cache ? `Última resposta: cache ${cache}.` : ""} ${
                supabaseConfigured
                  ? "Supabase ligado: classificações e cotas gravam no Postgres."
                  : "Supabase aguardando chaves: o centro está pronto — cole URL e chave em .env.local. Até lá, cookie + memória."
              }`}
            >
              <button
                type="button"
                className="hidden items-center gap-2 rounded-lg px-2 py-1 text-left transition-colors hover:bg-hover sm:flex"
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
          ) : (
            <span className="live-dot" aria-label="Ao vivo" />
          )}
        </div>
      </header>
      {admin ? (
        <div className="bg-brand/15 px-3 py-1.5 text-center text-[11px] font-semibold text-brand-2">
          Edição{session ? ` · ${session.name}` : ""}
          {session?.roleLabel ? ` · ${session.roleLabel}` : ""} — classifique no clique ou em lote.
          Confirme antes de gravar. Desfazer (Ctrl+Z).
        </div>
      ) : null}
      <MeteoAvisoBanner />
      <div
        id="conteudo"
        className={cn(
          "flex min-h-0 flex-1 flex-col pb-[env(safe-area-inset-bottom)]",
          isMobile ? "" : "overflow-hidden max-lg:overflow-visible",
        )}
      >
        {children}
      </div>
      <OpsFooter
        source={source}
        updatedAt={updatedAt}
        rainAt={rainAt}
        hydroAt={hydroAt}
        supabase={supabaseConfigured ? "ligado" : "aguardando"}
      />
      <LoginDialog />
      <AdminsDialog />
      </div>
      </AvisoGraficoProvider>
    </MeteoAvisoProvider>
  );
}

function HeaderClock({ compact }: { compact: boolean }) {
  const now = useNow();
  const clock = now ? formatAmazonTime(now) : "--:--:--";
  if (compact) {
    return <strong className="font-mono text-xs tabular-nums">{clock}</strong>;
  }
  return (
    <div className="hidden text-right md:block">
      <small className="block font-mono text-[9px] font-bold tracking-[0.12em] text-text-mute uppercase">
        Horário de Manaus
      </small>
      <strong className="font-mono text-sm tabular-nums">{clock}</strong>
    </div>
  );
}

function NavTab({
  href,
  active,
  icon,
  compact,
  children,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  compact?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors duration-200 sm:flex-none",
        compact && "px-2 py-1.5",
        active
          ? "bg-brand text-white shadow-sm"
          : "text-text-dim hover:bg-panel hover:text-text",
      )}
      aria-current={active ? "page" : undefined}
    >
      {icon}
      {children}
    </Link>
  );
}

function CemoaMark({ compact }: { compact?: boolean }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={compact ? "size-8 shrink-0" : "size-11 shrink-0"}
      role="img"
      aria-label="Brasão CEMOA"
    >
      <rect width="48" height="48" rx="12" fill="#2563eb" />
      <path
        d="M24 6l14 6v11c0 9.2-6.1 17.4-14 19.8C16.1 40.4 10 32.2 10 23V12l14-6z"
        fill="#1d4ed8"
      />
      <path
        d="M24 10l10 4.2v9c0 6.6-4.3 12.5-10 14.3-5.7-1.8-10-7.7-10-14.3v-9L24 10z"
        fill="#eff6ff"
      />
      <path d="M16 24.5h16l-8 9-8-9z" fill="#2563eb" />
      <circle cx="24" cy="20" r="3.2" fill="#f59e0b" />
    </svg>
  );
}
