"use client";

export type LocalAdmin = {
  id: string;
  name: string;
  login: string;
  email: string | null;
  createdAt: string;
  source: "file";
  passwordHash: string;
};

export type LocalSession = {
  id: string;
  login: string;
  name: string;
  email: string | null;
};

const ADMINS_KEY = "cemoa_local_admins_v1";
const SESSION_KEY = "cemoa_local_session_v1";

function normalizeLogin(raw: string) {
  return raw.trim().toLowerCase().replace(/\s+/g, "");
}

function validateLogin(raw: string): string | null {
  const login = normalizeLogin(raw);
  if (!/^[a-z0-9._@+-]{3,64}$/.test(login)) {
    return "O usuário deve ter 3 a 64 caracteres (letras, números, ponto, @, _ ou -).";
  }
  return null;
}

function validateName(raw: string): string | null {
  const name = raw.trim();
  if (name.length < 2 || name.length > 80) {
    return "Informe o nome do administrador (2 a 80 caracteres).";
  }
  return null;
}

function validatePassword(raw: string): string | null {
  if (raw.length < 10 || raw.length > 128) return "A senha deve ter no mínimo 10 caracteres.";
  if (!/[A-Za-zÀ-ÿ]/.test(raw) || !/\d/.test(raw)) return "A senha precisa de letras e números.";
  return null;
}

async function hashPassword(password: string, salt?: string): Promise<string> {
  const enc = new TextEncoder();
  const saltBytes = salt
    ? Uint8Array.from(salt.match(/.{1,2}/g)!.map((b) => Number.parseInt(b, 16)))
    : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations: 120_000 },
    key,
    256,
  );
  const saltHex = [...saltBytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  const hashHex = [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `pbkdf2$${saltHex}$${hashHex}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hash] = stored.split("$");
  if (scheme !== "pbkdf2" || !salt || !hash) return false;
  const next = await hashPassword(password, salt);
  return next === stored;
}

function readAdmins(): LocalAdmin[] {
  try {
    const raw = JSON.parse(localStorage.getItem(ADMINS_KEY) || "[]") as LocalAdmin[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeAdmins(admins: LocalAdmin[]) {
  localStorage.setItem(ADMINS_KEY, JSON.stringify(admins));
}

function toPublic(row: LocalAdmin): LocalSession {
  return { id: row.id, login: row.login, name: row.name, email: row.email };
}

export function localNeedsSetup(): boolean {
  return readAdmins().length === 0;
}

export function readLocalSession(): LocalSession | null {
  try {
    const raw = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null") as LocalSession | null;
    if (!raw?.id || !raw.login) return null;
    const admin = readAdmins().find((row) => row.id === raw.id);
    return admin ? toPublic(admin) : null;
  } catch {
    return null;
  }
}

function writeSession(user: LocalSession) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

export function clearLocalSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

export function listLocalAdmins(): Array<Omit<LocalAdmin, "passwordHash">> {
  return readAdmins().map(({ passwordHash: _hash, ...row }) => row);
}

export async function enterLocal(input: {
  name?: string;
  login: string;
  password: string;
  reset?: boolean;
}): Promise<{ user: LocalSession; created: boolean } | { error: string }> {
  const loginErr = validateLogin(input.login);
  if (loginErr) return { error: loginErr };
  if (!input.password) return { error: "Informe usuário e senha." };
  const login = normalizeLogin(input.login);

  if (input.reset) {
    writeAdmins([]);
  }

  const admins = readAdmins();
  const existing = admins.find((row) => row.login === login);
  if (existing) {
    if (!(await verifyPassword(input.password, existing.passwordHash))) {
      return { error: "Usuário ou senha incorretos. Use Redefinir acesso local se for o primeiro acesso neste navegador." };
    }
    const user = toPublic(existing);
    writeSession(user);
    return { user, created: false };
  }

  if (admins.length && !input.reset) {
    return {
      error:
        "Já existe um administrador neste navegador. Entre com o usuário cadastrado ou use Redefinir acesso local.",
    };
  }

  const passErr = validatePassword(input.password);
  if (passErr) return { error: passErr };
  const nameErr = validateName(input.name?.trim() || login);
  if (nameErr) return { error: nameErr };

  const admin: LocalAdmin = {
    id: crypto.randomUUID(),
    name: (input.name && input.name.trim()) || login,
    login,
    email: login.includes("@") ? login : null,
    createdAt: new Date().toISOString(),
    source: "file",
    passwordHash: await hashPassword(input.password),
  };
  writeAdmins([...readAdmins(), admin]);
  const user = toPublic(admin);
  writeSession(user);
  return { user, created: true };
}

export async function createLocalAdmin(input: {
  name: string;
  login: string;
  password: string;
  email?: string;
}): Promise<{ error?: string }> {
  const nameErr = validateName(input.name);
  if (nameErr) return { error: nameErr };
  const loginErr = validateLogin(input.login);
  if (loginErr) return { error: loginErr };
  const passErr = validatePassword(input.password);
  if (passErr) return { error: passErr };
  const login = normalizeLogin(input.login);
  if (readAdmins().some((row) => row.login === login)) {
    return { error: "Já existe um administrador com este usuário." };
  }
  const admin: LocalAdmin = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    login,
    email: input.email?.trim() || null,
    createdAt: new Date().toISOString(),
    source: "file",
    passwordHash: await hashPassword(input.password),
  };
  writeAdmins([...readAdmins(), admin]);
  return {};
}

export function deleteLocalAdmin(id: string, actorId: string): { error?: string } {
  if (id === actorId) return { error: "Você não pode remover a conta em que está autenticado." };
  const next = readAdmins().filter((row) => row.id !== id);
  if (next.length === readAdmins().length) return { error: "Administrador não encontrado." };
  if (next.length < 1) return { error: "É preciso manter pelo menos um administrador." };
  writeAdmins(next);
  return {};
}

export async function updateLocalPassword(
  id: string,
  current: string,
  next: string,
): Promise<{ error?: string }> {
  const passErr = validatePassword(next);
  if (passErr) return { error: passErr };
  const admins = readAdmins();
  const idx = admins.findIndex((row) => row.id === id);
  if (idx < 0) return { error: "Administrador não encontrado." };
  if (!(await verifyPassword(current, admins[idx].passwordHash))) {
    return { error: "Senha atual incorreta." };
  }
  admins[idx] = { ...admins[idx], passwordHash: await hashPassword(next) };
  writeAdmins(admins);
  return {};
}
