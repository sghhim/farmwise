import { useEffect, useRef } from "react"
import bbox from "@turf/bbox"
import type { Polygon } from "geojson"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { buildSatelliteStyle, MAP_MAX_ZOOM } from "@/lib/map-styles"
import { cn } from "@/lib/utils"

type Props = {
  polygon: Polygon
  className?: string
}

/**
 * Read-only satellite preview for dashboard cards: same Esri imagery as the draw UI,
 * with a semi-transparent parcel fill and stroke so the boundary reads on terrain.
 */
export function FieldCardMap({ polygon, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const el = containerRef.current
    let cancelled = false

    const map = new maplibregl.Map({
      container: el,
      style: buildSatelliteStyle(),
      interactive: false,
      attributionControl: false,
      maxZoom: MAP_MAX_ZOOM,
    })

    function mountParcelLayers() {
      if (cancelled || map.getSource("parcel")) return

      map.addSource("parcel", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: polygon,
        },
      })
      map.addLayer({
        id: "parcel-fill",
        type: "fill",
        source: "parcel",
        paint: {
          "fill-color": "#22c55e",
          "fill-outline-color": "#15803d",
          "fill-opacity": 0.35,
        },
      })
      map.addLayer({
        id: "parcel-line",
        type: "line",
        source: "parcel",
        paint: {
          "line-color": "#15803d",
          "line-width": 3,
          "line-opacity": 1,
        },
      })

      const b = bbox({
        type: "Feature",
        properties: {},
        geometry: polygon,
      })
      map.fitBounds(
        [
          [b[0], b[1]],
          [b[2], b[3]],
        ],
        { padding: 16, duration: 0, maxZoom: 16 }
      )
    }

    function syncCanvasSize() {
      if (cancelled) return
      map.resize()
      requestAnimationFrame(() => {
        if (!cancelled) map.resize()
      })
    }

    function initMap() {
      if (cancelled) return
      mountParcelLayers()
      syncCanvasSize()
      map.once("idle", syncCanvasSize)
    }

    if (map.isStyleLoaded()) {
      queueMicrotask(initMap)
    } else {
      map.once("load", initMap)
    }

    const ro = new ResizeObserver(syncCanvasSize)
    ro.observe(el)

    return () => {
      cancelled = true
      ro.disconnect()
      map.remove()
    }
  }, [polygon])

  return (
    <div
      className={cn(
        "field-card-map pointer-events-none relative isolate overflow-hidden bg-zinc-950",
        "[&_.maplibregl-ctrl-attrib]:hidden [&_.maplibregl-ctrl-logo]:hidden [&_.maplibregl-ctrl]:hidden",
        className
      )}
    >
      <div ref={containerRef} className="absolute inset-0 h-full w-full" aria-hidden />
      <p className="absolute bottom-1 left-1.5 z-[1] max-w-[90%] truncate text-[9px] font-medium text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
        Imagery © Esri
      </p>
    </div>
  )
}
