"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";

export type LayoutMode = "desktop" | "mobile";

type OpsMode = {
  layout: LayoutMode;
  admin: boolean;
  isMobile: boolean;
  setLayout: (layout: LayoutMode) => void;
  setAdmin: (on: boolean) => void;
};

const Ctx = createContext<OpsMode | null>(null);
const LAYOUT_KEY = "cemoa_layout_mode";
const ADMIN_KEY = "cemoa_admin_mode";

const layoutListeners = new Set<() => void>();
const adminListeners = new Set<() => void>();

function emit(listeners: Set<() => void>) {
  for (const listener of listeners) listener();
}

function getLayout(): LayoutMode {
  const stored = localStorage.getItem(LAYOUT_KEY);
  if (stored === "mobile" || stored === "desktop") return stored;
  return window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop";
}

function getAdmin(): boolean {
  if (getLayout() !== "desktop") return false;
  return sessionStorage.getItem(ADMIN_KEY) === "1";
}

export function OpsModeProvider({ children }: { children: React.ReactNode }) {
  const layout = useSyncExternalStore(
    (cb) => {
      layoutListeners.add(cb);
      return () => layoutListeners.delete(cb);
    },
    getLayout,
    () => "desktop" as const,
  );
  const adminStored = useSyncExternalStore(
    (cb) => {
      adminListeners.add(cb);
      return () => adminListeners.delete(cb);
    },
    getAdmin,
    () => false,
  );

  const setLayout = useCallback((next: LayoutMode) => {
    localStorage.setItem(LAYOUT_KEY, next);
    if (next === "mobile") sessionStorage.removeItem(ADMIN_KEY);
    emit(layoutListeners);
    emit(adminListeners);
  }, []);

  const setAdmin = useCallback((on: boolean) => {
    if (on) sessionStorage.setItem(ADMIN_KEY, "1");
    else sessionStorage.removeItem(ADMIN_KEY);
    emit(adminListeners);
  }, []);

  const admin = layout === "desktop" && adminStored;

  const value = useMemo<OpsMode>(
    () => ({
      layout,
      admin,
      isMobile: layout === "mobile",
      setLayout,
      setAdmin,
    }),
    [layout, admin, setLayout, setAdmin],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOpsMode() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return {
      layout: "desktop" as const,
      admin: false,
      isMobile: false,
      setLayout: () => {},
      setAdmin: () => {},
    };
  }
  return ctx;
}
