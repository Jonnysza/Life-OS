import "server-only";
import { Redis } from "@upstash/redis";

let client: Redis | null = null;

export function redis(): Redis {
  if (!client) {
    client = Redis.fromEnv();
  }
  return client;
}

export function redisAvailable(): boolean {
  return Boolean(
    process.env.KV_REST_API_URL ||
      process.env.UPSTASH_REDIS_REST_URL
  );
}
