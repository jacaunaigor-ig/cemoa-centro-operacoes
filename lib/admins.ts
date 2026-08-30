import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  dummyPasswordCheck,
  hashPassword,
  normalizeEmail,
  normalizeLogin,
  safeEqualString,
  validateEmail,
  validateLogin,
  validateName,
  validatePassword,
  verifyPassword,
} from "@/lib/password";
import { googleAllowlist, isAllowedGoogleEmail, type GoogleProfile } from "@/lib/google";
import { supabaseConfigured } from "@/lib/supabase-ops";

export type AdminRecord = {
  id: string;
  name: string;
  login: string;
  passwordHash: string;
  email?: string;
  googleSub?: string;
  createdAt: string;
  source: "file";
};

export type PublicAdmin = {
  id: string;
  name: string;
  login: string;
  email: string | null;
  googleSub: string | null;
  createdAt: string;
  source: "file" | "env" | "supabase";
};

type StoreFile = { admins: AdminRecord[] };

const FILE_PATH = path.join(process.cwd(), "data", "admins.json");
const TMP_FALLBACK = path.join("/tmp", "cemoa-admins.json");

function envLogin(): string | null {
  const login = process.env.CEMOA_ADMIN_LOGIN?.trim();
  return login ? normalizeLogin(login) : null;
}

function envPassword(): string | null {
  const password = process.env.CEMOA_ADMIN_PASSWORD;
  return password && password.length > 0 ? password : null;
}

function envName(): string {
  return process.env.CEMOA_ADMIN_NAME?.trim() || "Administrador CEMOA";
}

function envAdminId(): string | null {
  const login = envLogin();
  return login ? `env:${login}` : null;
}

function readStoreFrom(file: string): AdminRecord[] {
  try {
    const raw = readFileSync(file, "utf8");
    const parsed = JSON.parse(raw) as StoreFile;
    if (!Array.isArray(parsed.admins)) return [];
    return parsed.admins
      .filter(
        (row) =>
          row &&
          typeof row.id === "string" &&
          typeof row.login === "string" &&
          typeof row.name === "string",
      )
      .map((row) => ({
        ...row,
        passwordHash: typeof row.passwordHash === "string" ? row.passwordHash : "",
        email: row.email ? normalizeEmail(row.email) : undefined,
        googleSub: row.googleSub || undefined,
      }));
  } catch {
    return [];
  }
}

function readFileAdmins(): AdminRecord[] {
  if (existsSync(FILE_PATH)) return readStoreFrom(FILE_PATH);
  return readStoreFrom(TMP_FALLBACK);
}

function writeFileAdmins(admins: AdminRecord[]) {
  const payload = `${JSON.stringify({ admins }, null, 2)}\n`;
  const targets = [FILE_PATH, TMP_FALLBACK];
  let lastError: unknown;
  let wrote = 0;
  for (const target of targets) {
    try {
      mkdirSync(path.dirname(target), { recursive: true });
      const tmp = `${target}.${process.pid}.tmp`;
      writeFileSync(tmp, payload, { mode: 0o600 });
      renameSync(tmp, target);
      wrote += 1;
    } catch (err) {
      lastError = err;
    }
  }
  if (wrote === 0) {
    throw lastError instanceof Error
      ? lastError
      : new Error("Não foi possível gravar administradores.");
  }
}

function toPublic(row: AdminRecord): PublicAdmin {
  return {
    id: row.id,
    name: row.name,
    login: row.login,
    email: row.email ?? null,
    googleSub: row.googleSub ?? null,
    createdAt: row.createdAt,
    source: "file",
  };
}

export function envAdminPublic(): PublicAdmin | null {
  const login = envLogin();
  const id = envAdminId();
  if (!login || !id || !envPassword()) return null;
  const email = process.env.CEMOA_ADMIN_EMAIL?.trim()
    ? normalizeEmail(process.env.CEMOA_ADMIN_EMAIL)
    : null;
  return {
    id,
    login,
    name: envName(),
    email,
    googleSub: null,
    createdAt: "ambiente",
    source: "env",
  };
}

export function listAdmins(): PublicAdmin[] {
  const file = readFileAdmins().map(toPublic);
  const env = envAdminPublic();
  if (env && !file.some((row) => row.login === env.login)) {
    return [env, ...file];
  }
  return file;
}

export function adminCount(): number {
  return listAdmins().length;
}

export function needsSetup(): boolean {
  if (supabaseConfigured()) return false;
  return adminCount() === 0;
}

export function findAdminById(id: string): PublicAdmin | null {
  const file = readFileAdmins().find((row) => row.id === id);
  if (file) return toPublic(file);
  const env = envAdminPublic();
  if (env && env.id === id) return env;
  return null;
}

