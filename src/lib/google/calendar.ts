import "server-only";

import { randomBytes } from "node:crypto";
import { redis, redisAvailable } from "@/lib/push/redis";

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const TOKEN_PREFIX = "google:calendar:token:";
const STATE_PREFIX = "google:calendar:state:";
const MAP_PREFIX = "google:calendar:event-map:";

export type LifeOsCalendarBlock = {
  todoId: string;
  title: string;
  date: string;
  time: string;
  durationMinutes?: number;
  kind: "todo" | "event";
  scheduledFor: number;
};

export type ImportedGoogleEvent = {
  externalId: string;
  title: string;
  date: string;
  time?: string;
  durationMinutes?: number;
  source: "google";
  htmlLink?: string;
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

type EventMap = Record<string, { eventId: string; fingerprint: string }>;

function tokenKey(sessionId: string) {
  return `${TOKEN_PREFIX}${sessionId}`;
}

function stateKey(state: string) {
  return `${STATE_PREFIX}${state}`;
}

function mapKey(sessionId: string) {
  return `${MAP_PREFIX}${sessionId}`;
}

export function googleCalendarConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function getConfig(origin: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? "";
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI || `${origin}/api/google/calendar/callback`;
  return { clientId, clientSecret, redirectUri };
}

function requireRedis() {
  if (!redisAvailable()) {
    throw new Error("Redis is required for Google Calendar token storage.");
  }
  return redis();
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

export async function getGoogleCalendarStatus(sessionId: string) {
  const configured = googleCalendarConfigured();
  const redisReady = redisAvailable();
  if (!sessionId || !redisReady) {
    return { configured, redis: redisReady, connected: false };
  }
  const token = await redis().get<GoogleTokenRecord>(tokenKey(sessionId));
  return {
    configured,
    redis: redisReady,
    connected: Boolean(token?.refresh_token || token?.access_token),
    needsReconnect: Boolean(token && !token.refresh_token && token.expires_at <= Date.now()),
  };
}

export async function createGoogleCalendarAuthUrl(
  sessionId: string,
  returnTo: string | null,
  origin: string
): Promise<string> {
  if (!sessionId) throw new Error("Missing session id.");
  if (!googleCalendarConfigured()) {
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

function tokenFromResponse(
  body: Record<string, unknown>,
  previous?: GoogleTokenRecord | null
): GoogleTokenRecord {
  const accessToken = String(body.access_token ?? "");
  if (!accessToken) throw new Error("Google did not return an access token.");
  const expiresIn = Number(body.expires_in ?? 3600);
  return {
    access_token: accessToken,
    refresh_token:
      typeof body.refresh_token === "string" ? body.refresh_token : previous?.refresh_token,
    expires_at: Date.now() + expiresIn * 1000,
    scope: typeof body.scope === "string" ? body.scope : previous?.scope,
    token_type: typeof body.token_type === "string" ? body.token_type : previous?.token_type,
  };
}

async function exchangeToken(params: URLSearchParams) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(String(body.error_description ?? body.error ?? "Google OAuth failed."));
  }
  return body;
}

export async function completeGoogleCalendarOAuth(
  code: string,
  state: string,
  origin: string
) {
  const r = requireRedis();
  const stored = await r.get<OAuthStateRecord>(stateKey(state));
  if (!stored) throw new Error("Google sign-in expired. Try connecting again.");

  const { clientId, clientSecret, redirectUri } = getConfig(origin);
  const previous = await r.get<GoogleTokenRecord>(tokenKey(stored.sessionId));
  const body = await exchangeToken(
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    })
  );

  await r.set(tokenKey(stored.sessionId), tokenFromResponse(body, previous));
  await r.del(stateKey(state));
  return stored;
}

