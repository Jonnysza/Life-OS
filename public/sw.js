self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Life OS", body: event.data.text() };
  }
  const title = payload.title || "Life OS";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.tag,
    vibrate: payload.vibrate || [100, 50, 100],
    requireInteraction: payload.requireInteraction || false,
    renotify: !!payload.tag,
    actions: payload.actions || [],
    data: {
      url: payload.url || "/",
      sessionId: payload.sessionId,
      ...payload.data,
    },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

async function ackAction(sessionId, todoId, action, minutes) {
  try {
    await fetch("/api/push/ack", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionId, ownerId: self.__lifeOwnerId, todoId, action, minutes }),
    });
  } catch {
    // best-effort
  }
}

self.addEventListener("notificationclick", (event) => {
  const action = event.action;
  const data = (event.notification && event.notification.data) || {};
  const sessionId = data.sessionId;
  self.__lifeOwnerId = data.ownerId || self.__lifeOwnerId;
  const todoId = data.todoId;

  if (action === "done" && sessionId && todoId) {
    event.notification.close();
    event.waitUntil(ackAction(sessionId, todoId, "done"));
    return;
  }
  if (action === "snooze" && sessionId && todoId) {
    event.notification.close();
    event.waitUntil(ackAction(sessionId, todoId, "snooze", 5));
    return;
  }

  event.notification.close();
  const url = data.url || "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) return client.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      })
  );
});