function findFileByEmail(email: string): AdminRecord | undefined {
  const key = normalizeEmail(email);
  return readFileAdmins().find(
    (row) => row.email === key || row.login === key || normalizeLogin(row.login) === key,
  );
}

export function allowLocalReset(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function enterWithCredentials(input: {
  name?: string;
  login: string;
  password: string;
  email?: string;
  reset?: boolean;
}): { admin: PublicAdmin; created: boolean } | { error: string; status: number } {
  const login = typeof input.login === "string" ? input.login : "";
  const password = typeof input.password === "string" ? input.password.trim() : "";
  if (!login || !password) {
    return { error: "Informe usuário e senha.", status: 400 };
  }

  if (input.reset) {
    if (!allowLocalReset()) {
      return { error: "Redefinir acesso só vale neste computador (não em produção).", status: 403 };
    }
    writeFileAdmins([]);
    try {
      const admin = createAdmin({
        name: (input.name && input.name.trim()) || login,
        login,
        password,
        email: input.email,
      });
      return { admin, created: true };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Não foi possível redefinir o administrador.",
        status: 400,
      };
    }
  }

  const existing = verifyAdminCredentials(login, password);
  if (existing) return { admin: existing, created: false };

  const key = normalizeLogin(login);
  const known = readFileAdmins().some(
    (row) => row.login === key || (row.email && row.email === normalizeEmail(login)),
  );
  if (known || envLogin() === key) {
    return {
      error: allowLocalReset()
        ? "Usuário ou senha incorretos. Se este computador ainda não tem o seu acesso, use Redefinir acesso local."
        : "Usuário ou senha incorretos.",
      status: 401,
    };
  }

  if (!needsSetup()) {
    return {
      error: allowLocalReset()
        ? "Já existe um administrador neste computador. Entre com o usuário e a senha cadastrados, ou use Redefinir acesso local."
        : "Usuário ou senha incorretos.",
      status: 401,
    };
  }

  try {
    const admin = createAdmin({
      name: (input.name && input.name.trim()) || login,
      login,
      password,
      email: input.email,
    });
    return { admin, created: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Não foi possível criar o administrador.",
      status: 400,
    };
  }
}

export function verifyAdminCredentials(login: string, password: string): PublicAdmin | null {
  const key = normalizeLogin(login);
  const file = readFileAdmins().find(
    (row) => row.login === key || (row.email && row.email === normalizeEmail(login)),
  );
  if (file) {
    if (!file.passwordHash || !verifyPassword(password, file.passwordHash)) return null;
    return toPublic(file);
  }
  const env = envAdminPublic();
  const expected = envPassword();
  if (env && env.login === key && expected) {
    if (safeEqualString(password, expected)) return env;
    dummyPasswordCheck(password);
    return null;
  }
  dummyPasswordCheck(password);
  return null;
}

export function createAdmin(input: {
  name: string;
  login: string;
  password?: string;
  email?: string;
}): PublicAdmin {
  const nameErr = validateName(input.name);
  if (nameErr) throw new Error(nameErr);
  const loginErr = validateLogin(input.login);
  if (loginErr) throw new Error(loginErr);

  const email = input.email?.trim() ? normalizeEmail(input.email) : undefined;
  if (email) {
    const emailErr = validateEmail(email);
    if (emailErr) throw new Error(emailErr);
  }

  const password = input.password?.trim() ?? "";
  if (password) {
    const passErr = validatePassword(password);
    if (passErr) throw new Error(passErr);
  } else if (!email) {
    throw new Error("Informe uma senha ou um Gmail para o novo administrador.");
  }

  const login = normalizeLogin(input.login);
  if (readFileAdmins().some((row) => row.login === login) || envLogin() === login) {
    throw new Error("Já existe um administrador com este usuário.");
  }
  if (email && (findFileByEmail(email) || listAdmins().some((row) => row.email === email))) {
    throw new Error("Este Gmail já está associado a um administrador.");
  }

  const record: AdminRecord = {
    id: randomUUID(),
    name: input.name.trim(),
    login,
    passwordHash: password ? hashPassword(password) : "",
    email,
    createdAt: new Date().toISOString(),
    source: "file",
  };
  writeFileAdmins([...readFileAdmins(), record]);
  return toPublic(record);
}

