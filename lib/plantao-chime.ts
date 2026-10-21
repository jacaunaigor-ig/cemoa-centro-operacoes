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

const AVISO_TONS = [
  { f: 880, inicio: 0, duracao: 0.22 },
  { f: 659.25, inicio: 0.26, duracao: 0.22 },
  { f: 523.25, inicio: 0.52, duracao: 0.34 },
];

/** Três bipes em PCM. O elemento de áudio sai no alto-falante; o oscilador do navegador muitas vezes não. */
export function avisoWavDataUri() {
  const taxa = 22050;
  const total = 0.92;
  const n = Math.floor(taxa * total);
  const dados = new Int16Array(n);
  for (const tom of AVISO_TONS) {
    const i0 = Math.floor(tom.inicio * taxa);
    const len = Math.floor(tom.duracao * taxa);
    for (let i = 0; i < len && i0 + i < n; i++) {
      const env = Math.sin((Math.PI * i) / len);
      const amostra = Math.sin((2 * Math.PI * tom.f * i) / taxa) * env * 0.92;
      dados[i0 + i] = Math.max(-32767, Math.min(32767, Math.round(amostra * 32767)));
    }
  }
  const bytes = n * 2;
  const buffer = new ArrayBuffer(44 + bytes);
  const view = new DataView(buffer);
  const texto = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  texto(0, "RIFF");
  view.setUint32(4, 36 + bytes, true);
  texto(8, "WAVE");
  texto(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, taxa, true);
  view.setUint32(28, taxa * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  texto(36, "data");
  view.setUint32(40, bytes, true);
  let offset = 44;
  for (let i = 0; i < n; i++) {
    view.setInt16(offset, dados[i], true);
    offset += 2;
  }
  const raw = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < raw.length; i++) binary += String.fromCharCode(raw[i]);
  return `data:audio/wav;base64,${btoa(binary)}`;
}

const AVISO_ID = "cemoa-aviso-som";

/** O elemento fica na página. Áudio criado só na memória não sai no alto-falante do Windows. */
export function prepararAvisoSonoro(src: string): HTMLAudioElement | null {
  if (typeof document === "undefined") return null;
  const found = document.getElementById(AVISO_ID);
  const el = found instanceof HTMLAudioElement ? found : document.createElement("audio");
  if (el !== found) {
    el.id = AVISO_ID;
    el.preload = "auto";
    el.setAttribute("playsinline", "");
    document.body.appendChild(el);
  }
  if (el.src !== new URL(src, window.location.href).href) el.src = src;
  el.volume = 1;
  el.muted = false;
  return el;
}

function tocarPeloContexto(): boolean {
  const ctx = unlockPlantaoAudio();
  if (!ctx) return false;
  if (ctx.state === "suspended") void ctx.resume();
  const t0 = ctx.currentTime + 0.05;
  for (const tom of AVISO_TONS) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = t0 + tom.inicio;
    osc.type = "square";
    osc.frequency.setValueAtTime(tom.f, start);
    gain.gain.setValueAtTime(0.45, start);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + tom.duracao);
  }
  return true;
}

function falarTeste() {
  if (typeof speechSynthesis === "undefined") return;
  const frase = new SpeechSynthesisUtterance("Teste de som.");
  frase.lang = "pt-BR";
  frase.volume = 1;
  frase.rate = 1;
  speechSynthesis.cancel();
  speechSynthesis.speak(frase);
}

/** Três bipes. O teste ignora o mudo e também fala, para o Windows entregar algum áudio. */
export function playVencimentoChime(opcoes?: { ignorarMudo?: boolean; falar?: boolean }): Promise<boolean> {
  if (!opcoes?.ignorarMudo && !plantaoSoundEnabled()) return Promise.resolve(false);
  if (opcoes?.falar) falarTeste();
  tocarPeloContexto();
  const audio = typeof document === "undefined" ? null : document.getElementById(AVISO_ID);
  if (!(audio instanceof HTMLAudioElement)) return Promise.resolve(false);
  audio.muted = false;
  audio.volume = 1;
  try {
    audio.currentTime = 0;
  } catch {
    /* ainda carregando: o play abaixo puxa do início */
  }
  const started = audio.play();
  if (!started) return Promise.resolve(true);
  return started.then(() => true).catch(() => false);
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
    void playVencimentoChime().then((played) => {
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
      onToast("Som do plantão: clique em Testar som no cabeçalho para autorizar o áudio neste navegador.");
    }
    });
  }, 80);
}
