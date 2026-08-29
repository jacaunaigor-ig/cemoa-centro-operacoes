"use client";

import { MapToolButton } from "@/components/shared/MapToolButton";
import type { TerritoryVisibility } from "@/lib/map-overlays";

export function MapOverlayToggles({
  vis,
  onChange,
}: {
  vis: TerritoryVisibility;
  onChange: (next: TerritoryVisibility) => void;
}) {
  function toggle(key: keyof TerritoryVisibility) {
    onChange({ ...vis, [key]: !vis[key] });
  }

  return (
    <div className="mt-1.5 border-t border-border pt-1.5">
      <p className="px-2 py-1 text-[10px] font-bold tracking-wide text-text-mute uppercase">
        Apoio ao alerta
      </p>
      <MapToolButton active={vis.sedes} onClick={() => toggle("sedes")}>
        {vis.sedes ? "Sedes municipais" : "Sedes municipais (ocultas)"}
      </MapToolButton>
      <MapToolButton active={vis.pluvio} onClick={() => toggle("pluvio")}>
        {vis.pluvio ? "Pluviômetros CEMADEN" : "Pluviômetros (ocultos)"}
      </MapToolButton>
      <MapToolButton active={vis.rurais} onClick={() => toggle("rurais")}>
        {vis.rurais ? "Comunidades rurais" : "Comunidades rurais (ocultas)"}
      </MapToolButton>
      <MapToolButton active={vis.indigenas} onClick={() => toggle("indigenas")}>
        {vis.indigenas ? "Comunidades indígenas" : "Comunidades indígenas (ocultas)"}
      </MapToolButton>
      <MapToolButton active={vis.risco} onClick={() => toggle("risco")}>
        {vis.risco ? "Áreas de risco mapeadas" : "Áreas de risco (ocultas)"}
      </MapToolButton>
    </div>
  );
}
