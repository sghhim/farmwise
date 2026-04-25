import fs from "fs";
import express from "express";
import cors from "cors";
import { AppDataSource } from "./data-source";
import authRoutes from "./routes/auth";
import advisoryRoutes from "./routes/advisories";
import fieldRoutes from "./routes/fields";
import observationRoutes from "./routes/observations";
import adminRoutes from "./routes/admin";
import { errorHandler } from "./middleware/errorHandler";
import { uploadRoot } from "./config";
import { CropAdvisory, AdvisoryStatus } from "./entities/CropAdvisory";
import {
  getCachedJson,
  META_CATEGORIES_KEY,
  setCachedJson,
} from "./cache/redis";

/**
 * Builds the HTTP API: JSON body parsing, CORS, static uploads, route mounts,
 * and cached meta categories. Call AppDataSource.initialize() before accepting traffic.
 */
export function createApp(): express.Application {
  const app = express();
  const clientOriginRaw =
    process.env.CLIENT_ORIGIN ?? "http://localhost:5173";
  const allowedOrigins = clientOriginRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  app.use(
    cors({
      origin:
        allowedOrigins.length === 0
          ? "http://localhost:5173"
          : allowedOrigins.length === 1
            ? allowedOrigins[0]
            : allowedOrigins,
      credentials: true,
    }),
  );
  app.use(express.json());

  const uploadsDir = uploadRoot();
  fs.mkdirSync(uploadsDir, { recursive: true });
  app.use(
    "/uploads",
    express.static(uploadsDir, {
      fallthrough: false,
    }),
  );

  app.get("/api/health", (_req, res) => res.json({ ok: true }));

  app.use("/api/auth", authRoutes);
  app.use("/api/advisories", advisoryRoutes);
  app.use("/api/fields", fieldRoutes);
  app.use("/api/observations", observationRoutes);
  app.use("/api/admin", adminRoutes);

  app.get("/api/meta/categories", async (_req, res, next) => {
    try {
      const cached = await getCachedJson<{ data: string[] }>(
        META_CATEGORIES_KEY,
      );
      if (cached) return res.json(cached);

      const repo = AppDataSource.getRepository(CropAdvisory);
      const rows = await repo
        .createQueryBuilder("a")
        .select("a.category", "category")
        .where("a.status = :st", { st: AdvisoryStatus.PUBLISHED })
        .distinct(true)
        .orderBy("a.category", "ASC")
        .getRawMany();
      const payload = {
        data: rows.map((r: { category: string }) => r.category),
      };
      await setCachedJson(META_CATEGORIES_KEY, payload);
      res.json(payload);
    } catch (e) {
      next(e);
    }
  });

  app.use(errorHandler);
  return app;
}