async function refreshGoogleToken(
  sessionId: string,
  token: GoogleTokenRecord
): Promise<GoogleTokenRecord> {
  if (!token.refresh_token) {
    throw new Error("Google Calendar needs to be reconnected.");
  }
  const { clientId, clientSecret } = getConfig("");
  const body = await exchangeToken(
    new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: token.refresh_token,
      grant_type: "refresh_token",
    })
  );
  const refreshed = tokenFromResponse(body, token);
  await redis().set(tokenKey(sessionId), refreshed);
  return refreshed;
}

async function accessTokenForSession(
  sessionId: string,
  forceRefresh = false
): Promise<string> {
  if (!googleCalendarConfigured()) {
    throw new Error("Google Calendar OAuth is not configured.");
  }
  const r = requireRedis();
  const token = await r.get<GoogleTokenRecord>(tokenKey(sessionId));
  if (!token) throw new Error("Google Calendar is not connected.");
  if (!forceRefresh && token.expires_at - 60_000 > Date.now()) {
    return token.access_token;
  }
  return (await refreshGoogleToken(sessionId, token)).access_token;
}

async function calendarFetch(
  sessionId: string,
  path: string,
  init: RequestInit = {},
  retry = true
): Promise<Response> {
  const accessToken = await accessTokenForSession(sessionId);
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${accessToken}`);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const res = await fetch(`${CALENDAR_API}${path}`, { ...init, headers });
  if (res.status === 401 && retry) {
    const refreshed = await accessTokenForSession(sessionId, true);
    headers.set("authorization", `Bearer ${refreshed}`);
    return fetch(`${CALENDAR_API}${path}`, { ...init, headers });
  }
  return res;
}

function eventFingerprint(block: LifeOsCalendarBlock) {
  return JSON.stringify({
    title: block.title,
    kind: block.kind,
    scheduledFor: block.scheduledFor,
    durationMinutes: block.durationMinutes ?? (block.kind === "event" ? 60 : 30),
  });
}

function googleEventPayload(block: LifeOsCalendarBlock) {
  const duration = block.durationMinutes ?? (block.kind === "event" ? 60 : 30);
  const start = new Date(block.scheduledFor);
  const end = new Date(block.scheduledFor + duration * 60_000);
  return {
    summary: block.kind === "todo" ? `Life OS: ${block.title}` : block.title,
    description:
      "Synced from Life OS. Complete, snooze, or reschedule the original item inside Life OS.",
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    reminders: {
      useDefault: false,
      overrides: [
        { method: "popup", minutes: 10 },
        { method: "popup", minutes: 0 },
      ],
    },
    extendedProperties: {
      private: {
        lifeOs: "true",
        lifeOsTodoId: block.todoId,
        lifeOsKind: block.kind,
      },
    },
  };
}

async function readEventMap(sessionId: string): Promise<EventMap> {
  return (await redis().get<EventMap>(mapKey(sessionId))) ?? {};
}

async function writeEventMap(sessionId: string, map: EventMap) {
  await redis().set(mapKey(sessionId), map);
}

async function upsertGoogleEvent(
  sessionId: string,
  block: LifeOsCalendarBlock,
  eventId?: string
) {
  const payload = googleEventPayload(block);
  if (eventId) {
    const patch = await calendarFetch(
      sessionId,
      `/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
      { method: "PATCH", body: JSON.stringify(payload) }
    );
    if (patch.ok) return (await patch.json()) as { id: string };
    if (patch.status !== 404 && patch.status !== 410) {
      const text = await patch.text().catch(() => "");
      throw new Error(`Google update failed: ${patch.status} ${text.slice(0, 180)}`);
    }
  }

  const created = await calendarFetch(
    sessionId,
    "/calendars/primary/events?sendUpdates=none",
    { method: "POST", body: JSON.stringify(payload) }
  );
  const body = (await created.json().catch(() => ({}))) as { id?: string; error?: unknown };
  if (!created.ok || !body.id) {
    throw new Error(`Google create failed: ${created.status} ${JSON.stringify(body).slice(0, 180)}`);
  }
  return { id: body.id };
}

