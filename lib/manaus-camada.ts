import type { LayerGroup, Map as LeafletMap } from "leaflet";
import {
  anelParaMapa,
  curvasDaGrade,
  FONTE_CURVAS_MANAUS,
  loadBairrosManaus,
  loadGradeManaus,
  type BairroManaus,
} from "@/lib/manaus-chuva";
import {
  corZonaAdministrativa,
  loadViasEscoamento,
  loadZonasManaus,
  type ViaEscoamento,
  type ZonaAdministrativa,
} from "@/lib/manaus-zonas";

type LeafletNS = typeof import("leaflet");

function corCurva(cota: number) {
  const t = Math.max(0, Math.min(1, (cota - 20) / 80));
  const r = Math.round(14 + t * 166);
  const g = Math.round(116 + (83 - 116) * t);
  const b = Math.round(144 + (9 - 144) * t);
  return `rgb(${r},${g},${b})`;
}

export async function desenharApoioManaus(
  L: LeafletNS,
  map: LeafletMap,
  grupo: LayerGroup,
  pedido: {
    bairros: boolean;
    curvas: boolean;
    zonas?: boolean;
    escoamento?: boolean;
    destaque?: string | null;
    destaqueZona?: string | null;
    destaqueVia?: string | null;
    onBairro?: (bairro: BairroManaus) => void;
    onZona?: (zona: ZonaAdministrativa) => void;
    onVia?: (via: ViaEscoamento) => void;
  },
  cancelado: () => boolean,
) {
  grupo.clearLayers();
  if (!pedido.bairros && !pedido.curvas && !pedido.zonas && !pedido.escoamento) return;
  if (!map.getPane("manausPane")) {
    const pane = map.createPane("manausPane");
    pane.style.zIndex = "560";
    pane.style.pointerEvents = "auto";
  }
  const renderer = L.canvas({ padding: 0.2 });
  let oeste = Infinity;
  let leste = -Infinity;
  let sul = Infinity;
  let norte = -Infinity;
  const marca = (lat: number, lon: number) => {
    sul = Math.min(sul, lat);
    norte = Math.max(norte, lat);
    oeste = Math.min(oeste, lon);
    leste = Math.max(leste, lon);
  };

  if (pedido.curvas) {
    const grade = await loadGradeManaus();
    if (cancelado()) return;
    for (const curva of curvasDaGrade(grade)) {
      const peso = curva.cota % 20 === 0 ? 1.7 : 1;
      for (const [lat, lon] of curva.pontos) marca(lat, lon);
      L.polyline(curva.pontos, {
        pane: "manausPane",
        renderer,
        color: corCurva(curva.cota),
        weight: peso,
        opacity: 0.85,
        interactive: true,
      })
        .bindTooltip(`${curva.cota} m<br/>${FONTE_CURVAS_MANAUS}`, {
          sticky: true,
          className: "map-point-tip",
        })
        .addTo(grupo);
    }
  }

  if (pedido.bairros) {
    const bairros = await loadBairrosManaus();
    if (cancelado()) return;
    for (const bairro of bairros) {
      const hab =
        bairro.populacao == null
          ? "população sem dado"
          : `${bairro.populacao.toLocaleString("pt-BR")} habitantes`;
      const anel = anelParaMapa(bairro.geometry.coordinates[0]);
      for (const [lat, lon] of anel) marca(lat, lon);
      const ativo = pedido.destaque === `${bairro.zona}|${bairro.nome}`;
      const poly = L.polygon(anel, {
        pane: "manausPane",
        renderer,
        smoothFactor: 2,
        color: ativo ? "#111827" : "#1e293b",
        weight: ativo ? 2.4 : 1.1,
        fillColor: ativo ? "#fdba74" : "#94a3b8",
        fillOpacity: ativo ? 0.4 : 0.14,
      });
      poly.on("click", (event) => {
        L.DomEvent.stop(event);
        pedido.onBairro?.(bairro);
      });
      poly
        .bindTooltip(
          `<strong>${bairro.nome}</strong><br/>${bairro.zona || "Manaus"} · cota mín. ${bairro.elevMin ?? "s/d"} m<br/>${hab}`,
          { direction: "top", className: "map-point-tip" },
        )
        .addTo(grupo);
    }
  }

  if (pedido.zonas) {
    if (!map.getPane("zonasAdmPane")) {
      const pane = map.createPane("zonasAdmPane");
      pane.style.zIndex = "545";
      pane.style.pointerEvents = "auto";
    }
    const zonas = await loadZonasManaus();
    if (cancelado()) return;
    for (const zona of zonas) {
      const anel = (zona.geometry.coordinates[0] ?? []).map(
        ([lon, lat]) => [lat, lon] as [number, number],
      );
      for (const [lat, lon] of anel) marca(lat, lon);
      const ativa = pedido.destaqueZona === zona.nome;
      const poly = L.polygon(anel, {
        pane: "zonasAdmPane",
        color: corZonaAdministrativa(zona.nome),
        weight: ativa ? 3.4 : 2,
        fillColor: corZonaAdministrativa(zona.nome),
        fillOpacity: ativa ? 0.28 : 0.12,
      });
      poly.on("click", (event) => {
        L.DomEvent.stop(event);
        pedido.onZona?.(zona);
      });
      poly
        .bindTooltip(`<strong>Zona ${zona.nome}</strong><br/>Clique para a ficha da região`, {
          direction: "top",
          className: "map-point-tip",
        })
        .addTo(grupo);
    }
  }

  if (pedido.escoamento) {
    if (!map.getPane("viasPane")) {
      const pane = map.createPane("viasPane");
      pane.style.zIndex = "575";
      pane.style.pointerEvents = "auto";
    }
    const vias = await loadViasEscoamento();
    if (cancelado()) return;
    for (const via of vias) {
      const ativa = pedido.destaqueVia === via.id;
      for (const trecho of via.geometry.coordinates) {
        const linha = trecho.map(([lon, lat]) => [lat, lon] as [number, number]);
        for (const [lat, lon] of linha) marca(lat, lon);
        const path = L.polyline(linha, {
          pane: "viasPane",
          color: ativa ? "#0c4a6e" : "#0369a1",
          weight: ativa ? 5 : 3.2,
          opacity: 0.95,
        });
        path.on("click", (event) => {
          L.DomEvent.stop(event);
          pedido.onVia?.(via);
        });
        path
          .bindTooltip(`<strong>${via.nome}</strong><br/>${via.fonte}`, {
            direction: "top",
            className: "map-point-tip",
          })
          .addTo(grupo);
      }
    }
  }

  if (!Number.isFinite(sul)) return;
  const limites = L.latLngBounds([sul, oeste], [norte, leste]);
  const enquadrarMapa = () => {
    if (cancelado() || map.getZoom() >= 10) return;
    map.fitBounds(limites, { padding: [28, 28], maxZoom: 12, animate: false });
  };
  enquadrarMapa();
  window.setTimeout(enquadrarMapa, 1100);
}
