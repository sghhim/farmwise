import { Router } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { z } from "zod";
import { AppDataSource } from "../data-source";
import { FarmField } from "../entities/FarmField";
import {
  FieldObservation,
  ObservationSeverity,
} from "../entities/FieldObservation";
import { ObservationMedia } from "../entities/ObservationMedia";
import { UserRole } from "../entities/User";
import { asyncHandler } from "../utils/asyncHandler";
import { AuthedRequest, requireAuth, requireRoles } from "../middleware/auth";
import { MAX_OBSERVATION_MEDIA, uploadRoot } from "../config";

/**
 * Farmer-only routes for listing observations and creating them via multipart form:
 * fieldId, symptomText, severity, observedAt, plus zero or more file parts all named "files".
 */
const router = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(uploadRoot(), "observations");
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

const listQuery = z.object({
  fieldId: z.string().uuid().optional(),
  q: z.string().optional(),
  severity: z.nativeEnum(ObservationSeverity).optional(),
  observedFrom: z.coerce.date().optional(),
  observedTo: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["observedAt", "createdAt"]).default("observedAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
});

router.use(requireAuth, requireRoles(UserRole.FARMER));

router.get(
  "/",
  asyncHandler(async (req: AuthedRequest, res) => {
    const q = listQuery.parse(req.query);
    const fieldRepo = AppDataSource.getRepository(FarmField);
    const farmerId = req.user!.sub;

    let fieldIds: string[] | undefined;
    if (q.fieldId) {
      const f = await fieldRepo.findOne({ where: { id: q.fieldId } });
      if (!f || f.farmerId !== farmerId) {
        return res.status(403).json({ error: "Invalid field" });
      }
      fieldIds = [q.fieldId];
    } else {
      const fields = await fieldRepo.find({ where: { farmerId } });
      fieldIds = fields.map((x) => x.id);
    }

    if (fieldIds.length === 0) {
      return res.json({
        data: [],
        meta: { total: 0, page: q.page, limit: q.limit },
      });
    }

    const repo = AppDataSource.getRepository(FieldObservation);
    const qb = repo
      .createQueryBuilder("o")
      .leftJoinAndSelect("o.media", "media")
      .leftJoinAndSelect("o.field", "field")
      .where("o.fieldId IN (:...ids)", { ids: fieldIds })
      .andWhere("o.isRemovedByModerator = false");

    if (q.q) {
      qb.andWhere("o.symptomText ILIKE :kw", { kw: `%${q.q}%` });
    }
    if (q.severity) qb.andWhere("o.severity = :sev", { sev: q.severity });
    if (q.observedFrom)
      qb.andWhere("o.observedAt >= :of", { of: q.observedFrom });
    if (q.observedTo) qb.andWhere("o.observedAt <= :ot", { ot: q.observedTo });

    const sortCol = q.sort === "createdAt" ? "o.createdAt" : "o.observedAt";
    qb.orderBy(sortCol, q.order.toUpperCase() as "ASC" | "DESC");

    const skip = (q.page - 1) * q.limit;
    qb.skip(skip).take(q.limit);

    const [items, total] = await qb.getManyAndCount();
    return res.json({
      data: items.map(serializeObservation),
      meta: { total, page: q.page, limit: q.limit },
    });
  }),
);

router.post(
  "/",
  upload.array("files", MAX_OBSERVATION_MEDIA),
  asyncHandler(async (req: AuthedRequest, res) => {
    const raw = req.body as Record<string, unknown>;
    const body = z
      .object({
        fieldId: z.string().uuid(),
        symptomText: z.string().min(1),
        severity: z.nativeEnum(ObservationSeverity),
        observedAt: z.coerce.date(),
      })
      .parse(raw);

    const fieldRepo = AppDataSource.getRepository(FarmField);
    const field = await fieldRepo.findOne({ where: { id: body.fieldId } });
    if (!field || field.farmerId !== req.user!.sub) {
      (req.files as Express.Multer.File[] | undefined)?.forEach((f) =>
        fs.unlinkSync(f.path),
      );
      return res.status(403).json({ error: "Invalid field" });
    }

    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length > MAX_OBSERVATION_MEDIA) {
      files.forEach((f) => fs.unlinkSync(f.path));
      return res.status(422).json({
        error: `Maximum ${MAX_OBSERVATION_MEDIA} media files`,
      });
    }

    const obsRepo = AppDataSource.getRepository(FieldObservation);
    const mediaRepo = AppDataSource.getRepository(ObservationMedia);

    const obs = obsRepo.create({
      fieldId: field.id,
      symptomText: body.symptomText,
      severity: body.severity,
      observedAt: body.observedAt,
    });
    await obsRepo.save(obs);

    for (const f of files) {
      const rel = path.relative(uploadRoot(), f.path);
      const row = mediaRepo.create({
        observationId: obs.id,
        filename: f.originalname,
        storedPath: rel,
        mimeType: f.mimetype,
        sizeBytes: f.size,
      });
      await mediaRepo.save(row);
    }

    const full = await obsRepo.findOne({
      where: { id: obs.id },
      relations: ["media", "field"],
    });
    return res.status(201).json(serializeObservation(full!));
  }),
);

function serializeObservation(o: FieldObservation) {
  return {
    id: o.id,
    fieldId: o.fieldId,
    field: o.field ? { id: o.field.id, name: o.field.name } : undefined,
    symptomText: o.symptomText,
    severity: o.severity,
    observedAt: o.observedAt,
    isRemovedByModerator: o.isRemovedByModerator,
    media: (o.media || []).map((m) => ({
      id: m.id,
      filename: m.filename,
      url: `/uploads/${m.storedPath.replace(/\\/g, "/")}`,
      mimeType: m.mimeType,
      sizeBytes: m.sizeBytes,
    })),
    createdAt: o.createdAt,
  };
}

export default router;
