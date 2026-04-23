import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    return res.status(422).json({
      error: "Validation failed",
      details: err.flatten(),
    });
  }
  console.error(err);
  const message = err instanceof Error ? err.message : "Internal Server Error";
  return res.status(500).json({ error: message });
}
