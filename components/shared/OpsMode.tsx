"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";

export type LayoutMode = "desktop" | "mobile";

export type SessionUser = {
  id: string;
  login: string;
  name: string;
  email?: string | null;
};

type OpsMode = {
  layout: LayoutMode;
  admin: boolean;
  isMobile: boolean;
  session: SessionUser | null;
  authLoading: boolean;
  needsSetup: boolean;
  googleEnabled: boolean;
  authError: string | null;
  loginOpen: boolean;
  adminsOpen: boolean;
  setLayout: (layout: LayoutMode) => void;
  setAdmin: (on: boolean) => void;
  openLogin: () => void;
  closeLogin: () => void;
  openAdmins: () => void;
  closeAdmins: () => void;
  completeLogin: (user: SessionUser) => void;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<void>;
};

const Ctx = createContext<OpsMode | null>(null);
const LAYOUT_KEY = "cemoa_layout_mode";
const TOOLS_KEY = "cemoa_admin_tools";

const layoutListeners = new Set<() => void>();
const toolsListeners = new Set<() => void>();

function emit(listeners: Set<() => void>) {
  for (const listener of listeners) listener();
}

function getLayout(): LayoutMode {
  const stored = localStorage.getItem(LAYOUT_KEY);
  if (stored === "mobile" || stored === "desktop") return stored;
  return window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop";
}

function getToolsOn(): boolean {
  return sessionStorage.getItem(TOOLS_KEY) === "1";
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
  const toolsOn = useSyncExternalStore(
    (cb) => {
      toolsListeners.add(cb);
      return () => toolsListeners.delete(cb);
    },
    getToolsOn,
    () => false,
  );

  const [session, setSession] = useState<SessionUser | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);
  const [adminsOpen, setAdminsOpen] = useState(false);

  const refreshAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
      const data = (await res.json()) as {
        user?: SessionUser | null;
        needsSetup?: boolean;
        googleEnabled?: boolean;
      };
      setSession(data.user ?? null);
      setNeedsSetup(Boolean(data.needsSetup));
      setGoogleEnabled(Boolean(data.googleEnabled));
      if (!data.user) {
        sessionStorage.removeItem(TOOLS_KEY);
        emit(toolsListeners);
      }
    } catch {
      setSession(null);
    } finally {
      setAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    const error = params.get("authError");
    const authOk = params.get("auth") === "ok";
    (async () => {
      try {
        const res = await fetch("/api/auth/me", {
          credentials: "same-origin",
          cache: "no-store",
        });
        const data = (await res.json()) as {
          user?: SessionUser | null;
          needsSetup?: boolean;
          googleEnabled?: boolean;
        };
        if (cancelled) return;
        setSession(data.user ?? null);
        setNeedsSetup(Boolean(data.needsSetup));
        setGoogleEnabled(Boolean(data.googleEnabled));
        if (error) {
          setAuthError(error);
          setLoginOpen(true);
        }
        if (data.user && authOk) {
          sessionStorage.setItem(TOOLS_KEY, "1");
          emit(toolsListeners);
          setLoginOpen(false);
        }
        if (!data.user) {
          sessionStorage.removeItem(TOOLS_KEY);
          emit(toolsListeners);
        }
        if (error || authOk) {
          params.delete("authError");
          params.delete("auth");
          params.delete("linked");
          const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
          window.history.replaceState({}, "", next);
        }
      } catch {
        if (!cancelled) setSession(null);
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLayout = useCallback((next: LayoutMode) => {
    localStorage.setItem(LAYOUT_KEY, next);
    if (next === "mobile") {
      sessionStorage.removeItem(TOOLS_KEY);
      emit(toolsListeners);
    }
    emit(layoutListeners);
  }, []);

  const setAdmin = useCallback(
    (on: boolean) => {
      if (on) {
        if (!session) {
          setLoginOpen(true);
          return;
        }
        sessionStorage.setItem(TOOLS_KEY, "1");
      } else {
        sessionStorage.removeItem(TOOLS_KEY);
      }
      emit(toolsListeners);
    },
    [session],
  );

  const completeLogin = useCallback((user: SessionUser) => {
    setSession(user);
    setNeedsSetup(false);
    setLoginOpen(false);
    sessionStorage.setItem(TOOLS_KEY, "1");
    emit(toolsListeners);
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    } catch {
      /* still clear locally */
    }
    setSession(null);
    sessionStorage.removeItem(TOOLS_KEY);
    emit(toolsListeners);
    setAdminsOpen(false);
    await refreshAuth();
  }, [refreshAuth]);

  const admin = layout === "desktop" && Boolean(session) && toolsOn;

  const value = useMemo<OpsMode>(
    () => ({
      layout,
      admin,
      isMobile: layout === "mobile",
      session,
      authLoading,
      needsSetup,
      googleEnabled,
      authError,
      loginOpen,
      adminsOpen,
      setLayout,
      setAdmin,
      openLogin: () => setLoginOpen(true),
      closeLogin: () => setLoginOpen(false),
      openAdmins: () => setAdminsOpen(true),
      closeAdmins: () => setAdminsOpen(false),
      completeLogin,
      logout,
      refreshAuth,
    }),
    [
      layout,
      admin,
      session,
      authLoading,
      needsSetup,
      googleEnabled,
      authError,
      loginOpen,
      adminsOpen,
      setLayout,
      setAdmin,
      completeLogin,
      logout,
      refreshAuth,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

const FALLBACK: OpsMode = {
  layout: "desktop",
  admin: false,
  isMobile: false,
  session: null,
  authLoading: true,
  needsSetup: false,
  googleEnabled: false,
  authError: null,
  loginOpen: false,
  adminsOpen: false,
  setLayout: () => {},
  setAdmin: () => {},
  openLogin: () => {},
  closeLogin: () => {},
  openAdmins: () => {},
  closeAdmins: () => {},
  completeLogin: () => {},
  logout: async () => {},
  refreshAuth: async () => {},
};

export function useOpsMode() {
  return useContext(Ctx) ?? FALLBACK;
}
