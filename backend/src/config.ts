import path from "path";

export const MAX_ADVISORY_ATTACHMENTS = 5;
export const MAX_OBSERVATION_MEDIA = 5;
export const MAX_UPLOAD_MB = 8;

export function uploadRoot(): string {
  return path.resolve(process.env.UPLOAD_DIR || "./uploads");
}