export function enterWithGoogle(profile: GoogleProfile):
  | { admin: PublicAdmin; created: boolean }
  | { error: string; status: number } {
  if (!profile.emailVerified) {
    return { error: "O Gmail precisa estar verificado no Google.", status: 403 };
  }
  if (!isAllowedGoogleEmail(profile.email)) {
    return {
      error: "Use uma conta Gmail (ou um e-mail autorizado pelo CEMOA).",
      status: 403,
    };
  }

  const bySub = readFileAdmins().find((row) => row.googleSub === profile.sub);
  if (bySub) {
    const next = { ...bySub, email: profile.email, name: bySub.name || profile.name };
    writeFileAdmins(readFileAdmins().map((row) => (row.id === next.id ? next : row)));
    return { admin: toPublic(next), created: false };
  }

  const byEmail = findFileByEmail(profile.email);
  if (byEmail) {
    const next = { ...byEmail, email: profile.email, googleSub: profile.sub };
    writeFileAdmins(readFileAdmins().map((row) => (row.id === next.id ? next : row)));
    return { admin: toPublic(next), created: false };
  }

  const env = envAdminPublic();
  if (env?.email && env.email === profile.email) {
    return { admin: env, created: false };
  }

  const allow = googleAllowlist();
  const canCreate = needsSetup() || allow.includes(profile.email);
  if (!canCreate) {
    return {
      error: "Este Gmail não está autorizado. Um administrador precisa cadastrar o e-mail.",
      status: 403,
    };
  }

  try {
    const admin = createAdmin({
      name: profile.name,
      login: profile.email,
      email: profile.email,
    });
    const files = readFileAdmins();
    const idx = files.findIndex((row) => row.id === admin.id);
    if (idx >= 0) {
      files[idx] = { ...files[idx], googleSub: profile.sub, email: profile.email };
      writeFileAdmins(files);
      return { admin: toPublic(files[idx]), created: true };
    }
    return { admin, created: true };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Não foi possível entrar com o Gmail.",
      status: 400,
    };
  }
}

export function linkGoogleToAdmin(
  adminId: string,
  profile: GoogleProfile,
): { admin: PublicAdmin } | { error: string; status: number } {
  if (!profile.emailVerified) {
    return { error: "O Gmail precisa estar verificado no Google.", status: 403 };
  }
  if (!isAllowedGoogleEmail(profile.email)) {
    return { error: "Use uma conta Gmail (ou um e-mail autorizado pelo CEMOA).", status: 403 };
  }
  const admins = readFileAdmins();
  const idx = admins.findIndex((row) => row.id === adminId);
  if (idx < 0) {
    return { error: "Contas do ambiente associam o Gmail por CEMOA_ADMIN_EMAIL.", status: 400 };
  }
  const taken = admins.find(
    (row) =>
      row.id !== adminId &&
      (row.googleSub === profile.sub || row.email === profile.email),
  );
  if (taken) {
    return { error: "Este Gmail já está associado a outro administrador.", status: 409 };
  }
  admins[idx] = {
    ...admins[idx],
    email: profile.email,
    googleSub: profile.sub,
  };
  writeFileAdmins(admins);
  return { admin: toPublic(admins[idx]) };
}

export function updateAdminPassword(id: string, currentPassword: string, nextPassword: string) {
  const passErr = validatePassword(nextPassword);
  if (passErr) throw new Error(passErr);
  const admins = readFileAdmins();
  const idx = admins.findIndex((row) => row.id === id);
  if (idx < 0) {
    throw new Error(
      "Contas definidas no ambiente não alteram a senha por aqui. Use CEMOA_ADMIN_PASSWORD.",
    );
  }
  if (admins[idx].passwordHash && !verifyPassword(currentPassword, admins[idx].passwordHash)) {
    throw new Error("Senha atual incorreta.");
  }
  if (!admins[idx].passwordHash && currentPassword) {
    throw new Error("Esta conta entra pelo Gmail. Deixe a senha atual em branco ou defina uma nova.");
  }
  admins[idx] = { ...admins[idx], passwordHash: hashPassword(nextPassword) };
  writeFileAdmins(admins);
}

export function deleteAdmin(id: string, actorId: string) {
  if (id === actorId) {
    throw new Error("Você não pode remover a conta em que está autenticado.");
  }
  const env = envAdminPublic();
  if (env && id === env.id) {
    throw new Error("O administrador do ambiente não pode ser removido por aqui.");
  }
  const admins = readFileAdmins();
  const next = admins.filter((row) => row.id !== id);
  if (next.length === admins.length) {
    throw new Error("Administrador não encontrado.");
  }
  const remaining = next.length + (env && !next.some((row) => row.login === env.login) ? 1 : 0);
  if (remaining < 1) {
    throw new Error("É preciso manter pelo menos um administrador.");
  }
  writeFileAdmins(next);
}
