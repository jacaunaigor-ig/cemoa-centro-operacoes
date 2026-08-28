export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const STATIC_DEPLOY = process.env.NEXT_PUBLIC_STATIC === "1";

/** Prefix public URLs for GitHub Pages (`/cemoa-centro-operacoes/...`). Next `Link` already does this. */
export function withBase(path: string): string {
  if (!path.startsWith("/")) return path;
  if (!BASE_PATH) return path;
  if (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`)) return path;
  return `${BASE_PATH}${path}`;
}
