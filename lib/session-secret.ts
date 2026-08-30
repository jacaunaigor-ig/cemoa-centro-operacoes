export class SessionConfigError extends Error {
  constructor(message = "CEMOA_SESSION_SECRET ausente ou muito curta (mínimo 16 caracteres).") {
    super(message);
    this.name = "SessionConfigError";
  }
}

export function sessionSecret(): string {
  const env = process.env.CEMOA_SESSION_SECRET?.trim();
  if (env && env.length >= 16) return env;
  // Produção no Vercel costuma ter só as chaves do Supabase. Assina a sessão
  // com um trecho estável da service role (já secreta) para o Admin não cair
  // em 500 vazio quando CEMOA_SESSION_SECRET ainda não foi definida.
  const derived =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    "";
  if (derived.length >= 16) return `cemoa-derived:${derived.slice(0, 80)}`;
  if (process.env.NODE_ENV !== "production") {
    return "cemoa-dev-session-secret-change-me";
  }
  throw new SessionConfigError();
}
