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

export function roleLabelForOperator(name?: string | null, login?: string | null) {
  const member = memberForOperator(name, login);
  return member ? ROLE_LABELS[member.role] : ROLE_LABELS.operacional;
}

export function withOperatorRole<T extends { name?: string | null; login?: string | null }>(user: T) {
  const member = memberForOperator(user.name, user.login);
  return {
    ...user,
    role: member?.role ?? ("operacional" as EquipeRole),
    roleLabel: member ? ROLE_LABELS[member.role] : ROLE_LABELS.operacional,
  };
}
