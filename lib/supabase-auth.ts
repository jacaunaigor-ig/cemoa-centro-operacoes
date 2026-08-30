import type { PublicAdmin } from "@/lib/admins";
import { memberForOperator, roleForOperator, foldIdent } from "@/lib/equipe";
import { normalizeEmail, normalizeLogin } from "@/lib/password";
import {
  supabaseAnonKey,
  supabaseConfigured,
  supabaseKey,
  supabaseUrl,
  upsertRemoteProfile,
} from "@/lib/supabase-ops";

type AuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

function metaString(meta: Record<string, unknown> | null | undefined, key: string) {
  const value = meta?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function adminFromUser(user: AuthUser): PublicAdmin {
  const email = user.email ? normalizeEmail(user.email) : null;
  const meta = user.user_metadata ?? {};
  const metaName = metaString(meta, "name") || metaString(meta, "full_name");
  const metaLogin = metaString(meta, "login") || metaString(meta, "user_name");
  const local = email ? email.split("@")[0] : "";
  const login = normalizeLogin(metaLogin || local || user.id.slice(0, 8));
  const member = memberForOperator(metaName || local, login);
  const name = member?.nome ?? (metaName || local || "Admin CEMOA");
  return {
    id: user.id,
    name,
    login: member?.login ?? login,
    email,
    googleSub: null,
    createdAt: new Date().toISOString(),
    source: "supabase",
  };
}

async function passwordGrant(email: string, password: string): Promise<AuthUser | { error: string }> {
  const url = supabaseUrl();
  const key = supabaseAnonKey();
  if (!url || !key) return { error: "Supabase ainda sem chaves neste ambiente." };
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    user?: AuthUser;
    error_description?: string;
    msg?: string;
    error?: string;
  };
  if (!res.ok || !data.user?.id) {
    const msg = data.error_description || data.msg || data.error || "";
    if (/confirm|not confirmed/i.test(msg)) {
      return {
        error:
          "Confirme o e-mail no Supabase (Authentication → Users) ou desligue Confirm email em Authentication → Providers.",
      };
    }
    return { error: "E-mail ou senha incorretos." };
  }
  return data.user;
}

async function resolveEmail(login: string): Promise<string | null> {
  if (login.includes("@")) return normalizeEmail(login);
  const url = supabaseUrl();
  const key = supabaseKey();
  if (!url || !key) return null;
  const res = await fetch(`${url}/auth/v1/admin/users?per_page=200`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as { users?: AuthUser[] };
  const needle = foldIdent(login);
  const hit = (data.users ?? []).find((user) => {
    const email = user.email ?? "";
    const local = email.split("@")[0] ?? "";
    const meta = user.user_metadata ?? {};
    const metaLogin = metaString(meta, "login");
    const metaName = metaString(meta, "name") || metaString(meta, "full_name");
    return (
      foldIdent(local) === needle ||
      foldIdent(metaLogin) === needle ||
      foldIdent(metaName) === needle ||
      foldIdent(email) === needle
    );
  });
  return hit?.email ? normalizeEmail(hit.email) : null;
}

export async function signInSupabase(
  login: string,
  password: string,
): Promise<{ admin: PublicAdmin } | { error: string; status: number }> {
  if (!supabaseConfigured()) {
    return { error: "Supabase não configurado.", status: 400 };
  }
  try {
    const email = await resolveEmail(login.trim());
    if (!email) {
      return {
        error: "Informe o e-mail da conta no Supabase (Authentication → Users).",
        status: 400,
      };
    }
    const user = await passwordGrant(email, password);
    if ("error" in user) return { error: user.error, status: 401 };
    const admin = adminFromUser(user);
    try {
      await upsertRemoteProfile({
        id: admin.id,
        name: admin.name,
        login: admin.login,
        role: roleForOperator(admin.name, admin.login),
      });
    } catch {
      // Login não depende da tabela profiles (schema ainda não rodado).
    }
    return { admin };
  } catch {
    return { error: "Não foi possível falar com o Supabase. Confira URL e chaves no Vercel.", status: 502 };
  }
}
