"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/** Delays propagating fast-changing values (search input, slider drag) to avoid re-render/reflow churn downstream. */
export function useDebouncedValue<T>(value: T, delayMs = 200): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

type NowListener = () => void;

const nowListeners = new Set<NowListener>();
let nowMs = 0;
let nowInterval: number | null = null;
let visibilityBound = false;

function emitNow() {
  nowMs = Date.now();
  for (const listener of nowListeners) listener();
}

function startNowClock() {
  if (nowInterval != null || typeof window === "undefined") return;
  nowInterval = window.setInterval(() => {
    if (document.hidden) return;
    emitNow();
  }, 1000);
}

function stopNowClock() {
  if (nowInterval == null || typeof window === "undefined") return;
  window.clearInterval(nowInterval);
  nowInterval = null;
}

function bindVisibility() {
  if (visibilityBound || typeof document === "undefined") return;
  visibilityBound = true;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopNowClock();
      return;
    }
    emitNow();
    if (nowListeners.size) startNowClock();
  });
}

function subscribeNow(listener: NowListener) {
  nowListeners.add(listener);
  bindVisibility();
  if (nowMs === 0) emitNow();
  startNowClock();
  return () => {
    nowListeners.delete(listener);
    if (nowListeners.size === 0) stopNowClock();
  };
}

function getNowSnapshot() {
  return nowMs;
}

function getNowServerSnapshot() {
  return 0;
}

/**
 * Shared 1 Hz clock. One interval for the whole tree; only subscribed leaves
 * re-render. Pauses while the tab is hidden.
 */
export function useNow() {
  return useSyncExternalStore(subscribeNow, getNowSnapshot, getNowServerSnapshot);
}

/** Pauses CSS animations (ticker, pulse) while the document is in the background. */
export function usePauseMotionWhenHidden() {
  useEffect(() => {
    const sync = () => {
      document.documentElement.classList.toggle("page-hidden", document.hidden);
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      document.documentElement.classList.remove("page-hidden");
    };
  }, []);
}

/**
 * Polls while the tab is visible. Hidden tabs skip the network round-trip
 * and resume as soon as the operator comes back.
 */
export function startVisiblePoll(load: () => Promise<void> | void, intervalMs: number) {
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const arm = () => {
    if (cancelled) return;
    timer = setTimeout(() => {
      void run();
    }, intervalMs);
  };

  const run = async () => {
    if (cancelled) return;
    if (typeof document !== "undefined" && document.hidden) {
      arm();
      return;
    }
    try {
      await load();
    } finally {
      if (!cancelled) arm();
    }
  };

  const onVis = () => {
    if (cancelled || document.hidden) return;
    if (timer) clearTimeout(timer);
    void run();
  };

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVis);
  }
  void run();

  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onVis);
    }
  };
}
