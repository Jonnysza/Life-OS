import "server-only";
import { randomBytes } from "crypto";
import { redis, redisAvailable } from "@/lib/push/redis";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const CALENDAR_TOKEN_PREFIX = "google:calendar:token:";
const SCOPE =
  "openid email profile https://www.googleapis.com/auth/calendar.events";

export type Identity = {
  googleUserId: string;
  email: string;
  name?: string;
  picture?: string;
  linkedAt: number;
};

type GoogleTokenRecord = {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  scope?: string;
  token_type?: string;
};

type OAuthStateRecord = {
  sessionId: string;
  returnTo: string;
  createdAt: number;
};

export function googleAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
}

function getConfig(origin: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
  const redirectUri =
    process.env.GOOGLE_AUTH_REDIRECT_URI ||
    `${origin}/api/auth/google/callback`;
  return { clientId, clientSecret, redirectUri };
}

function requireRedis() {
  if (!redisAvailable()) {
    throw new Error("Redis is not configured.");
  }
  return redis();
}

function sessionKey(sessionId: string) {
  return `auth:session:${sessionId}`;
}

function stateKey(state: string) {
  return `auth:oauthstate:${state}`;
}

function calendarTokenKey(googleUserId: string) {
  return `${CALENDAR_TOKEN_PREFIX}acct:${googleUserId}`;
}

function normalizeReturnTo(value: string | null | undefined, origin: string) {
  try {
    const url = new URL(value || "/", origin);
    if (url.origin !== origin) return `${origin}/`;
    return url.toString();
  } catch {
    return `${origin}/`;
  }
}

export async function createLoginUrl(
  sessionId: string,
  returnTo: string | null,
  origin: string
): Promise<string> {
  if (!sessionId) throw new Error("Missing session id.");
  if (!googleAuthConfigured()) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are not configured.");
  }
  const r = requireRedis();
  const { clientId, redirectUri } = getConfig(origin);
  const state = randomBytes(24).toString("hex");
  await r.set<OAuthStateRecord>(
    stateKey(state),
    { sessionId, returnTo: normalizeReturnTo(returnTo, origin), createdAt: Date.now() },
    { ex: 10 * 60 }
  );

  const url = new URL(AUTH_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function handleCallback(
  code: string,
  state: string,
  origin: string
): Promise<{ returnTo: string }> {
  const r = requireRedis();
  const stateRecord = await r.get<OAuthStateRecord>(stateKey(state));
  if (!stateRecord) throw new Error("Login session expired. Try again.");
  await r.del(stateKey(state));

  const { clientId, clientSecret, redirectUri } = getConfig(origin);
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) {
    throw new Error("Google token exchange failed.");
  }
  const token = (await tokenRes.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };
  if (!token.access_token) throw new Error("No access token from Google.");

  const userRes = await fetch(USERINFO_URL, {
    headers: { authorization: `Bearer ${token.access_token}` },
  });
  if (!userRes.ok) throw new Error("Could not fetch Google profile.");
  const profile = (await userRes.json()) as {
    sub: string;
    email?: string;
    name?: string;
    picture?: string;
  };

  const identity: Identity = {
    googleUserId: profile.sub,
    email: profile.email ?? "",
    name: profile.name,
    picture: profile.picture,
    linkedAt: Date.now(),
  };
  await r.set<Identity>(sessionKey(stateRecord.sessionId), identity, {
    ex: 60 * 60 * 24 * 365,
  });

  const previousCalendarToken = await r.get<GoogleTokenRecord>(
    calendarTokenKey(profile.sub)
  );
  const calendarToken: GoogleTokenRecord = {
    access_token: token.access_token,
    refresh_token: token.refresh_token ?? previousCalendarToken?.refresh_token,
    expires_at: Date.now() + Number(token.expires_in ?? 3600) * 1000,
    scope: token.scope ?? previousCalendarToken?.scope,
    token_type: token.token_type ?? previousCalendarToken?.token_type,
  };
  await r.set<GoogleTokenRecord>(calendarTokenKey(profile.sub), calendarToken);

  return { returnTo: stateRecord.returnTo };
}

export async function getIdentity(sessionId: string): Promise<Identity | null> {
  if (!sessionId || !redisAvailable()) return null;
  return (await redis().get<Identity>(sessionKey(sessionId))) ?? null;
}

export async function logout(sessionId: string): Promise<void> {
  if (!sessionId || !redisAvailable()) return;
  await redis().del(sessionKey(sessionId));
}

// ---- full-state sync ----

type StateRecord = {
  blob: string;
  updatedAt: number;
  device?: string;
};

function stateKeyFor(googleUserId: string) {
  return `auth:state:${googleUserId}`;
}

export async function pullState(
  sessionId: string
): Promise<{ blob: string; updatedAt: number } | null> {
  const identity = await getIdentity(sessionId);
  if (!identity) return null;
  const rec = await redis().get<StateRecord>(stateKeyFor(identity.googleUserId));
  if (!rec) return null;
  return { blob: rec.blob, updatedAt: rec.updatedAt };
}

export async function pushState(
  sessionId: string,
  blob: string,
  updatedAt: number,
  device?: string
): Promise<{ ok: boolean; updatedAt: number; conflict?: boolean }> {
  const identity = await getIdentity(sessionId);
  if (!identity) return { ok: false, updatedAt: 0 };
  const key = stateKeyFor(identity.googleUserId);
  const existing = await redis().get<StateRecord>(key);
  if (existing && existing.updatedAt > updatedAt) {
    // server is newer — caller should pull
    return { ok: false, updatedAt: existing.updatedAt, conflict: true };
  }
  await redis().set<StateRecord>(key, { blob, updatedAt, device });
  return { ok: true, updatedAt };
}
