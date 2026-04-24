/**
 * Redis-backed JSON cache helpers for advisory catalog, meta categories,
 * field lists, and Open-Meteo weather blobs. When REDIS_URL is unset, all
 * reads return null and writes become no-ops so Postgres remains authoritative.
 */
import crypto from "crypto";
import Redis from "ioredis";

let client: Redis | null | undefined;

/** Lazy singleton ioredis client, or null when REDIS_URL is not configured. */
function getClient(): Redis | null {
  if (client !== undefined) return client;
  const url = process.env.REDIS_URL;
  if (!url) {
    client = null;
    return null;
  }
  client = new Redis(url, { maxRetriesPerRequest: 2, enableReadyCheck: true });
  return client;
}

const LIST_PREFIX = "fw:advisories:list:";
const PUB_DETAIL_PREFIX = "fw:advisory:pub:";
const MINE_PREFIX = "fw:advisories:mine:";

const LIST_TTL_SEC = Number(process.env.REDIS_ADVISORY_CACHE_TTL_SEC || 60);

/** Fixed Redis key string for cached distinct category labels from published advisories. */
export const META_CATEGORIES_KEY = "fw:meta:categories";

/** Stable cache key for GET advisories list query objects (published catalog). */
export function advisoryListCacheKey(query: object): string {
  const h = crypto
    .createHash("sha256")
    .update(JSON.stringify(query))
    .digest("hex")
    .slice(0, 32);
  return `${LIST_PREFIX}${h}`;
}

/** Key for anonymous GET advisory by id when status is published (no auth shortcut). */
export function advisoryPublishedDetailKey(advisoryId: string): string {
  return `${PUB_DETAIL_PREFIX}${advisoryId}`;
}

/** Key for agronomist GET advisories mine lists (hashed query includes filters). */
export function advisoryMineListCacheKey(
  ownerId: string,
  query: object,
): string {
  const h = crypto
    .createHash("sha256")
    .update(JSON.stringify(query))
    .digest("hex")
    .slice(0, 32);
  return `${MINE_PREFIX}${ownerId}:${h}`;
}

/** Key for farmer GET fields/:id/advisories matched payload. */
export function fieldAdvisoriesCacheKey(fieldId: string): string {
  return `fw:field:advisories:${fieldId}`;
}

/** Key for farmer GET fields index payload. */
export function farmerFieldsListCacheKey(farmerId: string): string {
  return `fw:fields:list:${farmerId}`;
}

/** Redis GET helper; parse failures yield null. */
export async function getCachedJson<T>(key: string): Promise<T | null> {
  const r = getClient();
  if (!r) return null;
  try {
    const raw = await r.get(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** SET JSON with TTL seconds (defaults to REDIS_ADVISORY_CACHE_TTL_SEC). */
export async function setCachedJson(
  key: string,
  value: unknown,
  ttlSec = LIST_TTL_SEC,
): Promise<void> {
  const r = getClient();
  if (!r) return;
  try {
    await r.set(key, JSON.stringify(value), "EX", ttlSec);
  } catch {
    /* ignore cache failures */
  }
}

/**
 * Drops cached advisory list pages, anonymous published advisory bodies,
 * and the distinct published categories payload used by meta categories route.
 */
export async function invalidateAdvisoryListCaches(): Promise<void> {
  const r = getClient();
  if (!r) return;
  try {
    const listKeys = await r.keys(`${LIST_PREFIX}*`);
    const pubKeys = await r.keys(`${PUB_DETAIL_PREFIX}*`);
    const keys = [...listKeys, ...pubKeys];
    if (keys.length) await r.del(...keys);
    await r.del(META_CATEGORIES_KEY);
  } catch {
    /* ignore */
  }
}

/** Removes all cached GET mine pages for one agronomist user id. */
export async function invalidateAdvisoryMineCachesForOwner(
  ownerId: string,
): Promise<void> {
  const r = getClient();
  if (!r) return;
  try {
    const keys = await r.keys(`${MINE_PREFIX}${ownerId}:*`);
    if (keys.length) await r.del(...keys);
  } catch {
    /* ignore */
  }
}

/** Removes cached matched-advisories response for one field id. */
export async function invalidateFieldAdvisoriesCache(
  fieldId: string,
): Promise<void> {
  const r = getClient();
  if (!r) return;
  try {
    await r.del(fieldAdvisoriesCacheKey(fieldId));
  } catch {
    /* ignore */
  }
}

/** Removes cached farmer field list for one farmer user id. */
export async function invalidateFarmerFieldsListCache(
  farmerId: string,
): Promise<void> {
  const r = getClient();
  if (!r) return;
  try {
    await r.del(farmerFieldsListCacheKey(farmerId));
  } catch {
    /* ignore */
  }
}
