"use client";

import { MapToolButton } from "@/components/shared/MapToolButton";
import {
  showsPluvio,
  showsRisco,
  type OverlayProduct,
  type TerritoryVisibility,
} from "@/lib/map-overlays";

export function MapOverlayToggles({
  vis,
  product,
  onChange,
}: {
  vis: TerritoryVisibility;
  product: OverlayProduct;
  onChange: (next: TerritoryVisibility) => void;
}) {
  function toggle(key: keyof TerritoryVisibility) {
    onChange({ ...vis, [key]: !vis[key] });
  }

  const pluvio = showsPluvio(product);
  const risco = showsRisco(product);

  return (
    <div className="mt-1.5 border-t border-border pt-1.5">
      <p className="px-2 py-1 text-[10px] font-bold tracking-wide text-text-mute uppercase">
        Camadas
      </p>
      <MapToolButton active={vis.sedes} onClick={() => toggle("sedes")}>
        {vis.sedes ? "Sedes municipais" : "Sedes municipais (ocultas)"}
      </MapToolButton>
      {pluvio ? (
        <MapToolButton active={vis.pluvio} onClick={() => toggle("pluvio")}>
          {vis.pluvio ? "Pluviômetros CEMADEN" : "Pluviômetros CEMADEN"}
        </MapToolButton>
      ) : null}
      <MapToolButton active={vis.rurais} onClick={() => toggle("rurais")}>
        Comunidades rurais
      </MapToolButton>
      <MapToolButton active={vis.indigenas} onClick={() => toggle("indigenas")}>
        Comunidades indígenas
      </MapToolButton>
      {risco ? (
        <MapToolButton active={vis.risco} onClick={() => toggle("risco")}>
          Áreas de risco mapeadas
        </MapToolButton>
      ) : null}
    </div>
  );
}
