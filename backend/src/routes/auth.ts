import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../data-source";
import { User, UserRole } from "../entities/User";
import { hashPassword, verifyPassword } from "../utils/password";
import { signAccessToken } from "../utils/jwt";
import { asyncHandler } from "../utils/asyncHandler";
import { AuthedRequest, requireAuth } from "../middleware/auth";

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.nativeEnum(UserRole).refine(
    (r) => r === UserRole.FARMER || r === UserRole.AGRONOMIST,
    "Only FARMER or AGRONOMIST may self-register"
  ),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

router.post(
  "/register",
  asyncHandler(async (req, res) => {
    const body = registerSchema.parse(req.body);
    const repo = AppDataSource.getRepository(User);
    const existing = await repo.findOne({ where: { email: body.email } });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }
    const user = repo.create({
      email: body.email,
      passwordHash: await hashPassword(body.password),
      role: body.role,
      agronomistVerified: false,
    });
    await repo.save(user);
    const token = signAccessToken({ sub: user.id, role: user.role });
    return res.status(201).json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        agronomistVerified: user.agronomistVerified,
      },
    });
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const repo = AppDataSource.getRepository(User);
    const user = await repo.findOne({ where: { email: body.email } });
    if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    if (!user.isActive) {
      return res.status(403).json({ error: "Account suspended" });
    }
    const token = signAccessToken({ sub: user.id, role: user.role });
    return res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        agronomistVerified: user.agronomistVerified,
      },
    });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req: AuthedRequest, res) => {
    const repo = AppDataSource.getRepository(User);
    const user = await repo.findOne({ where: { id: req.user!.sub } });
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      agronomistVerified: user.agronomistVerified,
      isActive: user.isActive,
    });
  })
);

export default router;
