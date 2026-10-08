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
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Pause, Play, Presentation, X } from "lucide-react";
import { useOpsMode } from "@/components/shared/OpsMode";
import {
  APRESENTACAO_AUTOPLAY_MS,
  APRESENTACAO_PASSO,
  APRESENTACAO_QUERY,
  hrefComApresentacao,
  hrefSemApresentacao,
  isApresentacaoQuery,
  parsePasso,
  SLIDES_APRESENTACAO,
  type SlideApresentacao,
} from "@/lib/apresentacao";
import { cn } from "@/lib/utils";

const FOCUS_BACKUP = "cemoa_apresentacao_focus";

type Api = {
  active: boolean;
  passo: number;
  slide: SlideApresentacao;
  total: number;
  playing: boolean;
  start: () => void;
  exit: () => void;
  next: () => void;
  prev: () => void;
  go: (index: number) => void;
  togglePlay: () => void;
};

const Ctx = createContext<Api | null>(null);

export function useApresentacao() {
  return useContext(Ctx);
}

export function ApresentacaoHost({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { setMapFocus, mapFocus, setAdmin } = useOpsMode();
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const startedAt = useRef(0);

  const active = isApresentacaoQuery(params.get(APRESENTACAO_QUERY));
  const passo = parsePasso(params.get(APRESENTACAO_PASSO));
  const slide = SLIDES_APRESENTACAO[passo] ?? SLIDES_APRESENTACAO[0];
  const total = SLIDES_APRESENTACAO.length;

  const go = useCallback(
    (index: number) => {
      const next = Math.max(0, Math.min(total - 1, index));
      const target = SLIDES_APRESENTACAO[next];
      startedAt.current = Date.now();
      setProgress(0);
      setMapFocus(Boolean(target.mapFocus));
      router.replace(hrefComApresentacao(target.href, next));
    },
    [router, setMapFocus, total],
  );

  const next = useCallback(() => {
    if (passo >= total - 1) {
      setPlaying(false);
      return;
    }
    go(passo + 1);
  }, [go, passo, total]);

  const prev = useCallback(() => go(passo - 1), [go, passo]);

  const start = useCallback(() => {
    try {
      sessionStorage.setItem(FOCUS_BACKUP, mapFocus ? "1" : "0");
    } catch {
      /* ignore */
    }
    setAdmin(false);
    setPlaying(true);
    startedAt.current = Date.now();
    setProgress(0);
    const root = document.documentElement;
    if (root.requestFullscreen) void root.requestFullscreen().catch(() => null);
    go(0);
  }, [go, mapFocus, setAdmin]);

  const exit = useCallback(() => {
    setPlaying(false);
    setProgress(0);
    let restore = false;
    try {
      restore = sessionStorage.getItem(FOCUS_BACKUP) === "1";
      sessionStorage.removeItem(FOCUS_BACKUP);
    } catch {
      /* ignore */
    }
    setMapFocus(restore);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => null);
    router.replace(hrefSemApresentacao(pathname, `?${params.toString()}`));
  }, [params, pathname, router, setMapFocus]);

  const togglePlay = useCallback(() => {
    setPlaying((on) => {
      if (!on) startedAt.current = Date.now() - progress * APRESENTACAO_AUTOPLAY_MS;
      return !on;
    });
  }, [progress]);

  useEffect(() => {
    const root = document.documentElement;
    if (active) root.dataset.apresentacao = slide.cover ? "cover" : "live";
    else delete root.dataset.apresentacao;
    return () => {
      delete root.dataset.apresentacao;
    };
  }, [active, slide.cover]);

  useEffect(() => {
    if (!active) return;
    setMapFocus(Boolean(slide.mapFocus));
  }, [active, slide.mapFocus, setMapFocus]);

  useEffect(() => {
    if (!active || !playing) return;
    const tick = window.setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      const ratio = Math.min(1, elapsed / APRESENTACAO_AUTOPLAY_MS);
      setProgress(ratio);
      if (ratio >= 1) {
        if (passo >= total - 1) {
          setPlaying(false);
          setProgress(1);
        } else {
          go(passo + 1);
        }
      }
    }, 80);
    return () => window.clearInterval(tick);
  }, [active, playing, passo, total, go]);

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("input, textarea, select, [contenteditable=true]")
      ) {
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        exit();
        return;
      }
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        next();
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        prev();
      }
      if (event.key === "Home") {
        event.preventDefault();
        go(0);
      }
      if (event.key === "End") {
        event.preventDefault();
        go(total - 1);
      }
      if (event.key === "p" || event.key === "P") {
        event.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [active, exit, go, next, prev, togglePlay, total]);

  const api = useMemo<Api>(
    () => ({
      active,
      passo,
      slide,
      total,
      playing,
      start,
      exit,
      next,
      prev,
      go,
      togglePlay,
    }),
    [active, passo, slide, total, playing, start, exit, next, prev, go, togglePlay],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      {active ? (
        <ApresentacaoHud
          slide={slide}
          passo={passo}
          total={total}
          playing={playing}
          progress={progress}
          onPrev={prev}
          onNext={next}
          onGo={go}
          onExit={exit}
          onTogglePlay={togglePlay}
        />
      ) : null}
    </Ctx.Provider>
  );
}

