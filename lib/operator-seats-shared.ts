export const MAX_OPERATOR_SEATS = 6;

export type OperatorSeat = {
  userId: string;
  login: string;
  name: string;
  roleLabel: string;
  sessionId: string;
  lastSeen: number;
};

export type SeatSnapshot = {
  seats: OperatorSeat[];
  max: number;
  remaining: number;
};

export function seatNames(seats: Pick<OperatorSeat, "name" | "login">[]): string {
  const names = seats.map((row) => row.name.split(/\s+/)[0] || row.login);
  if (!names.length) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} e ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} e ${names[names.length - 1]}`;
}
