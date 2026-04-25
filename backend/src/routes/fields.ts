import * as turf from "@turf/turf";
import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../data-source";
import { AdvisoryStatus } from "../entities/CropAdvisory";
import { FarmField } from "../entities/FarmField";
import { FieldAdvisoryMatch } from "../entities/FieldAdvisoryMatch";
import { UserRole } from "../entities/User";
import { farmBoundaryToFeature } from "../geo/geojson";
import { asyncHandler } from "../utils/asyncHandler";
import { AuthedRequest, requireAuth, requireRoles } from "../middleware/auth";
import { serializeAdvisory } from "../serializers/advisorySerializer";
import {
  fieldAdvisoriesCacheKey,
  farmerFieldsListCacheKey,
  getCachedJson,
  invalidateFarmerFieldsListCache,
  setCachedJson,
} from "../cache/redis";
import {
  recomputeMatchesForField,
} from "../services/advisoryMatching";
import { fetchOpenMeteoForecast } from "../services/openMeteo";

const router = Router();

/** Map draw libs often emit [lng, lat, elev?]; store only lng/lat for GeoJSON compliance. */
const lngLatSchema = z
  .array(z.number())
  .min(2)
  .transform((c): [number, number] => [c[0]!, c[1]!]);

const polygonSchema = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(lngLatSchema).min(4)),
});

type PolygonPayload = z.infer<typeof polygonSchema>;

function polygonAreaHectares(boundary: PolygonPayload): number | null {
  const sqm = turf.area({
    type: "Feature",
    properties: {},
    geometry: boundary,
  });
  const ha = sqm / 10000;
  if (!Number.isFinite(ha) || ha <= 0) {
    return null;
  }
  return Math.round(ha * 100) / 100;
}

const createSchema = z.object({
  name: z.string().min(1).max(200),
  crop: z.string().max(120).optional(),
  soilNotes: z.string().optional(),
  locationText: z.string().optional(),
  /** Required so centroid-based weather and spatial advisory matching work from day one. */
  boundary: polygonSchema,
});

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  crop: z.string().max(120).nullable().optional(),
  soilNotes: z.string().optional(),
  locationText: z.string().optional(),
  boundary: z.union([polygonSchema, z.null()]).optional(),
});

router.use(requireAuth, requireRoles(UserRole.FARMER));

router.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const listKey = farmerFieldsListCacheKey(req.user!.sub);
    const cached = await getCachedJson<{ data: FarmField[] }>(listKey);
    if (cached) return res.json(cached);

    const repo = AppDataSource.getRepository(FarmField);
    const fields = await repo.find({
      where: { farmerId: req.user!.sub },
      order: { createdAt: "DESC" },
    });
    const payload = { data: fields };
    await setCachedJson(listKey, payload);
    return res.json(payload);
  })
);

router.post(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = createSchema.parse(req.body);
    const repo = AppDataSource.getRepository(FarmField);
    const crop =
      body.crop !== undefined && body.crop.trim() !== ""
        ? body.crop.trim()
        : null;
    const areaHa = polygonAreaHectares(body.boundary);
    if (areaHa === null) {
      return res.status(400).json({
        error: "Could not compute area from the drawn boundary.",
      });
    }
    const field = repo.create({
      farmerId: req.user!.sub,
      name: body.name,
      crop,
      areaHectares: String(areaHa),
      soilNotes: body.soilNotes ?? null,
      locationText: body.locationText ?? null,
      boundary: body.boundary,
    });
    await repo.save(field);
    await invalidateFarmerFieldsListCache(req.user!.sub);
    await recomputeMatchesForField(field.id);
    return res.status(201).json(field);
  })
);

