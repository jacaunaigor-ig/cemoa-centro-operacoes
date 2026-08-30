"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { STATIC_DEPLOY, withBase } from "@/lib/site";
import {
  clearLocalSession,
  localNeedsSetup,
  readLocalSession,
} from "@/lib/local-auth";
import { withOperatorRole, type EquipeRole } from "@/lib/equipe";

export type LayoutMode = "desktop" | "mobile";
export type ThemeMode = "light" | "dark";

export type SessionUser = {
  id: string;
  login: string;
  name: string;
  email?: string | null;
  role?: EquipeRole;
  roleLabel?: string;
};

type OpsMode = {
  layout: LayoutMode;
  theme: ThemeMode;
  admin: boolean;
  isMobile: boolean;
  mapFocus: boolean;
  session: SessionUser | null;
  authLoading: boolean;
  needsSetup: boolean;
  googleEnabled: boolean;
  allowReset: boolean;
  supabaseConfigured: boolean;
  authError: string | null;
  loginOpen: boolean;
  adminsOpen: boolean;
  setLayout: (layout: LayoutMode) => void;
  setTheme: (theme: ThemeMode) => void;
  setMapFocus: (on: boolean) => void;
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
const THEME_KEY = "cemoa_theme";
const MAP_FOCUS_KEY = "cemoa_map_focus";
const TOOLS_KEY = "cemoa_admin_tools";
const NARROW_QUERY = "(max-width: 767px)";

const layoutListeners = new Set<() => void>();
const themeListeners = new Set<() => void>();
const mapFocusListeners = new Set<() => void>();
const toolsListeners = new Set<() => void>();

function subscribeNarrow(cb: () => void) {
  const mq = window.matchMedia(NARROW_QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

function getNarrow() {
  return window.matchMedia(NARROW_QUERY).matches;
}

function emit(listeners: Set<() => void>) {
  for (const listener of listeners) listener();
}

function getLayout(): LayoutMode {
  const stored = localStorage.getItem(LAYOUT_KEY);
  if (stored === "mobile" || stored === "desktop") return stored;
  return window.matchMedia("(max-width: 767px)").matches ? "mobile" : "desktop";
}

function applyThemeAttr(theme: ThemeMode) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#0b1220" : "#f7f8fa");
}

function getTheme(): ThemeMode {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getToolsOn(): boolean {
  return sessionStorage.getItem(TOOLS_KEY) === "1";
}

function getMapFocus(): boolean {
  try {
    return localStorage.getItem(MAP_FOCUS_KEY) === "1";
  } catch {
    return false;
  }
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
  const theme = useSyncExternalStore(
    (cb) => {
      themeListeners.add(cb);
      return () => themeListeners.delete(cb);
    },
    getTheme,
    () => "light" as const,
  );
  const toolsOn = useSyncExternalStore(
    (cb) => {
      toolsListeners.add(cb);
      return () => toolsListeners.delete(cb);
    },
    getToolsOn,
    () => false,
  );
  const mapFocus = useSyncExternalStore(
    (cb) => {
      mapFocusListeners.add(cb);
      return () => mapFocusListeners.delete(cb);
    },
    getMapFocus,
    () => false,
  );
  const narrow = useSyncExternalStore(subscribeNarrow, getNarrow, () => false);

  const [session, setSession] = useState<SessionUser | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [allowReset, setAllowReset] = useState(true);
  const [supabaseConfigured, setSupabaseConfigured] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);
  const [adminsOpen, setAdminsOpen] = useState(false);
  const authGen = useRef(0);

  const applyAuth = useCallback(
    (
      data: {
        user?: SessionUser | null;
        needsSetup?: boolean;
        googleEnabled?: boolean;
        allowReset?: boolean;
        supabase?: boolean;
      },
      gen: number,
    ) => {
      if (gen !== authGen.current) return;
      setSession(data.user ? withOperatorRole(data.user) : null);
      setNeedsSetup(Boolean(data.needsSetup));
      setGoogleEnabled(Boolean(data.googleEnabled));
      if (typeof data.allowReset === "boolean") setAllowReset(data.allowReset);
      if (typeof data.supabase === "boolean") setSupabaseConfigured(data.supabase);
      if (!data.user) {
        sessionStorage.removeItem(TOOLS_KEY);
        emit(toolsListeners);
      }
    },
    [],
  );

  const refreshAuth = useCallback(async () => {
    const gen = authGen.current;
    try {
      if (STATIC_DEPLOY) {
        applyAuth(
          {
            user: readLocalSession(),
            needsSetup: localNeedsSetup(),
            googleEnabled: false,
            allowReset: true,
          },
          gen,
        );
        return;
      }
      const res = await fetch(withBase("/api/auth/me"), { credentials: "same-origin", cache: "no-store" });
      const data = (await res.json()) as {
        user?: SessionUser | null;
        needsSetup?: boolean;
        googleEnabled?: boolean;
        allowReset?: boolean;
        supabase?: boolean;
      };
      applyAuth(data, gen);
    } catch {
      /* keep the current session if /me fails */
    } finally {
      if (gen === authGen.current) setAuthLoading(false);
    }
  }, [applyAuth]);

  useEffect(() => {
    let cancelled = false;
    const gen = authGen.current;
    const params = new URLSearchParams(window.location.search);
    const error = params.get("authError");
    const authOk = params.get("auth") === "ok";
    (async () => {
      try {
        if (STATIC_DEPLOY) {
          if (cancelled) return;
          applyAuth(
            {
              user: readLocalSession(),
              needsSetup: localNeedsSetup(),
              googleEnabled: false,
              allowReset: true,
            },
            gen,
          );
          return;
        }
        const res = await fetch(withBase("/api/auth/me"), {
          credentials: "same-origin",
          cache: "no-store",
        });
        const data = (await res.json()) as {
          user?: SessionUser | null;
          needsSetup?: boolean;
          googleEnabled?: boolean;
          allowReset?: boolean;
          supabase?: boolean;
        };
        if (cancelled) return;
        applyAuth(data, gen);
        if (gen !== authGen.current) return;
        if (error) {
          setAuthError(error);
          setLoginOpen(true);
        }
        if (data.user && authOk) {
          sessionStorage.setItem(TOOLS_KEY, "1");
          emit(toolsListeners);
          setLoginOpen(false);
        }
        if (error || authOk) {
          params.delete("authError");
          params.delete("auth");
          params.delete("linked");
          const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
          window.history.replaceState({}, "", next);
        }
      } catch {
        /* keep optimistic login if /me fails */
      } finally {
        if (!cancelled && gen === authGen.current) setAuthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyAuth]);

  const setLayout = useCallback((next: LayoutMode) => {
    localStorage.setItem(LAYOUT_KEY, next);
    if (next === "mobile") {
      sessionStorage.removeItem(TOOLS_KEY);
      emit(toolsListeners);
    }
    emit(layoutListeners);
  }, []);

  const setTheme = useCallback((next: ThemeMode) => {
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      /* quota / private mode */
    }
    applyThemeAttr(next);
    emit(themeListeners);
  }, []);

  const setMapFocus = useCallback((on: boolean) => {
    try {
      window.localStorage.setItem(MAP_FOCUS_KEY, on ? "1" : "0");
    } catch {
      /* quota / private mode */
    }
    emit(mapFocusListeners);
  }, []);

  useEffect(() => {
    // Never let the SSR snapshot ("light") overwrite the FOUC / localStorage choice.
    applyThemeAttr(getTheme());
    emit(themeListeners);
  }, [theme]);

  const setAdmin = useCallback(
    (on: boolean) => {
      if (on) {
        if (!session) {
          void refreshAuth().finally(() => setLoginOpen(true));
          return;
        }
        sessionStorage.setItem(TOOLS_KEY, "1");
      } else {
        sessionStorage.removeItem(TOOLS_KEY);
      }
      emit(toolsListeners);
    },
    [session, refreshAuth],
  );

  const completeLogin = useCallback((user: SessionUser) => {
    authGen.current += 1;
    setSession(withOperatorRole(user));
    setNeedsSetup(false);
    setAuthError(null);
    setLoginOpen(false);
    setAuthLoading(false);
    sessionStorage.setItem(TOOLS_KEY, "1");
    emit(toolsListeners);
  }, []);

  const logout = useCallback(async () => {
    authGen.current += 1;
    try {
      if (STATIC_DEPLOY) clearLocalSession();
      else await fetch(withBase("/api/auth/logout"), { method: "POST", credentials: "same-origin" });
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
  const isMobile = layout === "mobile" || narrow;

  const value = useMemo<OpsMode>(
    () => ({
      layout,
      theme,
      admin,
      isMobile,
      mapFocus,
      session,
      authLoading,
      needsSetup,
      googleEnabled,
      allowReset,
      supabaseConfigured,
      authError,
      loginOpen,
      adminsOpen,
      setLayout,
      setTheme,
      setMapFocus,
      setAdmin,
      openLogin: () => {
        void refreshAuth().finally(() => setLoginOpen(true));
      },
      closeLogin: () => setLoginOpen(false),
      openAdmins: () => setAdminsOpen(true),
      closeAdmins: () => setAdminsOpen(false),
      completeLogin,
      logout,
      refreshAuth,
    }),
    [
      layout,
      theme,
      admin,
      isMobile,
      mapFocus,
      session,
      authLoading,
      needsSetup,
      googleEnabled,
      allowReset,
      supabaseConfigured,
      authError,
      loginOpen,
      adminsOpen,
      setLayout,
      setTheme,
      setMapFocus,
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
  theme: "light",
  admin: false,
  isMobile: false,
  mapFocus: false,
  session: null,
  authLoading: true,
  needsSetup: false,
  googleEnabled: false,
  allowReset: true,
  supabaseConfigured: false,
  authError: null,
  loginOpen: false,
  adminsOpen: false,
  setLayout: () => {},
  setTheme: () => {},
  setMapFocus: () => {},
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
