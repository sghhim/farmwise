/**
 * Single TypeORM DataSource for Postgres. Uses synchronize in non-production
 * (set NODE_ENV=production and migrate for real deployments).
 */
import "reflect-metadata";
import { DataSource } from "typeorm";
import {
  User,
  CropAdvisory,
  AdvisoryAttachment,
  FarmField,
  FieldObservation,
  ObservationMedia,
  FieldAdvisoryMatch,
} from "./entities";

export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  synchronize: process.env.NODE_ENV !== "production",
  logging: process.env.TYPEORM_LOGGING === "true",
  entities: [
    User,
    CropAdvisory,
    AdvisoryAttachment,
    FarmField,
    FieldObservation,
    ObservationMedia,
    FieldAdvisoryMatch,
  ],
});
