import { CropAdvisory } from "../entities/CropAdvisory";

export function serializeAdvisory(a: CropAdvisory) {
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    category: a.category,
    targetCrops: a.targetCrops ?? [],
    geographicLabels: a.geographicLabels ?? [],
    weatherContext: a.weatherContext ?? null,
    extent: a.extent ?? null,
    validFrom: a.validFrom,
    validTo: a.validTo,
    maxRecommendedHectares: a.maxRecommendedHectares,
    status: a.status,
    ownerId: a.ownerId,
    owner: a.owner
      ? { id: a.owner.id, email: a.owner.email }
      : undefined,
    attachments: (a.attachments || []).map((x) => ({
      id: x.id,
      filename: x.filename,
      url: `/uploads/${x.storedPath.replace(/\\/g, "/")}`,
      mimeType: x.mimeType,
      sizeBytes: x.sizeBytes,
    })),
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}