async function deleteGoogleEvent(sessionId: string, eventId: string) {
  const res = await calendarFetch(
    sessionId,
    `/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
    { method: "DELETE" }
  );
  if (res.ok || res.status === 404 || res.status === 410) return;
  const text = await res.text().catch(() => "");
  throw new Error(`Google delete failed: ${res.status} ${text.slice(0, 180)}`);
}

export async function syncLifeOsBlocksToGoogle(
  sessionId: string,
  blocks: LifeOsCalendarBlock[]
) {
  requireRedis();
  const map = await readEventMap(sessionId);
  const incomingIds = new Set(blocks.map((block) => block.todoId));
  let created = 0;
  let updated = 0;
  let deleted = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const [todoId, entry] of Object.entries(map)) {
    if (incomingIds.has(todoId)) continue;
    try {
      await deleteGoogleEvent(sessionId, entry.eventId);
      delete map[todoId];
      deleted++;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Google delete failed.");
    }
  }

  for (const block of blocks) {
    const fingerprint = eventFingerprint(block);
    const existing = map[block.todoId];
    if (existing?.fingerprint === fingerprint) {
      skipped++;
      continue;
    }
    try {
      const result = await upsertGoogleEvent(sessionId, block, existing?.eventId);
      map[block.todoId] = { eventId: result.id, fingerprint };
      if (existing) updated++;
      else created++;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Google sync failed.");
    }
  }

  await writeEventMap(sessionId, map);
  return { created, updated, deleted, skipped, errors };
}

function parseGoogleDate(value?: string) {
  if (!value) return undefined;
  return value.slice(0, 10);
}

function parseGoogleTime(value?: string) {
  if (!value || !value.includes("T")) return undefined;
  return value.slice(11, 16);
}

export async function importGoogleCalendarEvents(sessionId: string, days = 14) {
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    timeMin,
    timeMax,
    maxResults: "100",
  });
  const res = await calendarFetch(sessionId, `/calendars/primary/events?${params}`);
  const body = (await res.json().catch(() => ({}))) as {
    items?: {
      id?: string;
      summary?: string;
      htmlLink?: string;
      start?: { date?: string; dateTime?: string };
      end?: { date?: string; dateTime?: string };
      extendedProperties?: { private?: Record<string, string> };
    }[];
    error?: unknown;
  };
  if (!res.ok) {
    throw new Error(`Google import failed: ${res.status} ${JSON.stringify(body).slice(0, 180)}`);
  }

  return (body.items ?? [])
    .filter((item) => item.id && item.summary)
    .filter((item) => item.extendedProperties?.private?.lifeOs !== "true")
    .map((item): ImportedGoogleEvent | null => {
      const startValue = item.start?.dateTime ?? item.start?.date;
      const endValue = item.end?.dateTime ?? item.end?.date;
      const date = parseGoogleDate(startValue);
      if (!date || !item.id || !item.summary) return null;
      const durationMinutes =
        startValue && endValue && startValue.includes("T") && endValue.includes("T")
          ? Math.max(15, Math.round((Date.parse(endValue) - Date.parse(startValue)) / 60_000))
          : undefined;
      return {
        externalId: item.id,
        title: item.summary,
        date,
        time: parseGoogleTime(startValue),
        durationMinutes,
        source: "google",
        htmlLink: item.htmlLink,
      };
    })
    .filter((item): item is ImportedGoogleEvent => item !== null);
}

export async function disconnectGoogleCalendar(sessionId: string) {
  if (!redisAvailable()) return;
  const r = redis();
  const token = await r.get<GoogleTokenRecord>(tokenKey(sessionId));
  if (token?.access_token) {
    await fetch(`${REVOKE_URL}?token=${encodeURIComponent(token.access_token)}`, {
      method: "POST",
    }).catch(() => undefined);
  }
  await r.del(tokenKey(sessionId));
  await r.del(mapKey(sessionId));
}
