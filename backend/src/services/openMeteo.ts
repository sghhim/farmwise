import { getCachedJson, setCachedJson } from "../cache/redis";

const OPEN_METEO = "https://api.open-meteo.com/v1/forecast";

export type OpenMeteoForecastJson = Record<string, unknown>;

const memStore = new Map<
  string,
  { expires: number; data: OpenMeteoForecastJson }
>();

export function weatherCacheKey(lat: number, lon: number): string {
  return `fw:weather:${lat.toFixed(4)}:${lon.toFixed(4)}`;
}

export async function fetchOpenMeteoForecast(
  lat: number,
  lon: number
): Promise<{
  data: OpenMeteoForecastJson;
  fetchedAt: string;
  cacheHit: boolean;
}> {
  const ttlSec = Number(process.env.WEATHER_CACHE_TTL_SEC || 900);
  const rKey = weatherCacheKey(lat, lon);

  const fromRedis = await getCachedJson<OpenMeteoForecastJson>(rKey);
  if (fromRedis) {
    return {
      data: fromRedis,
      fetchedAt: new Date().toISOString(),
      cacheHit: true,
    };
  }

  const memKey = `${lat.toFixed(4)}:${lon.toFixed(4)}`;
  const mem = memStore.get(memKey);
  if (mem && mem.expires > Date.now()) {
    return {
      data: mem.data,
      fetchedAt: new Date().toISOString(),
      cacheHit: true,
    };
  }

  const url = new URL(OPEN_METEO);
  url.searchParams.set("latitude", String(lat));
  url.searchParams.set("longitude", String(lon));
  url.searchParams.set("current", "temperature_2m,wind_speed_10m");
  url.searchParams.set(
    "hourly",
    "temperature_2m,relative_humidity_2m,wind_speed_10m"
  );
  url.searchParams.set("timezone", "auto");

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Open-Meteo returned ${res.status}`);
  }
  const data = (await res.json()) as OpenMeteoForecastJson;
  await setCachedJson(rKey, data, ttlSec);
  memStore.set(memKey, { expires: Date.now() + ttlSec * 1000, data });

  return {
    data,
    fetchedAt: new Date().toISOString(),
    cacheHit: false,
  };
}
