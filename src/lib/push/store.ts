import "server-only";
import type { PushSubscription as WebPushSubscription } from "web-push";
import { redis, redisAvailable } from "./redis";

const SUB_PREFIX = "push:sub:";
const SESSION_SUBS_PREFIX = "push:session:";

function endpointHash(endpoint: string): string {
  let h = 0;
  for (let i = 0; i < endpoint.length; i++) {
    h = (h * 31 + endpoint.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36) + ":" + endpoint.slice(-12);
}

type StoredSubscription = WebPushSubscription & { sessionId?: string };

declare global {
  // eslint-disable-next-line no-var
  var __pushSubsMem: Map<string, StoredSubscription> | undefined;
}

function memStore(): Map<string, StoredSubscription> {
  if (!globalThis.__pushSubsMem) globalThis.__pushSubsMem = new Map();
  return globalThis.__pushSubsMem;
}

export async function saveSubscription(
  sub: WebPushSubscription,
  sessionId?: string
): Promise<void> {
  const record: StoredSubscription = { ...sub, sessionId };
  if (!redisAvailable()) {
    memStore().set(sub.endpoint, record);
    return;
  }
  const r = redis();
  const key = SUB_PREFIX + endpointHash(sub.endpoint);
  await r.set(key, record);
  if (sessionId) {
    await r.sadd(SESSION_SUBS_PREFIX + sessionId, key);
  }
}

export async function removeSubscription(endpoint: string): Promise<void> {
  if (!redisAvailable()) {
    memStore().delete(endpoint);
    return;
  }
  const r = redis();
  const key = SUB_PREFIX + endpointHash(endpoint);
  const existing = await r.get<StoredSubscription>(key);
  if (existing?.sessionId) {
    await r.srem(SESSION_SUBS_PREFIX + existing.sessionId, key);
  }
  await r.del(key);
}

export async function listSubscriptions(): Promise<StoredSubscription[]> {
  if (!redisAvailable()) return Array.from(memStore().values());
  const r = redis();
  const keys: string[] = [];
  let cursor: string | number = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const result = (await r.scan(cursor, {
      match: SUB_PREFIX + "*",
      count: 100,
    })) as [string | number, string[]];
    const nextCursor = result[0];
    const found = result[1];
    keys.push(...found);
    if (nextCursor === "0" || nextCursor === 0) break;
    cursor = nextCursor;
  }
  if (keys.length === 0) return [];
  const values = await r.mget<StoredSubscription[]>(...keys);
  return (values ?? []).filter((v): v is StoredSubscription => v !== null);
}

export async function listSubscriptionsForSession(
  sessionId: string
): Promise<StoredSubscription[]> {
  if (!redisAvailable()) {
    return Array.from(memStore().values()).filter(
      (s) => s.sessionId === sessionId
    );
  }
  const r = redis();
  const keys = await r.smembers(SESSION_SUBS_PREFIX + sessionId);
  if (!keys || keys.length === 0) return [];
  const values = await r.mget<StoredSubscription[]>(...keys);
  return (values ?? []).filter((v): v is StoredSubscription => v !== null);
}

export async function count(): Promise<number> {
  if (!redisAvailable()) return memStore().size;
  const subs = await listSubscriptions();
  return subs.length;
}
