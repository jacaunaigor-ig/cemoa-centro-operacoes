export const EQUIPE_ROLES = [
  "meteorologista",
  "geologo",
  "chefe",
  "operacional",
] as const;

export type EquipeRole = (typeof EQUIPE_ROLES)[number];

export type EquipeMembro = {
  nome: string;
  login: string;
  role: EquipeRole;
  setor: string;
  plantao?: boolean;
};

export const ROLE_LABELS: Record<EquipeRole, string> = {
  meteorologista: "Meteorologista plantonista",
  geologo: "Geólogo · expediente",
  chefe: "Chefe do Centro",
  operacional: "Operacional · Centro de Monitoramento",
};

/** Quadro oficial do plantão e do expediente. Contas de login são criadas à parte. */
export const EQUIPE_CEMOA: EquipeMembro[] = [
  { nome: "Karol", login: "karol", role: "meteorologista", setor: "Meteorologia", plantao: true },
  { nome: "Lenizia", login: "lenizia", role: "meteorologista", setor: "Meteorologia", plantao: true },
  { nome: "Luan", login: "luan", role: "meteorologista", setor: "Meteorologia", plantao: true },
  { nome: "Gustavo", login: "gustavo", role: "meteorologista", setor: "Meteorologia", plantao: true },
  { nome: "Adriana", login: "adriana", role: "meteorologista", setor: "Meteorologia", plantao: true },
  { nome: "Thayná", login: "thayna", role: "geologo", setor: "Geologia · expediente" },
  { nome: "Igor", login: "igor", role: "geologo", setor: "Geologia · expediente" },
  {
    nome: "Capitão BM Barroso",
    login: "barroso",
    role: "chefe",
    setor: "Chefe do Centro de Monitoramento",
  },
  { nome: "Albarado", login: "albarado", role: "operacional", setor: "Alertas · IDAP" },
  { nome: "Aldeci Reis", login: "aldeci", role: "operacional", setor: "Alertas · IDAP" },
  { nome: "Galvão", login: "galvao", role: "operacional", setor: "Alertas · IDAP" },
  { nome: "Andréia Amorim", login: "andreia", role: "operacional", setor: "Alertas · IDAP" },
];

export function foldIdent(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function memberForOperator(name?: string | null, login?: string | null): EquipeMembro | null {
  const loginFold = login ? foldIdent(login) : "";
  const nameFold = name ? foldIdent(name) : "";
  return (
    EQUIPE_CEMOA.find((m) => foldIdent(m.login) === loginFold) ??
    EQUIPE_CEMOA.find((m) => foldIdent(m.nome) === nameFold || nameFold.includes(foldIdent(m.nome))) ??
    null
  );
}

export function roleForOperator(name?: string | null, login?: string | null): EquipeRole {
  return memberForOperator(name, login)?.role ?? "operacional";
}

const IDAP = new Set(["albarado", "aldeci", "galvao", "andreia"]);

function anoMesManaus(ts = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Manaus",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date(ts));
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: n("year"), month: n("month") };
}

/** Outubro/2026: a Karoline está no administrativo. Os outros meses entram com a escala publicada. */
export function meteorologistaNoExpediente(name?: string | null, login?: string | null, now = Date.now()) {
  const member = memberForOperator(name, login);
  if (member?.login !== "karol") return false;
  const { year, month } = anoMesManaus(now);
  return year === 2026 && month === 10;
}

export function roleLabelForOperator(name?: string | null, login?: string | null, now = Date.now()) {
  const member = memberForOperator(name, login);
  if (!member) return ROLE_LABELS.operacional;
  if (IDAP.has(member.login)) return "Operador IDAP";
  if (member.role === "meteorologista" && meteorologistaNoExpediente(name, login, now)) {
    return "Meteorologista · expediente";
  }
  return ROLE_LABELS[member.role];
}

export function withOperatorRole<T extends { name?: string | null; login?: string | null }>(user: T, now = Date.now()) {
  const member = memberForOperator(user.name, user.login);
  return {
    ...user,
    role: member?.role ?? ("operacional" as EquipeRole),
    roleLabel: roleLabelForOperator(user.name, user.login, now),
  };
}