router.get(
  "/:id/advisories",
  asyncHandler(async (req: AuthedRequest, res) => {
    const repo = AppDataSource.getRepository(FarmField);
    const field = await repo.findOne({ where: { id: req.params.id } });
    if (!field) return res.status(404).json({ error: "Not found" });
    if (field.farmerId !== req.user!.sub) {
      return res.status(403).json({ error: "Forbidden" });
    }

    type MatchRow = {
      explanation: string;
      advisory: ReturnType<typeof serializeAdvisory>;
    };
    const advKey = fieldAdvisoriesCacheKey(field.id);
    const advCached = await getCachedJson<{ data: MatchRow[] }>(advKey);
    if (advCached) return res.json(advCached);

    const matchRepo = AppDataSource.getRepository(FieldAdvisoryMatch);
    const now = new Date();
    const rows = await matchRepo.find({
      where: { fieldId: field.id },
      relations: ["advisory", "advisory.attachments", "advisory.owner"],
    });

    const active = rows
      .filter(
        (m) =>
          m.advisory.status === AdvisoryStatus.PUBLISHED &&
          m.advisory.validFrom <= now &&
          m.advisory.validTo >= now
      )
      .sort(
        (a, b) =>
          b.advisory.validFrom.getTime() - a.advisory.validFrom.getTime()
      );

    const payload: { data: MatchRow[] } = {
      data: active.map((m) => ({
        explanation: m.explanation,
        advisory: serializeAdvisory(m.advisory),
      })),
    };

    await setCachedJson(advKey, payload);
    return res.json(payload);
  })
);

router.get(
  "/:id/weather",
  asyncHandler(async (req: AuthedRequest, res) => {
    const repo = AppDataSource.getRepository(FarmField);
    const field = await repo.findOne({ where: { id: req.params.id } });
    if (!field) return res.status(404).json({ error: "Not found" });
    if (field.farmerId !== req.user!.sub) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (!field.boundary) {
      return res.status(400).json({
        error:
          "Add a map boundary to this field to load weather at its centroid.",
      });
    }

    let lon: number;
    let lat: number;
    try {
      const f = farmBoundaryToFeature(field.boundary);
      const c = turf.centroid(f);
      const coords = c.geometry.coordinates;
      lon = coords[0];
      lat = coords[1];
    } catch {
      return res.status(400).json({ error: "Invalid field boundary" });
    }

    try {
      const result = await fetchOpenMeteoForecast(lat, lon);
      return res.json({
        latitude: lat,
        longitude: lon,
        fetchedAt: result.fetchedAt,
        cacheHit: result.cacheHit,
        forecast: result.data,
        attribution: {
          providerName: "Open-Meteo",
          providerUrl: "https://open-meteo.com",
          apiDocumentationUrl: "https://open-meteo.com/en/docs",
        },
      });
    } catch {
      return res.status(502).json({
        error: "Weather data could not be loaded. Try again shortly.",
      });
    }
  })
);

router.get(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const repo = AppDataSource.getRepository(FarmField);
    const field = await repo.findOne({ where: { id: req.params.id } });
    if (!field) return res.status(404).json({ error: "Not found" });
    if (field.farmerId !== req.user!.sub) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return res.json(field);
  })
);

router.patch(
  "/:id",
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = patchSchema.parse(req.body);
    const repo = AppDataSource.getRepository(FarmField);
    const field = await repo.findOne({ where: { id: req.params.id } });
    if (!field) return res.status(404).json({ error: "Not found" });
    if (field.farmerId !== req.user!.sub) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (body.name !== undefined) field.name = body.name;
    if (body.crop !== undefined) {
      field.crop =
        body.crop === null || body.crop.trim() === "" ? null : body.crop.trim();
    }
    if (body.soilNotes !== undefined) field.soilNotes = body.soilNotes ?? null;
    if (body.locationText !== undefined) {
      field.locationText = body.locationText ?? null;
    }
    if (body.boundary !== undefined) {
      field.boundary = body.boundary ?? null;
      if (body.boundary) {
        const areaHa = polygonAreaHectares(body.boundary);
        if (areaHa === null) {
          return res.status(400).json({
            error: "Could not compute area from the drawn boundary.",
          });
        }
        field.areaHectares = String(areaHa);
      }
    }
    await repo.save(field);
    await invalidateFarmerFieldsListCache(field.farmerId);
    await recomputeMatchesForField(field.id);
    return res.json(field);
  })
);

export default router;