function ApresentacaoHud({
  slide,
  passo,
  total,
  playing,
  progress,
  onPrev,
  onNext,
  onGo,
  onExit,
  onTogglePlay,
}: {
  slide: SlideApresentacao;
  passo: number;
  total: number;
  playing: boolean;
  progress: number;
  onPrev: () => void;
  onNext: () => void;
  onGo: (index: number) => void;
  onExit: () => void;
  onTogglePlay: () => void;
}) {
  const last = passo >= total - 1;

  return (
    <>
      {slide.cover ? (
        <div className="fixed inset-0 z-[4000] flex flex-col bg-[#051525] text-white">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(37,99,235,0.35),transparent_42%),radial-gradient(circle_at_80%_80%,rgba(245,158,11,0.18),transparent_40%)]" />
          <header className="relative z-10 flex items-center justify-between px-6 py-4 sm:px-10">
            <p className="text-[11px] font-bold tracking-[0.18em] text-white/70 uppercase">
              Modo apresentação · dados ao vivo
            </p>
            <div className="flex items-center gap-2">
              <a
                href="/cemoa-apresentacao.pptx"
                className="pointer-events-auto inline-flex items-center rounded-full border border-white/20 px-3 py-1.5 text-[11px] font-bold text-white/80 hover:bg-white/10"
              >
                PowerPoint
              </a>
              <button
                type="button"
                onClick={onExit}
                className="pointer-events-auto inline-flex items-center gap-1 rounded-full border border-white/20 px-3 py-1.5 text-[11px] font-bold text-white/80 hover:bg-white/10"
              >
                <X className="size-3.5" />
                Sair
              </button>
            </div>
          </header>
          <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-center px-8 sm:px-16 lg:px-24">
            <p className="text-sm font-bold tracking-[0.2em] text-amber-400 uppercase">
              {slide.kicker}
            </p>
            <h2 className="mt-3 max-w-4xl text-5xl font-black tracking-tight sm:text-7xl">
              {slide.title}
            </h2>
            <p className="mt-5 max-w-3xl text-lg leading-relaxed text-white/80 sm:text-2xl">
              {slide.body}
            </p>
            {slide.bullets?.length ? (
              <ul className="mt-8 max-w-3xl space-y-3 text-base text-white/85 sm:text-xl">
                {slide.bullets.map((item) => (
                  <li key={item} className="flex gap-3">
                    <span className="mt-2 size-2 shrink-0 rounded-full bg-amber-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <SlideDock
            overlay
            slide={slide}
            passo={passo}
            total={total}
            playing={playing}
            progress={progress}
            last={last}
            onPrev={onPrev}
            onNext={onNext}
            onGo={onGo}
            onExit={onExit}
            onTogglePlay={onTogglePlay}
          />
        </div>
      ) : (
        <SlideDock
          slide={slide}
          passo={passo}
          total={total}
          playing={playing}
          progress={progress}
          last={last}
          onPrev={onPrev}
          onNext={onNext}
          onGo={onGo}
          onExit={onExit}
          onTogglePlay={onTogglePlay}
        />
      )}
    </>
  );
}

function SlideDock({
  overlay,
  slide,
  passo,
  total,
  playing,
  progress,
  last,
  onPrev,
  onNext,
  onGo,
  onExit,
  onTogglePlay,
}: {
  overlay?: boolean;
  slide: SlideApresentacao;
  passo: number;
  total: number;
  playing: boolean;
  progress: number;
  last: boolean;
  onPrev: () => void;
  onNext: () => void;
  onGo: (index: number) => void;
  onExit: () => void;
  onTogglePlay: () => void;
}) {
  return (
    <div
      className={cn(
        "z-[4100] border-t border-white/10 bg-[#07182a]/95 text-white shadow-[0_-12px_40px_rgba(0,0,0,0.35)] backdrop-blur-md",
        overlay ? "relative" : "fixed inset-x-0 bottom-0",
      )}
    >
      <div className="h-1 bg-white/10">
        <div
          className="h-full bg-amber-400 transition-[width] duration-100"
          style={{ width: `${playing ? progress * 100 : 0}%` }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 px-2.5 py-1 text-[10px] font-black tracking-[0.14em] text-amber-300 uppercase">
          <Presentation className="size-3.5" />
          Apresentação
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold tracking-[0.16em] text-white/55 uppercase">
            {slide.kicker} · {passo + 1}/{total}
          </p>
          <p className="truncate text-sm font-black sm:text-base">{slide.title}</p>
          {!overlay ? (
            <p className="hidden max-w-4xl truncate text-xs text-white/70 sm:block">{slide.body}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onPrev}
            disabled={passo === 0}
            className="grid size-9 place-items-center rounded-full border border-white/20 disabled:opacity-30"
            aria-label="Slide anterior"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={onTogglePlay}
            className="grid size-9 place-items-center rounded-full border border-white/20"
            aria-label={playing ? "Pausar avanço automático" : "Avanço automático"}
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={last}
            className="inline-flex h-9 items-center gap-1 rounded-full bg-amber-400 px-3 text-[11px] font-black text-[#07182a] uppercase disabled:opacity-30"
          >
            {last ? "Fim" : "Próximo"}
            <ChevronRight className="size-4" />
          </button>
          <button
            type="button"
            onClick={onExit}
            className="inline-flex h-9 items-center gap-1 rounded-full border border-white/20 px-3 text-[11px] font-bold text-white/80"
          >
            <X className="size-3.5" />
            Sair
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1 px-4 pb-3 sm:px-6">
        {SLIDES_APRESENTACAO.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onGo(index)}
            className={cn(
              "h-1.5 flex-1 rounded-full",
              index === passo ? "bg-amber-400" : "bg-white/20 hover:bg-white/40",
            )}
            aria-label={`${index + 1}. ${item.title}`}
            aria-current={index === passo ? "true" : undefined}
          />
        ))}
      </div>
      <p className="hidden px-6 pb-3 text-[10px] text-white/45 sm:block">
        → próximo · ← anterior · P automático · Esc sair · os números da tela são a operação de agora
      </p>
    </div>
  );
}
