import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  dummyPasswordCheck,
  hashPassword,
  normalizeLogin,
  safeEqualString,
  validateLogin,
  validateName,
  validatePassword,
  verifyPassword,
} from "@/lib/password";

export type AdminRecord = {
  id: string;
  name: string;
  login: string;
  passwordHash: string;
  createdAt: string;
  source: "file";
};

export type PublicAdmin = {
  id: string;
  name: string;
  login: string;
  createdAt: string;
  source: "file" | "env";
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
    return parsed.admins.filter(
      (row) =>
        row &&
        typeof row.id === "string" &&
        typeof row.login === "string" &&
        typeof row.passwordHash === "string" &&
        typeof row.name === "string",
    );
  } catch {
    return [];
  }
}

function readFileAdmins(): AdminRecord[] {
  const primary = readStoreFrom(FILE_PATH);
  if (primary.length) return primary;
  return readStoreFrom(TMP_FALLBACK);
}

function writeFileAdmins(admins: AdminRecord[]) {
  const payload = `${JSON.stringify({ admins }, null, 2)}\n`;
  const targets = [FILE_PATH, TMP_FALLBACK];
  let lastError: unknown;
  for (const target of targets) {
    try {
      mkdirSync(path.dirname(target), { recursive: true });
      const tmp = `${target}.${process.pid}.tmp`;
      writeFileSync(tmp, payload, { mode: 0o600 });
      renameSync(tmp, target);
      return;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Não foi possível gravar administradores.");
}

export function envAdminPublic(): PublicAdmin | null {
  const login = envLogin();
  const id = envAdminId();
  if (!login || !id || !envPassword()) return null;
  return {
    id,
    login,
    name: envName(),
    createdAt: "ambiente",
    source: "env",
  };
}

export function listAdmins(): PublicAdmin[] {
  const file = readFileAdmins().map((row) => ({
    id: row.id,
    name: row.name,
    login: row.login,
    createdAt: row.createdAt,
    source: "file" as const,
  }));
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
  return adminCount() === 0;
}

export function findAdminById(id: string): PublicAdmin | null {
  const file = readFileAdmins().find((row) => row.id === id);
  if (file) {
    return {
      id: file.id,
      name: file.name,
      login: file.login,
      createdAt: file.createdAt,
      source: "file",
    };
  }
  const env = envAdminPublic();
  if (env && env.id === id) return env;
  return null;
}

export function verifyAdminCredentials(login: string, password: string): PublicAdmin | null {
  const key = normalizeLogin(login);
  const file = readFileAdmins().find((row) => row.login === key);
  if (file) {
    if (!verifyPassword(password, file.passwordHash)) return null;
    return {
      id: file.id,
      name: file.name,
      login: file.login,
      createdAt: file.createdAt,
      source: "file",
    };
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
  password: string;
}): PublicAdmin {
  const nameErr = validateName(input.name);
  if (nameErr) throw new Error(nameErr);
  const loginErr = validateLogin(input.login);
  if (loginErr) throw new Error(loginErr);
  const passErr = validatePassword(input.password);
  if (passErr) throw new Error(passErr);

  const login = normalizeLogin(input.login);
  if (readFileAdmins().some((row) => row.login === login) || envLogin() === login) {
    throw new Error("Já existe um administrador com este usuário.");
  }

  const record: AdminRecord = {
    id: randomUUID(),
    name: input.name.trim(),
    login,
    passwordHash: hashPassword(input.password),
    createdAt: new Date().toISOString(),
    source: "file",
  };
  writeFileAdmins([...readFileAdmins(), record]);
  return {
    id: record.id,
    name: record.name,
    login: record.login,
    createdAt: record.createdAt,
    source: "file",
  };
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
  if (!verifyPassword(currentPassword, admins[idx].passwordHash)) {
    throw new Error("Senha atual incorreta.");
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
