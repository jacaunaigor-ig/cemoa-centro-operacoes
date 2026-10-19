/** Monitores com leitura inválida. Não entram no grau, no mapa nem no aviso. */
const DESCONSIDERADOS = ["MPAM_BCA_01_PROMOTORIA"];

export function sensorDesconsiderado(name: string) {
  const n = name.toUpperCase().replace(/[\s-]+/g, "_");
  return DESCONSIDERADOS.some((id) => n.includes(id));
}
