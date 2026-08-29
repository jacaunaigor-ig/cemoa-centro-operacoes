"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Bell, CloudSun, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/Modal";
import { useNow } from "@/components/alerts/AlertCountdown";
import { useOpsMode } from "@/components/shared/OpsMode";
import { fetchJson } from "@/lib/client";
import {
  AVISO_TTL_MS,
  avisoNearExpiry,
  avisoTone,
  parseMeteoAviso,
  type AvisoTone,
  type MeteoAviso,
} from "@/lib/meteo-aviso";
import { STATIC_DEPLOY, withBase } from "@/lib/site";
import { cn } from "@/lib/utils";
import { formatCountdown, remainingMs } from "@/lib/alert-validity";

const STORAGE_KEY = "cemoa_meteo_aviso_v1";
const NOTIFY_KEY = "cemoa_meteo_notify_v1";
const POLL_MS = 8000;

type Ctx = {
  aviso: MeteoAviso | null;
  emit: (note?: string) => Promise<void>;
  emitting: boolean;
};

const MeteoCtx = createContext<Ctx | null>(null);

function readLocal(): MeteoAviso | null {
  if (typeof window === "undefined") return null;
  try {
    return parseMeteoAviso(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
  } catch {
    return null;
  }
}

function writeLocal(aviso: MeteoAviso | null) {
  try {
    if (!aviso) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(aviso));
  } catch {
    /* ignore quota */
  }
}

function pickLatest(a: MeteoAviso | null, b: MeteoAviso | null) {
  if (!a) return b;
  if (!b) return a;
  return a.issuedAt >= b.issuedAt ? a : b;
}

function notifyStage(tone: AvisoTone) {
  if (tone === "expired") return "expired";
  if (tone === "urgent") return "urgent";
  if (tone === "warn") return "warn";
  return null;
}

export function MeteoAvisoProvider({ children }: { children: React.ReactNode }) {
  const { session } = useOpsMode();
  const [aviso, setAviso] = useState<MeteoAviso | null>(null);
  const [emitting, setEmitting] = useState(false);
  const now = useNow(1000);
  const notified = useRef<string | null>(null);

  const apply = useCallback((next: MeteoAviso | null) => {
    setAviso((prev) => {
      const picked = pickLatest(prev, next);
      if (picked) writeLocal(picked);
      return picked;
    });
  }, []);

  const loadRemote = useCallback(async () => {
    if (STATIC_DEPLOY) return;
    try {
      const data = await fetchJson<{ aviso: MeteoAviso | null }>("/api/avisos");
      apply(parseMeteoAviso(data.aviso));
    } catch {
      /* keep local */
    }
  }, [apply]);

  useEffect(() => {
    const local = readLocal();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hidrata o último aviso do plantão após o mount
    if (local) apply(local);
    const id = window.setInterval(() => void loadRemote(), POLL_MS);
    void loadRemote();
    return () => window.clearInterval(id);
  }, [apply, loadRemote]);

  useEffect(() => {
    if (!aviso) return;
    const tone = avisoTone(aviso.expiresAt, now);
    const stage = notifyStage(tone);
    if (!stage) return;
    const key = `${aviso.id}:${stage}`;
    try {
      if (sessionStorage.getItem(NOTIFY_KEY) === key) return;
      sessionStorage.setItem(NOTIFY_KEY, key);
    } catch {
      if (notified.current === key) return;
    }
    notified.current = key;
    if (stage === "expired") {
      toast.error("Aviso Meteorológico vencido. O plantão precisa emitir o próximo agora.");
    } else if (stage === "urgent") {
      toast.warning("Faltam menos de 15 min para o Aviso Meteorológico vencer.");
    } else {
      toast.warning("O Aviso Meteorológico vence em menos de 1 hora. Prepare o próximo boletim.");
    }
  }, [aviso, now]);

  const emit = useCallback(async (note?: string) => {
    setEmitting(true);
    try {
      if (STATIC_DEPLOY) {
        const issuedAt = Date.now();
        const next: MeteoAviso = {
          id: `aviso-${issuedAt}`,
          issuedAt,
          expiresAt: issuedAt + AVISO_TTL_MS,
          issuedBy: session?.name || "Plantão CEMOA",
          note: note?.trim() || null,
        };
        writeLocal(next);
        setAviso(next);
        toast.success("Aviso Meteorológico emitido. Válido por 6 horas.");
        return;
      }
      const res = await fetch(withBase("/api/avisos"), {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: note?.trim() || null }),
      });
      const data = (await res.json()) as { aviso?: MeteoAviso; error?: string };
      if (!res.ok || !data.aviso) {
        toast.error(data.error ?? "Não foi possível emitir o aviso. Entre como operador.");
        return;
      }
      const parsed = parseMeteoAviso(data.aviso);
      if (parsed) {
        writeLocal(parsed);
        setAviso(parsed);
      }
      toast.success("Aviso Meteorológico emitido. Válido por 6 horas.");
    } catch {
      toast.error("Falha de rede ao emitir o aviso.");
    } finally {
      setEmitting(false);
    }
  }, [session]);

  const value = useMemo(() => ({ aviso, emit, emitting }), [aviso, emit, emitting]);
  return <MeteoCtx.Provider value={value}>{children}</MeteoCtx.Provider>;
}

