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
import { MAX_OPERATOR_SEATS, type OperatorSeat } from "@/lib/operator-seats-shared";

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
  narrow: boolean;
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
  seats: OperatorSeat[];
  maxSeats: number;
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

function applyMapFocusAttr(on: boolean) {
  const root = document.documentElement;
  if (on) root.dataset.mapFocus = "1";
  else delete root.dataset.mapFocus;
}

export function OpsModeProvider({ children }: { children: React.ReactNode }) {
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
  const layout: LayoutMode = narrow ? "mobile" : "desktop";

  const [session, setSession] = useState<SessionUser | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [allowReset, setAllowReset] = useState(true);
  const [supabaseConfigured, setSupabaseConfigured] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginOpen, setLoginOpen] = useState(false);
  const [adminsOpen, setAdminsOpen] = useState(false);
  const [seats, setSeats] = useState<OperatorSeat[]>([]);
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
        seats?: OperatorSeat[];
      };
      applyAuth(data, gen);
      if (Array.isArray(data.seats)) setSeats(data.seats);
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
          seats?: OperatorSeat[];
        };
        if (cancelled) return;
        applyAuth(data, gen);
        if (Array.isArray(data.seats)) setSeats(data.seats);
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

  useEffect(() => {
    try {
      localStorage.removeItem(LAYOUT_KEY);
    } catch {
      /* quota / private mode */
    }
  }, []);

  useEffect(() => {
    if (!narrow) return;
    if (sessionStorage.getItem(TOOLS_KEY) !== "1") return;
    sessionStorage.removeItem(TOOLS_KEY);
    emit(toolsListeners);
  }, [narrow]);

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
    applyMapFocusAttr(on);
    emit(mapFocusListeners);
  }, []);

  useEffect(() => {
    applyMapFocusAttr(mapFocus);
  }, [mapFocus]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.closest("input, textarea, select, [contenteditable=true]"))) return;
      if (!getMapFocus()) return;
      event.preventDefault();
      try {
        window.localStorage.setItem(MAP_FOCUS_KEY, "0");
      } catch {
        /* quota */
      }
      applyMapFocusAttr(false);
      emit(mapFocusListeners);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
    setSeats([]);
    sessionStorage.removeItem(TOOLS_KEY);
    emit(toolsListeners);
    setAdminsOpen(false);
    await refreshAuth();
  }, [refreshAuth]);

  useEffect(() => {
    if (STATIC_DEPLOY || !session) return;
    let cancelled = false;
    async function beat() {
      try {
        const res = await fetch(withBase("/api/auth/presence"), {
          method: "POST",
          credentials: "same-origin",
        });
        const data = (await res.json()) as {
          seats?: OperatorSeat[];
          error?: string;
          kicked?: boolean;
        };
        if (cancelled) return;
        if (Array.isArray(data.seats)) setSeats(data.seats);
        if (res.status === 409) {
          setAuthError(data.error ?? "Não foi possível manter a sessão no posto.");
          setLoginOpen(true);
          await logout();
        }
      } catch {
        /* o posto segue com a última lista */
      }
    }
    void beat();
    const timer = window.setInterval(() => void beat(), 20_000);
    const onVis = () => {
      if (document.visibilityState === "visible") void beat();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [session, logout]);

  const admin = layout === "desktop" && Boolean(session) && toolsOn;
  const isMobile = narrow;

  const value = useMemo<OpsMode>(
    () => ({
      layout,
      theme,
      admin,
      isMobile,
      narrow,
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
      seats,
      maxSeats: MAX_OPERATOR_SEATS,
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
      narrow,
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
      seats,
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
  narrow: false,
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
  seats: [],
  maxSeats: MAX_OPERATOR_SEATS,
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
