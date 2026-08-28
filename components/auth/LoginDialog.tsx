"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/Modal";
import { useOpsMode } from "@/components/shared/OpsMode";

export function LoginDialog() {
  const { loginOpen, needsSetup, closeLogin, completeLogin } = useOpsMode();
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (needsSetup && password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setBusy(true);
    try {
      const url = needsSetup ? "/api/auth/setup" : "/api/auth/login";
      const res = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          needsSetup ? { name, login, password } : { login, password },
        ),
      });
      const data = (await res.json()) as { error?: string; user?: { id: string; login: string; name: string } };
      if (!res.ok || !data.user) {
        setError(data.error ?? "Não foi possível entrar.");
        return;
      }
      setPassword("");
      setConfirm("");
      completeLogin(data.user);
    } catch {
      setError("Falha de rede. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={loginOpen}
      onClose={closeLogin}
      title={needsSetup ? "Criar o primeiro administrador" : "Entrar no modo Admin"}
      description={
        needsSetup
          ? "Ainda não há administradores. Crie usuário e senha. A senha fica hasheada no servidor e a sessão usa cookie HTTP-only."
          : "Somente administradores autenticados alteram cotas, status e alertas."
      }
    >
      <form className="grid gap-3" onSubmit={(e) => void submit(e)}>
        {needsSetup ? (
          <label className="grid gap-1 text-xs font-semibold">
            Nome
            <Input
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Igor Silva"
              required
              minLength={2}
              autoFocus
            />
          </label>
        ) : null}
        <label className="grid gap-1 text-xs font-semibold">
          Usuário
          <Input
            autoComplete="username"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            placeholder="ex.: igor"
            required
            minLength={3}
            autoFocus={!needsSetup}
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold">
          Senha
          <Input
            type="password"
            autoComplete={needsSetup ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={needsSetup ? 10 : 1}
          />
        </label>
        {needsSetup ? (
          <label className="grid gap-1 text-xs font-semibold">
            Confirmar senha
            <Input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={10}
            />
          </label>
        ) : null}
        {needsSetup ? (
          <p className="text-[11px] text-text-mute">
            Mínimo 10 caracteres, com letras e números. Guarde esta senha — ela não pode ser recuperada.
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="rounded-lg border border-risco-severo/40 bg-risco-severo/10 px-3 py-2 text-xs">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={busy}>
          {busy ? "Aguarde…" : needsSetup ? "Criar e entrar" : "Entrar"}
        </Button>
      </form>
    </Modal>
  );
}
