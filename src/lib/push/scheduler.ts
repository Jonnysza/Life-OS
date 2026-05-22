import "server-only";
import { redis, redisAvailable } from "./redis";

const DUE_ZSET = "push:due";
const META_PREFIX = "push:meta:";
const SESSION_SCHEDULE_PREFIX = "push:session-schedule:";

export type ScheduledNotification = {
  sessionId: string;
  todoId: string;
  title: string;
  date: string;
  time: string;
  durationMinutes?: number;
  kind: "todo" | "event";
  snoozeCount: number;
  scheduledFor: number;
};

function makeId(sessionId: string, todoId: string): string {
  return `${sessionId}::${todoId}`;
}

export async function scheduleNotification(
  notif: Omit<ScheduledNotification, "snoozeCount">
): Promise<void> {
  if (!redisAvailable()) return;
  const r = redis();
  const id = makeId(notif.sessionId, notif.todoId);
  const record: ScheduledNotification = { ...notif, snoozeCount: 0 };
  await r.set(META_PREFIX + id, record);
  await r.zadd(DUE_ZSET, { score: notif.scheduledFor, member: id });
  await r.sadd(SESSION_SCHEDULE_PREFIX + notif.sessionId, id);
}

export async function rescheduleSnooze(
  sessionId: string,
  todoId: string,
  delayMinutes = 5
): Promise<ScheduledNotification | null> {
  if (!redisAvailable()) return null;
  const r = redis();
  const id = makeId(sessionId, todoId);
  const meta = await r.get<ScheduledNotification>(META_PREFIX + id);
  if (!meta) return null;
  const next = Date.now() + delayMinutes * 60 * 1000;
  const updated: ScheduledNotification = {
    ...meta,
    snoozeCount: meta.snoozeCount + 1,
    scheduledFor: next,
  };
  await r.set(META_PREFIX + id, updated);
  await r.zadd(DUE_ZSET, { score: next, member: id });
  return updated;
}

export async function cancelNotification(
  sessionId: string,
  todoId: string
): Promise<void> {
  if (!redisAvailable()) return;
  const r = redis();
  const id = makeId(sessionId, todoId);
  await r.del(META_PREFIX + id);
  await r.zrem(DUE_ZSET, id);
  await r.srem(SESSION_SCHEDULE_PREFIX + sessionId, id);
}

export async function syncSessionSchedule(
  sessionId: string,
  blocks: {
    todoId: string;
    title: string;
    date: string;
    time: string;
    durationMinutes?: number;
    kind: "todo" | "event";
    scheduledFor: number;
  }[]
): Promise<{ added: number; removed: number }> {
  if (!redisAvailable()) return { added: 0, removed: 0 };
  const r = redis();
  const incomingIds = new Set(blocks.map((b) => makeId(sessionId, b.todoId)));

  const existing = await r.smembers(SESSION_SCHEDULE_PREFIX + sessionId);
  let removed = 0;
  for (const id of existing) {
    if (!incomingIds.has(id)) {
      await r.del(META_PREFIX + id);
      await r.zrem(DUE_ZSET, id);
      await r.srem(SESSION_SCHEDULE_PREFIX + sessionId, id);
      removed++;
    }
  }

  let added = 0;
  for (const block of blocks) {
    const id = makeId(sessionId, block.todoId);
    const existing = await r.get<ScheduledNotification>(META_PREFIX + id);
    if (
      existing &&
      existing.scheduledFor === block.scheduledFor &&
      existing.title === block.title &&
      existing.time === block.time
    ) {
      continue;
    }
    const snoozeCount = existing?.snoozeCount ?? 0;
    const record: ScheduledNotification = { ...block, sessionId, snoozeCount };
    await r.set(META_PREFIX + id, record);
    await r.zadd(DUE_ZSET, { score: block.scheduledFor, member: id });
    await r.sadd(SESSION_SCHEDULE_PREFIX + sessionId, id);
    added++;
  }

  return { added, removed };
}

export async function fetchDueNotifications(
  upToTimestamp: number,
  max = 200
): Promise<ScheduledNotification[]> {
  if (!redisAvailable()) return [];
  const r = redis();
  const ids = await r.zrange(DUE_ZSET, 0, upToTimestamp, {
    byScore: true,
    offset: 0,
    count: max,
  });
  if (!ids || ids.length === 0) return [];
  const keys = (ids as string[]).map((id) => META_PREFIX + id);
  const values = await r.mget<ScheduledNotification[]>(...keys);
  return (values ?? []).filter(
    (v): v is ScheduledNotification => v !== null
  );
}

export async function markFired(
  sessionId: string,
  todoId: string
): Promise<void> {
  if (!redisAvailable()) return;
  const r = redis();
  const id = makeId(sessionId, todoId);
  await r.zrem(DUE_ZSET, id);
}

export async function markCompleted(
  sessionId: string,
  todoId: string
): Promise<void> {
  await cancelNotification(sessionId, todoId);
  if (!redisAvailable()) return;
  const r = redis();
  const completedKey = `push:completed:${sessionId}`;
  await r.sadd(completedKey, todoId);
  await r.expire(completedKey, 60 * 60 * 24 * 2);
}

export async function takeCompletedAcks(sessionId: string): Promise<string[]> {
  if (!redisAvailable()) return [];
  const r = redis();
  const key = `push:completed:${sessionId}`;
  const ids = await r.smembers(key);
  if (!ids || ids.length === 0) return [];
  await r.del(key);
  return ids;
}
