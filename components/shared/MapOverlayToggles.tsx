"use client";

import { MapToolButton } from "@/components/shared/MapToolButton";
import {
  showsAirSensors,
  showsPluvio,
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
  onChange: (next: TerritoryVisibility | ((prev: TerritoryVisibility) => TerritoryVisibility)) => void;
}) {
  function toggle(key: keyof TerritoryVisibility) {
    onChange((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const pluvio = showsPluvio(product);
  const air = showsAirSensors(product);

  return (
    <div className="mt-1.5 border-t border-border pt-1.5">
      <p className="px-2 py-1 text-[10px] font-bold tracking-wide text-text-mute uppercase">
        Camadas
      </p>
      <MapToolButton active={vis.sedes} onClick={() => toggle("sedes")}>
        {vis.sedes ? "Ocultar sedes" : "Sedes municipais"}
      </MapToolButton>
      {pluvio ? (
        <MapToolButton active={vis.pluvio} onClick={() => toggle("pluvio")}>
          {vis.pluvio ? "Ocultar pluviômetros" : "Pluviômetros CEMADEN"}
        </MapToolButton>
      ) : null}
      {air ? (
        <MapToolButton active={vis.pluvio} onClick={() => toggle("pluvio")}>
          {vis.pluvio ? "Ocultar sensores PurpleAir" : "Sensores PurpleAir · SELVA"}
        </MapToolButton>
      ) : null}
      <MapToolButton active={vis.rurais} onClick={() => toggle("rurais")}>
        {vis.rurais ? "Ocultar comunidades rurais" : "Comunidades rurais"}
      </MapToolButton>
      <MapToolButton active={vis.indigenas} onClick={() => toggle("indigenas")}>
        {vis.indigenas ? "Ocultar comunidades indígenas" : "Comunidades indígenas"}
      </MapToolButton>
    </div>
  );
}
