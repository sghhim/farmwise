import * as turf from "@turf/turf";
import type { Feature, MultiPolygon, Polygon } from "geojson";
import { z } from "zod";

/** Vertices from map draw may include elevation; stored geometry uses lng/lat only. */
const lngLatSchema = z
  .array(z.number())
  .min(2)
  .transform((c): [number, number] => [c[0]!, c[1]!]);

const ringSchema = z.array(lngLatSchema).min(4);

function ringClosed(ring: [number, number][]): boolean {
  const a = ring[0];
  const b = ring[ring.length - 1];
  const eps = 1e-8;
  return Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps;
}

export const polygonGeomSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z
    .array(ringSchema)
    .min(1)
    .refine((rings) => rings.every(ringClosed), {
      message: "Each linear ring must be closed (first point equals last)",
    }),
});

export const multiPolygonGeomSchema = z.object({
  type: z.literal("MultiPolygon"),
  coordinates: z
    .array(z.array(ringSchema).min(1))
    .min(1)
    .refine((polys) => polys.every((rings) => rings.every(ringClosed)), {
      message: "Each linear ring must be closed (first point equals last)",
    }),
});

export const advisoryExtentSchema = z.discriminatedUnion("type", [
  polygonGeomSchema,
  multiPolygonGeomSchema,
]);

export type AdvisoryExtent = z.infer<typeof advisoryExtentSchema>;

export function extentToFeature(
  extent: AdvisoryExtent,
): Feature<Polygon | MultiPolygon> {
  if (extent.type === "Polygon") {
    return turf.polygon(extent.coordinates);
  }
  return turf.multiPolygon(extent.coordinates);
}

export function farmBoundaryToFeature(boundary: {
  type: "Polygon";
  coordinates: number[][][];
}): Feature<Polygon> {
  return turf.polygon(boundary.coordinates as [number, number][][]);
}
