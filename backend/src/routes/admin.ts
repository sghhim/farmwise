import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../data-source";
import { User, UserRole } from "../entities/User";
import { CropAdvisory, AdvisoryStatus } from "../entities/CropAdvisory";
import { FieldObservation } from "../entities/FieldObservation";
import { asyncHandler } from "../utils/asyncHandler";
import { AuthedRequest, requireAuth, requireRoles } from "../middleware/auth";
import {
  invalidateAdvisoryListCaches,
  invalidateAdvisoryMineCachesForOwner,
} from "../cache/redis";
import { recomputeMatchesForAdvisory } from "../services/advisoryMatching";

const router = Router();

router.use(requireAuth, requireRoles(UserRole.ADMIN));

router.get(
  "/users/pending-agronomists",
  asyncHandler(async (_req, res) => {
    const repo = AppDataSource.getRepository(User);
    const users = await repo.find({
      where: { role: UserRole.AGRONOMIST, agronomistVerified: false },
      order: { createdAt: "ASC" },
    });
    return res.json({
      data: users.map((u) => ({
        id: u.id,
        email: u.email,
        createdAt: u.createdAt,
      })),
    });
  }),
);

const adminListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  q: z.string().optional(),
});

/** Paginated users for admin pickers (activate/deactivate, lookup). */
router.get(
  "/users",
  asyncHandler(async (req, res) => {
    const q = adminListQuery.parse(req.query);
    const repo = AppDataSource.getRepository(User);
    const qb = repo
      .createQueryBuilder("u")
      .orderBy("u.email", "ASC")
      .skip((q.page - 1) * q.limit)
      .take(q.limit);
    const raw = q.q?.trim();
    if (raw) {
      qb.andWhere("(u.email ILIKE :kw OR u.id::text = :exact)", {
        kw: `%${raw}%`,
        exact: raw,
      });
    }
    const [items, total] = await qb.getManyAndCount();
    return res.json({
      data: items.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        agronomistVerified: u.agronomistVerified,
      })),
      meta: { total, page: q.page, limit: q.limit },
    });
  }),
);

/** Paginated advisories for admin status overrides. */
router.get(
  "/advisories",
  asyncHandler(async (req, res) => {
    const q = adminListQuery.parse(req.query);
    const repo = AppDataSource.getRepository(CropAdvisory);
    const qb = repo
      .createQueryBuilder("a")
      .leftJoinAndSelect("a.owner", "owner")
      .orderBy("a.updatedAt", "DESC")
      .skip((q.page - 1) * q.limit)
      .take(q.limit);
    const raw = q.q?.trim();
    if (raw) {
      qb.andWhere("(a.title ILIKE :kw OR a.id::text = :exact)", {
        kw: `%${raw}%`,
        exact: raw,
      });
    }
    const [items, total] = await qb.getManyAndCount();
    return res.json({
      data: items.map((a) => ({
        id: a.id,
        title: a.title,
        status: a.status,
        category: a.category,
        ownerEmail: a.owner?.email ?? null,
      })),
      meta: { total, page: q.page, limit: q.limit },
    });
  }),
);

const patchUserSchema = z.object({
  agronomistVerified: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

router.patch(
  "/users/:id",
  asyncHandler(async (req, res) => {
    const body = patchUserSchema.parse(req.body);
    const repo = AppDataSource.getRepository(User);
    const user = await repo.findOne({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ error: "Not found" });
    if (body.agronomistVerified !== undefined) {
      if (user.role !== UserRole.AGRONOMIST) {
        return res.status(422).json({
          error: "agronomistVerified only applies to agronomists",
        });
      }
      user.agronomistVerified = body.agronomistVerified;
    }
    if (body.isActive !== undefined) user.isActive = body.isActive;
    await repo.save(user);
    return res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      agronomistVerified: user.agronomistVerified,
      isActive: user.isActive,
    });
  }),
);

router.patch(
  "/advisories/:id",
  asyncHandler(async (req, res) => {
    const body = z
      .object({ status: z.nativeEnum(AdvisoryStatus).optional() })
      .parse(req.body);
    const repo = AppDataSource.getRepository(CropAdvisory);
    const advisory = await repo.findOne({ where: { id: req.params.id } });
    if (!advisory) return res.status(404).json({ error: "Not found" });
    if (body.status !== undefined) advisory.status = body.status;
    await repo.save(advisory);
    await invalidateAdvisoryListCaches();
    await invalidateAdvisoryMineCachesForOwner(advisory.ownerId);
    await recomputeMatchesForAdvisory(advisory.id);
    return res.json({ id: advisory.id, status: advisory.status });
  }),
);

router.get(
  "/observations",
  asyncHandler(async (req, res) => {
    const q = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      })
      .parse(req.query);
    const repo = AppDataSource.getRepository(FieldObservation);
    const qb = repo
      .createQueryBuilder("o")
      .leftJoinAndSelect("o.field", "field")
      .leftJoinAndSelect("o.media", "media")
      .leftJoinAndSelect("field.farmer", "farmer")
      .orderBy("o.createdAt", "DESC")
      .skip((q.page - 1) * q.limit)
      .take(q.limit);
    const [items, total] = await qb.getManyAndCount();
    return res.json({
      data: items.map((o) => ({
        id: o.id,
        symptomText: o.symptomText,
        severity: o.severity,
        observedAt: o.observedAt,
        isRemovedByModerator: o.isRemovedByModerator,
        field: o.field
          ? {
              id: o.field.id,
              name: o.field.name,
              farmer: { id: o.field.farmerId },
            }
          : undefined,
        media: (o.media || []).map((m) => ({
          id: m.id,
          filename: m.filename,
          url: `/uploads/${m.storedPath.replace(/\\/g, "/")}`,
        })),
        createdAt: o.createdAt,
      })),
      meta: { total, page: q.page, limit: q.limit },
    });
  }),
);

router.get(
  "/observations/:id",
  asyncHandler(async (req, res) => {
    const repo = AppDataSource.getRepository(FieldObservation);
    const obs = await repo.findOne({
      where: { id: req.params.id },
      relations: ["field", "field.farmer", "media"],
    });
    if (!obs) return res.status(404).json({ error: "Not found" });
    const field = obs.field;
    const farmer = field?.farmer;
    return res.json({
      id: obs.id,
      symptomText: obs.symptomText,
      severity: obs.severity,
      observedAt: obs.observedAt,
      isRemovedByModerator: obs.isRemovedByModerator,
      createdAt: obs.createdAt,
      fieldId: obs.fieldId,
      field: field
        ? {
            id: field.id,
            name: field.name,
            farmerId: field.farmerId,
            farmerEmail: farmer?.email ?? null,
          }
        : null,
      media: (obs.media || []).map((m) => ({
        id: m.id,
        filename: m.filename,
        url: `/uploads/${m.storedPath.replace(/\\/g, "/")}`,
        mimeType: m.mimeType,
        sizeBytes: m.sizeBytes,
      })),
    });
  }),
);

const patchObsSchema = z.object({
  isRemovedByModerator: z.boolean(),
});

router.patch(
  "/observations/:id",
  asyncHandler(async (req, res) => {
    const body = patchObsSchema.parse(req.body);
    const repo = AppDataSource.getRepository(FieldObservation);
    const obs = await repo.findOne({ where: { id: req.params.id } });
    if (!obs) return res.status(404).json({ error: "Not found" });
    obs.isRemovedByModerator = body.isRemovedByModerator;
    await repo.save(obs);
    return res.json({
      id: obs.id,
      isRemovedByModerator: obs.isRemovedByModerator,
    });
  }),
);

export default router;