export function useMeteoAviso() {
  const ctx = useContext(MeteoCtx);
  if (!ctx) {
    return {
      aviso: null,
      emit: async () => {},
      emitting: false,
    };
  }
  return ctx;
}

export function MeteoAvisoBanner() {
  const { aviso, emit, emitting } = useMeteoAviso();
  const { session } = useOpsMode();
  const now = useNow(1000);
  if (!aviso) return null;
  const tone = avisoTone(aviso.expiresAt, now);
  if (!avisoNearExpiry(tone)) return null;
  const left = remainingMs(aviso.expiresAt, now) ?? 0;
  const clock = left <= 0 ? "00:00:00" : formatCountdown(left);

  return (
    <div
      role="status"
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-3 py-2 text-center text-[12px] font-semibold sm:text-[13px]",
        tone === "expired" && "aviso-pulse bg-risco-severo text-white",
        tone === "urgent" && "aviso-pulse bg-risco-severo/90 text-white",
        tone === "warn" && "bg-risco-alto text-bg",
      )}
    >
      <Bell className="size-4 shrink-0" />
      <span>
        {tone === "expired"
          ? "Aviso Meteorológico vencido — o plantão precisa emitir o próximo agora."
          : tone === "urgent"
            ? `Urgente: emitir o Aviso Meteorológico agora. Restam ${clock}.`
            : `O Aviso Meteorológico vence em ${clock}. Prepare o próximo boletim do plantão.`}
      </span>
      {session ? (
        <Button
          type="button"
          size="sm"
          variant={tone === "warn" ? "secondary" : "default"}
          className={cn(
            "min-h-9",
            tone !== "warn" && "bg-white text-risco-severo hover:bg-white/90",
          )}
          disabled={emitting}
          onClick={() => void emit()}
        >
          <Megaphone className="size-3.5" />
          Emitir agora
        </Button>
      ) : null}
    </div>
  );
}

export function MeteoAvisoDutyCard() {
  const { aviso, emit, emitting } = useMeteoAviso();
  const { session, isMobile } = useOpsMode();
  const now = useNow(1000);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const tone = avisoTone(aviso?.expiresAt, now);
  const left = remainingMs(aviso?.expiresAt, now);
  const clock = left == null ? "--:--:--" : left <= 0 ? "00:00:00" : formatCountdown(left);
  const canEmit = Boolean(session) && !isMobile;

  return (
    <>
      <div
        className={cn(
          "inline-flex min-h-11 max-w-full flex-wrap items-center gap-2 rounded-lg border px-2.5 py-1",
          tone === "expired" && "border-risco-severo/70 bg-risco-severo/12",
          tone === "urgent" && "border-risco-severo/50 bg-risco-severo/10",
          tone === "warn" && "border-risco-alto/50 bg-risco-alto/10",
          tone === "ok" && "border-live/30 bg-live/8",
          tone === "idle" && "border-border bg-panel",
        )}
      >
        <CloudSun className="size-4 shrink-0 text-focus" />
        <div className="min-w-0 leading-tight">
          <p className="text-[9px] font-bold tracking-[0.1em] text-text-mute uppercase">
            Plantão · 6 h
          </p>
          {aviso ? (
            <strong
              className={cn(
                "block font-mono text-sm tabular-nums tracking-wide",
                tone === "urgent" && "text-risco-severo",
                tone === "expired" && "text-risco-severo",
                tone === "warn" && "text-risco-alto",
                tone === "ok" && "text-live",
              )}
            >
              {clock}
            </strong>
          ) : (
            <strong className="block text-xs">Sem aviso</strong>
          )}
        </div>
        {canEmit ? (
          <Button
            type="button"
            size="sm"
            className="min-h-8"
            disabled={emitting}
            onClick={() => setOpen(true)}
          >
            <Megaphone className="size-3.5" />
            {aviso ? "Emitir" : "Emitir aviso"}
          </Button>
        ) : null}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Emitir Aviso Meteorológico"
        description="O plantão emite o aviso a cada 6 horas. Este registro reinicia o cronômetro e o painel avisará de novo quando o prazo estiver acabando."
      >
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void emit(note).then(() => {
              setNote("");
              setOpen(false);
            });
          }}
        >
          <label className="grid gap-1 text-xs font-semibold">
            Observação do plantão (opcional)
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex.: turno da manhã · céu nublado no Alto Solimões"
              maxLength={160}
            />
          </label>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={emitting}>
              Emitir e validar por 6 h
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
