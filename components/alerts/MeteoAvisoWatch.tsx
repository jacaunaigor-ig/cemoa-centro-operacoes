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
import { CloudSun, Megaphone } from "lucide-react";
import { AvisoGraficoButton } from "@/components/alerts/AvisoGrafico";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/Modal";
import { useOpsMode } from "@/components/shared/OpsMode";
import { fetchJson } from "@/lib/client";
import { startVisiblePoll, useNow } from "@/lib/client-hooks";
import {
  AVISO_URGENT_MS,
  AVISO_WARN_MS,
  avisoExpiresAt,
  avisoTone,
  formatShiftHours,
  meteoShiftAt,
  parseMeteoAviso,
  type AvisoTone,
  type MeteoAviso,
} from "@/lib/meteo-aviso";
import { STATIC_DEPLOY, withBase } from "@/lib/site";
import { cn } from "@/lib/utils";
import { formatCountdown, remainingMs } from "@/lib/alert-validity";
import { playVencimentoChime } from "@/lib/plantao-chime";

function emitSuccessMessage(issuedAt: number) {
  const shift = meteoShiftAt(issuedAt);
  const until = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Manaus",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(shift.endAt));
  return `Aviso Meteorológico emitido. Válido até o fim do plantão ${formatShiftHours(shift)} (${until}).`;
}

const STORAGE_KEY = "cemoa_meteo_aviso_v1";
const NOTIFY_KEY = "cemoa_meteo_notify_v1";
const POLL_MS = 20_000;

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

function notifyAvisoStage(aviso: MeteoAviso, stage: string, notified: { current: string | null }) {
  const key = `${aviso.id}:${stage}`;
  try {
    if (sessionStorage.getItem(NOTIFY_KEY) === key) return;
    sessionStorage.setItem(NOTIFY_KEY, key);
  } catch {
    if (notified.current === key) return;
  }
  notified.current = key;
  // O cartão do plantão já mostra warn / urgent / expired. Só o sino toca aqui.
  if (stage === "expired") playVencimentoChime();
}

export function MeteoAvisoProvider({ children }: { children: React.ReactNode }) {
  const { session } = useOpsMode();
  const [aviso, setAviso] = useState<MeteoAviso | null>(null);
  const [emitting, setEmitting] = useState(false);
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
    return startVisiblePoll(loadRemote, POLL_MS);
  }, [apply, loadRemote]);

  useEffect(() => {
    if (!aviso) return;
    const now = Date.now();
    const current = notifyStage(avisoTone(aviso.expiresAt, now));
    if (current) notifyAvisoStage(aviso, current, notified);

    const timers: number[] = [];
    const warnAt = aviso.expiresAt - AVISO_WARN_MS;
    const urgentAt = aviso.expiresAt - AVISO_URGENT_MS;
    if (now < warnAt) {
      timers.push(window.setTimeout(() => notifyAvisoStage(aviso, "warn", notified), warnAt - now));
    }
    if (now < urgentAt) {
      timers.push(
        window.setTimeout(() => notifyAvisoStage(aviso, "urgent", notified), urgentAt - now),
      );
    }
    if (aviso.expiresAt > now) {
      timers.push(
        window.setTimeout(
          () => notifyAvisoStage(aviso, "expired", notified),
          aviso.expiresAt - now,
        ),
      );
    }
    return () => {
      for (const id of timers) window.clearTimeout(id);
    };
  }, [aviso]);

  const emit = useCallback(async (note?: string) => {
    setEmitting(true);
    try {
      if (STATIC_DEPLOY) {
        const issuedAt = Date.now();
        const next: MeteoAviso = {
          id: `aviso-${issuedAt}`,
          issuedAt,
          expiresAt: avisoExpiresAt(issuedAt),
          issuedBy: session?.name || "Plantão CEMOA",
          note: note?.trim() || null,
        };
        writeLocal(next);
        setAviso(next);
        toast.success(emitSuccessMessage(issuedAt));
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
      toast.success(emitSuccessMessage(parsed?.issuedAt ?? Date.now()));
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

export function MeteoAvisoDutyCard() {
  const { aviso, emit, emitting } = useMeteoAviso();
  const { session, isMobile, openLogin } = useOpsMode();
  const now = useNow();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const shift = meteoShiftAt(now || Date.now());
  const tone = avisoTone(aviso?.expiresAt, now);
  const left = aviso && now ? remainingMs(aviso.expiresAt, now) : null;
  const clock = left != null && left > 0 ? formatCountdown(left) : null;
  const needsImmediate = tone === "expired" || tone === "urgent";
  const until = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Manaus",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(shift.endAt));

  const headline =
    tone === "expired"
      ? "Aviso vencido"
      : tone === "idle"
        ? "Sem aviso neste plantão"
        : clock ?? "—";
  const detail =
    tone === "expired"
      ? `O plantão ${shift.label.toLowerCase()} segue até ${until}. Emita o próximo aviso.`
      : tone === "urgent"
        ? `Faltam menos de 15 min para ${until}.`
        : tone === "warn"
          ? `Vence às ${until}. Falta menos de 1 h.`
          : tone === "ok"
            ? `Válido até ${until}.`
            : `Validade deste turno: até ${until}.`;

  function onDutyAction() {
    if (!session) {
      openLogin();
      return;
    }
    if (needsImmediate) void emit();
    else setOpen(true);
  }

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-stretch">
      <div
        role={needsImmediate ? "status" : undefined}
        className={cn(
          "flex min-h-11 w-full items-center gap-2 rounded-lg border px-3 py-2",
          needsImmediate && "aviso-pulse",
          tone === "expired" && "border-risco-severo/70 bg-risco-severo/12",
          tone === "urgent" && "border-risco-severo/50 bg-risco-severo/10",
          tone === "warn" && "border-risco-alto/50 bg-risco-alto/10",
          tone === "ok" && "border-live/30 bg-live/8",
          tone === "idle" && "border-border bg-panel",
        )}
      >
        <CloudSun className="size-4 shrink-0 text-focus" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-[10px] font-bold tracking-[0.08em] text-text-mute uppercase">
            Plantão 12 h · {shift.label} · {shift.hours}
          </p>
          <strong
            className={cn(
              "block text-sm",
              clock && "font-mono tabular-nums tracking-wide",
              tone === "urgent" && "text-risco-severo",
              tone === "expired" && "text-risco-severo",
              tone === "warn" && "text-risco-alto",
              tone === "ok" && "text-live",
            )}
          >
            {headline}
          </strong>
          <p
            className={cn(
              "text-[11px]",
              tone === "expired" || tone === "urgent" ? "font-semibold text-risco-severo" : "text-text-mute",
              tone === "warn" && "font-semibold text-risco-alto",
            )}
          >
            {detail}
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          className={cn("min-h-11 shrink-0", needsImmediate && "bg-risco-severo text-white hover:bg-risco-severo/90")}
          disabled={emitting}
          onClick={onDutyAction}
        >
          <Megaphone className="size-3.5" />
          {session
            ? needsImmediate
              ? "Emitir agora"
              : aviso
                ? "Validar 12 h"
                : "Validar plantão"
            : "Entrar"}
        </Button>
      </div>
      <AvisoGraficoButton compact={isMobile} className="w-full sm:w-auto" />
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Emitir Aviso Meteorológico"
        description="O meteorologista cobre 12 horas: 07–19 (diurno) e 19–07 (noturno), horário de Manaus. O aviso vale até o fim deste plantão. O painel avisa 1 h e 15 min antes do encerramento."
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
              Emitir e validar até {shift.hours === "07–19" ? "19:00" : "07:00"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
