import { clearOverrides } from "@/lib/overrides";
import { clearStains } from "@/lib/stains";
import { clearHydroOverrides } from "@/lib/hydro-overrides";

/** One-shot abertura do quadro operacional. Bump the epoch to wipe again. */
export const OPS_BOARD_EPOCH = "2026-08-31-abertura";

export const OPS_OVERRIDE_V1 = "cemoa_admin_overrides_v1";
export const OPS_OVERRIDE_V2 = "cemoa_admin_overrides_v2";
export const OPS_STAINS = "cemoa_alert_stains_v1";
export const OPS_HYDRO = "cemoa_hydro_overrides_v1";

const EPOCH_KEY = "cemoa_ops_board_epoch";

function remoteWipedKey() {
  return `cemoa_ops_board_remote_${OPS_BOARD_EPOCH}`;
}

/** Clears leftover operator paints and polygon stains from this browser. */
export function ensureOpsBoardReset(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem(EPOCH_KEY) === OPS_BOARD_EPOCH) return false;
    localStorage.removeItem(OPS_OVERRIDE_V1);
    localStorage.removeItem(OPS_OVERRIDE_V2);
    localStorage.removeItem(OPS_STAINS);
    localStorage.removeItem(OPS_HYDRO);
    clearOverrides();
    clearStains();
    clearHydroOverrides();
    localStorage.setItem(EPOCH_KEY, OPS_BOARD_EPOCH);
    return true;
  } catch {
    return false;
  }
}

/**
 * Logged-in operator: wipe server classifications and stains once per epoch.
 * Does not run on anonymous GET — a cold start must not erase the day's work.
 */
export async function maybeWipeRemoteOpsBoard(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem(remoteWipedKey()) === "1") return false;
  } catch {
    /* quota / private mode */
  }

  const [overrides, stains, hydro] = await Promise.all([
    fetch("/api/alerts/overrides", { method: "DELETE", credentials: "same-origin" }),
    fetch("/api/alerts/stains", { method: "DELETE", credentials: "same-origin" }),
    fetch("/api/hydrology/overrides", { method: "DELETE", credentials: "same-origin" }),
  ]);

  if (overrides.status === 401 && stains.status === 401 && hydro.status === 401) {
    return false;
  }

  const ok = overrides.ok || stains.ok || hydro.ok;
  if (ok) {
    try {
      localStorage.setItem(remoteWipedKey(), "1");
    } catch {
      /* ignore */
    }
  }
  return ok;
}
