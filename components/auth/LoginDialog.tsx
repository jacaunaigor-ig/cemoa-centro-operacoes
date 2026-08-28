"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/Modal";
import { useOpsMode } from "@/components/shared/OpsMode";

function field(form: FormData, ...keys: string[]): string {
  for (const key of keys) {
    const value = form.get(key);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function LoginDialog() {
  const {
    loginOpen,
    needsSetup,
    googleEnabled,
    allowReset,
    authError,
    closeLogin,
    completeLogin,
  } = useOpsMode();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [forceCreate, setForceCreate] = useState(false);
  const [resetLocal, setResetLocal] = useState(false);
  const creating = needsSetup || forceCreate || resetLocal;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const name = field(form, "name");
    const login = field(form, "username", "login", "usuario");
    const password = String(form.get("password") ?? form.get("senha") ?? "");
    const confirm = String(form.get("confirm") ?? "");

    if (!login || !password) {
      setError("Informe usuário e senha.");
      return;
    }
    if (creating && confirm && password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth/enter", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          login,
          password,
          reset: resetLocal || undefined,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        user?: { id: string; login: string; name: string; email?: string | null };
      };
      if (!res.ok || !data.user) {
        setError(data.error ?? "Não foi possível entrar.");
        return;
      }
      setForceCreate(false);
      setResetLocal(false);
      completeLogin(data.user);
    } catch {
      setError("Falha de rede. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  function handleClose() {
    setError(null);
    setForceCreate(false);
    setResetLocal(false);
    closeLogin();
  }

  return (
    <Modal
      open={loginOpen}
      onClose={handleClose}
      title={
        resetLocal
          ? "Redefinir administrador local"
          : creating
            ? "Criar administrador e entrar"
            : "Entrar no modo Admin"
      }
      description={
        resetLocal
          ? "Apaga o administrador gravado neste computador e cria o seu. Use a mesma senha no próximo login."
          : creating
            ? "Cadastre o usuário e a senha que você vai usar daqui pra frente. Mínimo 10 caracteres, com letras e números."
            : "Use o usuário e a senha que você cadastrou neste computador."
      }
    >
      <form
        key={`${loginOpen}-${creating}-${resetLocal}`}
        className="grid gap-3"
        autoComplete="on"
        onSubmit={(e) => void submit(e)}
      >
        {googleEnabled ? (
          <>
            <a
              href="/api/auth/google"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 text-sm font-semibold text-neutral-900 hover:bg-neutral-100"
            >
              <GoogleMark />
              Continuar com Gmail
            </a>
            <div className="flex items-center gap-2 text-[10px] font-bold tracking-wide text-text-mute uppercase">
              <span className="h-px flex-1 bg-border" />
              ou
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        ) : null}
        {creating ? (
          <label className="grid gap-1 text-xs font-semibold">
            Nome
            <Input
              name="name"
              autoComplete="name"
              placeholder="Ex.: Igor Silva"
              minLength={2}
              autoFocus
            />
          </label>
        ) : null}
        <label className="grid gap-1 text-xs font-semibold">
          Usuário
          <Input
            name="username"
            autoComplete="username"
            placeholder="ex.: igor"
            required
            minLength={3}
            autoFocus={!creating}
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold">
          Senha
          <Input
            name="password"
            type="password"
            autoComplete={creating ? "new-password" : "current-password"}
            required
            minLength={creating ? 10 : 1}
          />
        </label>
        {creating ? (
          <label className="grid gap-1 text-xs font-semibold">
            Confirmar senha
            <Input
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={10}
            />
          </label>
        ) : null}
        {creating && !resetLocal ? (
          <p className="text-[11px] text-text-mute">
            Esta senha é a que você vai usar no próximo login. Ela não fica visível depois de
            gravada.
          </p>
        ) : null}
        {!creating && allowReset ? (
          <button
            type="button"
            className="text-left text-[11px] font-semibold text-focus hover:underline"
            onClick={() => {
              setResetLocal(true);
              setForceCreate(false);
              setError(null);
            }}
          >
            Primeiro acesso neste computador? Redefinir acesso local
          </button>
        ) : null}
        {error || authError ? (
          <p
            role="alert"
            className="rounded-lg border border-risco-severo/40 bg-risco-severo/10 px-3 py-2 text-xs"
          >
            {error ?? authError}
          </p>
        ) : null}
        <Button type="submit" disabled={busy}>
          {busy ? "Aguarde…" : resetLocal ? "Redefinir e entrar" : creating ? "Criar e entrar" : "Entrar"}
        </Button>
      </form>
    </Modal>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5c-.3 1.5-1.2 2.8-2.5 3.7v3h4c2.4-2.2 3.5-5.4 3.5-8.8z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 5.9-1 7.9-2.9l-4-3c-1.1.7-2.5 1.2-3.9 1.2-3 0-5.6-2-6.5-4.7H1.4v3.1C3.4 21.5 7.4 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.5 14.6c-.2-.7-.4-1.4-.4-2.1s.1-1.4.4-2.1V7.3H1.4C.5 9 0 10.9 0 12.5s.5 3.5 1.4 5.2l4.1-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.8c1.7 0 3.3.6 4.5 1.7l3.4-3.4C17.9 1.1 15.2 0 12 0 7.4 0 3.4 2.5 1.4 7.3l4.1 3.1C6.4 6.8 9 4.8 12 4.8z"
      />
    </svg>
  );
}
