import "server-only";
import type { PushSubscription as WebPushSubscription } from "web-push";

declare global {
  // eslint-disable-next-line no-var
  var __pushSubscriptions: Map<string, WebPushSubscription> | undefined;
}

function store(): Map<string, WebPushSubscription> {
  if (!globalThis.__pushSubscriptions) {
    globalThis.__pushSubscriptions = new Map();
  }
  return globalThis.__pushSubscriptions;
}

export function saveSubscription(sub: WebPushSubscription): void {
  store().set(sub.endpoint, sub);
}

export function removeSubscription(endpoint: string): void {
  store().delete(endpoint);
}

export function listSubscriptions(): WebPushSubscription[] {
  return Array.from(store().values());
}

export function count(): number {
  return store().size;
}
