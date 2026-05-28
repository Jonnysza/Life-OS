import "server-only";

import { randomBytes } from "crypto";
import { redis, redisAvailable } from "@/lib/push/redis";

function ownerFeedKeyKey(ownerId: string) {
  return `cal:feedkey:${ownerId}`;
}

function feedKeyOwnerKey(feedKey: string) {
  return `cal:feedkey-owner:${feedKey}`;
}

function makeFeedKey() {
  return randomBytes(24).toString("hex");
}

export async function getOrCreateFeedKeyForOwner(
  ownerId: string
): Promise<string | null> {
  if (!redisAvailable()) return null;
  const r = redis();
  const existing = await r.get<string>(ownerFeedKeyKey(ownerId));
  if (existing) return existing;
  const feedKey = makeFeedKey();
  await r.set(ownerFeedKeyKey(ownerId), feedKey);
  await r.set(feedKeyOwnerKey(feedKey), ownerId);
  return feedKey;
}

export async function ownerIdForFeedKey(feedKey: string): Promise<string | null> {
  if (!redisAvailable()) return null;
  const r = redis();
  return (await r.get<string>(feedKeyOwnerKey(feedKey))) ?? null;
}

