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
 * Abertura one-shot. Do not call from poll or ordinary page load — a browser
 * without the epoch flag used to DELETE every classification (Moderado/Alto
 * snapped back to Baixo). Operators now drop paints only via
 * "Restaurar monitoramento".
 */
export async function maybeWipeRemoteOpsBoard(): Promise<boolean> {
  return false;
}
