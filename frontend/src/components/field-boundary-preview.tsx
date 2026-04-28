import { useEffect, useRef } from "react"
import bbox from "@turf/bbox"
import type { MultiPolygon, Polygon } from "geojson"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { buildSatelliteStyle, MAP_MAX_ZOOM } from "@/lib/map-styles"
import { cn } from "@/lib/utils"

type Props = {
  geometry: Polygon | MultiPolygon
  className?: string
  /** Applied to the inner map canvas wrapper (e.g. height). */
  mapClassName?: string
}

/** Read-only satellite map with polygon or multipolygon overlay. */
export function FieldBoundaryPreview({
  geometry,
  className,
  mapClassName,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let cancelled = false

    const map = new maplibregl.Map({
      container,
      style: buildSatelliteStyle(),
      maxZoom: MAP_MAX_ZOOM,
    })

    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: false }),
      "top-right"
    )

    function mountBoundaryLayers() {
      if (cancelled || map.getSource("boundary")) return

      map.addSource("boundary", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry,
        },
      })
      map.addLayer({
        id: "boundary-fill",
        type: "fill",
        source: "boundary",
        paint: {
          "fill-color": "#22c55e",
          "fill-outline-color": "#15803d",
          "fill-opacity": 0.38,
        },
      })
      map.addLayer({
        id: "boundary-line",
        type: "line",
        source: "boundary",
        paint: {
          "line-color": "#15803d",
          "line-width": 3,
          "line-opacity": 1,
        },
      })

      const b = bbox({
        type: "Feature",
        properties: {},
        geometry,
      })
      map.fitBounds(
        [
          [b[0], b[1]],
          [b[2], b[3]],
        ],
        { padding: 48, duration: 0, maxZoom: 17 }
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
      mountBoundaryLayers()
      syncCanvasSize()
      map.once("idle", syncCanvasSize)
    }

    if (map.isStyleLoaded()) {
      queueMicrotask(initMap)
    } else {
      map.once("load", initMap)
    }

    const ro = new ResizeObserver(syncCanvasSize)
    ro.observe(container)

    return () => {
      cancelled = true
      ro.disconnect()
      map.remove()
    }
  }, [geometry])

  return (
    <div className={cn("overflow-hidden rounded-xl border", className)}>
      <div
        ref={containerRef}
        className={cn(
          "h-[min(320px,45vh)] w-full min-h-[200px]",
          mapClassName
        )}
      />
    </div>
  )
}
