import { useEffect, useRef } from "react"
import bbox from "@turf/bbox"
import type { Feature, Polygon } from "geojson"
import maplibregl from "maplibre-gl"
import MapboxDraw from "maplibre-gl-draw"
import "maplibre-gl/dist/maplibre-gl.css"
import "maplibre-gl-draw/dist/mapbox-gl-draw.css"
import {
  buildSatelliteStyle,
  DEFAULT_MAP_CENTER,
  DEFAULT_MAP_ZOOM,
  MAP_MAX_ZOOM,
} from "@/lib/map-styles"
import { cn } from "@/lib/utils"

/** Layer spec from maplibre-gl-draw after cold/hot sources are applied. */
type DrawStyleLayer = Record<string, unknown> & { id: string }

/**
 * Default draw styles are duplicated as *.cold / *.hot with sources set.
 * Recover the pre-expand base list (matches SRStyle) for safe customization.
 */
function extractBaseDrawStylesFromLibraryDefaults(): DrawStyleLayer[] {
  const probe = new MapboxDraw({
    displayControlsDefault: false,
    controls: { polygon: true, trash: true },
    defaultMode: "simple_select",
  })
  const processed = probe.options.styles as DrawStyleLayer[]
  const coldLayers = processed.filter((l) => l.id.endsWith(".cold"))
  return coldLayers.map((layer) => {
    const { source: _src, ...rest } = layer
    const id = layer.id.replace(/\.cold$/, "")
    return { ...rest, id }
  })
}

/**
 * MapLibre GL ≥5 + bundled draw theme fixes:
 * - Remove numeric `line-dasharray` tuples (invalid / breaks stroke layers).
 * - Drop `icon-opacity-transition` in paint (invalid on symbol layers in ML5).
 * - Slightly stronger fill + stroke so polygons read on satellite tiles.
 */
function sanitizeDrawStylesForMapLibre(styles: DrawStyleLayer[]): DrawStyleLayer[] {
  return styles.map((layer) => {
    const next = structuredClone(layer) as DrawStyleLayer
    const paint = next.paint as Record<string, unknown> | undefined
    if (paint) {
      const da = paint["line-dasharray"]
      if (Array.isArray(da) && typeof da[0] === "number") {
        delete paint["line-dasharray"]
      }
      delete paint["icon-opacity-transition"]

      const id = next.id
      if (
        id.includes("polygon-fill") &&
        !id.includes("overlay") &&
        !id.includes("static") &&
        typeof paint["fill-opacity"] === "number"
      ) {
        paint["fill-opacity"] = Math.min(
          0.48,
          Number(paint["fill-opacity"]) + 0.24
        )
      }
      if (
        id === "gl-draw-polygon-stroke-inactive" &&
        typeof paint["line-width"] === "number"
      ) {
        paint["line-width"] = 3
      }
    }
    return next
  })
}

/** Built once: same controls as FieldMapDraw — avoids per-mount probe allocation. */
let cachedDrawStyles: DrawStyleLayer[] | undefined
function getFieldMapDrawStyles(): DrawStyleLayer[] | undefined {
  if (cachedDrawStyles) return cachedDrawStyles
  try {
    cachedDrawStyles = sanitizeDrawStylesForMapLibre(
      extractBaseDrawStylesFromLibraryDefaults()
    )
  } catch {
    cachedDrawStyles = undefined
  }
  return cachedDrawStyles
}

type Props = {
  className?: string
  /** Called when the drawn polygon changes (single polygon). */
  onBoundaryChange: (boundary: Polygon | null) => void
  /** Load an existing polygon when the map first loads. */
  initialPolygon?: Polygon | null
  /** Override footer helper text (default: farmer parcel copy). */
  footerHint?: string
  /** Initial map zoom when the map first loads without a saved polygon. */
  initialZoom?: number
  /** Max zoom when framing initialPolygon with fitBounds. */
  fitPolygonMaxZoom?: number
}

export function FieldMapDraw({
  className,
  onBoundaryChange,
  initialPolygon,
  footerHint,
  initialZoom = DEFAULT_MAP_ZOOM,
  fitPolygonMaxZoom = MAP_MAX_ZOOM,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onBoundaryChangeRef = useRef(onBoundaryChange)
  const initialRef = useRef(initialPolygon)
  onBoundaryChangeRef.current = onBoundaryChange
  initialRef.current = initialPolygon

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const map = new maplibregl.Map({
      container,
      style: buildSatelliteStyle(),
      center: DEFAULT_MAP_CENTER,
      zoom: initialZoom,
      maxZoom: MAP_MAX_ZOOM,
    })

    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: false }),
      "top-right"
    )
    map.addControl(
      new maplibregl.ScaleControl({ maxWidth: 100 }),
      "bottom-left"
    )

    const drawStyles = getFieldMapDrawStyles()
    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true,
      },
      defaultMode: "simple_select",
      ...(drawStyles ? { styles: drawStyles } : {}),
    })
    map.addControl(draw as unknown as maplibregl.IControl, "top-left")

    function emitFromDraw() {
      const fc = draw.getAll()
      const polys = fc.features.filter(
        (f): f is Feature<Polygon> => f.geometry.type === "Polygon"
      )
      if (polys.length === 0) {
        onBoundaryChangeRef.current(null)
        return
      }
      const g = polys[polys.length - 1].geometry
      onBoundaryChangeRef.current(g)
    }

    function keepSinglePolygon() {
      let polys = draw
        .getAll()
        .features.filter(
          (f): f is Feature<Polygon> => f.geometry.type === "Polygon"
        )
      while (polys.length > 1) {
        const rm = polys[0]
        if (rm.id != null) draw.delete(String(rm.id))
        polys = draw
          .getAll()
          .features.filter(
            (f): f is Feature<Polygon> => f.geometry.type === "Polygon"
          )
      }
    }

    map.on("draw.create", () => {
      keepSinglePolygon()
      emitFromDraw()
    })
    map.on("draw.update", emitFromDraw)
    map.on("draw.delete", emitFromDraw)

    map.once("load", () => {
      map.resize()
      requestAnimationFrame(() => map.resize())

      const init = initialRef.current
      if (init?.coordinates?.length) {
        draw.add({
          type: "Feature",
          properties: {},
          geometry: init,
        })
        const b = bbox({
          type: "Feature",
          properties: {},
          geometry: init,
        })
        map.fitBounds(
          [
            [b[0], b[1]],
            [b[2], b[3]],
          ],
          { padding: 48, duration: 0, maxZoom: fitPolygonMaxZoom }
        )
        emitFromDraw()
      }
    })

    const resizeObserver = new ResizeObserver(() => {
      map.resize()
    })
    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      map.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map mounts once per dialog open
  }, [])

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-muted",
        className
      )}
    >
      <div
        ref={containerRef}
        className="h-[min(420px,55vh)] min-h-[280px] w-full"
      />
      <p className="border-t bg-card/90 px-3 py-2 text-[11px] text-muted-foreground">
        {footerHint ??
          "Use the polygon tool (top-left on the map), then click vertices to draw. One shape at a time. Hectares update from the outline."}
      </p>
    </div>
  )
}
