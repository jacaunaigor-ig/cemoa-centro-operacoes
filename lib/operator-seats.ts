import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  MAX_OPERATOR_SEATS,
  seatNames,
  type OperatorSeat,
  type SeatSnapshot,
} from "@/lib/operator-seats-shared";
import {
  fetchRemoteOperatorSeats,
  supabaseConfigured,
  syncRemoteOperatorSeats,
} from "@/lib/supabase-ops";

export { MAX_OPERATOR_SEATS, seatNames, type OperatorSeat, type SeatSnapshot } from "@/lib/operator-seats-shared";

export const SEAT_TTL_MS = 90_000;

export type SeatClaim =
  | { ok: true; snapshot: SeatSnapshot }
  | { ok: false; kicked?: boolean; error: string; status: 409; snapshot: SeatSnapshot };

type StoreFile = { seats: OperatorSeat[] };

const FILE_PATH = path.join(process.cwd(), "data", "operator-seats.json");
const TMP_FALLBACK = path.join("/tmp", "cemoa-operator-seats.json");

function readStoreFrom(file: string): OperatorSeat[] {
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as StoreFile;
    if (!Array.isArray(parsed.seats)) return [];
    return parsed.seats.filter(
      (row) =>
        row &&
        typeof row.userId === "string" &&
        typeof row.login === "string" &&
        typeof row.sessionId === "string" &&
        typeof row.lastSeen === "number",
    );
  } catch {
    return [];
  }
}

function readFileSeats(): OperatorSeat[] {
  if (existsSync(FILE_PATH)) return readStoreFrom(FILE_PATH);
  return readStoreFrom(TMP_FALLBACK);
}

function writeFileSeats(seats: OperatorSeat[]) {
  const payload = `${JSON.stringify({ seats }, null, 2)}\n`;
  for (const target of [FILE_PATH, TMP_FALLBACK]) {
    try {
      mkdirSync(path.dirname(target), { recursive: true });
      const tmp = `${target}.${process.pid}.tmp`;
      writeFileSync(tmp, payload, { mode: 0o600 });
      renameSync(tmp, target);
    } catch {
      /* Vercel / read-only data dir */
    }
  }
}

function prune(seats: OperatorSeat[], now = Date.now()): OperatorSeat[] {
  return seats.filter((row) => now - row.lastSeen < SEAT_TTL_MS);
}

export function seatSnapshot(seats: OperatorSeat[]): SeatSnapshot {
  const live = prune(seats);
  return {
    seats: live.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    max: MAX_OPERATOR_SEATS,
    remaining: Math.max(0, MAX_OPERATOR_SEATS - live.length),
  };
}

function fullMessage(seats: OperatorSeat[]): string {
  const names = seatNames(seats);
  return names
    ? `O posto já tem ${MAX_OPERATOR_SEATS} operadores logados. No posto: ${names}.`
    : `O posto já tem ${MAX_OPERATOR_SEATS} operadores logados.`;
}

async function loadSeats(): Promise<OperatorSeat[]> {
  if (supabaseConfigured()) {
    const remote = await fetchRemoteOperatorSeats();
    if (remote) return prune(remote);
  }
  return prune(readFileSeats());
}

async function persistSeats(seats: OperatorSeat[]) {
  writeFileSeats(seats);
  if (supabaseConfigured()) {
    await syncRemoteOperatorSeats(seats);
  }
}

export async function listOperatorSeats(): Promise<SeatSnapshot> {
  return seatSnapshot(await loadSeats());
}

export async function claimOperatorSeat(input: {
  userId: string;
  login: string;
  name: string;
  roleLabel: string;
  sessionId: string;
}): Promise<SeatClaim> {
  const now = Date.now();
  const seats = await loadSeats();
  const mine = seats.find((row) => row.userId === input.userId);
  if (mine) {
    mine.login = input.login;
    mine.name = input.name;
    mine.roleLabel = input.roleLabel;
    mine.sessionId = input.sessionId;
    mine.lastSeen = now;
    await persistSeats(seats);
    return { ok: true, snapshot: seatSnapshot(seats) };
  }
  if (seats.length >= MAX_OPERATOR_SEATS) {
    return {
      ok: false,
      error: fullMessage(seats),
      status: 409,
      snapshot: seatSnapshot(seats),
    };
  }
  seats.push({
    userId: input.userId,
    login: input.login,
    name: input.name,
    roleLabel: input.roleLabel,
    sessionId: input.sessionId,
    lastSeen: now,
  });
  await persistSeats(seats);
  return { ok: true, snapshot: seatSnapshot(seats) };
}

export async function touchOperatorSeat(input: {
  userId: string;
  login: string;
  name: string;
  roleLabel: string;
  sessionId: string;
}): Promise<SeatClaim> {
  const seats = await loadSeats();
  const mine = seats.find((row) => row.userId === input.userId);
  if (mine && mine.sessionId !== input.sessionId) {
    return {
      ok: false,
      kicked: true,
      error: "Esta conta entrou em outro computador. A sessão daqui foi encerrada.",
      status: 409,
      snapshot: seatSnapshot(seats),
    };
  }
  return claimOperatorSeat(input);
}

export async function releaseOperatorSeat(userId: string, sessionId?: string) {
  const seats = await loadSeats();
  const next = seats.filter((row) => {
    if (row.userId !== userId) return true;
    if (sessionId && row.sessionId !== sessionId) return true;
    return false;
  });
  if (next.length !== seats.length) await persistSeats(next);
  return seatSnapshot(next);
}
