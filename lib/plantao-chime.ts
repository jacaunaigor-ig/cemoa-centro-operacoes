const SOUND_KEY = "cemoa_plantao_sound";
const CHIMED_KEY = "cemoa_plantao_chimed_v1";
const CHIMED_CAP = 300;

const soundListeners = new Set<() => void>();

function emitSoundPref() {
  for (const listener of soundListeners) listener();
}

export function subscribePlantaoSound(listener: () => void) {
  soundListeners.add(listener);
  return () => {
    soundListeners.delete(listener);
  };
}

export function plantaoSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setPlantaoSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    /* ignore quota */
  }
  emitSoundPref();
}

function readChimed(): string[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const raw = JSON.parse(sessionStorage.getItem(CHIMED_KEY) || "[]") as unknown;
    return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeChimed(keys: string[]) {
  try {
    sessionStorage.setItem(CHIMED_KEY, JSON.stringify(keys.slice(-CHIMED_CAP)));
  } catch {
    /* ignore quota */
  }
}

export function plantaoExpiryKey(tipo: string, nome: string, expiresAt: number) {
  return `${tipo}:${nome}:${expiresAt}`;
}

export function hasPlantaoChimed(key: string) {
  return readChimed().includes(key);
}

export function markPlantaoChimed(key: string) {
  const next = readChimed();
  if (next.includes(key)) return;
  next.push(key);
  writeChimed(next);
}

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  return audioCtx;
}

export function unlockPlantaoAudio() {
  const ctx = getAudioContext();
  if (ctx?.state === "suspended") void ctx.resume();
  return ctx;
}

/** Três notas descendentes — vencimento no posto, não sirene. */
export function playVencimentoChime() {
  if (!plantaoSoundEnabled()) return false;
  const ctx = unlockPlantaoAudio();
  if (!ctx || ctx.state === "suspended") return false;

  const t0 = ctx.currentTime + 0.02;
  const notes = [
    { f: 784, t: 0, d: 0.13, g: 0.2 },
    { f: 523.25, t: 0.15, d: 0.16, g: 0.18 },
    { f: 392, t: 0.34, d: 0.32, g: 0.22 },
  ];
  for (const note of notes) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(note.f, t0 + note.t);
    const start = t0 + note.t;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(note.g, start + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + note.d);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + note.d + 0.04);
  }
  return true;
}

let coalesceTimer: number | null = null;
const pendingNames: string[] = [];
let audioHintShown = false;

export function announceAlertExpired(nome: string, onToast: (message: string) => void) {
  pendingNames.push(nome);
  if (coalesceTimer != null) return;
  coalesceTimer = window.setTimeout(() => {
    const unique = [...new Set(pendingNames)];
    pendingNames.length = 0;
    coalesceTimer = null;
    const played = playVencimentoChime();
    const list =
      unique.length === 1
        ? unique[0]
        : `${unique.slice(0, 3).join(", ")}${unique.length > 3 ? "…" : ""}`;
    const head =
      unique.length === 1
        ? `Alerta vencido em ${list}.`
        : `${unique.length} alertas vencidos (${list}).`;
    onToast(`${head} Renovar ou rebaixar em Edição — o mapa não muda sozinho.`);
    if (!played && plantaoSoundEnabled() && !audioHintShown) {
      audioHintShown = true;
      onToast("Som do plantão: clique no sino do cabeçalho para autorizar o áudio neste navegador.");
    }
  }, 80);
}
