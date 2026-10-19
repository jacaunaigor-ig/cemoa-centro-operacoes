/** Estação fora da malha municipal, mas é o monitor do município. */
const ANCORAS = [{ nome: "SEMA_DCAM_44", municipioId: "1303007" }];

export function ancoraMunicipal(name: string): { municipioId: string } | null {
  const n = name.toUpperCase().replace(/[\s-]+/g, "_");
  return ANCORAS.find((item) => n.includes(item.nome)) ?? null;
}
