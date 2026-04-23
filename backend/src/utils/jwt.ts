import jwt from "jsonwebtoken";
import { UserRole } from "../entities/User";

export type JwtPayload = {
  sub: string;
  role: UserRole;
};

export function signAccessToken(payload: JwtPayload): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

export function verifyAccessToken(token: string): JwtPayload {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set");
  const decoded = jwt.verify(token, secret);
  if (typeof decoded !== "object" || decoded === null)
    throw new Error("Invalid token");
  const { sub, role } = decoded as Record<string, unknown>;
  if (typeof sub !== "string" || typeof role !== "string")
    throw new Error("Invalid token payload");
  return { sub, role: role as UserRole };
}
