import { AppDataSource } from "./data-source";
import { User, UserRole } from "./entities/User";
import { hashPassword } from "./utils/password";

/**
 * Inserts one ADMIN user when ADMIN_EMAIL and ADMIN_PASSWORD env vars are both set
 * and no user with that email exists yet.
 */
export async function seedAdmin(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;

  const repo = AppDataSource.getRepository(User);
  const existing = await repo.findOne({ where: { email } });
  if (existing) return;

  const admin = repo.create({
    email,
    passwordHash: await hashPassword(password),
    role: UserRole.ADMIN,
    agronomistVerified: true,
    isActive: true,
  });
  await repo.save(admin);
  console.log(`Seeded admin user ${email}`);
}
