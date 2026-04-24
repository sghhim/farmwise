import * as turf from "@turf/turf";
import type { Feature, Polygon } from "geojson";
import { AppDataSource } from "../data-source";
import { CropAdvisory, AdvisoryStatus } from "../entities/CropAdvisory";
import { FarmField } from "../entities/FarmField";
import { FieldAdvisoryMatch } from "../entities/FieldAdvisoryMatch";
import {
  extentToFeature,
  farmBoundaryToFeature,
  type AdvisoryExtent,
} from "../geo/geojson";
import { invalidateFieldAdvisoriesCache } from "../cache/redis";

/**
 * Matches farmer fields to published advisories using Turf booleanIntersects on
 * GeoJSON polygons stored in Postgres JSON columns (no PostGIS requirement).
 */

const DEFAULT_EXPLAIN =
  "This advisory applies because your field boundary intersects its published map area.";

function safeIntersects(a: Feature, b: Feature): boolean {
  try {
    return turf.booleanIntersects(a, b);
  } catch {
    return false;
  }
}

/** Rebuild intersection rows for one field (boundary save or clear). */
export async function recomputeMatchesForField(fieldId: string): Promise<void> {
  const matchRepo = AppDataSource.getRepository(FieldAdvisoryMatch);
  const fieldRepo = AppDataSource.getRepository(FarmField);
  const advRepo = AppDataSource.getRepository(CropAdvisory);

  await matchRepo.delete({ fieldId });

  const field = await fieldRepo.findOne({ where: { id: fieldId } });
  if (!field?.boundary) {
    await invalidateFieldAdvisoriesCache(fieldId);
    return;
  }

  let boundaryFeat: Feature<Polygon>;
  try {
    boundaryFeat = farmBoundaryToFeature(field.boundary);
  } catch {
    await invalidateFieldAdvisoriesCache(fieldId);
    return;
  }

  const advisories = await advRepo
    .createQueryBuilder("a")
    .where("a.status = :st", { st: AdvisoryStatus.PUBLISHED })
    .andWhere("a.extent IS NOT NULL")
    .getMany();

  const rows: FieldAdvisoryMatch[] = [];
  for (const adv of advisories) {
    if (!adv.extent) continue;
    let advFeat: Feature;
    try {
      advFeat = extentToFeature(adv.extent as AdvisoryExtent);
    } catch {
      continue;
    }
    if (safeIntersects(boundaryFeat, advFeat)) {
      rows.push(
        matchRepo.create({
          fieldId: field.id,
          advisoryId: adv.id,
          explanation: DEFAULT_EXPLAIN,
        }),
      );
    }
  }
  if (rows.length) await matchRepo.save(rows);
  await invalidateFieldAdvisoriesCache(fieldId);
}

/** Rebuild intersections for one advisory across all fields with boundaries. */
export async function recomputeMatchesForAdvisory(
  advisoryId: string,
): Promise<void> {
  const matchRepo = AppDataSource.getRepository(FieldAdvisoryMatch);
  const fieldRepo = AppDataSource.getRepository(FarmField);
  const advRepo = AppDataSource.getRepository(CropAdvisory);

  const prior = await matchRepo.find({
    where: { advisoryId },
    select: ["fieldId"],
  });
  const touched = new Set(prior.map((p) => p.fieldId));

  await matchRepo.delete({ advisoryId });

  const advisory = await advRepo.findOne({ where: { id: advisoryId } });
  if (
    !advisory ||
    advisory.status !== AdvisoryStatus.PUBLISHED ||
    !advisory.extent
  ) {
    await Promise.all(
      [...touched].map((fid) => invalidateFieldAdvisoriesCache(fid)),
    );
    return;
  }

  let advFeat: Feature;
  try {
    advFeat = extentToFeature(advisory.extent as AdvisoryExtent);
  } catch {
    await Promise.all(
      [...touched].map((fid) => invalidateFieldAdvisoriesCache(fid)),
    );
    return;
  }

  const fields = await fieldRepo
    .createQueryBuilder("f")
    .where("f.boundary IS NOT NULL")
    .getMany();

  const rows: FieldAdvisoryMatch[] = [];
  for (const field of fields) {
    if (!field.boundary) continue;
    let bf: Feature<Polygon>;
    try {
      bf = farmBoundaryToFeature(field.boundary);
    } catch {
      continue;
    }
    if (safeIntersects(bf, advFeat)) {
      rows.push(
        matchRepo.create({
          fieldId: field.id,
          advisoryId: advisory.id,
          explanation: DEFAULT_EXPLAIN,
        }),
      );
    }
  }
  if (rows.length) await matchRepo.save(rows);
  for (const row of rows) touched.add(row.fieldId);
  await Promise.all(
    [...touched].map((fid) => invalidateFieldAdvisoriesCache(fid)),
  );
}

/**
 * Sequential full rebuild: call after bulk imports or rare maintenance only.
 */
export async function recomputeAllPublishedAdvisoryMatches(): Promise<void> {
  const advRepo = AppDataSource.getRepository(CropAdvisory);
  const advisories = await advRepo.find({
    where: { status: AdvisoryStatus.PUBLISHED },
    select: ["id"],
  });
  for (const a of advisories) {
    await recomputeMatchesForAdvisory(a.id);
  }
}
