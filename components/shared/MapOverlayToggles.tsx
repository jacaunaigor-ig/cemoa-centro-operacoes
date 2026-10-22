"use client";

import { useState } from "react";
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
  const [manausAberto, setManausAberto] = useState(false);
  const manausLigadas = [vis.bairros, vis.curvas, vis.zonas, vis.escoamento].filter(Boolean).length;

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
          {vis.pluvio ? "Ocultar sensores PurpleAir" : "Sensores PurpleAir"}
        </MapToolButton>
      ) : null}
      <MapToolButton active={vis.rurais} onClick={() => toggle("rurais")}>
        {vis.rurais ? "Ocultar comunidades rurais" : "Comunidades rurais"}
      </MapToolButton>
      <MapToolButton active={vis.indigenas} onClick={() => toggle("indigenas")}>
        {vis.indigenas ? "Ocultar comunidades indígenas" : "Comunidades indígenas"}
      </MapToolButton>
      <div className="mt-1.5 border-t border-border pt-1.5">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs font-semibold hover:bg-hover"
          aria-expanded={manausAberto}
          onClick={() => setManausAberto((aberto) => !aberto)}
        >
          <span>Manaus</span>
          <span className="text-[10px] font-bold text-text-mute">
            {manausLigadas > 0 ? `${manausLigadas} ligada${manausLigadas > 1 ? "s" : ""}` : manausAberto ? "Fechar" : "Abrir"}
          </span>
        </button>
        {manausAberto ? (
          <div className="pl-1">
            <MapToolButton active={vis.bairros} onClick={() => toggle("bairros")}>
              {vis.bairros ? "Ocultar bairros" : "Bairros"}
            </MapToolButton>
            <MapToolButton active={vis.curvas} onClick={() => toggle("curvas")}>
              {vis.curvas ? "Ocultar curvas de nível" : "Curvas de nível"}
            </MapToolButton>
            <MapToolButton active={vis.zonas} onClick={() => toggle("zonas")}>
              {vis.zonas ? "Ocultar zonas" : "Zonas"}
            </MapToolButton>
            <MapToolButton active={vis.escoamento} onClick={() => toggle("escoamento")}>
              {vis.escoamento ? "Ocultar vias com alagamento" : "Vias com alagamento"}
            </MapToolButton>
          </div>
        ) : null}
      </div>
    </div>
  );
}
