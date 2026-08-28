"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/shared/Modal";
import { useOpsMode } from "@/components/shared/OpsMode";

type AdminRow = {
  id: string;
  name: string;
  login: string;
  email?: string | null;
  createdAt: string;
  source: "file" | "env";
};

export function AdminsDialog() {
  const { adminsOpen, session, googleEnabled, closeAdmins } = useOpsMode();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");

  async function load() {
    const res = await fetch("/api/auth/admins", { credentials: "same-origin" });
    const data = (await res.json()) as { admins?: AdminRow[]; me?: string; error?: string };
    if (!res.ok) {
      setError(data.error ?? "Não foi possível listar administradores.");
      return;
    }
    setError(null);
    setAdmins(data.admins ?? []);
    setMe(data.me ?? null);
  }

  useEffect(() => {
    if (!adminsOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carrega a lista ao abrir
    void load();
  }, [adminsOpen]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/admins", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, login, password, email }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Não foi possível criar o administrador.");
        return;
      }
      setName("");
      setLogin("");
      setPassword("");
      setEmail("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/admins?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Não foi possível remover.");
        return;
      }
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current, next }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Não foi possível alterar a senha.");
        return;
      }
      setCurrent("");
      setNext("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={adminsOpen}
      onClose={closeAdmins}
      wide
      title="Administradores"
      description="Quem entra aqui pode classificar alertas e atualizar cotas. Associe um Gmail para entrar sem senha."
    >
      <ul className="mb-4 space-y-2">
        {admins.length === 0 ? (
          <li className="rounded-lg border border-border bg-panel-2 px-3 py-2 text-xs text-text-mute">
            Nenhum administrador listado.
          </li>
        ) : (
          admins.map((row) => (
            <li
              key={row.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-panel-2 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">
                  {row.name}
                  {row.id === me ? (
                    <span className="ml-2 text-[10px] font-semibold text-brand-2">você</span>
                  ) : null}
                </p>
                <p className="text-[11px] text-text-mute">
                  {row.login}
                  {row.email ? ` · ${row.email}` : ""}
                  {row.source === "env" ? " · definido no ambiente" : ""}
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                disabled={busy || row.id === me || row.source === "env"}
                onClick={() => void remove(row.id)}
                aria-label={`Remover ${row.login}`}
              >
                <Trash2 />
              </Button>
            </li>
          ))
        )}
      </ul>

      <form className="grid gap-2 border-t border-border pt-3" onSubmit={(e) => void create(e)}>
        <p className="text-xs font-bold">Novo administrador</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            placeholder="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            minLength={2}
          />
          <Input
            placeholder="Usuário"
            autoComplete="off"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            minLength={3}
          />
        </div>
        <Input
          type="email"
          placeholder="Gmail (opcional — para entrar com o Google)"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          type="password"
          placeholder="Senha (opcional se informar o Gmail)"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={password ? 10 : undefined}
        />
        <Button type="submit" size="sm" disabled={busy}>
          Criar administrador
        </Button>
      </form>

      {googleEnabled && session && !session.id.startsWith("env:") ? (
        <a
          href="/api/auth/google?link=1"
          className="mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-neutral-900 hover:bg-neutral-100"
        >
          Associar meu Gmail
        </a>
      ) : null}

      {session?.id.startsWith("env:") ? null : (
        <form className="mt-3 grid gap-2 border-t border-border pt-3" onSubmit={(e) => void changePassword(e)}>
          <p className="text-xs font-bold">Alterar minha senha</p>
          <Input
            type="password"
            placeholder="Senha atual"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Nova senha"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
            minLength={10}
          />
          <Button type="submit" size="sm" variant="secondary" disabled={busy}>
            Salvar nova senha
          </Button>
        </form>
      )}

      {error ? (
        <p role="alert" className="mt-3 rounded-lg border border-risco-severo/40 bg-risco-severo/10 px-3 py-2 text-xs">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}
