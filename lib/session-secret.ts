export class SessionConfigError extends Error {
  constructor(message = "CEMOA_SESSION_SECRET ausente ou muito curta (mínimo 16 caracteres).") {
    super(message);
    this.name = "SessionConfigError";
  }
}

export function sessionSecret(): string {
  const env = process.env.CEMOA_SESSION_SECRET?.trim();
  if (env && env.length >= 16) return env;
  if (process.env.NODE_ENV !== "production") {
    return "cemoa-dev-session-secret-change-me";
  }
  throw new SessionConfigError();
}
