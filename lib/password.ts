import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT = { N: 16_384, r: 8, p: 1, dkLen: 64 } as const;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT.dkLen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
  });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

const DUMMY_HASH = hashPassword("cemoa-dummy-password-never-used");

function scryptVerify(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4], "hex");
  const expected = Buffer.from(parts[5], "hex");
  if (!Number.isFinite(N) || !salt.length || !expected.length) return false;
  try {
    const actual = scryptSync(password, salt, expected.length, { N, r, p });
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function verifyPassword(password: string, stored: string): boolean {
  return scryptVerify(password, stored);
}

export function dummyPasswordCheck(password: string) {
  scryptVerify(password, DUMMY_HASH);
}

export function normalizeLogin(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateLogin(raw: string): string | null {
  const login = normalizeLogin(raw);
  if (!/^[a-z0-9._-]{3,32}$/.test(login)) {
    return "O usuário deve ter 3 a 32 caracteres (letras, números, ponto, _ ou -).";
  }
  return null;
}

export function validateName(raw: string): string | null {
  const name = raw.trim();
  if (name.length < 2 || name.length > 80) {
    return "Informe o nome do administrador (2 a 80 caracteres).";
  }
  return null;
}

export function validatePassword(raw: string): string | null {
  if (raw.length < 10 || raw.length > 128) {
    return "A senha deve ter no mínimo 10 caracteres.";
  }
  if (!/[A-Za-zÀ-ÿ]/.test(raw) || !/\d/.test(raw)) {
    return "A senha precisa de letras e números.";
  }
  return null;
}

export function safeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    timingSafeEqual(left, left);
    return false;
  }
  return timingSafeEqual(left, right);
}
