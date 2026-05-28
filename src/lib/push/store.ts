import "server-only";
import type { PushSubscription as WebPushSubscription } from "web-push";
import { redis, redisAvailable } from "./redis";
import { resolveOwnerId } from "@/lib/auth/owner";

const SUB_PREFIX = "push:sub:";
const OWNER_SUBS_PREFIX = "push:owner:";
const ENDPOINT_OWNER_PREFIX = "push:endpoint-owner:";

function endpointHash(endpoint: string): string {
  let h = 0;
  for (let i = 0; i < endpoint.length; i++) {
    h = (h * 31 + endpoint.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36) + ":" + endpoint.slice(-12);
}

type StoredSubscription = WebPushSubscription & {
  ownerId?: string;
  sessionId?: string;
};

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
  const ownerId = sessionId ? await resolveOwnerId(sessionId) : undefined;
  const record: StoredSubscription = { ...sub, sessionId, ownerId };
  if (!redisAvailable()) {
    memStore().set(sub.endpoint, record);
    return;
  }
  const r = redis();
  const key = SUB_PREFIX + endpointHash(sub.endpoint);
  await r.set(key, record);
  if (ownerId) {
    await r.sadd(OWNER_SUBS_PREFIX + ownerId, key);
    await r.set(ENDPOINT_OWNER_PREFIX + endpointHash(sub.endpoint), ownerId);
  }
}

export async function removeSubscription(endpoint: string): Promise<void> {
  if (!redisAvailable()) {
    memStore().delete(endpoint);
    return;
  }
  const r = redis();
  const endpointKey = endpointHash(endpoint);
  const key = SUB_PREFIX + endpointKey;
  const existing = await r.get<StoredSubscription>(key);
  if (existing?.ownerId) {
    await r.srem(OWNER_SUBS_PREFIX + existing.ownerId, key);
    await r.del(ENDPOINT_OWNER_PREFIX + endpointKey);
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

export async function listSubscriptionsForOwner(
  ownerId: string
): Promise<StoredSubscription[]> {
  if (!redisAvailable()) {
    return Array.from(memStore().values()).filter(
      (s) => s.ownerId === ownerId
    );
  }
  const r = redis();
  const keys = await r.smembers(OWNER_SUBS_PREFIX + ownerId);
  if (!keys || keys.length === 0) return [];
  const values = await r.mget<StoredSubscription[]>(...keys);
  return (values ?? []).filter((v): v is StoredSubscription => v !== null);
}

// Backward-compatible helper: sessionId -> ownerId -> subscriptions.
export async function listSubscriptionsForSession(
  sessionId: string
): Promise<StoredSubscription[]> {
  const ownerId = await resolveOwnerId(sessionId);
  return listSubscriptionsForOwner(ownerId);
}

export async function count(): Promise<number> {
  if (!redisAvailable()) return memStore().size;
  const subs = await listSubscriptions();
  return subs.length;
}

export async function ownerIdForEndpointHash(
  endpoint: string
): Promise<string | null> {
  if (!redisAvailable()) return null;
  const r = redis();
  return (
    (await r.get<string>(ENDPOINT_OWNER_PREFIX + endpointHash(endpoint))) ?? null
  );
}
