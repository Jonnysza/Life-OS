import "server-only";

import { getIdentity } from "@/lib/google/identity";

export type OwnerId = `acct:${string}` | `sess:${string}`;

export async function resolveOwnerId(sessionId: string): Promise<OwnerId> {
  const clean = String(sessionId ?? "").trim();
  if (!clean) return "sess:";
  const identity = await getIdentity(clean);
  if (identity?.googleUserId) return `acct:${identity.googleUserId}`;
  return `sess:${clean}`;
}

