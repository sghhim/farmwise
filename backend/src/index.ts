/**
 * FieldWise API entrypoint: loads environment, connects Postgres via TypeORM,
 * optionally seeds an admin user, then listens on PORT (default 4000).
 */
import "reflect-metadata";
import dotenv from "dotenv";
import { AppDataSource } from "./data-source";
import { seedAdmin } from "./seed";
import { createApp } from "./app";

dotenv.config();

const app = createApp();
const port = Number(process.env.PORT || 4000);

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required");
  }
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is required");
  }
  await AppDataSource.initialize();
  await seedAdmin();
  app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
