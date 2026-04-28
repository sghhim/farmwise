import type { StyleSpecification } from "maplibre-gl"

/**
 * Raster satellite basemap for MapLibre.
 * - Default: Esri World Imagery (no API key; suitable for development).
 * - For Google-style satellite tiles, set `VITE_SATELLITE_TILES` to a template
 *   such as `https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}` and ensure your
 *   usage complies with Google Maps Platform terms.
 */
export function buildSatelliteStyle(): StyleSpecification {
  const tiles =
    import.meta.env.VITE_SATELLITE_TILES?.trim() ||
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"

  const attribution =
    import.meta.env.VITE_SATELLITE_ATTRIBUTION?.trim() ||
    (tiles.includes("google.com") || tiles.includes("gstatic.com")
      ? "© Google (verify ToS for your use case)"
      : "© Esri, Maxar, Earthstar Geographics")

  return {
    version: 8,
    sources: {
      satellite: {
        type: "raster",
        tiles: [tiles],
        tileSize: 256,
        attribution,
      },
    },
    layers: [
      {
        id: "satellite",
        type: "raster",
        source: "satellite",
        minzoom: 0,
        maxzoom: 22,
      },
    ],
  }
}

/** Default map center [lng, lat] when no boundary yet (India). */
export const DEFAULT_MAP_CENTER: [number, number] = [78.96, 20.59]
/** Default initial zoom for draw UIs that do not pass `initialZoom` (high detail). */
export const DEFAULT_MAP_ZOOM = 18
/** Agronomist advisory extent editor: wider regional context before zooming in to draw. */
export const AGRONOMIST_MAP_ZOOM = 11
/** Farmer field draw/edit: slightly wider default than `DEFAULT_MAP_ZOOM`. */
export const FARMER_MAP_ZOOM = DEFAULT_MAP_ZOOM - 1
/** Ceiling for interactive maps (matches raster layer maxzoom / MapLibre default cap). */
export const MAP_MAX_ZOOM = 22

/** Plain background + no raster tiles — only GeoJSON layers drawn on top. */
export function buildOutlineOnlyStyle(isDark: boolean): StyleSpecification {
  return {
    version: 8,
    sources: {},
    layers: [
      {
        id: "background",
        type: "background",
        paint: {
          "background-color": isDark ? "#0c0c0e" : "#f4f4f5",
        },
      },
    ],
  }
}
