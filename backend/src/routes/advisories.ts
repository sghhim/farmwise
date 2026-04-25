import { Router } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { z } from "zod";
import { AppDataSource } from "../data-source";
import {
  CropAdvisory,
  AdvisoryStatus,
} from "../entities/CropAdvisory";
import { AdvisoryAttachment } from "../entities/AdvisoryAttachment";
import { User, UserRole } from "../entities/User";
import { asyncHandler } from "../utils/asyncHandler";
import {
  AuthedRequest,
  optionalAuth,
  requireAuth,
  requireRoles,
} from "../middleware/auth";
import { MAX_ADVISORY_ATTACHMENTS, uploadRoot } from "../config";
import {
  advisoryListCacheKey,
  advisoryMineListCacheKey,
  advisoryPublishedDetailKey,
  getCachedJson,
  invalidateAdvisoryListCaches,
  invalidateAdvisoryMineCachesForOwner,
  setCachedJson,
} from "../cache/redis";
import { advisoryExtentSchema } from "../geo/geojson";
import { serializeAdvisory } from "../serializers/advisorySerializer";
import { recomputeMatchesForAdvisory } from "../services/advisoryMatching";

const router = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(uploadRoot(), "advisories");
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    cb(null, `${Date.now()}_${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
});

const stringArray = z.array(z.string().min(1).max(120)).max(50);

const listQuery = z.object({
  q: z.string().optional(),
  category: z.string().optional(),
  crop: z.string().optional(),
  region: z.string().optional(),
  validFromGte: z.coerce.date().optional(),
  validToLte: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["createdAt", "validFrom", "title"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  category: z.string().min(1).max(80),
  targetCrops: stringArray.optional(),
  geographicLabels: stringArray.optional(),
  extent: z.union([advisoryExtentSchema, z.null()]).optional(),
  weatherContext: z.string().max(12000).nullable().optional(),
  validFrom: z.coerce.date(),
  validTo: z.coerce.date(),
  maxRecommendedHectares: z.coerce.number().positive(),
});

const patchSchema = createSchema.partial();

/** Public catalog: published advisories only. */
router.get(
  "/",
  optionalAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const q = listQuery.parse(req.query);
    const cacheKey = advisoryListCacheKey(q);
    const cached = await getCachedJson<{
      data: ReturnType<typeof serializeAdvisory>[];
      meta: { total: number; page: number; limit: number };
    }>(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    const repo = AppDataSource.getRepository(CropAdvisory);
    const qb = repo
      .createQueryBuilder("a")
      .leftJoinAndSelect("a.owner", "owner")
      .leftJoinAndSelect("a.attachments", "attachments")
      .where("a.status = :st", { st: AdvisoryStatus.PUBLISHED });

    if (q.q) {
      qb.andWhere(
        "(a.title ILIKE :kw OR a.description ILIKE :kw OR COALESCE(a.weather_context, '') ILIKE :kw)",
        { kw: `%${q.q}%` }
      );
    }
    if (q.category) qb.andWhere("a.category = :cat", { cat: q.category });
    if (q.crop?.trim()) {
      const cropKw = `%${q.crop.trim()}%`;
      qb.andWhere(
        `EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(a.target_crops, '[]'::jsonb)) AS c WHERE c ILIKE :cropKw)`,
        { cropKw }
      );
    }
    if (q.region?.trim()) {
      const regionKw = `%${q.region.trim()}%`;
      qb.andWhere(
        `EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(a.geographic_labels, '[]'::jsonb)) AS g WHERE g ILIKE :regionKw)`,
        { regionKw }
      );
    }
    if (q.validFromGte)
      qb.andWhere("a.validTo >= :vfg", { vfg: q.validFromGte });
    if (q.validToLte)
      qb.andWhere("a.validFrom <= :vtl", { vtl: q.validToLte });

    const sortCol =
      q.sort === "title" ? "a.title" : q.sort === "validFrom" ? "a.validFrom" : "a.createdAt";
    qb.orderBy(sortCol, q.order.toUpperCase() as "ASC" | "DESC");

    const skip = (q.page - 1) * q.limit;
    qb.skip(skip).take(q.limit);

    const [items, total] = await qb.getManyAndCount();
    const payload = {
      data: items.map(serializeAdvisory),
      meta: { total, page: q.page, limit: q.limit },
    };
    await setCachedJson(cacheKey, payload);
    return res.json(payload);
  })
);

/** Agronomist: all own advisories (any status). */
router.get(
  "/mine",
  requireAuth,
  requireRoles(UserRole.AGRONOMIST),
  asyncHandler(async (req: AuthedRequest, res) => {
    const q = listQuery.parse(req.query);
    const mineKey = advisoryMineListCacheKey(req.user!.sub, q);
    const mineCached = await getCachedJson<{
      data: ReturnType<typeof serializeAdvisory>[];
      meta: { total: number; page: number; limit: number };
    }>(mineKey);
    if (mineCached) {
      return res.json(mineCached);
    }
    const repo = AppDataSource.getRepository(CropAdvisory);
    const qb = repo
      .createQueryBuilder("a")
      .leftJoinAndSelect("a.attachments", "attachments")
      .where("a.ownerId = :oid", { oid: req.user!.sub });

    if (q.q) {
      qb.andWhere(
        "(a.title ILIKE :kw OR a.description ILIKE :kw OR COALESCE(a.weather_context, '') ILIKE :kw)",
        { kw: `%${q.q}%` }
      );
    }
    if (q.category) qb.andWhere("a.category = :cat", { cat: q.category });
    if (q.crop?.trim()) {
      const cropKw = `%${q.crop.trim()}%`;
      qb.andWhere(
        `EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(a.target_crops, '[]'::jsonb)) AS c WHERE c ILIKE :cropKw)`,
        { cropKw }
      );
    }
    if (q.region?.trim()) {
      const regionKw = `%${q.region.trim()}%`;
      qb.andWhere(
        `EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(a.geographic_labels, '[]'::jsonb)) AS g WHERE g ILIKE :regionKw)`,
        { regionKw }
      );
    }
    const sortCol =
      q.sort === "title" ? "a.title" : q.sort === "validFrom" ? "a.validFrom" : "a.createdAt";
    qb.orderBy(sortCol, q.order.toUpperCase() as "ASC" | "DESC");
    const skip = (q.page - 1) * q.limit;
    qb.skip(skip).take(q.limit);
    const [items, total] = await qb.getManyAndCount();
    const minePayload = {
      data: items.map(serializeAdvisory),
      meta: { total, page: q.page, limit: q.limit },
    };
    await setCachedJson(mineKey, minePayload);
    return res.json(minePayload);
  })
);

router.get(
  "/:id",
  optionalAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const id = req.params.id;
    const u = req.user;
    if (!u) {
      const anonCached = await getCachedJson<
        ReturnType<typeof serializeAdvisory>
      >(advisoryPublishedDetailKey(id));
      if (anonCached) {
        return res.json(anonCached);
      }
    }
    const repo = AppDataSource.getRepository(CropAdvisory);
    const advisory = await repo.findOne({
      where: { id },
      relations: ["owner", "attachments"],
    });
    if (!advisory) return res.status(404).json({ error: "Not found" });
    const canSeeDraft =
      u &&
      (u.role === UserRole.ADMIN ||
        (u.role === UserRole.AGRONOMIST && advisory.ownerId === u.sub));
    if (advisory.status !== AdvisoryStatus.PUBLISHED && !canSeeDraft) {
      return res.status(404).json({ error: "Not found" });
    }
    const payload = serializeAdvisory(advisory);
    if (!u && advisory.status === AdvisoryStatus.PUBLISHED) {
      await setCachedJson(advisoryPublishedDetailKey(id), payload);
    }
    return res.json(payload);
  })
);

router.post(
  "/",
  requireAuth,
  requireRoles(UserRole.AGRONOMIST),
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = createSchema.parse(req.body);
    if (body.validTo < body.validFrom) {
      return res.status(422).json({ error: "validTo must be >= validFrom" });
    }
    const repo = AppDataSource.getRepository(CropAdvisory);
    const advisory = repo.create({
      title: body.title,
      description: body.description,
      category: body.category,
      targetCrops: body.targetCrops ?? [],
      geographicLabels: body.geographicLabels ?? [],
      extent:
        body.extent === undefined
          ? null
          : body.extent === null
            ? null
            : advisoryExtentSchema.parse(body.extent),
      weatherContext:
        body.weatherContext === undefined
          ? null
          : body.weatherContext,
      validFrom: body.validFrom,
      validTo: body.validTo,
      maxRecommendedHectares: String(body.maxRecommendedHectares),
      status: AdvisoryStatus.DRAFT,
      ownerId: req.user!.sub,
    });
    await repo.save(advisory);
    await invalidateAdvisoryMineCachesForOwner(req.user!.sub);
    const full = await repo.findOne({
      where: { id: advisory.id },
      relations: ["attachments"],
    });
    return res.status(201).json(serializeAdvisory(full!));
  })
);

router.patch(
  "/:id",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const body = patchSchema.parse(req.body);
    const repo = AppDataSource.getRepository(CropAdvisory);
    const advisory = await repo.findOne({ where: { id: req.params.id } });
    if (!advisory) return res.status(404).json({ error: "Not found" });
    const u = req.user!;
    if (u.role !== UserRole.ADMIN && advisory.ownerId !== u.sub) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (u.role !== UserRole.ADMIN && advisory.status === AdvisoryStatus.ARCHIVED) {
      return res.status(403).json({ error: "Cannot edit archived advisory" });
    }
    if (body.title !== undefined) advisory.title = body.title;
    if (body.description !== undefined) advisory.description = body.description;
    if (body.category !== undefined) advisory.category = body.category;
    if (body.targetCrops !== undefined) advisory.targetCrops = body.targetCrops;
    if (body.geographicLabels !== undefined) {
      advisory.geographicLabels = body.geographicLabels;
    }
    if (body.weatherContext !== undefined) {
      advisory.weatherContext = body.weatherContext;
    }
    if (body.extent !== undefined) {
      advisory.extent =
        body.extent === null ? null : advisoryExtentSchema.parse(body.extent);
    }
    if (body.validFrom !== undefined) advisory.validFrom = body.validFrom;
    if (body.validTo !== undefined) advisory.validTo = body.validTo;
    if (body.maxRecommendedHectares !== undefined) {
      advisory.maxRecommendedHectares = String(body.maxRecommendedHectares);
    }
    const vf = advisory.validFrom;
    const vt = advisory.validTo;
    if (vt < vf) {
      return res.status(422).json({ error: "validTo must be >= validFrom" });
    }
    await repo.save(advisory);
    await invalidateAdvisoryListCaches();
    await invalidateAdvisoryMineCachesForOwner(advisory.ownerId);
    if (advisory.status === AdvisoryStatus.PUBLISHED) {
      await recomputeMatchesForAdvisory(advisory.id);
    }
    const full = await repo.findOne({
      where: { id: advisory.id },
      relations: ["attachments", "owner"],
    });
    return res.json(serializeAdvisory(full!));
  })
);

router.post(
  "/:id/publish",
  requireAuth,
  requireRoles(UserRole.AGRONOMIST),
  asyncHandler(async (req: AuthedRequest, res) => {
    const userRepo = AppDataSource.getRepository(User);
    const me = await userRepo.findOne({ where: { id: req.user!.sub } });
    if (!me?.agronomistVerified) {
      return res.status(403).json({
        error: "Agronomist must be verified by an admin before publishing",
      });
    }
    const repo = AppDataSource.getRepository(CropAdvisory);
    const advisory = await repo.findOne({ where: { id: req.params.id } });
    if (!advisory) return res.status(404).json({ error: "Not found" });
    if (advisory.ownerId !== req.user!.sub) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (!advisory.extent) {
      return res.status(422).json({
        error:
          "Draw an advisory map area before publishing so farmers can match it to fields.",
      });
    }
    try {
      advisoryExtentSchema.parse(advisory.extent);
    } catch {
      return res.status(422).json({ error: "Invalid advisory map geometry" });
    }
    advisory.status = AdvisoryStatus.PUBLISHED;
    await repo.save(advisory);
    await invalidateAdvisoryListCaches();
    await invalidateAdvisoryMineCachesForOwner(advisory.ownerId);
    await recomputeMatchesForAdvisory(advisory.id);
    const full = await repo.findOne({
      where: { id: advisory.id },
      relations: ["attachments"],
    });
    return res.json(serializeAdvisory(full!));
  })
);

router.post(
  "/:id/archive",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const repo = AppDataSource.getRepository(CropAdvisory);
    const advisory = await repo.findOne({ where: { id: req.params.id } });
    if (!advisory) return res.status(404).json({ error: "Not found" });
    const u = req.user!;
    if (u.role !== UserRole.ADMIN && advisory.ownerId !== u.sub) {
      return res.status(403).json({ error: "Forbidden" });
    }
    advisory.status = AdvisoryStatus.ARCHIVED;
    await repo.save(advisory);
    await invalidateAdvisoryListCaches();
    await invalidateAdvisoryMineCachesForOwner(advisory.ownerId);
    await recomputeMatchesForAdvisory(advisory.id);
    const full = await repo.findOne({
      where: { id: advisory.id },
      relations: ["attachments"],
    });
    return res.json(serializeAdvisory(full!));
  })
);

router.post(
  "/:id/attachments",
  requireAuth,
  requireRoles(UserRole.AGRONOMIST),
  upload.single("file"),
  asyncHandler(async (req: AuthedRequest, res) => {
    if (!req.file) return res.status(400).json({ error: "file required" });
    const repo = AppDataSource.getRepository(CropAdvisory);
    const attRepo = AppDataSource.getRepository(AdvisoryAttachment);
    const advisory = await repo.findOne({
      where: { id: req.params.id },
      relations: ["attachments"],
    });
    if (!advisory) return res.status(404).json({ error: "Not found" });
    if (advisory.ownerId !== req.user!.sub) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const count = advisory.attachments?.length ?? 0;
    if (count >= MAX_ADVISORY_ATTACHMENTS) {
      fs.unlinkSync(req.file.path);
      return res.status(422).json({
        error: `Maximum ${MAX_ADVISORY_ATTACHMENTS} attachments per advisory`,
      });
    }
    const rel = path.relative(uploadRoot(), req.file.path);
    const row = attRepo.create({
      advisoryId: advisory.id,
      filename: req.file.originalname,
      storedPath: rel,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
    });
    await attRepo.save(row);
    await invalidateAdvisoryListCaches();
    await invalidateAdvisoryMineCachesForOwner(advisory.ownerId);
    return res.status(201).json({
      id: row.id,
      filename: row.filename,
      url: `/uploads/${row.storedPath.replace(/\\/g, "/")}`,
    });
  })
);

export default router;
