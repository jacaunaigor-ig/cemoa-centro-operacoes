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
  const [forceCreate, setForceCreate] = useState(false);
  const creating = needsSetup || forceCreate;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
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
        body: JSON.stringify({ name, login, password }),
      });
      const data = (await res.json()) as {
        error?: string;
        user?: { id: string; login: string; name: string };
      };
      if (!res.ok || !data.user) {
        setError(data.error ?? "Não foi possível entrar.");
        return;
      }
      setPassword("");
      setConfirm("");
      setForceCreate(false);
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
    closeLogin();
  }

  return (
    <Modal
      open={loginOpen}
      onClose={handleClose}
      title={creating ? "Criar administrador e entrar" : "Entrar no modo Admin"}
      description={
        creating
          ? "Escolha um usuário e uma senha. Depois use os mesmos dados para entrar."
          : "Use o usuário e a senha que você cadastrou."
      }
    >
      <form className="grid gap-3" onSubmit={(e) => void submit(e)}>
        {creating ? (
          <label className="grid gap-1 text-xs font-semibold">
            Nome
            <Input
              name="name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
            value={login}
            onChange={(e) => setLogin(e.target.value)}
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              minLength={10}
            />
          </label>
        ) : null}
        {creating ? (
          <p className="text-[11px] text-text-mute">
            Mínimo 10 caracteres, com letras e números. Esta senha é a que você vai usar no próximo login.
          </p>
        ) : needsSetup ? (
          <button
            type="button"
            className="text-left text-[11px] font-semibold text-focus hover:underline"
            onClick={() => {
              setForceCreate(true);
              setError(null);
            }}
          >
            Primeiro acesso? Criar usuário e senha
          </button>
        ) : null}
        {error ? (
          <p role="alert" className="rounded-lg border border-risco-severo/40 bg-risco-severo/10 px-3 py-2 text-xs">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={busy}>
          {busy ? "Aguarde…" : creating ? "Criar e entrar" : "Entrar"}
        </Button>
      </form>
    </Modal>
  );
}
